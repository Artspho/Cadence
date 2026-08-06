/**
 * Est-ce que cette page a été ouverte par un LIEN REÇU PAR E-MAIL, et si oui lequel ?
 *
 * ⚠️ LE NOM DE CE FICHIER EST HISTORIQUE : le lien magique a été SUPPRIMÉ le 06/08/2026 (cf.
 * auth/actions.ts). Le module, lui, reste nécessaire — et pour deux liens, pas un :
 *  · le lien de CONFIRMATION D'ADRESSE, émis par `signUp`. Il n'a pas besoin d'ouvrir de session pour
 *    faire son office, donc il peut être cliqué depuis n'importe quel appareil ; mais s'il est ouvert
 *    ailleurs, l'utilisateur atterrit sur le mur sans session et doit comprendre pourquoi ;
 *  · le lien de RÉINITIALISATION, qui lui ouvre une session (cf. `reinitialisation` ci-dessous).
 * Il n'a pas été renommé exprès : un renommage aurait noyé, dans le diff de ce chantier, la seule
 * modification qui compte ici (l'ajout du marqueur). À renommer un jour, seul.
 *
 * POURQUOI CE MODULE EXISTE — un défaut trouvé en conditions réelles le 04/08/2026, et pas par un
 * test. Benoît a reçu un lien, l'a ouvert depuis SON navigateur alors que la clé PKCE se
 * trouvait dans celui qui avait demandé le lien. L'échange a donc échoué, ce qui est le comportement
 * normal de PKCE — mais l'écran ne disait RIEN : il revoyait le formulaire de connexion, sans savoir
 * que quelque chose venait d'échouer ni pourquoi. Un état muet et incompréhensible, exactement ce que
 * le devoir « ne jamais afficher un état faux » interdit. L'avertissement existait pourtant, mais
 * AVANT le clic — donc inutile pour qui lit le message dans l'autre navigateur.
 *
 * POURQUOI LA CAPTURE SE FAIT À L'IMPORT, ET PAS DANS LE COMPOSANT : avec `detectSessionInUrl`, la
 * bibliothèque NETTOIE l'URL après avoir traité le code. Un composant qui lirait `location` au
 * premier rendu arriverait trop tard et ne verrait plus rien. Ce module est évalué au chargement du
 * graphe de modules, donc avant tout rendu et avant la construction du client. Le marqueur de
 * réinitialisation est capturé au même instant, pour la même raison : il est dans la même URL.
 */
import { MARQUEUR_REINITIALISATION } from "./actions";

export interface IndiceRetourLien {
  /** Un paramètre de retour d'authentification était présent dans l'URL d'ouverture de la page. */
  present: boolean;
  /** Le message d'erreur que Supabase a lui-même mis dans l'URL, quand il y en a un. */
  erreurTransmise: string | null;
  /**
   * Cette page a été ouverte par le lien de RÉINITIALISATION du mot de passe (marqueur posé par
   * `demanderReinitialisationMotDePasse`). Indépendant de `present` : le marqueur est là même quand
   * l'échange PKCE a réussi et que la bibliothèque a déjà retiré son `code` de l'URL — c'est
   * justement le cas normal, celui où il faut demander le nouveau mot de passe.
   */
  reinitialisation: boolean;
}

const AUCUN_INDICE: IndiceRetourLien = { present: false, erreurTransmise: null, reinitialisation: false };

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
  let reinitialisation = false;

  for (const p of parametres) {
    // `code` = flux PKCE ; `token_hash` = lien de vérification ; `error*` = refus explicite.
    if (p.has("code") || p.has("token_hash") || p.has("error") || p.has("error_code") || p.has("error_description")) {
      present = true;
    }
    if (p.has(MARQUEUR_REINITIALISATION)) {
      reinitialisation = true;
    }
    const description = p.get("error_description") ?? p.get("error") ?? p.get("error_code");
    if (description !== null && erreurTransmise === null) {
      // Les descriptions arrivent encodées façon formulaire (`+` pour les espaces) : `URLSearchParams`
      // s'en charge déjà, on ne remet pas une couche de décodage par-dessus.
      erreurTransmise = description;
    }
  }

  // ⚠️ LE `OU` EST INDISPENSABLE, et l'oublier serait un bug muet : un retour de réinitialisation
  // RÉUSSI n'a plus ni `code` ni `token_hash` dans l'URL (la bibliothèque les a consommés et
  // nettoyés), donc `present` vaut `false` alors que le marqueur, lui, est bien là. Rendre
  // `AUCUN_INDICE` dans ce cas ferait taire l'écran de nouveau mot de passe précisément quand il doit
  // s'afficher.
  return present || reinitialisation ? { present, erreurTransmise, reinitialisation } : AUCUN_INDICE;
}

/**
 * L'indice de CETTE page, figé au chargement.
 *
 * `typeof window` gardé pour les tests en environnement `node` (la majorité de la suite) : ce module
 * peut être importé par une chaîne de dépendances sans DOM.
 */
export const INDICE_RETOUR_LIEN: IndiceRetourLien =
  typeof window === "undefined" ? AUCUN_INDICE : lireIndiceRetour(window.location.search, window.location.hash);
