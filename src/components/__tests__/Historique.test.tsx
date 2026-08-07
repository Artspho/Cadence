// @vitest-environment jsdom
//
// 07/08/2026 — la puce « Dates estimées » (borneReelle: false) referme un gap devoir n°2 : avant ce
// commit, un cycle reconstruit par soustraction calendaire (cf. engine/cycles.ts) était approximé
// SANS le dire à l'écran, seulement dans un commentaire de code.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Historique } from "../Historique";
import type { Exercice } from "../../types";

function exercice(partiel: Partial<Exercice> & Pick<Exercice, "id" | "dateDebut" | "dateAnniversaire" | "borneReelle">): Exercice {
  return { heuresAtteintes: 0, objectifAtteint: false, cloture: true, ...partiel };
}

describe("Historique — puce « dates estimées »", () => {
  it("affiche la puce quand borneReelle est faux", () => {
    render(<Historique exercices={[exercice({ id: "e1", dateDebut: "2024-01-01", dateAnniversaire: "2024-12-31", borneReelle: false })]} />);
    expect(screen.getByText(/dates estimées — notification manquante/i)).toBeInTheDocument();
  });

  it("n'affiche PAS la puce quand borneReelle est vrai", () => {
    render(<Historique exercices={[exercice({ id: "e1", dateDebut: "2024-01-01", dateAnniversaire: "2024-12-31", borneReelle: true })]} />);
    expect(screen.queryByText(/dates estimées/i)).not.toBeInTheDocument();
  });
});
