/**
 * « Mon dossier » — phase 6, commit 3. Liste et télécharge les documents réellement conservés sur
 * Supabase Storage (table `documents` + bucket `justificatifs`, cf. `storage/documentsStorage.ts`).
 *
 * LECTURE SEULE côté dépôt : rien ici ne dépose de nouveau document — ça viendra des canaux
 * d'import (commits 4 et 5) et des frais réels (commit 6). Ce commit-ci construit l'écran qui les
 * rendra visibles, et sert de preuve à l'écran pour la fondation du commit 2.
 *
 * Deux gestes d'écriture sur cet écran : « corriger le type » — le filet promis à Benoît si l'IA se
 * trompe sur un type rarement testé (ex. `attestation_cpam`, sans spécimen réel pour l'instant) — et
 * « supprimer » (07/08/2026, `supprimerDocument` existait déjà dans `documentsStorage.ts` mais
 * n'était branché à aucun bouton). Suppression à deux clics, jamais en un clic : ce document est une
 * source, pas une donnée re-saisissable comme un contrat.
 */

import { useEffect, useMemo, useState } from "react";
import { obtenirClientAuth, obtenirClientDocuments, obtenirClientFichiers, type ClientAuth, type ClientDocuments, type ClientFichiers } from "../auth/supabaseClient";
import { useSession } from "../auth/session";
import { corrigerTypeDocument, listerDocuments, obtenirUrlTelechargement, supprimerDocument, type LigneDocument, type TypeDocument } from "../storage/documentsStorage";
import { formaterTaille } from "../lib/capaciteStockage";
import { horodatagePourNomFichier, telechargerBlob, telechargerDepuisUrl } from "../lib/telechargement";
import { LIBELLES_TYPE_DOCUMENT, TYPES_DOCUMENT_ORDONNES } from "../content/typeDocumentLabels";
import { regrouperDocuments, type GroupeDossier, type SousGroupeDossier } from "../lib/regroupementDossier";
import { construireArchive, evaluerArchive, nomArchive, type EchecArchive } from "../lib/archiveDossier";

interface MonDossierProps {
  /** Injectés par les tests ; par défaut, les clients de l'app (`null` si non configurés). */
  clientAuth?: ClientAuth | null;
  clientDocuments?: ClientDocuments | null;
  clientFichiers?: ClientFichiers | null;
}

type EtatListe = { statut: "chargement" } | { statut: "charge"; documents: LigneDocument[] } | { statut: "echec"; message: string };

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h2 className="font-display text-lg font-medium tracking-tight">Mon dossier</h2>
        <p className="text-xs text-faint leading-relaxed mt-1">
          Tous les documents que tu as déposés et acceptés d'envoyer sur le serveur — notifications, bulletins, relevés, justificatifs de frais — au même endroit, téléchargeables à tout
          moment.
        </p>
      </div>
      <div className="border-t border-line">{children}</div>
    </section>
  );
}

type EtatArchive =
  | { statut: "repos" }
  /** Au-delà du seuil : on dit le coût et on attend un second clic. Jamais un blocage. */
  | { statut: "confirmation" }
  | { statut: "construction"; traites: number; total: number }
  /** L'archive est téléchargée, mais des fichiers manquent — À AFFICHER, jamais à taire. */
  | { statut: "partiel"; echecs: EchecArchive[]; nombreInclus: number }
  | { statut: "echec"; message: string };

/**
 * Bouton « tout télécharger » d'un groupe (ou du dossier entier) — 06/08/2026.
 *
 * ⚠️ L'ÉTAT `partiel` EST LE POINT DÉLICAT. Une archive à laquelle il manque des fichiers est bel et
 * bien téléchargée (les autres documents sont dedans, autant les donner), mais elle NE DOIT JAMAIS
 * passer pour complète : les manquants sont nommés à l'écran, et `construireArchive` les inscrit
 * aussi dans l'archive. Afficher un simple « Téléchargé » ici serait un faux feu vert (devoir n°2).
 */
function BoutonArchive({
  documents,
  clientFichiers,
  libelleGroupe,
  intitule,
}: {
  documents: LigneDocument[];
  clientFichiers: ClientFichiers;
  /** Suffixe du nom de fichier. Absent = archive du dossier entier. */
  libelleGroupe?: string;
  intitule: string;
}) {
  const [etat, setEtat] = useState<EtatArchive>({ statut: "repos" });
  const evaluation = evaluerArchive(documents);

  async function construire() {
    setEtat({ statut: "construction", traites: 0, total: documents.length });
    try {
      const resultat = await construireArchive(documents, {
        obtenirUrl: (document) => obtenirUrlTelechargement(clientFichiers, document.cheminStockage),
        onProgression: (traites, total) => setEtat({ statut: "construction", traites, total }),
      });
      telechargerBlob(nomArchive(horodatagePourNomFichier(), libelleGroupe), resultat.archive);
      setEtat(resultat.echecs.length > 0 ? { statut: "partiel", echecs: resultat.echecs, nombreInclus: resultat.nombreInclus } : { statut: "repos" });
    } catch (incident: unknown) {
      setEtat({ statut: "echec", message: incident instanceof Error ? incident.message : String(incident) });
    }
  }

  const enCours = etat.statut === "construction";

  /** Premier clic : avertir si c'est gros. Second clic (ou dossier léger) : construire. */
  function auClic() {
    if (etat.statut !== "confirmation" && evaluation.doitAvertir) {
      setEtat({ statut: "confirmation" });
      return;
    }
    void construire();
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={auClic}
        disabled={enCours || documents.length === 0}
        className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted disabled:opacity-40 whitespace-nowrap"
      >
        {enCours ? `${etat.traites}/${etat.total}…` : etat.statut === "confirmation" ? "Télécharger quand même" : intitule}
      </button>
      {etat.statut === "confirmation" && (
        <div className="text-xs text-amber leading-relaxed mt-1" role="alert">
          <p>
            {evaluation.nombre} documents, {formaterTaille(evaluation.octets)}. La préparation se fait dans ce navigateur et demandera environ {formaterTaille(evaluation.picMemoireOctets)} de
            mémoire : sur un téléphone, l'onglet peut se fermer avant la fin. Les fichiers étant récupérés un par un, compte aussi plusieurs minutes.
          </p>
          <p className="mt-0.5">Plus sûr : télécharger catégorie par catégorie.</p>
          <button type="button" onClick={() => setEtat({ statut: "repos" })} className="underline mt-0.5">
            Annuler
          </button>
        </div>
      )}
      {etat.statut === "partiel" && (
        <div className="text-xs text-amber leading-relaxed mt-1" role="alert">
          <p>
            Archive téléchargée mais INCOMPLÈTE : {etat.nombreInclus} document(s) inclus, {etat.echecs.length} manquant(s). Ils sont toujours dans Cadence — réessaie.
          </p>
          <ul className="list-disc pl-4 mt-0.5">
            {etat.echecs.map((echec) => (
              <li key={echec.nomFichier}>
                {echec.nomFichier} — {echec.motif}
              </li>
            ))}
          </ul>
        </div>
      )}
      {etat.statut === "echec" && (
        <p className="text-xs text-red leading-relaxed mt-1" role="alert">
          Archive impossible : {etat.message}
        </p>
      )}
    </div>
  );
}

function LigneDocumentAffichee({
  document,
  clientFichiers,
  clientDocuments,
  onTypeCorrige,
  onSupprime,
}: {
  document: LigneDocument;
  clientFichiers: ClientFichiers;
  clientDocuments: ClientDocuments;
  onTypeCorrige: (id: string, nouveauType: TypeDocument) => void;
  onSupprime: (id: string) => void;
}) {
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null);
  const [correctionEnCours, setCorrectionEnCours] = useState(false);
  const [erreurCorrection, setErreurCorrection] = useState<string | null>(null);
  // Premier clic : demande confirmation, jamais une suppression en un clic (devoir n°1 — ce document
  // est une source, pas une donnée re-saisissable comme un contrat). Second clic : supprime pour de bon.
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  async function supprimer() {
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      const resultat = await supprimerDocument(clientFichiers, clientDocuments, { id: document.id, cheminStockage: document.cheminStockage });
      if (resultat.ok) onSupprime(document.id);
      else {
        setErreurSuppression(resultat.message);
        setConfirmationSuppression(false);
      }
    } finally {
      setSuppressionEnCours(false);
    }
  }

  async function telecharger() {
    setTelechargementEnCours(true);
    setErreurTelechargement(null);
    try {
      const resultat = await obtenirUrlTelechargement(clientFichiers, document.cheminStockage);
      if ("erreur" in resultat) {
        setErreurTelechargement(resultat.erreur);
        return;
      }
      await telechargerDepuisUrl(document.nomFichier, resultat.url);
    } catch (incident: unknown) {
      setErreurTelechargement(incident instanceof Error ? incident.message : String(incident));
    } finally {
      setTelechargementEnCours(false);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-line last:border-b-0 flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-ink text-sm truncate">{document.nomFichier}</p>
        <p className="text-xs text-faint mt-0.5">
          {new Date(document.creeLe).toLocaleDateString("fr-FR")} · {formaterTaille(document.tailleOctets)}
        </p>
        {erreurTelechargement !== null && (
          <p className="text-xs text-red mt-1" role="alert">
            {erreurTelechargement}
          </p>
        )}
        {erreurCorrection !== null && (
          <p className="text-xs text-red mt-1" role="alert">
            {erreurCorrection}
          </p>
        )}
        {erreurSuppression !== null && (
          <p className="text-xs text-red mt-1" role="alert">
            {erreurSuppression}
          </p>
        )}
        {confirmationSuppression && (
          <div className="text-xs text-amber leading-relaxed mt-1" role="alert">
            <p>Supprimer définitivement ce document ? Le fichier et sa ligne dans « Mon dossier » seront effacés — ça ne touche à rien d'autre (profil, contrats).</p>
            <div className="flex items-center gap-3 mt-1">
              <button type="button" onClick={supprimer} disabled={suppressionEnCours} className="underline text-red disabled:opacity-40">
                {suppressionEnCours ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button type="button" onClick={() => setConfirmationSuppression(false)} disabled={suppressionEnCours} className="underline disabled:opacity-40">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          aria-label={`Type de « ${document.nomFichier} »`}
          value={document.typeDocument}
          disabled={correctionEnCours}
          onChange={async (e) => {
            const nouveauType = e.target.value as TypeDocument;
            setCorrectionEnCours(true);
            setErreurCorrection(null);
            try {
              const resultat = await corrigerTypeDocument(clientDocuments, document.id, nouveauType);
              if (resultat.ok) onTypeCorrige(document.id, nouveauType);
              else setErreurCorrection(resultat.message);
            } finally {
              setCorrectionEnCours(false);
            }
          }}
          className="text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5"
        >
          {TYPES_DOCUMENT_ORDONNES.map((type) => (
            <option key={type} value={type}>
              {LIBELLES_TYPE_DOCUMENT[type]}
            </option>
          ))}
        </select>
        <button type="button" onClick={telecharger} disabled={telechargementEnCours} className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted disabled:opacity-40 whitespace-nowrap">
          {telechargementEnCours ? "…" : "Télécharger"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmationSuppression(true)}
          disabled={suppressionEnCours || confirmationSuppression}
          aria-label={`Supprimer « ${document.nomFichier} »`}
          className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-red hover:border-red/40 disabled:opacity-40 whitespace-nowrap transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

/** Résumé « 4 documents · 1,2 Mo » — le total par catégorie que Benoît veut voir d'un coup d'œil. */
function resume(nombre: number, octets: number): string {
  return `${nombre} document${nombre > 1 ? "s" : ""} · ${formaterTaille(octets)}`;
}

function SousGroupeAffiche({
  sousGroupe,
  clientFichiers,
  clientDocuments,
  onTypeCorrige,
  onSupprime,
}: {
  sousGroupe: SousGroupeDossier;
  clientFichiers: ClientFichiers;
  clientDocuments: ClientDocuments;
  onTypeCorrige: (id: string, nouveauType: TypeDocument) => void;
  onSupprime: (id: string) => void;
}) {
  return (
    <div className="border-t border-line">
      <div className="px-4 py-2 bg-surface-2/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-ink">{sousGroupe.libelle}</p>
          <p className="text-xs text-faint mt-0.5">{resume(sousGroupe.documents.length, sousGroupe.totalOctets)}</p>
        </div>
        <BoutonArchive documents={sousGroupe.documents} clientFichiers={clientFichiers} libelleGroupe={sousGroupe.categorie ?? "sans-categorie"} intitule="Tout télécharger" />
      </div>
      {sousGroupe.documents.map((document) => (
        <LigneDocumentAffichee key={document.id} document={document} clientFichiers={clientFichiers} clientDocuments={clientDocuments} onTypeCorrige={onTypeCorrige} onSupprime={onSupprime} />
      ))}
    </div>
  );
}

/**
 * Un groupe de type de document, repliable. OUVERT par défaut : un dossier dont tout est replié
 * donnerait l'impression d'être vide, ce qui est exactement l'inverse du but.
 */
function GroupeAffiche({
  groupe,
  clientFichiers,
  clientDocuments,
  onTypeCorrige,
  onSupprime,
}: {
  groupe: GroupeDossier;
  clientFichiers: ClientFichiers;
  clientDocuments: ClientDocuments;
  onTypeCorrige: (id: string, nouveauType: TypeDocument) => void;
  onSupprime: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(true);

  return (
    <div className="border-t border-line first:border-t-0">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="min-w-0 text-left">
          <p className="text-sm text-ink">
            <span aria-hidden="true" className="text-faint mr-1.5">
              {ouvert ? "▾" : "▸"}
            </span>
            {groupe.libelle}
          </p>
          <p className="text-xs text-faint mt-0.5 ml-4">{resume(groupe.documents.length, groupe.totalOctets)}</p>
        </button>
        <BoutonArchive documents={groupe.documents} clientFichiers={clientFichiers} libelleGroupe={groupe.libelle} intitule="Tout télécharger" />
      </div>

      {ouvert &&
        (groupe.sousGroupes.length > 0
          ? groupe.sousGroupes.map((sousGroupe) => (
              <SousGroupeAffiche
                key={sousGroupe.categorie ?? "sans-categorie"}
                sousGroupe={sousGroupe}
                clientFichiers={clientFichiers}
                clientDocuments={clientDocuments}
                onTypeCorrige={onTypeCorrige}
                onSupprime={onSupprime}
              />
            ))
          : groupe.documents.map((document) => (
              <LigneDocumentAffichee key={document.id} document={document} clientFichiers={clientFichiers} clientDocuments={clientDocuments} onTypeCorrige={onTypeCorrige} onSupprime={onSupprime} />
            )))}
    </div>
  );
}

export function MonDossier({
  clientAuth = obtenirClientAuth(),
  clientDocuments = obtenirClientDocuments(),
  clientFichiers = obtenirClientFichiers(),
}: MonDossierProps) {
  const session = useSession(clientAuth);
  const [etatListe, setEtatListe] = useState<EtatListe>({ statut: "chargement" });
  // Le classement vit dans `lib/regroupementDossier.ts` (fonction pure, testée) — cet écran ne fait
  // que le rendre. Aucune règle de regroupement ici.
  const groupes = useMemo(() => (etatListe.statut === "charge" ? regrouperDocuments(etatListe.documents) : []), [etatListe]);

  useEffect(() => {
    if (session.statut !== "connecte" || !clientDocuments) return;
    let annule = false;
    setEtatListe({ statut: "chargement" });
    listerDocuments(clientDocuments, session.utilisateurId).then((resultat) => {
      if (annule) return;
      setEtatListe("erreur" in resultat ? { statut: "echec", message: resultat.erreur } : { statut: "charge", documents: resultat.documents });
    });
    return () => {
      annule = true;
    };
    // `session.utilisateurId` n'existe que dans la branche "connecte" — TypeScript ne le sait pas au
    // niveau du tableau de dépendances, donc `session` seule suffit à le représenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, clientDocuments]);

  function corriger(id: string, nouveauType: TypeDocument) {
    setEtatListe((etat) => (etat.statut === "charge" ? { statut: "charge", documents: etat.documents.map((d) => (d.id === id ? { ...d, typeDocument: nouveauType } : d)) } : etat));
  }

  function retirer(id: string) {
    setEtatListe((etat) => (etat.statut === "charge" ? { statut: "charge", documents: etat.documents.filter((d) => d.id !== id) } : etat));
  }

  if (session.statut === "nonConfigure") {
    return (
      <Cadre>
        <p className="text-muted leading-relaxed p-4">La connexion n'est pas configurée dans cette version de Cadence — le dossier n'existe que pour un compte connecté.</p>
      </Cadre>
    );
  }

  if (session.statut === "chargement") {
    return (
      <Cadre>
        <p className="text-muted p-4" aria-live="polite">
          Vérification de la connexion…
        </p>
      </Cadre>
    );
  }

  if (session.statut === "indetermine") {
    return (
      <Cadre>
        <p className="text-amber leading-relaxed p-4" role="alert">
          Impossible de savoir si tu es connecté : {session.detail}
        </p>
      </Cadre>
    );
  }

  if (session.statut === "deconnecte") {
    return (
      <Cadre>
        <p className="text-muted leading-relaxed p-4">Connecte-toi (section « Compte », en bas de « Mon profil ») pour voir ton dossier.</p>
      </Cadre>
    );
  }

  // Reste le cas "connecte". `clientDocuments`/`clientFichiers` devraient être non nuls dès qu'une
  // session existe (même client Supabase) ; le garde-fou reste explicite plutôt que supposé.
  if (!clientDocuments || !clientFichiers) {
    return (
      <Cadre>
        <p className="text-amber leading-relaxed p-4" role="alert">
          Connecté, mais la surface de stockage n'est pas disponible — signale-le, ce cas ne devrait pas se produire.
        </p>
      </Cadre>
    );
  }

  return (
    <Cadre>
      {etatListe.statut === "chargement" && (
        <p className="text-muted p-4" aria-live="polite">
          Chargement de ton dossier…
        </p>
      )}
      {etatListe.statut === "echec" && (
        <p className="text-amber leading-relaxed p-4" role="alert">
          Impossible de charger ton dossier : {etatListe.message}
        </p>
      )}
      {etatListe.statut === "charge" && etatListe.documents.length === 0 && <p className="text-muted p-4">Aucun document pour l'instant.</p>}
      {etatListe.statut === "charge" && etatListe.documents.length > 0 && (
        <>
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-surface-2/40">
            <p className="text-xs text-muted">{resume(etatListe.documents.length, etatListe.documents.reduce((t, d) => t + d.tailleOctets, 0))} au total</p>
            <BoutonArchive documents={etatListe.documents} clientFichiers={clientFichiers} intitule="Tout télécharger (dossier entier)" />
          </div>
          {groupes.map((groupe) => (
            <GroupeAffiche key={groupe.type} groupe={groupe} clientFichiers={clientFichiers} clientDocuments={clientDocuments} onTypeCorrige={corriger} onSupprime={retirer} />
          ))}
        </>
      )}
    </Cadre>
  );
}
