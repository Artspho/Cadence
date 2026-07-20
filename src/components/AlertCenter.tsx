import type { Alerte, NiveauAlerte } from "../types";

interface AlertCenterProps {
  alertes: Alerte[];
}

const STYLES_NIVEAU: Record<NiveauAlerte, { badge: string; icone: string }> = {
  info: { badge: "border-teal/30 bg-teal/5", icone: "ℹ" },
  attention: { badge: "border-amber/30 bg-amber/5", icone: "▲" },
  critique: { badge: "border-red/30 bg-red/5", icone: "●" },
};

const COULEUR_ICONE: Record<NiveauAlerte, string> = {
  info: "text-teal",
  attention: "text-amber",
  critique: "text-red",
};

export function AlertCenter({ alertes }: AlertCenterProps) {
  if (alertes.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-card px-5 py-4 flex items-center gap-2 text-sm text-muted">
        <span className="text-mint">✓</span> Aucune alerte pour l'instant.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alertes.map((alerte, i) => {
        const style = STYLES_NIVEAU[alerte.niveau];
        return (
          <div key={i} className={`border rounded-card px-5 py-4 ${style.badge}`}>
            <div className="flex items-start gap-3">
              <span className={`text-sm mt-0.5 ${COULEUR_ICONE[alerte.niveau]}`} aria-hidden>
                {style.icone}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{alerte.titre}</p>
                <p className="text-sm text-muted mt-0.5">{alerte.message}</p>
                {alerte.actionSuggeree && <p className="text-xs text-faint mt-1.5">→ {alerte.actionSuggeree}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
