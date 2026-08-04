import type { ClientDonnees } from "../auth/supabaseClient";
import { SCHEMA_VERSION_DONNEES, type DonneesApp } from "./localStorageAdapter";

/**
 * PHASE 3 DE LA REFONTE SUPABASE — LE MIROIR, ET SEULEMENT LE MIROIR.
 *
 * Quand une session est ouverte, chaque enregistrement local est AUSSI recopié dans
 * `donnees_utilisateur`. Le `localStorage` reste la source de vérité jusqu'à la bascule de la
 * phase 5 : ce module n'est donc pas un adaptateur de remplacement, c'est une copie en plus.
 *
 * TROIS RÈGLES, ET AUCUNE N'EST NÉGOCIABLE À CE STADE :
 *
 * 1. **ÉCRITURE SEULE. AUCUNE LECTURE.** Interdiction inscrite dans le type `ClientDonnees`, qui
 *    n'expose aucun `select`. Lire Supabase avant la phase 4, ce serait risquer qu'une donnée
 *    serveur écrase la saisie locale — soit une perte de données, ce que le devoir n°1 interdit.
 *    La lecture arrivera en phase 4, sous contrôle, avec la vérification chiffrée validée par
 *    Benoît (62 contrats, 588 h, 4 mois certifiés).
 *
 * 2. **NE JAMAIS FAIRE ÉCHOUER L'ÉCRITURE LOCALE.** Ce module ne lève jamais et n'est jamais
 *    attendu par la sauvegarde locale. Une panne réseau, un serveur en pause (palier gratuit), un
 *    jeton expiré : rien de tout cela ne doit empêcher Cadence d'enregistrer dans le navigateur.
 *
 * 3. **NE JAMAIS AFFIRMER UNE COPIE QUI N'A PAS EU LIEU.** `ok: true` uniquement si Supabase n'a
 *    renvoyé aucune erreur. Un « sauvegardé sur le serveur » affiché à tort serait la pire fausse
 *    affirmation possible ici : elle inviterait Benoît à faire confiance à une copie inexistante.
 */

export const TABLE_DONNEES = "donnees_utilisateur";

export type ResultatMiroir =
  | { ok: true; horodatage: string }
  | { ok: false; message: string };

/**
 * Description courte de l'appareil, pour la colonne `maj_par_appareil`.
 *
 * ⚠️ Purement informatif, comme le dit le schéma SQL : « quel appareil a écrit en dernier », jamais
 * une clé de décision. Ce serait sinon un second endroit où la vérité pourrait mentir.
 * Utile précisément parce que la confusion entre appareils et entre URLs est ce qui a déjà coûté ses
 * contrats à Benoît une fois.
 */
export function decrireAppareil(): string | null {
  if (typeof navigator === "undefined" || typeof navigator.userAgent !== "string") return null;
  return navigator.userAgent.slice(0, 200);
}

/**
 * Recopie l'état complet vers Supabase. Ne lève jamais.
 *
 * `user_id` est fourni EXPLICITEMENT plutôt que laissé au `default auth.uid()` de la colonne, parce
 * que l'upsert de PostgREST a besoin de la colonne de conflit dans la charge utile. Ça ne relâche
 * aucune protection : la phase 1 a prouvé (contrôle « usurpation », refusé en 403) que le `with
 * check` des politiques rejette tout `user_id` qui n'est pas celui de la session. Fournir le sien
 * est autorisé ; fournir celui d'un autre est impossible.
 *
 * @param utilisateurId l'identifiant de la session en cours — celui de `useSession`, pas un autre.
 * @param maintenant injectable pour les tests ; l'horodatage rendu est celui de la CONFIRMATION de
 *        la copie, jamais une date d'écriture supposée.
 */
export async function copierDonneesVersSupabase(
  client: ClientDonnees,
  utilisateurId: string,
  donnees: DonneesApp,
  maintenant: () => Date = () => new Date(),
): Promise<ResultatMiroir> {
  try {
    const { error } = await client.from(TABLE_DONNEES).upsert({
      user_id: utilisateurId,
      donnees,
      version_schema: SCHEMA_VERSION_DONNEES,
      maj_par_appareil: decrireAppareil(),
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true, horodatage: maintenant().toISOString() };
  } catch (incident: unknown) {
    // Panne réseau, serveur en pause, jeton expiré : tout finit ici, et rien ne remonte à
    // l'appelant sous forme d'exception. La copie est un bonus, son échec n'est pas un incident de
    // l'application.
    return { ok: false, message: incident instanceof Error ? incident.message : String(incident) };
  }
}

/**
 * L'état de la copie serveur, tel que l'interface a le droit de l'affirmer.
 *
 * `inactif` couvre les deux cas où il n'y a rien à dire : pas de configuration Supabase, ou pas de
 * session. Aucun message n'est affiché dans ce cas — parler d'une copie qui n'a pas lieu d'être
 * serait du bruit, et laisserait croire qu'il manque quelque chose.
 */
export type EtatMiroir =
  | { statut: "inactif" }
  | { statut: "encours" }
  | { statut: "copie"; horodatage: string }
  | { statut: "echec"; message: string };
