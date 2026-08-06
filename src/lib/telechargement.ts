/**
 * Téléchargement d'un fichier depuis le navigateur — définition UNIQUE.
 *
 * Extrait le 05/08/2026 : la même dizaine de lignes vivait déjà en double (`App.tsx` et
 * `EcranDonneesIllisibles.tsx`), et la phase 5 en aurait fait une troisième copie. Ce n'est pas
 * qu'une question de propreté : c'est le geste par lequel on met ses données à l'abri AVANT une
 * manipulation risquée. Il doit se comporter à l'identique partout, y compris le jour où il faudra
 * le corriger.
 */

/** Nom de fichier horodaté : deux mises à l'abri successives ne s'écrasent pas dans le dossier. */
export function horodatagePourNomFichier(maintenant: Date = new Date()): string {
  return maintenant.toISOString().replace(/[:.]/g, "-");
}

export function telechargerTexte(nomFichier: string, contenu: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Télécharge un fichier BINAIRE depuis une URL déjà obtenue (phase 6 — URL signée du bucket
 * `justificatifs`). Le fichier est d'abord récupéré en `Blob` plutôt que déposé tel quel dans
 * `<a href>` : une URL signée sert typiquement le fichier en `Content-Disposition: inline`, donc un
 * lien direct l'ouvrirait dans l'onglet au lieu de le télécharger, et n'imposerait pas `nomFichier`
 * comme nom local. Passer par un `Blob` garantit le même comportement qu'un vrai téléchargement,
 * quel que soit l'en-tête renvoyé par le serveur.
 */
export async function telechargerDepuisUrl(nomFichier: string, url: string): Promise<void> {
  const reponse = await fetch(url);
  const blob = await reponse.blob();
  telechargerBlob(nomFichier, blob);
}

/**
 * Déclenche le téléchargement d'un contenu DÉJÀ en mémoire — l'archive zip de « Mon dossier »
 * (06/08/2026), construite dans le navigateur et qui n'a donc aucune URL à récupérer.
 *
 * Extrait de `telechargerDepuisUrl` plutôt que dupliqué : les deux chemins partagent exactement le
 * même geste, et deux copies auraient divergé au premier correctif.
 */
export function telechargerBlob(nomFichier: string, blob: Blob): void {
  const urlObjet = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = urlObjet;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(urlObjet);
}
