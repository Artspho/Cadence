// @vitest-environment jsdom
//
// 07/08/2026 — une réadmission sans date anniversaire connue est bloquée à la validation
// (validerCoherenceProfil), mais jusqu'ici la case "je ne sais pas ma date anniversaire" restait
// cochable en réadmission, menant droit à une impasse (bouton "Commencer" désactivé sans qu'on sache
// pourquoi tant qu'on ne lit pas le message d'erreur). Ce fichier verrouille le correctif : la case
// disparaît en réadmission plutôt que de mener à cette impasse, et passer en réadmission après avoir
// coché "je ne sais pas" en première admission ne laisse jamais ce choix invalide en place.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Onboarding } from "../Onboarding";

describe("Onboarding — date anniversaire obligatoire en réadmission", () => {
  it("propose « je ne sais pas ma date anniversaire » en première admission (cas sain)", () => {
    render(<Onboarding onTerminer={vi.fn()} />);
    expect(screen.getByLabelText(/je ne connais pas encore ma date anniversaire/i)).toBeInTheDocument();
  });

  it("ne propose plus cette case une fois « Réadmission » sélectionnée", () => {
    render(<Onboarding onTerminer={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Réadmission" }));
    expect(screen.queryByLabelText(/je ne connais pas encore ma date anniversaire/i)).not.toBeInTheDocument();
    // Le champ de date reste donc affiché, jamais une impasse cachée derrière une case retirée.
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });

  it("passer en réadmission après avoir coché « je ne sais pas » en première admission révèle le champ de date plutôt que de rester bloqué", () => {
    render(<Onboarding onTerminer={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/je ne connais pas encore ma date anniversaire/i));

    fireEvent.click(screen.getByRole("button", { name: "Réadmission" }));

    // La case a disparu ET le champ de date est réapparu — plus aucune trace du choix "je ne sais pas".
    expect(screen.queryByLabelText(/je ne connais pas encore ma date anniversaire/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fenêtre glissante de 365 j/i)).not.toBeInTheDocument();
  });
});

// 07/08/2026 — lien de commodité vers France Travail (demande de Benoît) : pas d'import IA en direct
// à ce stade (aucun profil, aucune session encore), juste de quoi retrouver la notification papier
// sans quitter l'app. Même URL, même garde-fou FranceConnect (vrai nouvel onglet, jamais une iframe)
// que OuvrirEspacePersonnelFT.tsx, dont ce lien réutilise directement la fonction.
describe("Onboarding — lien de commodité vers France Travail", () => {
  it("ouvre les courriers France Travail dans un nouvel onglet, sans lien retour vers window.opener", () => {
    const ouvrirMock = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Onboarding onTerminer={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /retrouve-la dans tes courriers france travail/i }));

    expect(ouvrirMock).toHaveBeenCalledWith("https://candidat.francetravail.fr/mescourriers/", "_blank", "noopener,noreferrer");
    ouvrirMock.mockRestore();
  });
});
