// @vitest-environment jsdom
//
// 07/08/2026 — même correctif que Onboarding.test.tsx, côté édition post-onboarding : la case "je ne
// connais pas ma date anniversaire" ne doit plus être proposée en réadmission (bloquée à la
// validation de toute façon, cf. coherenceProfil.ts), et passer en réadmission après l'avoir cochée
// en première admission ne doit jamais laisser ce choix invalide en place.
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

function rendre(profilInitial = profil({ dateAnniversaire: "" })) {
  render(
    <MonProfil
      dateDuJour="2026-08-07"
      profil={profilInitial}
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
}

describe("MonProfil — date anniversaire obligatoire en réadmission", () => {
  it("propose « je ne connais pas ma date anniversaire » en première admission", () => {
    rendre(profil({ dateAnniversaire: "", situation: "premiere_admission" }));
    expect(screen.getByLabelText(/je ne connais pas ma date anniversaire/i)).toBeInTheDocument();
  });

  it("ne propose plus cette case une fois « Réadmission » sélectionnée", () => {
    rendre(profil({ dateAnniversaire: "", situation: "premiere_admission" }));
    fireEvent.click(screen.getByRole("button", { name: "Réadmission" }));
    expect(screen.queryByLabelText(/je ne connais pas ma date anniversaire/i)).not.toBeInTheDocument();
  });

  it("passer en réadmission après avoir coché « je ne connais pas » révèle le champ de date", () => {
    rendre(profil({ dateAnniversaire: "", situation: "premiere_admission" }));
    fireEvent.click(screen.getByLabelText(/je ne connais pas ma date anniversaire/i));

    fireEvent.click(screen.getByRole("button", { name: "Réadmission" }));

    expect(screen.queryByLabelText(/je ne connais pas ma date anniversaire/i)).not.toBeInTheDocument();
    // Le champ de date est réapparu — plus aucune trace du choix "je ne connais pas".
    const dateAnniversaireEncadre = screen.getByText("Date anniversaire (fin de tes derniers droits ouverts)").closest("div")!;
    expect(dateAnniversaireEncadre.querySelector('input[type="date"]')).toBeInTheDocument();
  });
});
