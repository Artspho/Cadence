// @vitest-environment jsdom
//
// Tiroir d'alertes (étape 5 de la refonte UI, 07/08/2026) : wrapper de positionnement autour
// d'AlertCenter.tsx, plus le dédoublonnage avec le bandeau de contradiction hérité de l'ancien
// affichage en ligne (lib/alertesAffichage.ts), désormais nécessaire sur tout onglet où ce bandeau
// est visible puisque le tiroir, lui, s'ouvre depuis n'importe lequel.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TiroirAlertes } from "../TiroirAlertes";
import type { Alerte } from "../../types";

const ALERTE: Alerte = { code: "rythme_insuffisant", niveau: "critique", titre: "Rythme insuffisant", message: "Détail de l'alerte." };

describe("TiroirAlertes", () => {
  it("ne rend rien quand fermé", () => {
    render(<TiroirAlertes ouvert={false} onFermer={vi.fn()} alertes={[ALERTE]} masqueeParBandeauContradiction={false} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("affiche les alertes fournies quand ouvert", () => {
    render(<TiroirAlertes ouvert onFermer={vi.fn()} alertes={[ALERTE]} masqueeParBandeauContradiction={false} />);
    expect(screen.getByText("Rythme insuffisant")).toBeInTheDocument();
    expect(screen.getByText("Détail de l'alerte.")).toBeInTheDocument();
  });

  it("« Aucune alerte » quand la liste est vide et non masquée par un bandeau", () => {
    render(<TiroirAlertes ouvert onFermer={vi.fn()} alertes={[]} masqueeParBandeauContradiction={false} />);
    expect(screen.getByText(/aucune alerte pour l'instant/i)).toBeInTheDocument();
  });

  it("ne dit jamais « aucune alerte » quand la seule alerte est déjà sur le bandeau de l'onglet", () => {
    // Le cas que ce booléen existe pour éviter : un faux feu vert juste à côté d'un bandeau critique.
    render(<TiroirAlertes ouvert onFermer={vi.fn()} alertes={[]} masqueeParBandeauContradiction />);
    expect(screen.queryByText(/aucune alerte pour l'instant/i)).not.toBeInTheDocument();
    expect(screen.getByText(/déjà affichée en haut de cet onglet/i)).toBeInTheDocument();
  });

  it("le bouton de fermeture appelle onFermer", () => {
    const onFermer = vi.fn();
    render(<TiroirAlertes ouvert onFermer={onFermer} alertes={[ALERTE]} masqueeParBandeauContradiction={false} />);
    fireEvent.click(screen.getByRole("button", { name: /fermer le tiroir d'alertes/i }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it("se ferme au clic extérieur", () => {
    const onFermer = vi.fn();
    render(
      <div>
        <button type="button">Ailleurs</button>
        <TiroirAlertes ouvert onFermer={onFermer} alertes={[ALERTE]} masqueeParBandeauContradiction={false} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ailleurs" }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it("se ferme sur Échap", () => {
    const onFermer = vi.fn();
    render(<TiroirAlertes ouvert onFermer={onFermer} alertes={[ALERTE]} masqueeParBandeauContradiction={false} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
