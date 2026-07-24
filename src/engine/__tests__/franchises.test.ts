import { describe, expect, it } from "vitest";
import { appliquerFranchises } from "../franchises";

describe("appliquerFranchises — données FT réelles Benoît (relevé du 14/04/2026)", () => {
  it("février 2026 : franchise CP + délai épuisent tout le mois (0 AJ)", () => {
    // franchiseCPMensuelleMax=4 = forfait de février (2) + report du forfait de janvier
    // jamais consommé (2, Benoît encore sur l'ancien dossier ce mois-là) — calculé par
    // l'appelant, pas par cette fonction (cf. commentaire du module).
    // delaiAttente=5 = résidu du délai d'attente de 7 j après 2 j déjà consommés ailleurs
    // avant février — seule valeur cohérente avec delaiAttenteRestant=0 attendu ci-dessous.
    const resultat = appliquerFranchises({
      joursDuMois: 28,
      joursTravailes: 19,
      franchiseCPRestante: 5,
      franchiseCPMensuelleMax: 4,
      delaiAttente: 5,
    });
    expect(resultat).toEqual({ joursIndemnisables: 0, franchiseCPRestante: 1, delaiAttenteRestant: 0 });
  });

  it("mars 2026 : franchise CP épuisée (dernier jour), 17 AJ", () => {
    const resultat = appliquerFranchises({
      joursDuMois: 31,
      joursTravailes: 13,
      franchiseCPRestante: 1,
      franchiseCPMensuelleMax: 2,
      delaiAttente: 0,
    });
    expect(resultat).toEqual({ joursIndemnisables: 17, franchiseCPRestante: 0, delaiAttenteRestant: 0 });
  });

  it("avril 2026 : plus aucune franchise, 18 AJ", () => {
    const resultat = appliquerFranchises({
      joursDuMois: 30,
      joursTravailes: 12,
      franchiseCPRestante: 0,
      franchiseCPMensuelleMax: 2,
      delaiAttente: 0,
    });
    expect(resultat).toEqual({ joursIndemnisables: 18, franchiseCPRestante: 0, delaiAttenteRestant: 0 });
  });

  it("mai 2026 : plus aucune franchise, 29 AJ", () => {
    const resultat = appliquerFranchises({
      joursDuMois: 31,
      joursTravailes: 2,
      franchiseCPRestante: 0,
      franchiseCPMensuelleMax: 2,
      delaiAttente: 0,
    });
    expect(resultat).toEqual({ joursIndemnisables: 29, franchiseCPRestante: 0, delaiAttenteRestant: 0 });
  });

  it("mois grisé (tout est travail) : rien n'est consommé, le report reste au caller de calculer", () => {
    const resultat = appliquerFranchises({
      joursDuMois: 31,
      joursTravailes: 31,
      franchiseCPRestante: 5,
      franchiseCPMensuelleMax: 2,
      delaiAttente: 7,
    });
    expect(resultat).toEqual({ joursIndemnisables: 0, franchiseCPRestante: 5, delaiAttenteRestant: 7 });
  });
});

describe("appliquerFranchises — comportement générique", () => {
  it("consomme d'abord la franchise CP puis le délai d'attente, jamais l'inverse", () => {
    // 5 jours disponibles, franchise CP illimitée mais plafonnée à 3 ce mois-ci : elle doit
    // mordre en premier, le délai ne mord que sur ce qu'il en reste.
    const resultat = appliquerFranchises({
      joursDuMois: 30,
      joursTravailes: 25,
      franchiseCPRestante: 10,
      franchiseCPMensuelleMax: 3,
      delaiAttente: 4,
    });
    // joursDisponibles = 5 ; CP = min(10,3,5) = 3 -> reste 2 ; délai = min(4,2) = 2 -> reste 0
    expect(resultat).toEqual({ joursIndemnisables: 0, franchiseCPRestante: 7, delaiAttenteRestant: 2 });
  });

  it("ne consomme jamais plus que les jours réellement disponibles ce mois-ci", () => {
    const resultat = appliquerFranchises({
      joursDuMois: 30,
      joursTravailes: 29,
      franchiseCPRestante: 10,
      franchiseCPMensuelleMax: 5,
      delaiAttente: 7,
    });
    // joursDisponibles = 1 : la franchise CP ne peut pas consommer plus que ce jour unique,
    // il ne reste alors rien pour le délai d'attente.
    expect(resultat).toEqual({ joursIndemnisables: 0, franchiseCPRestante: 9, delaiAttenteRestant: 7 });
  });
});
