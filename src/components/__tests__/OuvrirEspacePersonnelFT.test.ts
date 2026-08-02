import { afterEach, describe, expect, it, vi } from "vitest";
import { ouvrirActualisationDeclaree, ouvrirMesCourriers } from "../OuvrirEspacePersonnelFT";

// Environnement de test "node" (pas de DOM) : `window` n'existe pas nativement, on le simule le
// temps du test plutôt que d'ajouter jsdom pour ce seul cas.
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("ouvrirMesCourriers", () => {
  it("ouvre « Mes courriers reçus » dans un nouvel onglet, sans lien retour vers window.opener", () => {
    const ouvrirMock = vi.fn();
    (globalThis as unknown as { window: { open: typeof ouvrirMock } }).window = { open: ouvrirMock };

    ouvrirMesCourriers();

    expect(ouvrirMock).toHaveBeenCalledWith("https://candidat.francetravail.fr/mescourriers/", "_blank", "noopener,noreferrer");
  });
});

describe("ouvrirActualisationDeclaree", () => {
  it("ouvre l'historique d'actualisation dans un nouvel onglet, sans lien retour vers window.opener", () => {
    const ouvrirMock = vi.fn();
    (globalThis as unknown as { window: { open: typeof ouvrirMock } }).window = { open: ouvrirMock };

    ouvrirActualisationDeclaree();

    expect(ouvrirMock).toHaveBeenCalledWith("https://candidat.francetravail.fr/actualisation-declaree/", "_blank", "noopener,noreferrer");
  });
});
