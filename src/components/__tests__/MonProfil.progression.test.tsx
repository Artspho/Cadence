// @vitest-environment jsdom
//
// 08/08/2026, demande de Benoît : un gestionnaire de tâches en tête de « Mon profil », pour qu'un
// nouvel utilisateur comprenne que cette page doit être remplie en premier — sans ça, rien ne
// distingue « je n'ai encore rien rempli » de « tout est optionnel ». Affiné le même jour : les
// catégories « Mon indemnisation » et « Taux de prélèvement » ne comptent QUE si des droits sont déjà
// ouverts (impossible de les remplir avant), et la carte se masque entièrement une fois tout complété.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MonProfil } from "../MonProfil";
import { profil } from "../../engine/__tests__/testUtils";
import type { DecompteHeuresResultat, Profil } from "../../types";

const DECOMPTE: DecompteHeuresResultat = {
  total: 0,
  repartition: { cachets: 0, heuresScene: 0, eee: 0, assimilees: 0, ptp: 0, enseignementRetenu: 0, enseignementExcedentaire: 0, formationRetenue: 0, formationExcedentaire: 0 },
  plafondEnseignementApplicable: 70,
  cachetsParMois: {},
};

function rendre(profilInitial: Profil) {
  render(
    <MonProfil
      dateDuJour="2026-08-08"
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

/** `null` si la carte est masquée (tout complété) — jamais une exception, pour que les tests de
 *  masquage restent lisibles (`expect(carteProgression()).toBeNull()`). */
function carteProgression() {
  const titre = screen.queryByRole("heading", { name: /informations à compléter/i });
  return titre ? titre.closest("section") : null;
}

describe("MonProfil — gestionnaire de tâches « Informations à compléter »", () => {
  it("masquée sur un profil fraîchement onboardé sans droits ouverts (identité + régime déjà répondus par l'onboarding)", () => {
    rendre(profil());
    expect(carteProgression()).toBeNull();
  });

  it("affichée à 1/2 si la date anniversaire n'est pas renseignée (sans droits ouverts, seules « Ton profil » et « Régime déclaré » comptent)", () => {
    rendre(profil({ dateAnniversaire: "" }));
    const carte = carteProgression()!;
    expect(within(carte).getByText(/^1\/2 complété$/)).toBeInTheDocument();
    expect(within(carte).queryByText("Mon indemnisation en cours")).not.toBeInTheDocument();
    expect(within(carte).queryByText("Taux de prélèvement à la source")).not.toBeInTheDocument();
  });

  it("passe à 4 catégories dès que des droits sont ouverts, même sans taux renseigné", () => {
    rendre(profil({ ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 12, delaiAttenteInitial: 7 } }));
    const carte = carteProgression()!;
    // Ton profil ✓, Mon indemnisation ✓ (droits ouverts), Taux ✗, Régime ✓ (par défaut annexe10_pur) : 3/4.
    expect(within(carte).getByText(/^3\/4 complétés$/)).toBeInTheDocument();
    expect(within(carte).getByText("Mon indemnisation en cours")).toBeInTheDocument();
    expect(within(carte).getByText("Taux de prélèvement à la source")).toBeInTheDocument();
  });

  it("masquée une fois indemnisation, taux et régime mixte tous complétés", () => {
    rendre(
      profil({
        regimeDeclare: "mixte",
        salairesHorsAnnexe10PRA: 0,
        ouvertureDroits: {
          dateOuverture: "2026-01-18",
          franchiseCPTotale: 12,
          delaiAttenteInitial: 7,
          tauxPrelevementSourceHistorique: [{ dateEffet: "2026-01-18", valeur: 3.1 }],
        },
      }),
    );
    expect(carteProgression()).toBeNull();
  });

  it("le lien « Taux de prélèvement » renvoie vers sa propre section une fois des droits ouverts", () => {
    rendre(profil({ ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 12, delaiAttenteInitial: 7 } }));
    const lien = within(carteProgression()!).getByRole("link", { name: /taux de prélèvement à la source/i });
    expect(lien).toHaveAttribute("href", "#section-taux-pas");
  });

  it("liste les tâches facultatives (périodes particulières, historique) avec leur mention « seulement si »", () => {
    rendre(profil({ dateAnniversaire: "" }));
    const carte = carteProgression()!;
    expect(within(carte).getByRole("link", { name: /périodes particulières/i })).toHaveAttribute("href", "#section-periodes-particulieres");
    expect(within(carte).getByText(/uniquement si concerné/i)).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: /historique de tes ouvertures de droits précédentes/i })).toHaveAttribute("href", "#section-mon-indemnisation");
    expect(within(carte).getByText(/seulement si tu veux reconstituer/i)).toBeInTheDocument();
  });
});

describe("MonProfil — pastille de complétion sur chaque section", () => {
  it("« Ton profil » porte sa propre coche, cohérente avec le compteur du haut", () => {
    rendre(profil({ dateAnniversaire: "" }));
    const section = screen.getByRole("heading", { name: /^ton profil$/i }).closest("section")!;
    expect(within(section).getByTitle("À compléter")).toBeInTheDocument();
  });

  it("« Mon indemnisation en cours » passe à « Complété » une fois des droits ouverts", () => {
    rendre(profil({ ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 12, delaiAttenteInitial: 7 } }));
    // Le libellé apparaît deux fois une fois des droits ouverts : dans le résumé de la section
    // elle-même, et comme lien dans le checklist du haut — on cible ici précisément le <summary>.
    const resume = screen.getAllByText("Mon indemnisation en cours").map((el) => el.closest("summary")).find((el) => el !== null)!;
    expect(within(resume).getByTitle("Complété")).toBeInTheDocument();
  });
});
