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

interface ImportDocumentIAProps {
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
}

const ECHEC_INATTENDU = "L'envoi a échoué pour une raison inattendue. Réessaie, ou saisis les informations à la main.";

export function ImportDocumentIA({ profil, config, decompteActuel, onAjouterContrat, onAjouterPeriode, onModifierProfil }: ImportDocumentIAProps) {
  /** Fichier choisi et validé, en attente du consentement. Non nul ⇒ la modale est ouverte. */
  const [fichierEnAttente, setFichierEnAttente] = useState<File | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ExtractionResult | null>(null);
  const [survole, setSurvole] = useState(false);

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
    try {
      const base64 = await lirePdfEnBase64(fichierEnAttente);
      const extraction = await extraireDocumentIA(base64);
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

  if (resultat) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display text-base font-medium tracking-tight">Propositions issues de ton document</h3>
          <button
            onClick={() => setResultat(null)}
            className="px-3 py-1.5 rounded-full border border-line text-muted text-xs hover:text-ink transition-colors"
          >
            Importer un autre document
          </button>
        </div>
        {/* `documentEnvoye` : ce résultat vient d'un vrai envoi, le rappel du destinataire est donc
            exact ici — contrairement au banc d'essai sur fixtures, où rien n'est parti. */}
        <RevueExtraction
          resultat={resultat}
          profil={profil}
          config={config}
          decompteActuel={decompteActuel}
          onAjouterContrat={onAjouterContrat}
          onAjouterPeriode={onAjouterPeriode}
          onModifierProfil={onModifierProfil}
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

      <div>
        <h3 className="font-display text-base font-medium tracking-tight">Importer avec l'IA</h3>
        {/* Annonce permanente : ce que fait ce bouton, su avant de cliquer. Le détail complet reste
            dans la modale, au moment de décider. */}
        <p className="text-xs text-faint leading-relaxed mt-1">{ANNONCE_CANAL_IA}</p>
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
