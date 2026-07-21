import { describe, expect, it } from "vitest";
import { dashboardEstVide } from "../dashboardVide";
import { contrat } from "../../engine/__tests__/testUtils";

describe("dashboardEstVide", () => {
  it("zéro contrat -> vide", () => {
    expect(dashboardEstVide([])).toBe(true);
  });

  it("un contrat 100 % enseignement (0 h au montant ARE) -> PAS vide, le dashboard doit vivre normalement", () => {
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 40, etablissementAgree: true, enRapportAvecMetier: true })];
    expect(dashboardEstVide(contrats)).toBe(false);
  });
});
