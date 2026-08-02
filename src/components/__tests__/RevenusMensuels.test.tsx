// @vitest-environment jsdom
//
// Premier test de composant du projet (cf. vite.config.ts) : jsdom + Testing Library, ajoutés
// spécifiquement pour ce chantier — le bouton "Modifier" de SoldeRecap (commit 2edb88e) n'avait
// jamais été vérifié qu'à la main dans le navigateur. Reste l'exception, pas la norme : la quasi-
// totalité des tests du projet restent des fonctions pures du moteur, sans DOM.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RevenusMensuels } from "../RevenusMensuels";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { profil, contrat } from "../../engine/__tests__/testUtils";
import type { SoldeIndemnisationDepart } from "../../types";

const profilComplet = profil({
  dateAnniversaire: "2027-01-01",
  regimeDeclare: "annexe10_pur",
  ouvertureDroits: { dateOuverture: "2026-01-01", franchiseCPTotale: 10, delaiAttenteInitial: 7 },
  ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }],
});

const contrats = [
  contrat({ date: "2026-01-05", nbCachets: 2, salaireBrut: 300 }),
  contrat({ date: "2026-03-05", nbCachets: 2, salaireBrut: 300 }),
];

function rendreEcran(soldeDepart: SoldeIndemnisationDepart, onConfigurerSolde = vi.fn()) {
  render(
    <RevenusMensuels
      profil={profilComplet}
      soldeDepart={soldeDepart}
      contrats={contrats}
      periodes={[]}
      config={franceTravailConfig}
      onConfigurerSolde={onConfigurerSolde}
      onAllerVersProfil={() => {}}
      dateDuJour="2026-08-01"
    />,
  );
  return onConfigurerSolde;
}

describe("SoldeRecap — bouton Modifier (RevenusMensuels.tsx, jamais vérifié qu'à la main jusqu'ici, cf. commit 2edb88e)", () => {
  it("affiche la date de départ courante et bascule en édition au clic sur Modifier", () => {
    rendreEcran({ dateDepart: "2026-01-01" });
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    const input = screen.getByLabelText("Tableau affiché à partir de :") as HTMLInputElement;
    expect(input.value).toBe("2026-01-01");
  });

  it("Enregistrer transmet exactement la nouvelle date à onConfigurerSolde et referme l'édition", () => {
    const onConfigurerSolde = rendreEcran({ dateDepart: "2026-01-01" });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const input = screen.getByLabelText("Tableau affiché à partir de :") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-04-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onConfigurerSolde).toHaveBeenCalledTimes(1);
    expect(onConfigurerSolde).toHaveBeenCalledWith({ dateDepart: "2026-04-01" });
    // Referme l'édition (revient à l'affichage simple) — même si le parent réel (App.tsx) n'a pas
    // encore renvoyé la nouvelle prop `soldeDepart` ici, la modale d'édition elle-même se referme.
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("une fois la nouvelle date reçue en prop (comme après un vrai aller-retour App.tsx), le tableau ne montre plus les mois antérieurs", () => {
    // Les libellés de mois ("2026-01") partagent parfois leur <span> avec le badge "ESTIMATION" —
    // getByText matcherait le texte concaténé des deux. On lit donc directement le texte de chaque
    // ligne du tableau plutôt que de chercher un nœud isolé.
    function moisAffiches() {
      return screen.getAllByRole("row").map((r) => r.textContent ?? "");
    }

    const { rerender } = render(
      <RevenusMensuels
        profil={profilComplet}
        soldeDepart={{ dateDepart: "2026-01-01" }}
        contrats={contrats}
        periodes={[]}
        config={franceTravailConfig}
        onConfigurerSolde={() => {}}
        onAllerVersProfil={() => {}}
        dateDuJour="2026-08-01"
      />,
    );
    expect(moisAffiches().some((t) => t.startsWith("2026-01"))).toBe(true);
    expect(moisAffiches().some((t) => t.startsWith("2026-03"))).toBe(true);

    rerender(
      <RevenusMensuels
        profil={profilComplet}
        soldeDepart={{ dateDepart: "2026-04-01" }}
        contrats={contrats}
        periodes={[]}
        config={franceTravailConfig}
        onConfigurerSolde={() => {}}
        onAllerVersProfil={() => {}}
        dateDuJour="2026-08-01"
      />,
    );
    expect(moisAffiches().some((t) => t.startsWith("2026-01"))).toBe(false);
    expect(moisAffiches().some((t) => t.startsWith("2026-03"))).toBe(false);
    expect(moisAffiches().some((t) => t.startsWith("2026-04"))).toBe(true);
  });

  it("Annuler ne transmet rien et restaure la date affichée d'origine", () => {
    const onConfigurerSolde = rendreEcran({ dateDepart: "2026-01-01" });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const input = screen.getByLabelText("Tableau affiché à partir de :") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-07-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onConfigurerSolde).not.toHaveBeenCalled();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
  });

  it("Enregistrer reste sans effet si la date est vidée (garde-fou déjà présent, jamais une date vide transmise)", () => {
    const onConfigurerSolde = rendreEcran({ dateDepart: "2026-01-01" });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const input = screen.getByLabelText("Tableau affiché à partir de :") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onConfigurerSolde).not.toHaveBeenCalled();
  });
});
