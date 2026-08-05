// @vitest-environment jsdom
//
// Phase 6, commit 5 — canal IA. `extraireDocumentIA` et `lirePdfEnBase64` sont mockés : ce test
// porte sur le branchement du stockage après une extraction réussie, pas sur l'extraction elle-même
// (réseau réel, déjà hors périmètre des tests unitaires ailleurs dans le projet).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportDocumentIA } from "../ImportDocumentIA";
import { profil } from "../../engine/__tests__/testUtils";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { ClientAuth, ClientDocuments, ClientFichiers, SessionMinimale } from "../../auth/supabaseClient";
import type { DecompteHeuresResultat } from "../../types";
import type { ExtractionResult } from "../../types/extraction";

vi.mock("../../lib/extraireDocumentIA", () => ({ extraireDocumentIA: vi.fn() }));
import { extraireDocumentIA } from "../../lib/extraireDocumentIA";

vi.mock("../../lib/fichierImportIA", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../../lib/fichierImportIA")>();
  return { ...reel, lirePdfEnBase64: vi.fn(async () => "base64==") };
});

const DECOMPTE: DecompteHeuresResultat = {
  total: 0,
  repartition: { cachets: 0, heuresScene: 0, eee: 0, assimilees: 0, ptp: 0, enseignementRetenu: 0, enseignementExcedentaire: 0, formationRetenue: 0, formationExcedentaire: 0 },
  plafondEnseignementApplicable: 70,
  cachetsParMois: {},
};

function resultatAvec(typeDocumentDetecte: ExtractionResult["typeDocumentDetecte"]): ExtractionResult {
  return { typeDocumentDetecte, propositions: [], avertissementsGeneraux: [] };
}

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
    ...reponses,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FauxAppelable = (...args: any[]) => any;

function fauxClientDocuments(insert: FauxAppelable = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }))): ClientDocuments {
  return { from: vi.fn(() => ({ select: vi.fn(), insert, update: vi.fn() })) } as unknown as ClientDocuments;
}

function fauxClientFichiers(upload: FauxAppelable = vi.fn(async () => ({ data: { path: "x" }, error: null }))): ClientFichiers {
  return { upload, remove: vi.fn(), createSignedUrl: vi.fn() } as unknown as ClientFichiers;
}

function rendre(props: { clientAuth?: ClientAuth | null; clientDocuments?: ClientDocuments | null; clientFichiers?: ClientFichiers | null } = {}) {
  return render(
    <ImportDocumentIA
      profil={profil()}
      config={franceTravailConfig}
      decompteActuel={DECOMPTE}
      contrats={[]}
      onAjouterContrat={vi.fn()}
      onAjouterPeriode={vi.fn()}
      onModifierProfil={vi.fn(() => ({ ok: true }) as never)}
      onModifierContrat={vi.fn()}
      clientAuth={props.clientAuth ?? fauxClientAuth()}
      clientDocuments={props.clientDocuments ?? fauxClientDocuments()}
      clientFichiers={props.clientFichiers ?? fauxClientFichiers()}
    />,
  );
}

async function deposerEtConfirmer() {
  // Laisse `useSession` résoudre sa promesse (getSession, PUIS son .then) AVANT d'agir : sans ce
  // flush, le dépôt peut survenir alors que la session est encore "chargement", et le test devient
  // flaky selon l'ordre d'exécution. Un `setTimeout(0)` franchit la frontière macrotâche : toutes
  // les micro-tâches déjà en file (la promesse ET son .then) ont fini de s'exécuter avant qu'il ne
  // se déclenche — un simple `act(async () => {})` n'attend qu'un seul palier, insuffisant ici.
  async function flush() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  await flush();
  const fichier = new File(["contenu"], "notification.pdf", { type: "application/pdf" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [fichier] } });
  fireEvent.click(await screen.findByRole("button", { name: /envoyer ce document/i }));
  // Deuxième flush, APRÈS le clic : `envoyer()` enchaîne plusieurs `await` (lecture base64,
  // extraction, éventuel dépôt) — sans ce palier, une assertion synchrone juste après le clic
  // verrait un état intermédiaire, pas le résultat final.
  await flush();
}

const CONNECTE = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });

describe("ImportDocumentIA — sans session", () => {
  it("n'appelle jamais l'upload : affiche la revue directement", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("notification_admission"));
    const upload = vi.fn();
    rendre({ clientFichiers: fauxClientFichiers(upload) });
    await deposerEtConfirmer();
    expect(await screen.findByText(/propositions issues de ton document/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("ImportDocumentIA — connecté, type reconnu", () => {
  it("dépose le document avec le type_document traduit, sans modale supplémentaire", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("notification_admission"));
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert), clientFichiers: fauxClientFichiers(upload) });
    await screen.findByRole("heading", { name: /importer avec l'ia/i });
    await deposerEtConfirmer();
    expect(await screen.findByText(/propositions issues de ton document/i)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type_document: "notification_are" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un échec de conservation n'empêche pas la revue, et le dit", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("releve_situation"));
    const upload = vi.fn(async () => ({ data: null, error: { message: "quota dépassé" } }));
    rendre({ clientAuth: CONNECTE, clientFichiers: fauxClientFichiers(upload) });
    await deposerEtConfirmer();
    expect(await screen.findByText(/propositions issues de ton document/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/quota dépassé/);
  });
});

describe("ImportDocumentIA — connecté, document non reconnu", () => {
  it("ouvre le sélecteur AVANT la revue, jamais un type deviné automatiquement", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("non_reconnu"));
    const upload = vi.fn();
    rendre({ clientAuth: CONNECTE, clientFichiers: fauxClientFichiers(upload) });
    await deposerEtConfirmer();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByText(/propositions issues de ton document/i)).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("« Conserver sur le serveur » dépose avec le type choisi", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("non_reconnu"));
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
    rendre({ clientAuth: CONNECTE, clientDocuments: fauxClientDocuments(insert), clientFichiers: fauxClientFichiers(upload) });
    await deposerEtConfirmer();
    await screen.findByRole("alertdialog");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "planning_travail" } });
    fireEvent.click(screen.getByRole("button", { name: /conserver sur le serveur/i }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type_document: "planning_travail" }));
    expect(await screen.findByText(/propositions issues de ton document/i)).toBeInTheDocument();
  });

  it("« Ne pas conserver » affiche la revue sans jamais appeler l'upload", async () => {
    vi.mocked(extraireDocumentIA).mockResolvedValue(resultatAvec("non_reconnu"));
    const upload = vi.fn();
    rendre({ clientAuth: CONNECTE, clientFichiers: fauxClientFichiers(upload) });
    await deposerEtConfirmer();
    fireEvent.click(await screen.findByRole("button", { name: /ne pas conserver/i }));
    expect(await screen.findByText(/propositions issues de ton document/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});
