import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerSalaireReference } from "../salaireReference";
import { contrat, periode, profil } from "./testUtils";

const FENETRE = { dateDebut: "2026-01-01", dateFin: "2026-12-31" };

describe("calculerSalaireReference", () => {
  it("exclut totalement l'enseignement et la formation du SR et du NHT", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contratsBase = [contrat({ date: "2026-06-01", type: "artiste", typeRemuneration: "cachet", nbCachets: 40, salaireBrut: 8000 })];
    const contratsAvecEnseignement = [
      ...contratsBase,
      contrat({ date: "2026-07-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 60, salaireBrut: 3000, etablissementAgree: true, enRapportAvecMetier: true }),
    ];

    const resultatBase = calculerSalaireReference(contratsBase, [], p, franceTravailConfig, FENETRE);
    const resultatAvecEnseignement = calculerSalaireReference(contratsAvecEnseignement, [], p, franceTravailConfig, FENETRE);

    expect(resultatAvecEnseignement.sr).toBe(resultatBase.sr);
    expect(resultatAvecEnseignement.nht).toBe(resultatBase.nht);
  });

  it("applique le SAR aménagé quand des périodes maternité/adoption/ALD sont retenues", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 40, salaireBrut: 8000 })];
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })]; // 100 jours

    const resultat = calculerSalaireReference(contrats, periodes, p, franceTravailConfig, FENETRE);
    expect(resultat.joursPeriodeAssimileesRetenues).toBe(100);
    expect(resultat.sar).not.toBeNull();
    expect(resultat.sar).toBeGreaterThan(resultat.sr); // le SAR "regonfle" le SR sur une période réduite
  });

  it("ne calcule pas de SAR sans période assimilée éligible", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 40, salaireBrut: 8000 })];
    const resultat = calculerSalaireReference(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.sar).toBeNull();
  });
});
