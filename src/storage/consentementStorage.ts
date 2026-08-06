import type { ClientAuth, ClientConsentements, ErreurPostgrest } from "../auth/supabaseClient";

/**
 * LA PREUVE DU CONSENTEMENT À LA POLITIQUE DE CONFIDENTIALITÉ — table `consentements`, migration 0004.
 *
 * Demandé par Benoît le 06/08/2026 : « pour créer un compte il faut accepter la politique de
 * confidentialité, une seule fois suffit. Je veux que cette preuve soit stockée. »
 *
 * ⚠️ LE PROBLÈME QUE CE MODULE EXISTE POUR RÉSOUDRE. Au moment où la case est cochée, AUCUNE SESSION
 * N'EXISTE : `signUp` avec confirmation par e-mail n'en ouvre pas, et RLS interdit d'écrire dans
 * `consentements` sans `auth.uid()`. Écrire la preuve « à l'inscription » est donc littéralement
 * impossible. D'où le trajet en deux temps :
 *
 *   1. À LA CRÉATION DU COMPTE — la version du texte et l'instant du clic partent dans
 *      `signUp(options.data)`. Supabase les écrit dans `raw_user_meta_data` au moment même où il crée
 *      le compte : atomique, sans session requise, et hors de portée d'un vidage de navigateur.
 *   2. À LA PREMIÈRE SESSION — `synchroniserConsentement` les recopie dans `consentements`, qui
 *      devient la preuve durable, interrogeable, et que l'utilisateur ne peut ni modifier ni
 *      supprimer (aucune politique RLS `update`/`delete`, et `ClientConsentements` n'expose pas ces
 *      méthodes).
 *
 * ⚠️ POURQUOI L'ÉTAPE 2 NE SUFFIT PAS SEULE, ET POURQUOI L'ÉTAPE 1 NON PLUS.
 *  · La métadonnée seule ne vaudrait pas preuve : `updateUser` permet à chacun de réécrire ses
 *    propres métadonnées. C'est un porteur, pas un coffre.
 *  · La table seule aurait exigé de mémoriser le clic dans le navigateur en attendant la première
 *    session — perdu au premier vidage de cache, et daté par le client sans garde-fou.
 * Les deux ensemble : l'instant est capté par Supabase à la création, la conservation est faite par
 * une table que le sujet ne peut pas altérer.
 *
 * ⚠️ CE MODULE N'INVENTE JAMAIS UN CONSENTEMENT. Un compte créé avant le 06/08/2026 (ou par lien
 * magique, quand ce chemin créait encore des comptes) n'a pas de métadonnée : le statut rendu est
 * `aucuneMetadonnee`, et RIEN n'est écrit. Écrire une ligne avec la date du jour donnerait une preuve
 * fausse — le contraire exact de ce qui est demandé. Ces comptes-là restent sans preuve, et c'est la
 * vérité à afficher si la question se pose un jour.
 */

/** Nom de la clé dans `raw_user_meta_data`. Fixé ici une seule fois, jamais recopié en chaîne. */
export const CLE_METADONNEE_CONSENTEMENT = "consentement_politique";

/** Le nom de la table, fixé ici une seule fois — même principe que `BUCKET_JUSTIFICATIFS`. */
export const TABLE_CONSENTEMENTS = "consentements";

export interface Consentement {
  /** `VERSION_POLITIQUE` au moment du clic (content/mentionsLegales.ts). */
  version: string;
  /** Instant du clic, en ISO 8601. */
  accepteLe: string;
}

/**
 * Construit la métadonnée à passer à `signUp(options.data)`.
 *
 * `maintenant` est injectable (même patron que `documentsStorage.construireCheminStockage`) : les
 * tests comparent une valeur stable plutôt qu'une horloge.
 */
export function metadonneeConsentement(version: string, maintenant: () => Date = () => new Date()): Record<string, unknown> {
  return {
    [CLE_METADONNEE_CONSENTEMENT]: {
      version,
      accepte_le: maintenant().toISOString(),
    },
  };
}

/**
 * Relit la métadonnée écrite par `signUp`, en se méfiant de tout : ces données viennent du serveur et
 * traversent du JSON. Une forme inattendue rend `null` (donc « pas de preuve »), jamais un objet
 * partiel qui ferait écrire une ligne bancale.
 */
export function consentementDepuisMetadonnees(metadonnees: Record<string, unknown> | undefined): Consentement | null {
  const brut = metadonnees?.[CLE_METADONNEE_CONSENTEMENT];
  if (typeof brut !== "object" || brut === null) return null;
  const { version, accepte_le } = brut as Record<string, unknown>;
  if (typeof version !== "string" || version.length === 0) return null;
  if (typeof accepte_le !== "string" || accepte_le.length === 0) return null;
  // Une date illisible vaut absence de preuve : mieux vaut aucune ligne qu'une ligne fausse.
  if (Number.isNaN(Date.parse(accepte_le))) return null;
  return { version, accepteLe: accepte_le };
}

export type ResultatSynchronisation =
  /** La preuve est en base — soit elle vient d'être écrite, soit elle y était déjà. */
  | { statut: "enregistre"; version: string }
  /** Aucune métadonnée de consentement : compte antérieur au 06/08/2026. Rien n'est écrit, rien n'est inventé. */
  | { statut: "aucuneMetadonnee" }
  /** Le serveur n'a pas répondu comme attendu. L'app continue : ce n'est jamais bloquant. */
  | { statut: "echec"; message: string };

function messageDe(incident: unknown): string {
  return incident instanceof Error ? incident.message : String(incident);
}

/** `23505` = violation d'unicité : la preuve existait déjà. C'est un SUCCÈS, pas une panne. */
function estDejaEnregistre(erreur: ErreurPostgrest): boolean {
  return erreur.code === "23505";
}

/**
 * Y a-t-il déjà une preuve pour cette version du texte ?
 *
 * Sert à « une seule fois suffit » : une fois la ligne présente, plus rien n'est redemandé ni réécrit.
 * Le filtre porte sur `user_id` seul, et la version est comparée en mémoire — `ClientConsentements`
 * n'expose qu'un `eq`, et ce n'est pas un manque : deux `eq` chaînés ne servent qu'au verrou
 * d'écriture de la phase 5, pas ici.
 */
export async function consentementDejaEnregistre(
  client: ClientConsentements,
  utilisateurId: string,
  version: string,
): Promise<{ present: boolean } | { erreur: string }> {
  try {
    const { data, error } = await client.from(TABLE_CONSENTEMENTS).select("version_texte").eq("user_id", utilisateurId);
    if (error) return { erreur: error.message };
    return { present: (data ?? []).some((ligne) => ligne.version_texte === version) };
  } catch (incident: unknown) {
    return { erreur: messageDe(incident) };
  }
}

/**
 * Recopie dans `consentements` la preuve transmise à la création du compte.
 *
 * ⚠️ NE JAMAIS RENDRE CETTE FONCTION BLOQUANTE POUR L'APPLICATION. Son échec (réseau, migration 0004
 * pas encore appliquée) ne doit empêcher personne d'utiliser Cadence : le consentement a bien été
 * donné, et sa métadonnée reste intacte côté Supabase — la recopie sera retentée à la session
 * suivante. Un écran bloquant ici transformerait un défaut d'archivage en panne totale.
 */
export async function synchroniserConsentement(clientAuth: ClientAuth, clientConsentements: ClientConsentements): Promise<ResultatSynchronisation> {
  try {
    const { data, error } = await clientAuth.getUser();
    if (error) return { statut: "echec", message: error.message };
    const utilisateur = data?.user;
    if (!utilisateur) return { statut: "echec", message: "Aucun utilisateur dans la session en cours." };

    const consentement = consentementDepuisMetadonnees(utilisateur.user_metadata);
    if (!consentement) return { statut: "aucuneMetadonnee" };

    const dejaLa = await consentementDejaEnregistre(clientConsentements, utilisateur.id, consentement.version);
    if ("erreur" in dejaLa) return { statut: "echec", message: dejaLa.erreur };
    if (dejaLa.present) return { statut: "enregistre", version: consentement.version };

    const { error: erreurInsertion } = await clientConsentements.from(TABLE_CONSENTEMENTS).insert({
      user_id: utilisateur.id,
      version_texte: consentement.version,
      // `accepte_le` vient du clic, PAS de `now()` : dater le consentement du jour de la recopie
      // serait écrire une date fausse (cf. l'avertissement de la migration 0004).
      accepte_le: consentement.accepteLe,
    });
    // Course entre deux appareils qui ouvrent la première session en même temps : le perdant reçoit
    // 23505. La preuve est en base, donc c'est gagné — pas une erreur à remonter.
    if (erreurInsertion && !estDejaEnregistre(erreurInsertion)) return { statut: "echec", message: erreurInsertion.message };

    return { statut: "enregistre", version: consentement.version };
  } catch (incident: unknown) {
    return { statut: "echec", message: messageDe(incident) };
  }
}
