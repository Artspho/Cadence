// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonProfil } from "../MonProfil";
import { profil } from "../../engine/__tests__/testUtils";
import type { DecompteHeuresResultat } from "../../types";

const DECOMPTE: DecompteHeuresResultat = {
  total: 0,
  repartition: { cachets: 0, heuresScene: 0, eee: 0, assimilees: 0, ptp: 0, enseignementRetenu: 0, enseignementExcedentaire: 0, formationRetenue: 0, formationExcedentaire: 0 },
  plafondEnseignementApplicable: 70,
  cachetsParMois: {},
};

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
        decompteActuel={DECOMPTE}
        onAjouterContrat={vi.fn()}
        onModifierContrat={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mentions légales/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fermer/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
