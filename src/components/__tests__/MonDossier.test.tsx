// @vitest-environment jsdom
//
// Phase 6, commit 3 — écran « Mon dossier ». `telechargerDepuisUrl` est mocké : il touche des API
// DOM (Blob, URL.createObjectURL) hors du périmètre de ce test, déjà couvertes par son propre usage
// ailleurs. Ici, on vérifie seulement que MonDossier l'appelle avec la bonne URL et le bon nom.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MonDossier } from "../MonDossier";
import type { ClientAuth, ClientDocuments, ClientFichiers, SessionMinimale } from "../../auth/supabaseClient";

// `telechargerBlob` et `horodatagePourNomFichier` s'ajoutent au mock depuis le regroupement du
// 06/08/2026 : le bouton « tout télécharger » les appelle. Les omettre les rendrait `undefined` et
// ferait planter le composant au clic — un faux échec qui n'apprendrait rien.
vi.mock("../../lib/telechargement", () => ({
  telechargerDepuisUrl: vi.fn(async () => undefined),
  telechargerBlob: vi.fn(() => undefined),
  horodatagePourNomFichier: vi.fn(() => "2026-08-06_0930"),
}));
import { telechargerBlob, telechargerDepuisUrl } from "../../lib/telechargement";

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

const CONNECTE = fauxClientAuth({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });

// Les mocks de module (`telechargerBlob`, `telechargerDepuisUrl`) sont PARTAGÉS entre les tests :
// sans ça, un `not.toHaveBeenCalled()` échoue à cause de l'appel d'un test précédent. `clearAllMocks`
// remet les compteurs à zéro SANS toucher aux implémentations (contrairement à `resetAllMocks`), donc
// `CONNECTE` et les faux clients continuent de répondre.
beforeEach(() => {
  vi.clearAllMocks();
});

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

/** Justificatif de frais catégorie A — sert à prouver le regroupement et les sous-groupes. */
const DOC_FRAIS_A = {
  id: "doc-2",
  type_document: "justificatif_frais",
  categorie_frais: "A",
  annee_fiscale: 2026,
  chemin_stockage: "u-42/2026/justificatif_frais/y-violon.pdf",
  nom_fichier: "violon.pdf",
  taille_octets: 4096,
  mime: "application/pdf",
  date_document: null,
  notes: null,
  cree_le: "2026-08-06T10:00:00.000Z",
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
    // La taille apparaît désormais PLUSIEURS fois (total du dossier, total du groupe, ligne) depuis
    // le regroupement du 06/08/2026 — `getAllByText` au lieu de `getByText`.
    expect(screen.getAllByText(/2,0 Ko/).length).toBeGreaterThan(0);
  });

  it("dit qu'il n'y a rien quand la liste est vide", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([])} clientFichiers={fauxClientFichiers()} />);
    expect(await screen.findByText(/aucun document pour l'instant/i)).toBeInTheDocument();
  });

  it("le téléchargement demande une URL signée puis appelle telechargerDepuisUrl avec le nom d'origine", async () => {
    const fichiers = fauxClientFichiers();
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments()} clientFichiers={fichiers} />);
    // Nom EXACT : « Tout télécharger » (groupe et dossier entier) matcherait aussi /télécharger/i.
    fireEvent.click(await screen.findByRole("button", { name: "Télécharger" }));
    await waitFor(() => expect(fichiers.createSignedUrl).toHaveBeenCalledWith("u-42/2026/aem_bulletin/x-bulletin.pdf", 60));
    await waitFor(() => expect(telechargerDepuisUrl).toHaveBeenCalledWith("bulletin.pdf", "https://exemple/signee"));
  });

  it("corriger le type RECLASSE le document dans le groupe du nouveau type", async () => {
    const documents = fauxClientDocuments();
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={documents} clientFichiers={fauxClientFichiers()} />);
    const select = (await screen.findByLabelText(/type de « bulletin\.pdf/i)) as HTMLSelectElement;
    expect(select.value).toBe("aem_bulletin");
    await act(async () => {
      fireEvent.change(select, { target: { value: "attestation_cpam" } });
    });

    // ⚠️ IL FAUT RE-INTERROGER LE DOM : depuis le regroupement du 06/08/2026, changer le type déplace
    // le document dans un AUTRE groupe — l'ancien élément est démonté, la référence `select` capturée
    // plus haut est détachée et garderait éternellement son ancienne valeur. C'est le comportement
    // voulu (corriger un type reclasse la pièce), pas un bug à contourner.
    await waitFor(() => {
      const apres = screen.getByLabelText(/type de « bulletin\.pdf/i) as HTMLSelectElement;
      expect(apres.value).toBe("attestation_cpam");
    });
    // Et le groupe affiché est bien celui du nouveau type. L'en-tête de groupe est un BOUTON
    // repliable — le cibler par son rôle évite de confondre avec les <option> du sélecteur, qui
    // portent aussi le mot « Attestation ».
    expect(screen.getByRole("button", { name: /Attestation CPAM/ })).toBeInTheDocument();
  });
});

describe("MonDossier — regroupement et téléchargement groupé (06/08/2026)", () => {
  it("regroupe par type, et par catégorie sous les justificatifs de frais", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_A, DOC_FRAIS_A])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    // Le sous-groupe porte le libellé complet de la catégorie A.
    expect(screen.getByText(/A — Instruments/)).toBeInTheDocument();
    // Et le total du dossier est annoncé.
    expect(screen.getByText(/2 documents .* au total/)).toBeInTheDocument();
  });

  it("compte et pèse chaque groupe — c'est ce que Benoît veut voir d'un coup d'œil", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_FRAIS_A])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    expect(screen.getAllByText(/1 document · 4,0 Ko/).length).toBeGreaterThan(0);
  });

  it("replier un groupe cache ses documents sans les faire disparaître du total", async () => {
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_FRAIS_A])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    const entete = screen.getByRole("button", { expanded: true });
    fireEvent.click(entete);
    expect(screen.queryByText("violon.pdf")).not.toBeInTheDocument();
    // Le total du dossier reste affiché : replier n'est pas supprimer.
    expect(screen.getByText(/1 document .* au total/)).toBeInTheDocument();
  });

  it("« tout télécharger » construit une archive et la remet à l'utilisateur", async () => {
    const fichiers = fauxClientFichiers();
    // `fetch` est appelé par `construireArchive` pour récupérer chaque contenu.
    const fauxFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("x").buffer }));
    vi.stubGlobal("fetch", fauxFetch);

    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_A, DOC_FRAIS_A])} clientFichiers={fichiers} />);
    await screen.findByText("violon.pdf");
    fireEvent.click(screen.getByRole("button", { name: /tout télécharger \(dossier entier\)/i }));

    await waitFor(() => expect(telechargerBlob).toHaveBeenCalled());
    // `.at(-1)` n'est pas dans la cible TypeScript de ce projet (< es2022) — index explicite.
    const appels = vi.mocked(telechargerBlob).mock.calls;
    const [nomFichier] = appels[appels.length - 1];
    expect(nomFichier).toBe("cadence-dossier-2026-08-06_0930.zip");
    // Les deux documents ont été récupérés.
    expect(fauxFetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("AVERTIT AVANT de lancer une grosse archive, et n'écrit rien tant qu'on n'a pas reconfirmé", async () => {
    // 90 Mo : au-delà du seuil mesuré de 75 Mo (banc d'essai du 06/08/2026).
    const GROS = { ...DOC_FRAIS_A, taille_octets: 90 * 1024 * 1024 };
    const fauxFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("x").buffer }));
    vi.stubGlobal("fetch", fauxFetch);

    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([GROS])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    fireEvent.click(screen.getByRole("button", { name: /tout télécharger \(dossier entier\)/i }));

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/l'onglet peut se fermer/i);
    expect(alerte).toHaveTextContent(/catégorie par catégorie/i);
    // RIEN n'a été lancé : c'est un avertissement, pas un compte rendu d'après-coup.
    expect(fauxFetch).not.toHaveBeenCalled();
    expect(telechargerBlob).not.toHaveBeenCalled();

    // Second clic : on passe outre. L'avertissement informe, il n'interdit pas.
    fireEvent.click(screen.getByRole("button", { name: /télécharger quand même/i }));
    await waitFor(() => expect(telechargerBlob).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it("« Annuler » referme l'avertissement sans rien télécharger", async () => {
    const GROS = { ...DOC_FRAIS_A, taille_octets: 90 * 1024 * 1024 };
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([GROS])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    fireEvent.click(screen.getByRole("button", { name: /tout télécharger \(dossier entier\)/i }));
    fireEvent.click(await screen.findByRole("button", { name: /annuler/i }));
    expect(screen.queryByText(/l'onglet peut se fermer/i)).not.toBeInTheDocument();
    expect(telechargerBlob).not.toHaveBeenCalled();
  });

  it("n'avertit PAS sur un dossier ordinaire — pas de friction inutile", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("x").buffer })));
    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_A, DOC_FRAIS_A])} clientFichiers={fauxClientFichiers()} />);
    await screen.findByText("violon.pdf");
    fireEvent.click(screen.getByRole("button", { name: /tout télécharger \(dossier entier\)/i }));
    // Aucune confirmation : ça part directement.
    await waitFor(() => expect(telechargerBlob).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it("NOMME LES FICHIERS MANQUANTS quand l'archive est incomplète — jamais un succès muet", async () => {
    const fichiers = fauxClientFichiers();
    fichiers.createSignedUrl = vi.fn(async () => ({ data: null, error: { message: "objet introuvable" } }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("x").buffer })));

    render(<MonDossier clientAuth={CONNECTE} clientDocuments={fauxClientDocuments([DOC_FRAIS_A])} clientFichiers={fichiers} />);
    await screen.findByText("violon.pdf");
    fireEvent.click(screen.getByRole("button", { name: /tout télécharger \(dossier entier\)/i }));

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/INCOMPLÈTE/);
    expect(alerte).toHaveTextContent("violon.pdf");
    expect(alerte).toHaveTextContent(/objet introuvable/);
    // Et surtout : dire que rien n'est perdu.
    expect(alerte).toHaveTextContent(/toujours dans Cadence/i);
    vi.unstubAllGlobals();
  });
});
