import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFranchiseSalaires, calculerMoisIndemnisation, calculerSerieDepuisDeclarations, calculerSerieIndemnisation } from "../indemnisationMensuelle";
import type { DeclarationMensuelle, MoisIndemnisationEntree, SoldeIndemnisation, SoldeIndemnisationDepart } from "../../types";
import { profil } from "./testUtils";

describe("calculerMoisIndemnisation", () => {
  it("jours non indemnisables = ceil(joursDéclarés × 1,3), avant tout calcul de place disponible", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 31, joursDeclares: 9 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursNonIndemnisables).toBe(12); // ceil(9 × 1.3) = ceil(11.7) = 12
  });

  it("consomme le délai d'attente puis la franchise CP, dans cet ordre, sur le seul reliquat restant", () => {
    // Quota volontairement large (non contraignant) : ce test isole l'ordre délai → CP, pas le
    // plafond mensuel lui-même (cf. tests dédiés plus bas).
    const solde: SoldeIndemnisation = { delaiRestant: 3, franchiseCPRestante: 10, quotaCPCarryOver: 100 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
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
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // Sans le forfait (ancien modèle, corrigé) : min(20, 30) = 20. Avec : plafonné au quota (0 report + 2 forfait).
    expect(resultat.franchiseCPConsommee).toBe(2);
  });

  it("le quota carry-over du mois précédent s'ajoute au forfait du mois suivant", () => {
    // Mois 1 : aucune place disponible pour la franchise CP (tout absorbé par le non-indemnisable)
    // — le forfait du mois (2j) n'est pas consommé, il se reporte intégralement.
    const mois1 = calculerMoisIndemnisation({ delaiRestant: 0, franchiseCPRestante: 10, quotaCPCarryOver: 0 }, { moisLabel: "m1", joursDuMois: 28, joursDeclares: 28 }, franceTravailConfig);
    expect(mois1.franchiseCPConsommee).toBe(0);
    expect(mois1.soldeFin.quotaCPCarryOver).toBe(2); // forfait 2j intégralement reporté, rien à consommer ce mois

    // Mois 2 : beaucoup de place disponible — sans le report, seul le forfait (2j) serait consommé.
    // Avec le report du mois 1, le quota disponible est 2 (carry) + 2 (forfait) = 4.
    const mois2 = calculerMoisIndemnisation(mois1.soldeFin, { moisLabel: "m2", joursDuMois: 30, joursDeclares: 0 }, franceTravailConfig);
    expect(mois2.franchiseCPConsommee).toBe(4);
  });

  it("franchise salaires : toujours non certifiée, jamais une formule devinée", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.franchiseSalaires).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("jamais de jours indemnisés négatifs même avec des jours déclarés disproportionnés au mois", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 28, joursDeclares: 31 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursIndemnises).toBe(0);
    expect(resultat.delaiConsomme).toBe(0);
    expect(resultat.franchiseCPConsommee).toBe(0);
  });
});

describe("calculerSerieIndemnisation — cas certifiés sur relevés France Travail réels (fév-mai 2026, cf. docs/reprise.md)", () => {
  it("reproduit exactement les 4 mois certifiés à partir du solde d'ouverture du 01/02/2026 (quotaCPCarryOver = 2, janvier absorbé par le délai d'attente)", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2 };
    const mois: MoisIndemnisationEntree[] = [
      { moisLabel: "2026-02", joursDuMois: 28, joursDeclares: 14 },
      { moisLabel: "2026-03", joursDuMois: 31, joursDeclares: 10 },
      { moisLabel: "2026-04", joursDuMois: 30, joursDeclares: 9 },
      { moisLabel: "2026-05", joursDuMois: 31, joursDeclares: 1 },
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

describe("calculerSerieDepuisDeclarations", () => {
  const soldeDepart: SoldeIndemnisationDepart = { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2, ajReelle: null };

  it("reproduit les 4 mois certifiés à partir de déclarations saisies dans le désordre", () => {
    const declarations: DeclarationMensuelle[] = [
      { id: "1", mois: "2026-04", joursDeclares: 9, source: "lecture_releve" },
      { id: "2", mois: "2026-02", joursDeclares: 14, source: "lecture_releve" },
      { id: "3", mois: "2026-05", joursDeclares: 1, source: "manuel" },
      { id: "4", mois: "2026-03", joursDeclares: 10, source: "lecture_releve" },
    ];
    const resultats = calculerSerieDepuisDeclarations(soldeDepart, declarations, franceTravailConfig);
    expect(resultats.map((r) => r.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05"]);
    expect(resultats.map((r) => r.joursIndemnises)).toEqual([0, 17, 18, 29]);
  });

  it("ignore les déclarations antérieures au mois du solde de départ (contexte, pas à recalculer)", () => {
    const declarations: DeclarationMensuelle[] = [
      { id: "0", mois: "2026-01", joursDeclares: 18, source: "lecture_releve" }, // "régularisé", hors périmètre du solde
      { id: "1", mois: "2026-02", joursDeclares: 14, source: "lecture_releve" },
    ];
    const resultats = calculerSerieDepuisDeclarations(soldeDepart, declarations, franceTravailConfig);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].moisLabel).toBe("2026-02");
  });

  it("quotaCPCarryOver absent (solde configuré avant l'ajout du champ) : défaut 0, jamais une exception", () => {
    const soldeSansCarryOver: SoldeIndemnisationDepart = { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, ajReelle: null };
    const declarations: DeclarationMensuelle[] = [{ id: "1", mois: "2026-02", joursDeclares: 14, source: "lecture_releve" }];
    const resultats = calculerSerieDepuisDeclarations(soldeSansCarryOver, declarations, franceTravailConfig);
    // Sans le report de 2j (défaut 0) : quota = 0 + 2 (forfait) = 2, pas 4 — résultat différent du
    // cas certifié ci-dessus, volontairement : ce test documente le comportement par défaut, pas
    // une reproduction du cas réel.
    expect(resultats[0].franchiseCPConsommee).toBe(2);
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
