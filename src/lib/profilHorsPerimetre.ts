import type { Profil } from "../types";

/**
 * Régime déclaré effectif d'un profil : lit `regimeDeclare` s'il existe, sinon migre depuis
 * `activiteHorsAnnexe10` (déprécié) sans jamais changer le comportement d'un profil déjà
 * enregistré (devoir sacré n°1). Utilisé aussi bien pour l'affichage (Onboarding/Mon profil,
 * qui doivent montrer l'état réel d'un profil legacy) que pour le verrou d'écran ci-dessous.
 */
export function regimeEffectif(profil: Profil): NonNullable<Profil["regimeDeclare"]> {
  if (profil.regimeDeclare) return profil.regimeDeclare;
  return profil.activiteHorsAnnexe10 ? "mixte" : "annexe10_pur";
}

/**
 * Le profil sort-il du périmètre Annexe 10 pure (garde-fou "situation mixte", §11.A du SPEC) ?
 * "mixte" ET "inconnu" ("je ne sais pas") suivent exactement le même chemin — au moindre doute,
 * on renvoie vers France Travail plutôt que d'afficher un chiffre faux (devoir sacré n°2).
 *
 * Rappel de contexte (cf. `franceTravailConfig.meta.avertissement`) : Cadence reste une
 * estimation indicative, Annexe 10 uniquement, qui ne se substitue jamais à une notification
 * officielle de France Travail — ce garde-fou est précisément le mécanisme qui tient cette
 * promesse dès qu'un profil en sort.
 */
export function profilHorsPerimetre(profil: Profil): boolean {
  return regimeEffectif(profil) !== "annexe10_pur";
}
