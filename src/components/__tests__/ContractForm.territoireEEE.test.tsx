// @vitest-environment jsdom
//
// Point 17 de docs/critique_2026-08-03.md — porte de saisie manuelle. Les tests de
// lib/__tests__/contratTerritoireEEE.test.ts prouvent la DÉCISION ; celui-ci prouve que le formulaire
// l'applique réellement : message affiché, bouton désactivé, `onValider` jamais appelé, et surtout
// qu'un contrat EEE enregistré ne part JAMAIS avec des cachets que le décompte ignorerait.
// Même dispositif que ContractForm.deuxMois.test.tsx.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContractForm } from "../ContractForm";
import { calculerDecompteHeures } from "../../engine/decompteHeures";
import { franceTravailConfig as config } from "../../config/franceTravailConfig";
import { profil } from "../../engine/__tests__/testUtils";
import { MESSAGE_EEE_SANS_JOURS } from "../../lib/contratTerritoireEEE";

const p = profil({ dateAnniversaire: "2026-12-31" });
const decompteVide = calculerDecompteHeures([], [], p, config, { dateDebut: "2026-01-01", dateFin: "2026-12-31" });

function rendre() {
  const onValider = vi.fn();
  render(<ContractForm profil={p} config={config} decompteActuel={decompteVide} onValider={onValider} />);
  return onValider;
}

const bouton = () => screen.getByRole("button", { name: /enregistrer le contrat/i });
const basculerEnEEE = () => fireEvent.click(screen.getByRole("button", { name: /EEE \/ Suisse \/ UK/i }));

describe("ContractForm — un contrat EEE doit porter des jours travaillés (point 17)", () => {
  it("territoire EEE, champ jours vide : message affiché et bouton désactivé", () => {
    rendre();
    basculerEnEEE();

    // Le message affiché est bien celui de la règle, mot pour mot — et il dit quoi faire. Comparé au
    // constant plutôt qu'à un fragment : « nombre de jours travaillés » désigne aussi le libellé du
    // champ juste au-dessus, un fragment ne prouverait donc pas que le message est là.
    expect(screen.getByText(/ne compterait aucune heure/i)).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_EEE_SANS_JOURS)).toBeInTheDocument();
    expect(bouton()).toBeDisabled();
  });

  it("la soumission est refusée même en contournant le bouton désactivé", () => {
    // Un bouton `disabled` ne protège pas d'une soumission déclenchée autrement (touche Entrée,
    // script) : le handler doit refuser de lui-même, sinon le garde visuel est une illusion.
    const onValider = rendre();
    basculerEnEEE();

    fireEvent.submit(bouton().closest("form")!);
    expect(onValider).not.toHaveBeenCalled();
  });

  it("0 jour explicite est refusé comme un champ vide", () => {
    const onValider = rendre();
    basculerEnEEE();
    fireEvent.change(screen.getByLabelText(/nombre de jours travaillés/i), { target: { value: "0" } });

    expect(screen.getByText(/ne compterait aucune heure/i)).toBeInTheDocument();
    fireEvent.submit(bouton().closest("form")!);
    expect(onValider).not.toHaveBeenCalled();
  });

  it("contrôle négatif — dès que des jours sont saisis, le message disparaît et le contrat s'enregistre", () => {
    const onValider = rendre();
    basculerEnEEE();
    fireEvent.change(screen.getByLabelText(/nombre de jours travaillés/i), { target: { value: "10" } });

    expect(screen.queryByText(/ne compterait aucune heure/i)).not.toBeInTheDocument();
    expect(bouton()).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/employeur/i), { target: { value: "Royal Opera House" } });
    fireEvent.submit(bouton().closest("form")!);
    expect(onValider).toHaveBeenCalledTimes(1);
    expect(onValider.mock.calls[0][0]).toMatchObject({ territoire: "eee_suisse_uk", nbJoursEEE: 10 });
  });
});

describe("ContractForm — des cachets saisis avant la bascule en EEE ne sont jamais enregistrés", () => {
  it("avertit que les cachets ne seront pas enregistrés, et ne les enregistre effectivement pas", () => {
    // Le scénario complet du défaut secondaire : l'utilisateur saisit 12 cachets, puis bascule le
    // territoire sur EEE. Le champ des cachets n'est plus affiché — sans avertissement, il ne saurait
    // pas que cette valeur est écartée ; et sans le nettoyage du contrat, le moteur l'ignorerait en
    // silence (engine/decompteHeures.ts ne lit que nbJoursEEE en EEE).
    const onValider = rendre();
    fireEvent.change(screen.getByLabelText(/nombre de cachets/i), { target: { value: "12" } });
    basculerEnEEE();

    expect(screen.getByText(/ne comptent pas en territoire EEE/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nombre de jours travaillés/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/employeur/i), { target: { value: "Royal Opera House" } });
    fireEvent.submit(bouton().closest("form")!);

    expect(onValider).toHaveBeenCalledTimes(1);
    expect(onValider.mock.calls[0][0]).toMatchObject({ territoire: "eee_suisse_uk", nbJoursEEE: 10 });
    expect(onValider.mock.calls[0][0].nbCachets).toBeUndefined();
    expect(onValider.mock.calls[0][0].nbHeures).toBeUndefined();
  });

  it("revenir en territoire France restitue les cachets saisis : rien n'est perdu en cours de route", () => {
    // Le nettoyage porte sur le contrat ENREGISTRÉ, pas sur le formulaire. Une bascule par erreur ne
    // doit pas effacer une saisie (devoir n°1) — c'est pour ça que les états ne sont pas vidés.
    const onValider = rendre();
    fireEvent.change(screen.getByLabelText(/nombre de cachets/i), { target: { value: "12" } });
    basculerEnEEE();
    fireEvent.click(screen.getByRole("button", { name: /^France$/i }));

    expect(screen.getByLabelText(/nombre de cachets/i)).toHaveValue(12);
    expect(screen.queryByText(/ne comptent pas en territoire EEE/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/employeur/i), { target: { value: "Orchestre X" } });
    fireEvent.submit(bouton().closest("form")!);
    expect(onValider.mock.calls[0][0]).toMatchObject({ territoire: "france", nbCachets: 12 });
    expect(onValider.mock.calls[0][0].nbJoursEEE).toBeUndefined();
  });
});
