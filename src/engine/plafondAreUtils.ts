// Plafond de l'AJ brute (Annexe 10) applicable À UNE DATE DONNÉE, lu dans
// `config.are.plafondHistorique` (dateEffet + valeur, même forme que
// `valeursDatees.smicHoraireBrutHistorique`).
//
// Pourquoi une fonction séparée plutôt qu'un helper générique partagé avec `getAjReelleAt`
// (ajReelleUtils.ts) ou `valeurALaDate` (indemnisationMensuelle.ts) : même raison que celle déjà
// écrite dans ajReelleUtils.ts pour `getTauxPASAt` — ces historiques ont des appelants et des
// cycles de vie indépendants, et surtout des contrats de retour DIFFÉRENTS (voir ci-dessous).
// Les mutualiser introduirait un risque de régression croisée pour zéro bénéfice réel.
import type { FranceTravailConfig } from "../config/franceTravailConfig";

/**
 * Plafond en vigueur à `date` (ISO `YYYY-MM-DD`) : la valeur la plus récente dont la date d'effet
 * est ≤ `date`.
 *
 * Contrat de retour volontairement différent de `getAjReelleAt` / `valeurALaDate`, qui renvoient
 * `null` quand rien ne couvre la date. Ici le plafond est un CLAMP de sécurité, pas un montant
 * affiché : ni `null` ni une exception ne sont acceptables en pratique.
 *  - `null` reviendrait à ne plus clamper du tout, donc à laisser passer une AJ trop HAUTE — la
 *    direction d'erreur exactement inverse de celle que le projet accepte.
 *  - lever une exception planterait des écrans réels : `engine/cycles.ts` reconstruit jusqu'à 10
 *    cycles en arrière (Historique.tsx) et `RenouvellementAnticipe.tsx` laisse saisir n'importe
 *    quelle FCT, sans aucun error boundary React en face.
 *
 * Pour une date antérieure à toute revalorisation connue, on retombe donc sur la PLUS ANCIENNE
 * entrée de l'historique. C'est un repli explicite, pas une extrapolation : les plafonds montent
 * avec le temps, la plus ancienne valeur connue est donc la borne la plus BASSE dont on dispose —
 * elle clampe davantage, donc sous-estime plutôt qu'elle ne sur-promet. Combler le trou (cf. le
 * TODO au-dessus de `plafondHistorique`) reste la vraie correction.
 */
export function getPlafondAreAt(date: string, config: FranceTravailConfig): number {
  const historique = config.are.plafondHistorique;
  if (historique.length === 0) {
    // Garanti impossible sur la vraie config (schéma Zod `.min(1)`, validé au chargement du
    // module) : ne peut venir que d'une config fabriquée à la main, donc d'une erreur de code.
    throw new Error("config.are.plafondHistorique est vide : aucun plafond ARE connu, impossible de borner l'AJ brute.");
  }
  const applicables = historique.filter((h) => h.dateEffet <= date).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  if (applicables.length > 0) {
    return applicables[0].valeur;
  }
  return [...historique].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet))[0].valeur;
}
