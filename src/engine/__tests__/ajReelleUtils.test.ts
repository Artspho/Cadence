import { describe, expect, it } from "vitest";
import { getAjReelleAt, getTauxPASAt } from "../ajReelleUtils";

const HISTORIQUE_2_TAUX = [
  { dateEffet: "2025-03-24", valeur: 54.55 },
  { dateEffet: "2026-01-18", valeur: 55.02 },
];

// Valeurs réelles (relevés de situation d'un dossier réel, 01/08/2026) : taux personnalisé de
// 3,30 % constaté en juillet 2025, 3,10 % constaté en février 2026 — cf. docs/reprise.md.
const HISTORIQUE_TAUX_PAS_REEL = [
  { dateEffet: "2025-07-03", valeur: 3.3 },
  { dateEffet: "2026-02-17", valeur: 3.1 },
];

describe("getAjReelleAt", () => {
  it("retourne la bonne valeur pour une date dans une période", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2025-06-01")).toBe(54.55);
  });

  it("retourne null pour une date antérieure à toute entrée connue", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2025-01-01")).toBeNull();
  });

  it("retourne null pour un tableau vide", () => {
    expect(getAjReelleAt([], "2026-06-01")).toBeNull();
  });

  it("retourne null pour un historique undefined", () => {
    expect(getAjReelleAt(undefined, "2026-06-01")).toBeNull();
  });

  it("bascule sur le nouveau taux au bon jour (54,55 € → 55,02 € au 18/01/2026)", () => {
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-01-17")).toBe(54.55);
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-01-18")).toBe(55.02);
    expect(getAjReelleAt(HISTORIQUE_2_TAUX, "2026-03-01")).toBe(55.02);
  });
});

describe("getTauxPASAt", () => {
  it("plusieurs sections de taux PAS avec des dates différentes -> retourne la plus récente applicable, jamais la première trouvée", () => {
    // Le taux de juillet 2025 s'applique jusqu'à la veille du changement.
    expect(getTauxPASAt(HISTORIQUE_TAUX_PAS_REEL, "2025-12-31")).toBe(3.3);
    // Bascule exacte au jour de la nouvelle section.
    expect(getTauxPASAt(HISTORIQUE_TAUX_PAS_REEL, "2026-02-17")).toBe(3.1);
    expect(getTauxPASAt(HISTORIQUE_TAUX_PAS_REEL, "2026-06-01")).toBe(3.1);
  });

  it("aucun taux connu ne s'applique jamais rétroactivement à un mois antérieur à sa date d'effet", () => {
    // Avant la toute première entrée connue : aucun taux, jamais celui qui arrivera plus tard.
    expect(getTauxPASAt(HISTORIQUE_TAUX_PAS_REEL, "2025-01-01")).toBeNull();
    // La veille du changement ne doit jamais recevoir le nouveau taux.
    expect(getTauxPASAt(HISTORIQUE_TAUX_PAS_REEL, "2026-02-16")).toBe(3.3);
  });

  it("retourne null pour un tableau vide ou un historique undefined", () => {
    expect(getTauxPASAt([], "2026-06-01")).toBeNull();
    expect(getTauxPASAt(undefined, "2026-06-01")).toBeNull();
  });
});
