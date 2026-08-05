import type { ClientDocuments, ClientFichiers, ErreurPostgrest, ErreurStorage } from "../auth/supabaseClient";

/**
 * PHASE 6 DE LA REFONTE SUPABASE — LES DOCUMENTS SONT RÉELLEMENT CONSERVÉS.
 *
 * Jusqu'ici, Cadence lisait un document puis le jetait (cf. `lib/documentsRequis.ts`, en cours de
 * réécriture au fil de cette phase). Ce module fait l'inverse : il dépose le fichier dans le bucket
 * `justificatifs` PUIS enregistre la ligne `documents` qui le décrit — dans cet ordre, jamais
 * l'inverse, pour ne jamais référencer un fichier qui n'existe pas.
 *
 * ⚠️ CE MODULE NE DÉCIDE JAMAIS DU TYPE. `typeDocumentDepuisDetection` traduit une détection déjà
 * faite (par l'IA ou par l'utilisateur) ; il ne devine rien lui-même. `non_reconnu` rend `null`
 * EXPRÈS : appeler ce module avec un type inconnu serait une invention, pas une traduction — c'est à
 * l'appelant de faire choisir l'utilisateur avant d'appeler `deposerDocument`.
 *
 * ⚠️ AUCUNE ÉCRITURE SANS SESSION. Chaque fonction ici suppose un `utilisateurId` réel (RLS l'exige
 * de toute façon), et aucune n'a de repli « stocker localement » — ce repli-là vit dans l'appelant
 * (chaque canal garde son comportement actuel quand personne n'est connecté).
 */

/** Les 10 valeurs de `documents.type_document`, migration 0003 — à tenir synchronisé avec le SQL. */
export type TypeDocument =
  | "aem_bulletin"
  | "notification_are"
  | "releve_situation"
  | "declaration_fiscale"
  | "justificatif_frais"
  | "attestation_cpam"
  | "justificatif_declaration"
  | "attestation_taux_pas"
  | "document_non_classe"
  | "planning_travail";

/**
 * Traduit une détection du canal IA (`ExtractionResult.typeDocumentDetecte`, `types/extraction.ts`)
 * en valeur `type_document`. `null` = pas de traduction automatique possible :
 *  - `non_reconnu` : l'IA n'a rien reconnu, l'utilisateur choisit lui-même (`document_non_classe` ou
 *    un autre type) — jamais deviné ici ;
 *  - `contrat_enseignement` n'existe PAS dans `typeDocumentDetecte` par décision produit antérieure
 *    (les contrats d'enseignement ne sont jamais lus par IA) — ce cas n'atteint donc jamais cette
 *    fonction, pas besoin de l'y traiter.
 *
 * Le paramètre est typé en `string` plutôt qu'en réimportant l'enum Zod : ce module ne doit pas
 * dépendre du canal IA pour exister (le canal local et les frais réels l'utilisent aussi), et un
 * type inconnu rend `null` au lieu de planter — cohérent avec la philosophie « on ne jette jamais
 * un fichier, mais on n'invente jamais son type ».
 */
export function typeDocumentDepuisDetection(typeDetecte: string): TypeDocument | null {
  switch (typeDetecte) {
    case "aem":
    case "bulletin_paie":
      return "aem_bulletin";
    case "notification_admission":
      return "notification_are";
    case "releve_situation":
      return "releve_situation";
    case "declaration_fiscale_annuelle":
      return "declaration_fiscale";
    case "attestation_cpam":
      return "attestation_cpam";
    case "justificatif_declaration":
      return "justificatif_declaration";
    case "attestation_taux_pas":
      return "attestation_taux_pas";
    default:
      return null;
  }
}

/**
 * Construit le chemin de stockage, convention `<user_id>/<annee>/<type>/<uuid>-<nom>` (posée dans
 * les commentaires de la migration 0001). L'UUID est généré ici plutôt que confié au hasard de
 * l'appelant : c'est lui qui garantit `chemin_stockage_unique` même si deux fichiers partagent le
 * même nom.
 *
 * `genererId` est injectable (même patron que `contratRecurrent.genererContratsRecurrents`) : les
 * tests passent un générateur déterministe plutôt que de comparer une sortie qui changerait à
 * chaque exécution.
 *
 * `nomFichier` est nettoyé a minima (espaces et caractères de chemin) : un nom d'origine porteur de
 * `/` casserait la convention de dossier elle-même.
 */
export function construireCheminStockage(
  utilisateurId: string,
  anneeFiscale: number,
  typeDocument: TypeDocument,
  nomFichier: string,
  genererId: () => string = () => crypto.randomUUID(),
): string {
  const nomNettoye = nomFichier.trim().replace(/[/\\]/g, "_").replace(/\s+/g, "_");
  return `${utilisateurId}/${anneeFiscale}/${typeDocument}/${genererId()}-${nomNettoye}`;
}

export interface NouveauDocument {
  utilisateurId: string;
  fichier: File;
  typeDocument: TypeDocument;
  /** Seulement quand `typeDocument === "justificatif_frais"` (contrainte SQL des deux axes). */
  categorieFrais?: string;
  anneeFiscale: number;
  dateDocument?: string;
  notes?: string;
}

export type ResultatDepot =
  /** Déposé avec succès — `id` sert de référence (ex. `Depense.documentId`). */
  | { statut: "depose"; id: string; cheminStockage: string }
  /** Le fichier a bien été envoyé dans le bucket, mais la ligne `documents` n'a PAS pu être créée.
   *  Le fichier existe donc en orphelin — jamais annoncé comme un échec total (règle n°4 de
   *  `sourceSupabase.ts` : ne jamais dire perdu ce qui a réussi), mais l'appelant doit le savoir
   *  pour, un jour, proposer un nettoyage plutôt que de laisser croire à une simple ligne manquante. */
  | { statut: "ficherEnvoyeLigneEchouee"; cheminStockage: string; message: string }
  /** Rien n'est parti : ni le fichier, ni la ligne. */
  | { statut: "echec"; message: string };

function messageDe(incident: unknown): string {
  return incident instanceof Error ? incident.message : String(incident);
}

function messageErreur(erreur: ErreurStorage | ErreurPostgrest): string {
  return erreur.message;
}

/**
 * Dépose un document : upload dans le bucket, PUIS insertion de la ligne `documents`. Dans cet
 * ordre, jamais l'inverse — une ligne sans fichier mentirait sur l'existence d'une pièce ; un
 * fichier sans ligne est un orphelin silencieux mais récupérable (jamais un mensonge affiché).
 */
export async function deposerDocument(clientFichiers: ClientFichiers, clientDocuments: ClientDocuments, nouveau: NouveauDocument): Promise<ResultatDepot> {
  const chemin = construireCheminStockage(nouveau.utilisateurId, nouveau.anneeFiscale, nouveau.typeDocument, nouveau.fichier.name);

  try {
    const { error: erreurUpload } = await clientFichiers.upload(chemin, nouveau.fichier);
    if (erreurUpload) return { statut: "echec", message: messageErreur(erreurUpload) };

    const ligne = {
      user_id: nouveau.utilisateurId,
      type_document: nouveau.typeDocument,
      categorie_frais: nouveau.categorieFrais ?? null,
      annee_fiscale: nouveau.anneeFiscale,
      chemin_stockage: chemin,
      nom_fichier: nouveau.fichier.name,
      taille_octets: nouveau.fichier.size,
      mime: nouveau.fichier.type,
      date_document: nouveau.dateDocument ?? null,
      notes: nouveau.notes ?? null,
    };

    const { data, error: erreurInsertion } = await clientDocuments.from("documents").insert(ligne).select("id");
    if (erreurInsertion) return { statut: "ficherEnvoyeLigneEchouee", cheminStockage: chemin, message: messageErreur(erreurInsertion) };

    const id = data?.[0]?.id;
    if (typeof id !== "string") return { statut: "ficherEnvoyeLigneEchouee", cheminStockage: chemin, message: "Le serveur n'a pas rendu l'identifiant de la ligne créée." };

    return { statut: "depose", id, cheminStockage: chemin };
  } catch (incident: unknown) {
    return { statut: "echec", message: messageDe(incident) };
  }
}

export interface LigneDocument {
  id: string;
  typeDocument: TypeDocument;
  categorieFrais: string | null;
  anneeFiscale: number;
  cheminStockage: string;
  nomFichier: string;
  tailleOctets: number;
  mime: string;
  dateDocument: string | null;
  notes: string | null;
  creeLe: string;
}

function ligneDepuisBrut(brut: Record<string, unknown>): LigneDocument | null {
  const { id, type_document, categorie_frais, annee_fiscale, chemin_stockage, nom_fichier, taille_octets, mime, date_document, notes, cree_le } = brut;
  if (typeof id !== "string" || typeof type_document !== "string" || typeof chemin_stockage !== "string") return null;
  return {
    id,
    typeDocument: type_document as TypeDocument,
    categorieFrais: typeof categorie_frais === "string" ? categorie_frais : null,
    anneeFiscale: typeof annee_fiscale === "number" ? annee_fiscale : 0,
    cheminStockage: chemin_stockage,
    nomFichier: typeof nom_fichier === "string" ? nom_fichier : "",
    tailleOctets: typeof taille_octets === "number" ? taille_octets : 0,
    mime: typeof mime === "string" ? mime : "",
    dateDocument: typeof date_document === "string" ? date_document : null,
    notes: typeof notes === "string" ? notes : null,
    creeLe: typeof cree_le === "string" ? cree_le : "",
  };
}

/** Liste les documents d'un utilisateur, du plus récent au plus ancien — pour l'écran « Mon dossier ». */
export async function listerDocuments(clientDocuments: ClientDocuments, utilisateurId: string): Promise<{ documents: LigneDocument[] } | { erreur: string }> {
  try {
    const { data, error } = await clientDocuments.from("documents").select("*").eq("user_id", utilisateurId).order("cree_le", { ascending: false });
    if (error) return { erreur: messageErreur(error) };
    const documents = (data ?? []).map(ligneDepuisBrut).filter((l): l is LigneDocument => l !== null);
    return { documents };
  } catch (incident: unknown) {
    return { erreur: messageDe(incident) };
  }
}

/**
 * Corrige le type d'un document déjà déposé — le filet prévu si l'IA se trompe sur un type rare
 * (ex. `attestation_cpam`, jamais testé en vrai faute de spécimen). Ne touche jamais au fichier ni
 * au chemin de stockage, seulement à la ligne.
 */
export async function corrigerTypeDocument(clientDocuments: ClientDocuments, documentId: string, nouveauType: TypeDocument): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await clientDocuments.from("documents").update({ type_document: nouveauType }).eq("id", documentId);
    if (error) return { ok: false, message: messageErreur(error) };
    return { ok: true };
  } catch (incident: unknown) {
    return { ok: false, message: messageDe(incident) };
  }
}

/** Une URL signée, à durée limitée — jamais mise en cache par l'appelant (cf. `ClientFichiers`). */
export async function obtenirUrlTelechargement(clientFichiers: ClientFichiers, cheminStockage: string): Promise<{ url: string } | { erreur: string }> {
  try {
    // 60 secondes : largement assez pour déclencher un téléchargement, pas assez pour qu'un lien
    // copié-collé ailleurs reste valable.
    const { data, error } = await clientFichiers.createSignedUrl(cheminStockage, 60);
    if (error) return { erreur: messageErreur(error) };
    if (!data?.signedUrl) return { erreur: "Le serveur n'a pas rendu d'URL signée." };
    return { url: data.signedUrl };
  } catch (incident: unknown) {
    return { erreur: messageDe(incident) };
  }
}
