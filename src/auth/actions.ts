import type { ClientAuth, ErreurAuth } from "./supabaseClient";

/**
 * Les quatre gestes possibles : demander un lien magique, se connecter par mot de passe, créer un
 * compte, se déconnecter.
 *
 * RÈGLE DE CE FICHIER : aucune erreur n'est avalée, et aucun succès n'est inventé. Un message
 * inconnu de Supabase est affiché TEL QUEL plutôt que remplacé par un « une erreur est survenue »
 * qui empêcherait de comprendre. Et `creerCompte` ne dit jamais « compte créé » quand Supabase ne
 * l'a pas confirmé (cf. le commentaire sur l'énumération d'adresses plus bas).
 */
export type ResultatAuth =
  | { ok: true; message: string | null }
  | { ok: false; message: string };

/** Longueur minimale exigée par Cadence. Supabase, lui, se contente de 6 par défaut. */
export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 8;

/**
 * Traduit une erreur Supabase en français, en gardant le texte d'origine quand on ne le reconnaît
 * pas.
 *
 * Les deux premiers cas sont les plus probables aujourd'hui, et tous deux viennent du SMTP par
 * défaut de Supabase, vérifié dans la documentation officielle le 04/08/2026 :
 *  · il n'envoie QUE vers les adresses membres de l'organisation du projet (« Email address not
 *    authorized » pour toutes les autres) ;
 *  · il est plafonné à 2 messages par heure, sans garantie de livraison.
 * Un message générique ferait chercher un bug dans le code pendant des heures alors que le blocage
 * est un réglage de tableau de bord.
 */
export function messageErreur(erreur: ErreurAuth): string {
  const brut = erreur.message;
  const repere = brut.toLowerCase();

  if (repere.includes("not authorized")) {
    return (
      "Supabase a refusé d'envoyer l'e-mail à cette adresse. Le service d'envoi par défaut ne " +
      "desservant que les adresses membres de l'organisation du projet, il faut un serveur d'envoi " +
      "dédié pour toute autre adresse. (Message d'origine : " + brut + ")"
    );
  }
  if (repere.includes("rate limit") || repere.includes("only request this after") || erreur.status === 429) {
    return (
      "Limite d'envoi atteinte. Le service d'envoi par défaut de Supabase est plafonné à " +
      "2 messages par heure. (Message d'origine : " + brut + ")"
    );
  }
  if (repere.includes("invalid login credentials")) {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (repere.includes("email not confirmed")) {
    return "Ce compte existe, mais son adresse n'a pas encore été confirmée par e-mail.";
  }
  if (repere.includes("user already registered") || repere.includes("already been registered")) {
    return "Un compte existe déjà pour cette adresse. Utilise « Se connecter » ou le lien magique.";
  }
  if (repere.includes("password should be at least")) {
    return `Mot de passe trop court : ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum. (Message d'origine : ${brut})`;
  }
  return brut;
}

function adresseValide(email: string): boolean {
  // Contrôle volontairement grossier : un « @ » entouré de texte, sans point exigé. Le juge de la
  // validité d'une adresse, c'est le serveur qui envoie ; une expression régulière trop stricte
  // refuserait des adresses légitimes, ce qui serait un faux « Bloqué ».
  const parties = email.trim().split("@");
  return parties.length === 2 && parties[0].length > 0 && parties[1].length > 0;
}

/**
 * Demande un lien magique.
 *
 * `emailRedirectTo` vaut l'origine courante, donc le lien ramène là d'où il a été demandé — ce qui
 * respecte la règle d'origine canonique du projet (une URL de déploiement Vercel et l'URL de branche
 * sont deux stockages distincts).
 * ⚠️ L'origine doit figurer dans Supabase > Authentication > URL Configuration, sinon le retour est
 * refusé.
 */
export async function demanderLienMagique(client: ClientAuth, email: string, origine: string): Promise<ResultatAuth> {
  if (!adresseValide(email)) return { ok: false, message: "Adresse e-mail incomplète." };

  const { error } = await client.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: origine } });
  if (error) return { ok: false, message: messageErreur(error) };

  // Formulation prudente et exacte : Supabase confirme avoir ACCEPTÉ la demande, pas que le message
  // soit arrivé (le service par défaut est « best-effort », sans garantie de livraison).
  return {
    ok: true,
    message:
      "Demande envoyée. Si l'adresse correspond à un compte autorisé, un lien arrive par e-mail. " +
      "Ouvre-le depuis CE navigateur : le lien ne peut pas ouvrir la session ailleurs.",
  };
}

export async function connexionMotDePasse(client: ClientAuth, email: string, motDePasse: string): Promise<ResultatAuth> {
  if (!adresseValide(email)) return { ok: false, message: "Adresse e-mail incomplète." };
  if (motDePasse.length === 0) return { ok: false, message: "Mot de passe manquant." };

  const { data, error } = await client.signInWithPassword({ email: email.trim(), password: motDePasse });
  if (error) return { ok: false, message: messageErreur(error) };
  if (!data.session) {
    // Ni erreur ni session : cas non documenté. On ne prétend pas que c'est un succès.
    return { ok: false, message: "Supabase n'a signalé aucune erreur mais n'a ouvert aucune session." };
  }
  return { ok: true, message: null };
}

/**
 * Crée un compte par mot de passe.
 *
 * ⚠️ POURQUOI LE MESSAGE DE SUCCÈS EST AUSSI PRUDENT : quand la confirmation par e-mail est active,
 * Supabase répond la même chose pour une adresse nouvelle et pour une adresse DÉJÀ INSCRITE — c'est
 * délibéré de leur part, pour qu'un inconnu ne puisse pas découvrir qui a un compte. On ne peut donc
 * pas affirmer « compte créé », et on ne le fait pas.
 */
export async function creerCompte(client: ClientAuth, email: string, motDePasse: string, origine: string): Promise<ResultatAuth> {
  if (!adresseValide(email)) return { ok: false, message: "Adresse e-mail incomplète." };
  if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
    return { ok: false, message: `Mot de passe trop court : ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum.` };
  }

  const { data, error } = await client.signUp({ email: email.trim(), password: motDePasse, options: { emailRedirectTo: origine } });
  if (error) return { ok: false, message: messageErreur(error) };

  // Session immédiate = la confirmation par e-mail est désactivée sur le projet : la connexion est
  // faite, l'écouteur de session s'en apercevra tout seul.
  if (data.session) return { ok: true, message: null };

  return {
    ok: true,
    message:
      "Demande enregistrée. Un e-mail de confirmation part vers cette adresse si elle est encore " +
      "libre. Supabase ne dit pas si un compte existait déjà — c'est volontaire de sa part.",
  };
}

export async function seDeconnecter(client: ClientAuth): Promise<ResultatAuth> {
  const { error } = await client.signOut();
  if (error) return { ok: false, message: messageErreur(error) };
  return { ok: true, message: null };
}
