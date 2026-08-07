// @vitest-environment jsdom
//
// Les deux bandeaux « Règles vérifiées le … » (TopBar en permanence, Mon profil en détaillé) sont
// du texte pur : aucun test ne les rendait, donc rien n'empêchait une faute de frappe dans le JSX de
// passer `tsc` et d'atterrir à l'écran. Ces tests remplacent la vérification manuelle au navigateur
// pour les points 13 et 14 de docs/critique_2026-08-03.md — et contrairement à elle, ils tiennent
// dans le temps.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TopBar } from "../TopBar";
import { PiedDePage } from "../PiedDePage";
import { MonProfil } from "../MonProfil";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { formaterDateLisible } from "../../lib/dateLisible";
import { profil } from "../../engine/__tests__/testUtils";

const { dateDerniereVerification, dateEntreeVigueur, source } = franceTravailConfig.meta;
const DATE_VERIFICATION_LISIBLE = formaterDateLisible(dateDerniereVerification);

// Chaque helper rend le composant et retourne le texte de SON conteneur, pas celui de
// `document.body` : si le nettoyage entre tests venait à ne pas s'exécuter, le corps du document
// cumulerait les rendus précédents et les assertions négatives (`not.toContain`) ne prouveraient
// plus rien — elles passeraient sans rien vérifier. Lire le conteneur du rendu courant supprime
// cette dépendance.
function rendreTopBar(): string {
  const { container } = render(
    <TopBar
      onChangerOnglet={vi.fn()}
      periodeLabel="Première admission"
      ongletActif="dashboard"
      session={{ statut: "connecte", utilisateurId: "u-test", email: "test@example.com" }}
    />,
  );
  return container.textContent ?? "";
}

/** Le bandeau réglementaire vit dans `PiedDePage.tsx` depuis le 07/08/2026 (retiré de `TopBar`, qui
 * n'en a plus que le badge de cycle). */
function rendrePiedDePage(): string {
  const { container } = render(<PiedDePage />);
  return container.textContent ?? "";
}

/** `dateDuJour` est le seul levier qui fait varier le compteur de jours du bandeau détaillé. */
function rendreMonProfil(dateDuJour: string): string {
  const { container } = render(
    <MonProfil
      dateDuJour={dateDuJour}
      profil={profil({ dateAnniversaire: "2027-01-01", regimeDeclare: "annexe10_pur" })}
      onModifierProfil={vi.fn(() => ({ ok: true }) as never)}
      contrats={[]}
      periodes={[]}
      onAjouterPeriode={vi.fn()}
      onSupprimerPeriode={vi.fn()}
    />,
  );
  return container.textContent ?? "";
}

/** La date de dernière vérification décalée de `n` jours. */
function verificationPlus(n: number): string {
  const d = new Date(dateDerniereVerification);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

  it("dit la même chose dans l'écran Mon profil", () => {
    const texte = rendreMonProfil(dateDerniereVerification);
    expect(texte).toContain(`Règles vérifiées le ${DATE_VERIFICATION_LISIBLE}`);
    expect(texte).not.toContain(dateEntreeVigueur);
  });
});

describe("compteur de jours du bandeau détaillé", () => {
  it("reste muet le jour même, plutôt que d'annoncer « il y a 0 jour »", () => {
    const texte = rendreMonProfil(dateDerniereVerification);
    expect(texte).not.toContain("il y a");
  });

  it("s'accorde au singulier le lendemain", () => {
    const texte = rendreMonProfil(verificationPlus(1));
    expect(texte).toContain("il y a 1 jour)");
    expect(texte).not.toContain("il y a 1 jours");
  });

  it("s'accorde au pluriel ensuite", () => {
    const texte = rendreMonProfil(verificationPlus(10));
    expect(texte).toContain("il y a 10 jours)");
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

  it("l'écran Mon profil non plus, même longtemps après la dernière vérification", () => {
    const texte = rendreMonProfil(verificationPlus(900));
    expect(texte).not.toContain("Règles à vérifier");
    expect(texte).not.toContain("ont peut-être changé");
  });
});
