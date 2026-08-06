// @vitest-environment jsdom
//
// Test de RÉGRESSION du devoir sacré n°1 (critique du 03/08/2026, point 🔴 n°1).
//
// Avant le correctif, ce fichier échouait : `chargerDonnees` renvoyait l'état vide quand le contenu
// stocké était illisible, `App` le plaçait dans son état, et l'effet de sauvegarde — dont la seule
// garde était un `useRef` déjà passé à `true` — réécrivait aussitôt cet état vide PAR-DESSUS le
// contenu d'origine. Aucun clic de l'utilisateur n'était nécessaire : le simple rendu suffisait.
//
// Ce que ce test verrouille : après rendu, la clé de stockage contient TOUJOURS, octet pour octet,
// ce qu'elle contenait avant. Si un jour quelqu'un rebranche une écriture sur ce chemin, il casse
// ici — et c'est exactement le but.
//
// ⚠️ SESSION MOCKÉE CONNECTÉE DEPUIS LA CONNEXION OBLIGATOIRE (05/08/2026) : sans ce mock, le mur
// (`EcranConnexionObligatoire.tsx`) s'afficherait à la place de tout le reste (comportement par
// défaut des tests, `.env.test` ne configurant pas Supabase) et cet écran de récupération ne serait
// jamais atteint. Le comportement protégé ici (devoir n°1) ne change pas, seul l'accès préalable
// change — même patron que `App.bascule.test.tsx`.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

// Un JSON parfaitement valide et RÉCUPÉRABLE à la main — c'est tout l'enjeu : le contenu n'est pas
// une bouillie, c'est un profil réel dont un seul champ (`type` de contrat) ne passe plus le schéma.
// Exactement le scénario le plus probable : une évolution du schéma qui rend illisible l'existant.
const DONNEES_RECUPERABLES = JSON.stringify({
  profil: { dateNaissance: "1985-06-15", dateAnniversaire: "2027-01-17", situation: "readmission" },
  contrats: [
    { id: "c1", dateDebut: "2026-01-05", date: "2026-01-05", type: "type_inconnu_ajoute_par_une_version_future", typeRemuneration: "cachet", territoire: "france", nbCachets: 3, salaireBrut: 1200, employeur: "Orchestre X" },
  ],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
});

describe("App — contenu stocké illisible (devoir sacré n°1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("NE RÉÉCRIT JAMAIS par-dessus : la clé contient encore le texte original après rendu", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES_RECUPERABLES);

    render(<App />);
    // Attendre que le chargement asynchrone ait produit son rendu — c'est précisément à cet instant
    // que l'ancien code déclenchait l'écriture destructrice.
    await screen.findByText(/données.*(illisibles|pas pu être lues)/i);

    expect(window.localStorage.getItem(CLE_STOCKAGE)).toBe(DONNEES_RECUPERABLES);
  });

  it("affiche un écran bloquant, pas l'interface normale à vide", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES_RECUPERABLES);

    render(<App />);
    await screen.findByText(/données.*(illisibles|pas pu être lues)/i);

    // Aucune trace de l'app normale : ni navigation, ni tableau de bord — sans quoi l'utilisateur
    // croirait avoir tout perdu et commencerait à ressaisir par-dessus.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("met le texte brut à disposition pour le sauvegarder à la main", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES_RECUPERABLES);

    render(<App />);
    await screen.findByText(/données.*(illisibles|pas pu être lues)/i);

    // Le contenu intégral doit être copiable depuis l'écran (zone de texte), pas seulement résumé.
    const zone = screen.getByLabelText(/contenu brut/i);
    expect(zone).toHaveValue(DONNEES_RECUPERABLES);
  });

  it("« repartir de zéro » reste désactivé tant que l'utilisateur n'a pas confirmé avoir mis ses données à l'abri", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, DONNEES_RECUPERABLES);

    render(<App />);
    await screen.findByText(/données.*(illisibles|pas pu être lues)/i);

    expect(screen.getByRole("button", { name: /repartir de zéro/i })).toBeDisabled();
    // …et la clé n'a toujours pas bougé.
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toBe(DONNEES_RECUPERABLES);
  });

  it("un stockage vide (vrai nouvel utilisateur) n'affiche PAS l'écran d'erreur", async () => {
    render(<App />);

    await waitFor(() => expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/données.*(illisibles|pas pu être lues)/i)).not.toBeInTheDocument();
  });
});
