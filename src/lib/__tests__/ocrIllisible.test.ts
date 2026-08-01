import { describe, expect, it } from "vitest";
import { texteOcrIllisible } from "../ocrIllisible";

describe("texteOcrIllisible", () => {
  it("détecte un OCR vide (markdown vide sur toutes les pages)", () => {
    expect(texteOcrIllisible([{ markdown: "" }])).toBe(true);
    expect(texteOcrIllisible([{ markdown: "" }, { markdown: "   " }])).toBe(true);
  });

  it("ne déclenche pas sur un texte réel, même court", () => {
    expect(texteOcrIllisible([{ markdown: "Bulletin de paie — Association du Festival" }])).toBe(false);
  });

  it("cumule le texte sur plusieurs pages avant de juger", () => {
    // Chaque page prise seule est sous le seuil, mais le cumul dépasse largement.
    expect(texteOcrIllisible([{ markdown: "abc" }, { markdown: "def" }, { markdown: "ghijklmnopqrstuvwxyz" }])).toBe(false);
  });

  it("reste sous le seuil par défaut (20) tant que le cumul est trop court", () => {
    expect(texteOcrIllisible([{ markdown: "trop court" }])).toBe(true); // 10 caractères < 20
  });

  it("respecte un seuil personnalisé", () => {
    expect(texteOcrIllisible([{ markdown: "douze chars." }], 5)).toBe(false);
  });

  it("ne bloque jamais sur une forme de réponse inattendue — jamais de faux échec", () => {
    expect(texteOcrIllisible(undefined)).toBe(false);
    expect(texteOcrIllisible(null)).toBe(false);
    expect(texteOcrIllisible("pas un tableau")).toBe(false);
    expect(texteOcrIllisible([])).toBe(false);
    expect(texteOcrIllisible([{}])).toBe(true); // pages sans `markdown` du tout : traité comme vide, pas ignoré
    expect(texteOcrIllisible([{ markdown: 42 }])).toBe(true); // markdown d'un type inattendu : traité comme vide
  });
});
