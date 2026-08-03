/**
 * dateLisible — met une date ISO en français lisible : "2026-08-03" → "3 août 2026".
 *
 * Pourquoi ce fichier existe : plusieurs dates de la config réglementaire sont affichées à
 * l'utilisateur (bandeau « Règles vérifiées le… » de TopBar.tsx et MonProfil.tsx). Elles étaient
 * montrées en format machine (`2026-06-01`), ce qui n'est pas une information mais un identifiant.
 *
 * ⚠️ Dette connue, volontairement non traitée ici : trois formateurs de date locaux existent déjà
 * ailleurs — `lib/exportPdfFraisReels.ts` (`formatDateFr`, numérique `03/08/2026`),
 * `components/ProjectionChart.tsx` et `engine/prediction.ts` (`formatDateCourte`, mois abrégé et
 * sans année). Aucun ne produit le format long demandé ici, donc aucun n'était réutilisable en
 * l'état. Les faire converger est un chantier à part (il touche l'export PDF et deux graphiques) :
 * il n'a pas été mené en même temps que les points 13/14 de la critique, pour ne pas mélanger un
 * correctif d'honnêteté d'affichage avec une refonte de formatage.
 *
 * Lecture en UTC (`getUTC*`) et non en heure locale : une date ISO nue comme "2026-08-03" est
 * interprétée par JS à minuit UTC, et la relire en local la décalerait d'un jour dans tout fuseau
 * négatif. Même choix que `formatDateFr`.
 */

const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/**
 * "2026-08-03" → "3 août 2026" · "2026-06-01" → "1er juin 2026".
 *
 * Une entrée illisible est renvoyée TELLE QUELLE, jamais remplacée par "Invalid Date" ni par une
 * date inventée : mieux vaut afficher la chaîne brute, que l'utilisateur peut au moins signaler,
 * qu'un texte qui a l'air d'une date et n'en est pas (devoir sacré n°2).
 */
export function formaterDateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const jour = d.getUTCDate();
  const mois = MOIS_FR[d.getUTCMonth()];
  const annee = d.getUTCFullYear();

  // « 1er » et non « 1 » : c'est la seule irrégularité de l'ordinal en français.
  return `${jour === 1 ? "1er" : jour} ${mois} ${annee}`;
}
