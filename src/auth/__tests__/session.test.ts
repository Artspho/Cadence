// @vitest-environment jsdom
//
// Test du hook `useSession` lui-même, ISOLÉ de tout composant qui le consomme.
//
// POURQUOI CE FICHIER EXISTE MAINTENANT : jusqu'au 05/08/2026 (connexion obligatoire), ce hook
// était appelé à DEUX endroits (`App.tsx` et `Compte.tsx`), et son cycle de vie (abonnement,
// notification, désabonnement) n'était vérifié qu'à travers le rendu de `Compte.tsx`. Depuis la
// simplification de `Compte.tsx` (qui reçoit désormais sa session déjà résolue en prop, cf. son
// commentaire d'en-tête), `App.tsx` est le SEUL appelant restant — et ce fichier reprend la
// couverture du hook qui vivait jusque-là dans `Compte.test.tsx`, indépendamment de quel composant
// l'utilise.
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSession } from "../session";
import type { ClientAuth, SessionMinimale } from "../supabaseClient";

const SESSION: SessionMinimale = { user: { id: "u-42", email: "benoit@example.com" }, access_token: "jeton-test" };

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

describe("useSession — configuration absente", () => {
  it("vaut nonConfigure DÈS LE PREMIER RENDU, sans appeler le client", () => {
    const client = fauxClient();
    const { result } = renderHook(() => useSession(null));
    expect(result.current).toEqual({ statut: "nonConfigure" });
    expect(client.getSession).not.toHaveBeenCalled();
    expect(client.onAuthStateChange).not.toHaveBeenCalled();
  });
});

describe("useSession — résolution initiale", () => {
  it("vaut chargement au premier rendu, puis connecte quand getSession rend une session", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    const { result } = renderHook(() => useSession(client));
    expect(result.current).toEqual({ statut: "chargement" });
    await waitFor(() => expect(result.current).toEqual({ statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" }));
  });

  it("vaut deconnecte quand getSession ne rend aucune session", async () => {
    const client = fauxClient();
    const { result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "deconnecte" }));
  });

  it("vaut indetermine sur une erreur — jamais 'deconnecte' par défaut", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: null }, error: { message: "Failed to fetch" } })) });
    const { result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "indetermine", detail: "Failed to fetch" }));
  });

  it("traite un rejet de la promesse comme une ignorance, pas comme une déconnexion", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => Promise.reject(new Error("boom"))) });
    const { result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "indetermine", detail: "boom" }));
  });
});

describe("useSession — cycle de vie de l'abonnement", () => {
  it("passe à connecte sur notification de l'écouteur (retour d'un lien reçu par e-mail)", async () => {
    let notifier: ((evenement: string, session: SessionMinimale | null) => void) | null = null;
    const client = fauxClient({
      onAuthStateChange: vi.fn((rappel) => {
        notifier = rappel;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    });
    const { result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "deconnecte" }));

    act(() => notifier?.("SIGNED_IN", SESSION));
    expect(result.current).toEqual({ statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" });
  });

  it("passe à deconnecte sur notification de déconnexion", async () => {
    let notifier: ((evenement: string, session: SessionMinimale | null) => void) | null = null;
    const client = fauxClient({
      getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
      onAuthStateChange: vi.fn((rappel) => {
        notifier = rappel;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    });
    const { result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" }));

    act(() => notifier?.("SIGNED_OUT", null));
    expect(result.current).toEqual({ statut: "deconnecte" });
  });

  it("se désabonne au démontage", async () => {
    const unsubscribe = vi.fn();
    const client = fauxClient({ onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })) });
    const { unmount, result } = renderHook(() => useSession(client));
    await waitFor(() => expect(result.current).toEqual({ statut: "deconnecte" }));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
