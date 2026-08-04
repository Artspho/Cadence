// @vitest-environment jsdom
//
// Décision de Benoît le 04/08/2026 : pas de nombre négatif en saisie manuelle. Les tests de
// lib/__tests__/saisieNombrePositif.test.ts prouvent le prédicat ; celui-ci prouve qu'un champ
// RÉEL l'applique — et surtout que la valeur négative n'atteint JAMAIS le modèle.
//
// Ce composant est choisi parce qu'il porte le cas mesuré à l'écran le 04/08/2026 : un salaire net
// imposable saisi à −5 000 € affichait « Base R = -5000.00 € » et se persistait dans
// `cadence_frais_reels_2026`. C'est aussi le champ générique réutilisé quatre fois (salaire, ARE,
// congés spectacles, IJ) : le garde vaut donc pour les quatre.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RevenuImposableForm } from "../RevenuImposableForm";
import type { RevenuImposableArtistique } from "../../../types/fraisReels";

const REVENU_VIDE: RevenuImposableArtistique = { anneeFiscale: 2026, salaireNetImposable: 0, allocationsAre: 0, congesSpectacles: 0, indemnitesJournalieres: 0 };

function rendre(revenu: RevenuImposableArtistique = REVENU_VIDE) {
  const onChangerRevenu = vi.fn();
  render(
    <RevenuImposableForm
      revenu={revenu}
      profilFiscal="artiste_exclusif"
      baseR={revenu.salaireNetImposable + revenu.allocationsAre + revenu.congesSpectacles + revenu.indemnitesJournalieres}
      plafondBaseR={145_550}
      totalAreCalcule={null}
      onChangerRevenu={onChangerRevenu}
      onChangerProfilFiscal={vi.fn()}
    />,
  );
  return onChangerRevenu;
}

describe("RevenuImposableForm — un montant négatif n'atteint jamais le modèle", () => {
  it("le cas mesuré : −5 000 € de salaire net imposable est ignoré", () => {
    const onChangerRevenu = rendre();
    fireEvent.change(screen.getByLabelText(/salaire net imposable/i), { target: { value: "-5000" } });
    expect(onChangerRevenu).not.toHaveBeenCalled();
  });

  it("les quatre champs de la base R sont gardés, pas seulement le premier", () => {
    // Ils partagent le même composant interne : ce test protège contre un garde ajouté à un seul
    // point d'appel.
    const onChangerRevenu = rendre();
    for (const libelle of [/salaire net imposable/i, /allocations ARE/i, /congés spectacles/i, /indemnités journalières/i]) {
      fireEvent.change(screen.getByLabelText(libelle), { target: { value: "-1" } });
    }
    expect(onChangerRevenu).not.toHaveBeenCalled();
  });

  it("contrôle négatif — un montant positif passe normalement", () => {
    const onChangerRevenu = rendre();
    fireEvent.change(screen.getByLabelText(/salaire net imposable/i), { target: { value: "12000.5" } });
    expect(onChangerRevenu).toHaveBeenCalledTimes(1);
    expect(onChangerRevenu.mock.calls[0][0]).toMatchObject({ salaireNetImposable: 12000.5 });
  });

  it("vider un champ déjà rempli reste possible, et le remet à 0", () => {
    // Le garde ne doit pas transformer « je corrige ma saisie » en champ bloqué.
    const onChangerRevenu = rendre({ ...REVENU_VIDE, salaireNetImposable: 12000 });
    fireEvent.change(screen.getByLabelText(/salaire net imposable/i), { target: { value: "" } });
    expect(onChangerRevenu).toHaveBeenCalledTimes(1);
    expect(onChangerRevenu.mock.calls[0][0]).toMatchObject({ salaireNetImposable: 0 });
  });

  it("zéro est accepté : c'est une valeur légitime, pas un négatif", () => {
    const onChangerRevenu = rendre({ ...REVENU_VIDE, allocationsAre: 500 });
    fireEvent.change(screen.getByLabelText(/allocations ARE/i), { target: { value: "0" } });
    expect(onChangerRevenu).toHaveBeenCalledTimes(1);
    expect(onChangerRevenu.mock.calls[0][0]).toMatchObject({ allocationsAre: 0 });
  });
});
