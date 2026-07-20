import { describe, expect, it } from "vitest";
import { estPerime } from "../franceTravailConfig";

describe("estPerime", () => {
  it("valableJusquau null -> pas périmé (rien de déclaré, aucun jugement)", () => {
    expect(estPerime(new Date("2026-07-21"), null)).toBe(false);
  });

  it("valableJusquau dans le futur -> pas périmé", () => {
    expect(estPerime(new Date("2026-07-21"), "2027-01-01")).toBe(false);
  });

  it("valableJusquau dans le passé -> périmé", () => {
    expect(estPerime(new Date("2026-07-21"), "2026-01-01")).toBe(true);
  });

  it("valableJusquau égal au jour de référence exact -> pas encore périmé", () => {
    expect(estPerime(new Date("2026-07-21"), "2026-07-21")).toBe(false);
  });
});
