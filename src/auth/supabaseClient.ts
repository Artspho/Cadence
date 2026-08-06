import { createClient } from "@supabase/supabase-js";

/**
 * PHASE 2 DE LA REFONTE SUPABASE — L'AUTHENTIFICATION, ET RIEN D'AUTRE.
 *
 * Ce module n'ouvre qu'une porte : savoir qui est connecté. Il n'écrit AUCUNE donnée métier dans
 * Supabase et n'en lit aucune. Les contrats, les frais réels et le profil continuent de vivre dans
 * le `localStorage` (cf. src/storage/localStorageAdapter.ts) jusqu'à la bascule de la phase 5.
 * C'est ce qui rend cette phase incapable de perdre quoi que ce soit : elle ne touche pas aux
 * données.
 *
 * LA PROMESSE QUE CE FICHIER DOIT TENIR MÉCANIQUEMENT : Cadence doit continuer de s'ouvrir et de
 * fonctionner SANS COMPTE, exactement comme avant. D'où le contrat de `construireClientAuth` :
 * configuration absente ou invalide => `null`, jamais une exception. Un `throw` ici remonterait
 * jusqu'au rendu de l'app et transformerait « la connexion n'est pas configurée » en « Cadence ne
 * démarre plus » — soit exactement la panne que la promesse interdit.
 */

/**
 * La surface d'authentification dont Cadence a besoin, et elle seule.
 *
 * Pourquoi une interface étroite plutôt que le type `SupabaseClient` complet : les tests fournissent
 * un faux client de quelques lignes au lieu de simuler toute la bibliothèque. C'est la même
 * conception que l'uploader injecté d'`envoyerJustificatifsLocaux` — celle qui a permis de changer
 * la destination des justificatifs (Drive -> Supabase Storage) sans réécrire l'appelant.
 *
 * `client.auth` de @supabase/supabase-js satisfait cette interface telle quelle.
 */
export interface ClientAuth {
  getSession(): Promise<{ data: { session: SessionMinimale | null }; error: ErreurAuth | null }>;
  onAuthStateChange(rappel: (evenement: string, session: SessionMinimale | null) => void): {
    data: { subscription: { unsubscribe: () => void } };
  };
  signInWithPassword(parametres: { email: string; password: string }): Promise<{ data: { session: SessionMinimale | null }; error: ErreurAuth | null }>;
  /**
   * Demande l'e-mail de réinitialisation du mot de passe.
   *
   * ⚠️ `signInWithOtp` A ÉTÉ RETIRÉ DE CETTE SURFACE LE 06/08/2026 — ne pas le rétablir sans demander.
   * Le lien magique (une connexion SANS mot de passe) a été supprimé sur décision de Benoît : il
   * n'apportait rien dès lors qu'un mot de passe existe, et il portait à lui seul la contrainte la
   * plus pénible du projet (ouvrir le lien dans le navigateur qui l'a demandé, cf. `flowType: "pkce"`
   * plus bas). Le retirer du TYPE et pas seulement de l'interface est délibéré : tant qu'il figurait
   * ici, un futur appelant pouvait le rappeler en croyant le chemin encore soutenu.
   *
   * Ce qui subsiste par e-mail, et qui n'est PAS un lien magique : la confirmation d'adresse (émise
   * par `signUp`, elle ne fait que prouver l'adresse) et cette réinitialisation-ci. Cette dernière,
   * elle, ouvre bien une session de récupération — donc elle garde la contrainte PKCE du même
   * navigateur, et l'interface le dit.
   */
  resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: ErreurAuth | null }>;
  /**
   * `options.data` alimente `raw_user_meta_data`, écrit par Supabase AU MOMENT MÊME de la création du
   * compte. C'est le seul endroit où le consentement peut voyager : à cet instant aucune session
   * n'existe, donc RLS interdit d'écrire dans `public.consentements` (cf. migration 0004).
   */
  signUp(parametres: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string; data?: Record<string, unknown> };
  }): Promise<{ data: { session: SessionMinimale | null }; error: ErreurAuth | null }>;
  signOut(): Promise<{ error: ErreurAuth | null }>;
  /**
   * Définit ou change le mot de passe d'une session déjà ouverte. Deux appelants : « Mon profil » →
   * Compte, et l'écran de retour du lien de réinitialisation (où la session vient d'être ouverte par
   * le lien lui-même — c'est ce qui rend la réinitialisation possible sans connaître l'ancien).
   */
  updateUser(attributs: { password: string }): Promise<{ error: ErreurAuth | null }>;
  /**
   * Lit l'utilisateur de la session en cours, métadonnées comprises — la seule façon de retrouver le
   * consentement transmis à `signUp` pour le recopier dans `public.consentements` à la première
   * session. Lecture seule : rien ici n'écrit de métadonnée.
   */
  getUser(): Promise<{ data: { user: UtilisateurMinimal | null }; error: ErreurAuth | null }>;
}

/** L'utilisateur tel que `getUser` le rend, réduit à ce que Cadence lit vraiment. */
export interface UtilisateurMinimal {
  id: string;
  email?: string;
  /** `raw_user_meta_data` côté SQL. Contient `consentement_politique` pour les comptes créés depuis le 06/08/2026. */
  user_metadata?: Record<string, unknown>;
}

export interface SessionMinimale {
  user: { id: string; email?: string };
}

export interface ErreurAuth {
  message: string;
  /** Code HTTP quand la bibliothèque l'expose. Sert à distinguer un 429 d'un refus d'identifiants. */
  status?: number;
}

/**
 * ⚠️ `ClientDonnees` (phase 3) A ÉTÉ SUPPRIMÉ À LA PHASE 5, LE 05/08/2026 — ne pas le rétablir.
 *
 * Il n'exposait qu'un `upsert`, ce qui était exactement ce qu'il fallait quand Supabase ne recevait
 * qu'une copie : écrire sans condition, sans jamais pouvoir lire. Depuis la bascule, c'est devenu la
 * pire surface possible. Un `upsert` REMPLACE la ligne sans regarder ce qu'elle contient — il aurait
 * donc contourné le verrou de `ClientSourceDonnees` et rendu possible l'écrasement entre appareils
 * que toute la phase 5 installe pour empêcher.
 *
 * Le supprimer plutôt que le laisser dormant est délibéré : un module capable d'écrire sans condition,
 * même inutilisé, finit par être rappelé — y compris par une session future de bon aloi qui le
 * croirait toujours d'actualité. Toute écriture passe désormais par `ecrireEtatServeur`.
 */

/**
 * La surface de LECTURE SEULE, introduite par la PHASE 4 pour le panneau de vérification chiffrée.
 *
 * Conservée après la bascule, et distincte de `ClientSourceDonnees` : `VerificationServeur` compare
 * et rend un verdict, il n'a aucune raison de pouvoir écrire. Lui donner la surface complète
 * n'apporterait rien et ouvrirait une porte inutile.
 */
export interface ClientLectureDonnees {
  from(table: string): {
    select(colonnes: string): {
      eq(
        colonne: string,
        valeur: string,
      ): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: ErreurAuth | null }>;
      };
    };
  };
}

/**
 * Erreur telle que PostgREST la rend, avec son code SQLSTATE — distincte d'`ErreurAuth` exprès.
 *
 * `code` n'est pas un luxe de diagnostic : `23505` (violation d'unicité) est ce qui permet de
 * distinguer « la ligne existait déjà, quelqu'un a écrit avant moi » d'une panne réseau. Les deux
 * doivent conduire à des écrans différents — refus de conflit d'un côté, indisponibilité de l'autre —
 * donc les confondre afficherait une cause fausse.
 */
export interface ErreurPostgrest {
  message: string;
  /** Code SQLSTATE quand PostgREST le fournit. `23505` = la ligne existe déjà. */
  code?: string;
}

/**
 * LA SURFACE DE LA PHASE 5 — lire l'état, et l'écrire SOUS CONDITION.
 *
 * Type distinct, et non un élargissement de `ClientLectureDonnees` (phase 4), qui doit rester
 * incapable d'écrire : lui ajouter des méthodes aurait levé cette interdiction en silence pour du
 * code déjà écrit qui n'a pas été relu pour la bascule.
 *
 * ⚠️ `update` expose DEUX `eq` chaînés, et c'est le cœur du verrou : le premier filtre l'utilisateur,
 * le second exige que `maj_le` vaille encore ce qui a été lu. Une écriture qui ne peut pas nommer la
 * version qu'elle remplace n'est pas exprimable avec ce type — c'est voulu.
 *
 * Pas d'`upsert` ici, alors que la phase 3 s'en sert : un upsert écrase la ligne existante sans rien
 * demander, ce qui est exactement l'écrasement entre appareils que cette phase installe pour
 * empêcher. La première écriture passe donc par `insert`, qui échoue si la ligne existe déjà.
 */
export interface ClientSourceDonnees {
  from(table: string): {
    select(colonnes: string): {
      eq(
        colonne: string,
        valeur: string,
      ): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: ErreurPostgrest | null }>;
      };
    };
    insert(ligne: Record<string, unknown>): {
      select(colonnes: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
    };
    update(valeurs: Record<string, unknown>): {
      eq(
        colonne: string,
        valeur: string,
      ): {
        eq(
          colonne: string,
          valeur: string,
        ): {
          select(colonnes: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
        };
      };
    };
  };
}

/**
 * LA SURFACE DE LA PHASE 6 — la table `documents` (une ligne par fichier, pas une ligne par
 * utilisateur comme `donnees_utilisateur`).
 *
 * Distincte de `ClientSourceDonnees` à dessein : celle-ci porte le verrou `maj_le` propre à une
 * ligne UNIQUE par utilisateur, un concept qui ne s'applique pas ici — chaque document est créé une
 * fois (l'unicité vient de `chemin_stockage_unique`, pas d'un jeton de version), et une correction
 * de métadonnées (ex. « corriger le type ») cible sa propre ligne par `id`, protégée par RLS. Pas de
 * verrou de concurrence à exprimer, donc pas de deuxième `eq` chaîné sur `update`.
 *
 * `order` sur `select` sert à lister « Mon dossier » du plus récent au plus ancien sans le refaire
 * à la main côté client à chaque appelant.
 */
export interface ClientDocuments {
  from(table: string): {
    select(colonnes: string): {
      eq(
        colonne: string,
        valeur: string,
      ): {
        order(colonne: string, options: { ascending: boolean }): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
      };
    };
    insert(ligne: Record<string, unknown>): {
      select(colonnes: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
    };
    update(valeurs: Record<string, unknown>): {
      eq(
        colonne: string,
        valeur: string,
      ): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
    };
    /**
     * Ajoutée phase 6 commit 6 : remplacer un justificatif de frais réels exige de retirer l'ancienne
     * ligne (après que la nouvelle a été déposée avec succès, jamais avant — cf.
     * `storage/documentsStorage.ts::remplacerDocument`). RLS l'autorise déjà (`documents_supprimer`,
     * migration 0001) ; rien à changer côté SQL.
     */
    delete(): {
      eq(colonne: string, valeur: string): PromiseLike<{ error: ErreurPostgrest | null }>;
    };
  };
}

/** Erreur telle que le SDK Storage de Supabase la rend — distincte d'`ErreurPostgrest` (REST). */
export interface ErreurStorage {
  message: string;
}

/**
 * LA SURFACE DE STOCKAGE DE FICHIERS — le bucket privé `justificatifs` (migration 0001), et rien
 * d'autre du SDK Storage complet (pas de gestion de buckets, pas de listing par dossier : Cadence
 * connaît déjà chaque chemin par la ligne `documents` correspondante, lister le bucket lui-même
 * serait une deuxième source de vérité).
 *
 * ⚠️ `createSignedUrl` ne doit JAMAIS être appelée par avance ni mise en cache : une URL signée
 * expire, et il n'y a aucune raison de la redemander avant l'instant du téléchargement.
 */
export interface ClientFichiers {
  upload(chemin: string, fichier: File): Promise<{ data: { path: string } | null; error: ErreurStorage | null }>;
  remove(chemins: string[]): Promise<{ data: unknown; error: ErreurStorage | null }>;
  createSignedUrl(chemin: string, expirationSecondes: number): Promise<{ data: { signedUrl: string } | null; error: ErreurStorage | null }>;
}

export interface ConfigurationSupabase {
  url?: string;
  cleAnon?: string;
}

/**
 * Construit le client à partir d'une configuration EXPLICITE.
 *
 * Séparé de `obtenirClientAuth()` exprès : les tests passent ici ce qu'ils veulent et ne dépendent
 * donc jamais du `.env` de la machine. Sans cette séparation, le test « la connexion n'est pas
 * configurée » passerait en intégration continue et échouerait sur la machine de Benoît (dont le
 * `.env` contient les deux variables) — un test dont le résultat dépend de la machine ne prouve
 * rien.
 *
 * @returns le client, ou `null` si la configuration est absente/vide/invalide. Ne lève jamais.
 */
export function construireClientAuth(configuration: ConfigurationSupabase): ClientAuth | null {
  return construireClient(configuration)?.auth ?? null;
}

/**
 * LA SURFACE DE LA PREUVE DE CONSENTEMENT — table `consentements` (migration 0004).
 *
 * ⚠️ NI `update` NI `delete`, ET CE N'EST PAS UN OUBLI. La migration 0004 ne crée aucune politique
 * RLS de modification ou de suppression sur cette table, seule du schéma dans ce cas : une preuve que
 * la personne concernée peut réécrire ou effacer n'est pas une preuve. Ce type dit la même chose au
 * compilateur — écrire un jour `.update(...)` ici ne compilera pas, avant même de se heurter au
 * serveur. Ne pas l'élargir « au cas où » ; s'il faut corriger une ligne, ça passe par le tableau de
 * bord Supabase.
 */
export interface ClientConsentements {
  from(table: string): {
    select(colonnes: string): {
      eq(colonne: string, valeur: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
    };
    insert(ligne: Record<string, unknown>): PromiseLike<{ data: Record<string, unknown>[] | null; error: ErreurPostgrest | null }>;
  };
}

/** Le nom du bucket est fixé ici, une seule fois — jamais recopié en chaîne ailleurs. */
export const BUCKET_JUSTIFICATIFS = "justificatifs";

/** Les six surfaces exposées par Cadence, issues d'UN SEUL client Supabase. */
export interface ClientCadence {
  auth: ClientAuth;
  /** Phase 4 : la lecture, réservée à la vérification. Cf. `ClientLectureDonnees`. */
  lecture: ClientLectureDonnees;
  /** Phase 5 : lecture + écriture sous condition. La SEULE surface d'écriture. Cf. `ClientSourceDonnees`. */
  source: ClientSourceDonnees;
  /** Phase 6 : la table `documents`. Cf. `ClientDocuments`. */
  documents: ClientDocuments;
  /** Phase 6 : le bucket `justificatifs`, déjà lié — l'appelant ne choisit jamais le bucket. */
  fichiers: ClientFichiers;
  /** 06/08/2026 : la table `consentements`. Lecture + insertion SEULEMENT. Cf. `ClientConsentements`. */
  consentements: ClientConsentements;
}

/**
 * Construit le client à partir d'une configuration explicite, et n'en expose que des surfaces
 * étroites : `auth` (phase 2), `lecture` (phase 4), `source` (phase 5), `documents`/`fichiers`
 * (phase 6).
 *
 * @returns les cinq surfaces, ou `null` si la configuration est absente/vide/invalide. Ne lève jamais.
 */
export function construireClient(configuration: ConfigurationSupabase): ClientCadence | null {
  const url = configuration.url?.trim();
  const cleAnon = configuration.cleAnon?.trim();
  if (!url || !cleAnon) return null;

  try {
    const client = createClient(url, cleAnon, {
      auth: {
        // La session survit à la fermeture de l'onglet, et le jeton se rafraîchit tout seul. Ce sont
        // les deux raisons d'utiliser la bibliothèque officielle plutôt qu'un `fetch` maison : un
        // rafraîchissement écrit à la main est précisément ce qui déconnecte les gens en silence.
        persistSession: true,
        autoRefreshToken: true,
        // Un lien reçu par e-mail renvoie sur l'app avec un code dans l'URL ; c'est la bibliothèque
        // qui l'échange contre une session. Concerne désormais le lien de RÉINITIALISATION (le lien
        // magique n'existe plus depuis le 06/08/2026) ; le lien de confirmation d'adresse, lui, fait
        // son travail côté serveur même si cet échange échoue.
        detectSessionInUrl: true,
        // PKCE plutôt que le mode implicite : le jeton ne transite pas dans l'URL (donc ni dans
        // l'historique du navigateur ni dans les journaux d'un intermédiaire).
        // ⚠️ CONTREPARTIE ASSUMÉE, à dire à l'utilisateur dans l'interface et non à cacher : un lien
        // qui doit OUVRIR UNE SESSION doit être ouvert DANS LE MÊME NAVIGATEUR que celui qui l'a
        // demandé, parce que le vérificateur PKCE y est stocké. Ouvert ailleurs, l'échec est explicite
        // — alors que le mode implicite aurait « marché » depuis n'importe où, en laissant le jeton
        // dans l'URL.
        // ⚠️ NE VAUT PLUS QUE POUR LA RÉINITIALISATION. C'est la contrainte qui a fait supprimer le
        // lien magique, et elle ne touche plus le parcours quotidien : créer un compte et se connecter
        // se font au mot de passe, sans lien, depuis n'importe quel appareil.
        flowType: "pkce",
      },
    });
    // `lecture` et `source` sont le MÊME objet, vu à travers deux types différents. Ce n'est pas une
    // astuce : la séparation qui compte est celle des types, puisque c'est elle qui décide ce que
    // chaque module a le droit d'appeler. Un second `createClient` n'aurait rien protégé de plus et
    // aurait installé un deuxième rafraîchissement de jeton (cf. `obtenirClient`).
    // ⚠️ LES ASSERTIONS SONT MÉCANIQUES, PAS DU CONFORT : les chaînes
    // `select().eq().maybeSingle()` et `update().eq().eq().select()` de @supabase/supabase-js portent
    // un typage générique trop profond pour être rapproché de nos interfaces étroites (TS2589). La
    // forme réelle est exactement celle décrite ; ce que le compilateur ne peut pas garantir ici,
    // `verificationMigration.test.ts` et `sourceSupabase.test.ts` le vérifient en exerçant chaque
    // chaîne d'appel et en refusant qu'une autre méthode soit sollicitée.
    return {
      auth: client.auth,
      lecture: client as unknown as ClientLectureDonnees,
      source: client as unknown as ClientSourceDonnees,
      documents: client as unknown as ClientDocuments,
      // Lié au bucket UNE FOIS ici : aucun appelant ne passe `BUCKET_JUSTIFICATIFS` lui-même, donc
      // aucun risque d'un jour l'écrire à la main dans le mauvais bucket.
      fichiers: client.storage.from(BUCKET_JUSTIFICATIFS) as unknown as ClientFichiers,
      consentements: client as unknown as ClientConsentements,
    };
  } catch {
    // `createClient` lève sur une URL malformée. Une variable d'environnement mal recopiée ne doit
    // pas empêcher Cadence de s'ouvrir : on retombe sur « connexion non configurée ».
    return null;
  }
}

let clientMemorise: ClientCadence | null | undefined;

/**
 * Le client de l'application, construit une seule fois.
 *
 * UN SEUL client pour toute l'app, et c'est important : chaque `createClient` installe son propre
 * rafraîchissement de jeton et son propre écouteur, donc deux clients sur la même clé de stockage se
 * marcheraient dessus. C'est aussi pour ça que la surface `donnees` (phase 3) sort du MÊME client que
 * la surface `auth` — elle porte ainsi forcément le jeton de la session en cours, sans qu'aucun code
 * n'ait à le recopier quelque part.
 */
function obtenirClient(): ClientCadence | null {
  if (clientMemorise === undefined) {
    clientMemorise = construireClient({
      url: import.meta.env.VITE_SUPABASE_URL,
      cleAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
  }
  return clientMemorise;
}

export function obtenirClientAuth(): ClientAuth | null {
  return obtenirClient()?.auth ?? null;
}

export function obtenirClientLectureDonnees(): ClientLectureDonnees | null {
  return obtenirClient()?.lecture ?? null;
}

export function obtenirClientSourceDonnees(): ClientSourceDonnees | null {
  return obtenirClient()?.source ?? null;
}

export function obtenirClientDocuments(): ClientDocuments | null {
  return obtenirClient()?.documents ?? null;
}

export function obtenirClientFichiers(): ClientFichiers | null {
  return obtenirClient()?.fichiers ?? null;
}

export function obtenirClientConsentements(): ClientConsentements | null {
  return obtenirClient()?.consentements ?? null;
}

/** Réservé aux tests : oublie le client mémorisé. */
export function reinitialiserClientAuthMemorise(): void {
  clientMemorise = undefined;
}
