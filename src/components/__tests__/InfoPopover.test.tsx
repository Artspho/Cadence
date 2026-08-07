// @vitest-environment jsdom
//
// Info-bulle « (i) » (refonte UI, 07/08/2026) : survol desktop, tap mobile (les deux passent par un
// clic dans jsdom), fermeture au clic extérieur, lien « En savoir plus » vers l'onglet Paramètres.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InfoPopover } from "../InfoPopover";

describe("InfoPopover", () => {
  it("le contenu est fermé par défaut", () => {
    render(
      <InfoPopover titre="Test" onEnSavoirPlus={vi.fn()}>
        Contenu détaillé
      </InfoPopover>,
    );
    expect(screen.queryByText("Contenu détaillé")).not.toBeInTheDocument();
  });

  it("s'ouvre au survol (desktop)", () => {
    render(
      <InfoPopover titre="Test" onEnSavoirPlus={vi.fn()}>
        Contenu détaillé
      </InfoPopover>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: /en savoir plus : test/i }).parentElement!);
    expect(screen.getByText("Contenu détaillé")).toBeInTheDocument();
  });

  it("s'ouvre et se ferme au clic (tap mobile)", () => {
    render(
      <InfoPopover titre="Test" onEnSavoirPlus={vi.fn()}>
        Contenu détaillé
      </InfoPopover>,
    );
    const bouton = screen.getByRole("button", { name: /en savoir plus : test/i });
    fireEvent.click(bouton);
    expect(screen.getByText("Contenu détaillé")).toBeInTheDocument();
    fireEvent.click(bouton);
    expect(screen.queryByText("Contenu détaillé")).not.toBeInTheDocument();
  });

  it("se ferme au clic extérieur", () => {
    render(
      <div>
        <InfoPopover titre="Test" onEnSavoirPlus={vi.fn()}>
          Contenu détaillé
        </InfoPopover>
        <button type="button">Ailleurs</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /en savoir plus : test/i }));
    expect(screen.getByText("Contenu détaillé")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ailleurs" }));
    expect(screen.queryByText("Contenu détaillé")).not.toBeInTheDocument();
  });

  it("« En savoir plus » appelle le callback de navigation", () => {
    const onEnSavoirPlus = vi.fn();
    render(
      <InfoPopover titre="Test" onEnSavoirPlus={onEnSavoirPlus}>
        Contenu détaillé
      </InfoPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: /en savoir plus : test/i }));
    fireEvent.click(screen.getByRole("button", { name: /en savoir plus →/i }));
    expect(onEnSavoirPlus).toHaveBeenCalledTimes(1);
  });
});
