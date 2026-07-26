import { describe, expect, it } from "vitest";
import { calculerNetEstime } from "../estimationPaie";
import { franceTravailConfig } from "../../config/franceTravailConfig";

describe("calculerNetEstime — approximation ≈77% du brut (charges salariales moyennes d'artiste)", () => {
  it("cachet 130 € → net estimé ≈ 100,10 €", () => {
    expect(calculerNetEstime(130, franceTravailConfig)).toBeCloseTo(100.1, 2);
  });

  it("brut nul → net estimé nul", () => {
    expect(calculerNetEstime(0, franceTravailConfig)).toBe(0);
  });
});
