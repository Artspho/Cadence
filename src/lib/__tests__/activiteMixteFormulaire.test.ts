import { describe, expect, it } from "vitest";
import { champAEffacerEnModeExclusif, detecterActiviteMixteInitiale } from "../activiteMixteFormulaire";

describe("detecterActiviteMixteInitiale", () => {
  // Point A — saisie manuelle, nouveau contrat, activité simple : aucun champ initial -> décoché.
  it("décoché par défaut sur un nouveau contrat sans valeur initiale (point A)", () => {
    expect(detecterActiviteMixteInitiale(undefined, undefined)).toBe(false);
  });

  // Point C — import IA, un seul champ extrait : décoché, cohérent avec ce que dit le document.
  it("décoché quand un seul des deux champs est renseigné (point C)", () => {
    expect(detecterActiviteMixteInitiale(undefined, 6)).toBe(false);
    expect(detecterActiviteMixteInitiale(72, undefined)).toBe(false);
  });

  // Point D — import IA, deux champs réellement extraits (cas AEM légitime) : précoché.
  it("précoché quand les deux champs sont renseignés à l'ouverture, ex. extraction IA mixte (point D)", () => {
    expect(detecterActiviteMixteInitiale(14, 3)).toBe(true); // ex. réel : 14h répétition + 3 cachets représentation
  });

  // Points F/G — réédition d'un contrat existant : même détection, aucun cas spécial.
  it("réédition d'un contrat existant déjà mixte -> précoché (point F)", () => {
    expect(detecterActiviteMixteInitiale(26, 1)).toBe(true); // ex. Les Étoiles du Classique : 26h + 1 cachet, légitime
  });
  it("réédition d'un contrat existant simple -> décoché (point G)", () => {
    expect(detecterActiviteMixteInitiale(undefined, 6)).toBe(false);
  });

  // Point I — un 0 explicite reste distinct d'un champ absent : "les deux sont renseignés" doit
  // rester vrai même si l'un des deux vaut réellement 0 (ex. répétition non rémunérée en heures à
  // 0€, cachets à côté) — pas de confusion entre "non pertinent" et "vaut zéro".
  it("un 0 explicite compte comme 'renseigné', pas comme absent (point I)", () => {
    expect(detecterActiviteMixteInitiale(0, 5)).toBe(true);
    expect(detecterActiviteMixteInitiale(5, 0)).toBe(true);
  });
});

describe("champAEffacerEnModeExclusif", () => {
  // Point A — mode exclusif : remplir un champ efface l'autre.
  it("efface nbHeures quand on remplit nbCachets en mode exclusif (point A)", () => {
    expect(champAEffacerEnModeExclusif("nbCachets", "6", false)).toBe("nbHeures");
  });
  it("efface nbCachets quand on remplit nbHeures en mode exclusif (point A)", () => {
    expect(champAEffacerEnModeExclusif("nbHeures", "72", false)).toBe("nbCachets");
  });

  // Point B — mode mixte : jamais d'effacement, quel que soit ce qui est tapé, indépendamment de
  // l'ordre (cocher la case avant même d'avoir rempli un champ doit déjà tout laisser intact).
  it("n'efface jamais rien en mode mixte, même en remplissant les deux champs (point B)", () => {
    expect(champAEffacerEnModeExclusif("nbCachets", "6", true)).toBeNull();
    expect(champAEffacerEnModeExclusif("nbHeures", "72", true)).toBeNull();
  });

  it("n'efface rien quand le champ est vidé plutôt que rempli", () => {
    expect(champAEffacerEnModeExclusif("nbCachets", "", false)).toBeNull();
  });

  // Point I — un "0" explicitement tapé est une valeur non vide : le mode exclusif s'applique.
  it("un '0' explicitement tapé déclenche quand même l'effacement de l'autre champ (point I)", () => {
    expect(champAEffacerEnModeExclusif("nbCachets", "0", false)).toBe("nbHeures");
  });
});
