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

describe("calculerSerie — série Benoît (données FT certifiées, relevé du 14/04/2026)", () => {
  it("janvier grisé, février à zéro, mars/avril/mai conformes au relevé", () => {
    const resultats = calculerSerie({
      mois: [
        { joursDuMois: 31, joursTravailes: 0, estGrise: true }, // janvier 2026, réadmission
        { joursDuMois: 28, joursTravailes: 19, estGrise: false }, // février 2026
        { joursDuMois: 31, joursTravailes: 13, estGrise: false }, // mars 2026
        { joursDuMois: 30, joursTravailes: 12, estGrise: false }, // avril 2026
        { joursDuMois: 31, joursTravailes: 2, estGrise: false }, // mai 2026
      ],
      ajNetteAvantPAS: 53.81,
      tauxPAS: 0.031,
      franchiseCPTotale: 5,
      franchiseCPMensuelleMax: 2,
      // 5, pas 7 : 2 j du délai d'attente sont déjà inapplicables pendant le mois grisé de
      // janvier (ancien dossier) — seule valeur cohérente avec mars = 17 AJ sans aucun délai
      // (relevé FT : "31 − 13 − 1", pas de terme délai). Avec delaiAttente=7 le résidu de février
      // (2 j) se reporterait sur mars et le ferait tomber à 15 AJ, contredisant le relevé.
      delaiAttente: 5,
    });

    expect(resultats[0]).toEqual({
      joursIndemnisables: 0,
      netSocial: 0,
      netApresPAS: 0,
      franchiseCPConsommee: 0,
      delaiConsomme: 0,
      estGrise: true,
    });

    // Février : franchise CP (2 j février + 2 j report de janvier = 4 j) + délai (5 j)
    // épuisent exactement les 9 jours non travaillés du mois → 0 AJ.
    expect(resultats[1].estGrise).toBe(false);
    expect(resultats[1].joursIndemnisables).toBe(0);
    expect(resultats[1].franchiseCPConsommee).toBe(4);
    expect(resultats[1].delaiConsomme).toBe(5);

    // Mars : dernier jour de franchise CP (5 − 4 = 1), délai déjà épuisé.
    expect(resultats[2].joursIndemnisables).toBe(17);
    expect(resultats[2].franchiseCPConsommee).toBe(1);
    expect(resultats[2].delaiConsomme).toBe(0);
    expect(resultats[2].netSocial).toBeCloseTo(914.77, 2);
    expect(resultats[2].netApresPAS).toBeCloseTo(886.41, 2);

    // Avril : plus aucune franchise ni délai.
    expect(resultats[3].joursIndemnisables).toBe(18);
    expect(resultats[3].franchiseCPConsommee).toBe(0);

    // Mai : idem.
    expect(resultats[4].joursIndemnisables).toBe(29);
    expect(resultats[4].franchiseCPConsommee).toBe(0);
  });
});

describe("calculerSerie — comportement générique", () => {
  it("sans franchise ni délai, un seul mois : jours indemnisables = jours non travaillés", () => {
    const resultats = calculerSerie({
      mois: [{ joursDuMois: 30, joursTravailes: 12, estGrise: false }],
      ajNetteAvantPAS: 53.81,
      tauxPAS: 0.031,
      franchiseCPTotale: 0,
      franchiseCPMensuelleMax: 2,
      delaiAttente: 0,
    });

    expect(resultats[0].joursIndemnisables).toBe(18);
    expect(resultats[0].franchiseCPConsommee).toBe(0);
    expect(resultats[0].delaiConsomme).toBe(0);
  });
});
