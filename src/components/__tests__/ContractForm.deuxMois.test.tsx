// @vitest-environment jsdom
//
// Point 7 de docs/critique_2026-08-03.md — porte de saisie manuelle. Les tests de
// lib/__tests__/contratUnSeulMois.test.ts prouvent la DÉCISION ; celui-ci prouve que le formulaire
// l'applique réellement : bouton désactivé, message affiché, et `onValider` jamais appelé. Sans ce
// dernier point, un formulaire pourrait afficher l'avertissement tout en enregistrant quand même.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContractForm } from "../ContractForm";
import { calculerDecompteHeures } from "../../engine/decompteHeures";
import { franceTravailConfig as config } from "../../config/franceTravailConfig";
import { profil } from "../../engine/__tests__/testUtils";

const p = profil({ dateAnniversaire: "2026-12-31" });
const decompteVide = calculerDecompteHeures([], [], p, config, { dateDebut: "2026-01-01", dateFin: "2026-12-31" });

function rendre() {
  const onValider = vi.fn();
  render(<ContractForm profil={p} config={config} decompteActuel={decompteVide} onValider={onValider} />);
  return onValider;
}

// Les deux champs de date, repérés par leur libellé accessible plutôt que par un ordre de rendu.
function saisirDates(debut: string, fin: string) {
  // La date de FIN d'abord : la changer recale automatiquement la date de début (changerDateFin),
  // ce qui écraserait la valeur qu'on vient de saisir si on faisait l'inverse.
  fireEvent.change(screen.getByLabelText(/date de fin/i), { target: { value: fin } });
  fireEvent.change(screen.getByLabelText(/date de début/i), { target: { value: debut } });
}

describe("ContractForm — un contrat ne peut pas couvrir deux mois civils (point 7)", () => {
  it("un contrat du 20/02 au 10/03 : message affiché et bouton désactivé", () => {
    rendre();
    saisirDates("2026-02-20", "2026-03-10");

    expect(screen.getByText(/s'étend sur deux mois/i)).toBeInTheDocument();
    expect(screen.getByText(/deux contrats séparés/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer le contrat/i })).toBeDisabled();
  });

  it("la soumission est refusée même en contournant le bouton désactivé, donc sans message en double", () => {
    // Deux garanties d'un seul coup.
    // 1. Un bouton `disabled` ne protège pas d'une soumission déclenchée autrement (touche Entrée dans
    //    un champ, script). Le handler doit refuser de lui-même — sinon le garde visuel est une illusion.
    // 2. `onValider` non appelé signifie que le garde d'App.tsx (ajouterContrat / modifierContrat) ne
    //    s'exécute pas, donc que le bandeau ambre global ne s'affiche PAS pour un refus venu du
    //    formulaire : l'utilisateur voit le message inline seul, jamais deux fois le même. Le bandeau
    //    reste réservé aux portes qui n'ont pas de message à elles (import de bulletin, revue IA).
    //    L'édition depuis ContractList passe aussi par ce formulaire, elle est donc couverte ici.
    const onValider = rendre();
    saisirDates("2026-02-20", "2026-03-10");

    fireEvent.submit(screen.getByRole("button", { name: /enregistrer le contrat/i }).closest("form")!);
    expect(onValider).not.toHaveBeenCalled();
  });

  it("contrôle négatif — un contrat contenu dans un seul mois n'affiche rien et s'enregistre", () => {
    const onValider = rendre();
    saisirDates("2026-03-01", "2026-03-31");

    expect(screen.queryByText(/s'étend sur deux mois/i)).not.toBeInTheDocument();
    const bouton = screen.getByRole("button", { name: /enregistrer le contrat/i });
    expect(bouton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/employeur/i), { target: { value: "Orchestre X" } });
    fireEvent.submit(bouton.closest("form")!);
    expect(onValider).toHaveBeenCalledTimes(1);
    expect(onValider.mock.calls[0][0]).toMatchObject({ dateDebut: "2026-03-01", date: "2026-03-31" });
  });
});
