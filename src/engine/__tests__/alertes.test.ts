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

  it("regimeDeclare 'mixte' et 'inconnu' suivent EXACTEMENT le même chemin : uniquement situation_mixte", () => {
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];

    const pMixte = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "mixte" });
    const alertesMixte = detecterAlertes(pMixte, contrats, [], franceTravailConfig, "2026-06-15");
    expect(alertesMixte).toHaveLength(1);
    expect(alertesMixte[0].code).toBe("situation_mixte");

    const pInconnu = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "inconnu" });
    const alertesInconnu = detecterAlertes(pInconnu, contrats, [], franceTravailConfig, "2026-06-15");
    expect(alertesInconnu).toEqual(alertesMixte);
  });

  it("signale seuil_readmission_non_calculable quand l'historique de contrats est trop court pour ajuster le seuil de réadmission", () => {
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    const contrats = [contrat({ date: "2026-01-27", nbCachets: 40 })]; // 480 h, rien avant
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-07-23");
    expect(codes(alertes)).toContain("seuil_readmission_non_calculable");
    const alerte = alertes.find((a) => a.code === "seuil_readmission_non_calculable")!;
    expect(alerte.niveau).toBe("attention");
    expect(alerte.actionSuggeree).toBeDefined();
  });

  it("signale seuil_readmission_non_calculable avec un message DISTINCT quand la borne réelle est atteinte sans succès (hors_bornes, pas historique_insuffisant)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission", dateAnniversairePrecedente: "2025-12-02" });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2026-06-01");
    const alerte = alertes.find((a) => a.code === "seuil_readmission_non_calculable")!;
    expect(alerte).toBeDefined();
    expect(alerte.niveau).toBe("attention");
    expect(alerte.message).toMatch(/ancienne ouverture de droits/i);
    expect(alerte.actionSuggeree).toMatch(/rattrapage/i);

    // Message bien différent du cas historique_insuffisant (pas de bound connue) : jamais le
    // même texte pour deux causes différentes (devoir n°2).
    const pSansBorne = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    const contratsSansBorne = [contrat({ date: "2026-01-27", nbCachets: 40 })];
    const alerteSansBorne = detecterAlertes(pSansBorne, contratsSansBorne, [], franceTravailConfig, "2026-07-23").find((a) => a.code === "seuil_readmission_non_calculable")!;
    expect(alerteSansBorne.message).not.toBe(alerte.message);
  });

  it("pas d'alerte seuil_readmission_non_calculable en première admission, ni en réadmission quand le seuil est calculable", () => {
    const pPremiereAdmission = profil({ dateAnniversaire: "2026-12-31", situation: "premiere_admission" });
    expect(codes(detecterAlertes(pPremiereAdmission, [], [], franceTravailConfig, "2026-06-01"))).not.toContain("seuil_readmission_non_calculable");

    const pReadmissionOk = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    const contratsSuffisants = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h, seuil de base déjà atteint
    expect(codes(detecterAlertes(pReadmissionOk, contratsSuffisants, [], franceTravailConfig, "2026-06-01"))).not.toContain("seuil_readmission_non_calculable");
  });

  it("rythme_insuffisant ne se déclenche plus si des contrats déjà signés à venir suffisent à eux seuls à atteindre le seuil", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-09-01", nbCachets: 45 })]; // 540 h, tout à venir, rythme passé nul
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).not.toContain("rythme_insuffisant");
  });

  it("anti-faux-positif : artiste-enseignant avec regimeDeclare 'annexe10_pur' explicite reste dans le périmètre (pas situation_mixte)", () => {
    const p = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "annexe10_pur" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-15");
    expect(codes(alertes)).not.toContain("situation_mixte");
    expect(codes(alertes)).toContain("plafond_enseignement");
  });

  it("pas_taux_janvier : droit du 18/01/2026 au 17/01/2027, taux PAS renseigné, janvier 2027 en cours d'indemnisation dans la série -> alerte présente", () => {
    const p = profil({
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 0, delaiAttenteInitial: 0, tauxPrelevementSource: 7.2 },
    });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2027-01-31", { dateDepart: "2026-01-01" });
    expect(codes(alertes)).toContain("pas_taux_janvier");
  });

  it("pas_taux_janvier : même droit mais tauxPrelevementSource absent -> pas d'alerte", () => {
    const p = profil({
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 0, delaiAttenteInitial: 0 },
    });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2027-01-31", { dateDepart: "2026-01-01" });
    expect(codes(alertes)).not.toContain("pas_taux_janvier");
  });

  it("pas_taux_janvier : droit du 01/01/2026 au 31/12/2026, taux renseigné, aucun janvier en cours (le seul janvier de la série est le mois d'ouverture lui-même) -> pas d'alerte", () => {
    const p = profil({
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-01", franchiseCPTotale: 0, delaiAttenteInitial: 0, tauxPrelevementSource: 7.2 },
    });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2026-12-31", { dateDepart: "2026-01-01" });
    expect(codes(alertes)).not.toContain("pas_taux_janvier");
  });
});
