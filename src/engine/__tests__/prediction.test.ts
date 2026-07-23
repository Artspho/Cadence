import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerStatutPrediction } from "../prediction";
import { contrat, profil } from "./testUtils";

describe("calculerStatutPrediction", () => {
  it("statut sécurité quand le seuil est déjà atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(resultat.niveau).toBe("securite");
    expect(resultat.heuresRestantes).toBe(0);
  });

  it("statut bloqué quand l'échéance est dépassée sans les heures requises", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 5 })]; // 60 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2027-01-15");
    expect(resultat.niveau).toBe("bloque");
  });

  it("un profil neuf sans date anniversaire connue (0 heure) n'affiche jamais le statut bloqué", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.heuresActuelles).toBe(0);
    expect(resultat.niveau).not.toBe("bloque");
    expect(resultat.niveau).toBe("alerte");
    expect(resultat.message).not.toMatch(/échéance/i);
  });

  it("profil sans date anniversaire connue (mois restants à zéro) : rythmeRequis signale anniversaire_inconnu, jamais Infinity", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.rythmeRequis).toEqual({ atteignable: false, raison: "anniversaire_inconnu" });
    expect(JSON.stringify(resultat)).not.toMatch(/Infinity/);
  });

  it("anniversaire connu et déjà dépassé sans les heures requises : rythmeRequis signale delai_expire, jamais Infinity", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 5 })]; // 60 h, largement sous le seuil
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2027-01-15"); // après l'anniversaire
    expect(resultat.niveau).toBe("bloque");
    expect(resultat.rythmeRequis).toEqual({ atteignable: false, raison: "delai_expire" });
    expect(JSON.stringify(resultat)).not.toMatch(/Infinity/);
  });

  it("anniversaireConnu vaut false quand la date anniversaire est inconnue (fenêtre fictive 'aujourd'hui', pas une vraie échéance)", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.anniversaireConnu).toBe(false);
  });

  it("réadmission avec historique de contrats trop court : retombe sur le seuil standard 507 h, jamais le plafond de sécurité gonflé (bug réel signalé par un testeur)", () => {
    // Scénario exact rapporté : réadmission, anniversaire 17/01/2027, un seul contrat ancien
    // (27/01/2026, 480 h) — rien avant, donc l'algorithme d'extension de periodeReference.ts
    // épuise ses 24 tentatives sans jamais trouver assez d'heures. Avant ce correctif, l'app
    // affichait "480 / 1515 h" — 1515 étant le plafond de sécurité (507 + 24×42), pas un vrai seuil.
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    const contrats = [contrat({ date: "2026-01-27", nbCachets: 40 })]; // 480 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-23");

    expect(resultat.heuresActuelles).toBe(480);
    expect(resultat.seuilHeures).toBe(507); // jamais 1515
    expect(resultat.seuilReadmission).toEqual({ calculable: false, raison: "historique_insuffisant", tranchesTentees: 24 });
  });

  it("ne mute jamais les tableaux de contrats/périodes fournis (utilisable en simulation sans effet de bord)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 20 })];
    const copie = [...contrats];
    calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(contrats).toEqual(copie);
    expect(contrats).toHaveLength(1);
  });

  it("un contrat hypothétique ajouté pour la simulation change le résultat sans toucher le tableau d'origine", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 10 })];
    const avant = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");

    const contratsSimules = [...contrats, contrat({ date: "2026-06-01", nbCachets: 40 })];
    const apres = calculerStatutPrediction(p, contratsSimules, [], franceTravailConfig, "2026-06-01");

    expect(apres.heuresActuelles).toBeGreaterThan(avant.heuresActuelles);
    expect(contrats).toHaveLength(1); // le tableau d'origine n'a pas été modifié
  });
});
