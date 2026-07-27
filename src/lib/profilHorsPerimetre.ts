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
 * Pourquoi un profil sort (ou non) du périmètre Annexe 10 pur. Motif explicite plutôt qu'un
 * booléen : le bandeau doit pouvoir expliquer la cause, et les deux familles de cas n'ont pas le
 * même traitement (cf. `bloquant`).
 */
export type MotifPerimetre =
  | "annexe10_pur" // dans le périmètre
  | "declare_mixte" // l'utilisateur a signalé une activité hors A10
  | "declare_inconnu" // « je ne sais pas » — traité comme mixte, au moindre doute
  | "salaires_hors_a10_contradictoires"; // A10 pur déclaré MAIS salaires hors A10 renseignés

export interface StatutPerimetre {
  horsPerimetre: boolean;
  motif: MotifPerimetre;
  /**
   * `true` : plus aucun statut ni montant ne doit s'afficher (l'utilisateur a explicitement
   * déclaré un profil hors A10 — les règles de calcul ne s'appliquent pas).
   * `false` : contradiction à lever, pas une certitude. L'app reste utilisable ; seuls les chiffres
   * ARE sont marqués non fiables, le temps que l'utilisateur corrige l'une des deux saisies.
   */
  bloquant: boolean;
}

/**
 * Le profil sort-il du périmètre Annexe 10 pure (garde-fou « situation mixte », §11.A du SPEC) ?
 *
 * Deux familles de cas, volontairement distinctes :
 *
 * 1. **Déclaration explicite** (`mixte`, `inconnu`) → bloquant. « inconnu » suit exactement le même
 *    chemin que « mixte » : au moindre doute, on renvoie vers France Travail plutôt que d'afficher
 *    un chiffre faux (devoir sacré n°2).
 * 2. **Contradiction interne** : le profil se déclare A10 pur alors que `salairesHorsAnnexe10PRA`
 *    (« salaires perçus pendant la PRA hors Annexe 10 — technicien A8, régime général… ») est
 *    renseigné à une valeur > 0. Les deux saisies ne peuvent pas être vraies en même temps, mais on
 *    ne sait pas laquelle est fausse : non bloquant, on demande à l'utilisateur de trancher.
 *    Déclenchement strict sur `> 0` — ni `null`, ni `0`, ni « champ renseigné » ne suffisent, sinon
 *    un utilisateur qui saisit honnêtement 0 € serait alerté pour rien.
 *
 * Le cas 2 s'appuie sur `regimeEffectif` (et non sur `profil.regimeDeclare` seul) pour couvrir aussi
 * les profils legacy sans `regimeDeclare` : la contradiction y est tout aussi réelle, et cet
 * élargissement ne peut pas créer de faux positif (un profil déclaré mixte part par le cas 1).
 *
 * Rappel de contexte (cf. `franceTravailConfig.meta.avertissement`) : Cadence reste une estimation
 * indicative, Annexe 10 uniquement, qui ne se substitue jamais à une notification officielle de
 * France Travail.
 */
export function profilHorsPerimetre(profil: Profil): StatutPerimetre {
  const regime = regimeEffectif(profil);

  if (regime === "mixte") return { horsPerimetre: true, motif: "declare_mixte", bloquant: true };
  if (regime === "inconnu") return { horsPerimetre: true, motif: "declare_inconnu", bloquant: true };

  if ((profil.salairesHorsAnnexe10PRA ?? 0) > 0) {
    return { horsPerimetre: true, motif: "salaires_hors_a10_contradictoires", bloquant: false };
  }

  return { horsPerimetre: false, motif: "annexe10_pur", bloquant: false };
}

/** Raccourci de lisibilité pour les verrous d'écran : seul le cas bloquant masque toute l'app. */
export function perimetreBloquant(profil: Profil): boolean {
  return profilHorsPerimetre(profil).bloquant;
}
