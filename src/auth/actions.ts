import type { ClientAuth, ErreurAuth } from "./supabaseClient";
import { VERSION_POLITIQUE } from "../content/mentionsLegales";
import { metadonneeConsentement } from "../storage/consentementStorage";

/**
 * Les cinq gestes possibles : se connecter par mot de passe, créer un compte, demander la
 * réinitialisation du mot de passe, définir un mot de passe sur une session ouverte, se déconnecter.
 *
 * ⚠️ `demanderLienMagique` A ÉTÉ SUPPRIMÉ LE 06/08/2026, SUR DEMANDE DE BENOÎT — ne pas le
 * rétablir sans lui demander. Motif, dans ses mots : le lien magique « ne sert à rien et me gonfle ».
 * Il avait raison sur le fond : c'était une connexion SANS mot de passe, donc un doublon du chemin
 * mot de passe, et il portait seul la contrainte du même navigateur (PKCE). Le parcours retenu est le
 * standard : créer un compte (adresse + mot de passe) → confirmer l'adresse par e-mail → se
 * connecter avec adresse + mot de passe → « mot de passe oublié » en secours.
 * `signInWithOtp` a été retiré de `ClientAuth` en même temps, exprès (cf. auth/supabaseClient.ts).
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
  // Ce cas devient CENTRAL avec le parcours du 06/08/2026 : l'adresse doit être confirmée par e-mail
  // avant la première connexion. Le message dit donc quoi faire, et pas seulement ce qui bloque.
  if (repere.includes("email not confirmed")) {
    return (
      "Ce compte existe, mais son adresse n'a pas encore été confirmée. Ouvre l'e-mail de " +
      "confirmation reçu à la création du compte, clique sur son lien, puis reviens te connecter ici. " +
      "Ce lien-là peut être ouvert depuis n'importe quel appareil, y compris ton téléphone."
    );
  }
  if (repere.includes("user already registered") || repere.includes("already been registered")) {
    return "Un compte existe déjà pour cette adresse. Utilise « Se connecter », ou « Mot de passe oublié » si tu ne l'as plus.";
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
 * Le paramètre que Cadence ajoute à l'URL de retour du lien de réinitialisation, pour SAVOIR au
 * retour qu'il faut demander un nouveau mot de passe.
 *
 * POURQUOI IL EST NÉCESSAIRE, et ce n'est pas un détail de confort : le lien de réinitialisation
 * OUVRE UNE SESSION (c'est ce qui autorise `updateUser`). Sans ce marqueur, `App.tsx` verrait une
 * session normale, rendrait le tableau de bord, et l'utilisateur ne serait JAMAIS invité à choisir un
 * nouveau mot de passe — il repartirait avec l'ancien, celui qu'il a précisément oublié, sans
 * comprendre pourquoi. Supabase ne garantit pas de transmettre `type=recovery` jusqu'à l'URL finale
 * du flux PKCE ; ce marqueur-ci, lui, nous appartient.
 */
export const MARQUEUR_REINITIALISATION = "reinitialisation";

/**
 * Demande l'e-mail de réinitialisation du mot de passe (« mot de passe oublié »).
 *
 * `redirectTo` ramène sur l'origine courante, MARQUEUR COMPRIS — même règle d'origine canonique que
 * le reste du projet (une URL de déploiement Vercel et l'URL de branche sont deux stockages
 * distincts).
 * ⚠️ L'origine doit figurer dans Supabase > Authentication > URL Configuration, sinon le retour est
 * refusé.
 *
 * ⚠️ CE MESSAGE NE PROMET PAS QU'UN E-MAIL EXISTE POUR CETTE ADRESSE, et c'est délibéré : Supabase
 * répond la même chose pour une adresse connue et une inconnue, pour qu'on ne puisse pas découvrir
 * qui a un compte. Écrire « un e-mail t'a été envoyé » serait une affirmation que rien ne soutient.
 */
export async function demanderReinitialisationMotDePasse(client: ClientAuth, email: string, origine: string): Promise<ResultatAuth> {
  if (!adresseValide(email)) return { ok: false, message: "Adresse e-mail incomplète." };

  const separateur = origine.includes("?") ? "&" : "?";
  const { error } = await client.resetPasswordForEmail(email.trim(), { redirectTo: `${origine}${separateur}${MARQUEUR_REINITIALISATION}=1` });
  if (error) return { ok: false, message: messageErreur(error) };

  return {
    ok: true,
    message:
      "Demande enregistrée. Si un compte existe pour cette adresse, un lien de réinitialisation " +
      "arrive par e-mail. ⚠️ Celui-ci doit être ouvert DEPUIS CE NAVIGATEUR : il ouvre une session " +
      "pour te laisser choisir un nouveau mot de passe, et la clé de cette session est ici.",
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

  // La preuve du consentement voyage ICI, et nulle part ailleurs : c'est le seul instant où elle peut
  // être écrite de façon atomique avec la création du compte, sans session (cf.
  // storage/consentementStorage.ts). L'appelant a déjà exigé la case cochée — cette fonction n'est
  // jamais atteinte sans elle.
  const { data, error } = await client.signUp({
    email: email.trim(),
    password: motDePasse,
    options: { emailRedirectTo: origine, data: metadonneeConsentement(VERSION_POLITIQUE) },
  });
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

/**
 * Définit (ou change) le mot de passe d'une session déjà ouverte.
 *
 * Deux appelants, et c'est la même opération : la section « Compte » de « Mon profil » (changer son
 * mot de passe quand on est connecté) et l'écran de retour du lien de réinitialisation
 * (`EcranNouveauMotDePasse.tsx`), où la session vient d'être ouverte par le lien lui-même.
 *
 * Ne demande pas le mot de passe actuel : `updateUser` agit sur la session en cours, pas sur les
 * identifiants — c'est exactement ce qui rend la réinitialisation possible pour quelqu'un qui, par
 * définition, ne connaît plus son mot de passe.
 */
export async function definirMotDePasse(client: ClientAuth, motDePasse: string): Promise<ResultatAuth> {
  if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
    return { ok: false, message: `Mot de passe trop court : ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères au minimum.` };
  }

  const { error } = await client.updateUser({ password: motDePasse });
  if (error) return { ok: false, message: messageErreur(error) };
  return { ok: true, message: "Mot de passe enregistré. C'est celui-ci qu'il faudra utiliser pour te connecter désormais." };
}

export async function seDeconnecter(client: ClientAuth): Promise<ResultatAuth> {
  const { error } = await client.signOut();
  if (error) return { ok: false, message: messageErreur(error) };
  return { ok: true, message: null };
}
