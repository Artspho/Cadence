import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerMoisIndemnisation, calculerSerieDepuisDeclarations, calculerSerieIndemnisation } from "../indemnisationMensuelle";
import type { DeclarationMensuelle, MoisIndemnisationEntree, SoldeIndemnisation, SoldeIndemnisationDepart } from "../../types";

describe("calculerMoisIndemnisation", () => {
  it("jours non indemnisables = ceil(joursDéclarés × 1,3), avant tout calcul de place disponible", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 31, joursDeclares: 9 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursNonIndemnisables).toBe(12); // ceil(9 × 1.3) = ceil(11.7) = 12
  });

  it("consomme le délai d'attente puis la franchise CP, dans cet ordre, sur le seul reliquat restant", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 3, franchiseCPRestante: 10 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // 30 jours dispo, 0 non indemnisable, délai consomme 3, franchise CP consomme 10, reste 17 payés.
    expect(resultat.joursNonIndemnisables).toBe(0);
    expect(resultat.delaiConsomme).toBe(3);
    expect(resultat.franchiseCPConsommee).toBe(10);
    expect(resultat.joursIndemnises).toBe(17);
    expect(resultat.soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0 });
  });

  it("franchise CP : pas de plafond mensuel, on consomme tout ce qui reste tant qu'il y a de la place (contredit forfaitMensuelBas/Haut, cf. franceTravailConfig.ts)", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 4 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.franchiseCPConsommee).toBe(4); // > 2 ou 3 j, l'ancien forfait mensuel aurait plafonné ici
  });

  it("franchise salaires : toujours non certifiée, jamais une formule devinée", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, joursDeclares: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.franchiseSalaires).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("jamais de jours indemnisés négatifs même avec des jours déclarés disproportionnés au mois", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 28, joursDeclares: 31 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursIndemnises).toBe(0);
    expect(resultat.delaiConsomme).toBe(0);
    expect(resultat.franchiseCPConsommee).toBe(0);
  });
});

describe("calculerSerieIndemnisation — cas certifiés sur relevés France Travail réels (fév-mai 2026, cf. docs/reprise.md)", () => {
  it("reproduit exactement les 4 mois certifiés à partir du solde d'ouverture du 01/02/2026", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 5, franchiseCPRestante: 5 };
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
    expect(resultats[0].franchiseCPConsommee).toBe(4); // tout le restant après délai
    expect(resultats[1].franchiseCPConsommee).toBe(1); // le reste, franchise épuisée ensuite
    expect(resultats[2].franchiseCPConsommee).toBe(0);
    expect(resultats[3].franchiseCPConsommee).toBe(0);
    expect(resultats[3].soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0 });
  });
});

describe("calculerSerieDepuisDeclarations", () => {
  const soldeDepart: SoldeIndemnisationDepart = { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5 };

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
});
