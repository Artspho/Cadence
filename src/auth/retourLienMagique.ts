/**
 * Est-ce que cette page a été ouverte par un LIEN DE CONNEXION ?
 *
 * POURQUOI CE MODULE EXISTE — un défaut trouvé en conditions réelles le 04/08/2026, et pas par un
 * test. Benoît a reçu le lien magique, l'a ouvert depuis SON navigateur alors que la clé PKCE se
 * trouvait dans celui qui avait demandé le lien. L'échange a donc échoué, ce qui est le comportement
 * normal de PKCE — mais l'écran ne disait RIEN : il revoyait le formulaire de connexion, sans savoir
 * que quelque chose venait d'échouer ni pourquoi. Un état muet et incompréhensible, exactement ce que
 * le devoir « ne jamais afficher un état faux » interdit. L'avertissement existait pourtant, mais
 * AVANT le clic — donc inutile pour qui lit le message dans l'autre navigateur.
 *
 * POURQUOI LA CAPTURE SE FAIT À L'IMPORT, ET PAS DANS LE COMPOSANT : avec `detectSessionInUrl`, la
 * bibliothèque NETTOIE l'URL après avoir traité le code. Un composant qui lirait `location` au
 * premier rendu arriverait trop tard et ne verrait plus rien. Ce module est évalué au chargement du
 * graphe de modules, donc avant tout rendu et avant la construction du client.
 */

export interface IndiceRetourLien {
  /** Un paramètre de retour d'authentification était présent dans l'URL d'ouverture de la page. */
  present: boolean;
  /** Le message d'erreur que Supabase a lui-même mis dans l'URL, quand il y en a un. */
  erreurTransmise: string | null;
}

const AUCUN_INDICE: IndiceRetourLien = { present: false, erreurTransmise: null };

/**
 * Lit les deux endroits possibles : la chaîne de requête (`?code=…`, flux PKCE) et le fragment
 * (`#error=…`, utilisé quand le serveur d'authentification renvoie un refus). On regarde les deux
 * parce que selon l'étape qui échoue, Supabase n'écrit pas au même endroit.
 */
export function lireIndiceRetour(recherche: string, fragment: string): IndiceRetourLien {
  // Le préfixe est retiré indifféremment (`?` ou `#`) dans les deux cas : intervertir les deux
  // arguments est une erreur d'appel facile à commettre — je l'ai commise en écrivant les tests de ce
  // module — et elle donnerait sinon un « aucun indice » silencieux, donc un écran muet, c'est-à-dire
  // exactement le défaut que ce fichier est censé supprimer.
  const parametres = [recherche, fragment].map((brut) => new URLSearchParams(brut.replace(/^[?#]/, "")));

  let present = false;
  let erreurTransmise: string | null = null;

  for (const p of parametres) {
    // `code` = flux PKCE ; `token_hash` = lien de vérification ; `error*` = refus explicite.
    if (p.has("code") || p.has("token_hash") || p.has("error") || p.has("error_code") || p.has("error_description")) {
      present = true;
    }
    const description = p.get("error_description") ?? p.get("error") ?? p.get("error_code");
    if (description !== null && erreurTransmise === null) {
      // Les descriptions arrivent encodées façon formulaire (`+` pour les espaces) : `URLSearchParams`
      // s'en charge déjà, on ne remet pas une couche de décodage par-dessus.
      erreurTransmise = description;
    }
  }

  return present ? { present, erreurTransmise } : AUCUN_INDICE;
}

/**
 * L'indice de CETTE page, figé au chargement.
 *
 * `typeof window` gardé pour les tests en environnement `node` (la majorité de la suite) : ce module
 * peut être importé par une chaîne de dépendances sans DOM.
 */
export const INDICE_RETOUR_LIEN: IndiceRetourLien =
  typeof window === "undefined" ? AUCUN_INDICE : lireIndiceRetour(window.location.search, window.location.hash);
