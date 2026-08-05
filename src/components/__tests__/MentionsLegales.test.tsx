// @vitest-environment jsdom
//
// Prérequis posé par Benoît le 04/08/2026, AVANT la phase 6 : mentions légales + politique de
// confidentialité minimales. Ce test verrouille les deux affirmations qui comptent le plus — celles
// que l'ancien texte de consentement (content/mentionEnvoiIA.ts) ne couvrait pas encore.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MentionsLegales } from "../MentionsLegales";
import { CONTACT_LEGAL } from "../../content/mentionsLegales";

describe("MentionsLegales", () => {
  it("cite l'adresse de contact", () => {
    render(<MentionsLegales onFermer={vi.fn()} />);
    expect(screen.getAllByText(new RegExp(CONTACT_LEGAL)).length).toBeGreaterThan(0);
  });

  it("dit que le titulaire du compte Supabase peut techniquement tout voir — la réserve du point 6, enfin levée", () => {
    render(<MentionsLegales onFermer={vi.fn()} />);
    expect(screen.getByText(/peut, techniquement, accéder à l'ensemble des données hébergées/i)).toBeInTheDocument();
  });

  it("ne prétend JAMAIS que Mistral ne garde rien — retrait demandé par Benoît, mais pas de contre-vérité à la place", () => {
    // Décision explicite de Benoît (05/08/2026, « NON NÉGOCIABLE ») : ce texte ne mentionne plus la
    // conservation de 30 jours côté Mistral (cf. l'avertissement en tête de mentionsLegales.ts). Ce
    // test ne verrouille QUE la limite absolue : ne jamais affirmer l'inverse de la réalité.
    render(<MentionsLegales onFermer={vi.fn()} />);
    expect(screen.queryByText(/rien n'est conservé/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aucune conservation/i)).not.toBeInTheDocument();
  });

  it("nomme l'association comme responsable, pas Benoît à titre personnel", () => {
    render(<MentionsLegales onFermer={vi.fn()} />);
    expect(screen.getAllByText(/Les Arts Phocéens/).length).toBeGreaterThan(0);
  });

  it("le bouton fermer appelle onFermer", () => {
    const onFermer = vi.fn();
    render(<MentionsLegales onFermer={onFermer} />);
    fireEvent.click(screen.getByRole("button", { name: /fermer/i }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});
