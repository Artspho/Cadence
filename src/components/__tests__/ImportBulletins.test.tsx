// @vitest-environment jsdom
//
// Phase 6, commit 4 — canal LOCAL. `extraireBulletin` (pdfjs, lecture réelle de PDF) est mocké : ce
// test porte sur le branchement du stockage, pas sur l'extraction elle-même (déjà testée ailleurs).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportBulletins } from "../ImportBulletins";
import { profil } from "../../engine/__tests__/testUtils";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { ClientAuth, ClientDocuments, ClientFichiers, SessionMinimale } from "../../auth/supabaseClient";
import type { BulletinExtrait, DecompteHeuresResultat } from "../../types";

vi.mock("../../lib/extractionBulletin", () => ({
  extraireBulletin: vi.fn(),
}));
import { extraireBulletin } from "../../lib/extractionBulletin";

const EXTRAIT: BulletinExtrait = {
  champs: { dateDebut: "2026-03-15", type: "artiste", employeur: "Test" },
  confiance: { employeur: "haute" },
  texteBrut: "brut",
  avertissements: [],
};

const DECOMPTE: DecompteHeuresResultat = {
  total: 0,
  repartition: { cachets: 0, heuresScene: 0, eee: 0, assimilees: 0, ptp: 0, enseignementRetenu: 0, enseignementExcedentaire: 0, formationRetenue: 0, formationExcedentaire: 0 },
  plafondEnseignementApplicable: 70,
  cachetsParMois: {},
};

const SESSION: SessionMinimale = { user: { id: "u-42", email: "benoit@example.com" }, access_token: "jeton-test" };

function fauxClientAuth(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FauxAppelable = (...args: any[]) => any;

function fauxClientDocuments(
  insert: FauxAppelable = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentsExistants: Record<string, any>[] = [],
): ClientDocuments {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => ({ data: documentsExistants, error: null })) })) })),
      insert,
      update: vi.fn(),
    })),
  } as unknown as ClientDocuments;
}

function fauxClientFichiers(upload: FauxAppelable = vi.fn(async () => ({ data: { path: "x" }, error: null }))): ClientFichiers {
  return { upload, remove: vi.fn(), createSignedUrl: vi.fn() } as unknown as ClientFichiers;
}

function rendre(props: { clientAuth?: ClientAuth | null; clientDocuments?: ClientDocuments | null; clientFichiers?: ClientFichiers | null } = {}) {
  return render(
    <ImportBulletins
      profil={profil()}
      config={franceTravailConfig}
      decompteActuel={DECOMPTE}
      onImporterContrat={vi.fn()}
      clientAuth={props.clientAuth ?? fauxClientAuth()}
      clientDocuments={props.clientDocuments ?? fauxClientDocuments()}
      clientFichiers={props.clientFichiers ?? fauxClientFichiers()}
    />,
  );
}

function deposerFichier() {
  const fichier = new File(["contenu"], "bulletin.pdf", { type: "application/pdf" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [fichier] } });
}

describe("ImportBulletins — sans session", () => {
  it("garde la promesse « ne quitte jamais ton appareil », et va direct à la revue sans modale", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    rendre();
    expect(screen.getByText(/ne quitte jamais ton appareil/i)).toBeInTheDocument();
    deposerFichier();
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("ImportBulletins — connecté", () => {
  const CONNECTE = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });

  it("annonce la conservation possible, pas l'absolu « ne quitte jamais »", async () => {
    rendre({ clientAuth: CONNECTE });
    expect(await screen.findByText(/tu peux ensuite choisir de conserver/i)).toBeInTheDocument();
    expect(screen.queryByText(/ne quitte jamais ton appareil/i)).not.toBeInTheDocument();
  });

  it("ouvre la modale de consentement AVANT la revue", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    rendre({ clientAuth: CONNECTE });
    await screen.findByText(/tu peux ensuite choisir de conserver/i); // attend que la session soit "connecte"
    deposerFichier();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByText(/revue avant enregistrement/i)).not.toBeInTheDocument();
  });

  it("« Conserver sur le serveur » appelle l'upload avec le type aem_bulletin, puis affiche la revue sans erreur", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type_document: "aem_bulletin", annee_fiscale: 2026 }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("« Non, continuer sans l'envoyer » affiche la revue directement, sans appeler l'upload", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const upload = vi.fn();
    rendre({ clientAuth: CONNECTE, clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /non, continuer sans l'envoyer/i }));
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("un échec de conservation N'EMPÊCHE PAS la revue, et le dit sans alarmer plus que nécessaire", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const upload = vi.fn(async () => ({ data: null, error: { message: "quota dépassé" } }));
    rendre({ clientAuth: CONNECTE, clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/quota dépassé/);
  });
});

describe("ImportBulletins — doublon détecté (même nom, même taille, déjà dans Mon dossier)", () => {
  const CONNECTE = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
  // "bulletin.pdf" déposé par `deposerFichier()` a le contenu ["contenu"] → 7 octets.
  const DOUBLON_EXISTANT = [
    { id: "doc-ancien", type_document: "aem_bulletin", chemin_stockage: "u-42/2026/aem_bulletin/x-bulletin.pdf", nom_fichier: "bulletin.pdf", taille_octets: 7, mime: "application/pdf", cree_le: "2026-08-01T10:00:00.000Z" },
  ];

  it("« Conserver sur le serveur » sur un doublon affiche l'avertissement au lieu de déposer directement", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert, DOUBLON_EXISTANT), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    expect(await screen.findByText(/semble déjà dans « Mon dossier »/i)).toBeInTheDocument();
    expect(screen.getByText(/01\/08\/2026/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("« Conserver quand même » dépose malgré l'avertissement", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert, DOUBLON_EXISTANT), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    fireEvent.click(await screen.findByRole("button", { name: /conserver quand même/i }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
  });

  it("« Ne pas le conserver à nouveau » passe à la revue sans jamais appeler l'upload", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const upload = vi.fn();
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(undefined, DOUBLON_EXISTANT), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    fireEvent.click(await screen.findByRole("button", { name: /ne pas le conserver à nouveau/i }));
    expect(await screen.findByText(/revue avant enregistrement/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("un fichier de nom ou de taille différents n'est jamais signalé comme doublon", async () => {
    vi.mocked(extraireBulletin).mockResolvedValue(EXTRAIT);
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    const autreDocument = [{ ...DOUBLON_EXISTANT[0], nom_fichier: "autre.pdf" }];
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert, autreDocument), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByText(/tu peux ensuite choisir de conserver/i);
    deposerFichier();
    fireEvent.click(await screen.findByRole("button", { name: /conserver sur le serveur/i }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(screen.queryByText(/semble déjà dans « Mon dossier »/i)).not.toBeInTheDocument();
  });
});
