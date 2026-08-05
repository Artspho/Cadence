import { creerDonneesVides, type DonneesApp } from "./localStorageAdapter";
import type { EtatServeur, Jeton } from "./sourceSupabase";
import { texteCanonique } from "./verificationMigration";

/**
 * PHASE 5 — CE QUE CADENCE DOIT FAIRE À L'OUVERTURE, MAINTENANT QUE LE SERVEUR DÉCIDE.
 *
 * Fonction PURE, délibérément sortie de `App.tsx`. Ce n'est pas un rangement : c'est la seule façon
 * d'exercer les sept situations une par une, y compris celles qu'on ne saura pas provoquer à la main
 * (contenu serveur illisible, format inconnu). Un aiguillage de cette importance enfoui dans un
 * `useEffect` ne serait vérifiable qu'en conditions réelles — donc jamais complètement.
 *
 * LA RÈGLE QUI GOUVERNE TOUT CE FICHIER : on ne prend une décision automatique QUE lorsqu'elle ne
 * peut rien détruire. Dans tous les autres cas la fonction rend une demande, et c'est un humain qui
 * tranche devant un écran. Concrètement, deux automatismes seulement sont autorisés — adopter le
 * serveur quand le navigateur est vide (rien à perdre), et continuer quand les deux côtés sont déjà
 * identiques (rien à faire).
 */

/** Vrai si cet état ne contient rien : rien à perdre, donc rien à demander avant de le remplacer. */
export function estVide(donnees: DonneesApp): boolean {
  return texteCanonique(donnees) === texteCanonique(creerDonneesVides());
}

export type Bascule =
  /** Les deux côtés disent déjà la même chose. L'app s'ouvre, le serveur est la référence. */
  | { genre: "serveurEnPhase"; jeton: Jeton }
  /**
   * Le navigateur est vide, le serveur porte des données : on adopte le serveur SANS demander.
   * C'est le cas d'un nouvel appareil (son téléphone), et celui d'un navigateur vidé par accident.
   * Automatisme sûr, et c'est le seul argument qui compte : il n'écrase rien, puisqu'il n'y a rien.
   */
  | { genre: "adopterServeur"; donnees: DonneesApp; jeton: Jeton }
  /**
   * Les deux côtés diffèrent, et les deux portent quelque chose. **Aucune écriture.** Ni fusion, ni
   * « le plus récent gagne » : départager par la date reviendrait à choisir à sa place, or l'app ne
   * sait pas laquelle des deux versions il veut garder.
   */
  | { genre: "divergence"; serveur: DonneesApp; jeton: Jeton }
  /** Rien sur le serveur, des données dans le navigateur : on PROPOSE de téléverser. */
  | { genre: "aTeleverser" }
  /** Rien de part ni d'autre : vrai premier lancement, rien à demander. */
  | { genre: "premierLancement" }
  /**
   * Le serveur porte un contenu que le schéma refuse. **Écriture interdite** : ce contenu est
   * souvent récupérable à la main, et l'écraser serait la faute du 03/08/2026 rejouée côté serveur.
   */
  | { genre: "serveurIllisible"; brut: unknown; detail: string; jeton: Jeton }
  /**
   * Le serveur a été écrit sous un autre format. Ni lisible, ni écrasable sans décision — et `brut`
   * voyage jusqu'ici pour que l'écran puisse le faire sauvegarder AVANT de proposer de l'écraser.
   */
  | { genre: "versionInattendue"; attendue: number; recue: unknown; jeton: Jeton; brut: unknown }
  /**
   * Serveur injoignable — en pause (palier gratuit), réseau coupé, jeton expiré. Cadence s'ouvre en
   * LECTURE SEULE sur la copie du navigateur (décision de Benoît du 05/08/2026, qui assouplit
   * l'arbitrage « plus d'ouverture hors ligne » du 04/08). Aucune écriture, nulle part : la copie
   * locale peut être en retard sur le serveur, et rien ne permet de le savoir tant qu'il se tait.
   */
  | { genre: "serveurMuet"; message: string };

/**
 * Décide de la conduite à tenir, sans effet de bord.
 *
 * ⚠️ LA COMPARAISON PASSE PAR `texteCanonique`, ET C'EST INDISPENSABLE. Postgres ne conserve pas
 * l'ordre des clés d'un objet JSONB : comparer deux `JSON.stringify` bruts annoncerait une divergence
 * à CHAQUE ouverture sur des données rigoureusement identiques. L'écran de décision se dresserait
 * alors en permanence sans qu'aucune donnée ne diffère — une fausse alerte que le devoir n°2 interdit
 * autant qu'un faux feu vert, et qui apprendrait de surcroît à cliquer sans lire.
 *
 * @param local l'état lu dans le navigateur, déjà validé par le schéma de lecture.
 * @param serveur ce que `lireEtatServeur` a rapporté.
 */
export function analyserBascule(local: DonneesApp, serveur: EtatServeur): Bascule {
  switch (serveur.statut) {
    case "echec":
      return { genre: "serveurMuet", message: serveur.message };

    case "illisible":
      return { genre: "serveurIllisible", brut: serveur.brut, detail: serveur.detail, jeton: serveur.jeton };

    case "versionInattendue":
      return { genre: "versionInattendue", attendue: serveur.attendue, recue: serveur.recue, jeton: serveur.jeton, brut: serveur.brut };

    case "absente":
      return estVide(local) ? { genre: "premierLancement" } : { genre: "aTeleverser" };

    case "lu": {
      if (texteCanonique(local) === texteCanonique(serveur.donnees)) {
        return { genre: "serveurEnPhase", jeton: serveur.jeton };
      }
      // Ordre délibéré : « navigateur vide » est examiné APRÈS l'égalité, sinon deux états vides des
      // deux côtés passeraient par une adoption inutile au lieu du simple « rien à faire ».
      if (estVide(local)) {
        return { genre: "adopterServeur", donnees: serveur.donnees, jeton: serveur.jeton };
      }
      return { genre: "divergence", serveur: serveur.donnees, jeton: serveur.jeton };
    }
  }
}

/**
 * ⚠️ IL N'Y A PAS DE `ouvreLApp(bascule)` ICI, ET C'EST DÉLIBÉRÉ. Une première version en exposait
 * une — « ces trois genres laissent l'app écrire » — mais `App.tsx` n'en avait aucun usage : il
 * raisonne sur son état courant (`ecritureAutorisee`), pas sur le verdict d'ouverture. La fonction
 * n'était donc appelée que par ses propres tests, qui donnaient l'illusion de protéger une règle que
 * la production n'appliquait pas. Un filet qui ne tient rien est pire que pas de filet : on compte
 * dessus. La règle d'autorisation vit dans `App.tsx`, à l'endroit unique où elle est réellement lue,
 * et c'est un test d'intégration sur l'app qui l'exerce.
 */
