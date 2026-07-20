import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import type { BulletinExtrait } from "../types";
import { extraireBulletin } from "../lib/extractionBulletin";
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
      <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-4 py-2.5">
        Traitement 100 % local dans ton navigateur — aucun bulletin n'est envoyé sur un serveur. Rappel : la pièce qui fait foi auprès de France Travail est l'AEM, pas le bulletin de paie ; cet
        import sert uniquement à ton suivi personnel.
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
