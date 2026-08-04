import type { ClientSourceDonnees, ErreurPostgrest } from "../auth/supabaseClient";
import { SCHEMA_VERSION_DONNEES, validerDonneesLues, type DonneesApp } from "./localStorageAdapter";
import { decrireAppareil, TABLE_DONNEES } from "./miroirSupabase";

/**
 * PHASE 5 DE LA REFONTE SUPABASE — LE SERVEUR DEVIENT LA SOURCE DE VÉRITÉ.
 *
 * Les phases 3 et 4 étaient incapables de perdre des données par construction : l'une n'écrivait
 * qu'une copie en plus, l'autre ne rendait qu'un verdict. Ce module-ci, lui, EN EST CAPABLE. Il lit
 * l'état qui sera affiché et il écrit l'état qui fera référence. Tout ce qui suit existe pour le lui
 * interdire.
 *
 * ⚠️ CE MODULE NE DÉCIDE JAMAIS. Il ne fusionne pas, il ne choisit pas entre deux versions, il ne
 * répare rien. Il rend un ÉTAT ou un REFUS, et c'est l'appelant — donc, en bout de chaîne, Benoît
 * devant un écran — qui tranche. Un module capable d'écraser des données ne doit pas avoir le droit
 * de juger laquelle des deux versions est la bonne.
 *
 * QUATRE RÈGLES.
 *
 * 1. **AUCUNE ÉCRITURE À L'AVEUGLE.** Toute écriture nomme la version qu'elle remplace (`jeton`, la
 *    valeur de `maj_le` lue au préalable). Si cette version n'est plus celle du serveur, l'écriture
 *    est REFUSÉE — jamais forcée. C'est le scénario qui a déjà coûté ses contrats à Benoît une fois,
 *    quand deux stockages distincts se croyaient chacun seul, et un serveur partagé le rend réel.
 *
 * 2. **« ILLISIBLE » N'EST PAS « VIDE ».** Une ligne serveur que le schéma refuse est un état à part
 *    entière, jamais un état vide. Les confondre autoriserait l'écriture par-dessus un contenu
 *    souvent récupérable à la main — la faute exacte corrigée le 03/08/2026 côté `localStorage`
 *    (cf. `ResultatChargement`), reproduite ici serait impardonnable.
 *
 * 3. **PAS DE VERROU SANS JETON.** Si le serveur ne rend pas un `maj_le` exploitable, on ne fabrique
 *    pas un jeton de remplacement : on le dit. Un verrou qu'on croit fermé et qui ne l'est pas vaut
 *    moins que pas de verrou du tout, parce qu'il est cru (devoir n°2).
 *
 * 4. **JAMAIS DE FAUX ÉCHEC D'ÉCRITURE.** Une écriture qui a réellement eu lieu n'est jamais
 *    annoncée comme un échec, même si la réponse du serveur devient inexploitable ensuite : d'où le
 *    statut `ecritJetonPerdu`, qui dit les deux choses à la fois.
 */

/**
 * La version de la ligne serveur, telle que le serveur l'a rendue — jamais fabriquée ici.
 *
 * C'est `maj_le`, tenu par le trigger `donnees_utilisateur_maj_le` (cf.
 * `supabase/migrations/0001_schema_et_rls.sql`), donc par Postgres et non par un navigateur. Le
 * schéma le dit noir sur blanc : « une date fournie par le client peut être fausse ». Un verrou qui
 * reposerait sur l'horloge de l'appareil ne protégerait rien.
 */
export type Jeton = string;

export type EtatServeur =
  /** Ligne lue et validée par le schéma de LECTURE. `brut` est conservé pour l'export de secours. */
  | { statut: "lu"; donnees: DonneesApp; jeton: Jeton; brut: unknown }
  /** Ligne présente, contenu refusé par le schéma. **Écriture interdite** (règle n°2). */
  | { statut: "illisible"; detail: string; brut: unknown; jeton: Jeton }
  /** Ligne écrite sous une autre version de schéma : ni lisible, ni écrasable sans décision. */
  | { statut: "versionInattendue"; attendue: number; recue: unknown; jeton: Jeton }
  /** Aucune ligne : rien n'a encore été téléversé. Cas normal, pas une erreur. */
  | { statut: "absente" }
  /** Serveur injoignable, en pause, jeton expiré, ou `maj_le` inexploitable. Rien n'est su. */
  | { statut: "echec"; message: string };

export type ResultatEcriture =
  /** Écrit, et la nouvelle version est connue : elle sert de jeton à l'écriture suivante. */
  | { statut: "ecrit"; jeton: Jeton }
  /**
   * Écrit — la donnée EST sur le serveur — mais la nouvelle version n'a pas été rendue de façon
   * exploitable. Il faut RELIRE avant la prochaine écriture. Ne jamais présenter ce cas comme un
   * échec (règle n°4) : ce serait inviter à réessayer une écriture déjà faite.
   */
  | { statut: "ecritJetonPerdu" }
  /**
   * Refusé : le serveur ne porte plus la version annoncée. Quelqu'un (un autre appareil, un autre
   * onglet) a écrit entre-temps, ou la ligne a disparu. Dans les deux cas ce qu'on croyait vrai ne
   * l'est plus, donc on n'écrit pas et on va demander.
   */
  | { statut: "conflit" }
  /** L'écriture n'a pas eu lieu, pour une cause technique. L'état serveur est intact. */
  | { statut: "echec"; message: string };

/** Code SQLSTATE d'une violation d'unicité : la ligne existait déjà. Un conflit, pas une panne. */
const CODE_LIGNE_EXISTE_DEJA = "23505";

function messageDe(incident: unknown): string {
  return incident instanceof Error ? incident.message : String(incident);
}

/** Le jeton, ou `null` si le serveur n'en a pas rendu un exploitable (règle n°3 — jamais inventé). */
function extraireJeton(ligne: Record<string, unknown> | null | undefined): Jeton | null {
  const majLe = ligne?.maj_le;
  return typeof majLe === "string" && majLe.length > 0 ? majLe : null;
}

const MESSAGE_JETON_ABSENT =
  "Le serveur n'a pas indiqué la version de la ligne (`maj_le`). Sans elle, aucune écriture ne peut être protégée contre l'écrasement — Cadence préfère ne rien écrire.";

/**
 * Lit l'état de l'utilisateur, et rien d'autre que le sien.
 *
 * Le filtre `user_id` est explicite bien que RLS le rende déjà obligatoire, pour la même raison que
 * dans `verificationMigration.lireLigneServeur` : RLS empêche de lire la ligne d'un autre, le filtre
 * empêche de croire qu'on a lu la bonne. Ordre des contrôles délibéré — la version de schéma est
 * examinée AVANT toute validation, parce qu'un contenu écrit sous un autre format serait refusé par
 * le schéma et donnerait « illisible » là où la vraie cause est « pas le même format ».
 *
 * ⚠️ Chemin d'appel volontairement NON partagé avec `verificationMigration.lireLigneServeur`, malgré
 * la ressemblance : celle-ci travaille sur `ErreurAuth` (sans code SQLSTATE) et ne rend qu'un
 * verdict. Ici le code d'erreur décide de l'écran affiché. Fusionner les deux obligerait à élargir la
 * surface de la phase 4, qui doit rester incapable d'écrire.
 */
export async function lireEtatServeur(client: ClientSourceDonnees, utilisateurId: string): Promise<EtatServeur> {
  try {
    const { data, error } = await client.from(TABLE_DONNEES).select("donnees, version_schema, maj_le").eq("user_id", utilisateurId).maybeSingle();

    if (error) return { statut: "echec", message: error.message };
    if (!data) return { statut: "absente" };

    const jeton = extraireJeton(data);
    if (jeton === null) return { statut: "echec", message: MESSAGE_JETON_ABSENT };

    const versionSchema = data.version_schema;
    if (versionSchema !== SCHEMA_VERSION_DONNEES) {
      return { statut: "versionInattendue", attendue: SCHEMA_VERSION_DONNEES, recue: versionSchema, jeton };
    }

    const brut = data.donnees;
    const validation = validerDonneesLues(brut);
    if (!validation.ok) return { statut: "illisible", detail: validation.detail, brut, jeton };

    return { statut: "lu", donnees: validation.donnees, jeton, brut };
  } catch (incident: unknown) {
    return { statut: "echec", message: messageDe(incident) };
  }
}

/**
 * Écrit l'état sur le serveur, à la seule condition que la version attendue soit encore en place.
 *
 * @param jetonAttendu la version lue juste avant, ou `null` pour une PREMIÈRE écriture (aucune ligne
 *        n'existait). `null` déclenche un `insert`, pas un `upsert` : si une ligne est apparue
 *        entre-temps, l'insertion échoue et le conflit est signalé au lieu d'écraser cette ligne.
 *
 * `maj_le` n'est jamais dans la charge utile : c'est le trigger serveur qui l'écrit. L'envoyer
 * reviendrait à laisser le navigateur décider de l'ordre des écritures, ce que le schéma refuse
 * explicitement.
 */
export async function ecrireEtatServeur(
  client: ClientSourceDonnees,
  utilisateurId: string,
  donnees: DonneesApp,
  jetonAttendu: Jeton | null,
): Promise<ResultatEcriture> {
  const charge = {
    user_id: utilisateurId,
    donnees,
    version_schema: SCHEMA_VERSION_DONNEES,
    maj_par_appareil: decrireAppareil(),
  };

  try {
    if (jetonAttendu === null) {
      const { data, error } = await client.from(TABLE_DONNEES).insert(charge).select("maj_le");

      if (error) {
        // La ligne existait déjà : c'est un conflit (quelqu'un a téléversé avant nous), pas une panne.
        if (error.code === CODE_LIGNE_EXISTE_DEJA) return { statut: "conflit" };
        return { statut: "echec", message: error.message };
      }

      const jeton = extraireJeton(data?.[0]);
      // L'insertion a réussi : ne jamais annoncer un échec ici (règle n°4), même sans jeton.
      return jeton === null ? { statut: "ecritJetonPerdu" } : { statut: "ecrit", jeton };
    }

    const { data, error } = await client.from(TABLE_DONNEES).update(charge).eq("user_id", utilisateurId).eq("maj_le", jetonAttendu).select("maj_le");

    if (error) return { statut: "echec", message: error.message };

    // Zéro ligne touchée = la condition n'a pas été satisfaite. Deux causes possibles — `maj_le` a
    // changé, ou la ligne n'existe plus — et elles mènent à la même conclusion : ce qu'on croyait
    // vrai ne l'est plus. On refuse d'écrire dans les deux cas plutôt que de chercher à distinguer.
    if (!data || data.length === 0) return { statut: "conflit" };

    const jeton = extraireJeton(data[0]);
    return jeton === null ? { statut: "ecritJetonPerdu" } : { statut: "ecrit", jeton };
  } catch (incident: unknown) {
    return { statut: "echec", message: messageDe(incident) };
  }
}

/** Le type est réexporté pour que les appelants n'aient pas à connaître `auth/supabaseClient`. */
export type { ClientSourceDonnees, ErreurPostgrest };
