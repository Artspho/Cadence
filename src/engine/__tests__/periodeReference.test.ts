import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFenetreReference } from "../periodeReference";
import { diffJours } from "../dateUtils";
import { contrat, periode, profil } from "./testUtils";

describe("calculerFenetreReference", () => {
  it("fenêtre de base : 365 j se terminant à la date anniversaire", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const fenetre = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(fenetre.dateFin).toBe("2026-12-31");
    expect(diffJours(fenetre.dateDebut, fenetre.dateFin)).toBe(364); // 365 jours inclusifs
    expect(fenetre.joursAllongementMaladie).toBe(0);
  });

  it("une maladie inter-contrat allonge la fenêtre d'autant de jours", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const periodes = [periode({ type: "maladie_intercontrat", dateDebut: "2025-01-01", dateFin: "2025-01-30" })]; // 30 jours
    const fenetre = calculerFenetreReference(p, [], periodes, franceTravailConfig, "2026-06-01");
    expect(fenetre.joursAllongementMaladie).toBe(30);

    const sansMaladie = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(diffJours(fenetre.dateDebut, sansMaladie.dateDebut)).toBe(30);
  });

  it("première admission sans date anniversaire connue : fenêtre glissante se terminant aujourd'hui", () => {
    const p = profil({ dateAnniversaire: "" });
    const fenetre = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(fenetre.dateFin).toBe("2026-06-01");
  });

  it("réadmission : étend réellement la fenêtre et augmente le seuil requis quand des heures existent plus loin dans le passé", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    // 300 h dans la fenêtre de base (insuffisant) + 360 h qui n'apparaissent qu'une fois la
    // fenêtre étendue de 2 tranches — reprend le scénario de calculerAJBrutePourFenetre
    // (areBrute.test.ts), qui réussit légitimement à la 3e tentative (tranches = 2), très loin
    // du plafond de 24 : garde-fou de non-régression pour un vrai succès d'extension.
    const contrats = [
      contrat({ date: "2026-06-01", nbCachets: 25 }), // 300 h, dans la fenêtre de base
      contrat({ date: "2025-11-15", nbCachets: 30 }), // 360 h, compté seulement une fois étendue
    ];
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 2, seuilHeuresAjuste: 591 });
  });

  it("réadmission : pas d'extension si le seuil de base est déjà atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 45 })]; // 540 h >= 507 h
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: franceTravailConfig.seuilHeures });
  });

  it("réadmission : seuil non calculable quand l'historique de contrats est trop court pour jamais rattraper le seuil qui grimpe (bug réel signalé par un testeur)", () => {
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    // Un seul contrat récent, rien avant : reculer la fenêtre n'ajoute jamais d'heure
    // supplémentaire, alors que le seuil exigé grimpe de 42 h à chaque tranche — l'algorithme
    // épuise ses 24 tentatives sans jamais pouvoir réussir. AVANT ce correctif, ce même scénario
    // (au format réduit ci-dessus) passait le test précédent sans que personne ne remarque qu'il
    // s'agissait déjà du cas d'échec, pas d'un vrai succès (cf. docs/validation.md, dette tracée).
    const contrats = [contrat({ date: "2026-01-27", typeRemuneration: "heures", nbHeures: 50 })];
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-07-23");
    expect(fenetre.seuilReadmission).toEqual({ calculable: false, raison: "historique_insuffisant", tranchesTentees: 24 });
    // Repli sur la fenêtre de base non étendue, pas la fenêtre poussée à 24 tranches sans validation.
    const fenetreNonReadmission = calculerFenetreReference({ ...p, situation: "premiere_admission" }, contrats, [], franceTravailConfig, "2026-07-23");
    expect(fenetre.dateDebut).toBe(fenetreNonReadmission.dateDebut);
  });
});
