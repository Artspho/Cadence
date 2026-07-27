import { describe, it, expect } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { ConfigFraisReels, Depense } from "../../types/fraisReels";
import { calculerArbitrageForfaits, libelleRecommandation } from "../arbitrageForfaits";

const ftConfig = franceTravailConfig;

function config(overrides: Partial<ConfigFraisReels> = {}): ConfigFraisReels {
  return {
    anneeFiscale: 2025,
    profilFiscal: "artiste_exclusif",
    revenu: { anneeFiscale: 2025, salaireNetImposable: 10_000, allocationsAre: 0, congesSpectacles: 0, indemnitesJournalieres: 0 },
    modeA: "forfait",
    modeB: "forfait",
    ...overrides,
  };
}

let compteur = 0;
function depense(partiel: Partial<Depense> & Pick<Depense, "categorie" | "montantTotal">): Depense {
  compteur += 1;
  const montantTotal = partiel.montantTotal;
  return {
    id: `dep-${compteur}`,
    anneeFiscale: 2025,
    date: "2025-03-15",
    description: `Dépense ${compteur}`,
    remboursementEmployeur: 0,
    partPro: 1,
    montantDeductible: montantTotal,
    statutJustificatif: "fourni",
    ...partiel,
  };
}

describe("calculerArbitrageForfaits", () => {
  it("lit les forfaits depuis le moteur : R = 10 000 -> A = 14 %, B = 5 %", () => {
    const a = calculerArbitrageForfaits([], config(), ftConfig);
    expect(a.a.forfait).toBe(1_400);
    expect(a.b.forfait).toBe(500);
  });

  it("A et B s'arbitrent indépendamment : réel gagnant sur A, forfait gagnant sur B", () => {
    const depenses = [depense({ categorie: "A", montantTotal: 2_000 }), depense({ categorie: "B", montantTotal: 100 })];
    const a = calculerArbitrageForfaits(depenses, config(), ftConfig);

    expect(a.a.meilleur).toBe("reel");
    expect(a.a.ecart).toBe(600); // 2000 - 1400
    expect(a.b.meilleur).toBe("forfait");
    expect(a.b.ecart).toBe(400); // 500 - 100
  });

  it("le choix sur A ne déplace pas l'arbitrage de B (et réciproquement)", () => {
    const depenses = [depense({ categorie: "A", montantTotal: 2_000 }), depense({ categorie: "B", montantTotal: 100 })];
    const enForfait = calculerArbitrageForfaits(depenses, config({ modeA: "forfait", modeB: "forfait" }), ftConfig);
    const enReel = calculerArbitrageForfaits(depenses, config({ modeA: "reel", modeB: "reel" }), ftConfig);

    expect(enReel.a).toEqual(enForfait.a);
    expect(enReel.b).toEqual(enForfait.b);
  });

  it("aDepensesReelles distingue une rubrique saisie d'une rubrique restée au forfait", () => {
    const a = calculerArbitrageForfaits([depense({ categorie: "A", montantTotal: 50 })], config(), ftConfig);
    expect(a.a.aDepensesReelles).toBe(true);
    expect(a.b.aDepensesReelles).toBe(false);
  });

  it("les dépenses C n'influencent aucun des deux arbitrages", () => {
    const sansC = calculerArbitrageForfaits([], config(), ftConfig);
    const avecC = calculerArbitrageForfaits([depense({ categorie: "C5", montantTotal: 3_000 })], config(), ftConfig);
    expect(avecC.a).toEqual(sansC.a);
    expect(avecC.b).toEqual(sansC.b);
  });

  it("égalité parfaite : meilleur = identique, ecart = 0", () => {
    const a = calculerArbitrageForfaits([depense({ categorie: "A", montantTotal: 1_400 })], config(), ftConfig);
    expect(a.a.meilleur).toBe("identique");
    expect(a.a.ecart).toBe(0);
  });

  it("profil enseignant pur : forfaitsDesactives, aucun forfait A/B", () => {
    const a = calculerArbitrageForfaits([], config({ profilFiscal: "enseignant_pur" }), ftConfig);
    expect(a.forfaitsDesactives).toBe(true);
    expect(a.a.forfait).toBe(0);
    expect(a.b.forfait).toBe(0);
  });
});

describe("libelleRecommandation", () => {
  it("formule la recommandation selon l'option gagnante", () => {
    expect(libelleRecommandation({ reel: 2_000, forfait: 1_400, meilleur: "reel", ecart: 600, aDepensesReelles: true })).toBe("Passe en réel (+600.00 €)");
    expect(libelleRecommandation({ reel: 100, forfait: 500, meilleur: "forfait", ecart: 400, aDepensesReelles: true })).toBe("Forfait recommandé (+400.00 €)");
    expect(libelleRecommandation({ reel: 500, forfait: 500, meilleur: "identique", ecart: 0, aDepensesReelles: true })).toBe("Forfait et réel à égalité");
  });
});
