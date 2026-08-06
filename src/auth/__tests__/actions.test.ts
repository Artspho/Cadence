// Phase 2 de la refonte Supabase — les quatre gestes, et surtout ce qu'ils AFFIRMENT.
//
// Devoir n°2 appliqué à l'authentification : ne jamais annoncer un succès que Supabase n'a pas
// confirmé, et ne jamais remplacer une erreur par un message vague qui ferait chercher un bug là où
// il n'y en a pas.
import { describe, expect, it, vi } from "vitest";
import { connexionMotDePasse, creerCompte, definirMotDePasse, demanderLienMagique, messageErreur, seDeconnecter } from "../actions";
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
    signInWithOtp: vi.fn(async () => ({ error: null })),
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

  it("rend TEL QUEL un message qu'il ne reconnaît pas", () => {
    // Un « une erreur est survenue » ferait perdre des heures. Le texte brut, même en anglais, dit
    // au moins la vérité.
    const inconnu = "Database error saving new user";
    expect(messageErreur(erreur(inconnu))).toBe(inconnu);
  });
});

describe("demanderLienMagique", () => {
  it("refuse une adresse incomplète SANS appeler Supabase", () => {
    // Important : le service par défaut est plafonné à 2 messages par heure. Consommer un envoi pour
    // une adresse manifestement incomplète gâcherait la moitié du quota horaire.
    const client = fauxClient();
    return demanderLienMagique(client, "benoit", ORIGINE).then((resultat) => {
      expect(resultat).toEqual({ ok: false, message: "Adresse e-mail incomplète." });
      expect(client.signInWithOtp).not.toHaveBeenCalled();
    });
  });

  it("transmet l'origine de retour telle quelle", async () => {
    const client = fauxClient();
    await demanderLienMagique(client, "  benoit@example.com  ", ORIGINE);
    expect(client.signInWithOtp).toHaveBeenCalledWith({ email: "benoit@example.com", options: { emailRedirectTo: ORIGINE, shouldCreateUser: false } });
  });

  it("NE CRÉE JAMAIS DE COMPTE (shouldCreateUser: false) — sinon inscription sans case ni preuve", async () => {
    // Le défaut de Supabase est `true`. Sans ce paramètre explicite, ce bouton devenait la porte
    // d'inscription la plus utilisée, sans consentement recueilli ni conservé (06/08/2026).
    const client = fauxClient();
    await demanderLienMagique(client, "inconnu@example.com", ORIGINE);
    const parametres = vi.mocked(client.signInWithOtp).mock.calls[0][0];
    expect(parametres.options?.shouldCreateUser).toBe(false);
  });

  it("traduit le refus d'une adresse sans compte en indiquant où créer le compte", async () => {
    // Conséquence directe de `shouldCreateUser: false` : Supabase refuse au lieu de créer en silence.
    const client = fauxClient({ signInWithOtp: vi.fn(async () => ({ error: erreur("Signups not allowed for otp") })) });
    const resultat = await demanderLienMagique(client, "inconnu@example.com", ORIGINE);
    expect(resultat.ok).toBe(false);
    expect(resultat.message).toMatch(/aucun compte n'existe pour cette adresse/i);
    expect(resultat.message).toMatch(/créer un compte/i);
  });

  it("annonce une demande ACCEPTÉE, pas un e-mail arrivé, et prévient pour le navigateur", async () => {
    // Le service par défaut est « best-effort », sans garantie de livraison : « e-mail envoyé »
    // serait une affirmation que Supabase ne fait pas. Et le lien PKCE ne fonctionne que dans le
    // navigateur qui l'a demandé — le taire produirait un échec incompréhensible.
    const resultat = await demanderLienMagique(fauxClient(), "benoit@example.com", ORIGINE);
    expect(resultat.ok).toBe(true);
    expect(resultat.message).toMatch(/si l'adresse correspond/i);
    expect(resultat.message).toMatch(/CE navigateur/);
  });

  it("remonte l'erreur de Supabase", async () => {
    const client = fauxClient({ signInWithOtp: vi.fn(async () => ({ error: erreur("Email address not authorized") })) });
    const resultat = await demanderLienMagique(client, "testeur@example.com", ORIGINE);
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
