// @vitest-environment jsdom
//
// Le bandeau « Règles vérifiées le … » est du texte pur : aucun test ne le rendait, donc rien
// n'empêchait une faute de frappe dans le JSX de passer `tsc` et d'atterrir à l'écran. Ces tests
// remplacent la vérification manuelle au navigateur pour les points 13 et 14 de
// docs/critique_2026-08-03.md — et contrairement à elle, ils tiennent dans le temps.
//
// 08/08/2026 (demande de Benoît) : le bandeau détaillé de « Mon profil » (avec compteur de jours) a
// été retiré — il faisait doublon avec celui, plus discret, du pied de page (PiedDePage.tsx), rendu
// une seule fois par App.tsx et donc déjà visible sur tous les écrans, Mon profil compris. Les tests
// qui portaient sur cette version détaillée (rendreMonProfil, compteur de jours) ont disparu avec
// elle plutôt que d'être adaptés à du code qui n'existe plus.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TopBar } from "../TopBar";
import { PiedDePage } from "../PiedDePage";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { formaterDateLisible } from "../../lib/dateLisible";

const { dateDerniereVerification, dateEntreeVigueur, source } = franceTravailConfig.meta;
const DATE_VERIFICATION_LISIBLE = formaterDateLisible(dateDerniereVerification);

// Chaque helper rend le composant et retourne le texte de SON conteneur, pas celui de
// `document.body` : si le nettoyage entre tests venait à ne pas s'exécuter, le corps du document
// cumulerait les rendus précédents et les assertions négatives (`not.toContain`) ne prouveraient
// plus rien — elles passeraient sans rien vérifier. Lire le conteneur du rendu courant supprime
// cette dépendance.
function rendreTopBar(): string {
  const { container } = render(<TopBar onChangerOnglet={vi.fn()} session={{ statut: "connecte", utilisateurId: "u-test", email: "test@example.com" }} />);
  return container.textContent ?? "";
}

/** Le bandeau réglementaire vit dans `PiedDePage.tsx` depuis le 07/08/2026 (retiré de `TopBar`, qui
 * n'a plus que l'avatar mobile depuis que le badge de cycle a lui aussi déménagé, dans l'onglet
 * Historique). */
function rendrePiedDePage(): string {
  const { container } = render(<PiedDePage />);
  return container.textContent ?? "";
}

describe("bandeau des règles — ce qu'il affiche (point 14)", () => {
  it("nomme la date comme une date de VÉRIFICATION, et l'écrit en français lisible", () => {
    const texte = rendrePiedDePage();
    expect(texte).toContain(`Règles vérifiées le ${DATE_VERIFICATION_LISIBLE}`);
  });

  it("cite l'édition du guide réellement utilisée", () => {
    const texte = rendrePiedDePage();
    expect(texte).toContain(source);
    expect(texte).toContain("juillet 2026");
    // L'édition qui était citée à tort jusqu'au 03/08/2026.
    expect(texte).not.toContain("mars 2026");
  });

  // Le cœur du point 14 : cette date-là datait l'entrée en vigueur du SMIC, et s'affichait pourtant
  // derrière le libellé « Règles vérifiées au ». Elle ne doit plus apparaître du tout.
  it("n'affiche jamais l'entrée en vigueur du SMIC, ni aucune date en format machine", () => {
    const texte = rendrePiedDePage();
    expect(texte).not.toContain(dateEntreeVigueur);
    expect(texte).not.toContain(dateDerniereVerification);
  });
});

// Point 13 : la bannière ne pouvait jamais s'allumer, elle a été supprimée. Ces deux tests échouent
// si quelqu'un la réintroduit — c'est leur seule raison d'être.
describe("plus aucune bannière de péremption (point 13)", () => {
  it("la barre du haut ne porte plus d'avertissement de péremption", () => {
    const texte = rendreTopBar();
    expect(texte).not.toContain("Règles à vérifier");
    expect(texte).not.toContain("⚠");
  });

  it("le pied de page non plus", () => {
    const texte = rendrePiedDePage();
    expect(texte).not.toContain("Règles à vérifier");
    expect(texte).not.toContain("⚠");
  });
});
