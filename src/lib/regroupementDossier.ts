import type { LigneDocument, TypeDocument } from "../storage/documentsStorage";
import type { CategorieFrais } from "../types/fraisReels";
import { LIBELLES_TYPE_DOCUMENT, TYPES_DOCUMENT_ORDONNES } from "../content/typeDocumentLabels";
import { CATEGORIES_ORDONNEES, LIBELLES_CATEGORIE_COMPLETS } from "../components/fraisReels/categorieLabels";

/**
 * REGROUPEMENT DE « MON DOSSIER » — demandé par Benoît le 06/08/2026.
 *
 * L'écran affichait une liste plate triée par date : quatre justificatifs de catégorie A se
 * retrouvaient dispersés entre un AEM et une notification ARE. Or constituer un dossier de frais
 * réels, c'est présenter ses justificatifs PAR CATÉGORIE — c'est ce que cette fonction rend possible.
 *
 * Fonction PURE, sans React ni accès réseau : c'est elle qui porte toutes les règles de classement,
 * l'écran ne fait que rendre ce qu'elle retourne.
 *
 * ⚠️ RÈGLE ABSOLUE DE CE MODULE — AUCUN DOCUMENT NE DISPARAÎT JAMAIS (devoir n°1). Trois cas
 * pourraient faire perdre une ligne en silence, et sont donc traités explicitement :
 *  1. un `justificatif_frais` SANS catégorie (`categorie_frais` est nullable dans la migration 0001,
 *     ce n'est pas une anomalie) → sous-groupe « Sans catégorie », jamais écarté ;
 *  2. un `type_document` INCONNU de `TYPES_DOCUMENT_ORDONNES` (valeur ajoutée en SQL avant de l'être
 *     dans le code, ou l'inverse) → groupe « Autres documents » en fin de liste, avec le type brut
 *     affiché tel quel plutôt que traduit — on ne devine pas un libellé ;
 *  3. une `categorie_frais` posée sur un type qui n'est PAS `justificatif_frais` — interdit par la
 *     contrainte des deux axes en écriture, mais la lecture ne durcit rien : la catégorie est alors
 *     ignorée pour le classement, et le document reste dans le groupe de son type.
 *
 * L'ORDRE DES DOCUMENTS À L'INTÉRIEUR D'UN GROUPE EST CELUI D'ENTRÉE, jamais retrié ici :
 * `listerDocuments` les rend déjà du plus récent au plus ancien (`order("cree_le", ascending: false)`).
 * Retrier ici installerait une seconde source de vérité sur l'ordre.
 */

/** Sous-groupe par catégorie de frais — n'existe que sous `justificatif_frais`. */
export interface SousGroupeDossier {
  /** `null` = déposé sans catégorie (cas 1 de l'avertissement). */
  categorie: CategorieFrais | null;
  libelle: string;
  documents: LigneDocument[];
  totalOctets: number;
}

export interface GroupeDossier {
  /** Le type brut, tel qu'il vient du serveur. */
  type: string;
  libelle: string;
  /** Tous les documents du groupe, sous-groupes confondus. */
  documents: LigneDocument[];
  totalOctets: number;
  /** Vide sauf pour `justificatif_frais`. */
  sousGroupes: SousGroupeDossier[];
}

function estCategorieConnue(valeur: string | null): valeur is CategorieFrais {
  return valeur !== null && (CATEGORIES_ORDONNEES as string[]).includes(valeur);
}

function totalOctets(documents: LigneDocument[]): number {
  return documents.reduce((total, d) => total + d.tailleOctets, 0);
}

/**
 * Découpe les justificatifs de frais par catégorie, dans l'ordre officiel (A, B, C1…C9, D), les
 * catégories vides omises, et « Sans catégorie » toujours en DERNIER — c'est une anomalie à corriger
 * par l'utilisateur, pas une catégorie à mettre en avant.
 *
 * Une catégorie inconnue (valeur hors `CATEGORIES_ORDONNEES`, donc hors contrainte SQL) tombe aussi
 * dans « Sans catégorie » : la ranger sous son libellé supposé serait inventer une classification.
 */
function decouperParCategorie(documents: LigneDocument[]): SousGroupeDossier[] {
  const sousGroupes: SousGroupeDossier[] = [];

  for (const categorie of CATEGORIES_ORDONNEES) {
    const duGroupe = documents.filter((d) => d.categorieFrais === categorie);
    if (duGroupe.length === 0) continue;
    sousGroupes.push({
      categorie,
      libelle: LIBELLES_CATEGORIE_COMPLETS[categorie],
      documents: duGroupe,
      totalOctets: totalOctets(duGroupe),
    });
  }

  const sansCategorie = documents.filter((d) => !estCategorieConnue(d.categorieFrais));
  if (sansCategorie.length > 0) {
    sousGroupes.push({
      categorie: null,
      libelle: "Sans catégorie",
      documents: sansCategorie,
      totalOctets: totalOctets(sansCategorie),
    });
  }

  return sousGroupes;
}

/** Regroupe par type de document, et par catégorie sous les justificatifs de frais. */
export function regrouperDocuments(documents: LigneDocument[]): GroupeDossier[] {
  const groupes: GroupeDossier[] = [];

  for (const type of TYPES_DOCUMENT_ORDONNES) {
    const duType = documents.filter((d) => d.typeDocument === type);
    if (duType.length === 0) continue;
    groupes.push({
      type,
      libelle: LIBELLES_TYPE_DOCUMENT[type],
      documents: duType,
      totalOctets: totalOctets(duType),
      sousGroupes: type === "justificatif_frais" ? decouperParCategorie(duType) : [],
    });
  }

  // Cas 2 : tout type que le code ne connaît pas. Regroupé à part, en fin de liste, plutôt que perdu.
  const connus = new Set<string>(TYPES_DOCUMENT_ORDONNES);
  const inconnus = documents.filter((d) => !connus.has(d.typeDocument));
  if (inconnus.length > 0) {
    groupes.push({
      type: "__inconnu__",
      libelle: "Autres documents",
      documents: inconnus,
      totalOctets: totalOctets(inconnus),
      sousGroupes: [],
    });
  }

  return groupes;
}

/**
 * Chemin d'un document DANS L'ARCHIVE ZIP : `<type>/<catégorie>/<nom>`, ou `<type>/<nom>` hors
 * justificatifs de frais. C'est ce qui fait qu'une archive ouverte sur le bureau a la même
 * organisation que l'écran.
 *
 * ⚠️ Le nom du dossier vient du libellé AFFICHÉ, tronqué à ce qui précède le tiret cadratin
 * (« C7 — Matériel, mobilier, fournitures » → « C7 ») : un nom de dossier avec ponctuation et accents
 * se comporte mal sur certains systèmes de fichiers, et le code de catégorie suffit à s'y retrouver.
 */
export function cheminDansArchive(document: LigneDocument): string {
  const typeConnu = (TYPES_DOCUMENT_ORDONNES as string[]).includes(document.typeDocument);
  const dossierType = typeConnu ? document.typeDocument : "autres";
  if (document.typeDocument !== "justificatif_frais") return `${dossierType}/${document.nomFichier}`;
  const categorie = estCategorieConnue(document.categorieFrais) ? document.categorieFrais : "sans-categorie";
  return `${dossierType}/${categorie}/${document.nomFichier}`;
}

/**
 * Rend un chemin d'archive UNIQUE, en numérotant les doublons (`facture.pdf`, `facture (2).pdf`).
 *
 * ⚠️ POURQUOI C'EST INDISPENSABLE ET PAS COSMÉTIQUE : deux dépenses de la même catégorie peuvent très
 * bien porter deux fichiers nommés `facture.pdf` (le nom vient de l'utilisateur, rien ne l'empêche).
 * Ajoutés au même chemin dans une archive, le second ÉCRASERAIT le premier — un document perdu en
 * silence, exactement ce que le devoir n°1 interdit. `dejaPris` est muté par l'appelant au fil de la
 * construction.
 */
export function cheminUnique(chemin: string, dejaPris: Set<string>): string {
  if (!dejaPris.has(chemin)) {
    dejaPris.add(chemin);
    return chemin;
  }
  const point = chemin.lastIndexOf(".");
  const base = point > chemin.lastIndexOf("/") && point !== -1 ? chemin.slice(0, point) : chemin;
  const extension = point > chemin.lastIndexOf("/") && point !== -1 ? chemin.slice(point) : "";
  let compteur = 2;
  let candidat = `${base} (${compteur})${extension}`;
  while (dejaPris.has(candidat)) {
    compteur += 1;
    candidat = `${base} (${compteur})${extension}`;
  }
  dejaPris.add(candidat);
  return candidat;
}
