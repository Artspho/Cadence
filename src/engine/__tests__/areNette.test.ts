import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAJNette } from "../areNette";
import { profil } from "./testUtils";

describe("calculerAJNette", () => {
  it("aucune cotisation sous le seuil d'exonération (< 31,96 €)", () => {
    const resultat = calculerAJNette(30, 100, profil(), franceTravailConfig);
    expect(resultat.net).toBe(30);
    expect(resultat.detailCotisations).toHaveLength(0);
  });

  it("seule la retraite complémentaire s'applique entre 31,96 € et 60 €", () => {
    const sjm = 100;
    const resultat = calculerAJNette(50, sjm, profil(), franceTravailConfig);
    const retraiteAttendue = 0.0093 * sjm;
    expect(resultat.net).toBeCloseTo(50 - retraiteAttendue, 5);
    expect(resultat.detailCotisations).toHaveLength(1);
  });

  it("retraite + CSG + CRDS s'appliquent au-delà de 60 €", () => {
    const sjm = 100;
    const resultat = calculerAJNette(100, sjm, profil({ baremeCSG: "normal" }), franceTravailConfig);
    const attendu = 100 - 0.0093 * sjm - 0.062 * sjm - 0.005 * sjm;
    expect(resultat.net).toBeCloseTo(attendu, 5);
    expect(resultat.detailCotisations).toHaveLength(3);
  });

  it("le barème CSG réduit change le montant net", () => {
    const sjm = 100;
    const normal = calculerAJNette(100, sjm, profil({ baremeCSG: "normal" }), franceTravailConfig);
    const reduit = calculerAJNette(100, sjm, profil({ baremeCSG: "reduit" }), franceTravailConfig);
    expect(reduit.net).toBeGreaterThan(normal.net);
  });

  it("le régime Alsace-Moselle retire 1,5 % supplémentaire du SJM", () => {
    const sjm = 100;
    const sansAlsace = calculerAJNette(100, sjm, profil({ alsaceMoselle: false }), franceTravailConfig);
    const avecAlsace = calculerAJNette(100, sjm, profil({ alsaceMoselle: true }), franceTravailConfig);
    expect(sansAlsace.net - avecAlsace.net).toBeCloseTo(0.015 * sjm, 5);
  });
});
