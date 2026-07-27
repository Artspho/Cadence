import { describe, it, expect } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { ParamsFraisKilometriques } from "../../engine/fraisReels/calculerFraisKilometriques";
import { afficherQuestionChoixPersonnel, construireFraisKmDossier, descriptifFraisKm, optionsPuissanceFiscale } from "../fraisKilometriquesUi";

const ftConfig = franceTravailConfig;

describe("optionsPuissanceFiscale", () => {
  it("retourne un tableau vide pour un cyclomoteur (pas de puissance fiscale)", () => {
    expect(optionsPuissanceFiscale("cyclomoteur", ftConfig)).toEqual([]);
  });

  it("dérive une option par ligne du barème voiture, sans en inventer", () => {
    const options = optionsPuissanceFiscale("voiture", ftConfig);
    expect(options.map((o) => o.cvMax)).toEqual(ftConfig.fraisReels.baremesKilometriques.voiture.lignes.map((l) => l.cvMax));
  });

  it("la dernière tranche est libellée '... et plus'", () => {
    const options = optionsPuissanceFiscale("voiture", ftConfig);
    expect(options[options.length - 1].libelle).toMatch(/et plus$/);
  });
});

describe("afficherQuestionChoixPersonnel", () => {
  it("ne s'affiche pas en-deçà du plafond", () => {
    expect(afficherQuestionChoixPersonnel(40, ftConfig)).toBe(false);
    expect(afficherQuestionChoixPersonnel(10, ftConfig)).toBe(false);
  });

  it("s'affiche au-delà du plafond", () => {
    expect(afficherQuestionChoixPersonnel(41, ftConfig)).toBe(true);
  });
});

describe("descriptifFraisKm", () => {
  it("inclut le véhicule, le kilométrage brut et le nombre d'A/R pour C1", () => {
    const params: ParamsFraisKilometriques = {
      vehicule: { type: "voiture", puissanceFiscale: 5 },
      trajet: { mode: "c1", distanceDomicileTravail: 22.8, nombreAR: 200 },
    };
    const resultat = { kmBruts: 9120, kmRetenus: 9120, montantDeductible: 1234.5, plafonneA40km: false };
    expect(descriptifFraisKm(params, resultat)).toBe(`Voiture 5 CV, ${(9120).toLocaleString("fr-FR")} km, 200 A/R`);
  });

  it("n'inclut pas de mention A/R pour C2", () => {
    const params: ParamsFraisKilometriques = {
      vehicule: { type: "moto", puissanceFiscale: 2 },
      trajet: { mode: "c2", kmParcourus: 3000 },
    };
    const resultat = { kmBruts: 3000, kmRetenus: 3000, montantDeductible: 900, plafonneA40km: false };
    expect(descriptifFraisKm(params, resultat)).toBe(`Moto 2 CV, ${(3000).toLocaleString("fr-FR")} km`);
  });

  it("mentionne le véhicule électrique", () => {
    const params: ParamsFraisKilometriques = {
      vehicule: { type: "voiture", puissanceFiscale: 5, motorisation: "electrique" },
      trajet: { mode: "c2", kmParcourus: 100 },
    };
    const resultat = { kmBruts: 100, kmRetenus: 100, montantDeductible: 50, plafonneA40km: false };
    expect(descriptifFraisKm(params, resultat)).toBe("Voiture 5 CV électrique, 100 km");
  });
});

describe("construireFraisKmDossier", () => {
  it("retourne undefined si aucun bloc n'est activé", () => {
    expect(construireFraisKmDossier(undefined, ftConfig)).toBeUndefined();
    expect(construireFraisKmDossier({}, ftConfig)).toBeUndefined();
  });

  it("un bloc désactivé (c2 absent) ne pollue pas le dossier", () => {
    const c1: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 10, nombreAR: 100 } };
    const dossier = construireFraisKmDossier({ c1 }, ftConfig);
    expect(dossier?.c1).toBeDefined();
    expect(dossier?.c2).toBeUndefined();
  });

  it("assemble le résultat moteur avec le descriptif pour chaque bloc actif", () => {
    const c1: ParamsFraisKilometriques = { vehicule: { type: "voiture", puissanceFiscale: 5 }, trajet: { mode: "c1", distanceDomicileTravail: 10, nombreAR: 100 } };
    const c2: ParamsFraisKilometriques = { vehicule: { type: "moto", puissanceFiscale: 2 }, trajet: { mode: "c2", kmParcourus: 500 } };
    const dossier = construireFraisKmDossier({ c1, c2 }, ftConfig);
    expect(dossier?.c1?.descriptif).toContain("Voiture 5 CV");
    expect(dossier?.c2?.descriptif).toContain("Moto 2 CV");
    expect(dossier?.c1?.montantDeductible).toBeGreaterThan(0);
    expect(dossier?.c2?.montantDeductible).toBeGreaterThan(0);
  });
});
