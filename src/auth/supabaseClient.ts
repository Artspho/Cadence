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
 * La surface de DONNÉES dont la phase 3 a besoin : écrire une ligne, et rien de plus.
 *
 * Volontairement dépourvue de toute méthode de LECTURE, et ce n'est pas une économie de frappe :
 * jusqu'à la phase 4, Cadence ne doit pas pouvoir lire Supabase, parce qu'une donnée serveur qui
 * écraserait la saisie locale serait une perte de données (devoir n°1). L'interdiction est donc
 * inscrite dans le type, pas seulement dans une intention — on ne peut pas appeler `select` par
 * distraction, il n'existe pas ici.
 */
export interface ClientDonnees {
  from(table: string): {
    upsert(ligne: Record<string, unknown>): PromiseLike<{ error: ErreurAuth | null }>;
  };
}

/**
 * La surface de LECTURE, introduite par la PHASE 4 — et volontairement SÉPARÉE de `ClientDonnees`.
 *
 * POURQUOI UN SECOND TYPE PLUTÔT QU'UN `select` AJOUTÉ AU PREMIER. Le miroir de la phase 3 ne doit
 * toujours pas pouvoir lire : sa règle n°1 (« écriture seule ») reste vraie après la phase 4, parce
 * qu'une donnée serveur qui écraserait la saisie locale resterait une perte de données. Ajouter
 * `select` à `ClientDonnees` aurait discrètement levé cette interdiction pour du code déjà écrit.
 * Ici, seul ce qui demande explicitement `ClientLectureDonnees` peut lire — c'est-à-dire, à ce jour,
 * le seul module de vérification.
 *
 * ⚠️ CE QUE LA PHASE 4 N'AUTORISE PAS, ET QUI N'EST DONC NULLE PART DANS CE FICHIER : écrire le
 * résultat d'une lecture dans le `localStorage`. Lire sert à COMPARER, et à rien d'autre, jusqu'à la
 * bascule de la phase 5 — qui sera demandée explicitement à l'utilisateur.
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
 * TROISIÈME type, et non un élargissement des deux précédents. `ClientDonnees` (phase 3) doit rester
 * incapable de lire et `ClientLectureDonnees` (phase 4) incapable d'écrire : ces interdictions
 * protègent du code déjà écrit, qui n'a pas été relu pour la bascule. Ajouter des méthodes à l'un ou
 * l'autre les aurait levées en silence pour lui.
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

/** Les deux surfaces exposées par Cadence, issues d'UN SEUL client Supabase. */
export interface ClientCadence {
  auth: ClientAuth;
  donnees: ClientDonnees;
  /** Phase 4 : la lecture, réservée à la vérification. Cf. `ClientLectureDonnees`. */
  lecture: ClientLectureDonnees;
  /** Phase 5 : lecture + écriture sous condition, pour la bascule. Cf. `ClientSourceDonnees`. */
  source: ClientSourceDonnees;
}

/**
 * Construit le client à partir d'une configuration explicite, et n'en expose que deux surfaces
 * étroites : `auth` (phase 2) et `donnees` (phase 3, écriture seule).
 *
 * @returns les deux surfaces, ou `null` si la configuration est absente/vide/invalide. Ne lève jamais.
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
    // `donnees` et `lecture` sont le MÊME objet, vu à travers deux types différents. Ce n'est pas
    // une astuce : la séparation qui compte est celle des types, puisque c'est elle qui décide ce que
    // chaque module a le droit d'appeler. Un second `createClient` n'aurait rien protégé de plus et
    // aurait installé un deuxième rafraîchissement de jeton (cf. `obtenirClient`).
    // ⚠️ L'assertion ne porte QUE sur `lecture`, et pour une raison mécanique, pas par confort :
    // le typage générique de `select().eq().maybeSingle()` dans @supabase/supabase-js est trop
    // profond pour que TypeScript le rapproche de notre interface étroite (TS2589). La forme réelle,
    // elle, est exactement celle-ci — c'est le chemin d'appel documenté de la bibliothèque, et
    // `verificationMigration.test.ts` vérifie qu'aucune autre méthode n'est sollicitée. `donnees`
    // (upsert) reste vérifié normalement par le compilateur.
    // `source` (phase 5) subit la même assertion que `lecture`, et pour la même raison mécanique :
    // les chaînes `select().eq().maybeSingle()` et `update().eq().eq().select()` de
    // @supabase/supabase-js portent un typage générique trop profond pour être rapproché de nos
    // interfaces étroites (TS2589). La forme réelle est exactement celle décrite ; ce que l'assertion
    // ne peut pas garantir, `sourceSupabase.test.ts` le vérifie en exerçant chaque chaîne d'appel.
    return { auth: client.auth, donnees: client, lecture: client as unknown as ClientLectureDonnees, source: client as unknown as ClientSourceDonnees };
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

export function obtenirClientDonnees(): ClientDonnees | null {
  return obtenirClient()?.donnees ?? null;
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
