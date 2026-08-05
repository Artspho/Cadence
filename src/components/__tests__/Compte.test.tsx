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
    updateUser: vi.fn(async () => ({ error: null })),
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
  // ⚠️ CE TEST VERROUILLAIT L'ANCIENNE PHRASE FAUSSE JUSQU'AU 05/08/2026, ET C'EST EXACTEMENT COMME
  // ÇA QU'ELLE A SURVÉCU AU COMMIT DE LA BASCULE SANS QU'AUCUN DES 986 TESTS ALORS VERTS NE LA
  // DÉTECTE. La suite automatisée ne compare un composant qu'à lui-même — si le test attend « ce
  // navigateur reste la référence » et que le composant l'affiche encore, tout est vert, y compris
  // le jour où c'est devenu faux. Seule la vérification à l'écran (05/08/2026, session réelle,
  // localhost:5183) l'a trouvée. Leçon : quand une phrase affirme QUI fait référence, la revérifier
  // en conditions réelles ne peut pas être sauté au motif que « les tests passent ».
  it("affiche l'adresse ET dit explicitement que c'est le SERVEUR qui fait référence (phase 5)", async () => {
    // Devoir n°1 : une section « Compte » qui laisserait croire au contraire de la réalité — que ce
    // navigateur fait encore référence, ou que les frais réels sont sur le serveur — serait la fausse
    // affirmation la plus dangereuse possible ici.
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    expect(await screen.findByText("benoit@example.com")).toBeInTheDocument();
    expect(screen.getByText(/c'est lui qui fait référence/i)).toBeInTheDocument();
    expect(screen.queryByText(/ce navigateur qui reste la référence/i)).not.toBeInTheDocument();
    // Et l'énumération reste exacte : les frais réels ne sont TOUJOURS PAS recopiés, même en phase 5.
    expect(screen.getByText(/frais réels, eux, restent uniquement dans ce navigateur/i)).toBeInTheDocument();
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

describe("Compte — connecté : définir un mot de passe", () => {
  // Demandé le 05/08/2026 : « pour l'instant pas de compte avec mdp, mais je veux qu'à terme on ait
  // ça ». Le geste manquant, ici : créer un mot de passe SANS redemander l'ancien, puisqu'il n'y en a
  // pas forcément un (arrivée par lien magique).
  it("appelle updateUser avec le mot de passe saisi, sans rien redemander d'autre", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.change(await screen.findByLabelText(/définir un mot de passe/i), { target: { value: "motdepasse-solide" } });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    await waitFor(() => expect(client.updateUser).toHaveBeenCalledWith({ password: "motdepasse-solide" }));
    expect(await screen.findByText(/Mot de passe enregistré\./i)).toBeInTheDocument();
  });

  it("refuse un mot de passe trop court sans appeler Supabase", async () => {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} />);
    fireEvent.change(await screen.findByLabelText(/définir un mot de passe/i), { target: { value: "court12" } });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caractères au minimum/);
    expect(client.updateUser).not.toHaveBeenCalled();
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

  it("explicite le cas du téléphone (réserve PKCE, commit D)", async () => {
    // Ses testeurs liront le lien sur leur téléphone, pas forcément l'appareil qui l'a demandé — cf.
    // CLAUDE.md, phase 5, commit D. Le taire produirait un échec incompréhensible pour eux.
    render(<Compte client={fauxClient()} origine={ORIGINE} />);
    await screen.findByLabelText(/adresse e-mail/i);
    expect(screen.getByText(/téléphone/i)).toBeInTheDocument();
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

// ⚠️ CE BLOC A ÉTÉ RÉÉCRIT À LA BASCULE (05/08/2026), ET SES ATTENTES SONT VOLONTAIREMENT INVERSÉES.
//
// En phase 3, ces tests exigeaient qu'un échec de copie serveur NE PARAISSE PAS grave : l'écriture
// locale — la seule qui faisait référence — avait réussi, donc « rien n'est perdu » était vrai, et
// alarmer aurait été une fausse alerte. Ils vérifiaient même l'absence de `role="alert"`.
//
// Depuis la bascule, la même situation signifie que la saisie n'est PAS à l'endroit qui fait
// référence. Les anciennes attentes sont devenues l'exact contraire de ce qu'il faut protéger : elles
// verrouillaient un message rassurant devenu faux. D'où l'inversion — ce n'est pas un test « corrigé
// pour passer », c'est la règle qui a changé, et c'est le devoir n°2 qui l'impose.
describe("Compte — le témoin de l'enregistrement serveur (phase 5)", () => {
  function connecte(etatEnregistrement: Parameters<typeof Compte>[0]["etatEnregistrement"]) {
    const client = fauxClient({ getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    render(<Compte client={client} origine={ORIGINE} etatEnregistrement={etatEnregistrement} />);
  }

  // ⚠️ Les motifs ci-dessous visent les phrases PROPRES au témoin, et non un mot isolé comme
  // « enregistr… » : le texte d'introduction de la section parle lui aussi d'enregistrement depuis la
  // bascule, et un motif trop large y répondrait — le test passerait ou échouerait pour une raison
  // qui n'a rien à voir avec ce qu'il prétend vérifier.
  const PHRASES_DU_TEMOIN = /Enregistré sur le serveur à|Enregistrement sur le serveur…|a échoué|Lecture seule/i;

  it("ne dit rien quand il n'y a rien à dire", async () => {
    connecte({ statut: "inactif" });
    await screen.findByText("benoit@example.com");
    expect(screen.queryByText(PHRASES_DU_TEMOIN)).not.toBeInTheDocument();
  });

  it("date la CONFIRMATION rendue par le serveur, sans promettre la sécurité des données", async () => {
    // Le faux message à ne jamais écrire, avant comme après la bascule : « tes données sont en
    // sécurité sur le serveur ». Un enregistrement confirmé n'est pas une garantie de sécurité.
    connecte({ statut: "enregistre", horodatage: "2026-08-04T18:55:00.000Z" });
    expect(await screen.findByText(/Enregistré sur le serveur à/i)).toBeInTheDocument();
    expect(screen.queryByText(/en sécurité/i)).not.toBeInTheDocument();
    // Et surtout plus « Ce navigateur reste la référence » : c'est le serveur, désormais.
    expect(screen.queryByText(/ce navigateur reste la référence/i)).not.toBeInTheDocument();
  });

  it("un échec dit que la saisie n'est PAS sur le serveur — et ne rassure plus", async () => {
    connecte({ statut: "echec", message: "TypeError: Failed to fetch" });
    // Motif sans le mot « pas » : il est dans un <strong>, donc découpé sur plusieurs nœuds de texte —
    // un motif qui l'enjambe ne trouverait rien, quel que soit l'affichage réel.
    expect(await screen.findByText(/L'enregistrement sur le serveur a échoué/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeError: Failed to fetch/)).toBeInTheDocument();
    // Et le fond du message : c'est le serveur qui fait référence, donc ne pas s'y fier ailleurs.
    expect(screen.getByText(/Ne compte pas dessus depuis un autre appareil/i)).toBeInTheDocument();
    // L'ancienne formule est désormais interdite ici : elle laisserait croire que la situation est
    // sans conséquence alors que la référence, elle, ignore cette saisie.
    expect(screen.queryByText(/rien n'est perdu/i)).not.toBeInTheDocument();
  });

  it("serveur muet : annonce la lecture seule et qu'une saisie ne serait pas conservée", async () => {
    connecte({ statut: "lectureSeule", message: "paused" });
    expect(await screen.findByText(/lecture seule/i)).toBeInTheDocument();
    expect(screen.getByText(/ne serait conservé/i)).toBeInTheDocument();
  });

  it("le témoin n'apparaît jamais quand personne n'est connecté", async () => {
    // Même si App transmettait un état par erreur, une section déconnectée n'en parle pas.
    render(<Compte client={fauxClient()} origine={ORIGINE} etatEnregistrement={{ statut: "echec", message: "peu importe" }} />);
    await screen.findByLabelText(/adresse e-mail/i);
    expect(screen.queryByText(PHRASES_DU_TEMOIN)).not.toBeInTheDocument();
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
