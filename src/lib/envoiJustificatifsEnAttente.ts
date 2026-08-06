// Sortie des justificatifs du localStorage — logique pure de l'envoi vers Supabase Storage.
//
// POURQUOI CE FICHIER. Un justificatif est aujourd'hui stocké **en base64 dans le localStorage**
// (`justificatifData`), et c'est le seul vrai carburant de la saturation : les 62 contrats réels de
// Benoît pèsent 23 Ko, un scan de facture de 3 Mo en occupe 4,0 Mo (mesures du 04/08/2026, cf.
// lib/capaciteStockage.ts). Le point 2 a posé le filet — dire la vérité quand c'est plein ; ici on
// s'attaque à la cause.
//
// DÉCISIONS DE BENOÎT, 04/08/2026 — les deux premières, à ne pas re-litiger :
//   1. si l'envoi échoue (réseau coupé, serveur indisponible), le justificatif est gardé localement
//      mais **MARQUÉ « à envoyer »**, avec un compteur visible et une nouvelle tentative possible. Le
//      repli silencieux d'avant (DepenseForm retombait en base64 avec un message discret) recréait la
//      saturation à l'insu de l'utilisateur : c'est précisément ce qu'on ferme ;
//   2. les justificatifs **déjà** en base64 se migrent sur un bouton explicite, avec compte-rendu.
//   ⚠️ La 3ᵉ décision d'origine (destination = Google Drive) a été RETIRÉE au commit 6 de la phase 6
//   (05/08/2026) : le module Drive a disparu, la destination est désormais Supabase Storage — même
//   bucket `justificatifs` que les canaux d'import (cf. `storage/documentsStorage.ts`).
//
// LA SIMPLIFICATION QUI EN DÉCOULE, et qui vaut d'être dite : « migrer l'existant » et « envoyer ce qui
// est en attente » sont **la même opération** — envoyer vers le serveur tout justificatif encore
// stocké localement. Un seul mécanisme, deux libellés à l'écran. Ne pas les dédoubler.
//
// RÈGLE ABSOLUE DE CE FICHIER (devoir sacré n°1) : le contenu local d'un justificatif n'est effacé
// QUE lorsque l'envoi de CE fichier est confirmé. Jamais avant, jamais en lot, jamais « on verra ».
// Un échec au milieu d'une migration laisse donc un état parfaitement lisible : ce qui est parti a son
// `documentId`, ce qui n'est pas parti a toujours son base64.
import type { Depense } from "../types/fraisReels";

/**
 * Ce qu'il faut pour envoyer un fichier : injecté, jamais importé ici — d'où la testabilité sans
 * réseau. `categorieFrais` est requise par la contrainte SQL de `documents` (`categorie_frais` non
 * nul quand `type_document = 'justificatif_frais'`, cf. migration 0003).
 */
export type Uploader = (fichier: File, anneeFiscale: number, categorieFrais: string) => Promise<{ documentId: string }>;

export interface CompteRenduEnvoi {
  /** Dépenses mises à jour — celles dont l'envoi a réussi portent désormais `documentId`. */
  depenses: Depense[];
  envoyes: number;
  echecs: number;
  /** Libellé des justificatifs qui n'ont pas pu partir, pour les nommer à l'écran plutôt qu'un compte nu. */
  nomsEnEchec: string[];
}

/**
 * Justificatifs encore stockés dans ce navigateur : `justificatifData` présent et aucun `documentId`.
 *
 * C'est la définition de « en attente », et elle est volontairement dérivée de l'état plutôt que
 * stockée dans un drapeau à part. Un drapeau `aEnvoyer` persisté pourrait se désynchroniser de la
 * réalité (drapeau à `false` alors que le fichier est toujours local, ou l'inverse) et il faudrait
 * alors décider lequel des deux croire. Ici, il n'y a rien à croire : soit le base64 est là, soit non.
 */
export function justificatifsEnAttente(depenses: Depense[]): Depense[] {
  return depenses.filter((d) => Boolean(d.justificatifData) && !d.documentId);
}

/** Poids total, en caractères, de ce que ces justificatifs occupent dans le stockage. */
export function poidsJustificatifsEnAttente(depenses: Depense[]): number {
  return justificatifsEnAttente(depenses).reduce((total, d) => total + (d.justificatifData?.length ?? 0), 0);
}

/**
 * Reconstruit un `File` à partir du base64 stocké (une data URL, telle que produite par
 * `FileReader.readAsDataURL`) — c'est ce que l'upload Supabase Storage attend.
 *
 * Renvoie `null` si le contenu n'est pas exploitable, au lieu de lever : un justificatif illisible ne
 * doit pas interrompre l'envoi des autres, et surtout il ne doit PAS être effacé — il ressortira au
 * prochain essai, toujours listé comme en attente, ce qui est la vérité.
 */
export function fichierDepuisDataUrl(dataUrl: string, nom: string): File | null {
  const separateur = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || separateur === -1) return null;
  const enTete = dataUrl.slice(5, separateur);
  const type = enTete.split(";")[0] || "application/octet-stream";
  try {
    const binaire = atob(dataUrl.slice(separateur + 1));
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
    return new File([octets], nom, { type });
  } catch {
    return null;
  }
}

/**
 * Envoie vers le serveur tous les justificatifs encore locaux, un par un, et rend compte.
 *
 * Séquentiel et non parallèle : même prudence que l'ancien envoi Drive (qui devait éviter de créer
 * deux fois le même dossier), et surtout plus simple à lire pour un compte-rendu fiable — un échec sur
 * un fichier n'arrête pas les autres, on veut le maximum de fichiers sortis du localStorage.
 */
export async function envoyerJustificatifsLocaux(depenses: Depense[], uploader: Uploader): Promise<CompteRenduEnvoi> {
  const aEnvoyer = justificatifsEnAttente(depenses);
  const parId = new Map<string, Depense>();
  const nomsEnEchec: string[] = [];
  let envoyes = 0;

  for (const depense of aEnvoyer) {
    const nom = depense.justificatifNom ?? `justificatif-${depense.id}`;
    const fichier = fichierDepuisDataUrl(depense.justificatifData as string, nom);
    if (fichier === null) {
      nomsEnEchec.push(nom);
      continue;
    }
    try {
      const { documentId } = await uploader(fichier, depense.anneeFiscale, depense.categorie);
      // L'effacement du base64 et l'écriture du documentId se font dans le MÊME objet, à cet instant
      // précis : il n'existe aucun état intermédiaire où le fichier ne serait ni local ni sur le serveur.
      parId.set(depense.id, { ...depense, documentId, justificatifData: undefined });
      envoyes += 1;
    } catch {
      nomsEnEchec.push(nom);
    }
  }

  return {
    depenses: depenses.map((d) => parId.get(d.id) ?? d),
    envoyes,
    echecs: nomsEnEchec.length,
    nomsEnEchec,
  };
}
