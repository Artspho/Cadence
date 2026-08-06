// @vitest-environment jsdom
//
// Le défaut que ce module répare a été trouvé EN CONDITIONS RÉELLES le 04/08/2026, pas par un test :
// lien magique reçu, ouvert dans un autre navigateur que le demandeur, échange PKCE impossible — et
// aucun mot à l'écran pour le dire. Ces tests décrivent ce qu'il faut savoir reconnaître dans l'URL.
// Environnement `jsdom` (et non le `node` par défaut du reste de la suite) depuis le 07/08/2026 :
// `marquerReinitialisationReussie`/`reinitialisationReussieCetteSession` ont besoin de
// `window.sessionStorage`.
import { afterEach, describe, expect, it } from "vitest";
import { lireIndiceRetour, marquerReinitialisationReussie, reinitialisationReussieCetteSession, texteAvertissementLienConnecte } from "../retourLienMagique";
import { MARQUEUR_REINITIALISATION } from "../actions";

describe("lireIndiceRetour — reconnaître une page ouverte par un lien reçu par e-mail", () => {
  it("ne voit aucun indice sur une URL ordinaire", () => {
    expect(lireIndiceRetour("", "")).toEqual({ present: false, erreurTransmise: null, reinitialisation: false });
    expect(lireIndiceRetour("?maj=BOHKJEhc", "#profil")).toEqual({ present: false, erreurTransmise: null, reinitialisation: false });
  });

  it("reconnaît le code du flux PKCE dans la chaîne de requête", () => {
    // C'est la forme exacte de ce que Benoît a reçu.
    expect(lireIndiceRetour("?code=8f3c1a2b-dead-beef-0000-1234567890ab", "")).toEqual({
      present: true,
      erreurTransmise: null,
      reinitialisation: false,
    });
  });

  it("reconnaît un lien de vérification (token_hash)", () => {
    expect(lireIndiceRetour("?token_hash=abc123&type=magiclink", "").present).toBe(true);
  });

  it("reconnaît un refus annoncé dans le fragment, et en extrait le motif lisible", () => {
    const indice = lireIndiceRetour("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(indice.present).toBe(true);
    // Les `+` sont bien retraduits en espaces : le message doit être lisible tel quel à l'écran.
    expect(indice.erreurTransmise).toBe("Email link is invalid or has expired");
  });

  it("reconnaît un refus annoncé dans la chaîne de requête", () => {
    const indice = lireIndiceRetour("?error=server_error&error_description=Unable+to+exchange+external+code", "");
    expect(indice.present).toBe(true);
    expect(indice.erreurTransmise).toBe("Unable to exchange external code");
  });

  it("préfère la description au code d'erreur quand les deux sont là", () => {
    const indice = lireIndiceRetour("?error_code=otp_expired&error_description=Email+link+is+invalid", "");
    expect(indice.erreurTransmise).toBe("Email link is invalid");
  });

  it("se contente du code d'erreur quand il n'y a pas de description", () => {
    expect(lireIndiceRetour("", "#error_code=otp_expired").erreurTransmise).toBe("otp_expired");
  });

  it("ne se laisse pas piéger par une inversion des deux arguments", () => {
    // Erreur d'appel réellement commise en écrivant ces tests. Elle produisait un « aucun indice »
    // silencieux — soit précisément l'écran muet que ce module existe pour supprimer.
    expect(lireIndiceRetour("#error_code=otp_expired", "").erreurTransmise).toBe("otp_expired");
    expect(lireIndiceRetour("", "?code=abc").present).toBe(true);
  });

  it("signale la présence d'un code SANS inventer d'erreur", () => {
    // Distinction qui porte tout le message affiché : « présent mais pas d'erreur transmise » = on
    // explique la cause probable ; « erreur transmise » = on cite Supabase.
    const indice = lireIndiceRetour("?code=abc", "");
    expect(indice.present).toBe(true);
    expect(indice.erreurTransmise).toBeNull();
  });
});

describe("lireIndiceRetour — le marqueur de réinitialisation (06/08/2026)", () => {
  it("reconnaît le retour du lien de réinitialisation", () => {
    expect(lireIndiceRetour(`?${MARQUEUR_REINITIALISATION}=1`, "").reinitialisation).toBe(true);
  });

  it("LE VOIT MÊME QUAND L'ÉCHANGE A RÉUSSI, donc sans `code` dans l'URL — le cas normal", () => {
    // ⚠️ LE TEST QUI GARDE LE BUG LE PLUS FACILE À ÉCRIRE ICI. Sur un retour RÉUSSI, la bibliothèque a
    // déjà consommé et nettoyé le `code` : `present` vaut donc `false`. Une version qui rendrait
    // « aucun indice » dans ce cas (parce que `present` est faux) ferait taire l'écran de nouveau mot de
    // passe précisément quand il doit s'afficher — et le parcours « mot de passe oublié » ne
    // réinitialiserait plus rien, en silence.
    const indice = lireIndiceRetour(`?${MARQUEUR_REINITIALISATION}=1`, "");
    expect(indice.present).toBe(false);
    expect(indice.reinitialisation).toBe(true);
  });

  it("le voit aussi en compagnie du code, et n'écrase pas les autres informations", () => {
    const indice = lireIndiceRetour(`?code=abc&${MARQUEUR_REINITIALISATION}=1`, "");
    expect(indice).toEqual({ present: true, erreurTransmise: null, reinitialisation: true });
  });

  it("le voit avec un refus transmis, sans perdre le motif", () => {
    // Cas réel : lien de réinitialisation périmé. Il faut À LA FOIS savoir que c'était une
    // réinitialisation et pouvoir citer le motif de Supabase.
    const indice = lireIndiceRetour(`?${MARQUEUR_REINITIALISATION}=1&error_description=Email+link+is+invalid`, "");
    expect(indice.reinitialisation).toBe(true);
    expect(indice.erreurTransmise).toBe("Email link is invalid");
  });

  it("ne le confond pas avec une URL ordinaire qui parlerait d'autre chose", () => {
    expect(lireIndiceRetour("?onglet=reinitialiser", "").reinitialisation).toBe(false);
  });
});

describe("texteAvertissementLienConnecte — le bandeau d'App.tsx quand une session est déjà active", () => {
  it("rend null sur une URL ordinaire — pas de bandeau à afficher", () => {
    expect(texteAvertissementLienConnecte(lireIndiceRetour("", ""))).toBeNull();
  });

  it("cite le motif exact de Supabase quand un refus a été transmis", () => {
    // Cas réel du 06/08/2026 : Benoît a cliqué un lien de réinitialisation expiré ALORS QU'IL ÉTAIT
    // DÉJÀ CONNECTÉ — le mur (qui porte son propre bandeau) ne s'affiche jamais dans ce cas, donc
    // rien ne disait que le lien avait échoué avant ce correctif.
    const indice = lireIndiceRetour("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "");
    const texte = texteAvertissementLienConnecte(indice);
    expect(texte?.titre).toBe("Ce lien a été refusé : Email link is invalid or has expired.");
  });

  it("ne renvoie jamais la phrase du mur invitant à se connecter — elle ne veut rien dire ici", () => {
    const indice = lireIndiceRetour("?token_hash=abc123&type=magiclink", "");
    const texte = texteAvertissementLienConnecte(indice);
    expect(texte?.titre.toLowerCase()).not.toContain("connecte-toi");
  });
});

describe("marquerReinitialisationReussie / reinitialisationReussieCetteSession (07/08/2026)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("rend faux avant tout appel — rien à taire tant qu'aucun succès n'est survenu", () => {
    expect(reinitialisationReussieCetteSession()).toBe(false);
  });

  it("rend vrai une fois le succès marqué — c'est ce qui fait taire les bandeaux du 04/08", () => {
    marquerReinitialisationReussie();
    expect(reinitialisationReussieCetteSession()).toBe(true);
  });
});
