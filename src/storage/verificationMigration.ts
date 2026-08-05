import type { ClientLectureDonnees } from "../auth/supabaseClient";
import { SCHEMA_VERSION_DONNEES, type DonneesApp } from "./localStorageAdapter";
import { TABLE_DONNEES } from "./sourceSupabase";

/**
 * PHASE 4 DE LA REFONTE SUPABASE — LIRE POUR COMPARER, ET POUR RIEN D'AUTRE.
 *
 * C'est le premier module de Cadence qui LIT des données métier sur le serveur. Il ne les rend donc
 * à personne : il n'expose aucune fonction qui retourne les données serveur au reste de l'app, et
 * aucune qui écrive quoi que ce soit — ni dans le `localStorage`, ni dans Supabase. Sa seule sortie
 * est un VERDICT. C'est ce qui rend la phase 4 incapable de perdre des données : rien de ce qu'elle
 * lit ne peut aller nulle part.
 *
 * TROIS RÈGLES.
 *
 * 1. **« IDENTIQUE » SE PROUVE, IL NE S'ESTIME PAS.** Le verdict repose sur une empreinte SHA-256
 *    des deux côtés. Compter 62 contrats de chaque côté ne prouverait rien sur leur CONTENU — deux
 *    jeux de 62 contrats différents donnent le même compte. Le compte est affiché parce qu'il parle
 *    à un humain ; c'est l'empreinte qui décide.
 *
 * 2. **AUCUNE FAUSSE DIFFÉRENCE.** Postgres range le JSONB à sa façon : l'ordre des clés d'un objet
 *    n'est PAS conservé. Comparer deux `JSON.stringify` bruts annoncerait donc « différent » sur des
 *    données rigoureusement identiques — une fausse alerte, que le devoir n°2 interdit autant qu'un
 *    faux feu vert. D'où la canonisation (clés triées) AVANT l'empreinte.
 *
 * 3. **NE JAMAIS CONFONDRE « ABSENT » ET « DIFFÉRENT ».** Une ligne serveur inexistante est un état
 *    à part entière (`absente`), pas un écart. Les annoncer pareil enverrait chercher une divergence
 *    là où il n'y a simplement rien encore.
 */

/** Les clés de `DonneesApp`, énumérées pour pouvoir dire OÙ ça diffère plutôt que « ça diffère ». */
const CLES_DONNEES = ["profil", "contrats", "periodes", "soldeIndemnisationDepart", "exercicesGeles"] as const;

/** Noms lisibles à l'écran — Benoît ne lit pas le code, un verdict qui dit `soldeIndemnisationDepart` ne l'aide pas. */
const NOM_LISIBLE: Record<(typeof CLES_DONNEES)[number], string> = {
  profil: "le profil",
  contrats: "les contrats",
  periodes: "les périodes assimilées",
  soldeIndemnisationDepart: "le solde d'indemnisation de départ",
  exercicesGeles: "les exercices figés",
};

/**
 * Réécrit une valeur avec les clés de chaque objet triées, récursivement.
 *
 * ⚠️ L'ORDRE DES TABLEAUX EST CONSERVÉ, exprès : deux contrats permutés ne sont pas la même donnée
 * pour l'app (l'affichage et les exercices figés s'appuient sur cet ordre). Trier ici masquerait une
 * vraie différence — soit un faux « identique », le pire résultat possible de ce module.
 */
export function canoniser(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canoniser);
  if (valeur === null || typeof valeur !== "object") return valeur;

  const source = valeur as Record<string, unknown>;
  const trie: Record<string, unknown> = {};
  for (const cle of Object.keys(source).sort()) trie[cle] = canoniser(source[cle]);
  return trie;
}

/** Forme canonique et textuelle d'une valeur : c'est ce qui est haché, jamais l'objet brut. */
export function texteCanonique(valeur: unknown): string {
  return JSON.stringify(canoniser(valeur));
}

/** Calcule une empreinte à partir d'un texte. Injecté dans les tests ; SHA-256 en production. */
export type Hacheur = (texte: string) => Promise<string>;

/**
 * SHA-256 par l'API du navigateur, rendu en hexadécimal.
 *
 * ⚠️ `crypto.subtle` n'existe QUE dans un contexte sécurisé (https, ou localhost). Sur l'URL de
 * déploiement de Benoît c'est le cas. Ailleurs, cette fonction LÈVE au lieu de se rabattre sur un
 * hachage maison : une empreinte affaiblie qui déclarerait « identique » vaudrait moins que pas
 * d'empreinte du tout, parce qu'elle serait crue.
 */
export const hacheurSha256: Hacheur = async (texte) => {
  const sousSysteme = globalThis.crypto?.subtle;
  if (!sousSysteme) {
    throw new Error("Le calcul d'empreinte n'est pas disponible dans ce navigateur (contexte non sécurisé).");
  }
  const condense = await sousSysteme.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(condense))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("");
};

/** Ce que la ligne serveur contient, tel qu'on ose l'affirmer après lecture — rien de plus. */
export interface LigneServeur {
  donnees: unknown;
  versionSchema: unknown;
  majLe: string | null;
}

export type ResultatLecture =
  | { statut: "lue"; ligne: LigneServeur }
  | { statut: "absente" }
  | { statut: "echec"; message: string };

/**
 * Lit LA ligne de l'utilisateur, et seulement la sienne.
 *
 * Le filtre `user_id` est explicite alors que RLS le rendrait déjà obligatoire : les deux protègent
 * des choses différentes. RLS empêche de lire la ligne d'un autre ; le filtre empêche de croire
 * qu'on a lu la bonne quand la table en contient plusieurs. La phase 1 a prouvé le premier
 * (64 contrôles conformes) ; le second est ici pour que la lecture ne dépende pas de cette preuve.
 *
 * `maybeSingle` et non `single` : zéro ligne est un cas normal (rien n'a encore été copié), pas une
 * erreur à afficher en rouge.
 */
export async function lireLigneServeur(client: ClientLectureDonnees, utilisateurId: string): Promise<ResultatLecture> {
  try {
    const { data, error } = await client.from(TABLE_DONNEES).select("donnees, version_schema, maj_le").eq("user_id", utilisateurId).maybeSingle();

    if (error) return { statut: "echec", message: error.message };
    if (!data) return { statut: "absente" };

    const majLe = data.maj_le;
    return {
      statut: "lue",
      ligne: { donnees: data.donnees, versionSchema: data.version_schema, majLe: typeof majLe === "string" ? majLe : null },
    };
  } catch (incident: unknown) {
    return { statut: "echec", message: incident instanceof Error ? incident.message : String(incident) };
  }
}

/** Le décompte que l'œil humain sait recouper avec l'écran de Cadence. Jamais le verdict à lui seul. */
export interface Decompte {
  contrats: number;
  periodes: number;
  exercicesGeles: number;
  profilPresent: boolean;
}

/**
 * Décompte défensif : la valeur serveur est du JSON brut, elle n'a traversé aucun schéma Zod.
 * Un champ absent ou d'un autre type donne 0 — jamais une exception qui casserait la vérification,
 * et jamais un chiffre inventé.
 */
export function decompter(valeur: unknown): Decompte {
  const objet = (valeur ?? {}) as Record<string, unknown>;
  const geles = objet.exercicesGeles;
  return {
    contrats: Array.isArray(objet.contrats) ? objet.contrats.length : 0,
    periodes: Array.isArray(objet.periodes) ? objet.periodes.length : 0,
    exercicesGeles: geles !== null && typeof geles === "object" ? Object.keys(geles as object).length : 0,
    profilPresent: objet.profil !== null && objet.profil !== undefined,
  };
}

/** Les endroits où les deux versions divergent, en clair. Vide si tout concorde. */
export function listerDifferences(local: DonneesApp, serveur: unknown): string[] {
  const cote = (serveur ?? {}) as Record<string, unknown>;
  const differences: string[] = [];

  for (const cle of CLES_DONNEES) {
    if (texteCanonique(local[cle]) !== texteCanonique(cote[cle])) differences.push(NOM_LISIBLE[cle]);
  }

  // Une clé présente d'un seul côté est une vraie différence, et la boucle ci-dessus ne la voit que
  // si elle appartient à `DonneesApp`. Un champ inconnu venu du serveur doit être signalé, pas ignoré.
  const inconnues = Object.keys(cote).filter((cle) => !(CLES_DONNEES as readonly string[]).includes(cle));
  if (inconnues.length > 0) differences.push(`des champs inattendus côté serveur (${inconnues.join(", ")})`);

  return differences;
}

export type Verdict =
  | { statut: "identique"; empreinte: string; local: Decompte; serveur: Decompte; majLe: string | null }
  | { statut: "different"; empreinteLocale: string; empreinteServeur: string; local: Decompte; serveur: Decompte; majLe: string | null; differences: string[] }
  | { statut: "versionInattendue"; attendue: number; recue: unknown }
  | { statut: "absente" }
  | { statut: "echec"; message: string };

/**
 * LE point d'entrée de la vérification chiffrée.
 *
 * Ordre des contrôles délibéré : la version de schéma est vérifiée AVANT toute comparaison. Comparer
 * des données écrites sous un autre schéma produirait un « différent » exact mais trompeur — il
 * enverrait chercher une perte de données là où il n'y a qu'un changement de format.
 *
 * @param local les données de CE navigateur, qui restent la référence jusqu'à la phase 5.
 * @param hacher injectable pour les tests ; SHA-256 du navigateur en production.
 */
export async function verifierMigration(
  client: ClientLectureDonnees,
  utilisateurId: string,
  local: DonneesApp,
  hacher: Hacheur = hacheurSha256,
): Promise<Verdict> {
  const lecture = await lireLigneServeur(client, utilisateurId);
  if (lecture.statut === "absente") return { statut: "absente" };
  if (lecture.statut === "echec") return { statut: "echec", message: lecture.message };

  const { donnees, versionSchema, majLe } = lecture.ligne;
  if (versionSchema !== SCHEMA_VERSION_DONNEES) {
    return { statut: "versionInattendue", attendue: SCHEMA_VERSION_DONNEES, recue: versionSchema };
  }

  try {
    const [empreinteLocale, empreinteServeur] = await Promise.all([hacher(texteCanonique(local)), hacher(texteCanonique(donnees))]);
    const decompteLocal = decompter(local);
    const decompteServeur = decompter(donnees);

    if (empreinteLocale === empreinteServeur) {
      return { statut: "identique", empreinte: empreinteLocale, local: decompteLocal, serveur: decompteServeur, majLe };
    }

    return {
      statut: "different",
      empreinteLocale,
      empreinteServeur,
      local: decompteLocal,
      serveur: decompteServeur,
      majLe,
      differences: listerDifferences(local, donnees),
    };
  } catch (incident: unknown) {
    // Notamment `crypto.subtle` absent. Sans empreinte, il n'y a PAS de verdict : on le dit, on ne
    // se rabat pas sur une comparaison plus faible qui serait crue sur parole.
    return { statut: "echec", message: incident instanceof Error ? incident.message : String(incident) };
  }
}
