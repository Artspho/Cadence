// @vitest-environment jsdom
//
// Sidebar rétractable desktop (étape 6 de la refonte UI, 07/08/2026) : repliée par défaut (icônes
// identifiées par leur `aria-label`, pas de texte visible), s'ouvre au survol ou au focus clavier,
// épinglage persisté dans localStorage sous une clé UI distincte des données métier.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

const CLE = "cadence:ui:sidebarEpinglee";

function nav() {
  return screen.getByRole("navigation", { name: /navigation principale/i });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Sidebar — repliée par défaut", () => {
  it("porte le nom accessible de chaque onglet même sans texte visible", () => {
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(within(nav()).getByRole("button", { name: "Contrats" })).toBeInTheDocument();
    expect(within(nav()).queryByText("Contrats")).not.toBeInTheDocument();
  });

  it("s'ouvre au survol : le texte devient visible", () => {
    const { container } = render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.mouseEnter(container.querySelector("aside")!);
    expect(within(nav()).getByText("Contrats")).toBeInTheDocument();
  });

  it("s'ouvre au focus clavier, pas seulement au survol", () => {
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.focus(within(nav()).getByRole("button", { name: "Contrats" }));
    expect(within(nav()).getByText("Contrats")).toBeInTheDocument();
  });
});

describe("Sidebar — navigation", () => {
  it("un clic sur un onglet appelle le callback avec le bon id", () => {
    const onChangerOnglet = vi.fn();
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={onChangerOnglet} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(within(nav()).getByRole("button", { name: "Revenus mensuels" }));
    expect(onChangerOnglet).toHaveBeenCalledWith("revenus");
  });

  it("l'onglet actif porte aria-current=page", () => {
    render(<Sidebar ongletActif="contrats" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(within(nav()).getByRole("button", { name: "Contrats" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("button", { name: "Mon profil" })).not.toHaveAttribute("aria-current");
  });
});

describe("Sidebar — export/import", () => {
  it("les boutons du bas appellent leurs callbacks respectifs", () => {
    const onExporter = vi.fn();
    const onImporter = vi.fn();
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={onExporter} onImporter={onImporter} />);
    fireEvent.click(screen.getByRole("button", { name: "Exporter mes données (JSON)" }));
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    expect(onExporter).toHaveBeenCalledTimes(1);
    expect(onImporter).toHaveBeenCalledTimes(1);
  });
});

describe("Sidebar — épinglage persisté", () => {
  it("épingler garde la sidebar ouverte même sans survol, et persiste dans localStorage", () => {
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /épingler/i }));
    expect(within(nav()).getByText("Contrats")).toBeInTheDocument();
    expect(window.localStorage.getItem(CLE)).toBe("1");
  });

  it("respecte une préférence déjà épinglée au montage", () => {
    window.localStorage.setItem(CLE, "1");
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    expect(within(nav()).getByText("Contrats")).toBeInTheDocument();
  });

  it("ne mélange jamais sa clé de préférence avec les données métier", () => {
    render(<Sidebar ongletActif="dashboard" onChangerOnglet={vi.fn()} onExporter={vi.fn()} onImporter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /épingler/i }));
    expect(window.localStorage.getItem("cadence:v1:donnees")).toBeNull();
  });
});
