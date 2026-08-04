// Décision de Benoît le 04/08/2026 : aucun champ numérique de saisie n'accepte un nombre négatif,
// « ça n'a pas de sens ». Ces tests portent sur le prédicat pur, appelé en garde par les treize champs
// de saisie qui écrivent À LA FRAPPE (Frais réels, Mon profil) — les seuls que `min="0"` ne protégeait
// pas, faute de `<form>` à soumettre. Cf. lib/saisieNombrePositif.ts pour la mesure à l'écran.
import { describe, expect, it } from "vitest";
import { estSaisieNegative } from "../saisieNombrePositif";

describe("estSaisieNegative — ce qui doit être refusé", () => {
  it("un entier négatif", () => {
    expect(estSaisieNegative("-3")).toBe(true);
    expect(estSaisieNegative("-5000")).toBe(true); // le cas mesuré : « Base R = -5000.00 € »
  });

  it("un décimal négatif, avec ou sans zéro devant", () => {
    expect(estSaisieNegative("-0.5")).toBe(true);
    expect(estSaisieNegative("-.5")).toBe(true);
  });

  it("un négatif minuscule : le refus ne dépend pas d'un seuil", () => {
    // Pas de tolérance : −0,01 € de salaire n'a pas plus de sens que −5 000 €.
    expect(estSaisieNegative("-0.01")).toBe(true);
  });

  it("une notation scientifique négative (collage depuis un tableur)", () => {
    expect(estSaisieNegative("-1e3")).toBe(true);
  });
});

describe("estSaisieNegative — ce qui doit passer", () => {
  it("zéro, sous ses deux écritures", () => {
    // Zéro est une valeur légitime partout (0 repas, 0 km, 0 € d'ARE) et n'est pas négatif.
    expect(estSaisieNegative("0")).toBe(false);
    expect(estSaisieNegative("-0")).toBe(false);
  });

  it("un nombre positif, entier ou décimal", () => {
    expect(estSaisieNegative("3")).toBe(false);
    expect(estSaisieNegative("4000.5")).toBe(false);
  });

  it("une chaîne vide : c'est un champ qu'on vide, pas un négatif", () => {
    // Geste légitime et fréquent (effacer pour retaper). Les appelants le traduisent déjà par 0 ;
    // bloquer ici rendrait les champs impossibles à corriger.
    expect(estSaisieNegative("")).toBe(false);
  });

  it("une saisie en cours non numérique n'est jamais prise pour un négatif", () => {
    // ⚠️ Le cas qui casserait la frappe s'il était mal traité : un <input type="number"> renvoie `""`
    // tant que la valeur n'est pas un nombre complet — taper « - » seul donne `""`, jamais `"-"`.
    // Ces valeurs ne peuvent donc pas venir d'un input number, mais le prédicat doit rester sûr si
    // un appelant lui passe autre chose.
    expect(estSaisieNegative("-")).toBe(false);
    expect(estSaisieNegative("abc")).toBe(false);
    expect(estSaisieNegative(" ")).toBe(false);
  });

});

describe("estSaisieNegative — cas limite gardé volontairement du côté du refus", () => {
  it("un infini négatif est refusé, comme n'importe quel autre négatif", () => {
    // Un <input type="number"> ne peut pas produire cette valeur, mais la première version du
    // prédicat la laissait passer (elle testait `Number.isFinite` avant le signe) : c'était la seule
    // valeur négative que le garde manquait. Test conservé pour que ce garde-fou ne reparte pas.
    expect(estSaisieNegative("-Infinity")).toBe(true);
  });
});
