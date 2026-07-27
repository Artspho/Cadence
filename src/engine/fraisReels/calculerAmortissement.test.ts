import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAmortissement } from "./calculerAmortissement";

const SEUIL = franceTravailConfig.fraisReels.amortissements.seuilAmortissementHT;

describe("calculerAmortissement", () => {
  it("1. achat en janvier, 1ère année : prorata 12/12 = annuité pleine", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-01-15", dureeAns: 3, anneeImposition: 2024 }, SEUIL);
    expect(r.annuiteDeductible).toBe(300);
    expect(r.annuitePleine).toBe(300);
    expect(r.estPremiereAnnee).toBe(true);
    expect(r.horsScope).toBe(false);
  });

  it("2. achat en juillet, 1ère année : prorata 6/12", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2024 }, SEUIL);
    expect(r.annuiteDeductible).toBe(150);
    expect(r.estPremiereAnnee).toBe(true);
    expect(r.estDerniereAnnee).toBe(false);
  });

  it("3. achat en juillet, année intermédiaire (2025) : annuité pleine, pas la 1ère année", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2025 }, SEUIL);
    expect(r.annuiteDeductible).toBe(300);
    expect(r.estPremiereAnnee).toBe(false);
    expect(r.estDerniereAnnee).toBe(false);
  });

  it("4. achat en juillet, dernière année (2026) : solde = prixHT - cumul des deux premières annuités (150 + 300)", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2026 }, SEUIL);
    expect(r.annuiteDeductible).toBe(450); // 900 - (150 + 300), pas 300 (annuitePleine) — le déficit du prorata initial se reporte ici
    expect(r.estDerniereAnnee).toBe(true);
    expect(r.resteAAmortir).toBe(0);
  });

  it("5. année d'imposition après anneeFin : horsScope, aucune déduction", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2027 }, SEUIL);
    expect(r.horsScope).toBe(true);
    expect(r.annuiteDeductible).toBe(0);
    expect(r.resteAAmortir).toBe(0);
  });

  it("6. année d'imposition avant anneeDebut : horsScope", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2023 }, SEUIL);
    expect(r.horsScope).toBe(true);
    expect(r.annuiteDeductible).toBe(0);
  });

  it("7. tauxPro 0.7 sur une année intermédiaire : annuiteDeductible = annuitePleine × 0.7", () => {
    const r = calculerAmortissement({ prixHT: 900, dateAchat: "2024-07-01", dureeAns: 3, anneeImposition: 2025, tauxPro: 0.7 }, SEUIL);
    expect(r.annuiteDeductible).toBe(210); // 300 × 0.7
  });

  it("8. somme de toutes les annuités sur la durée complète (achat en janvier, montant non multiple exact de la durée) = prixHT exactement", () => {
    const params = { prixHT: 1000, dateAchat: "2024-01-15", dureeAns: 3 };
    const annee2024 = calculerAmortissement({ ...params, anneeImposition: 2024 }, SEUIL);
    const annee2025 = calculerAmortissement({ ...params, anneeImposition: 2025 }, SEUIL);
    const annee2026 = calculerAmortissement({ ...params, anneeImposition: 2026 }, SEUIL);

    const somme = annee2024.annuiteDeductible + annee2025.annuiteDeductible + annee2026.annuiteDeductible;
    expect(somme).toBe(1000);
    expect(annee2026.estDerniereAnnee).toBe(true);
    expect(annee2026.resteAAmortir).toBe(0);
  });

  it("prixHT ≤ seuil (500 €) : lève une erreur explicite, ce cas est géré ailleurs", () => {
    expect(() => calculerAmortissement({ prixHT: 500, dateAchat: "2024-01-15", dureeAns: 3, anneeImposition: 2024 }, SEUIL)).toThrow();
    expect(() => calculerAmortissement({ prixHT: 300, dateAchat: "2024-01-15", dureeAns: 3, anneeImposition: 2024 }, SEUIL)).toThrow();
  });
});
