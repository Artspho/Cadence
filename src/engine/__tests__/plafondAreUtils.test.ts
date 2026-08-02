// Plafond ARE daté (chantier du 03/08/2026) : avant ce chantier, `config.are.plafond` était un
// scalaire unique et toute simulation portant sur une FCT passée se voyait appliquer le plafond
// COURANT. Ces tests fixent le comportement attendu à la date, pas seulement la fonction de lecture.
import { describe, expect, it } from "vitest";
import type { FenetreReference, Profil } from "../../types";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { getPlafondAreAt } from "../plafondAreUtils";
import { calculerAJBrute, calculerAJBrutePourFenetre } from "../areBrute";
import { calculerRenouvellementAnticipe, type AncienDroit } from "../renouvellementAnticipe";
import { ajouterJours } from "../dateUtils";
import { contrat, profil } from "./testUtils";

const PLAFOND_2024 = 174.8;
const PLAFOND_2025 = 177.56;
const PLAFOND_2026 = 181.18;
const PIVOT = "2026-01-01";

describe("getPlafondAreAt", () => {
  it("FCT antérieure au 01/01/2026 : plafond de l'année civile concernée, pas la valeur courante", () => {
    expect(getPlafondAreAt("2025-12-31", franceTravailConfig)).toBe(PLAFOND_2025);
    expect(getPlafondAreAt("2024-06-15", franceTravailConfig)).toBe(PLAFOND_2024);
    expect(getPlafondAreAt("2024-01-01", franceTravailConfig)).toBe(PLAFOND_2024); // borne basse incluse
  });

  it("FCT en 2025 : plafond de 177,56 €, ni celui de 2024 ni celui de 2026", () => {
    // L'entrée 2025 manquait à la première version de plafondHistorique : une FCT 2025 retombait
    // alors sur 174,80 €. Vérifié aux deux bornes de l'année en plus d'une date au milieu.
    expect(getPlafondAreAt("2025-06-15", franceTravailConfig)).toBe(PLAFOND_2025);
    expect(getPlafondAreAt("2025-01-01", franceTravailConfig)).toBe(PLAFOND_2025); // jour d'effet inclus
    expect(getPlafondAreAt("2024-12-31", franceTravailConfig)).toBe(PLAFOND_2024); // la veille : encore 2024
  });

  it("FCT postérieure au 01/01/2026 : plafond de 181,18 €", () => {
    expect(getPlafondAreAt("2026-06-01", franceTravailConfig)).toBe(PLAFOND_2026);
    expect(getPlafondAreAt("2030-01-01", franceTravailConfig)).toBe(PLAFOND_2026); // au-delà du dernier connu : dernière valeur en vigueur
  });

  it("à la date pivot exacte (01/01/2026) : la NOUVELLE valeur s'applique dès le jour d'effet", () => {
    expect(getPlafondAreAt(PIVOT, franceTravailConfig)).toBe(PLAFOND_2026);
    // Et la veille, l'ancienne — la bascule tient sur ces deux assertions côte à côte.
    expect(getPlafondAreAt("2025-12-31", franceTravailConfig)).toBe(PLAFOND_2025);
  });

  it("date antérieure à toute revalorisation connue : repli sur la plus ancienne entrée, jamais la valeur courante", () => {
    // Comportement documenté (cf. plafondAreUtils.ts) tant que le TODO « valeurs antérieures au
    // 01/01/2024 » n'est pas comblé : Historique.tsx reconstruit jusqu'à 10 cycles en arrière, une
    // exception y planterait l'écran. Le repli va vers le BAS (plafond plus bas = clamp plus strict).
    expect(getPlafondAreAt("2019-05-01", franceTravailConfig)).toBe(PLAFOND_2024);
    expect(getPlafondAreAt("2019-05-01", franceTravailConfig)).toBeLessThan(franceTravailConfig.are.plafond);
  });

  it("historique vide : erreur explicite plutôt qu'un plafond deviné", () => {
    const configSansHistorique = { ...franceTravailConfig, are: { ...franceTravailConfig.are, plafondHistorique: [] } };
    expect(() => getPlafondAreAt("2026-06-01", configSansHistorique)).toThrow();
  });
});

describe("calculerAJBrute — le clamp haut suit la date d'ouverture du droit", () => {
  // SR volontairement irréaliste pour forcer le dépassement (même dispositif que le cas B3b de
  // renouvellementAnticipe.test.ts : A+B+C ≈ 188,72 €, au-dessus des deux plafonds).
  const params = { salaireRetenu: 400_000, nht: 700, config: franceTravailConfig };

  it("FCT en 2024 : borné à 174,80 €", () => {
    const r = calculerAJBrute({ ...params, dateEffet: "2024-06-01" });
    expect(r.plafondApplique).toBe(true);
    expect(r.brut).toBe(PLAFOND_2024);
  });

  it("FCT en 2025 : borné à 177,56 €", () => {
    const r = calculerAJBrute({ ...params, dateEffet: "2025-06-01" });
    expect(r.plafondApplique).toBe(true);
    expect(r.brut).toBe(PLAFOND_2025);
  });

  it("FCT en 2026 : borné à 181,18 €", () => {
    const r = calculerAJBrute({ ...params, dateEffet: "2026-06-01" });
    expect(r.plafondApplique).toBe(true);
    expect(r.brut).toBe(PLAFOND_2026);
  });

  it("à la date pivot exacte : 181,18 €, et 177,56 € la veille", () => {
    expect(calculerAJBrute({ ...params, dateEffet: PIVOT }).brut).toBe(PLAFOND_2026);
    expect(calculerAJBrute({ ...params, dateEffet: "2025-12-31" }).brut).toBe(PLAFOND_2025);
  });

  it("le calcul AVANT clamp est identique aux deux dates : seule la borne haute change", () => {
    const avant = calculerAJBrute({ ...params, dateEffet: "2025-06-01" });
    const apres = calculerAJBrute({ ...params, dateEffet: "2026-06-01" });
    expect(avant.brutAvantClamp).toBe(apres.brutAvantClamp);
    expect(avant.brut).not.toBe(apres.brut);
  });
});

describe("calculerAJBrutePourFenetre — dérive la date de la fenêtre (dateFin = FCT retenue)", () => {
  function fenetreSeTerminantLe(dateFin: string): FenetreReference {
    return {
      dateDebut: ajouterJours(dateFin, -364),
      dateFin,
      joursAllongementMaladie: 0,
      seuilReadmission: { calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: franceTravailConfig.seuilHeures },
    };
  }

  it("fenêtre se terminant en 2024 / 2025 / 2026 : le plafond suit l'année de la FCT", () => {
    expect(calculerAJBrutePourFenetre(fenetreSeTerminantLe("2024-06-01"), 700, 400_000, 700, franceTravailConfig).brut).toBe(PLAFOND_2024);
    expect(calculerAJBrutePourFenetre(fenetreSeTerminantLe("2025-06-01"), 700, 400_000, 700, franceTravailConfig).brut).toBe(PLAFOND_2025);
    expect(calculerAJBrutePourFenetre(fenetreSeTerminantLe("2026-06-01"), 700, 400_000, 700, franceTravailConfig).brut).toBe(PLAFOND_2026);
  });
});

// Le scénario exact décrit dans le backlog : un renouvellement anticipé simulé sur une FCT
// antérieure au 01/01/2026 utilisait à tort 181,18 €. Test de bout en bout, par le vrai point
// d'entrée de l'écran (RenouvellementAnticipe.tsx appelle calculerRenouvellementAnticipe).
describe("renouvellement anticipé simulé sur une FCT passée — régression du 03/08/2026", () => {
  const profilBase: Profil = profil({ dateNaissance: "1985-06-15", situation: "readmission", dateAnniversairePrecedente: "2024-06-01" });
  const ancien: AncienDroit = {
    dateOuverture: "2024-06-03",
    fctRetenue: "2024-06-01",
    dateAnniversaire: "2025-06-01",
    ajNette: 53.31,
    franchiseCPTotale: 6,
    delaiAttenteInitial: 7,
  };
  const contrats = [contrat({ dateDebut: "2024-08-01", date: "2025-06-01", typeRemuneration: "heures", nbHeures: 700, salaireBrut: 400_000 })];

  it("FCT au 01/06/2025 : le plafond appliqué est celui de 2025 (177,56 €), pas 181,18 €", () => {
    const r = calculerRenouvellementAnticipe(contrats, [], profilBase, franceTravailConfig, ancien, "2025-06-01");
    expect(r.nouveau.ajBrute.plafondApplique).toBe(true);
    expect(r.nouveau.ajBrute.brut).toBe(PLAFOND_2025);
    expect(r.nouveau.ajBrute.brut).not.toBe(franceTravailConfig.are.plafond);
  });
});
