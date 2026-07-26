// Estimation brut → net des cachets (onglet Revenus mensuels, colonne "Net contrats", version
// gratuite) — PAS une formule officielle unique, une approximation moyenne (cf.
// franceTravailConfig.ts, guso.tauxNetApproxSurBrut). Toujours affichée précédée de "≈" côté UI,
// jamais présentée comme le montant net exact viré (celui-ci varie selon convention collective et
// statut cadre/non-cadre) — seule l'analyse IA des bulletins réels (Premium) le garantit au centime.
import type { FranceTravailConfig } from "../config/franceTravailConfig";

export function calculerNetEstime(brut: number, config: FranceTravailConfig): number {
  return Math.round(brut * config.guso.tauxNetApproxSurBrut * 100) / 100;
}
