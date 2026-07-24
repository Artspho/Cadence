import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFranchiseSalaires, calculerMoisIndemnisation, calculerSerieDepuisContrats, calculerSerieIndemnisation } from "../indemnisationMensuelle";
import type { Contrat, MoisIndemnisationEntree, SoldeIndemnisation, SoldeIndemnisationDepart } from "../../types";
import { contrat, profil } from "./testUtils";

describe("calculerMoisIndemnisation", () => {
  it("jours non indemnisables = floor(heures × 1,3 / 10), avant tout calcul de place disponible", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 31, heuresDuMois: 93 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursNonIndemnisables).toBe(12); // floor(93 × 1.3 / 10) = floor(12.09) = 12 (cas réel avril 2026)
  });

  it("consomme le délai d'attente puis la franchise CP, dans cet ordre, sur le seul reliquat restant", () => {
    // Quota volontairement large (non contraignant) : ce test isole l'ordre délai → CP, pas le
    // plafond mensuel lui-même (cf. tests dédiés plus bas).
    const solde: SoldeIndemnisation = { delaiRestant: 3, franchiseCPRestante: 10, quotaCPCarryOver: 100 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // 30 jours dispo, 0 non indemnisable, délai consomme 3, franchise CP consomme 10, reste 17 payés.
    expect(resultat.joursNonIndemnisables).toBe(0);
    expect(resultat.delaiConsomme).toBe(3);
    expect(resultat.franchiseCPConsommee).toBe(10);
    expect(resultat.joursIndemnises).toBe(17);
    expect(resultat.soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 92 }); // 100 + 2 (forfait) - 10 consommé
  });

  it("le forfait mensuel plafonne la franchise CP même avec beaucoup de place et un solde important (corrigé le 2026-07-23)", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 20, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // Sans le forfait (ancien modèle, corrigé) : min(20, 30) = 20. Avec : plafonné au quota (0 report + 2 forfait).
    expect(resultat.franchiseCPConsommee).toBe(2);
  });

  it("le quota carry-over du mois précédent s'ajoute au forfait du mois suivant", () => {
    // Mois 1 : aucune place disponible pour la franchise CP (tout absorbé par le non-indemnisable,
    // 300 h -> floor(300*1.3/10)=39 >= 28 jours du mois).
    const mois1 = calculerMoisIndemnisation({ delaiRestant: 0, franchiseCPRestante: 10, quotaCPCarryOver: 0 }, { moisLabel: "m1", joursDuMois: 28, heuresDuMois: 300 }, franceTravailConfig);
    expect(mois1.franchiseCPConsommee).toBe(0);
    expect(mois1.soldeFin.quotaCPCarryOver).toBe(2); // forfait 2j intégralement reporté, rien à consommer ce mois

    // Mois 2 : beaucoup de place disponible — sans le report, seul le forfait (2j) serait consommé.
    // Avec le report du mois 1, le quota disponible est 2 (carry) + 2 (forfait) = 4.
    const mois2 = calculerMoisIndemnisation(mois1.soldeFin, { moisLabel: "m2", joursDuMois: 30, heuresDuMois: 0 }, franceTravailConfig);
    expect(mois2.franchiseCPConsommee).toBe(4);
  });

  it("franchise salaires : toujours non certifiée, jamais une formule devinée", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.franchiseSalaires).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("jamais de jours indemnisés négatifs même avec des heures disproportionnées au mois", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 28, heuresDuMois: 300 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursIndemnises).toBe(0);
    expect(resultat.delaiConsomme).toBe(0);
    expect(resultat.franchiseCPConsommee).toBe(0);
  });
});

describe("calculerSerieIndemnisation — cas certifiés sur relevés France Travail réels (fév-mai 2026, cf. docs/reprise.md)", () => {
  it("reproduit exactement les 4 mois certifiés à partir du solde d'ouverture du 01/02/2026 (quotaCPCarryOver = 2, janvier absorbé par le délai d'attente)", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2 };
    // Heures réelles (déclarations mensuelles France Travail, cachet = 12h) : fév 153h (21h+11
    // cachets), mars 105h (21h+7 cachets), avril 93h (21h+6 cachets), mai 21h (0 cachet).
    const mois: MoisIndemnisationEntree[] = [
      { moisLabel: "2026-02", joursDuMois: 28, heuresDuMois: 153 },
      { moisLabel: "2026-03", joursDuMois: 31, heuresDuMois: 105 },
      { moisLabel: "2026-04", joursDuMois: 30, heuresDuMois: 93 },
      { moisLabel: "2026-05", joursDuMois: 31, heuresDuMois: 21 },
    ];
    const resultats = calculerSerieIndemnisation(soldeDepart, mois, franceTravailConfig);

    expect(resultats.map((r) => r.joursIndemnises)).toEqual([0, 17, 18, 29]);
    expect(resultats.map((r) => r.joursNonIndemnisables)).toEqual([19, 13, 12, 2]);
    expect(resultats[0].delaiConsomme).toBe(5);
    expect(resultats[0].franchiseCPConsommee).toBe(4); // quota 2 (report janvier) + 2 (forfait février) = 4
    expect(resultats[1].franchiseCPConsommee).toBe(1); // le reste, franchise épuisée ensuite
    expect(resultats[2].franchiseCPConsommee).toBe(0);
    expect(resultats[3].franchiseCPConsommee).toBe(0);
    expect(resultats[3].soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 5 });
  });
});

describe("calculerSerieDepuisContrats", () => {
  const soldeDepart: SoldeIndemnisationDepart = { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2, ajReelleHistorique: [] };

  // Un contrat par mois, un seul jour, heures = le total réel du mois (cf. docs/reprise.md) — le
  // découpage mensuel lui-même (contrat chevauchant deux mois) est testé dans decoupageMensuel.test.ts.
  const contratsCertifies: Contrat[] = [
    contrat({ dateDebut: "2026-02-10", date: "2026-02-10", typeRemuneration: "heures", nbHeures: 153, salaireBrut: 0 }),
    contrat({ dateDebut: "2026-03-10", date: "2026-03-10", typeRemuneration: "heures", nbHeures: 105, salaireBrut: 0 }),
    contrat({ dateDebut: "2026-04-10", date: "2026-04-10", typeRemuneration: "heures", nbHeures: 93, salaireBrut: 0 }),
    contrat({ dateDebut: "2026-05-10", date: "2026-05-10", typeRemuneration: "heures", nbHeures: 21, salaireBrut: 0 }),
  ];

  it("reproduit les 4 mois certifiés à partir des vrais contrats, quel que soit leur ordre de saisie", () => {
    const contratsDesordre = [contratsCertifies[2], contratsCertifies[0], contratsCertifies[3], contratsCertifies[1]];
    const resultats = calculerSerieDepuisContrats(soldeDepart, contratsDesordre, "2026-05-31", franceTravailConfig);
    expect(resultats.map((r) => r.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05"]);
    expect(resultats.map((r) => r.joursIndemnises)).toEqual([0, 17, 18, 29]);
  });

  it("régression : les contrats artiste comptent bien, mélangés avec un enseignement récurrent sur le même mois (bug signalé, non reproduit)", () => {
    const enseignementRecurrent = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((mois) =>
      contrat({
        dateDebut: `${mois}-01`,
        date: `${mois}-28`,
        employeur: "Commune de Levallois Perret",
        type: "enseignement",
        typeRemuneration: "heures",
        nbHeures: 21,
        salaireBrut: 465,
        etablissementAgree: true,
        enRapportAvecMetier: true,
      }),
    );
    const artisteJuin = [
      contrat({ dateDebut: "2026-06-05", date: "2026-06-05", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "heures", nbHeures: 48, salaireBrut: 800 }),
      contrat({ dateDebut: "2026-06-12", date: "2026-06-12", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "heures", nbHeures: 26, salaireBrut: 400 }),
      contrat({ dateDebut: "2026-06-20", date: "2026-06-20", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "cachet", nbCachets: 6, salaireBrut: 700 }), // 72h
    ];
    const resultats = calculerSerieDepuisContrats(soldeDepart, [...enseignementRecurrent, ...artisteJuin], "2026-06-30", franceTravailConfig);
    const juin = resultats.find((r) => r.moisLabel === "2026-06");
    expect(juin?.heuresDuMois).toBe(167); // 21 (Levallois) + 48 + 26 + 72 (Arts Phocéens) — pas 21
    expect(juin?.joursNonIndemnisables).toBe(21); // floor(167 × 1,3 / 10) = floor(21,71) = 21
  });

  it("un mois sans aucun contrat obtient 0 h (pas d'absence silencieuse)", () => {
    // Seuls fév et avril ont un contrat ; mars et mai doivent quand même apparaître, à 0 h.
    const resultats = calculerSerieDepuisContrats(soldeDepart, [contratsCertifies[0], contratsCertifies[2]], "2026-05-31", franceTravailConfig);
    expect(resultats.map((r) => r.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05"]);
    expect(resultats[1].joursNonIndemnisables).toBe(0); // mars : 0 h -> 0 JNI
  });

  it("ignore les contrats antérieurs au mois du solde de départ (contexte, pas à recalculer)", () => {
    const contratJanvier = contrat({ dateDebut: "2026-01-10", date: "2026-01-10", typeRemuneration: "heures", nbHeures: 200, salaireBrut: 0 }); // "régularisé", hors périmètre du solde
    const resultats = calculerSerieDepuisContrats(soldeDepart, [contratJanvier, contratsCertifies[0]], "2026-02-28", franceTravailConfig);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].moisLabel).toBe("2026-02");
  });

  it("s'arrête au mois du dernier contrat, ou à aujourd'hui si plus tardif", () => {
    const resultats = calculerSerieDepuisContrats(soldeDepart, [contratsCertifies[0]], "2026-04-15", franceTravailConfig);
    expect(resultats.map((r) => r.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04"]); // dateDuJour (avril) > dernier contrat (février)
  });

  it("quotaCPCarryOver absent (solde configuré avant l'ajout du champ) : défaut 0, jamais une exception", () => {
    const soldeSansCarryOver: SoldeIndemnisationDepart = { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, ajReelleHistorique: [] };
    const resultats = calculerSerieDepuisContrats(soldeSansCarryOver, [contratsCertifies[0]], "2026-02-28", franceTravailConfig);
    // Sans le report de 2j (défaut 0) : quota = 0 + 2 (forfait) = 2, pas 4 — résultat différent du
    // cas certifié ci-dessus, volontairement : ce test documente le comportement par défaut, pas
    // une reproduction du cas réel.
    expect(resultats[0].franchiseCPConsommee).toBe(2);
  });

  it("montantMensuel non calculable (aj_manquante) quand ajReelleHistorique est vide", () => {
    const resultats = calculerSerieDepuisContrats(soldeDepart, [contratsCertifies[1]], "2026-03-31", franceTravailConfig);
    expect(resultats[0].montantMensuel).toEqual({ calculable: false, raison: "aj_manquante" });
  });

  it("montantMensuel calculé à partir de l'AJ applicable à chaque mois (deux taux successifs)", () => {
    const soldeAvecHistorique: SoldeIndemnisationDepart = {
      ...soldeDepart,
      ajReelleHistorique: [
        { dateEffet: "2025-03-24", valeur: 54.55 },
        { dateEffet: "2026-01-18", valeur: 55.02 },
      ],
    };
    // 17 jours indemnisés en mars (cf. cas certifié), taux du 18/01/2026 applicable.
    const resultats = calculerSerieDepuisContrats(soldeAvecHistorique, [contratsCertifies[0], contratsCertifies[1]], "2026-03-31", franceTravailConfig);
    expect(resultats[1].montantMensuel).toEqual({ calculable: true, montant: 17 * 55.02, ajUtilisee: 55.02 });
  });
});

describe("calculerFranchiseSalaires — formule certifiée le 2026-07-23 (ARTCENA + flyer officiel)", () => {
  it("calcule un total positif, arrondi, à partir de la formule", () => {
    const smicMensuel = 1867.02; // valeur au 01/06/2026
    const smicJournalier = 86.17;
    const srTotal = smicMensuel * 30; // SR / smicMensuel = 30, exactement
    const sjm = 3 * smicJournalier * 2; // SJM / (3 × smicJournalier) = 2, exactement
    const p = profil({ dateAnniversaire: "2026-12-31" }); // après le 01/06/2026
    const resultat = calculerFranchiseSalaires(srTotal, sjm, p, franceTravailConfig);
    // 30 × 2 − 27 = 33
    expect(resultat).toEqual({ valeur: 33, totalNonVerifie: true, sousEstimeeHorsA10: true });
  });

  it("franchise nulle (jamais négative) quand le résultat brut est ≤ 0", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const resultat = calculerFranchiseSalaires(0, 0, p, franceTravailConfig);
    expect(resultat.valeur).toBe(0);
  });

  it("lit le SMIC à la date de fin de PRA, pas la valeur courante", () => {
    const smicMensuel = 1823.03; // valeur au 01/01/2026, PAS la valeur courante (1867,02 au 01/06/2026)
    const smicJournalier = 84.14;
    const srTotal = smicMensuel * 30;
    const sjm = 3 * smicJournalier * 2;
    const p = profil({ dateAnniversaire: "2026-03-15" }); // avant la revalorisation du 01/06/2026
    const resultat = calculerFranchiseSalaires(srTotal, sjm, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: 33, totalNonVerifie: true, sousEstimeeHorsA10: true });
  });

  it("sousEstimeeHorsA10 = false quand salairesHorsAnnexe10PRA est renseigné", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", salairesHorsAnnexe10PRA: 5000 });
    const resultat = calculerFranchiseSalaires(10000, 100, p, franceTravailConfig);
    if (resultat.valeur === null) throw new Error("valeur ne devrait pas être null ici");
    expect(resultat.sousEstimeeHorsA10).toBe(false);
  });

  it("valeur null quand la date de fin de PRA est inconnue — jamais une formule devinée", () => {
    const p = profil({ dateAnniversaire: "" });
    const resultat = calculerFranchiseSalaires(100000, 100, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("valeur null quand la date de fin de PRA est antérieure à toute revalorisation SMIC connue", () => {
    const p = profil({ dateAnniversaire: "2020-01-01" });
    const resultat = calculerFranchiseSalaires(100000, 100, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });
});
