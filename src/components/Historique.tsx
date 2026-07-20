import type { Exercice } from "../types";

interface HistoriqueProps {
  exercices: Exercice[];
}

export function Historique({ exercices }: HistoriqueProps) {
  if (exercices.length === 0) {
    return (
      <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">
        Pas encore d'historique — il apparaîtra une fois ta date anniversaire renseignée et un premier cycle écoulé.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {exercices.map((exercice) => (
        <div key={exercice.id} className="bg-surface border border-line rounded-card p-5 flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full shrink-0 ${exercice.objectifAtteint ? "bg-mint" : exercice.cloture ? "bg-red" : "bg-faint"}`} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink">
              {exercice.dateDebut} → {exercice.dateAnniversaire}
            </p>
            <p className="text-xs text-muted">{exercice.cloture ? "Exercice clos" : "Exercice en cours"}</p>
          </div>
          <div className="text-right">
            <p className="text-sm tabular-nums text-ink">{Math.round(exercice.heuresAtteintes)} h</p>
            <p className={`text-xs ${exercice.objectifAtteint ? "text-mint" : "text-muted"}`}>{exercice.objectifAtteint ? "Objectif atteint" : "Objectif non atteint"}</p>
          </div>
          {exercice.ajBrute !== undefined && (
            <div className="text-right border-l border-line pl-4">
              <p className="text-sm tabular-nums text-ink">{exercice.ajBrute.toFixed(2)} €</p>
              <p className="text-xs text-muted tabular-nums">≈ {exercice.ajNette?.toFixed(2)} € net /j</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
