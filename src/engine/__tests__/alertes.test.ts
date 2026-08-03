import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { detecterAlertes } from "../alertes";
import { contrat, profil } from "./testUtils";
import { CONTRADICTION_HORS_A10 } from "../../content/contradictionHorsA10";

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

  // Refonte des badges du 03/08/2026 (points 5 et 6 de docs/critique_2026-08-03.md) : l'échéance
  // imminente ne colore plus l'écran en rouge quand la situation reste rattrapable, mais le centre
  // d'alertes doit garder EXACTEMENT les mêmes alertes qu'avant — l'urgence était réelle, seule sa
  // traduction visuelle mentait. Ces trois tests verrouillent cette non-régression.
  describe("échéance imminente mais encore rattrapable : l'alerte critique est conservée", () => {
    it("l'alerte critique « Échéance imminente » est toujours levée alors que le badge n'est plus « Bloqué »", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 34 })]; // 408 h : il manque 99 h en 25 j
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-12-06");
      expect(codes(alertes)).toContain("anniversaire_imminent");
      expect(alertes.find((a) => a.code === "anniversaire_imminent")!.niveau).toBe("critique");
    });

    it("une seule alerte pour cette situation : pas de doublon « Rythme insuffisant » à côté de l'alerte critique", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 34 })];
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-12-06");
      expect(codes(alertes)).not.toContain("rythme_insuffisant");
    });

    it("l'action suggérée ne renvoie pas au guichet quand c'est encore atteignable : elle chiffre les cachets à trouver", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 34 })]; // 99 h manquantes = 9 cachets (12 h)
      const alerte = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-12-06").find((a) => a.code === "anniversaire_imminent")!;
      expect(alerte.actionSuggeree).toMatch(/9 cachets/);
      expect(alerte.actionSuggeree).toMatch(/encore atteignable/i);
      expect(alerte.actionSuggeree).not.toMatch(/contacte france travail/i);
    });

    it("contrôle négatif — vraiment hors de portée : l'action redevient « contacte France Travail »", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 8 })]; // 96 h : il manque 411 h en 25 j
      const alerte = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-12-06").find((a) => a.code === "anniversaire_imminent")!;
      expect(alerte.actionSuggeree).toMatch(/contacte france travail/i);
      expect(alerte.actionSuggeree).not.toMatch(/encore atteignable/i);
    });
  });

  it("profil neuf sans date anniversaire connue : aucune alerte de rythme (rien n'est imminent), et jamais de fuite Infinity", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).not.toContain("rythme_insuffisant");
    expect(codes(alertes)).not.toContain("anniversaire_imminent");
    expect(JSON.stringify(alertes)).not.toMatch(/Infinity/);
  });

  it("ne signale rien quand l'objectif est confortablement atteint (à part le réexamen anticipé, désormais possible)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h
    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(codes(alertes)).not.toContain("rythme_insuffisant");
    expect(codes(alertes)).not.toContain("anniversaire_imminent");
    expect(codes(alertes)).not.toContain("plafond_enseignement");
    expect(codes(alertes)).toContain("renouvellement_anticipe_possible");
  });

  describe("renouvellement_anticipe_possible", () => {
    it("apparaît une fois le seuil dépassé, avant la date anniversaire", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h > 507
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(codes(alertes)).toContain("renouvellement_anticipe_possible");
    });

    it("n'apparaît pas tant que le seuil n'est pas atteint", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-01-15", nbCachets: 5 })]; // 60 h, très en dessous
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-04-01");
      expect(codes(alertes)).not.toContain("renouvellement_anticipe_possible");
    });

    it("n'apparaît plus une fois la date anniversaire atteinte ou dépassée (ce n'est alors plus un réexamen ANTICIPÉ)", () => {
      const p = profil({ dateAnniversaire: "2026-06-01" });
      const contrats = [contrat({ date: "2026-01-01", nbCachets: 50 })]; // 600 h, seuil largement dépassé
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01"); // pile sur l'échéance
      expect(codes(alertes)).not.toContain("renouvellement_anticipe_possible");
    });

    it("cas limite exact : heuresActuelles === seuilHeures (507 pile) déclenche déjà l'alerte, >= inclusif", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", typeRemuneration: "heures", nbHeures: franceTravailConfig.seuilHeures })]; // exactement 507 h
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(codes(alertes)).toContain("renouvellement_anticipe_possible");
    });

    // Distinction volontaire (cf. commentaire dans engine/alertes.ts) : un contrat déjà signé mais
    // pas encore travaillé peut faire passer prediction.niveau à "securite" (via heuresAvecCertain)
    // SANS que les heures soient réellement atteintes aujourd'hui (heuresActuelles). Annoncer un
    // réexamen anticipé "possible" sur cette seule base serait prématuré : rien ne prouve encore que
    // ces heures seront effectivement travaillées avant la date de la simulation. L'alerte doit donc
    // rester silencieuse ici, contrairement à prediction.niveau qui, lui, vaut déjà "securite".
    it("n'apparaît PAS quand seuls des contrats déjà signés à venir atteindraient le seuil (heuresAvecCertain), tant que heuresActuelles n'y est pas encore", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [
        contrat({ date: "2026-02-01", typeRemuneration: "heures", nbHeures: 100 }), // déjà travaillé, avant aujourd'hui
        contrat({ date: "2026-08-01", typeRemuneration: "heures", nbHeures: 450 }), // signé, mais après aujourd'hui : 100 + 450 = 550 h sur la fenêtre entière
      ];
      const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-01"); // avant le 2e contrat
      expect(codes(alertes)).not.toContain("renouvellement_anticipe_possible");
    });
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

  it("contradiction salaires hors A10 : alerte critique en tête, MAIS pas de court-circuit (non bloquant)", () => {
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];
    const p = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 });

    const alertes = detecterAlertes(p, contrats, [], franceTravailConfig, "2026-06-15");

    expect(alertes[0].code).toBe("salaires_hors_a10_contradictoires");
    expect(alertes[0].niveau).toBe("critique");
    expect(alertes[0].actionSuggeree).toContain("Mon profil");
    // Contrairement au cas déclaré, les autres alertes restent calculées : l'app reste utilisable.
    expect(alertes.length).toBeGreaterThan(1);
    expect(codes(alertes)).toContain("plafond_enseignement");
    expect(codes(alertes)).not.toContain("situation_mixte");
  });

  // Verrou anti-divergence : le fait « contradiction » n'est plus rédigé que dans
  // content/contradictionHorsA10.ts, partagé avec AvertissementContradictionHorsA10. Ce test échoue
  // si quelqu'un réintroduit un libellé propre à l'alerte — c'est précisément ainsi que les deux
  // rendus avaient fini par décrire différemment le même masquage.
  it("l'alerte de contradiction lit ses textes à la source unique partagée avec le bandeau", () => {
    const p = profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 });
    const alerte = detecterAlertes(p, [contrat({ date: "2026-06-01", nbCachets: 10 })], [], franceTravailConfig, "2026-06-15").find(
      (a) => a.code === "salaires_hors_a10_contradictoires",
    )!;
    expect(alerte.titre).toBe(CONTRADICTION_HORS_A10.titre);
    expect(alerte.message).toBe(CONTRADICTION_HORS_A10.messageAlerte);
    expect(alerte.actionSuggeree).toBe(CONTRADICTION_HORS_A10.action);
  });

  // Le champ `salairesHorsAnnexe10PRA` a longtemps été inatteignable depuis l'UI en première
  // admission (section réservée à la réadmission, cf. MonProfil.tsx) : seule l'UI était en cause, la
  // détection n'a jamais regardé `situation`. `situation` est écrite explicitement ici pour que ce
  // soit vérifié, et non hérité du défaut de la fabrique `profil()`.
  it("contradiction signalée en première admission comme en réadmission (même alerte, même texte)", () => {
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 10 })];
    const alerteDe = (situation: "premiere_admission" | "readmission") =>
      detecterAlertes(
        profil({ situation, dateAnniversaire: "2026-12-31", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }),
        contrats,
        [],
        franceTravailConfig,
        "2026-06-15",
      );

    const premiereAdmission = alerteDe("premiere_admission");
    expect(premiereAdmission[0].code).toBe("salaires_hors_a10_contradictoires");
    expect(premiereAdmission[0].niveau).toBe("critique");

    const readmission = alerteDe("readmission");
    expect(readmission[0]).toEqual(premiereAdmission[0]);
  });

  it("anti-faux-positif : salaires hors A10 à 0 ne déclenche aucune alerte de périmètre", () => {
    const p = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 0 });
    const alertes = detecterAlertes(p, [contrat({ date: "2026-06-01", nbCachets: 20 })], [], franceTravailConfig, "2026-06-15");
    expect(codes(alertes)).not.toContain("salaires_hors_a10_contradictoires");
    expect(codes(alertes)).not.toContain("situation_mixte");
  });

  it("une déclaration « mixte » garde son court-circuit même avec des salaires hors A10 renseignés", () => {
    const p = profil({ dateNaissance: "1990-01-01", dateAnniversaire: "2026-12-31", regimeDeclare: "mixte", salairesHorsAnnexe10PRA: 8000 });
    const alertes = detecterAlertes(p, [contrat({ date: "2026-06-01", nbCachets: 20 })], [], franceTravailConfig, "2026-06-15");
    expect(alertes).toHaveLength(1);
    expect(alertes[0].code).toBe("situation_mixte");
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
    // même texte pour deux causes différentes (devoir n°2). Mis à jour le 31/07/2026 (chantier
    // calculerFenetreEnCours) : dès que dateAnniversaire est connue, la borne de réadmission du
    // cycle en cours se déduit TOUJOURS d'elle (Règle #2, toujours vraie) — "historique_insuffisant"
    // n'est donc plus atteignable que sans dateAnniversaire du tout (profil pas encore renseigné).
    const pSansAnniversaire = profil({ dateAnniversaire: "", situation: "readmission" });
    const contratsSansBorne = [contrat({ date: "2026-01-27", nbCachets: 40 })];
    const alerteSansBorne = detecterAlertes(pSansAnniversaire, contratsSansBorne, [], franceTravailConfig, "2026-07-23").find((a) => a.code === "seuil_readmission_non_calculable")!;
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
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 0, delaiAttenteInitial: 0, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-01-18", valeur: 7.2 }] },
    });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2027-01-31", { dateDepart: "2026-01-01" });
    expect(codes(alertes)).toContain("pas_taux_janvier");
  });

  it("pas_taux_janvier : même droit mais tauxPrelevementSourceHistorique absent -> pas d'alerte", () => {
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
      ouvertureDroits: { dateOuverture: "2026-01-01", franchiseCPTotale: 0, delaiAttenteInitial: 0, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-01-01", valeur: 7.2 }] },
    });
    const alertes = detecterAlertes(p, [], [], franceTravailConfig, "2026-12-31", { dateDepart: "2026-01-01" });
    expect(codes(alertes)).not.toContain("pas_taux_janvier");
  });
});
