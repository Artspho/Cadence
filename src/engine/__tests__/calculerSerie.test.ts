import { describe, expect, it } from "vitest";
import { calculerJoursTravailes, calculerSerie } from "../calculerSerie";
import { franceTravailConfig } from "../../config/franceTravailConfig";

describe("calculerJoursTravailes — données FT réelles Benoît", () => {
  it("mai 2026 : 0 cachet + 21h enseignement = 21h → floor(21×1,3/10) = 2 j", () => {
    expect(calculerJoursTravailes([{ heures: 21, cachets: 0 }], franceTravailConfig)).toBe(2);
  });

  it("juin 2026 : 11 cachets×12h + 35h enseignement = 167h → floor(167×1,3/10) = 21 j", () => {
    expect(calculerJoursTravailes([{ heures: 35, cachets: 11 }], franceTravailConfig)).toBe(21);
  });

  it("février 2026 : 11 cachets×12h + 21h = 153h → floor(153×1,3/10) = 19 j", () => {
    expect(calculerJoursTravailes([{ heures: 21, cachets: 11 }], franceTravailConfig)).toBe(19);
  });

  it("cumule plusieurs contrats sur le même mois avant d'appliquer le coefficient", () => {
    // Même total (7 cachets + 21h = 105h) réparti sur deux entrées plutôt qu'une seule.
    const resultat = calculerJoursTravailes(
      [
        { heures: 21, cachets: 3 },
        { heures: 0, cachets: 4 },
      ],
      franceTravailConfig,
    );
    expect(resultat).toBe(13); // floor(105×1,3/10) = 13, cf. mars 2026
  });
});

// Les 4 cas ci-dessous exercent tous EXACTEMENT la même logique de `calculerSerie` — aucun
// branchement spécial par cas. `franchiseCPTotale`/`delaiAttente` sont de purs paramètres d'entrée
// (jamais recalculés ni devinés par le moteur : ce sont les faits lus par l'utilisateur sur sa
// notification France Travail, cf. Profil.ouvertureDroits) ; le palier de forfait mensuel (2j/3j)
// est dérivé en interne depuis `franchiseCPTotale`, jamais fourni par l'appelant.
describe("calculerSerie — généralisation sur 4 profils distincts, même logique", () => {
  it("Benoît réel (franchiseCPTotale=5, delaiAttenteInitial=7) : réadmission incluse, fév=0 AJ, mars=17 AJ, avril=18 AJ", () => {
    // Janvier (mois de réadmission, partiel entre ancien et nouveau droit) : Cadence ne peut pas
    // reconstituer le découpage jour-mois exact (cf. calculerSerie.ts, en-tête du module) — traité
    // comme un mois entier, une estimation. La valeur ci-dessous (29 j non indemnisables, calibrée
    // pour ne laisser que 2 j de place ce mois-là) est un FIXTURE de non-régression qui reproduit
    // les valeurs certifiées de février/mars/avril sur le relevé France Travail réel de Benoît —
    // elle ne prétend pas reconstituer les vraies heures de janvier (indisponibles), cf. décision
    // actée avec l'utilisateur : les données de Benoît servent de fixture, pas de preuve de formule.
    const resultats = calculerSerie({
      mois: [
        { joursDuMois: 31, joursTravailes: 29 }, // janvier 2026, réadmission (estimation)
        { joursDuMois: 28, joursTravailes: 19 }, // février 2026, 153h réelles
        { joursDuMois: 31, joursTravailes: 13 }, // mars 2026, 105h réelles
        { joursDuMois: 30, joursTravailes: 12 }, // avril 2026, 93h réelles
        { joursDuMois: 31, joursTravailes: 2 }, // mai 2026, 21h réelles
      ],
      ajNetteAvantPAS: 53.81,
      tauxPAS: 0.031,
      franchiseCPTotale: 5,
      delaiAttente: 7,
      config: franceTravailConfig,
    });

    expect(resultats[1].joursIndemnisables).toBe(0); // février
    expect(resultats[2].joursIndemnisables).toBe(17); // mars
    expect(resultats[2].netSocial).toBeCloseTo(17 * 53.81, 2);
    expect(resultats[3].joursIndemnisables).toBe(18); // avril
    expect(resultats[4].joursIndemnisables).toBe(29); // mai

    // Franchise CP et délai bien épuisés à partir de mars (dernier jour de CP consommé en mars) :
    // plus aucun résidu à partir d'avril, cf. badge "Estimation" (RevenusMensuels.tsx).
    expect(resultats[2].franchiseCPRestante).toBe(0);
    expect(resultats[2].delaiRestant).toBe(0);
    expect(resultats[3].franchiseCPRestante).toBe(0);
    expect(resultats[3].delaiRestant).toBe(0);
  });

  it("cas simple (franchiseCPTotale=0, delaiAttenteInitial=7) : aucune franchise CP, seul le délai se consomme", () => {
    const resultats = calculerSerie({
      mois: [
        { joursDuMois: 30, joursTravailes: 0 }, // rien travaillé, tout dispo pour le délai
        { joursDuMois: 30, joursTravailes: 0 },
      ],
      ajNetteAvantPAS: 50,
      tauxPAS: 0,
      franchiseCPTotale: 0,
      delaiAttente: 7,
      config: franceTravailConfig,
    });

    expect(resultats[0].franchiseCPConsommee).toBe(0); // jamais de franchise CP consommée
    expect(resultats[0].delaiConsomme).toBe(7); // délai intégralement consommé le 1er mois
    expect(resultats[0].joursIndemnisables).toBe(23); // 30 - 7
    expect(resultats[0].franchiseCPRestante).toBe(0);
    expect(resultats[0].delaiRestant).toBe(0);

    expect(resultats[1].delaiConsomme).toBe(0); // plus rien à consommer le 2e mois
    expect(resultats[1].joursIndemnisables).toBe(30); // mois normal, plus aucune franchise/délai
  });

  it("cas extrême (franchiseCPTotale=30, delaiAttenteInitial=7) : palier haut (forfait 3j/mois, total > seuilFranchiseTotaleJours)", () => {
    const resultats = calculerSerie({
      mois: [{ joursDuMois: 31, joursTravailes: 0 }],
      ajNetteAvantPAS: 50,
      tauxPAS: 0,
      franchiseCPTotale: 30,
      delaiAttente: 7,
      config: franceTravailConfig,
    });

    // Palier haut : forfait 3j/mois (pas 2j, réservé aux totaux ≤ seuilFranchiseTotaleJours).
    expect(resultats[0].franchiseCPConsommee).toBe(3);
    expect(resultats[0].delaiConsomme).toBe(7);
    expect(resultats[0].joursIndemnisables).toBe(21); // 31 - 3 - 7
    expect(resultats[0].franchiseCPRestante).toBe(27); // 30 - 3, encore beaucoup à consommer
  });

  it("délai déjà épuisé (franchiseCPTotale=18, delaiAttenteInitial=0) : seule la franchise CP se consomme, aucun branchement spécial requis", () => {
    const resultats = calculerSerie({
      mois: [{ joursDuMois: 30, joursTravailes: 0 }],
      ajNetteAvantPAS: 50,
      tauxPAS: 0,
      franchiseCPTotale: 18,
      delaiAttente: 0,
      config: franceTravailConfig,
    });

    expect(resultats[0].delaiConsomme).toBe(0);
    expect(resultats[0].franchiseCPConsommee).toBe(2); // palier bas (18 ≤ seuil), forfait 2j
    expect(resultats[0].joursIndemnisables).toBe(28); // 30 - 2
    expect(resultats[0].franchiseCPRestante).toBe(16);
  });
});

describe("calculerSerie — comportement générique", () => {
  it("sans franchise ni délai, un seul mois : jours indemnisables = jours non travaillés", () => {
    const resultats = calculerSerie({
      mois: [{ joursDuMois: 30, joursTravailes: 12 }],
      ajNetteAvantPAS: 53.81,
      tauxPAS: 0.031,
      franchiseCPTotale: 0,
      delaiAttente: 0,
      config: franceTravailConfig,
    });

    expect(resultats[0].joursIndemnisables).toBe(18);
    expect(resultats[0].franchiseCPConsommee).toBe(0);
    expect(resultats[0].delaiConsomme).toBe(0);
  });
});
