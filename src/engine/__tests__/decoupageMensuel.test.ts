import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { repartirContratParMois } from "../decoupageMensuel";
import { contrat } from "./testUtils";

describe("repartirContratParMois", () => {
  it("répartit au prorata des jours calendaires un contrat chevauchant deux mois (28 mars → 3 avril, 70 h)", () => {
    const c = contrat({ dateDebut: "2026-03-28", date: "2026-04-03", typeRemuneration: "heures", nbHeures: 70, salaireBrut: 700 });
    const resultat = repartirContratParMois(c, franceTravailConfig);

    expect(resultat).toEqual([
      { moisCle: "2026-03", heures: 40, salaireBrut: 400 }, // 4/7 × 70, arrondi
      { moisCle: "2026-04", heures: 30, salaireBrut: 300 }, // 3/7 × 70
    ]);
  });

  it("un contrat entier dans un seul mois met toutes les heures dans ce mois", () => {
    const c = contrat({ dateDebut: "2026-05-05", date: "2026-05-20", typeRemuneration: "heures", nbHeures: 50, salaireBrut: 500 });
    const resultat = repartirContratParMois(c, franceTravailConfig);
    expect(resultat).toEqual([{ moisCle: "2026-05", heures: 50, salaireBrut: 500 }]);
  });

  it("un contrat d'un seul jour met toutes les heures dans ce jour (donc ce mois)", () => {
    const c = contrat({ dateDebut: "2026-06-15", date: "2026-06-15", typeRemuneration: "heures", nbHeures: 10, salaireBrut: 100 });
    const resultat = repartirContratParMois(c, franceTravailConfig);
    expect(resultat).toEqual([{ moisCle: "2026-06", heures: 10, salaireBrut: 100 }]);
  });

  it("la somme des heures réparties égale toujours les heures totales du contrat, même sur 3 mois avec une division qui ne tombe pas rond", () => {
    const c = contrat({ dateDebut: "2026-01-30", date: "2026-03-02", typeRemuneration: "heures", nbHeures: 100, salaireBrut: 1000 });
    const resultat = repartirContratParMois(c, franceTravailConfig);
    expect(resultat.map((r) => r.moisCle)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(resultat.reduce((total, r) => total + r.heures, 0)).toBe(100);
    expect(resultat.reduce((total, r) => total + r.salaireBrut, 0)).toBeCloseTo(1000, 2);
  });

  it("réutilise heuresBrutesContrat pour les cachets (12 h/cachet), pas une logique dupliquée", () => {
    const c = contrat({ dateDebut: "2026-07-10", date: "2026-07-12", typeRemuneration: "cachet", nbCachets: 3, salaireBrut: 300 });
    const resultat = repartirContratParMois(c, franceTravailConfig);
    expect(resultat).toEqual([{ moisCle: "2026-07", heures: 36, salaireBrut: 300 }]); // 3 × 12 h
  });
});
