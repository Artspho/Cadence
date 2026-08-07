// @vitest-environment jsdom
//
// 07/08/2026 — GestionHistoriqueOuvertureDroits (idée de Benoît, cf. plan) : saisie manuelle de
// l'historique des ouvertures de droits précédentes, consommé par engine/cycles.ts pour reconstruire
// les vieux cycles avec de vraies bornes plutôt qu'une approximation calendaire. Même patron de test
// que ce que GestionAjReelle/GestionTauxPAS mériteraient (aucun test dédié n'existe pour elles à ce
// jour) — celui-ci couvre au moins le nouveau champ, ajouté/supprimé/affiché correctement.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonProfil } from "../MonProfil";
import { profil } from "../../engine/__tests__/testUtils";
import type { Profil } from "../../types";

// La section « Mon indemnisation en cours » (où vit ce composant) n'est ouverte par défaut QUE
// lorsque `profil.ouvertureDroits` est déjà renseigné (cf. MonProfil.tsx, `<details open=...>`) —
// sans lui, les champs existent dans le DOM mais restent masqués par le natif <details> fermé.
function profilAvecOuverture(partiel: Partial<Profil> = {}): Profil {
  return profil({ ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7 }, ...partiel });
}

function rendre(profilInitial: Profil, onModifierProfil = vi.fn((_p: Profil) => ({ ok: true }) as never)) {
  render(
    <MonProfil
      dateDuJour="2026-08-05"
      profil={profilInitial}
      onModifierProfil={onModifierProfil}
      contrats={[]}
      periodes={[]}
      onAjouterPeriode={vi.fn()}
      onSupprimerPeriode={vi.fn()}
    />,
  );
  return onModifierProfil;
}

describe("MonProfil — historique des ouvertures de droits précédentes", () => {
  it("sans entrée : le dit, sans planter", () => {
    rendre(profilAvecOuverture());
    expect(screen.getByText(/historique de tes ouvertures de droits précédentes/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("ajoute une entrée : appelle onModifierProfil avec le tableau mis à jour, les deux champs vidés ensuite", () => {
    const onModifierProfil = rendre(profilAvecOuverture());
    fireEvent.change(screen.getByLabelText(/^date d'ouverture$/i), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText(/^date d'échéance$/i), { target: { value: "2025-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ ajouter une ouverture de droits/i }));

    expect(onModifierProfil).toHaveBeenCalledTimes(1);
    expect(onModifierProfil.mock.calls[0][0].historiqueOuvertureDroits).toEqual([{ dateOuverture: "2025-01-01", dateEcheance: "2025-12-31" }]);
    expect((screen.getByLabelText(/^date d'ouverture$/i) as HTMLInputElement).value).toBe("");
  });

  it("le bouton reste désactivé tant que les deux dates ne sont pas remplies", () => {
    rendre(profilAvecOuverture());
    const bouton = screen.getByRole("button", { name: /\+ ajouter une ouverture de droits/i });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^date d'ouverture$/i), { target: { value: "2025-01-01" } });
    expect(bouton).toBeDisabled(); // date d'échéance encore vide
  });

  it("affiche les entrées du plus récent au moins récent, quel que soit l'ordre de stockage", () => {
    rendre(
      profilAvecOuverture({
        historiqueOuvertureDroits: [
          { dateOuverture: "2023-01-01", dateEcheance: "2023-12-31" },
          { dateOuverture: "2025-01-01", dateEcheance: "2025-12-31" },
          { dateOuverture: "2024-01-01", dateEcheance: "2024-12-31" },
        ],
      }),
    );
    const lignes = screen.getAllByRole("row").slice(1); // exclut la ligne d'en-tête
    expect(lignes.map((l) => l.textContent)).toEqual([expect.stringContaining("31/12/2025"), expect.stringContaining("31/12/2024"), expect.stringContaining("31/12/2023")]);
  });

  it("pré-remplit la date d'échéance avec dateAnniversairePrecedente quand aucun cycle n'est encore saisi (07/08/2026, toujours enchaîné)", () => {
    rendre(profilAvecOuverture({ dateAnniversairePrecedente: "2025-12-31" }));
    expect((screen.getByLabelText(/^date d'échéance$/i) as HTMLInputElement).value).toBe("2025-12-31");
  });

  it("pré-remplit la date d'échéance avec (ouverture du plus ancien cycle connu − 1 jour) quand un cycle existe déjà", () => {
    rendre(
      profilAvecOuverture({
        dateAnniversairePrecedente: "2025-12-31",
        historiqueOuvertureDroits: [{ dateOuverture: "2025-01-01", dateEcheance: "2025-12-31" }],
      }),
    );
    expect((screen.getByLabelText(/^date d'échéance$/i) as HTMLInputElement).value).toBe("2024-12-31");
  });

  it("ne pré-remplit rien sans dateAnniversairePrecedente ni historique (champ vide, pas une date inventée)", () => {
    rendre(profilAvecOuverture());
    expect((screen.getByLabelText(/^date d'échéance$/i) as HTMLInputElement).value).toBe("");
  });

  it("n'écrase pas une saisie déjà en cours dans le champ date d'échéance", () => {
    rendre(profilAvecOuverture({ dateAnniversairePrecedente: "2025-12-31" }));
    const champEcheance = screen.getByLabelText(/^date d'échéance$/i) as HTMLInputElement;
    expect(champEcheance.value).toBe("2025-12-31"); // la suggestion s'est bien posée au départ
    fireEvent.change(champEcheance, { target: { value: "2025-06-15" } });
    expect(champEcheance.value).toBe("2025-06-15"); // la saisie manuelle prime, aucune reprise de la suggestion
  });

  it("« Supprimer » retire l'entrée exacte, sans toucher aux autres", () => {
    const onModifierProfil = rendre(
      profilAvecOuverture({
        historiqueOuvertureDroits: [
          { dateOuverture: "2024-01-01", dateEcheance: "2024-12-31" },
          { dateOuverture: "2025-01-01", dateEcheance: "2025-12-31" },
        ],
      }),
    );
    const [supprimerLaPlusRecente] = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(supprimerLaPlusRecente);

    expect(onModifierProfil).toHaveBeenCalledTimes(1);
    expect(onModifierProfil.mock.calls[0][0].historiqueOuvertureDroits).toEqual([{ dateOuverture: "2024-01-01", dateEcheance: "2024-12-31" }]);
  });
});
