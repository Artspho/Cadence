// Sortie des justificatifs du localStorage — logique pure de l'envoi vers Google Drive.
//
// POURQUOI CE FICHIER. Un justificatif est aujourd'hui stocké **en base64 dans le localStorage**
// (`justificatifData`), et c'est le seul vrai carburant de la saturation : les 62 contrats réels de
// Benoît pèsent 23 Ko, un scan de facture de 3 Mo en occupe 4,0 Mo (mesures du 04/08/2026, cf.
// lib/capaciteStockage.ts). Le point 2 a posé le filet — dire la vérité quand c'est plein ; ici on
// s'attaque à la cause.
//
// DÉCISIONS DE BENOÎT, 04/08/2026 — les trois, à ne pas re-litiger :
//   1. destination = **Google Drive**, dont le chemin est déjà écrit (lib/googleDriveStorage.ts).
//      **IndexedDB a été proposé et REFUSÉ** ;
//   2. si l'envoi échoue (réseau coupé, Drive indisponible), le justificatif est gardé localement mais
//      **MARQUÉ « à envoyer »**, avec un compteur visible et une nouvelle tentative possible. Le repli
//      silencieux d'avant (DepenseForm retombait en base64 avec un message discret) recréait la
//      saturation à l'insu de l'utilisateur : c'est précisément ce qu'on ferme ;
//   3. les justificatifs **déjà** en base64 se migrent sur un bouton explicite, avec compte-rendu.
//
// LA SIMPLIFICATION QUI EN DÉCOULE, et qui vaut d'être dite : « migrer l'existant » et « envoyer ce qui
// est en attente » sont **la même opération** — envoyer vers Drive tout justificatif encore stocké
// localement. Un seul mécanisme, deux libellés à l'écran. Ne pas les dédoubler.
//
// RÈGLE ABSOLUE DE CE FICHIER (devoir sacré n°1) : le contenu local d'un justificatif n'est effacé
// QUE lorsque l'envoi de CE fichier est confirmé. Jamais avant, jamais en lot, jamais « on verra ».
// Un échec au milieu d'une migration laisse donc un état parfaitement lisible : ce qui est parti a son
// `driveFileId`, ce qui n'est pas parti a toujours son base64.
import type { Depense } from "../types/fraisReels";

/** Ce qu'il faut pour envoyer un fichier : injecté, jamais importé ici — d'où la testabilité sans réseau. */
export type Uploader = (fichier: File, anneeFiscale: number) => Promise<{ driveFileId: string; driveWebViewLink: string }>;

export interface CompteRenduEnvoi {
  /** Dépenses mises à jour — celles dont l'envoi a réussi portent désormais `driveFileId`. */
  depenses: Depense[];
  envoyes: number;
  echecs: number;
  /** Libellé des justificatifs qui n'ont pas pu partir, pour les nommer à l'écran plutôt qu'un compte nu. */
  nomsEnEchec: string[];
}

/**
 * Justificatifs encore stockés dans ce navigateur : `justificatifData` présent et aucun `driveFileId`.
 *
 * C'est la définition de « en attente », et elle est volontairement dérivée de l'état plutôt que
 * stockée dans un drapeau à part. Un drapeau `aEnvoyer` persisté pourrait se désynchroniser de la
 * réalité (drapeau à `false` alors que le fichier est toujours local, ou l'inverse) et il faudrait
 * alors décider lequel des deux croire. Ici, il n'y a rien à croire : soit le base64 est là, soit non.
 */
export function justificatifsEnAttente(depenses: Depense[]): Depense[] {
  return depenses.filter((d) => Boolean(d.justificatifData) && !d.driveFileId);
}

/** Poids total, en caractères, de ce que ces justificatifs occupent dans le stockage. */
export function poidsJustificatifsEnAttente(depenses: Depense[]): number {
  return justificatifsEnAttente(depenses).reduce((total, d) => total + (d.justificatifData?.length ?? 0), 0);
}

/**
 * Reconstruit un `File` à partir du base64 stocké (une data URL, telle que produite par
 * `FileReader.readAsDataURL`) — c'est ce que l'API Drive attend.
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
 * Envoie vers Drive tous les justificatifs encore locaux, un par un, et rend compte.
 *
 * Séquentiel et non parallèle, délibérément : `uploaderJustificatif` crée au besoin les dossiers
 * `Cadence/Frais_<année>` (cf. lib/googleDriveStorage.ts). Lancés en parallèle, plusieurs envois
 * créeraient plusieurs dossiers du même nom — Drive l'autorise, contrairement à un système de fichiers.
 *
 * Un échec sur un fichier n'arrête pas les autres : on veut le maximum de fichiers sortis du
 * localStorage, et un compte-rendu qui dit exactement lesquels sont restés.
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
      const { driveFileId, driveWebViewLink } = await uploader(fichier, depense.anneeFiscale);
      // L'effacement du base64 et l'écriture du driveFileId se font dans le MÊME objet, à cet instant
      // précis : il n'existe aucun état intermédiaire où le fichier ne serait ni local ni sur Drive.
      parId.set(depense.id, { ...depense, driveFileId, driveWebViewLink, justificatifData: undefined });
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
