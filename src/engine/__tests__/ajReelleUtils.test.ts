import { describe, expect, it } from "vitest";
import { getAjReelleAt } from "../ajReelleUtils";

const HISTORIQUE_2_TAUX = [
  { dateEffet: "2025-03-24", valeur: 54.55 },
  { dateEffet: "2026-01-18", valeur: 55.02 },
];

describe("getAjReelleAt", () => {
  it("retourne la bonne valeur pour une date dans une période", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2025-06-01")).toBe(54.55);
  });

  it("retourne null pour une date antérieure à toute entrée connue", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2025-01-01")).toBeNull();
  });

  it("retourne null pour un tableau vide", () => {
    expect(getAjReelleAt([], "2026-06-01")).toBeNull();
  });

  it("retourne null pour un historique undefined", () => {
    expect(getAjReelleAt(undefined, "2026-06-01")).toBeNull();
  });

  it("bascule sur le nouveau taux au bon jour (54,55 € → 55,02 € au 18/01/2026)", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-01-17")).toBe(54.55);
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-01-18")).toBe(55.02);
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-03-01")).toBe(55.02);
  });
});
