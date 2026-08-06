// @vitest-environment jsdom
//
// Phase 6, commit 3 — écran « Mon dossier ». `telechargerDepuisUrl` est mocké : il touche des API
// DOM (Blob, URL.createObjectURL) hors du périmètre de ce test, déjà couvertes par son propre usage
// ailleurs. Ici, on vérifie seulement que MonDossier l'appelle avec la bonne URL et le bon nom.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MonDossier } from "../MonDossier";
import type { ClientAuth, ClientDocuments, ClientFichiers, SessionMinimale } from "../../auth/supabaseClient";

vi.mock("../../lib/telechargement", () => ({
  telechargerDepuisUrl: vi.fn(async () => undefined),
}));
import { telechargerDepuisUrl } from "../../lib/telechargement";

const SESSION: SessionMinimale = { user: { id: "u-42", email: "benoit@example.com" } };

function fauxClientAuth(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

const CONNECTE = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });

const DOC_A = {
  id: "doc-1",
  type_document: "aem_bulletin",
  categorie_frais: null,
  annee_fiscale: 2026,
  chemin_stockage: "u-42/2026/aem_bulletin/x-bulletin.pdf",
  nom_fichier: "bulletin.pdf",
  taille_octets: 2048,
  mime: "application/pdf",
  date_document: null,
  notes: null,
  cree_le: "2026-08-05T10:00:00.000Z",
};

function fauxClientDocuments(lignes: Record<string, unknown>[] = [DOC_A]): ClientDocuments {
  const order = vi.fn(async () => ({ data: lignes, error: null }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
  return { from: vi.fn(() => ({ select, insert: vi.fn(), update })) } as unknown as ClientDocuments;
}

function fauxClientFichiers(): ClientFichiers {
  return {
    upload: vi.fn(async () => ({ data: { path: "x" }, error: null })),
    remove: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://exemple/signee" }, error: null })),
  };
}

describe("MonDossier — sans session", () => {
  it("dit qu'il faut se connecter, sans planter", async () => {
    render(<MonDossier clientAuth={fauxClientAuth()} clientDocuments={fauxClientDocuments()} clientFichiers={fauxClientFichiers()} />);
    expect(await screen.findByText(/connecte-toi/i)).toBeInTheDocument();
  });

  it("configuration absente : le dit sans planter", () => {
    render(<MonDossier clientAuth={null} clientDocuments={null} clientFichiers={null} />);
    expect(screen.getByText(/n'est pas configurée/i)).toBeInTheDocument();
  });

  it("état indéterminé : dit qu'il ne SAIT pas, jamais « non connecté »", async () => {
    const client = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: null }, error: { message: "Failed to fetch" } })) });
    render(<MonDossier clientAuth={client} clientDocuments={fauxClientDocuments()} clientFichiers={fauxClientFichiers()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Impossible de savoir si tu es connecté/i);
  });
});

describe("MonDossier — connecté", () => {
  it("liste les documents avec nom, date et taille", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments()} clientFichiers={fauxClientFichiers()} />);
    expect(await screen.findByText("bulletin.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2,0 Ko/)).toBeInTheDocument();
  });

  it("dit qu'il n'y a rien quand la liste est vide", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([])} clientFichiers={fauxClientFichiers()} />);
    expect(await screen.findByText(/aucun document pour l'instant/i)).toBeInTheDocument();
  });

  it("le téléchargement demande une URL signée puis appelle telechargerDepuisUrl avec le nom d'origine", async () => {
    const fichiers = fauxClientFichiers();
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments()} clientFichiers={fichiers} />);
    fireEvent.click(await screen.findByRole("button", { name: /télécharger/i }));
    await waitFor(() => expect(fichiers.createSignedUrl).toHaveBeenCalledWith("u-42/2026/aem_bulletin/x-bulletin.pdf", 60));
    await waitFor(() => expect(telechargerDepuisUrl).toHaveBeenCalledWith("bulletin.pdf", "https://exemple/signee"));
  });

  it("corriger le type appelle updateType et reflète le nouveau type dans le sélecteur", async () => {
    const documents = fauxClientDocuments();
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={documents} clientFichiers={fauxClientFichiers()} />);
    const select = (await screen.findByLabelText(/type de « bulletin\.pdf/i)) as HTMLSelectElement;
    expect(select.value).toBe("aem_bulletin");
    await act(async () => {
      fireEvent.change(select, { target: { value: "attestation_cpam" } });
    });
    await waitFor(() => expect(select.value).toBe("attestation_cpam"));
  });
});
