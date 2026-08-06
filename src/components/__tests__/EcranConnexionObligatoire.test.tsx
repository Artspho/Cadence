// @vitest-environment jsdom
//
// Le mur de la connexion obligatoire (05/08/2026), REFONDU le 06/08/2026 sur demande de Benoît :
// suppression du lien magique, un seul parcours (créer un compte / se connecter / mot de passe
// oublié).
//
// ⚠️ CE QUE CES TESTS N'ONT PAS SU VOIR, ET QU'IL FAUT GARDER EN TÊTE EN LES LISANT. La refonte a été
// déclenchée par un défaut que la version précédente de ce fichier laissait passer : « Créer un
// compte » était ACTIF (`not.toBeDisabled()` passait, et il y avait un test pour ça) mais illisible
// comme tel — texte gris sur fond transparent, seule l'opacité changeait entre actif et inactif.
// Benoît a conclu que le bouton était grisé et n'a pas pu créer de compte. Un test ne compare un
// composant qu'à lui-même, jamais à ce qu'un œil humain en conclut : les tests d'apparence ajoutés
// plus bas ne remplacent donc PAS un coup d'œil réel à l'écran, ils empêchent seulement la
// régression exacte qui a été mesurée.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EcranConnexionObligatoire } from "../EcranConnexionObligatoire";
import type { ClientAuth } from "../../auth/supabaseClient";
import { VERSION_POLITIQUE } from "../../content/mentionsLegales";
import { CLE_METADONNEE_CONSENTEMENT } from "../../storage/consentementStorage";
import { MARQUEUR_REINITIALISATION } from "../../auth/actions";
import { marquerReinitialisationReussie } from "../../auth/retourLienMagique";
import type { EtatSession } from "../../auth/session";

const ORIGINE = "https://cadence-git-master-benoit3.vercel.app";

function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

const DECONNECTE: EtatSession = { statut: "deconnecte" };
const AUCUN_RETOUR = { present: false, erreurTransmise: null, reinitialisation: false };

/** Ouvre le formulaire de création (l'écran démarre sur la connexion, geste le plus fréquent). */
function allerVersCreation() {
  fireEvent.click(screen.getByRole("button", { name: /^créer un compte$/i }));
}

function accepterConfidentialite() {
  fireEvent.click(screen.getByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i));
}

describe("EcranConnexionObligatoire — configuration absente", () => {
  it("dit que la connexion est indisponible — jamais un mode dégradé rassurant", () => {
    render(<EcranConnexionObligatoire session={{ statut: "nonConfigure" }} client={null} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/ne peut pas fonctionner sans elle/i);
    expect(screen.queryByText(/tout le reste fonctionne normalement/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — chargement", () => {
  it("affiche une vérification en cours, sans formulaire", () => {
    render(<EcranConnexionObligatoire session={{ statut: "chargement" }} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    expect(screen.getByText(/vérification de la connexion/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — état de connexion illisible", () => {
  it("dit qu'il ne SAIT pas, et propose de réessayer — jamais 'non connecté'", () => {
    render(<EcranConnexionObligatoire session={{ statut: "indetermine", detail: "Failed to fetch" }} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent(/impossible de savoir si tu es connecté/i);
    expect(alerte).toHaveTextContent("Failed to fetch");
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — déjà connecté", () => {
  it("ne rend rien : App.tsx ne devrait jamais monter ce composant dans ce cas", () => {
    const { container } = render(
      <EcranConnexionObligatoire
        session={{ statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" }}
        client={fauxClient()}
        origine={ORIGINE}
        indiceRetour={AUCUN_RETOUR}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("EcranConnexionObligatoire — LE LIEN MAGIQUE N'EXISTE PLUS (06/08/2026)", () => {
  it("n'offre aucun moyen de se connecter sans mot de passe", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    // Décision de Benoît : « je ne comprends pas l'intérêt du lien magique, il me gonfle ». Ce test
    // échouera si quelqu'un le rétablit sans le lui demander.
    expect(screen.queryByRole("button", { name: /recevoir un lien de connexion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lien par e-mail/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/lien magique/i)).not.toBeInTheDocument();
  });

  it("le champ mot de passe est là DÈS LE PREMIER ÉCRAN, sans onglet à trouver", () => {
    // Avant la refonte, il fallait deviner qu'un onglet « Mot de passe » existait. L'écran démarrait
    // sur le lien par e-mail, donc un nouveau venu ne voyait même pas de bouton « Créer un compte ».
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^se connecter$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^créer un compte$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mot de passe oublié/i })).toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — se connecter", () => {
  it("appelle Supabase avec l'adresse et le mot de passe saisis", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    fireEvent.click(screen.getByRole("button", { name: /^se connecter$/i }));
    await waitFor(() => expect(client.signInWithPassword).toHaveBeenCalledWith({ email: "benoit@example.com", password: "motdepasse-solide" }));
  });

  it("N'EST JAMAIS BRIDÉ par le consentement : se connecter ne crée aucun compte", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    expect(screen.getByRole("button", { name: /^se connecter$/i })).not.toBeDisabled();
    // Et aucune case n'est même proposée ici : qui a un compte a déjà consenti, sa preuve est en base.
    expect(screen.queryByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — créer un compte", () => {
  it("transmet l'adresse, l'origine de retour ET la preuve du consentement", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "nouveau@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    accepterConfidentialite();
    fireEvent.click(screen.getByRole("button", { name: /^créer un compte$/i }));
    await waitFor(() => expect(client.signUp).toHaveBeenCalled());
    const parametres = vi.mocked(client.signUp).mock.calls[0][0];
    expect(parametres.email).toBe("nouveau@example.com");
    expect(parametres.options?.emailRedirectTo).toBe(ORIGINE);
    // LA PREUVE VOYAGE ICI : version du texte + instant du clic, écrits par Supabase à la création.
    const preuve = parametres.options?.data?.[CLE_METADONNEE_CONSENTEMENT] as { version: string; accepte_le: string };
    expect(preuve.version).toBe(VERSION_POLITIQUE);
    expect(Number.isNaN(Date.parse(preuve.accepte_le))).toBe(false);
  });

  it("refuse un mot de passe trop court sans appeler Supabase", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "court12" } });
    accepterConfidentialite();
    fireEvent.click(screen.getByRole("button", { name: /^créer un compte$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it("on peut revenir à la connexion sans recharger la page", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    expect(screen.getByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /j'ai déjà un compte/i }));
    expect(screen.getByRole("button", { name: /^se connecter$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — consentement à la politique de confidentialité", () => {
  it("la case est décochée au départ : rien n'est pré-accepté à la place de l'utilisateur", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    expect(screen.getByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).not.toBeChecked();
  });

  it("sans la case cochée, « Créer un compte » ne part pas", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "nouveau@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    const bouton = screen.getByRole("button", { name: /^créer un compte$/i });
    expect(bouton).toBeDisabled();
    fireEvent.click(bouton);
    await waitFor(() => expect(client.signUp).not.toHaveBeenCalled());
  });

  it("LE MOTIF DU BLOCAGE EST ÉCRIT, il n'est pas laissé à deviner — cœur du correctif du 06/08/2026", () => {
    // C'est l'autre moitié de la correction : le style dit QU'il est bloqué, ce texte dit POURQUOI.
    // Sans lui, un bouton inactif reste une devinette, quelle que soit sa couleur.
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    expect(screen.getByRole("status")).toHaveTextContent(/coche la case ci-dessus pour pouvoir créer ton compte/i);
    accepterConfidentialite();
    expect(screen.queryByText(/coche la case ci-dessus/i)).not.toBeInTheDocument();
  });

  it("cocher la case débride « Créer un compte », ET LE BOUTON PORTE UN FOND PLEIN", () => {
    // ⚠️ LA SECONDE ASSERTION EST LA LEÇON DU 06/08/2026, pas une coquetterie. La version précédente
    // vérifiait uniquement `not.toBeDisabled()` — vrai, et pourtant Benoît n'a pas pu créer son compte,
    // parce que le bouton restait gris sur fond transparent à côté d'un bouton vert. Un bouton actif
    // doit être RECONNAISSABLE comme actif.
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    const bouton = screen.getByRole("button", { name: /^créer un compte$/i });
    expect(bouton).toBeDisabled();
    accepterConfidentialite();
    expect(bouton).not.toBeDisabled();
    expect(bouton.className).toMatch(/bg-mint/);
    expect(bouton.className).not.toMatch(/text-muted/);
  });

  it("LA POLITIQUE EST LISIBLE AVANT DE CONSENTIR", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    allerVersCreation();
    fireEvent.click(screen.getByRole("button", { name: /lire la politique de confidentialité/i }));
    const modale = screen.getByRole("alertdialog");
    // Titres venant de content/mentionsLegales.ts — le MÊME texte que « Mon profil », pas une copie.
    expect(modale).toHaveTextContent(/qui est responsable de tes données/i);
    expect(modale).toHaveTextContent(/qui peut techniquement voir quoi/i);
    // Le passage qui doit rester lisible avant l'inscription : Benoît peut techniquement tout lire.
    expect(modale).toHaveTextContent(/accéder à l'ensemble des données hébergées/i);
  });
});

describe("EcranConnexionObligatoire — mot de passe oublié (06/08/2026)", () => {
  it("demande la réinitialisation avec le marqueur de retour", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de réinitialisation/i }));
    await waitFor(() =>
      expect(client.resetPasswordForEmail).toHaveBeenCalledWith("benoit@example.com", { redirectTo: `${ORIGINE}?${MARQUEUR_REINITIALISATION}=1` }),
    );
  });

  it("ne demande AUCUN mot de passe : on ne le connaît justement plus", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    expect(screen.queryByLabelText(/^mot de passe$/i)).not.toBeInTheDocument();
  });

  it("PRÉVIENT AVANT L'ENVOI que ce lien-ci exige le même navigateur", () => {
    // Ce lien ouvre une session, donc il porte la contrainte PKCE — contrairement au lien de
    // confirmation d'adresse. Le dire après le clic serait trop tard : c'est la leçon du 04/08/2026.
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    expect(screen.getByText(/depuis ce navigateur-ci/i)).toBeInTheDocument();
  });

  it("remonte le refus du service d'envoi sans le reformuler en vague", async () => {
    const client = fauxClient({ resetPasswordForEmail: vi.fn(async () => ({ error: { message: "Email address not authorized" } })) });
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "testeur@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de réinitialisation/i }));
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/membres de l'organisation/i);
    expect(alerte).toHaveTextContent("Email address not authorized");
  });

  it("n'appelle pas Supabase sur une adresse incomplète — le quota est de 2 envois par heure", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de réinitialisation/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incomplète/i);
    expect(client.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("on peut revenir à la connexion", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    fireEvent.click(screen.getByRole("button", { name: /mot de passe oublié/i }));
    fireEvent.click(screen.getByRole("button", { name: /revenir à la connexion/i }));
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — retour d'un lien qui n'a pas ouvert de session", () => {
  const RETOUR_AVEC_CODE = { present: true, erreurTransmise: null, reinitialisation: false };

  it("explique l'échec, et rassure sur le lien de CONFIRMATION d'adresse", () => {
    // Nuance apportée le 06/08/2026 : le lien de confirmation n'a pas besoin d'ouvrir de session pour
    // faire son travail. Atterrir ici après l'avoir cliqué depuis son téléphone est donc SANS
    // conséquence — il faut le dire, sinon l'utilisateur croit son inscription ratée.
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
    const statut = screen.getByRole("status");
    expect(statut).toHaveTextContent(/n'a pas ouvert de session/i);
    expect(statut).toHaveTextContent(/ton adresse est confirmée/i);
    expect(statut).toHaveTextContent(/connecte-toi simplement/i);
  });

  it("cite Supabase mot pour mot quand un motif de refus est transmis", () => {
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired", reinitialisation: false };
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    expect(screen.getByRole("status")).toHaveTextContent("Email link is invalid or has expired");
  });

  it("N'INVENTE PAS de cause quand Supabase en a déjà donné une", () => {
    // ⚠️ NE PAS REFONDRE CES DEUX BRANCHES EN UNE. Le 04/08/2026, une cause inventée (« demandé depuis
    // un autre navigateur ») s'affichait SOUS une erreur exacte de Supabase — pire que le silence.
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired", reinitialisation: false };
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    const message = screen.getByRole("status");
    expect(message).not.toHaveTextContent(/adresse est confirmée/i);
    expect(message).toHaveTextContent(/ne sert qu'une fois/i);
  });

  it("ne dit rien quand rien dans l'URL n'évoque un lien reçu par e-mail", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={AUCUN_RETOUR} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("SE TAIT après une déconnexion qui suit une réinitialisation réussie dans cet onglet (07/08/2026)", () => {
    // Bug réel : `indiceRetour.present` reste vrai pour toute la vie de l'onglet même quand la
    // réinitialisation a réussi (le `code` est lu avant que la bibliothèque ne le nettoie de l'URL,
    // de façon asynchrone) — sans `marquerReinitialisationReussie`, ce bandeau annonçait un faux échec
    // juste après une déconnexion qui suivait un vrai succès.
    window.sessionStorage.clear();
    marquerReinitialisationReussie();
    try {
      render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      window.sessionStorage.clear();
    }
  });
});
