// Le contenu lui-même n'est pas testé (c'est de l'éditorial), mais la CORRESPONDANCE entre les
// catégories du moteur et les clés d'explication l'est : le composant dérive la clé par
// `categorie.toLowerCase()`, une catégorie sans clé ferait disparaître silencieusement son ⓘ.
import { describe, it, expect } from "vitest";
import { explicationsFraisReels } from "../../content/explicationsFraisReels";
import { CATEGORIES_ORDONNEES } from "../../components/fraisReels/categorieLabels";

describe("explicationsFraisReels", () => {
  it("expose une explication pour chaque catégorie du moteur (A, B, C1-C9, D)", () => {
    const manquantes = CATEGORIES_ORDONNEES.filter((c) => !explicationsFraisReels[c.toLowerCase()]);
    expect(manquantes).toEqual([]);
  });

  it("expose le texte d'intro de l'encart repliable", () => {
    expect(explicationsFraisReels.intro?.titre).toBeTruthy();
    expect(explicationsFraisReels.intro?.texte).toBeTruthy();
  });

  it("chaque entrée a un titre et un texte non vides", () => {
    for (const [cle, e] of Object.entries(explicationsFraisReels)) {
      expect(e.titre.trim(), `titre vide pour "${cle}"`).not.toBe("");
      expect(e.texte.trim(), `texte vide pour "${cle}"`).not.toBe("");
    }
  });
});
