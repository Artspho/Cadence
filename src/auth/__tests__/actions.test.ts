// Phase 2 de la refonte Supabase — les gestes d'authentification, et surtout ce qu'ils AFFIRMENT.
//
// Devoir n°2 appliqué à l'authentification : ne jamais annoncer un succès que Supabase n'a pas
// confirmé, et ne jamais remplacer une erreur par un message vague qui ferait chercher un bug là où
// il n'y en a pas.
//
// ⚠️ `demanderLienMagique` A ÉTÉ SUPPRIMÉ le 06/08/2026 (demande de Benoît) et ses tests avec lui :
// une connexion sans mot de passe était un doublon du chemin mot de passe, et elle portait seule la
// contrainte du même navigateur. Ce sont désormais les tests de
// `demanderReinitialisationMotDePasse` qui occupent cette place — même intention testée (ne rien
// promettre qu'on ne sait pas, dire la contrainte AVANT l'envoi), sur le geste qui subsiste.
import { describe, expect, it, vi } from "vitest";
import { MARQUEUR_REINITIALISATION, connexionMotDePasse, creerCompte, definirMotDePasse, demanderReinitialisationMotDePasse, messageErreur, seDeconnecter } from "../actions";
import type { ClientAuth, ErreurAuth, SessionMinimale } from "../supabaseClient";
import { VERSION_POLITIQUE } from "../../content/mentionsLegales";
import { CLE_METADONNEE_CONSENTEMENT } from "../../storage/consentementStorage";

const SESSION: SessionMinimale = { user: { id: "u-1", email: "benoit@example.com" } };
const ORIGINE = "https://cadence-git-master-benoit3.vercel.app";

/** Faux client minimal : chaque test ne renseigne que ce qu'il exerce. */
function fauxClient(reponses: Partial<ClientAuth> = {}): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    ...reponses,
  };
}

const erreur = (message: string, status?: number): ErreurAuth => ({ message, status });

describe("messageErreur — expliquer la cause réelle, sans effacer le texte d'origine", () => {
  it("traduit le refus du service d'envoi par défaut en pointant la vraie cause", () => {
    // Le cas le plus probable en bêta, et le plus trompeur : ce n'est pas un bug de Cadence, c'est
    // un réglage de tableau de bord (vérifié dans la doc officielle le 04/08/2026).
    const message = messageErreur(erreur("Email address not authorized"));
    expect(message).toMatch(/membres de l'organisation/i);
    expect(message).toContain("Email address not authorized");
  });

  it("cite le plafond réel de 2 messages par heure sur une limite d'envoi", () => {
    expect(messageErreur(erreur("email rate limit exceeded"))).toMatch(/2 messages par heure/);
    expect(messageErreur(erreur("For security purposes, you can only request this after 51 seconds"))).toMatch(/2 messages par heure/);
    expect(messageErreur(erreur("Too many requests", 429))).toMatch(/2 messages par heure/);
  });

  it("dit simplement ce qui s'est passé sur un refus d'identifiants", () => {
    expect(messageErreur(erreur("Invalid login credentials"))).toBe("Adresse e-mail ou mot de passe incorrect.");
  });

  it("n'invente rien sur une adresse déjà inscrite ou non confirmée", () => {
    expect(messageErreur(erreur("Email not confirmed"))).toMatch(/n'a pas encore été confirmée/i);
    expect(messageErreur(erreur("User already registered"))).toMatch(/existe déjà/i);
  });

  it("sur une adresse non confirmée, DIT QUOI FAIRE — devenu le cas central du parcours (06/08/2026)", () => {
    // Avec le lien magique supprimé, c'est l'obstacle n°1 d'un premier lancement : le compte est créé
    // mais la première connexion échoue. Un message qui se contente de constater laisserait
    // l'utilisateur bloqué sans savoir que le lien attend dans sa boîte.
    const message = messageErreur(erreur("Email not confirmed"));
    expect(message).toMatch(/e-mail de confirmation/i);
    expect(message).toMatch(/reviens te connecter/i);
    // Et il dit la bonne contrainte : CE lien-là ne demande pas le même navigateur, contrairement à
    // celui de réinitialisation. Confondre les deux a coûté une session entière.
    expect(message).toMatch(/n'importe quel appareil/i);
  });

  it("AUCUN message ne parle plus de lien magique — il n'existe plus", () => {
    // Garde-fou de vocabulaire : un message qui renverrait vers un chemin supprimé enverrait
    // l'utilisateur chercher un bouton absent de l'écran.
    const messages = [
      messageErreur(erreur("Email not confirmed")),
      messageErreur(erreur("User already registered")),
      messageErreur(erreur("Invalid login credentials")),
      messageErreur(erreur("Email address not authorized")),
    ];
    for (const message of messages) expect(message).not.toMatch(/lien magique/i);
  });

  it("rend TEL QUEL un message qu'il ne reconnaît pas", () => {
    // Un « une erreur est survenue » ferait perdre des heures. Le texte brut, même en anglais, dit
    // au moins la vérité.
    const inconnu = "Database error saving new user";
    expect(messageErreur(erreur(inconnu))).toBe(inconnu);
  });
});

describe("demanderReinitialisationMotDePasse (06/08/2026)", () => {
  it("refuse une adresse incomplète SANS appeler Supabase", async () => {
    // Important : le service par défaut est plafonné à 2 messages par heure. Consommer un envoi pour
    // une adresse manifestement incomplète gâcherait la moitié du quota horaire.
    const client = fauxClient();
    expect(await demanderReinitialisationMotDePasse(client, "benoit", ORIGINE)).toEqual({ ok: false, message: "Adresse e-mail incomplète." });
    expect(client.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("POSE LE MARQUEUR DE RETOUR, sinon la réinitialisation ne réinitialise rien", async () => {
    // LE test qui garde le défaut le plus vicieux de ce parcours : le lien ouvre une SESSION. Sans ce
    // marqueur dans l'URL de retour, App.tsx rendrait le tableau de bord et l'utilisateur repartirait
    // avec le mot de passe qu'il vient justement de déclarer oublié, sans un mot d'explication.
    const client = fauxClient();
    await demanderReinitialisationMotDePasse(client, "  benoit@example.com  ", ORIGINE);
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith("benoit@example.com", { redirectTo: `${ORIGINE}?${MARQUEUR_REINITIALISATION}=1` });
  });

  it("enchaîne le marqueur avec & quand l'origine porte déjà une requête", async () => {
    const client = fauxClient();
    await demanderReinitialisationMotDePasse(client, "benoit@example.com", "https://exemple.fr/?deja=1");
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith("benoit@example.com", { redirectTo: `https://exemple.fr/?deja=1&${MARQUEUR_REINITIALISATION}=1` });
  });

  it("N'AFFIRME PAS qu'un e-mail est parti, et dit la contrainte du navigateur AVANT l'envoi", async () => {
    // Supabase répond la même chose pour une adresse connue et une inconnue (pour qu'on ne puisse pas
    // découvrir qui a un compte) : « un e-mail t'a été envoyé » serait une affirmation sans support.
    // Et ce lien-ci, contrairement à celui de confirmation d'adresse, ouvre une session : il exige le
    // même navigateur. Le taire produirait un échec incompréhensible — la leçon du 04/08/2026.
    const resultat = await demanderReinitialisationMotDePasse(fauxClient(), "benoit@example.com", ORIGINE);
    expect(resultat.ok).toBe(true);
    expect(resultat.message).toMatch(/si un compte existe/i);
    expect(resultat.message).toMatch(/DEPUIS CE NAVIGATEUR/);
  });

  it("remonte l'erreur de Supabase en expliquant la vraie cause", async () => {
    const client = fauxClient({ resetPasswordForEmail: vi.fn(async () => ({ error: erreur("Email address not authorized") })) });
    const resultat = await demanderReinitialisationMotDePasse(client, "testeur@example.com", ORIGINE);
    expect(resultat.ok).toBe(false);
    expect(resultat.message).toMatch(/membres de l'organisation/i);
  });
});

describe("connexionMotDePasse", () => {
  it("refuse une adresse ou un mot de passe manquants sans appeler Supabase", async () => {
    const client = fauxClient();
    expect(await connexionMotDePasse(client, "benoit", "quelquechose")).toEqual({ ok: false, message: "Adresse e-mail incomplète." });
    expect(await connexionMotDePasse(client, "benoit@example.com", "")).toEqual({ ok: false, message: "Mot de passe manquant." });
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it("réussit quand Supabase ouvre bien une session", async () => {
    expect(await connexionMotDePasse(fauxClient(), "benoit@example.com", "motdepasse-solide")).toEqual({ ok: true, message: null });
  });

  it("NE PRÉTEND PAS avoir réussi quand aucune session n'est ouverte, même sans erreur", async () => {
    // Cas non documenté. Afficher « connecté » ici serait un faux feu vert.
    const client = fauxClient({ signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })) });
    const resultat = await connexionMotDePasse(client, "benoit@example.com", "motdepasse-solide");
    expect(resultat.ok).toBe(false);
    expect(resultat.message).toMatch(/aucune session/i);
  });
});

describe("creerCompte", () => {
  it("exige 8 caractères avant d'appeler Supabase", async () => {
    const client = fauxClient();
    const resultat = await creerCompte(client, "benoit@example.com", "court12", ORIGINE);
    expect(resultat).toEqual({ ok: false, message: "Mot de passe trop court : 8 caractères au minimum." });
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it("ne dit JAMAIS « compte créé » quand la confirmation par e-mail est active", async () => {
    // Supabase répond la même chose pour une adresse neuve et pour une adresse déjà inscrite, pour
    // empêcher l'énumération des comptes. On ne peut donc pas affirmer la création, et on le dit.
    const resultat = await creerCompte(fauxClient(), "benoit@example.com", "motdepasse-solide", ORIGINE);
    expect(resultat.ok).toBe(true);
    expect(resultat.message).not.toMatch(/compte créé/i);
    expect(resultat.message).toMatch(/ne dit pas si un compte existait déjà/i);
  });

  it("ne dit rien de plus quand la session est immédiate (confirmation désactivée)", async () => {
    const client = fauxClient({ signUp: vi.fn(async () => ({ data: { session: SESSION }, error: null })) });
    expect(await creerCompte(client, "benoit@example.com", "motdepasse-solide", ORIGINE)).toEqual({ ok: true, message: null });
  });

  it("TRANSPORTE LA PREUVE DU CONSENTEMENT dans les métadonnées — seul instant où c'est possible", async () => {
    // Aucune session n'existe encore, donc RLS interdit d'écrire dans `consentements`. Supabase écrit
    // ces métadonnées au moment même de la création du compte ; `synchroniserConsentement` les
    // recopiera dans la table à la première session (cf. storage/consentementStorage.ts).
    const client = fauxClient();
    const avant = Date.now();
    await creerCompte(client, "nouveau@example.com", "motdepasse-solide", ORIGINE);
    const parametres = vi.mocked(client.signUp).mock.calls[0][0];

    const preuve = parametres.options?.data?.[CLE_METADONNEE_CONSENTEMENT] as { version: string; accepte_le: string };
    expect(preuve).toBeDefined();
    // La VERSION est indispensable : sans elle, la preuve ne dirait pas à quoi la personne a consenti.
    expect(preuve.version).toBe(VERSION_POLITIQUE);
    const instant = Date.parse(preuve.accepte_le);
    expect(Number.isNaN(instant)).toBe(false);
    expect(instant).toBeGreaterThanOrEqual(avant);
  });

  it("garde l'origine de retour EN PLUS des métadonnées — l'ajout de la preuve n'écrase rien", async () => {
    const client = fauxClient();
    await creerCompte(client, "nouveau@example.com", "motdepasse-solide", ORIGINE);
    const parametres = vi.mocked(client.signUp).mock.calls[0][0];
    expect(parametres.options?.emailRedirectTo).toBe(ORIGINE);
  });
});

describe("definirMotDePasse", () => {
  it("exige 8 caractères avant d'appeler Supabase", async () => {
    const client = fauxClient();
    const resultat = await definirMotDePasse(client, "court12");
    expect(resultat).toEqual({ ok: false, message: "Mot de passe trop court : 8 caractères au minimum." });
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it("agit sur la session en cours, sans redemander le mot de passe actuel", async () => {
    const client = fauxClient();
    await definirMotDePasse(client, "motdepasse-solide");
    expect(client.updateUser).toHaveBeenCalledWith({ password: "motdepasse-solide" });
  });

  it("confirme l'enregistrement sans jamais dire « connecté » (ce n'est pas ce que ça fait)", async () => {
    const resultat = await definirMotDePasse(fauxClient(), "motdepasse-solide");
    expect(resultat).toEqual({ ok: true, message: expect.stringMatching(/enregistré/i) });
  });

  it("remonte l'erreur de Supabase telle qu'elle est traduite", async () => {
    const client = fauxClient({ updateUser: vi.fn(async () => ({ error: erreur("password should be at least 6 characters") })) });
    const resultat = await definirMotDePasse(client, "motdepasse-solide");
    expect(resultat.ok).toBe(false);
    expect(resultat.message).toMatch(/8 caractères au minimum/);
  });
});

describe("seDeconnecter", () => {
  it("réussit silencieusement", async () => {
    expect(await seDeconnecter(fauxClient())).toEqual({ ok: true, message: null });
  });

  it("remonte l'échec plutôt que de laisser croire à une déconnexion", async () => {
    const client = fauxClient({ signOut: vi.fn(async () => ({ error: erreur("network error") })) });
    expect(await seDeconnecter(client)).toEqual({ ok: false, message: "network error" });
  });
});
