// @vitest-environment jsdom
//
// Le mur de la connexion obligatoire (05/08/2026). Contrairement à `Compte.tsx` (qui ne rend plus
// que la branche `connecte`), ce composant reçoit `session` DÉJÀ RÉSOLUE en prop — reflet direct de
// son rôle : App.tsx est le seul appelant de `useSession`, ce composant ne fait qu'afficher l'état
// qu'on lui donne et, pour la branche `deconnecte`, appeler les actions (connexionMotDePasse,
// creerCompte, demanderLienMagique) exactement comme le faisait `Compte.tsx` avant ce chantier.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EcranConnexionObligatoire } from "../EcranConnexionObligatoire";
import type { ClientAuth } from "../../auth/supabaseClient";
import { VERSION_POLITIQUE } from "../../content/mentionsLegales";
import { CLE_METADONNEE_CONSENTEMENT } from "../../storage/consentementStorage";
import type { EtatSession } from "../../auth/session";

const ORIGINE = "https://cadence-git-master-benoit3.vercel.app";

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

const DECONNECTE: EtatSession = { statut: "deconnecte" };

/**
 * Coche la case de consentement (06/08/2026). N'existe QUE dans l'onglet mot de passe, seul chemin de
 * création de compte depuis que le lien par e-mail passe `shouldCreateUser: false` — basculer sur cet
 * onglet AVANT d'appeler cette fonction.
 */
function accepterConfidentialite() {
  fireEvent.click(screen.getByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i));
}

describe("EcranConnexionObligatoire — configuration absente", () => {
  it("dit que la connexion est indisponible — jamais un mode dégradé rassurant", () => {
    render(<EcranConnexionObligatoire session={{ statut: "nonConfigure" }} client={null} origine={ORIGINE} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/ne peut pas fonctionner sans elle/i);
    // Contrairement à l'ancienne section « Compte » (avant la connexion obligatoire), plus aucune
    // phrase ne doit rassurer sur un fonctionnement dégradé.
    expect(screen.queryByText(/tout le reste fonctionne normalement/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — chargement", () => {
  it("affiche une vérification en cours, sans formulaire", () => {
    render(<EcranConnexionObligatoire session={{ statut: "chargement" }} client={fauxClient()} origine={ORIGINE} />);
    expect(screen.getByText(/vérification de la connexion/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — état de connexion illisible", () => {
  it("dit qu'il ne SAIT pas, et propose de réessayer — jamais 'non connecté'", () => {
    render(<EcranConnexionObligatoire session={{ statut: "indetermine", detail: "Failed to fetch" }} client={fauxClient()} origine={ORIGINE} />);
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
      <EcranConnexionObligatoire session={{ statut: "connecte", utilisateurId: "u-42", email: "benoit@example.com" }} client={fauxClient()} origine={ORIGINE} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("EcranConnexionObligatoire — déconnecté : lien magique", () => {
  it("envoie la demande avec l'origine de retour, et prévient pour le navigateur", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    await waitFor(() => expect(client.signInWithOtp).toHaveBeenCalledWith({ email: "benoit@example.com", options: { emailRedirectTo: ORIGINE, shouldCreateUser: false } }));
    expect(await screen.findByText(/si l'adresse correspond/i)).toBeInTheDocument();
  });

  it("affiche l'erreur de Supabase sans la reformuler en vague", async () => {
    const client = fauxClient({ signInWithOtp: vi.fn(async () => ({ error: { message: "Email address not authorized" } })) });
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "testeur@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/membres de l'organisation/i);
    expect(alerte).toHaveTextContent("Email address not authorized");
  });

  it("n'appelle pas Supabase sur une adresse incomplète", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incomplète/i);
    expect(client.signInWithOtp).not.toHaveBeenCalled();
  });

  it("explicite le cas du téléphone (réserve PKCE)", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    expect(screen.getByText(/téléphone/i)).toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — déconnecté : mot de passe (connexion ET création)", () => {
  it("propose la connexion après bascule sur l'onglet mot de passe", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() => expect(client.signInWithPassword).toHaveBeenCalledWith({ email: "benoit@example.com", password: "motdepasse-solide" }));
  });

  it("propose aussi la création de compte — même écran, premier lancement compris", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "nouveau@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    accepterConfidentialite();
    fireEvent.click(screen.getByRole("button", { name: /créer un compte/i }));
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
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "court12" } });
    accepterConfidentialite();
    fireEvent.click(screen.getByRole("button", { name: /créer un compte/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.signUp).not.toHaveBeenCalled();
  });
});

describe("EcranConnexionObligatoire — retour d'un lien de connexion qui n'a pas ouvert de session", () => {
  const RETOUR_AVEC_CODE = { present: true, erreurTransmise: null };

  it("explique l'échec et désigne la cause probable", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
    expect(screen.getByRole("status")).toHaveTextContent(/n'a pas ouvert de session/i);
    expect(screen.getByRole("status")).toHaveTextContent(/depuis un autre navigateur/i);
    expect(screen.getByRole("button", { name: /recevoir un lien de connexion/i })).toBeInTheDocument();
  });

  it("cite Supabase mot pour mot quand un motif de refus est transmis", () => {
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired" };
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    expect(screen.getByRole("status")).toHaveTextContent("Email link is invalid or has expired");
  });

  it("N'INVENTE PAS de cause quand Supabase en a déjà donné une", () => {
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired" };
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    const message = screen.getByRole("status");
    expect(message).not.toHaveTextContent(/autre navigateur/i);
    expect(message).toHaveTextContent(/ne sert qu'une fois/i);
  });

  it("ne dit rien quand rien dans l'URL n'évoque un lien de connexion", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} indiceRetour={{ present: false, erreurTransmise: null }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("EcranConnexionObligatoire — consentement à la politique de confidentialité (06/08/2026)", () => {
  it("la case est décochée au départ : rien n'est pré-accepté à la place de l'utilisateur", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    expect(screen.getByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).not.toBeChecked();
  });

  it("« UNE SEULE FOIS SUFFIT » : aucune case dans l'onglet du lien par e-mail, qui ne sert qu'à se connecter", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    // Mode « Lien par e-mail » par défaut : ni case, ni bouton de lecture — se connecter ne demande
    // plus jamais de consentir, puisque ce chemin ne crée plus de compte.
    expect(screen.queryByLabelText(/j'ai lu et j'accepte la politique de confidentialité/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recevoir un lien de connexion/i })).not.toBeDisabled();
    expect(screen.getByText(/il n'en crée pas/i)).toBeInTheDocument();
  });

  it("le lien par e-mail passe shouldCreateUser: false — sans quoi il inscrirait sans case ni preuve", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "ancien@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    await waitFor(() =>
      expect(client.signInWithOtp).toHaveBeenCalledWith({ email: "ancien@example.com", options: { emailRedirectTo: ORIGINE, shouldCreateUser: false } }),
    );
  });

  it("LA POLITIQUE EST LISIBLE AVANT DE CONSENTIR — c'est tout l'objet de ce chantier", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.click(screen.getByRole("button", { name: /lire la politique de confidentialité/i }));
    const modale = screen.getByRole("alertdialog");
    // Titres venant de content/mentionsLegales.ts — le MÊME texte que « Mon profil », pas une copie.
    expect(modale).toHaveTextContent(/qui est responsable de tes données/i);
    expect(modale).toHaveTextContent(/qui peut techniquement voir quoi/i);
    // Le passage qui doit rester lisible avant l'inscription : Benoît peut techniquement tout lire.
    expect(modale).toHaveTextContent(/accéder à l'ensemble des données hébergées/i);
  });

  it("sans la case cochée, « Créer un compte » ne part pas", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "nouveau@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    const bouton = screen.getByRole("button", { name: /créer un compte/i });
    expect(bouton).toBeDisabled();
    fireEvent.click(bouton);
    await waitFor(() => expect(client.signUp).not.toHaveBeenCalled());
  });

  it("« SE CONNECTER » N'EST PAS BRIDÉ : il ne crée aucun compte, et quelqu'un qui a déjà un compte a déjà consenti", async () => {
    const client = fauxClient();
    render(<EcranConnexionObligatoire session={DECONNECTE} client={client} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "ancien@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    expect(screen.getByRole("button", { name: /se connecter/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() => expect(client.signInWithPassword).toHaveBeenCalledWith({ email: "ancien@example.com", password: "motdepasse-solide" }));
  });

  it("cocher la case débride « Créer un compte »", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    expect(screen.getByRole("button", { name: /créer un compte/i })).toBeDisabled();
    accepterConfidentialite();
    expect(screen.getByRole("button", { name: /créer un compte/i })).not.toBeDisabled();
  });

  it("dit que la case ne concerne QUE la création, et que la preuve est conservée", () => {
    render(<EcranConnexionObligatoire session={DECONNECTE} client={fauxClient()} origine={ORIGINE} />);
    fireEvent.click(screen.getByRole("button", { name: /^mot de passe$/i }));
    expect(screen.getByText(/pas pour te connecter/i)).toBeInTheDocument();
    expect(screen.getByText(/la date et la version du texte accepté sont conservées/i)).toBeInTheDocument();
  });
});
