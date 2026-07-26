import { describe, expect, it } from "vitest";
import { calculerTotalAreAnnuel } from "../totalAreAnnuel";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { profil } from "../../engine/__tests__/testUtils";

describe("calculerTotalAreAnnuel", () => {
  const ouvertureDroits = { dateOuverture: "2026-02-01", franchiseCPTotale: 0, delaiAttenteInitial: 0 };

  it("null si ouvertureDroits absent — aucun chiffre inventé", () => {
    const p = profil({});
    expect(calculerTotalAreAnnuel(p, { dateDepart: "2026-02-01" }, [], franceTravailConfig, "2026-06-30", 2026)).toBeNull();
  });

  it("null si soldeDepart absent", () => {
    const p = profil({ ouvertureDroits });
    expect(calculerTotalAreAnnuel(p, null, [], franceTravailConfig, "2026-06-30", 2026)).toBeNull();
  });

  it("null si aucune AJ réelle renseignée", () => {
    const p = profil({ ouvertureDroits });
    expect(calculerTotalAreAnnuel(p, { dateDepart: "2026-02-01" }, [], franceTravailConfig, "2026-06-30", 2026)).toBeNull();
  });

  it("mois sans contrat : jours indemnisables = jours du mois, AJ connue -> total positif", () => {
    const p = profil({ ouvertureDroits, ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }] });
    const total = calculerTotalAreAnnuel(p, { dateDepart: "2026-02-01" }, [], franceTravailConfig, "2026-02-28", 2026);
    expect(total).toBe(28 * 50); // février 2026, 0h travaillées, aucune franchise/délai
  });

  it("ne compte que les mois de l'année fiscale demandée", () => {
    const p = profil({ ouvertureDroits, ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }] });
    const total2026 = calculerTotalAreAnnuel(p, { dateDepart: "2026-02-01" }, [], franceTravailConfig, "2027-01-31", 2027);
    // Seul janvier 2027 doit compter pour anneeFiscale=2027 (31j x 50 = 1550), pas les mois 2026.
    expect(total2026).toBe(31 * 50);
  });
});
