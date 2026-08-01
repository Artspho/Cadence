// Recherche la valeur d'AJ réelle applicable à une date donnée, dans un historique de taux
// successifs (un utilisateur peut connaître plusieurs taux sur une même période d'indemnisation,
// ex. 54,55 € jusqu'au 17/01/2026 puis 55,02 € à partir du 18/01/2026, cf. docs/reprise.md).
// Aucun fallback : `null` signifie qu'aucun taux connu ne couvre cette date, jamais une valeur
// devinée (devoir n°2).
export function getAjReelleAt(historique: { dateEffet: string; valeur: number }[] | undefined, date: string): number | null {
  if (!historique || historique.length === 0) {
    return null;
  }
  const applicables = historique.filter((h) => h.dateEffet <= date).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  return applicables.length > 0 ? applicables[0].valeur : null;
}

// Même recherche, même contrat (`null` = aucun taux connu ne couvre cette date), pour le taux de
// prélèvement à la source (`Profil.ouvertureDroits.tauxPrelevementSourceHistorique`, cf.
// types/index.ts) — la DGFIP peut le revaloriser plusieurs fois sur une même période
// d'indemnisation, pas seulement une fois par an. Fonction distincte plutôt qu'un paramètre
// générique partagé avec `getAjReelleAt` : les deux historiques ont des appelants et des cycles de
// vie indépendants, un couplage introduirait un risque de régression croisée pour zéro bénéfice réel.
export function getTauxPASAt(historique: { dateEffet: string; valeur: number }[] | undefined, date: string): number | null {
  if (!historique || historique.length === 0) {
    return null;
  }
  const applicables = historique.filter((h) => h.dateEffet <= date).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  return applicables.length > 0 ? applicables[0].valeur : null;
}
