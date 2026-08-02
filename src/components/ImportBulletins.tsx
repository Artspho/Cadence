import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import type { BulletinExtrait } from "../types";
import { extraireBulletin } from "../lib/extractionBulletin";
import { RAPPEL_AEM_FAIT_FOI } from "../content/rappelAEM";
import { ContractForm } from "./ContractForm";

interface ImportBulletinsProps {
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onImporterContrat: (contrat: Omit<Contrat, "id">) => void;
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

export function ImportBulletins({ profil, config, decompteActuel, onImporterContrat }: ImportBulletinsProps) {
  const [enCours, setEnCours] = useState(false);
  const [survole, setSurvole] = useState(false);
  const [extrait, setExtrait] = useState<BulletinExtrait | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function traiterFichier(fichier: File) {
    setEnCours(true);
    setErreur(null);
    try {
      if (fichier.type !== "application/pdf") {
        setErreur("Seuls les fichiers PDF sont acceptés.");
        return;
      }
      const resultat = await extraireBulletin(fichier);
      setExtrait(resultat);
    } catch (e) {
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

  function validerImport(contrat: Omit<Contrat, "id">) {
    onImporterContrat(contrat);
    setExtrait(null);
  }

  return (
    <div className="space-y-6">
      {/* La portée de cette promesse est volontairement explicite (« cet import-ci »). Formulée en
          absolu (« aucun bulletin n'est envoyé sur un serveur »), elle devenait trompeuse dès qu'un
          canal d'import assisté par IA — qui, lui, envoie le document — cohabiterait dans le même
          onglet : l'utilisateur aurait lu une garantie générale là où elle ne vaut que pour ce
          canal-ci. Le canal IA porte sa propre mention, bloquante et avant tout envoi
          (`ConsentementEnvoiIA.tsx`). */}
      <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5">
        Cet import-ci est traité 100 % localement dans ton navigateur : le bulletin que tu déposes ci-dessous ne quitte jamais ton appareil. (L'import
        assisté par IA, lui, envoie le document à un serveur — il te le dit explicitement et te demande ton accord avant chaque envoi.) Rappel :{" "}
        {RAPPEL_AEM_FAIT_FOI} Cet import sert uniquement à ton suivi personnel.
      </p>

      {!extrait && (
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

      {extrait && (
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm font-medium text-ink mb-2">Revue avant enregistrement</p>
            {extrait.avertissements.length > 0 && (
              <ul className="text-xs text-amber space-y-1 mb-3">
                {extrait.avertissements.map((a, i) => (
                  <li key={i}>⚠ {a}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(extrait.confiance).map(([champ, niveau]) => (
                <span key={champ} className={`text-xs px-2 py-1 rounded-full bg-surface-2 ${COULEUR_CONFIANCE[niveau]}`}>
                  {champ} · {LABEL_CONFIANCE[niveau]}
                </span>
              ))}
            </div>
            <details className="text-xs text-faint">
              <summary className="cursor-pointer">Voir le texte brut extrait</summary>
              <pre className="whitespace-pre-wrap mt-2 max-h-40 overflow-y-auto">{extrait.texteBrut}</pre>
            </details>
          </div>

          <ContractForm profil={profil} config={config} decompteActuel={decompteActuel} valeurInitiale={extrait.champs} onValider={validerImport} onAnnuler={() => setExtrait(null)} />
        </div>
      )}
    </div>
  );
}
