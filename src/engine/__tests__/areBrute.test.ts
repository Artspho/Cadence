import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAJBrute, calculerAJBrutePourFenetre } from "../areBrute";
import { calculerDecompteHeures } from "../decompteHeures";
import { calculerFenetreReference } from "../periodeReference";
import { contrat, profil } from "./testUtils";

describe("calculerAJBrute", () => {
  it("calcule A + B + C au-delà des deux seuils, sans clamp", () => {
    const resultat = calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: franceTravailConfig });
    expect(resultat.brutAvantClamp).toBeCloseTo(68.78, 1);
    expect(resultat.brut).toBeCloseTo(68.78, 1);
    expect(resultat.plancherApplique).toBe(false);
    expect(resultat.plafondApplique).toBe(false);
  });

  it("applique le plancher de 44 € quand SR et NHT sont nuls (part C seule)", () => {
    const resultat = calculerAJBrute({ salaireRetenu: 0, nht: 0, config: franceTravailConfig });
    expect(resultat.c).toBeCloseTo(22.372, 3);
    expect(resultat.brutAvantClamp).toBeLessThan(44);
    expect(resultat.brut).toBe(44);
    expect(resultat.plancherApplique).toBe(true);
  });

  it("applique le plafond de 174,80 € pour de très hauts salaires/heures", () => {
    const resultat = calculerAJBrute({ salaireRetenu: 1_000_000, nht: 100_000, config: franceTravailConfig });
    expect(resultat.brutAvantClamp).toBeGreaterThan(174.8);
    expect(resultat.brut).toBe(174.8);
    expect(resultat.plafondApplique).toBe(true);
  });

  it("période allongée (réadmission) : diviseurs A = NH×SMIC et B = NH", () => {
    const resultat = calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: franceTravailConfig, readmissionAllongee: true, nh: 600, smicHoraireBrut: 11.88 });
    // diviseur A = 600 * 11.88 = 7128 (au lieu de 5000) -> A doit être plus petit qu'en mode standard
    const standard = calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: franceTravailConfig });
    expect(resultat.a).toBeLessThan(standard.a);
    expect(resultat.b).toBeLessThan(standard.b); // diviseur B = 600 au lieu de 507
  });

  it("réclame le SMIC horaire en période allongée plutôt que de l'approximer", () => {
    expect(() => calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: franceTravailConfig, readmissionAllongee: true, nh: 600, smicHoraireBrut: null })).toThrow();
  });
});

describe("calculerAJBrutePourFenetre", () => {
  // Fenêtre réadmission construite pour s'étendre réellement : 300 h dans la
  // fenêtre de base (insuffisant), + 360 h supplémentaires qui n'apparaissent
  // qu'une fois la fenêtre étendue de deux tranches de 30 j (cf. periodeReference.test.ts
  // pour le mécanisme de tranches).
  function construireFenetreReadmissionEtendue() {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    const contrats = [
      contrat({ date: "2026-06-01", nbCachets: 25 }), // 300 h, dans la fenêtre de base
      contrat({ date: "2025-11-15", nbCachets: 30 }), // 360 h, compté seulement une fois étendue
    ];
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    const decompte = calculerDecompteHeures(contrats, [], p, franceTravailConfig, fenetre);
    return { fenetre, decompte };
  }

  it("confirme le scénario : fenêtre réellement étendue et NH > 507 h", () => {
    const { fenetre, decompte } = construireFenetreReadmissionEtendue();
    expect(fenetre.tranchesReadmission).toBeGreaterThan(0);
    expect(decompte.total).toBeGreaterThan(franceTravailConfig.seuilHeures);
  });

  it("sans SMIC renseigné, se rabat sur le calcul standard sans planter", () => {
    // Construit sa propre config avec smicHoraireBrut: null plutôt que de s'appuyer sur l'état
    // réel de franceTravailConfig : ce test vérifie un comportement de repli qui doit rester vrai
    // quel que soit le SMIC en config réelle, y compris après une future revalorisation (le jour
    // où franceTravailConfig aura de nouveau un SMIC à jour, ce test doit continuer de passer).
    const { fenetre, decompte } = construireFenetreReadmissionEtendue();
    const configSansSmic = { ...franceTravailConfig, valeursDatees: { ...franceTravailConfig.valeursDatees, smicHoraireBrut: null } };

    const resultat = calculerAJBrutePourFenetre(fenetre, decompte.total, 20000, 1000, configSansSmic);
    const standard = calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: configSansSmic });
    expect(resultat).toEqual(standard);
  });

  it("dès que le SMIC est renseigné, applique la formule allongée et produit un résultat différent du standard", () => {
    const { fenetre, decompte } = construireFenetreReadmissionEtendue();
    const configAvecSmic = { ...franceTravailConfig, valeursDatees: { ...franceTravailConfig.valeursDatees, smicHoraireBrut: 11.88 } };

    const resultat = calculerAJBrutePourFenetre(fenetre, decompte.total, 20000, 1000, configAvecSmic);
    const allongeeAttendue = calculerAJBrute({
      salaireRetenu: 20000,
      nht: 1000,
      config: configAvecSmic,
      readmissionAllongee: true,
      nh: decompte.total,
      smicHoraireBrut: 11.88,
    });
    const standard = calculerAJBrute({ salaireRetenu: 20000, nht: 1000, config: franceTravailConfig });

    expect(resultat).toEqual(allongeeAttendue);
    expect(resultat.brut).not.toBe(standard.brut);
  });
});
