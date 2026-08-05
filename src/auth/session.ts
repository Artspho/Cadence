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

/**
 * La variante déjà connectée, isolée du reste de l'union — pour les composants qui, comme
 * `Compte.tsx` depuis la connexion obligatoire (05/08/2026), ne sont montés qu'après le mur de
 * `App.tsx` et n'ont donc plus besoin de gérer les quatre autres états eux-mêmes.
 */
export type SessionConnectee = Extract<EtatSession, { statut: "connecte" }>;

function depuisSession(session: SessionMinimale): EtatSession {
  return { statut: "connecte", utilisateurId: session.user.id, email: session.user.email ?? null };
}

/**
 * Suit l'état de la connexion Supabase.
 *
 * ⚠️ CE HOOK NE PORTE PLUS LA PROMESSE « L'APP S'OUVRE SANS COMPTE » — retirée le 05/08/2026 par
 * décision de Benoît, en dehors du plan de la phase 6 : un compte est désormais nécessaire pour
 * utiliser Cadence (cf. le mur posé dans `App.tsx`, matérialisé par
 * `components/EcranConnexionObligatoire.tsx`). Les cinq états ci-dessus n'ont pas changé de sens,
 * seul ce que `App.tsx` en fait a changé : `nonConfigure` n'est plus un mode dégradé rassurant, c'est
 * une panne qui bloque tout le monde (il ne peut alors exister aucun compte).
 *
 * Ce qui reste vrai et mécanique dans ce hook lui-même :
 *  1. sans client (configuration absente), l'état est `nonConfigure` DÈS LE PREMIER RENDU, sans
 *     aucun effet déclenché — donc sans appel réseau et sans attente ;
 *  2. avec un client, le premier rendu vaut `chargement`, le temps que `getSession()` réponde.
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
