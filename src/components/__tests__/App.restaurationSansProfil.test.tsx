// @vitest-environment jsdom
//
// Point 23 de docs/critique_2026-08-03.md — chemin de récupération du devoir sacré n°1.
//
// AVANT : l'import n'existait que dans la barre d'actions de l'app complète, rendue APRÈS le garde
// `if (!donnees.profil) return <Onboarding/>` (App.tsx). Quelqu'un qui venait de tout perdre voyait
// « Bienvenue sur Cadence » et devait inventer un profil pour atteindre le bouton d'import. Constaté
// en conditions réelles le 03/08/2026 : quatre champs ressaisis que la sauvegarde contenait déjà.
//
// Ce test déroule le parcours ENTIER sur le vrai App : écran vierge → restaurer → confirmer →
// données présentes. Il ne teste pas une doublure, c'est le chemin de production.
//
// ⚠️ SESSION MOCKÉE CONNECTÉE DEPUIS LA CONNEXION OBLIGATOIRE (05/08/2026) : sans ce mock, le mur
// (`EcranConnexionObligatoire.tsx`) s'afficherait à la place de l'écran d'accueil (comportement par
// défaut des tests). Le parcours protégé ici ne change pas, seul l'accès préalable change.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CLE_STOCKAGE } from "../../storage/localStorageAdapter";

vi.mock("../../auth/supabaseClient", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("../../auth/supabaseClient")>();
  const auth = {
    getSession: async () => ({ data: { session: { user: { id: "u-42", email: "benoit@example.com" } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    resetPasswordForEmail: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signUp: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  };
  const source = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: async () => ({ data: [{ maj_le: "2026-08-05T09:14:02.987654+00:00" }], error: null }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ maj_le: "" }], error: null }) }) }) }),
    }),
  };
  return { ...vrai, obtenirClientAuth: () => auth, obtenirClientSourceDonnees: () => source, obtenirClientLectureDonnees: () => null };
});

// Importé APRÈS le mock, sinon il capturerait les vraies fonctions.
const { default: App } = await import("../../App");

// Sauvegarde réaliste : un profil complet + un contrat, exactement ce qu'un utilisateur récupère.
const SAUVEGARDE = JSON.stringify({
  schemaVersion: 1,
  profil: { dateNaissance: "1985-06-15", dateAnniversaire: "2027-01-17", situation: "readmission", regimeDeclare: "annexe10_pur" },
  contrats: [
    {
      id: "c1",
      dateDebut: "2026-01-05",
      date: "2026-01-05",
      type: "artiste",
      typeRemuneration: "cachet",
      territoire: "france",
      nbCachets: 3,
      salaireBrut: 1200,
      employeur: "Orchestre Récupéré",
    },
  ],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
});

function fichierSauvegarde(contenu = SAUVEGARDE) {
  const fichier = new File([contenu], "cadence-sauvegarde.json", { type: "application/json" });
  // jsdom n'implémente pas File.prototype.text() dans cette version : `confirmerImport` l'appelle.
  // Limite de l'environnement de test, pas du code applicatif — on la comble sans rien simuler d'autre.
  Object.defineProperty(fichier, "text", { value: () => Promise.resolve(contenu) });
  return fichier;
}

function selectionnerFichier(fichier: File) {
  // L'input est volontairement caché (déclenché par le bouton) : on le vise par son type, comme le
  // navigateur le ferait après le clic sur « Restaurer une sauvegarde ».
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).not.toBeNull();
  fireEvent.change(input, { target: { files: [fichier] } });
}

describe("App — restaurer une sauvegarde sans profil préalable (point 23, devoir n°1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // `confirmerImport` télécharge une sauvegarde de sécurité avant tout remplacement, via
    // URL.createObjectURL — absent de jsdom. Sans ce bouchon, l'étape (1) lèverait et l'import
    // n'aurait jamais lieu : on neutralise l'environnement, jamais la logique testée.
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: () => "blob:factice", revokeObjectURL: () => {} }));
  });

  it("l'écran d'accueil propose de restaurer une sauvegarde, avant même le formulaire", async () => {
    render(<App />);
    await screen.findByText(/Bienvenue sur Cadence/i);

    expect(screen.getByRole("button", { name: /restaurer une sauvegarde/i })).toBeInTheDocument();
    // Et l'invite précède le formulaire dans l'ordre du document : quelqu'un qui vient de tout perdre
    // doit la voir sans avoir à passer le formulaire qu'il n'a justement pas à remplir.
    const invite = screen.getByText(/déjà une sauvegarde Cadence/i);
    const premierChampFormulaire = screen.getByText(/Date de naissance/i);
    expect(invite.compareDocumentPosition(premierChampFormulaire) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("la confirmation n'annonce PAS un écrasement quand il n'y a rien à écraser", async () => {
    render(<App />);
    await screen.findByText(/Bienvenue sur Cadence/i);
    selectionnerFichier(fichierSauvegarde());

    await screen.findByRole("alertdialog");
    expect(screen.getByText(/rien ne sera écrasé/i)).toBeInTheDocument();
    // Un avertissement sans objet est un faux avertissement (devoir n°2).
    expect(screen.queryByText(/Action irréversible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/va remplacer tes données actuelles/i)).not.toBeInTheDocument();
  });

  it("restaure réellement les données, sans qu'aucun profil n'ait été saisi", async () => {
    render(<App />);
    await screen.findByText(/Bienvenue sur Cadence/i);
    selectionnerFichier(fichierSauvegarde());

    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /^restaurer$/i }));

    // L'onboarding disparaît : le profil vient du fichier, pas d'une saisie.
    await waitFor(() => expect(screen.queryByText(/Bienvenue sur Cadence/i)).not.toBeInTheDocument());
    // Et les données sont bien celles du fichier, jusque dans le stockage.
    await waitFor(() => expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain("Orchestre Récupéré"));
  });

  it("un fichier invalide est refusé sans faire disparaître l'écran d'accueil, et le dit", async () => {
    render(<App />);
    await screen.findByText(/Bienvenue sur Cadence/i);
    selectionnerFichier(fichierSauvegarde("ceci n'est pas du JSON"));

    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /^restaurer$/i }));

    // Le message d'erreur s'affiche SUR cet écran : sans lui, l'échec serait silencieux et
    // l'utilisateur croirait sa sauvegarde perdue. Message exact de `importerJSON`, et non un motif
    // large : « JSON » seul correspondrait aussi au pied de page (« export JSON ») et au libellé du
    // bouton de restauration, donc à plusieurs éléments — un test qui passerait pour la mauvaise raison.
    await screen.findByText(/n'est pas un JSON valide/i);
    expect(screen.getByText(/Bienvenue sur Cadence/i)).toBeInTheDocument();
    // Aucun état partiel écrit. Le stockage n'est pas `null` : l'app y enregistre normalement son
    // état vide au démarrage (sauvegarde automatique après un chargement réussi — sans danger, il n'y
    // avait rien à écraser). Ce qui compte est qu'un import refusé n'ait rien ajouté : pas de profil
    // à moitié créé, pas de contrat venu d'un fichier rejeté.
    const stocke = window.localStorage.getItem(CLE_STOCKAGE)!;
    expect(stocke).toContain('"profil":null');
    expect(stocke).not.toContain("Orchestre");
  });
});
