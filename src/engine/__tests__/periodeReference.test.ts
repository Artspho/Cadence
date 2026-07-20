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

  it("réadmission : étend la fenêtre par tranches de 30 j et augmente le seuil requis quand les heures manquent", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    // Un seul petit contrat, largement insuffisant pour 507 h même en étendant un peu la fenêtre.
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 5 })]; // 60 h
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.tranchesReadmission).toBeGreaterThan(0);
    expect(fenetre.seuilHeuresAjuste).toBe(franceTravailConfig.seuilHeures + fenetre.tranchesReadmission * franceTravailConfig.readmission.affiliationMajoreeParPeriode);
  });

  it("réadmission : pas d'extension si le seuil de base est déjà atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 45 })]; // 540 h >= 507 h
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.tranchesReadmission).toBe(0);
    expect(fenetre.seuilHeuresAjuste).toBe(franceTravailConfig.seuilHeures);
  });
});
