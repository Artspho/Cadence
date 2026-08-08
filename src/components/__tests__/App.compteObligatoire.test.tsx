// @vitest-environment jsdom
//
// LE GARDIEN DE LA CONNEXION OBLIGATOIRE (05/08/2026), qui REMPLACE `App.sansCompte.test.tsx` —
// « le gardien de la promesse de la phase 2 » — dont la promesse vérifiée était l'exact inverse
// (« l'app s'ouvre et fonctionne SANS compte »). Cette promesse a été explicitement retirée par
// Benoît, en dehors du plan de la phase 6 : Cadence exige désormais un compte pour être utilisée,
// sans exception.
//
// Ce fichier rend le VRAI `App`, avec un faux client Supabase piloté par le test (même patron que
// `App.bascule.test.tsx`), et vérifie que RIEN de l'application n'est accessible avant une session
// connectée — puis qu'une fois connectée, elle redevient entièrement accessible, exactement comme
// avant ce chantier.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { CLE_STOCKAGE } from "../../storage/localStorageAdapter";

// jsdom ne fournit pas ResizeObserver, que Headless UI utilise en interne pour le menu de l'avatar
// (cf. le même polyfill dans AvatarMenu.test.tsx) — nécessaire ici depuis que ce fichier ouvre ce
// menu pour atteindre l'onglet Paramètres (07/08/2026, déplacement de la section Compte).
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverPolyfill);

/**
 * ⚠️ DATES RELATIVES AU JOUR COURANT, INDISPENSABLE (même piège que documenté dans
 * `App.bascule.test.tsx`) : des dates fixes finissent par tomber dans un exercice CLOS, que l'app
 * fige alors automatiquement (`fusionnerExercicesGeles`) — une écriture légitime qui ferait diverger
 * silencieusement le contenu local de la copie serveur figée ci-dessous, et ce fichier verrait alors
 * l'écran de divergence au lieu de l'app.
 */
function isoDecaleDeMois(mois: number): string {
  const maintenant = new Date();
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + mois, 15)).toISOString().slice(0, 10);
}

const PROFIL = { dateNaissance: "1985-06-15", dateAnniversaire: isoDecaleDeMois(6), situation: "readmission" as const, regimeDeclare: "annexe10_pur" as const };
const CONTRATS = [
  {
    id: "c1",
    dateDebut: isoDecaleDeMois(-1),
    date: isoDecaleDeMois(-1),
    type: "artiste",
    typeRemuneration: "cachet",
    territoire: "france",
    nbCachets: 3,
    salaireBrut: 1200,
    employeur: "Orchestre Sous Compte",
  },
];

// `schemaVersion` est la sonde d'écriture (cf. `App.bascule.test.tsx`) : `sauvegarderDonnees` ne
// l'écrit JAMAIS, sa présence après rendu prouve donc qu'aucune écriture locale n'a eu lieu.
const DONNEES = JSON.stringify({ schemaVersion: 1, profil: PROFIL, contrats: CONTRATS, periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} });

// Ce que le serveur rend une fois connecté : le MÊME contenu que le local (sans la sonde, qui n'a
// jamais existé côté serveur), pour que la bascule (phase 5) résolve « serveur en phase » — ce n'est
// pas l'objet de ce fichier de retester la bascule elle-même (déjà couverte par `App.bascule.test.tsx`),
// seulement de prouver que le mur cède et laisse l'app fonctionner normalement une fois connecté.
const DONNEES_SERVEUR = { profil: PROFIL, contrats: CONTRATS, periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} };

const SESSION = { user: { id: "u-42", email: "benoit@example.com" } };

// `vi.hoisted` : doit exister avant que `vi.mock` ne s'exécute.
const faux = vi.hoisted(() => ({
  getSession: async () => ({ data: { session: null as typeof SESSION | null }, error: null as { message: string } | null }),
  notifier: null as ((evenement: string, session: typeof SESSION | null) => void) | null,
  lecture: null as Record<string, unknown> | null,
}));

vi.mock("../../auth/supabaseClient", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("../../auth/supabaseClient")>();
  const auth = {
    getSession: () => faux.getSession(),
    onAuthStateChange: (rappel: (evenement: string, session: typeof SESSION | null) => void) => {
      faux.notifier = rappel;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    resetPasswordForEmail: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signUp: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  };
  const source = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: faux.lecture, error: null }) }) }),
      insert: () => ({ select: async () => ({ data: [{ maj_le: "2026-08-05T09:14:02.987654+00:00" }], error: null }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ maj_le: "" }], error: null }) }) }) }),
    }),
  };
  return { ...vrai, obtenirClientAuth: () => auth, obtenirClientSourceDonnees: () => source, obtenirClientLectureDonnees: () => null };
});

// Importé APRÈS le mock, sinon il capturerait les vraies fonctions.
const { default: App } = await import("../../App");

const JETON = "2026-08-05T01:05:26.123456+00:00";

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(CLE_STOCKAGE, DONNEES);
  faux.getSession = async () => ({ data: { session: null }, error: null });
  faux.notifier = null;
  faux.lecture = { donnees: DONNEES_SERVEUR, version_schema: 1, maj_le: JETON };
});

describe("App — le mur, tant qu'aucune session n'est ouverte", () => {
  it("déconnecté : aucun onglet, aucune donnée, seulement le formulaire de connexion", async () => {
    render(<App />);
    expect(await screen.findByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Orchestre Sous Compte/)).not.toBeInTheDocument();
  });

  it("le mur explique pourquoi un compte est nécessaire", async () => {
    render(<App />);
    expect(await screen.findByText(/un compte est nécessaire pour utiliser cadence/i)).toBeInTheDocument();
  });

  it("connexion incertaine (erreur réseau) : dit l'ignorance, jamais 'déconnecté' par défaut", async () => {
    faux.getSession = async () => ({ data: { session: null }, error: { message: "Failed to fetch" } });
    render(<App />);
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/impossible de savoir si tu es connecté/i);
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });

  it("n'écrit rien pendant que le mur est affiché", async () => {
    render(<App />);
    await screen.findByLabelText(/adresse e-mail/i);
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    expect(brut).not.toBeNull();
    expect(JSON.parse(brut as string).schemaVersion).toBe(1);
  });
});

describe("App — une fois connecté, l'app entière redevient accessible", () => {
  beforeEach(() => {
    faux.getSession = async () => ({ data: { session: SESSION }, error: null });
  });

  it("s'ouvre et affiche les données locales", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: /navigation principale/i });
    fireEvent.click(within(nav).getByRole("button", { name: "Contrats" }));
    expect(await screen.findByText(/Orchestre Sous Compte/)).toBeInTheDocument();
  });

  it("tous les onglets restent atteignables, aucun mur résiduel à l'intérieur", async () => {
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: /navigation principale/i });
    for (const onglet of ["Tableau de bord", "Mon profil", "Contrats", "Déposer un document", "Historique", "Simulateur", "Revenus mensuels", "Frais pro"]) {
      fireEvent.click(within(nav).getByRole("button", { name: onglet }));
      expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
      await act(async () => {});
    }
  });

  it("l'onglet Mon compte (dans Paramètres, atteint depuis le menu de l'avatar) affiche l'e-mail connecté", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });
    // Deux instances d'AvatarMenu coexistent dans le DOM (variante sidebar desktop + variante topbar
    // mobile, cachée en CSS seulement — cf. AvatarMenu.tsx) : la première suffit, les deux appellent
    // le même onChangerOnglet("parametres").
    fireEvent.click(screen.getAllByRole("button", { name: /menu du compte/i })[0]);
    fireEvent.click((await screen.findAllByRole("menuitem", { name: /paramètres/i }))[0]);
    // Desktop (panneau actif) ET mobile (accordéon) rendent chacun leur propre "Compte" — même
    // écueil que documenté dans ParametresSourcesEtMentions.test.tsx, d'où `getAllByRole`.
    expect((await screen.findAllByRole("heading", { name: "Compte" }))[0]).toBeInTheDocument();
    expect(screen.getAllByText("benoit@example.com")[0]).toBeInTheDocument();
  });
});

describe("App — transition : le mur cède dès que la session s'ouvre", () => {
  it("passe du formulaire de connexion à l'app dès que l'écouteur notifie une session", async () => {
    render(<App />);
    await screen.findByLabelText(/adresse e-mail/i);

    act(() => faux.notifier?.("SIGNED_IN", SESSION));

    expect(await screen.findByRole("navigation", { name: /navigation principale/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});
