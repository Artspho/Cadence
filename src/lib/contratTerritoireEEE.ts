// Règle d'intégrité : un contrat en territoire EEE / Suisse / Royaume-Uni porte des JOURS TRAVAILLÉS,
// et rien d'autre.
//
// POURQUOI. `engine/decompteHeures.ts:24-26` calcule les heures d'un contrat EEE par
// `(nbJoursEEE ?? 0) × heuresParJourEEE` et **ne regarde ni `nbCachets` ni `nbHeures`**. Deux
// conséquences, toutes deux silencieuses avant ce garde (point 17 de docs/critique_2026-08-03.md) :
//   1. un contrat EEE sans jours saisis compte ZÉRO heure. Rien dans le type (`types/index.ts` : tous
//      ces champs sont optionnels) ni dans le schéma de stockage n'impose `nbJoursEEE` quand le
//      territoire l'exige. Le contrat existe, il est visible dans la liste, et il n'apporte rien aux
//      507 h ;
//   2. un contrat EEE qui porte AUSSI des cachets ou des heures voit ces valeurs **ignorées en
//      entier**. Là, ce n'est plus un champ oublié : c'est une donnée correctement saisie que l'app
//      jette sans un mot. Cas réel et facile à produire : saisir des cachets, puis basculer le
//      territoire sur EEE.
// L'erreur va dans le sens prudent (sous-comptage), mais elle est invisible — et un décompte 507 h
// trop bas peut faire afficher « À rattraper » ou « Bloqué » à quelqu'un qui a ses heures.
//
// CE QUE CE GARDE NE FAIT PAS, et c'est délibéré : il ne change AUCUN calcul. Additionner des jours
// EEE (6 h/jour) à des cachets (12 h) serait inventer une règle du régime que rien ne source — piste
// explicitement écartée par Benoît le 04/08/2026, à ne pas re-tenter sans une pièce du guide France
// Travail. Ce fichier dit seulement ceci : l'app refuse d'ENREGISTRER une donnée qu'elle ne saurait
// pas compter. Le calcul, lui, reste identique.
//
// OÙ ELLE S'APPLIQUE. À l'ÉCRITURE, jamais à la LECTURE des contrats déjà enregistrés (devoir sacré
// n°1) — même raisonnement, mot pour mot, que `contratUnSeulMois.ts` pour le point 7 :
//   - pas dans le schéma Zod de lecture, qui rendrait illisible un fichier légitime ;
//   - pas dans `donneesAppSchemaEcriture` (localStorageAdapter.ts), qui valide le jeu de données
//     ENTIER à chaque sauvegarde : un seul contrat EEE hérité y bloquerait TOUTE sauvegarde.
// Elle vit donc sur `ajouterContrat` / `modifierContrat` / `ajouterContratsRecurrents` d'App.tsx,
// seul point de passage commun aux quatre portes d'écriture (formulaire, édition en liste, import de
// bulletin, revue d'extraction IA). Le formulaire bloque en plus à la saisie, pour expliquer avant de
// refuser — mais c'est le garde d'App.tsx qui ferme réellement la porte, sinon un contrat EEE vide
// entrerait par l'IA pendant que le formulaire refuse poliment.
//
// Vérifié le 04/08/2026 sur les 62 contrats restaurés de docs/cadence-fusion-2026-08-03.json : ils
// sont TOUS en territoire `france`, aucun ne porte `nbJoursEEE`. Cette règle ne condamne donc aucune
// donnée existante — et n'a, aujourd'hui, aucun effet sur les chiffres affichés à Benoît. C'est un
// piège fermé avant qu'il ne serve, pas un chiffre corrigé.
//
// ⚠️ NON TRAITÉ ICI, et distinct : un nombre de jours NÉGATIF (`-3`) passe ce garde et produirait des
// heures négatives. C'est une impossibilité structurelle, pas un jugement de vraisemblance — donc ce
// n'est PAS couvert par le point 10 écarté (qui ne porte que sur la justesse d'un chiffre saisi). Le
// champ du formulaire a `min="0"`, ce qui l'empêche à la saisie manuelle mais pas à l'import. À
// traiter avec les autres bornes structurelles, pas en catimini ici.
import type { Contrat } from "../types";

/** Contrat EEE sans jours travaillés : il ne compterait aucune heure. Message unique. */
export const MESSAGE_EEE_SANS_JOURS =
  "Ce contrat en territoire EEE / Suisse / Royaume-Uni ne compterait aucune heure : renseigne le nombre de jours travaillés.";

/** Contrat EEE portant en plus des cachets ou des heures, que le décompte ignore. Message unique. */
export const MESSAGE_EEE_REMUNERATION_IGNOREE =
  "En territoire EEE / Suisse / Royaume-Uni, seuls les jours travaillés sont comptés : les cachets et les heures saisis sur ce contrat seraient ignorés — retire-les, ou repasse le contrat en territoire France.";

/**
 * `true` si le contrat est en territoire EEE sans jours travaillés utilisables. Couvre l'absence du
 * champ, `null` et `0` : les trois donnent le même résultat à l'écran — un contrat qui n'apporte rien.
 */
export function contratEEESansJours(contrat: Pick<Contrat, "territoire" | "nbJoursEEE">): boolean {
  return contrat.territoire === "eee_suisse_uk" && !contrat.nbJoursEEE;
}

/** `true` si le contrat est en territoire EEE et porte des cachets ou des heures — valeurs ignorées par le décompte. */
export function contratEEEAvecRemunerationIgnoree(contrat: Pick<Contrat, "territoire" | "nbCachets" | "nbHeures">): boolean {
  return contrat.territoire === "eee_suisse_uk" && Boolean(contrat.nbCachets || contrat.nbHeures);
}

/**
 * Toutes les raisons de refuser CE contrat, dans l'ordre où elles se lisent. Un contrat peut en
 * cumuler deux (EEE, sans jours, avec des cachets) : on les renvoie toutes plutôt que la première,
 * pour ne pas refuser deux fois de suite en ne disant qu'une moitié du problème à chaque tour.
 */
export function raisonsRefusEEE(contrat: Pick<Contrat, "territoire" | "nbJoursEEE" | "nbCachets" | "nbHeures">): string[] {
  const raisons: string[] = [];
  if (contratEEESansJours(contrat)) raisons.push(MESSAGE_EEE_SANS_JOURS);
  if (contratEEEAvecRemunerationIgnoree(contrat)) raisons.push(MESSAGE_EEE_REMUNERATION_IGNOREE);
  return raisons;
}

/**
 * Verdict d'écriture pour un lot de contrats (un seul, ou toute une série récurrente). Même forme et
 * même intention que `validerContratsPourEcriture` (contratUnSeulMois.ts) : la DÉCISION vit dans une
 * fonction pure, testable sans rendre l'app, et App.tsx ne fait que la brancher à son état.
 *
 * Tout ou rien sur le lot, comme pour la règle des deux mois : accepter les contrats conformes et
 * jeter l'intrus créerait une série trouée sans le dire.
 */
export function validerContratsEEEPourEcriture(
  contrats: Pick<Contrat, "territoire" | "nbJoursEEE" | "nbCachets" | "nbHeures">[],
): { ok: true } | { ok: false; message: string } {
  const raisons = [...new Set(contrats.flatMap(raisonsRefusEEE))];
  if (raisons.length === 0) return { ok: true };
  return { ok: false, message: raisons.join(" ") };
}
