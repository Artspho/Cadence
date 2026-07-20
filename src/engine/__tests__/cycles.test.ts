import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { decouperExercices } from "../cycles";
import { contrat, profil } from "./testUtils";

describe("decouperExercices", () => {
  it("découpe correctement les exercices entre deux dates anniversaire", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [
      contrat({ date: "2025-06-01", nbCachets: 50 }), // exercice précédent, 600 h -> objectif atteint
      contrat({ date: "2026-03-01", nbCachets: 10 }), // exercice en cours, 120 h -> objectif non atteint
    ];

    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");

    expect(exercices).toHaveLength(2);

    const [enCours, precedent] = exercices;
    expect(enCours.dateDebut).toBe("2026-01-01");
    expect(enCours.dateAnniversaire).toBe("2026-12-31");
    expect(enCours.cloture).toBe(false);
    expect(enCours.heuresAtteintes).toBe(120);
    expect(enCours.objectifAtteint).toBe(false);

    expect(precedent.dateDebut).toBe("2025-01-01");
    expect(precedent.dateAnniversaire).toBe("2025-12-31");
    expect(precedent.cloture).toBe(true);
    expect(precedent.heuresAtteintes).toBe(600);
    expect(precedent.objectifAtteint).toBe(true);
    expect(precedent.ajBrute).toBeDefined();
  });

  it("renvoie un historique vide sans date anniversaire connue (première admission)", () => {
    const p = profil({ dateAnniversaire: "" });
    expect(decouperExercices(p, [], [], franceTravailConfig, "2026-06-01")).toEqual([]);
  });
});
