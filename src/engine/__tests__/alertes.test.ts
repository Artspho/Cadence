import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { detecterAlertes } from "../alertes";
import { contrat, profil } from "./testUtils";

function codes(alertes: ReturnType<typeof detecterAlertes>) {
  return alertes.map((a) => a.code);
}

describe("detecterAlertes", () => {
  it("signale le dépassement du plafond d'enseignement", () => {
    const p = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-15");
    expect(codes(alertes)).toContain("plafond_enseignement");
  });

  it("signale le dépassement du plafond de cachets mensuel", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-03-05", nbCachets: 20 }), contrat({ date: "2026-03-20", nbCachets: 15 })];
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).toContain("plafond_cachets_mois");
  });

  it("signale un rythme insuffisant pour renouveler les droits", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-01-15", nbCachets: 5 })]; // 60 h, très en dessous du rythme requis
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-04-01");
    expect(codes(alertes)).toContain("rythme_insuffisant");
  });

  it("signale l'échéance imminente et l'éligibilité à la clause de rattrapage entre 338 et 506 h", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-01-10", nbCachets: 30 })]; // 360 h : dans la fourchette 338-506
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-12-15"); // 16 jours avant l'échéance
    expect(codes(alertes)).toContain("anniversaire_imminent");
    expect(codes(alertes)).toContain("eligible_rattrapage");
  });

  it("profil neuf sans date anniversaire connue : aucune alerte de rythme (rien n'est imminent), et jamais de fuite Infinity", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).not.toContain("rythme_insuffisant");
    expect(codes(alertes)).not.toContain("anniversaire_imminent");
    expect(JSON.stringify(alertes)).not.toMatch(/Infinity/);
  });

  it("ne signale rien quand l'objectif est confortablement atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).not.toContain("rythme_insuffisant");
    expect(codes(alertes)).not.toContain("anniversaire_imminent");
    expect(codes(alertes)).not.toContain("plafond_enseignement");
  });

  it("garde-fou situation mixte : ne renvoie QUE l'alerte situation_mixte, même avec des données qui déclencheraient normalement d'autres alertes", () => {
    // Mêmes données que le test "plafond d'enseignement dépassé" ci-dessus,
    // qui déclenche normalement le code "plafond_enseignement".
    const pSansSignalement = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];

    const alertesSansSignalement = detecterAlertes(pSansSignalement, contrats, [], franceTravailConfig, "2026-06-15");
    expect(codes(alertesSansSignalement)).toContain("plafond_enseignement"); // confirme que ces données déclenchent bien autre chose normalement

    const pAvecSignalement = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", activiteHorsAnnexe10: true });
    const alertesAvecSignalement = detecterAlertes(pAvecSignalement, contrats, [], franceTravailConfig, "2026-06-15");

    expect(alertesAvecSignalement).toHaveLength(1);
    expect(alertesAvecSignalement[0].code).toBe("situation_mixte");
    expect(alertesAvecSignalement[0].niveau).toBe("critique");
    expect(codes(alertesAvecSignalement)).not.toContain("plafond_enseignement");
  });
});
