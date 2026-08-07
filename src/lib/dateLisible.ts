/**
 * dateLisible — met une date ISO en français lisible : "2026-08-03" → "03/08/2026".
 *
 * Pourquoi ce fichier existe : plusieurs dates de la config réglementaire sont affichées à
 * l'utilisateur (bandeau « Règles vérifiées le… » de TopBar.tsx et MonProfil.tsx). Elles étaient
 * montrées en format machine (`2026-06-01`), ce qui n'est pas une information mais un identifiant.
 *
 * Format numérique JJ/MM/AAAA choisi le 07/08/2026 (demande de Benoît, uniformisation de toutes les
 * dates affichées) : remplace le format long ("3 août 2026") qui avait cours ici jusque-là, et
 * converge avec `lib/exportPdfFraisReels.ts` (`formatDateFr`, déjà dans ce format) et les anciens
 * `formatDateCourte` de `components/ProjectionChart.tsx` / `engine/prediction.ts` (supprimés au
 * profit de cette fonction).
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
 * "2026-08-03" → "03/08/2026".
 *
 * Une entrée illisible est renvoyée TELLE QUELLE, jamais remplacée par "Invalid Date" ni par une
 * date inventée : mieux vaut afficher la chaîne brute, que l'utilisateur peut au moins signaler,
 * qu'un texte qui a l'air d'une date et n'en est pas (devoir sacré n°2).
 */
export function formaterDateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  const annee = d.getUTCFullYear();

  return `${jour}/${mois}/${annee}`;
}

/**
 * "2026-08-03" → "août 2026". Pour les bornes de cycle (badge du haut, TopBar.tsx) : le jour exact
 * de l'ouverture/fermeture des droits n'est pas l'information utile à ce niveau, seule la période.
 */
export function formaterMoisAnnee(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
