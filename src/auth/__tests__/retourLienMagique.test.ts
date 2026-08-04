// Le défaut que ce module répare a été trouvé EN CONDITIONS RÉELLES le 04/08/2026, pas par un test :
// lien magique reçu, ouvert dans un autre navigateur que le demandeur, échange PKCE impossible — et
// aucun mot à l'écran pour le dire. Ces tests décrivent ce qu'il faut savoir reconnaître dans l'URL.
import { describe, expect, it } from "vitest";
import { lireIndiceRetour } from "../retourLienMagique";

describe("lireIndiceRetour — reconnaître une page ouverte par un lien de connexion", () => {
  it("ne voit aucun indice sur une URL ordinaire", () => {
    expect(lireIndiceRetour("", "")).toEqual({ present: false, erreurTransmise: null });
    expect(lireIndiceRetour("?maj=BOHKJEhc", "#profil")).toEqual({ present: false, erreurTransmise: null });
  });

  it("reconnaît le code du flux PKCE dans la chaîne de requête", () => {
    // C'est la forme exacte de ce que Benoît a reçu.
    expect(lireIndiceRetour("?code=8f3c1a2b-dead-beef-0000-1234567890ab", "")).toEqual({
      present: true,
      erreurTransmise: null,
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
