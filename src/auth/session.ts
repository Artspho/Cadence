import { useEffect, useState } from "react";
import type { ClientAuth, SessionMinimale } from "./supabaseClient";

/**
 * L'état de la connexion, tel que l'interface a le droit de l'affirmer.
 *
 * Cinq états et pas quatre, à cause du devoir « ne jamais afficher un chiffre faux » appliqué à un
 * état : quand la lecture de la session échoue, on ne SAIT pas si l'utilisateur est connecté.
 * Écrire « non connecté » dans ce cas serait une affirmation fausse — d'où `indetermine`, qui dit
 * l'ignorance au lieu de la maquiller.
 */
export type EtatSession =
  | { statut: "nonConfigure" }
  | { statut: "chargement" }
  | { statut: "deconnecte" }
  | { statut: "connecte"; utilisateurId: string; email: string | null }
  | { statut: "indetermine"; detail: string };

function depuisSession(session: SessionMinimale): EtatSession {
  return { statut: "connecte", utilisateurId: session.user.id, email: session.user.email ?? null };
}

/**
 * Suit l'état de la connexion Supabase.
 *
 * DEUX GARANTIES QUI PORTENT LA PROMESSE « L'APP S'OUVRE SANS COMPTE » :
 *  1. sans client (configuration absente), l'état est `nonConfigure` DÈS LE PREMIER RENDU, sans
 *     aucun effet déclenché — donc sans appel réseau et sans attente ;
 *  2. avec un client, le premier rendu vaut `chargement` et l'app s'affiche quand même. Cet état ne
 *     doit JAMAIS servir à retarder l'affichage des données : elles viennent du `localStorage` et
 *     n'ont rien à attendre de la connexion.
 *
 * @param client injecté (défaut : celui de l'app). Les tests passent un faux de quelques lignes.
 */
export function useSession(client: ClientAuth | null): EtatSession {
  const [etat, setEtat] = useState<EtatSession>(client ? { statut: "chargement" } : { statut: "nonConfigure" });

  useEffect(() => {
    if (!client) {
      setEtat({ statut: "nonConfigure" });
      return;
    }

    // `annule` évite d'écrire dans un composant démonté, et surtout évite qu'une réponse lente de
    // `getSession()` n'écrase un état plus récent reçu par l'écouteur ci-dessous.
    let annule = false;

    client
      .getSession()
      .then(({ data, error }) => {
        if (annule) return;
        if (error) {
          setEtat({ statut: "indetermine", detail: error.message });
          return;
        }
        setEtat(data.session ? depuisSession(data.session) : { statut: "deconnecte" });
      })
      .catch((erreur: unknown) => {
        if (annule) return;
        setEtat({ statut: "indetermine", detail: erreur instanceof Error ? erreur.message : String(erreur) });
      });

    // Couvre la connexion, la déconnexion, le rafraîchissement du jeton, et le retour du lien
    // magique (la bibliothèque échange le code présent dans l'URL puis émet l'événement).
    const { data } = client.onAuthStateChange((_evenement, session) => {
      if (annule) return;
      setEtat(session ? depuisSession(session) : { statut: "deconnecte" });
    });

    return () => {
      annule = true;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return etat;
}
