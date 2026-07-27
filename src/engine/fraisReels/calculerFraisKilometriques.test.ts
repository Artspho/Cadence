import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFraisKilometriques, type ParamsFraisKilometriques } from "./calculerFraisKilometriques";

describe("calculerFraisKilometriques — barème (Q2)", () => {
  it("1. voiture 5CV thermique, 4000 km (C2) : 4000 × 0.636 = 2544,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c2", kmParcourus: 4000 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(2544);
    expect(r.kmBruts).toBe(4000);
    expect(r.kmRetenus).toBe(4000);
    expect(r.plafonneA40km).toBe(false);
  });

  // NB : l'énoncé donnait 4649,04 € pour ce cas — vérification arithmétique : 9120 × 0.357 + 1395
  // = 3255,84 + 1395 = 4650,84 €, pas 4649,04 € (écart de 1,80 €). Les coefficients 0.357/1395
  // (5 CV, tranche 5001-20000 km) sont confirmés indépendamment par le cas 7 ci-dessous (12000 km
  // -> 5679,00 €, qui correspond exactement à l'énoncé) : la valeur ici semble une coquille de
  // l'énoncé, pas une erreur de méthode. Valeur retenue : le résultat mathématiquement exact.
  it("2. voiture 5CV thermique, 9120 km (C2), tranche 2 : (9120 × 0.357) + 1395 = 4650,84 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c2", kmParcourus: 9120 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(4650.84);
  });

  it("3. voiture ≥7CV thermique, 25000 km (C2), tranche 3 : 25000 × 0.470 = 11 750,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 7 }, trajet: { mode: "c2", kmParcourus: 25000 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(11_750);
  });

  it("4. voiture 5CV électrique, 4000 km (C2) : résultat thermique × 1.20 = 3052,80 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", motorisation: "electrique", puissanceFiscale: 5 }, trajet: { mode: "c2", kmParcourus: 4000 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(3052.8);
  });

  it("5. moto 3CV, 4000 km (C2) : (4000 × 0.082) + 1158 = 1486,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "moto", puissanceFiscale: 3 }, trajet: { mode: "c2", kmParcourus: 4000 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(1486);
  });

  it("6. cyclomoteur, 2000 km (C2) : 2000 × 0.315 = 630,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "cyclomoteur" }, trajet: { mode: "c2", kmParcourus: 2000 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.montantDeductible).toBe(630);
  });
});

describe("calculerFraisKilometriques — plafond domicile-travail 40 km (Q3, mode C1)", () => {
  it("7. distance 30 km ≤ 40 km : pas de plafond, kmBruts = 12000, tranche 2 : (12000 × 0.357) + 1395 = 5679,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 30, nombreAR: 200 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.kmBruts).toBe(12_000);
    expect(r.kmRetenus).toBe(12_000);
    expect(r.plafonneA40km).toBe(false);
    expect(r.montantDeductible).toBe(5679);
    expect(r.avertissement).toBeUndefined();
  });

  it("8. distance 60 km, choixPersonnel: false : éloignement justifié, pas de plafond, tranche 3 : 24000 × 0.427 = 10 248,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 60, nombreAR: 200, choixPersonnel: false } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.kmBruts).toBe(24_000);
    expect(r.kmRetenus).toBe(24_000);
    expect(r.plafonneA40km).toBe(false);
    expect(r.montantDeductible).toBe(10_248);
    expect(r.avertissement).toBe("distance_superieure_40km_non_plafonnee");
  });

  it("9. distance 60 km, choixPersonnel: true : plafonné à 40 km, kmRetenus = 16000, (16000 × 0.357) + 1395 = 7107,00 €", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 60, nombreAR: 200, choixPersonnel: true } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.kmBruts).toBe(24_000);
    expect(r.kmRetenus).toBe(16_000);
    expect(r.plafonneA40km).toBe(true);
    expect(r.montantDeductible).toBe(7107);
    expect(r.avertissement).toBeUndefined();
  });

  it("10. distance 60 km, choixPersonnel: null : traitement conservateur, même résultat que choixPersonnel true + avertissement", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 60, nombreAR: 200, choixPersonnel: null } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.kmRetenus).toBe(16_000);
    expect(r.plafonneA40km).toBe(true);
    expect(r.montantDeductible).toBe(7107);
    expect(r.avertissement).toBe("choix_personnel_non_renseigne");
  });

  it("choixPersonnel non renseigné (undefined) : même traitement conservateur que null", () => {
    const p: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 60, nombreAR: 200 } };
    const r = calculerFraisKilometriques(p, franceTravailConfig);
    expect(r.plafonneA40km).toBe(true);
    expect(r.avertissement).toBe("choix_personnel_non_renseigne");
  });
});
