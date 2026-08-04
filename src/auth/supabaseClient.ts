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
    return client.auth;
  } catch {
    // `createClient` lève sur une URL malformée. Une variable d'environnement mal recopiée ne doit
    // pas empêcher Cadence de s'ouvrir : on retombe sur « connexion non configurée ».
    return null;
  }
}

let clientMemorise: ClientAuth | null | undefined;

/**
 * Le client de l'application, construit une seule fois.
 *
 * Un seul client pour toute l'app, parce que chaque `createClient` installe son propre
 * rafraîchissement de jeton et son propre écouteur : deux clients sur la même clé de stockage se
 * marcheraient dessus.
 */
export function obtenirClientAuth(): ClientAuth | null {
  if (clientMemorise === undefined) {
    clientMemorise = construireClientAuth({
      url: import.meta.env.VITE_SUPABASE_URL,
      cleAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
  }
  return clientMemorise;
}

/** Réservé aux tests : oublie le client mémorisé. */
export function reinitialiserClientAuthMemorise(): void {
  clientMemorise = undefined;
}
