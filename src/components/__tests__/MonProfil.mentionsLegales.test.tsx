// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonProfil } from "../MonProfil";
import { profil } from "../../engine/__tests__/testUtils";

describe("MonProfil — lien mentions légales & confidentialité", () => {
  it("ouvre la modale au clic, et le bouton fermer la referme", () => {
    render(
      <MonProfil
        dateDuJour="2026-08-05"
        profil={profil()}
        onModifierProfil={vi.fn(() => ({ ok: true }) as never)}
        contrats={[]}
        periodes={[]}
        onAjouterPeriode={vi.fn()}
        onSupprimerPeriode={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mentions légales/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fermer/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
