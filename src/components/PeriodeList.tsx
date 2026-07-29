import type { PeriodeAssimilee, TypePeriode } from "../types";

interface PeriodeListProps {
  periodes: PeriodeAssimilee[];
  onSupprimer: (id: string) => void;
}

const LABELS_TYPE_PERIODE: Record<TypePeriode, string> = {
  maternite: "Maternité",
  adoption: "Adoption",
  accident_travail: "Accident du travail",
  ald: "ALD",
  suspension_contrat: "Suspension de contrat",
  maladie_intercontrat: "Maladie inter-contrat",
};

export function PeriodeList({ periodes, onSupprimer }: PeriodeListProps) {
  if (periodes.length === 0) {
    return (
      <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">
        Aucune période enregistrée pour l'instant. Ajoute-en une si un arrêt de travail, une maternité ou une suspension a eu lieu pendant la période de référence.
      </p>
    );
  }

  const triees = [...periodes].sort((a, b) => (a.dateDebut < b.dateDebut ? 1 : -1));

  function supprimerAvecConfirmation(periode: PeriodeAssimilee) {
    if (window.confirm(`Supprimer la période "${LABELS_TYPE_PERIODE[periode.type]}" du ${periode.dateDebut} au ${periode.dateFin} ? Cette action ne peut pas être annulée depuis l'application (seul un import JSON de sauvegarde le permettrait).`)) {
      onSupprimer(periode.id);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-card divide-y divide-line overflow-hidden">
      {triees.map((periode) => (
        <div key={periode.id} className="flex items-center gap-3 px-5 py-3.5">
          <span className="text-xs font-medium px-2 py-1 rounded-full shrink-0 bg-violet/15 text-violet">{LABELS_TYPE_PERIODE[periode.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink truncate">
              {periode.dateDebut} → {periode.dateFin}
            </p>
          </div>
          <button onClick={() => supprimerAvecConfirmation(periode)} aria-label={`Supprimer la période ${LABELS_TYPE_PERIODE[periode.type]}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
