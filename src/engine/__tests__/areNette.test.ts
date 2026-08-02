import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAJBrute } from "../areBrute";
import { calculerAJNette, calculerSJM } from "../areNette";
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

  it("retraite + CSG + CRDS s'appliquent au-delà de 60 €, assiette = 98,25 % de l'allocation APRÈS retraite (pas le SJM)", () => {
    const sjm = 100;
    const resultat = calculerAJNette(100, sjm, profil({ baremeCSG: "normal" }), franceTravailConfig);
    const retraite = 0.0093 * sjm;
    const netApresRetraite = 100 - retraite;
    const assiette = 0.9825 * netApresRetraite;
    const attendu = netApresRetraite - 0.062 * assiette - 0.005 * assiette;
    expect(resultat.net).toBeCloseTo(attendu, 5);
    expect(resultat.detailCotisations).toHaveLength(3); // retraite, CSG, CRDS séparées (pas écrêté à ce niveau)
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

  it("bande 60-62 € : allocation déjà au plancher (ou en dessous) après retraite → aucune CSG/CRDS, jamais de montant négatif", () => {
    // AJ brute 61 € : au-delà du seuil de 60 € (entre dans la branche CSG/CRDS),
    // mais après retraite complémentaire l'allocation retombe sous le plancher
    // de 62 € — sans la garde "net > plancher", l'écrêtement calculerait un
    // montant négatif et un net > brut (chiffre faux, devoir sacré n°2).
    const resultat = calculerAJNette(61, 100, profil(), franceTravailConfig);
    expect(resultat.net).toBeLessThanOrEqual(61);
    expect(resultat.detailCotisations).toHaveLength(1); // retraite seule, aucune ligne CSG/CRDS
    for (const cotisation of resultat.detailCotisations) {
      expect(cotisation.montant).toBeGreaterThanOrEqual(0);
    }
  });

  it("réclame le plancher d'écrêtement plutôt que de l'approximer", () => {
    const configSansPlancher = { ...franceTravailConfig, cotisations: { ...franceTravailConfig.cotisations, plancherEcretementJournalier: null as unknown as number } };
    expect(() => calculerAJNette(100, 100, profil(), configSansPlancher)).toThrow();
  });

  describe("chaîne complète SR/NHT réels → areBrute → areNette (cas validés dans docs/validation.md)", () => {
    it("cas #2 (SR 14 579 €, écrêté) : net = 62,00 €, CSG/CRDS écrêtées ≈ 1,68 €", () => {
      // dateEffet sans incidence sur ces deux cas (AJ brute très en-deçà du plafond, aucun clamp) —
      // renseignée parce que le paramètre est obligatoire, cf. areBrute.ts.
      const ajBrute = calculerAJBrute({ salaireRetenu: 14579, nht: 710, config: franceTravailConfig, dateEffet: "2026-01-01" });
      expect(ajBrute.brut).toBeCloseTo(65.59, 1);

      const sjm = calculerSJM(14579, 710, franceTravailConfig);
      const resultat = calculerAJNette(ajBrute.brut, sjm, profil({ alsaceMoselle: false }), franceTravailConfig);

      const retraite = resultat.detailCotisations.find((c) => c.libelle.includes("Retraite"));
      const csgCrds = resultat.detailCotisations.find((c) => c.libelle.includes("écrêtées"));

      expect(retraite?.montant).toBeCloseTo(1.91, 1);
      expect(csgCrds?.montant).toBeCloseTo(1.68, 1);
      expect(resultat.net).toBeCloseTo(62.0, 1);
    });

    it("cas #3 (SR 50 000 €, non écrêté) : net = 65,73 €, CSG/CRDS séparées ≈ 4,63 € au total", () => {
      const ajBrute = calculerAJBrute({ salaireRetenu: 50000, nht: 710, config: franceTravailConfig, dateEffet: "2026-01-01" });
      expect(ajBrute.brut).toBeCloseTo(76.91, 1);

      const sjm = calculerSJM(50000, 710, franceTravailConfig);
      const resultat = calculerAJNette(ajBrute.brut, sjm, profil({ alsaceMoselle: false }), franceTravailConfig);

      const retraite = resultat.detailCotisations.find((c) => c.libelle.includes("Retraite"));
      const csg = resultat.detailCotisations.find((c) => c.libelle.startsWith("CSG ("));
      const crds = resultat.detailCotisations.find((c) => c.libelle.startsWith("CRDS"));

      expect(retraite?.montant).toBeCloseTo(6.55, 1);
      expect((csg?.montant ?? 0) + (crds?.montant ?? 0)).toBeCloseTo(4.63, 1);
      expect(resultat.net).toBeCloseTo(65.73, 1);
    });
  });
});
