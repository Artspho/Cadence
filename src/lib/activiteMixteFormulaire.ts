// Logique du garde-fou "Activité mixte" de ContractForm.tsx, extraite en fonctions pures pour
// rester testable — le projet n'a pas d'infrastructure de test de composants React (pas de
// @testing-library/react, environnement vitest "node") : toute la logique métier vit donc ici,
// ContractForm.tsx ne fait plus qu'appeler ces fonctions depuis son état local.
//
// Contexte (bug réel du 01/08/2026) : deux contrats avaient un `nbHeures` résiduel exactement égal
// à `nbCachets × 12` — pas une vraie activité indépendante, mais une valeur restée d'une saisie
// antérieure, comptée en double par le moteur une fois les deux champs toujours visibles
// simultanément (cf. engine/decompteHeures.ts, heuresCombinees). Le mode exclusif (case décochée)
// est le comportement PAR DÉFAUT : remplir un champ efface toujours l'autre, sauf si l'utilisateur
// déclare explicitement une vraie activité mixte.

/**
 * Précoche-t-on "Activité mixte" à l'ouverture du formulaire ? Seulement si les DEUX champs sont
 * déjà renseignés — contrat existant réellement mixte (ex. AEM heures de répétition + cachets de
 * représentation), ou extraction IA qui a lu les deux indépendamment (même détection que
 * `routageExtraction.ts`, `fusionnerContratsDupliques`). Jamais par défaut : le mode exclusif reste
 * le comportement protecteur tant que rien ne confirme une vraie coexistence.
 */
export function detecterActiviteMixteInitiale(nbHeuresInitial: number | undefined, nbCachetsInitial: number | undefined): boolean {
  return nbHeuresInitial !== undefined && nbCachetsInitial !== undefined;
}

/**
 * En mode exclusif (`mixte === false`), remplir un champ avec une valeur non vide efface TOUJOURS
 * l'autre — empêche qu'un résidu de saisie précédente (ex. un ancien nombre de cachets) survive
 * silencieusement à côté d'une nouvelle valeur tapée dans l'autre champ. Retourne le nom du champ à
 * vider, ou `null` si rien à effacer (mode mixte, ou champ vidé plutôt que rempli).
 */
export function champAEffacerEnModeExclusif(champModifie: "nbCachets" | "nbHeures", nouvelleValeur: string, mixte: boolean): "nbCachets" | "nbHeures" | null {
  if (mixte) return null;
  if (nouvelleValeur.trim() === "") return null;
  return champModifie === "nbCachets" ? "nbHeures" : "nbCachets";
}
