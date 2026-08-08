/**
 * Barre de progression « vers une baisse du prix de l'abonnement » (08/08/2026, demande de Benoît),
 * en tête du tableau de bord. Lit `abonnesConfig.ts`, seule source du nombre actuel et du seuil —
 * jamais recalculée ni devinée ici.
 */
import { abonnesConfig } from "../config/abonnesConfig";

export function BarreProgressionAbonnes() {
  const { nombreActuel, seuilProchaineReduction } = abonnesConfig;
  const seuilAtteint = nombreActuel >= seuilProchaineReduction;
  const pourcentage = Math.min(100, (nombreActuel / seuilProchaineReduction) * 100);
  const restants = Math.max(0, seuilProchaineReduction - nombreActuel);

  return (
    <div className="bg-surface border border-line rounded-card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm font-medium text-ink">Vers une baisse du prix de l'abonnement</p>
        <span className="text-sm font-medium tabular-nums text-mint">
          {nombreActuel}/{seuilProchaineReduction} abonnés
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${pourcentage}%` }} />
      </div>
      <p className="text-xs text-faint mt-2">
        {seuilAtteint ? "Seuil atteint — la baisse de prix s'applique !" : `Encore ${restants} abonné${restants > 1 ? "s" : ""} avant la prochaine baisse de prix.`}
      </p>
    </div>
  );
}
