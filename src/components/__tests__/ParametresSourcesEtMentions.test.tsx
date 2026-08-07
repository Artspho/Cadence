// @vitest-environment jsdom
//
// Onglet « Paramètres, Sources & Mentions » (étape 3 de la refonte UI, 07/08/2026) — ne fait que
// réafficher du contenu déjà vérifié ailleurs (content/perimetreEtLimites.ts,
// franceTravailConfig.meta, content/mentionsLegales.ts). Les assertions ciblent le panneau desktop
// (`nav[aria-label="Sections des paramètres"]`) pour éviter de compter deux fois le même texte, aussi
// présent dans l'accordéon mobile toujours monté en parallèle dans le DOM (cf. le même écueil déjà
// rencontré pour la nav principale/nav mobile dans le plan de la sidebar).
//
// Onglet « Mon compte » ajouté le 07/08/2026 : remonté depuis « Mon profil » (Compte.tsx), où il
// était devenu introuvable au milieu du reste — cf. cadence/CLAUDE.md. `session` est donc désormais
// une prop obligatoire (mêmes règles que Compte.tsx, résolue par le mur de connexion avant que cet
// écran ne soit monté).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ParametresSourcesEtMentions } from "../ParametresSourcesEtMentions";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { CONTACT_LEGAL } from "../../content/mentionsLegales";
import type { SessionConnectee } from "../../auth/session";

const SESSION: SessionConnectee = { statut: "connecte", utilisateurId: "u-test", email: "test@example.com" };

function panneauDesktop() {
  const nav = screen.getByRole("navigation", { name: /sections des paramètres/i });
  // Le panneau de contenu est le frère suivant de la nav, dans le même conteneur `hidden sm:block`.
  return nav.parentElement as HTMLElement;
}

describe("ParametresSourcesEtMentions — les cinq sous-sections", () => {
  it("affiche les cinq onglets", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    const nav = screen.getByRole("navigation", { name: /sections des paramètres/i });
    expect(within(nav).getByRole("button", { name: /mon compte/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /périmètre & limites/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /sources réglementaires/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /mentions légales & confidentialité/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /support & contact/i })).toBeInTheDocument();
  });

  it("le premier onglet (Mon compte) est actif par défaut, et dit que le serveur fait référence", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    const panneau = within(panneauDesktop());
    expect(panneau.getByText("test@example.com")).toBeInTheDocument();
    expect(panneau.getByText(/c'est lui qui fait référence/i)).toBeInTheDocument();
  });

  it("bascule vers « Périmètre & Limites »", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: /sections des paramètres/i })).getByRole("button", { name: /périmètre & limites/i }));
    expect(within(panneauDesktop()).getByText("Périmètre du MVP")).toBeInTheDocument();
  });

  it("bascule vers « Sources réglementaires » et affiche l'édition en vigueur", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: /sections des paramètres/i })).getByRole("button", { name: /sources réglementaires/i }));
    const panneau = within(panneauDesktop());
    expect(panneau.getByText(franceTravailConfig.meta.source)).toBeInTheDocument();
    const plafondHistorique = franceTravailConfig.are.plafondHistorique;
    const dernierPlafond = plafondHistorique[plafondHistorique.length - 1].valeur;
    expect(panneau.getAllByText(new RegExp(String(dernierPlafond))).length).toBeGreaterThan(0);
  });

  it("bascule vers « Mentions légales & Confidentialité » et réutilise le texte unique", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: /sections des paramètres/i })).getByRole("button", { name: /mentions légales & confidentialité/i }));
    expect(within(panneauDesktop()).getByText(/politique de confidentialité/i)).toBeInTheDocument();
  });

  it("bascule vers « Support & Contact » et propose un lien mailto vers l'adresse légale", () => {
    render(<ParametresSourcesEtMentions session={SESSION} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: /sections des paramètres/i })).getByRole("button", { name: /support & contact/i }));
    const lien = within(panneauDesktop()).getByRole("link", { name: new RegExp(CONTACT_LEGAL) });
    expect(lien).toHaveAttribute("href", `mailto:${CONTACT_LEGAL}`);
  });
});
