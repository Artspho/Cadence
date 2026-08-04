// @vitest-environment jsdom
//
// Phase 2 de la refonte Supabase — ce que la section « Compte » affiche réellement.
//
// Le client est INJECTÉ dans chaque test : aucune session Supabase réelle n'est ouverte, aucun appel
// réseau n'est fait. C'est la même conception que l'uploader injecté d'`envoyerJustificatifsLocaux`.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Compte } from "../Compte";
import type { ClientAuth, SessionMinimale } from "../../auth/supabaseClient";

const SESSION: SessionMinimale = { user: { id: "u-42", email: "benoit@example.com" } };
const ORIGINE = "https://cadence-git-master-benoit3.vercel.app";

function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...reponses,
  };
}

describe("Compte — configuration absente", () => {
  it("le dit sans alarmer, et rappelle que le reste fonctionne", () => {
    render(<Compte client={null} origine={ORIGINE} />);
    expect(screen.getByText(/n'est pas configurée/i)).toBeInTheDocument();
    expect(screen.getByText(/tout le reste fonctionne normalement/i)).toBeInTheDocument();
    // Aucun formulaire : proposer de se connecter sans pouvoir le faire serait une fausse promesse.
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });

  it("ne déclenche AUCUN appel, même pas la lecture de session", () => {
    const client = fauxClient();
    render(<Compte client={null} origine={ORIGINE} />);
    expect(client.getSession).not.toHaveBeenCalled();
    expect(client.onAuthStateChange).not.toHaveBeenCalled();
  });
});

describe("Compte — connecté", () => {
  it("affiche l'adresse ET dit explicitement que rien n'a bougé côté données", async () => {
    // Le piège que ce test verrouille : une section « Compte » laisse croire que les données sont
    // « en sécurité sur le serveur ». Elles ne le sont pas avant la phase 5. Le taire serait une
    // fausse affirmation, et la plus dangereuse de toutes ici (devoir n°1).
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    expect(await screen.findByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.getByText(/ce navigateur qui reste la référence/i)).toBeInTheDocument();
    // Et l'énumération reste exacte : les frais réels ne sont PAS recopiés en phase 3.
    expect(screen.getByText(/frais réels, eux, ne le sont pas encore/i)).toBeInTheDocument();
  });

  it("se rabat sur l'identifiant quand la session n'a pas d'adresse", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: { user: { id: "u-42" } } }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    expect(await screen.findByText("u-42")).toBeInTheDocument();
  });

  it("le bouton de déconnexion appelle bien signOut", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.click(await screen.findByRole("button", { name: /se déconnecter/i }));
    await waitFor(() => expect(client.signOut).toHaveBeenCalledTimes(1));
  });

  it("affiche l'échec d'une déconnexion au lieu de faire comme si elle avait eu lieu", async () => {
    const client = fauxClient({
      getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
      signOut: vi.fn(async () => ({ error: { message: "network error" } })),
    });
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.click(await screen.findByRole("button", { name: /se déconnecter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("network error");
    // Toujours annoncé connecté, parce qu'il l'est toujours.
    expect(screen.getByText("benoit@example.com")).toBeInTheDocument();
  });
});

describe("Compte — état de connexion illisible", () => {
  it("dit qu'il ne SAIT pas, et ne prétend pas « non connecté »", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: null }, error: { message: "Failed to fetch" } })) });
    render(<Compte client={client} origine={ORIGINE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Impossible de savoir si tu es connecté/i);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch");
    // Le formulaire n'est pas proposé : on ne sait pas s'il aurait un sens.
    expect(screen.queryByLabelText(/adresse e-mail/i)).not.toBeInTheDocument();
  });

  it("traite un rejet de la promesse comme une ignorance, pas comme une déconnexion", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => Promise.reject(new Error("boom"))) });
    render(<Compte client={client} origine={ORIGINE} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});

describe("Compte — déconnecté : lien magique", () => {
  it("envoie la demande avec l'origine de retour, et prévient pour le navigateur", async () => {
    const client = fauxClient();
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.change(await screen.findByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    await waitFor(() =>
      expect(client.signInWithOtp).toHaveBeenCalledWith({ email: "benoit@example.com", options: { emailRedirectTo: ORIGINE } }),
    );
    expect(await screen.findByText(/si l'adresse correspond/i)).toBeInTheDocument();
  });

  it("affiche l'erreur de Supabase sans la reformuler en vague", async () => {
    const client = fauxClient({ signInWithOtp: vi.fn(async () => ({ error: { message: "Email address not authorized" } })) });
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.change(await screen.findByLabelText(/adresse e-mail/i), { target: { value: "testeur@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent(/membres de l'organisation/i);
    expect(alerte).toHaveTextContent("Email address not authorized");
  });

  it("n'appelle pas Supabase sur une adresse incomplète (le quota horaire est de 2 envois)", async () => {
    const client = fauxClient();
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.change(await screen.findByLabelText(/adresse e-mail/i), { target: { value: "benoit" } });
    fireEvent.click(screen.getByRole("button", { name: /recevoir un lien de connexion/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incomplète/i);
    expect(client.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe("Compte — déconnecté : mot de passe de secours", () => {
  it("propose la connexion et la création après bascule sur l'onglet mot de passe", async () => {
    const client = fauxClient();
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.click(await screen.findByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "motdepasse-solide" } });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() => expect(client.signInWithPassword).toHaveBeenCalledWith({ email: "benoit@example.com", password: "motdepasse-solide" }));
  });

  it("refuse un mot de passe trop court sans appeler Supabase", async () => {
    const client = fauxClient();
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.click(await screen.findByRole("button", { name: /^mot de passe$/i }));
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), { target: { value: "benoit@example.com" } });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), { target: { value: "court12" } });
    fireEvent.click(screen.getByRole("button", { name: /créer un compte/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.signUp).not.toHaveBeenCalled();
  });
});

describe("Compte — retour d'un lien de connexion qui n'a pas ouvert de session", () => {
  // Le défaut trouvé en conditions réelles le 04/08/2026 : Benoît clique le lien depuis son Chrome,
  // la clé PKCE est dans l'autre navigateur, l'échange échoue — et l'écran ne disait RIEN.
  const RETOUR_AVEC_CODE = { present: true, erreurTransmise: null };

  it("explique l'échec et désigne la cause probable", async () => {
    render(<Compte client={fauxClient()} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/n'a pas ouvert de session/i);
    expect(screen.getByRole("status")).toHaveTextContent(/depuis un autre navigateur/i);
    // Et le formulaire reste là pour redemander un lien depuis CE navigateur.
    expect(screen.getByRole("button", { name: /recevoir un lien de connexion/i })).toBeInTheDocument();
  });

  it("cite Supabase mot pour mot quand un motif de refus est transmis", async () => {
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired" };
    render(<Compte client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Email link is invalid or has expired");
  });

  it("N'INVENTE PAS de cause quand Supabase en a déjà donné une", async () => {
    // Défaut trouvé en conditions réelles le 04/08/2026, JUSTE APRÈS le premier correctif : sous
    // « Email link is invalid or has expired » (lien déjà consommé), l'app ajoutait « la cause la plus
    // probable : demandé depuis un autre navigateur ». Une cause fausse sous une erreur exacte — pire
    // que le silence qu'on venait de supprimer.
    const indice = { present: true, erreurTransmise: "Email link is invalid or has expired" };
    render(<Compte client={fauxClient()} origine={ORIGINE} indiceRetour={indice} />);
    const message = await screen.findByRole("status");
    expect(message).not.toHaveTextContent(/autre navigateur/i);
    expect(message).toHaveTextContent(/ne sert qu'une fois/i);
  });

  it("garde l'explication du navigateur QUAND ELLE EST la cause probable", async () => {
    // L'autre branche doit rester intacte : code présent, aucun motif transmis => échange échoué côté
    // navigateur, et l'absence de clé PKCE est bien l'explication la plus probable.
    render(<Compte client={fauxClient()} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
    const message = await screen.findByRole("status");
    expect(message).toHaveTextContent(/autre navigateur/i);
    expect(message).not.toHaveTextContent(/ne sert qu'une fois/i);
  });

  it("NE DIT RIEN quand le lien a réussi : l'état est « connecté », pas « échec »", async () => {
    // Le faux message le plus facile à écrire par accident : afficher l'échec parce que l'URL portait
    // un code, alors que ce code a parfaitement fonctionné.
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} indiceRetour={RETOUR_AVEC_CODE} />);
    expect(await screen.findByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ne dit rien non plus quand rien dans l'URL n'évoque un lien de connexion", async () => {
    render(<Compte client={fauxClient()} origine={ORIGINE} indiceRetour={{ present: false, erreurTransmise: null }} />);
    await screen.findByLabelText(/adresse e-mail/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Compte — le témoin de la copie serveur (phase 3)", () => {
  function connecte(etatMiroir: Parameters<typeof Compte>[0]["etatMiroir"]) {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} etatMiroir={etatMiroir} />);
  }

  it("ne dit rien quand il n'y a rien à dire", async () => {
    connecte({ statut: "inactif" });
    await screen.findByText("benoit@example.com");
    expect(screen.queryByText(/copie/i)).not.toBeInTheDocument();
  });

  it("date la CONFIRMATION de la copie, sans promettre la sécurité des données", async () => {
    // Le faux message à ne jamais écrire : « tes données sont en sécurité sur le serveur ». La source
    // de vérité reste le navigateur jusqu'à la phase 5, et le témoin doit le redire.
    connecte({ statut: "copie", horodatage: "2026-08-04T18:55:00.000Z" });
    expect(await screen.findByText(/Copie sur le serveur confirmée à/i)).toBeInTheDocument();
    expect(screen.getByText(/Ce navigateur reste la référence/i)).toBeInTheDocument();
    expect(screen.queryByText(/en sécurité/i)).not.toBeInTheDocument();
  });

  it("annonce l'échec SANS laisser croire à une perte de données", async () => {
    // L'écriture locale a réussi : présenter l'échec de la copie comme un incident de données serait
    // une fausse alerte, et une fausse alerte finit par faire ignorer les vraies.
    connecte({ statut: "echec", message: "TypeError: Failed to fetch" });
    expect(await screen.findByText(/rien n'est perdu/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeError: Failed to fetch/)).toBeInTheDocument();
    // Et ce n'est PAS une alerte au sens accessible : le seul `role="alert"` de cette section est
    // réservé aux échecs d'action de l'utilisateur.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("le témoin n'apparaît jamais quand personne n'est connecté", async () => {
    // Même si App transmettait un état par erreur, une section déconnectée ne parle pas de copie.
    render(<Compte client={fauxClient()} origine={ORIGINE} etatMiroir={{ statut: "echec", message: "peu importe" }} />);
    await screen.findByLabelText(/adresse e-mail/i);
    expect(screen.queryByText(/copie/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/peu importe/)).not.toBeInTheDocument();
  });
});

describe("Compte — cycle de vie", () => {
  it("passe à « connecté » sur notification de l'écouteur (retour du lien magique)", async () => {
    let notifier: ((evenement: string, session: SessionMinimale | null) => void) | null = null;
    const client = fauxClient({
      onAuthStateChange: vi.fn((rappel) => {
        notifier = rappel;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    });
    render(<Compte client={client} origine={ORIGINE} />);
    // D'abord déconnecté...
    expect(await screen.findByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    // ...puis la bibliothèque échange le code présent dans l'URL et prévient. `act` parce que la
    // notification vient de l'extérieur de React, exactement comme dans le vrai navigateur.
    act(() => notifier?.("SIGNED_IN", SESSION));
    expect(await screen.findByText("benoit@example.com")).toBeInTheDocument();
  });

  it("se désabonne au démontage", async () => {
    const unsubscribe = vi.fn();
    const client = fauxClient({ onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })) });
    const { unmount } = render(<Compte client={client} origine={ORIGINE} />);
    await screen.findByLabelText(/adresse e-mail/i);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
