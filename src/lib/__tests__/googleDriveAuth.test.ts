import { describe, expect, it } from "vitest";
import { tokenEstValide } from "../googleDriveAuth";

describe("tokenEstValide", () => {
  it("retourne false si pas de token (estConnecte() sans connexion préalable)", () => {
    expect(tokenEstValide(null, 1_000)).toBe(false);
  });

  it("retourne false si le token est expiré", () => {
    expect(tokenEstValide({ accessToken: "x", expiresAt: 1_000 }, 2_000)).toBe(false);
  });

  it("retourne false dans la marge de 60s avant expiration réelle", () => {
    expect(tokenEstValide({ accessToken: "x", expiresAt: 61_000 }, 1_000)).toBe(false);
  });

  it("retourne true si le token est encore valide au-delà de la marge", () => {
    expect(tokenEstValide({ accessToken: "x", expiresAt: 200_000 }, 1_000)).toBe(true);
  });
});
