// @vitest-environment jsdom
//
// 07/08/2026 — la puce « Dates estimées » (borneReelle: false) referme un gap devoir n°2 : avant ce
// commit, un cycle reconstruit par soustraction calendaire (cf. engine/cycles.ts) était approximé
// SANS le dire à l'écran, seulement dans un commentaire de code.
//
// 07/08/2026, même jour — vue unifiée (idée de Benoît) : le cycle en cours (cloture: false) devient
// une carte à part avec barre de progression vers `seuilHeures`, distincte de la ligne chronologique
// des cycles clos. Ces tests couvrent la partition en cours/clos, en plus de la puce déjà verrouillée.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Historique } from "../Historique";
import type { Exercice } from "../../types";

const SEUIL = 507;

function exercice(partiel: Partial<Exercice> & Pick<Exercice, "id" | "dateDebut" | "dateAnniversaire" | "borneReelle">): Exercice {
  return { heuresAtteintes: 0, objectifAtteint: false, cloture: true, ...partiel };
}

describe("Historique — puce « dates estimées »", () => {
  it("affiche la puce quand borneReelle est faux", () => {
    render(<Historique exercices={[exercice({ id: "e1", dateDebut: "2024-01-01", dateAnniversaire: "2024-12-31", borneReelle: false })]} seuilHeures={SEUIL} />);
    expect(screen.getByText(/dates estimées — notification manquante/i)).toBeInTheDocument();
  });

  it("n'affiche PAS la puce quand borneReelle est vrai", () => {
    render(<Historique exercices={[exercice({ id: "e1", dateDebut: "2024-01-01", dateAnniversaire: "2024-12-31", borneReelle: true })]} seuilHeures={SEUIL} />);
    expect(screen.queryByText(/dates estimées/i)).not.toBeInTheDocument();
  });
});

describe("Historique — carte du cycle en cours (vue unifiée)", () => {
  it("affiche la carte « Cycle en cours » avec la progression vers seuilHeures, pour le seul exercice non clos", () => {
    render(
      <Historique
        exercices={[exercice({ id: "e1", dateDebut: "2026-08-01", dateAnniversaire: "2027-08-01", borneReelle: true, cloture: false, heuresAtteintes: 300 })]}
        seuilHeures={SEUIL}
      />,
    );
    expect(screen.getByText("Cycle en cours")).toBeInTheDocument();
    expect(screen.getByText("300 / 507 h")).toBeInTheDocument();
    expect(screen.getByText(/207 h restantes/i)).toBeInTheDocument();
  });

  it("dit que le seuil est atteint plutôt que d'annoncer des heures restantes négatives", () => {
    render(
      <Historique
        exercices={[exercice({ id: "e1", dateDebut: "2026-08-01", dateAnniversaire: "2027-08-01", borneReelle: true, cloture: false, heuresAtteintes: 540 })]}
        seuilHeures={SEUIL}
      />,
    );
    expect(screen.getByText(/seuil atteint/i)).toBeInTheDocument();
    expect(screen.queryByText(/restantes/i)).not.toBeInTheDocument();
  });

  it("n'affiche aucune carte « Cycle en cours » quand tous les exercices sont clos (date anniversaire dépassée)", () => {
    render(<Historique exercices={[exercice({ id: "e1", dateDebut: "2024-01-01", dateAnniversaire: "2024-12-31", borneReelle: true, cloture: true })]} seuilHeures={SEUIL} />);
    expect(screen.queryByText("Cycle en cours")).not.toBeInTheDocument();
  });

  it("dit qu'il n'y a pas encore de cycle clos quand seul le cycle en cours existe", () => {
    render(
      <Historique
        exercices={[exercice({ id: "e1", dateDebut: "2026-08-01", dateAnniversaire: "2027-08-01", borneReelle: true, cloture: false, heuresAtteintes: 100 })]}
        seuilHeures={SEUIL}
      />,
    );
    expect(screen.getByText(/pas encore de cycle clos/i)).toBeInTheDocument();
  });

  it("affiche à la fois la carte du cycle en cours et la ligne chronologique des cycles clos", () => {
    render(
      <Historique
        exercices={[
          exercice({ id: "e1", dateDebut: "2026-08-01", dateAnniversaire: "2027-08-01", borneReelle: true, cloture: false, heuresAtteintes: 100 }),
          exercice({ id: "e2", dateDebut: "2025-08-01", dateAnniversaire: "2026-07-31", borneReelle: true, cloture: true, objectifAtteint: true, heuresAtteintes: 600 }),
        ]}
        seuilHeures={SEUIL}
      />,
    );
    expect(screen.getByText("Cycle en cours")).toBeInTheDocument();
    expect(screen.getByText(/Cycle clos/)).toBeInTheDocument();
    expect(screen.getByText("Objectif atteint")).toBeInTheDocument();
  });
});
