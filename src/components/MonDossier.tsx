/**
 * « Mon dossier » — phase 6, commit 3. Liste et télécharge les documents réellement conservés sur
 * Supabase Storage (table `documents` + bucket `justificatifs`, cf. `storage/documentsStorage.ts`).
 *
 * LECTURE SEULE côté dépôt : rien ici ne dépose de nouveau document — ça viendra des canaux
 * d'import (commits 4 et 5) et des frais réels (commit 6). Ce commit-ci construit l'écran qui les
 * rendra visibles, et sert de preuve à l'écran pour la fondation du commit 2.
 *
 * Le SEUL geste d'écriture de cet écran : « corriger le type » — le filet promis à Benoît si l'IA
 * se trompe sur un type rarement testé (ex. `attestation_cpam`, sans spécimen réel pour l'instant).
 */

import { useEffect, useState } from "react";
import { obtenirClientAuth, obtenirClientDocuments, obtenirClientFichiers, type ClientAuth, type ClientDocuments, type ClientFichiers } from "../auth/supabaseClient";
import { useSession } from "../auth/session";
import { corrigerTypeDocument, listerDocuments, obtenirUrlTelechargement, type LigneDocument, type TypeDocument } from "../storage/documentsStorage";
import { formaterTaille } from "../lib/capaciteStockage";
import { telechargerDepuisUrl } from "../lib/telechargement";
import { LIBELLES_TYPE_DOCUMENT, TYPES_DOCUMENT_ORDONNES } from "../content/typeDocumentLabels";

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

function LigneDocumentAffichee({
  document,
  clientFichiers,
  clientDocuments,
  onTypeCorrige,
}: {
  document: LigneDocument;
  clientFichiers: ClientFichiers;
  clientDocuments: ClientDocuments;
  onTypeCorrige: (id: string, nouveauType: TypeDocument) => void;
}) {
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null);
  const [correctionEnCours, setCorrectionEnCours] = useState(false);
  const [erreurCorrection, setErreurCorrection] = useState<string | null>(null);

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
      </div>
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
      {etatListe.statut === "charge" &&
        etatListe.documents.map((document) => (
          <LigneDocumentAffichee key={document.id} document={document} clientFichiers={clientFichiers} clientDocuments={clientDocuments} onTypeCorrige={corriger} />
        ))}
    </Cadre>
  );
}
