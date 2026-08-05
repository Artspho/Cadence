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
