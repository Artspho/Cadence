// Décompose/recompose une date ISO (YYYY-MM-DD) en trois champs jour/mois/année, pour le
// sélecteur de date de naissance (cf. DateNaissanceInput.tsx) — évite le défilement mois par mois
// du <input type="date"> natif sur mobile pour atteindre une année de naissance lointaine.
export interface DateJMA {
  jour: string; // chiffres tels que tapés, non complétés par des zéros ("3", "31", "")
  mois: string; // "01".."12" ou ""
  annee: string; // jusqu'à 4 chiffres ("199", "1994", "")
}

export function decouperDateIso(iso: string): DateJMA {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!correspondance) return { jour: "", mois: "", annee: "" };
  const [, annee, mois, jour] = correspondance;
  return { jour: String(Number(jour)), mois, annee };
}

export function dateEstValide(jour: number, mois: number, annee: number): boolean {
  if (!Number.isInteger(jour) || !Number.isInteger(mois) || !Number.isInteger(annee)) return false;
  if (mois < 1 || mois > 12) return false;
  if (jour < 1 || jour > 31) return false;
  const d = new Date(annee, mois - 1, jour);
  return d.getFullYear() === annee && d.getMonth() === mois - 1 && d.getDate() === jour;
}

export function composerDateIso({ jour, mois, annee }: DateJMA): string | null {
  if (!jour || !mois || annee.length !== 4) return null;
  const jourN = Number(jour);
  const moisN = Number(mois);
  const anneeN = Number(annee);
  if (!dateEstValide(jourN, moisN, anneeN)) return null;
  return `${annee}-${mois}-${String(jourN).padStart(2, "0")}`;
}
