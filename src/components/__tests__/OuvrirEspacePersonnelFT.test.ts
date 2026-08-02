import { afterEach, describe, expect, it, vi } from "vitest";
import { ouvrirEspacePersonnelFT } from "../OuvrirEspacePersonnelFT";

// Environnement de test "node" (pas de DOM) : `window` n'existe pas nativement, on le simule le
// temps du test plutôt que d'ajouter jsdom pour ce seul cas.
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("ouvrirEspacePersonnelFT", () => {
  it("ouvre l'espace personnel France Travail dans un nouvel onglet, sans lien retour vers window.opener", () => {
    const ouvrirMock = vi.fn();
    (globalThis as unknown as { window: { open: typeof ouvrirMock } }).window = { open: ouvrirMock };

    ouvrirEspacePersonnelFT();

    expect(ouvrirMock).toHaveBeenCalledWith("https://candidat.francetravail.fr/espacepersonnel/", "_blank", "noopener,noreferrer");
  });
});
