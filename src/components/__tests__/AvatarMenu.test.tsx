// @vitest-environment jsdom
//
// L'avatar du header (07/08/2026 — refonte UI) : initiale dérivée de l'e-mail de la session, menu
// Headless UI ne portant pour l'instant que « Se déconnecter » (cf. le commentaire d'en-tête
// d'AvatarMenu.tsx sur pourquoi le mot de passe n'y est pas).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AvatarMenu } from "../AvatarMenu";
import type { ClientAuth } from "../../auth/supabaseClient";
import type { SessionConnectee } from "../../auth/session";

// jsdom ne fournit pas ResizeObserver, que Headless UI utilise en interne pour suivre la position
// du panneau ouvert — sans ce polyfill minimal, l'ouverture du menu lève dans jsdom (jamais dans un
// vrai navigateur, qui l'implémente nativement).
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverPolyfill);

function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

const SESSION_AVEC_EMAIL: SessionConnectee = { statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" };
const SESSION_SANS_EMAIL: SessionConnectee = { statut: "connecte", utilisateurId: "u-42", email: null };

describe("AvatarMenu — l'avatar", () => {
  it("affiche l'initiale majuscule de l'e-mail", () => {
    render(<AvatarMenu session={SESSION_AVEC_EMAIL} client={fauxClient()} onChangerOnglet={vi.fn()} />);
    expect(screen.getByRole("button", { name: /menu du compte/i })).toHaveTextContent("B");
  });

  it("rend un caractère générique plutôt qu'une lettre inventée quand l'e-mail est absent", () => {
    render(<AvatarMenu session={SESSION_SANS_EMAIL} client={fauxClient()} onChangerOnglet={vi.fn()} />);
    expect(screen.getByRole("button", { name: /menu du compte/i })).toHaveTextContent("?");
  });
});

describe("AvatarMenu — le menu", () => {
  it("affiche l'adresse, l'accès aux paramètres et l'action de déconnexion une fois ouvert", async () => {
    render(<AvatarMenu session={SESSION_AVEC_EMAIL} client={fauxClient()} onChangerOnglet={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /menu du compte/i }));
    expect(await screen.findByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /paramètres/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /se déconnecter/i })).toBeInTheDocument();
  });

  it("« Paramètres » bascule sur l'onglet correspondant", async () => {
    const onChangerOnglet = vi.fn();
    render(<AvatarMenu session={SESSION_AVEC_EMAIL} client={fauxClient()} onChangerOnglet={onChangerOnglet} />);
    fireEvent.click(screen.getByRole("button", { name: /menu du compte/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /paramètres/i }));
    expect(onChangerOnglet).toHaveBeenCalledWith("parametres");
  });

  it("« Se déconnecter » appelle bien signOut", async () => {
    const client = fauxClient();
    render(<AvatarMenu session={SESSION_AVEC_EMAIL} client={client} onChangerOnglet={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /menu du compte/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /se déconnecter/i }));
    await waitFor(() => expect(client.signOut).toHaveBeenCalledTimes(1));
  });

  it("affiche l'échec d'une déconnexion au lieu de faire comme si elle avait eu lieu", async () => {
    const client = fauxClient({ signOut: vi.fn(async () => ({ error: { message: "network error" } })) });
    render(<AvatarMenu session={SESSION_AVEC_EMAIL} client={client} onChangerOnglet={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /menu du compte/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /se déconnecter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("network error");
  });
});
