import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import type { BulletinExtrait } from "../types";
import { extraireBulletin } from "../lib/extractionBulletin";
import { RAPPEL_AEM_FAIT_FOI } from "../content/rappelAEM";
import { ContractForm } from "./ContractForm";
import { obtenirClientAuth, obtenirClientDocuments, obtenirClientFichiers, type ClientAuth, type ClientDocuments, type ClientFichiers } from "../auth/supabaseClient";
import { useSession } from "../auth/session";
import { deposerDocument } from "../storage/documentsStorage";
import { ConsentementConservationDocument } from "./ConsentementConservationDocument";

interface ImportBulletinsProps {
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onImporterContrat: (contrat: Omit<Contrat, "id">) => void;
  /** Injectés par les tests ; par défaut, les clients de l'app (`null` si non configurés). */
  clientAuth?: ClientAuth | null;
  clientDocuments?: ClientDocuments | null;
  clientFichiers?: ClientFichiers | null;
}

const LABEL_CONFIANCE: Record<"haute" | "moyenne" | "faible", string> = {
  haute: "confiance haute",
  moyenne: "à vérifier",
  faible: "peu fiable",
};

const COULEUR_CONFIANCE: Record<"haute" | "moyenne" | "faible", string> = {
  haute: "text-mint",
  moyenne: "text-amber",
  faible: "text-red",
};

/**
 * L'année du document, pour `documents.annee_fiscale` (not null en base). Dérivée de la date du
 * contrat lue à l'extraction — jamais devinée au sens fort : à défaut de date lisible, l'année en
 * cours reste la meilleure approximation disponible et ne fausse rien (`annee_fiscale` ne sert qu'à
 * classer le document dans « Mon dossier », aucun calcul réglementaire n'en dépend).
 */
function anneeDuDocument(champs: Partial<Contrat>): number {
  const date = champs.dateDebut ?? champs.date;
  const annee = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(annee) ? annee : new Date().getFullYear();
}

/** L'étape en cours — une seule variable d'état plutôt que des booléens épars, pour qu'aucune
 *  combinaison impossible (ex. modale ET revue affichées en même temps) ne puisse se produire. */
type Etape =
  | { type: "attente" }
  | { type: "consentement"; fichier: File; extrait: BulletinExtrait }
  | { type: "revue"; extrait: BulletinExtrait; erreurConservation: string | null };

export function ImportBulletins({
  profil,
  config,
  decompteActuel,
  onImporterContrat,
  clientAuth = obtenirClientAuth(),
  clientDocuments = obtenirClientDocuments(),
  clientFichiers = obtenirClientFichiers(),
}: ImportBulletinsProps) {
  const session = useSession(clientAuth);
  const [etape, setEtape] = useState<Etape>({ type: "attente" });
  const [enCours, setEnCours] = useState(false);
  const [survole, setSurvole] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function traiterFichier(fichier: File) {
    setEnCours(true);
    setErreur(null);
    try {
      if (fichier.type !== "application/pdf") {
        setErreur("Seuls les fichiers PDF sont acceptés.");
        return;
      }
      const resultat = await extraireBulletin(fichier);
      // Connecté : propose la conservation AVANT la revue — décision distincte de la validation du
      // contrat, qui peut arriver bien plus tard voire jamais (annulation). Sans session, ce choix
      // n'existe pas : rien ne peut de toute façon partir nulle part.
      if (session.statut === "connecte") {
        setEtape({ type: "consentement", fichier, extrait: resultat });
      } else {
        setEtape({ type: "revue", extrait: resultat, erreurConservation: null });
      }
    } catch {
      setErreur("Échec de l'extraction. Saisis le contrat manuellement.");
    } finally {
      setEnCours(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setSurvole(false);
    const fichier = e.dataTransfer.files[0];
    if (fichier) traiterFichier(fichier);
  }

  async function conserverSurLeServeur() {
    if (etape.type !== "consentement" || session.statut !== "connecte" || !clientDocuments || !clientFichiers) return;
    setEnvoiEnCours(true);
    try {
      const resultat = await deposerDocument(clientFichiers, clientDocuments, {
        utilisateurId: session.utilisateurId,
        fichier: etape.fichier,
        typeDocument: "aem_bulletin",
        anneeFiscale: anneeDuDocument(etape.extrait.champs),
      });
      // Un échec de conservation ne doit JAMAIS bloquer l'import lui-même (devoir n°1) : les
      // informations déjà extraites localement restent utilisables — seule la copie du fichier sur
      // le serveur a échoué, et on le dit, sans plus.
      const erreurConservation = resultat.statut === "echec" || resultat.statut === "ficherEnvoyeLigneEchouee" ? resultat.message : null;
      setEtape({ type: "revue", extrait: etape.extrait, erreurConservation });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function passerLaConservation() {
    if (etape.type !== "consentement") return;
    setEtape({ type: "revue", extrait: etape.extrait, erreurConservation: null });
  }

  function validerImport(contrat: Omit<Contrat, "id">) {
    onImporterContrat(contrat);
    setEtape({ type: "attente" });
  }

  return (
    <div className="space-y-6">
      {session.statut === "connecte" ? (
        <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5">
          Cet import-ci lit le bulletin localement, dans ton navigateur. Comme tu es connecté, tu peux ensuite choisir de conserver aussi le fichier sur le serveur, pour le retrouver
          dans « Mon dossier » — ce sera toujours ton choix, jamais automatique. Rappel : {RAPPEL_AEM_FAIT_FOI} Cet import sert uniquement à ton suivi personnel.
        </p>
      ) : (
        // La portée de cette promesse est volontairement explicite (« cet import-ci »). Formulée en
        // absolu (« aucun bulletin n'est envoyé sur un serveur »), elle devenait trompeuse dès qu'un
        // canal d'import assisté par IA — qui, lui, envoie le document — cohabiterait dans le même
        // onglet : l'utilisateur aurait lu une garantie générale là où elle ne vaut que pour ce
        // canal-ci. Le canal IA porte sa propre mention, bloquante et avant tout envoi
        // (`ConsentementEnvoiIA.tsx`). ⚠️ Reste vraie SANS SESSION : c'est la seule condition qui
        // permette d'ouvrir la modale de conservation ci-dessous, donc rien ne peut partir ici.
        <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5">
          Cet import-ci est traité 100 % localement dans ton navigateur : le bulletin que tu déposes ci-dessous ne quitte jamais ton appareil. (L'import
          assisté par IA, lui, envoie le document à un serveur — il te le dit explicitement et te demande ton accord avant chaque envoi.) Rappel :{" "}
          {RAPPEL_AEM_FAIT_FOI} Cet import sert uniquement à ton suivi personnel.
        </p>
      )}

      {etape.type === "consentement" && (
        <ConsentementConservationDocument nomFichier={etape.fichier.name} enCours={envoiEnCours} onConserver={conserverSurLeServeur} onPasser={passerLaConservation} />
      )}

      {etape.type === "attente" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setSurvole(true);
          }}
          onDragLeave={() => setSurvole(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-card p-12 text-center transition-colors ${survole ? "border-mint bg-mint/5" : "border-line-strong"}`}
        >
          <p className="text-ink mb-2">{enCours ? "Extraction en cours…" : "Dépose un bulletin de paie PDF ici"}</p>
          <p className="text-sm text-muted mb-4">ou</p>
          <label className="inline-block bg-surface-2 border border-line rounded-lg px-4 py-2 text-sm cursor-pointer hover:border-line-strong transition-colors">
            Choisir un fichier
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const fichier = e.target.files?.[0];
                if (fichier) traiterFichier(fichier);
              }}
            />
          </label>
          {erreur && <p className="text-sm text-red mt-4">{erreur}</p>}
        </div>
      )}

      {etape.type === "revue" && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm font-medium text-ink mb-2">Revue avant enregistrement</p>
            {etape.erreurConservation !== null && (
              <p className="text-xs text-amber mb-3" role="alert">
                Le fichier n'a pas pu être conservé sur le serveur ({etape.erreurConservation}) — les informations ci-dessous restent utilisables normalement.
              </p>
            )}
            {etape.extrait.avertissements.length > 0 && (
              <ul className="text-xs text-amber space-y-1 mb-3">
                {etape.extrait.avertissements.map((a, i) => (
                  <li key={i}>⚠ {a}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(etape.extrait.confiance).map(([champ, niveau]) => (
                <span key={champ} className={`text-xs px-2 py-1 rounded-full bg-surface-2 ${COULEUR_CONFIANCE[niveau]}`}>
                  {champ} · {LABEL_CONFIANCE[niveau]}
                </span>
              ))}
            </div>
            <details className="text-xs text-faint">
              <summary className="cursor-pointer">Voir le texte brut extrait</summary>
              <pre className="whitespace-pre-wrap mt-2 max-h-40 overflow-y-auto">{etape.extrait.texteBrut}</pre>
            </details>
          </div>

          <ContractForm
            profil={profil}
            config={config}
            decompteActuel={decompteActuel}
            valeurInitiale={etape.extrait.champs}
            onValider={validerImport}
            onAnnuler={() => setEtape({ type: "attente" })}
          />
        </div>
      )}
    </div>
  );
}
