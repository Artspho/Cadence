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
  signInWithOtp(parametres: { email: string; options?: { emailRedirectTo?: string } }): Promise<{ error: ErreurAuth | null }>;
  signInWithPassword(parametres: { email: string; password: string }): Promise<{ data: { session: SessionMinimale | null }; error: ErreurAuth | null }>;
  signUp(parametres: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<{ data: { session: SessionMinimale | null }; error: ErreurAuth | null }>;
  signOut(): Promise<{ error: ErreurAuth | null }>;
  /** Définit ou change le mot de passe d'une session déjà ouverte (lien magique ou mot de passe). */
  updateUser(attributs: { password: string }): Promise<{ error: ErreurAuth | null }>;
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

/** Les trois surfaces exposées par Cadence, issues d'UN SEUL client Supabase. */
export interface ClientCadence {
  auth: ClientAuth;
  /** Phase 4 : la lecture, réservée à la vérification. Cf. `ClientLectureDonnees`. */
  lecture: ClientLectureDonnees;
  /** Phase 5 : lecture + écriture sous condition. La SEULE surface d'écriture. Cf. `ClientSourceDonnees`. */
  source: ClientSourceDonnees;
}

/**
 * Construit le client à partir d'une configuration explicite, et n'en expose que des surfaces
 * étroites : `auth` (phase 2), `lecture` (phase 4) et `source` (phase 5).
 *
 * @returns les trois surfaces, ou `null` si la configuration est absente/vide/invalide. Ne lève jamais.
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
        // Le lien magique renvoie sur l'app avec un code dans l'URL ; c'est la bibliothèque qui
        // l'échange contre une session.
        detectSessionInUrl: true,
        // PKCE plutôt que le mode implicite : le jeton ne transite pas dans l'URL (donc ni dans
        // l'historique du navigateur ni dans les journaux d'un intermédiaire).
        // ⚠️ CONTREPARTIE ASSUMÉE, à dire à l'utilisateur dans l'interface et non à cacher : le lien
        // magique doit être ouvert DANS LE MÊME NAVIGATEUR que celui qui l'a demandé, parce que le
        // vérificateur PKCE y est stocké. Ouvert ailleurs, l'échec est explicite — alors que le mode
        // implicite aurait « marché » depuis n'importe où, en laissant le jeton dans l'URL.
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
    return { auth: client.auth, lecture: client as unknown as ClientLectureDonnees, source: client as unknown as ClientSourceDonnees };
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

/** Réservé aux tests : oublie le client mémorisé. */
export function reinitialiserClientAuthMemorise(): void {
  clientMemorise = undefined;
}
