import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerDecompteHeures } from "../decompteHeures";
import { contrat, periode, profil } from "./testUtils";

const FENETRE = { dateDebut: "2026-01-01", dateFin: "2026-12-31" };

describe("calculerDecompteHeures", () => {
  it("600 h de cachets + 70 h d'enseignement (<50 ans) = 670 h, seuil 507 h ouvert", () => {
    const p = profil({ dateNaissance: "1990-01-01" }); // <50 ans au 2026-12-31
    const contrats = [
      contrat({ date: "2026-06-01", type: "artiste", typeRemuneration: "cachet", nbCachets: 50 }), // 50*12 = 600 h
      contrat({ date: "2026-06-15", type: "enseignement", typeRemuneration: "heures", nbHeures: 70, etablissementAgree: true, enRapportAvecMetier: true }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.total).toBe(670);
    expect(resultat.repartition.cachets).toBe(600);
    expect(resultat.repartition.enseignementRetenu).toBe(70);
    expect(resultat.repartition.enseignementExcedentaire).toBe(0);
    expect(resultat.total).toBeGreaterThanOrEqual(franceTravailConfig.seuilHeures);
  });

  it("90 h d'enseignement sont plafonnées à 70 h avant 50 ans", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.plafondEnseignementApplicable).toBe(70);
    expect(resultat.repartition.enseignementRetenu).toBe(70);
    expect(resultat.repartition.enseignementExcedentaire).toBe(20);
  });

  it("à 50 ans, le plafond d'enseignement passe à 120 h", () => {
    const p = profil({ dateNaissance: "1976-01-01" }); // 50 ans au 2026-12-31
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 110, etablissementAgree: true, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.plafondEnseignementApplicable).toBe(120);
    expect(resultat.repartition.enseignementRetenu).toBe(110);
    expect(resultat.repartition.enseignementExcedentaire).toBe(0);
  });

  it("l'enseignement sans établissement agréé ni lien avec le métier ne compte pas du tout", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 50, etablissementAgree: false, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.enseignementRetenu).toBe(0);
  });

  it("100 jours de maternité ajoutent 500 h au décompte (5 h/jour)", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })]; // 100 jours inclusifs
    const resultat = calculerDecompteHeures([], periodes, p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.assimilees).toBe(500);
  });

  it("le cumul enseignement + formation est plafonné à 338 h", () => {
    const p = profil({ dateNaissance: "1976-01-01" }); // plafond enseignement 120 h
    const contrats = [
      contrat({ date: "2026-05-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 120, etablissementAgree: true, enRapportAvecMetier: true }),
      contrat({ date: "2026-06-01", type: "formation", typeRemuneration: "heures", nbHeures: 250 }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.enseignementRetenu).toBe(120);
    expect(resultat.repartition.formationRetenue).toBe(218); // 338 - 120
    expect(resultat.repartition.formationExcedentaire).toBe(32);
  });

  it("détecte les mois où le plafond de cachets est dépassé", () => {
    const p = profil();
    const contrats = [
      contrat({ date: "2026-03-05", nbCachets: 20 }),
      contrat({ date: "2026-03-20", nbCachets: 15 }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.cachetsParMois["2026-03"]).toBe(35);
  });
});
