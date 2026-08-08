// @vitest-environment jsdom
//
// Bottom bar mobile (étape 6 de la refonte UI, 07/08/2026) : 4 onglets fixes + « Plus » ouvrant
// FeuillePlusOnglets pour le reste, jamais montée en permanence (cf. son en-tête).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BottomTabBar } from "../BottomTabBar";

function nav() {
  return screen.getByRole("navigation", { name: /navigation mobile/i });
}

describe("BottomTabBar — les 4 onglets fixes", () => {
  it("affiche les 4 onglets principaux et un bouton Plus", () => {
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(within(nav()).getByRole("button", { name: /tableau de bord/i })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /^contrats$/i })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /déposer un document/i })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /revenus mensuels/i })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: /plus/i })).toBeInTheDocument();
  });

  it("un clic sur un onglet fixe appelle le callback", () => {
    const onChangerOnglet = vi.fn();
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={onChangerOnglet} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(within(nav()).getByRole("button", { name: /^contrats$/i }));
    expect(onChangerOnglet).toHaveBeenCalledWith("contrats");
  });

  it("« Plus » est marqué actif quand l'onglet courant n'est pas dans les 4 fixes", () => {
    render(<BottomTabBar ongletActif="historique" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(within(nav()).getByRole("button", { name: /plus/i })).toHaveAttribute("aria-current", "page");
  });
});

describe("BottomTabBar — la feuille « Plus »", () => {
  it("n'est pas montée par défaut", () => {
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: /autres onglets/i })).not.toBeInTheDocument();
  });

  it("s'ouvre au clic sur Plus et liste les onglets restants", () => {
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(within(nav()).getByRole("button", { name: /plus/i }));
    const feuille = screen.getByRole("navigation", { name: /autres onglets/i });
    expect(within(feuille).getByText("Mon profil")).toBeInTheDocument();
    expect(within(feuille).getByText("Historique")).toBeInTheDocument();
    expect(within(feuille).getByText("Simulateur")).toBeInTheDocument();
    expect(within(feuille).getByText("Frais pro")).toBeInTheDocument();
    expect(within(feuille).getByText("Mon dossier")).toBeInTheDocument();
    // Les 4 onglets déjà fixes ne sont pas dupliqués dans la feuille.
    expect(within(feuille).queryByText("Tableau de bord")).not.toBeInTheDocument();
  });

  it("choisir un onglet dans la feuille appelle le callback et referme la feuille", () => {
    const onChangerOnglet = vi.fn();
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={onChangerOnglet} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(within(nav()).getByRole("button", { name: /plus/i }));
    fireEvent.click(screen.getByText("Historique"));
    expect(onChangerOnglet).toHaveBeenCalledWith("historique");
    expect(screen.queryByRole("navigation", { name: /autres onglets/i })).not.toBeInTheDocument();
  });

  it("Exporter/Importer depuis la feuille appellent leurs callbacks et referment la feuille", () => {
    const onExporter = vi.fn();
    const onImporter = vi.fn();
    render(<BottomTabBar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={onExporter} onImporter={onImporter} />);
    fireEvent.click(within(nav()).getByRole("button", { name: /plus/i }));
    fireEvent.click(screen.getByText("Exporter mes données (JSON)"));
    expect(onExporter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("navigation", { name: /autres onglets/i })).not.toBeInTheDocument();
  });
});
