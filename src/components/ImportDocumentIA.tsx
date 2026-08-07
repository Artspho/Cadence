/**
 * Point d'entrée de l'import assisté par IA — le premier chemin de Cadence par lequel un document de
 * l'utilisateur quitte son appareil.
 *
 * Le chemin est volontairement en ligne droite, sans raccourci possible :
 *
 *   dépôt du fichier → contrôles locaux → CONSENTEMENT → envoi → revue
 *
 * `extraireDocumentIA` n'est appelé qu'à un seul endroit dans tout le projet : le gestionnaire
 * `envoyer()` ci-dessous, branché sur le bouton « Envoyer ce document » de la modale. Ce n'est pas une
 * convention de politesse mais la garantie elle-même : tant que ce bouton n'est pas cliqué, aucun
 * octet ne part. Si un jour un autre appelant apparaît, la mention cesse d'être garantie — c'est la
 * chose à ne pas faire.
 *
 * Les contrôles locaux (format, taille) sont faits AVANT la modale : demander à quelqu'un d'accepter
 * l'envoi d'un fichier qu'on sait condamné serait lui faire prendre une décision pour rien.
 *
 * Le canal local (`ImportBulletins.tsx`, pdfjs, aucun réseau) est un chemin distinct et reste
 * intouché. Les deux cohabitent dans l'onglet « Import PDF » et n'ont ni état ni code en commun.
 */

import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, PeriodeAssimilee, Profil } from "../types";
import type { ExtractionResult } from "../types/extraction";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ANNONCE_CANAL_IA } from "../content/mentionEnvoiIA";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import { extraireDocumentIA } from "../lib/extraireDocumentIA";
import { lirePdfEnBase64, validerFichierPourEnvoiIA } from "../lib/fichierImportIA";
import { ConsentementEnvoiIA } from "./ConsentementEnvoiIA";
import { RevueExtraction } from "./RevueExtraction";
import { obtenirClientAuth, obtenirClientDocuments, obtenirClientFichiers, type ClientAuth, type ClientDocuments, type ClientFichiers } from "../auth/supabaseClient";
import { useSession } from "../auth/session";
import { chercherDoublon, deposerDocument, typeDocumentDepuisDetection, type LigneDocument, type TypeDocument } from "../storage/documentsStorage";
import { LIBELLES_TYPE_DOCUMENT, TYPES_DOCUMENT_ORDONNES } from "../content/typeDocumentLabels";
import { AvertissementDoublonDocument } from "./AvertissementDoublonDocument";
import { Spinner } from "./Spinner";

interface ImportDocumentIAProps {
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  contrats: Contrat[];
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
  /** Injectés par les tests ; par défaut, les clients de l'app (`null` si non configurés). */
  clientAuth?: ClientAuth | null;
  clientDocuments?: ClientDocuments | null;
  clientFichiers?: ClientFichiers | null;
  /**
   * Type suggéré depuis la checklist de l'espace dépôt (« Importer ce document »). N'affiche qu'un
   * bandeau de contexte et préremplit `SelecteurTypeNonReconnu` — l'IA détecte le type par elle-même,
   * ce champ ne le force jamais : promettre plus serait un comportement deviné que ce composant ne
   * tient pas (elle peut très bien détecter autre chose que ce qui était suggéré).
   */
  typeSuggere?: TypeDocument | null;
}

const ECHEC_INATTENDU = "L'envoi a échoué pour une raison inattendue. Réessaie, ou saisis les informations à la main.";

/**
 * Modale affichée UNIQUEMENT quand l'IA n'a rien reconnu (`non_reconnu`) chez un utilisateur
 * connecté — devoir n°1 (ne pas jeter le fichier) contre devoir n°2 (ne jamais deviner son type).
 * « Ne pas conserver » n'annule rien d'autre que la conservation : les propositions extraites
 * s'affichent dans les deux cas.
 */
function SelecteurTypeNonReconnu({
  enCours,
  onConserver,
  onIgnorer,
  typeInitial = "document_non_classe",
}: {
  enCours: boolean;
  onConserver: (type: (typeof TYPES_DOCUMENT_ORDONNES)[number]) => void;
  onIgnorer: () => void;
  /** Vient de la checklist (`typeSuggere`) — une aide au choix, pas une valeur imposée. */
  typeInitial?: (typeof TYPES_DOCUMENT_ORDONNES)[number];
}) {
  const [type, setType] = useState<(typeof TYPES_DOCUMENT_ORDONNES)[number]>(typeInitial);
  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="titre-type-non-reconnu">
      <div className="bg-surface border border-line rounded-hero p-6 max-w-[480px] space-y-4">
        <h2 id="titre-type-non-reconnu" className="font-display text-lg font-semibold tracking-tight">
          Cadence n'a pas reconnu ce document
        </h2>
        <p className="text-sm text-muted leading-relaxed">Tu peux quand même le conserver sur le serveur — choisis simplement de quel type il s'agit.</p>
        <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES_DOCUMENT_ORDONNES)[number])} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm">
          {TYPES_DOCUMENT_ORDONNES.map((t) => (
            <option key={t} value={t}>
              {LIBELLES_TYPE_DOCUMENT[t]}
            </option>
          ))}
        </select>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onConserver(type)}
            disabled={enCours}
            className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {enCours ? "Envoi…" : "Conserver sur le serveur"}
          </button>
          <button onClick={onIgnorer} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            Ne pas conserver
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImportDocumentIA({
  profil,
  config,
  decompteActuel,
  contrats,
  onAjouterContrat,
  onAjouterPeriode,
  onModifierProfil,
  onModifierContrat,
  clientAuth = obtenirClientAuth(),
  clientDocuments = obtenirClientDocuments(),
  clientFichiers = obtenirClientFichiers(),
  typeSuggere = null,
}: ImportDocumentIAProps) {
  const session = useSession(clientAuth);
  /** Fichier choisi et validé, en attente du consentement. Non nul ⇒ la modale est ouverte. */
  const [fichierEnAttente, setFichierEnAttente] = useState<File | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ExtractionResult | null>(null);
  const [survole, setSurvole] = useState(false);
  const [erreurConservation, setErreurConservation] = useState<string | null>(null);
  /** Non nul UNIQUEMENT quand l'IA a rendu `non_reconnu` chez un utilisateur connecté. */
  const [choixTypeEnAttente, setChoixTypeEnAttente] = useState<{ fichier: File; extraction: ExtractionResult } | null>(null);
  /** Non nul UNIQUEMENT quand `chercherDoublon` a trouvé, dans « Mon dossier », un document du même
   *  nom/taille que celui qui vient d'être envoyé — la conservation attend la décision de l'utilisateur,
   *  jamais automatique dans ce cas précis (contrairement au cas normal, sans doublon détecté). */
  const [doublonEnAttente, setDoublonEnAttente] = useState<{ fichier: File; typeDocument: TypeDocument; extraction: ExtractionResult; doublon: LigneDocument } | null>(null);

  function choisirFichier(fichier: File) {
    setErreur(null);
    const verdict = validerFichierPourEnvoiIA(fichier);
    if (!verdict.ok) {
      // Pas de modale : il n'y a rien à consentir puisque cet envoi n'aurait pas abouti.
      setErreur(verdict.erreur);
      return;
    }
    setFichierEnAttente(fichier);
  }

  /** « Annuler » : le fichier est oublié, aucun octet n'a quitté l'appareil. */
  function annuler() {
    setFichierEnAttente(null);
  }

  /**
   * LE SEUL endroit du projet qui déclenche un envoi. Atteignable uniquement par le bouton
   * « Envoyer ce document » de la modale de consentement.
   */
  async function envoyer() {
    if (!fichierEnAttente) return;
    setEnvoiEnCours(true);
    setErreur(null);
    setErreurConservation(null);
    try {
      const base64 = await lirePdfEnBase64(fichierEnAttente);
      // Jeton lu ICI, au moment de l'envoi — pas depuis `session` (l'état de `useSession`, qui peut
      // dater de la dernière connexion/rafraîchissement) — pour envoyer le jeton le plus à jour
      // possible (07/08/2026, point 8 : le serveur exige désormais une session valide).
      const { data: donneesSession } = clientAuth ? await clientAuth.getSession() : { data: { session: null } };
      const accessToken = donneesSession.session?.access_token;
      if (!accessToken) {
        throw new Error("Authentification requise pour envoyer un document. Reconnecte-toi puis réessaie.");
      }
      const extraction = await extraireDocumentIA(base64, accessToken);

      // Conservation : UNIQUEMENT si connecté (RLS exige une session réelle — cf. PHRASES[3] de
      // mentionEnvoiIA.ts, formulée au conditionnel pour cette même raison).
      if (session.statut === "connecte" && clientDocuments && clientFichiers) {
        const typeDocument = typeDocumentDepuisDetection(extraction.typeDocumentDetecte);
        if (typeDocument === null) {
          // L'IA n'a rien reconnu : on ne devine JAMAIS (devoir n°2), on demande à l'utilisateur —
          // et on garde le fichier de côté pour l'upload qui suivra son choix, ou son refus.
          setChoixTypeEnAttente({ fichier: fichierEnAttente, extraction });
          setFichierEnAttente(null);
          return;
        }
        const existant = await chercherDoublon(clientDocuments, session.utilisateurId, fichierEnAttente.name, fichierEnAttente.size);
        if (existant) {
          // Un document du même nom/taille existe déjà — la conservation n'est PAS automatique cette
          // fois : on laisse l'utilisateur trancher (`AvertissementDoublonDocument`) avant tout dépôt.
          setDoublonEnAttente({ fichier: fichierEnAttente, typeDocument, extraction, doublon: existant });
          setFichierEnAttente(null);
          return;
        }
        const resultatDepot = await deposerDocument(clientFichiers, clientDocuments, {
          utilisateurId: session.utilisateurId,
          fichier: fichierEnAttente,
          typeDocument,
          // Aucune date canonique unique dans ExtractionResult (types de proposition hétérogènes) :
          // l'année d'import sert de classement dans « Mon dossier », sans conséquence réglementaire.
          anneeFiscale: new Date().getFullYear(),
        });
        if (resultatDepot.statut === "echec" || resultatDepot.statut === "ficherEnvoyeLigneEchouee") setErreurConservation(resultatDepot.message);
      }

      setResultat(extraction);
      setFichierEnAttente(null);
    } catch (e) {
      // `extraireDocumentIA` ne laisse remonter que des messages maîtrisés (liste blanche de statuts,
      // rejet des corps d'origine inconnue) : on peut donc afficher celui-ci tel quel. Le repli couvre
      // le cas où ce qui est levé n'est pas une Error — jamais un objet brut jeté à l'écran.
      setErreur(e instanceof Error ? e.message : ECHEC_INATTENDU);
      // La modale se referme et l'erreur s'affiche dans l'onglet : réessayer passe par un nouveau
      // dépôt, donc par un nouveau consentement. Pas de bouton « réessayer » qui renverrait le
      // document sans repasser par la mention.
      setFichierEnAttente(null);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  /** Après un choix explicite de type pour un document `non_reconnu`. */
  async function validerChoixType(type: (typeof TYPES_DOCUMENT_ORDONNES)[number]) {
    if (!choixTypeEnAttente || session.statut !== "connecte" || !clientDocuments || !clientFichiers) return;
    setEnvoiEnCours(true);
    try {
      const existant = await chercherDoublon(clientDocuments, session.utilisateurId, choixTypeEnAttente.fichier.name, choixTypeEnAttente.fichier.size);
      if (existant) {
        setDoublonEnAttente({ fichier: choixTypeEnAttente.fichier, typeDocument: type, extraction: choixTypeEnAttente.extraction, doublon: existant });
        setChoixTypeEnAttente(null);
        return;
      }
      const resultatDepot = await deposerDocument(clientFichiers, clientDocuments, {
        utilisateurId: session.utilisateurId,
        fichier: choixTypeEnAttente.fichier,
        typeDocument: type,
        anneeFiscale: new Date().getFullYear(),
      });
      if (resultatDepot.statut === "echec" || resultatDepot.statut === "ficherEnvoyeLigneEchouee") setErreurConservation(resultatDepot.message);
      setResultat(choixTypeEnAttente.extraction);
      setChoixTypeEnAttente(null);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function ignorerConservation() {
    if (!choixTypeEnAttente) return;
    setResultat(choixTypeEnAttente.extraction);
    setChoixTypeEnAttente(null);
  }

  /** L'utilisateur confirme malgré l'avertissement : dépose quand même, comme si aucun doublon n'avait
   *  été trouvé. */
  async function confirmerDepotMalgreDoublon() {
    if (!doublonEnAttente || session.statut !== "connecte" || !clientDocuments || !clientFichiers) return;
    setEnvoiEnCours(true);
    try {
      const resultatDepot = await deposerDocument(clientFichiers, clientDocuments, {
        utilisateurId: session.utilisateurId,
        fichier: doublonEnAttente.fichier,
        typeDocument: doublonEnAttente.typeDocument,
        anneeFiscale: new Date().getFullYear(),
      });
      if (resultatDepot.statut === "echec" || resultatDepot.statut === "ficherEnvoyeLigneEchouee") setErreurConservation(resultatDepot.message);
    } finally {
      setEnvoiEnCours(false);
      setResultat(doublonEnAttente.extraction);
      setDoublonEnAttente(null);
    }
  }

  /** L'utilisateur renonce à conserver ce fichier-ci — les informations extraites restent proposées. */
  function ignorerDepotDoublon() {
    if (!doublonEnAttente) return;
    setResultat(doublonEnAttente.extraction);
    setDoublonEnAttente(null);
  }

  if (resultat) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display text-base font-medium tracking-tight">Propositions issues de ton document</h3>
          <button
            onClick={() => {
              setResultat(null);
              setErreurConservation(null);
            }}
            className="px-3 py-1.5 rounded-full border border-line text-muted text-xs hover:text-ink transition-colors"
          >
            Importer un autre document
          </button>
        </div>
        {erreurConservation !== null && (
          <p className="text-xs text-amber leading-relaxed" role="alert">
            Le fichier n'a pas pu être conservé sur le serveur ({erreurConservation}) — les informations ci-dessous restent utilisables normalement.
          </p>
        )}
        {/* `documentEnvoye` : ce résultat vient d'un vrai envoi, le rappel du destinataire est donc
            exact ici — contrairement au banc d'essai sur fixtures, où rien n'est parti. */}
        <RevueExtraction
          resultat={resultat}
          profil={profil}
          config={config}
          decompteActuel={decompteActuel}
          contrats={contrats}
          onAjouterContrat={onAjouterContrat}
          onAjouterPeriode={onAjouterPeriode}
          onModifierProfil={onModifierProfil}
          onModifierContrat={onModifierContrat}
          documentEnvoye
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fichierEnAttente && (
        <ConsentementEnvoiIA nomFichier={fichierEnAttente.name} enCours={envoiEnCours} onAnnuler={annuler} onConfirmer={envoyer} />
      )}

      {choixTypeEnAttente && (
        <SelecteurTypeNonReconnu enCours={envoiEnCours} onConserver={validerChoixType} onIgnorer={ignorerConservation} typeInitial={typeSuggere ?? undefined} />
      )}

      {doublonEnAttente && (
        <AvertissementDoublonDocument
          nomFichier={doublonEnAttente.fichier.name}
          dateDepotExistant={doublonEnAttente.doublon.creeLe}
          enCours={envoiEnCours}
          onConfirmer={confirmerDepotMalgreDoublon}
          onIgnorer={ignorerDepotDoublon}
        />
      )}

      <div>
        <h3 className="font-display text-base font-medium tracking-tight">Importer avec l'IA</h3>
        {/* Annonce permanente : ce que fait ce bouton, su avant de cliquer. Le détail complet reste
            dans la modale, au moment de décider. */}
        <p className="text-xs text-faint leading-relaxed mt-1">{ANNONCE_CANAL_IA}</p>
        {/* Vient de la checklist (« Importer ce document ») — une aide, jamais une promesse : l'IA
            détecte le type par elle-même, elle peut très bien reconnaître autre chose. */}
        {typeSuggere && (
          <p className="text-xs text-mint leading-relaxed mt-2 bg-mint/10 border border-mint/30 rounded-lg px-3 py-2">
            Tu es venu importer : <strong className="font-medium">{LIBELLES_TYPE_DOCUMENT[typeSuggere]}</strong>
          </p>
        )}
      </div>

      <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
        <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Documents à déposer</p>
        <ul className="text-sm text-muted space-y-1 list-disc list-inside">
          <li>Notification d'admission ARE (une fois, à l'ouverture de droits)</li>
          <li>Relevé de situation France Travail (un par mois — contient ton taux PAS et ton allocation à jour)</li>
          <li>Bulletins de paie (un par contrat, spectacle ou enseignement)</li>
          <li>Justificatif de déclaration de situation mensuelle (le récapitulatif reçu après ton actualisation)</li>
        </ul>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvole(true);
        }}
        onDragLeave={() => setSurvole(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvole(false);
          const fichier = e.dataTransfer.files[0];
          if (fichier) choisirFichier(fichier);
        }}
        className={`border-2 border-dashed rounded-card p-10 text-center transition-colors ${survole ? "border-amber bg-amber/5" : "border-line-strong"}`}
      >
        {envoiEnCours && <Spinner className="h-6 w-6 mx-auto mb-3" />}
        <p className="text-ink mb-2">
          {envoiEnCours ? "Lecture du document en cours…" : "Dépose ici un bulletin, une AEM, une notification ou un relevé (PDF)"}
        </p>
        {!envoiEnCours && (
          <>
            <p className="text-sm text-muted mb-4">ou</p>
            <label className="inline-block bg-surface-2 border border-line rounded-lg px-4 py-2 text-sm cursor-pointer hover:border-amber/40 transition-colors">
              Choisir un fichier
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const fichier = e.target.files?.[0];
                  if (fichier) choisirFichier(fichier);
                  // Permet de resélectionner le même fichier après une annulation ou une erreur.
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
        {envoiEnCours && <p className="text-sm text-muted">Ton document a été envoyé, la réponse peut prendre quelques secondes.</p>}
      </div>

      {erreur && (
        <p className="text-sm text-red leading-relaxed bg-red/10 border border-red/20 rounded-lg px-4 py-3" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
