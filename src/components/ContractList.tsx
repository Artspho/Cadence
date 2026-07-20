import type { Contrat } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { heuresBrutesContrat } from "../engine/decompteHeures";

interface ContractListProps {
  contrats: Contrat[];
  config: FranceTravailConfig;
  onSupprimer: (id: string) => void;
}

const COULEURS_TYPE: Record<Contrat["type"], string> = {
  artiste: "bg-mint/15 text-mint",
  enseignement: "bg-violet/15 text-violet",
  formation: "bg-violet/15 text-violet",
  ptp: "bg-teal/15 text-teal",
};

const LABELS_TYPE: Record<Contrat["type"], string> = {
  artiste: "Artiste",
  enseignement: "Enseignement",
  formation: "Formation",
  ptp: "PTP",
};

export function ContractList({ contrats, config, onSupprimer }: ContractListProps) {
  const tries = [...contrats].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (tries.length === 0) {
    return <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">Aucun contrat enregistré pour l'instant.</p>;
  }

  return (
    <div className="bg-surface border border-line rounded-card divide-y divide-line overflow-hidden">
      {tries.map((contrat) => {
        const { heures } = heuresBrutesContrat(contrat, config);
        return (
          <div key={contrat.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COULEURS_TYPE[contrat.type]}`}>{LABELS_TYPE[contrat.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink truncate">{contrat.employeur || "Sans nom"}</p>
              <p className="text-xs text-muted">{contrat.date}{contrat.source === "import_pdf" ? " · importé PDF" : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm tabular-nums text-ink">{heures.toFixed(1)} h</p>
              <p className="text-xs text-muted tabular-nums">{contrat.salaireBrut.toFixed(0)} € brut</p>
            </div>
            <button onClick={() => onSupprimer(contrat.id)} aria-label={`Supprimer le contrat ${contrat.employeur}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
