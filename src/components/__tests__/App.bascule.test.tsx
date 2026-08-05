// @vitest-environment jsdom
//
// PHASE 5 — LA BASCULE, EXERCÉE SUR LE VRAI `App`.
//
// Pourquoi ce fichier existe alors que `bascule.test.ts` couvre déjà l'aiguillage : ce module-là ne
// rend qu'un VERDICT. Il ne prouve rien sur ce que l'application en fait. Or c'est exactement là que
// se joue le devoir n°1 — savoir qu'une situation est douteuse ne sert à rien si l'app écrit quand
// même. Ces tests rendent donc le vrai `App`, avec un faux serveur piloté par le test.
//
// ⚠️ LA SONDE D'ÉCRITURE, ET C'EST TOUTE LA FINESSE DE CE FICHIER : le contenu posé dans le
// `localStorage` contient une clé `schemaVersion`, que `sauvegarderDonnees` n'écrit JAMAIS (elle
// n'appartient qu'au format d'export). Tant qu'elle est là, aucune écriture locale n'a eu lieu. Sans
// cette astuce, un test qui compare le contenu à ce qu'il a posé passerait même si l'app réécrivait
// par-dessus — puisqu'elle réécrirait la même chose.
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CLE_STOCKAGE } from "../../storage/localStorageAdapter";

const UTILISATEUR = "d7db4e57-b5ba-4bb0-8235-0f20a499e42b";
const JETON = "2026-08-05T01:05:26.123456+00:00";
const JETON_SUIVANT = "2026-08-05T09:14:02.987654+00:00";

/**
 * ⚠️ DATES RELATIVES AU JOUR COURANT, ET C'EST INDISPENSABLE.
 *
 * Avec des dates fixes, l'app finit par trouver un exercice CLOS dans le jeu de test : elle le fige
 * alors automatiquement (`fusionnerExercicesGeles`), ce qui modifie les données et déclenche une
 * écriture serveur parfaitement légitime. Les premières versions de ces tests l'ont pris pour un
 * défaut du verrou — c'étaient elles qui affirmaient une chose fausse.
 *
 * L'anniversaire est donc placé dans 6 mois et le contrat il y a un mois : l'exercice en cours les
 * englobe tous les deux et n'est pas clos, donc rien ne se fige et les écritures observées ne peuvent
 * venir que de ce que le test provoque lui-même. Sans cette précision, ce fichier se remettrait à
 * échouer tout seul en changeant simplement de date.
 */
function isoDecaleDeMois(mois: number): string {
  const maintenant = new Date();
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + mois, 15)).toISOString().slice(0, 10);
}

const DATE_ANNIVERSAIRE = isoDecaleDeMois(6);
const DATE_CONTRAT = isoDecaleDeMois(-1);

function contratLocal(employeur: string) {
  return {
    id: "c1",
    dateDebut: DATE_CONTRAT,
    date: DATE_CONTRAT,
    type: "artiste",
    typeRemuneration: "cachet",
    territoire: "france",
    nbCachets: 3,
    salaireBrut: 1200,
    employeur,
  };
}

const PROFIL = { dateNaissance: "1985-06-15", dateAnniversaire: DATE_ANNIVERSAIRE, situation: "readmission", regimeDeclare: "annexe10_pur" };

/** L'état posé dans le navigateur. `schemaVersion` est la sonde décrite en tête de fichier. */
const ETAT_LOCAL = { schemaVersion: 1, profil: PROFIL, contrats: [contratLocal("Orchestre du Navigateur")], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} };

/** Ce que le serveur rendra, sans la sonde : c'est un état serveur, pas un fichier d'export. */
function etatServeur(employeur: string) {
  return { profil: PROFIL, contrats: [contratLocal(employeur)], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} };
}

// `vi.hoisted` : ces objets doivent exister avant que `vi.mock` ne s'exécute, donc avant les imports.
const faux = vi.hoisted(() => ({
  lecture: { data: null as Record<string, unknown> | null, error: null as { message: string; code?: string } | null },
  reponseModification: { data: [{ maj_le: "" }] as Record<string, unknown>[] | null, error: null as { message: string; code?: string } | null },
  insertions: [] as Record<string, unknown>[],
  modifications: [] as Record<string, unknown>[],
  filtres: [] as Array<[string, string]>,
}));

vi.mock("../../auth/supabaseClient", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("../../auth/supabaseClient")>();
  const auth = {
    getSession: async () => ({ data: { session: { user: { id: "d7db4e57-b5ba-4bb0-8235-0f20a499e42b", email: "benoit@example.com" } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOtp: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signUp: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
  };
  const source = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => faux.lecture }) }),
      insert: (charge: Record<string, unknown>) => {
        faux.insertions.push(charge);
        return { select: async () => ({ data: [{ maj_le: "2026-08-05T09:14:02.987654+00:00" }], error: null }) };
      },
      update: (charge: Record<string, unknown>) => {
        faux.modifications.push(charge);
        return {
          eq: (_c1: string, _v1: string) => ({
            eq: (colonne: string, valeur: string) => {
              faux.filtres.push([colonne, valeur]);
              return { select: async () => faux.reponseModification };
            },
          }),
        };
      },
    }),
  };
  return { ...vrai, obtenirClientAuth: () => auth, obtenirClientSourceDonnees: () => source, obtenirClientLectureDonnees: () => null };
});

// Importé APRÈS le mock, sinon il capturerait les vraies fonctions.
const { default: App } = await import("../../App");

/** Le contenu local est-il resté exactement celui qu'on a posé ? (cf. la sonde `schemaVersion`) */
function aucuneEcritureLocale(): boolean {
  const brut = window.localStorage.getItem(CLE_STOCKAGE);
  return brut !== null && JSON.parse(brut).schemaVersion === 1;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(ETAT_LOCAL));
  faux.lecture = { data: null, error: null };
  faux.reponseModification = { data: [{ maj_le: JETON_SUIVANT }], error: null };
  faux.insertions = [];
  faux.modifications = [];
  faux.filtres = [];
});

describe("App — le serveur porte la même chose que le navigateur", () => {
  it("l'app s'ouvre normalement, sans bandeau et sans réécrire quoi que ce soit", async () => {
    faux.lecture = { data: { donnees: etatServeur("Orchestre du Navigateur"), version_schema: 1, maj_le: JETON }, error: null };

    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });

    expect(screen.queryByText(/lecture seule/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ne disent pas la même chose/i)).not.toBeInTheDocument();
    // Rien n'est renvoyé au serveur : il porte déjà cet état, une écriture serait du bruit — et
    // surtout, elle consommerait le jeton pour rien.
    expect(faux.modifications).toHaveLength(0);
    expect(faux.insertions).toHaveLength(0);
  });
});

describe("App — serveur muet (pause du palier gratuit, réseau)", () => {
  beforeEach(() => {
    faux.lecture = { data: null, error: { message: "TypeError: Failed to fetch" } };
  });

  it("s'ouvre en LECTURE SEULE, et le bandeau dit que les chiffres peuvent être en retard", async () => {
    render(<App />);
    // L'app est bien utilisable : c'est le choix de Benoît du 05/08/2026, contre le refus de démarrer.
    await screen.findByRole("navigation", { name: /navigation principale/i });

    const bandeau = await screen.findByRole("alert");
    expect(bandeau).toHaveTextContent(/Lecture seule : le serveur ne répond pas/i);
    expect(bandeau).toHaveTextContent(/peuvent être en retard/i);
    // La procédure, pas seulement le symptôme : une pause se répare d'un clic, encore faut-il le savoir.
    expect(bandeau).toHaveTextContent(/Restore/);
  });

  it("N'ÉCRIT RIEN — ni sur le serveur, ni dans le navigateur", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });

    // LE test de tout ce fichier. Si l'app continuait d'enregistrer localement pendant que le serveur
    // se tait, elle creuserait elle-même une divergence, en silence, sans qu'aucun utilisateur n'ait
    // rien demandé — et personne ne saurait qu'elle existe.
    expect(aucuneEcritureLocale()).toBe(true);
    expect(faux.modifications).toHaveLength(0);
    expect(faux.insertions).toHaveLength(0);
  });
});

describe("App — le serveur et le navigateur divergent", () => {
  beforeEach(() => {
    faux.lecture = { data: { donnees: etatServeur("Orchestre du Serveur"), version_schema: 1, maj_le: JETON }, error: null };
  });

  it("dresse un écran bloquant : ni navigation, ni tableau de bord, et aucune écriture", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /ne disent pas la même chose/i })).toBeInTheDocument();

    // Bloquant au sens strict : on ne doit pas pouvoir saisir un contrat pendant qu'une question sur
    // la version à conserver est en suspens.
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
    expect(aucuneEcritureLocale()).toBe(true);
    expect(faux.modifications).toHaveLength(0);
  });

  it("les deux versions sont identifiables, et le choix reste fermé tant que rien n'est mis à l'abri", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /ne disent pas la même chose/i });

    expect(screen.getByText(/Rien n'a été effacé/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Télécharger la version de ce navigateur/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Télécharger la version du serveur/i })).toBeInTheDocument();
    // Les deux boutons destructeurs sont gâtés : cocher est un geste conscient, pas un réflexe.
    expect(screen.getByRole("button", { name: /Garder ce navigateur/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Prendre le serveur/i })).toBeDisabled();
  });

  it("« garder ce navigateur » écrit SOUS CONDITION de la version lue, puis l'app s'ouvre", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /ne disent pas la même chose/i });

    fireEvent.click(screen.getByLabelText(/J'ai téléchargé les deux versions/i));
    fireEvent.click(screen.getByRole("button", { name: /Garder ce navigateur/i }));

    await screen.findByRole("navigation", { name: /navigation principale/i });
    // LE VERROU, exercé de bout en bout depuis l'interface : l'écriture nomme la version qu'elle
    // remplace. Sans ce filtre, un autre appareil ayant écrit entre-temps serait écrasé sans un mot.
    expect(faux.filtres).toContainEqual(["maj_le", JETON]);
    expect(faux.modifications).toHaveLength(1);
    expect(faux.modifications[0].donnees).toMatchObject({ contrats: [expect.objectContaining({ employeur: "Orchestre du Navigateur" })] });
  });

  it("« prendre le serveur » adopte sa version SANS rien lui renvoyer", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /ne disent pas la même chose/i });

    fireEvent.click(screen.getByLabelText(/J'ai téléchargé les deux versions/i));
    fireEvent.click(screen.getByRole("button", { name: /Prendre le serveur/i }));

    await screen.findByRole("navigation", { name: /navigation principale/i });
    // Le serveur porte déjà cette version : lui réécrire serait inutile, et consommerait le jeton.
    expect(faux.modifications).toHaveLength(0);
    expect(faux.insertions).toHaveLength(0);
    // Et la copie locale, elle, est bien rafraîchie : la sonde disparaît, c'est le signe qu'une
    // écriture locale a EU lieu — ici c'est le comportement voulu, contrairement au cas muet.
    await waitFor(() => expect(aucuneEcritureLocale()).toBe(false));
    const relu = JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) as string);
    expect(relu.contrats[0].employeur).toBe("Orchestre du Serveur");
  });
});

describe("App — le serveur n'a encore rien pour ce compte", () => {
  it("propose le téléversement au lieu de le faire, et n'écrit rien avant le clic", async () => {
    faux.lecture = { data: null, error: null };

    render(<App />);
    expect(await screen.findByRole("heading", { name: /ne sont pas encore sur le serveur/i })).toBeInTheDocument();
    expect(faux.insertions).toHaveLength(0);
    expect(aucuneEcritureLocale()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Envoyer mes données sur le serveur/i }));
    await screen.findByRole("navigation", { name: /navigation principale/i });

    // INSERTION et non remplacement : si une ligne était apparue entre-temps, elle ne serait pas
    // écrasée — l'insertion échouerait et la question serait reposée.
    expect(faux.insertions).toHaveLength(1);
    expect(faux.modifications).toHaveLength(0);
    expect(faux.insertions[0].user_id).toBe(UTILISATEUR);
  });
});

describe("App — premier lancement d'un compte connecté", () => {
  it("l'onboarding annonce l'enregistrement SUR LE SERVEUR, et non « uniquement sur cet appareil »", async () => {
    // Défaut trouvé en vérifiant à l'écran le 05/08/2026, invisible aux tests jusque-là : la phrase de
    // bas de page de l'onboarding affirmait « tes données restent uniquement sur cet appareil ». Vrai
    // sans compte, faux dès qu'une session est ouverte — et affiché au moment précis où quelqu'un
    // confie ses données.
    window.localStorage.clear();
    faux.lecture = { data: null, error: null };

    render(<App />);
    expect(await screen.findByText(/sera enregistré sur le serveur/i)).toBeInTheDocument();
    expect(screen.queryByText(/restent uniquement sur cet appareil/i)).not.toBeInTheDocument();
  });
});

describe("App — nouvel appareil : le navigateur est vide", () => {
  it("adopte le serveur SANS rien demander — il n'y a rien à perdre", async () => {
    window.localStorage.clear();
    faux.lecture = { data: { donnees: etatServeur("Orchestre du Serveur"), version_schema: 1, maj_le: JETON }, error: null };

    render(<App />);
    await screen.findByRole("navigation", { name: /navigation principale/i });

    // Aucun écran de décision : le seul automatisme autorisé avec l'égalité, parce qu'il n'écrase rien.
    expect(screen.queryByText(/ne disent pas la même chose/i)).not.toBeInTheDocument();
    await waitFor(() => {
      const brut = window.localStorage.getItem(CLE_STOCKAGE);
      expect(brut).not.toBeNull();
      expect(JSON.parse(brut as string).contrats[0].employeur).toBe("Orchestre du Serveur");
    });
    // Et rien n'est renvoyé au serveur : on vient d'en lire cette version.
    expect(faux.modifications).toHaveLength(0);
    expect(faux.insertions).toHaveLength(0);
  });
});

describe("App — le serveur porte un contenu illisible", () => {
  it("écran bloquant, contenu serveur téléchargeable, et remplacement gâté par une case", async () => {
    faux.lecture = { data: { donnees: { contrats: "pas un tableau" }, version_schema: 1, maj_le: JETON }, error: null };

    render(<App />);
    expect(await screen.findByRole("heading", { name: /ne sait pas lire/i })).toBeInTheDocument();

    // Le contenu doit pouvoir être sauvé AVANT d'être remplacé : une fois écrasé, il n'existe plus.
    expect(screen.getByRole("button", { name: /Télécharger le contenu brut du serveur/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remplacer le contenu du serveur/i })).toBeDisabled();
    expect(faux.modifications).toHaveLength(0);
    expect(aucuneEcritureLocale()).toBe(true);
  });
});
