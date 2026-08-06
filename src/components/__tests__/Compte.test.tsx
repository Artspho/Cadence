// @vitest-environment jsdom
//
// Phase 2 de la refonte Supabase — ce que la section « Compte » affiche pour un utilisateur déjà
// connecté.
//
// ⚠️ DEPUIS LA CONNEXION OBLIGATOIRE (05/08/2026), `Compte.tsx` NE GÈRE PLUS QUE CETTE BRANCHE :
// `session` lui arrive déjà résolue en prop (App.tsx ne le monte qu'après le mur). Les tests sur les
// branches nonConfigure/chargement/indetermine/deconnecte ont migré vers
// `EcranConnexionObligatoire.test.tsx`, et le cycle de vie du hook `useSession` lui-même (abonnement,
// notification, désabonnement) vit désormais dans `auth/__tests__/session.test.ts` — Compte.tsx ne
// l'appelle plus.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Compte } from "../Compte";
import type { ClientAuth } from "../../auth/supabaseClient";
import type { SessionConnectee } from "../../auth/session";

function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
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

describe("Compte — connecté", () => {
  // ⚠️ CE TEST VERROUILLAIT L'ANCIENNE PHRASE FAUSSE JUSQU'AU 05/08/2026, ET C'EST EXACTEMENT COMME
  // ÇA QU'ELLE A SURVÉCU AU COMMIT DE LA BASCULE SANS QU'AUCUN DES 986 TESTS ALORS VERTS NE LA
  // DÉTECTE. Leçon : quand une phrase affirme QUI fait référence, la revérifier en conditions réelles
  // ne peut pas être sautée au motif que « les tests passent ».
  it("affiche l'adresse ET dit explicitement que c'est le SERVEUR qui fait référence (phase 5)", () => {
    render(<Compte session={SESSION_AVEC_EMAIL} client={fauxClient()} />);
    expect(screen.getByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.getByText(/c'est lui qui fait référence/i)).toBeInTheDocument();
    expect(screen.queryByText(/ce navigateur qui reste la référence/i)).not.toBeInTheDocument();
    // Et l'énumération reste exacte : les frais réels ne sont TOUJOURS PAS recopiés.
    expect(screen.getByText(/frais réels, eux, restent uniquement dans ce navigateur/i)).toBeInTheDocument();
  });

  it("se rabat sur l'identifiant quand la session n'a pas d'adresse", () => {
    render(<Compte session={SESSION_SANS_EMAIL} client={fauxClient()} />);
    expect(screen.getByText("u-42")).toBeInTheDocument();
  });

  it("le bouton de déconnexion appelle bien signOut", async () => {
    const client = fauxClient();
    render(<Compte session={SESSION_AVEC_EMAIL} client={client} />);
    fireEvent.click(screen.getByRole("button", { name: /se déconnecter/i }));
    await waitFor(() => expect(client.signOut).toHaveBeenCalledTimes(1));
  });

  it("affiche l'échec d'une déconnexion au lieu de faire comme si elle avait eu lieu", async () => {
    const client = fauxClient({ signOut: vi.fn(async () => ({ error: { message: "network error" } })) });
    render(<Compte session={SESSION_AVEC_EMAIL} client={client} />);
    fireEvent.click(screen.getByRole("button", { name: /se déconnecter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("network error");
    // Toujours annoncé connecté, parce qu'il l'est toujours.
    expect(screen.getByText("benoit@example.com")).toBeInTheDocument();
  });
});

describe("Compte — connecté : définir un mot de passe", () => {
  // Demandé le 05/08/2026 : « pour l'instant pas de compte avec mdp, mais je veux qu'à terme on ait
  // ça ». Le geste manquant, ici : créer un mot de passe SANS redemander l'ancien, puisqu'il n'y en a
  // pas forcément un (arrivée par lien magique).
  it("appelle updateUser avec le mot de passe saisi, sans rien redemander d'autre", async () => {
    const client = fauxClient();
    render(<Compte session={SESSION_AVEC_EMAIL} client={client} />);
    fireEvent.change(screen.getByLabelText(/définir un mot de passe/i), { target: { value: "motdepasse-solide" } });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    await waitFor(() => expect(client.updateUser).toHaveBeenCalledWith({ password: "motdepasse-solide" }));
    expect(await screen.findByText(/Mot de passe enregistré\./i)).toBeInTheDocument();
  });

  it("refuse un mot de passe trop court sans appeler Supabase", async () => {
    const client = fauxClient();
    render(<Compte session={SESSION_AVEC_EMAIL} client={client} />);
    fireEvent.change(screen.getByLabelText(/définir un mot de passe/i), { target: { value: "court12" } });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.updateUser).not.toHaveBeenCalled();
  });
});

// ⚠️ CE BLOC A ÉTÉ RÉÉCRIT À LA BASCULE (05/08/2026), ET SES ATTENTES SONT VOLONTAIREMENT INVERSÉES.
//
// En phase 3, ces tests exigeaient qu'un échec de copie serveur NE PARAISSE PAS grave : l'écriture
// locale — la seule qui faisait référence — avait réussi, donc « rien n'est perdu » était vrai, et
// alarmer aurait été une fausse alerte.
//
// Depuis la bascule, la même situation signifie que la saisie n'est PAS à l'endroit qui fait
// référence. D'où l'inversion — ce n'est pas un test « corrigé pour passer », c'est la règle qui a
// changé, et c'est le devoir n°2 qui l'impose.
describe("Compte — le témoin de l'enregistrement serveur (phase 5)", () => {
  function connecte(etatEnregistrement: Parameters<typeof Compte>[0]["etatEnregistrement"]) {
    render(<Compte session={SESSION_AVEC_EMAIL} client={fauxClient()} etatEnregistrement={etatEnregistrement} />);
  }

  // ⚠️ Les motifs ci-dessous visent les phrases PROPRES au témoin, et non un mot isolé comme
  // « enregistr… » : le texte d'introduction de la section parle lui aussi d'enregistrement depuis la
  // bascule, et un motif trop large y répondrait.
  const PHRASES_DU_TEMOIN = /Enregistré sur le serveur à|Enregistrement sur le serveur…|a échoué|Lecture seule/i;

  it("ne dit rien quand il n'y a rien à dire", () => {
    connecte({ statut: "inactif" });
    expect(screen.getByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.queryByText(PHRASES_DU_TEMOIN)).not.toBeInTheDocument();
  });

  it("date la CONFIRMATION rendue par le serveur, sans promettre la sécurité des données", () => {
    // Le faux message à ne jamais écrire, avant comme après la bascule : « tes données sont en
    // sécurité sur le serveur ». Un enregistrement confirmé n'est pas une garantie de sécurité.
    connecte({ statut: "enregistre", horodatage: "2026-08-04T18:55:00.000Z" });
    expect(screen.getByText(/Enregistré sur le serveur à/i)).toBeInTheDocument();
    expect(screen.queryByText(/en sécurité/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ce navigateur reste la référence/i)).not.toBeInTheDocument();
  });

  it("un échec dit que la saisie n'est PAS sur le serveur — et ne rassure plus", () => {
    connecte({ statut: "echec", message: "TypeError: Failed to fetch" });
    // Motif sans le mot « pas » : il est dans un <strong>, donc découpé sur plusieurs nœuds de texte.
    expect(screen.getByText(/L'enregistrement sur le serveur a échoué/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeError: Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByText(/Ne compte pas dessus depuis un autre appareil/i)).toBeInTheDocument();
    expect(screen.queryByText(/rien n'est perdu/i)).not.toBeInTheDocument();
  });

  it("serveur muet : annonce la lecture seule et qu'une saisie ne serait pas conservée", () => {
    connecte({ statut: "lectureSeule", message: "paused" });
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
    expect(screen.getByText(/ne serait conservé/i)).toBeInTheDocument();
  });
});
