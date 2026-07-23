// Utilitaires de dates communs au moteur. Aucune valeur réglementaire ici :
// uniquement de l'arithmétique de calendrier, réutilisée par plusieurs
// modules (periodeReference, decompteHeures, cycles, prediction).
import { addDays, differenceInCalendarDays, differenceInYears, format, getDaysInMonth, parseISO } from "date-fns";

export function toDate(iso: string): Date {
  return parseISO(iso);
}

export function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function ajouterJours(iso: string, jours: number): string {
  return toISO(addDays(toDate(iso), jours));
}

/** Différence en jours (b - a), peut être négative si b est avant a. */
export function diffJours(isoA: string, isoB: string): number {
  return differenceInCalendarDays(toDate(isoB), toDate(isoA));
}

/** Âge en années révolues à la date donnée. */
export function ageAuJour(dateNaissanceISO: string, dateReferenceISO: string): number {
  return differenceInYears(toDate(dateReferenceISO), toDate(dateNaissanceISO));
}

/** Clé "YYYY-MM" d'une date ISO, pour grouper des contrats par mois civil. */
export function moisCle(iso: string): string {
  return format(toDate(iso), "yyyy-MM");
}

/** Nombre de jours du mois civil désigné par une clé "YYYY-MM". */
export function joursDansMois(mois: string): number {
  return getDaysInMonth(parseISO(`${mois}-01`));
}

export function clamp(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}

/** Une date ISO est-elle dans l'intervalle [debut, fin] inclus ? */
export function dansIntervalle(iso: string, debutISO: string, finISO: string): boolean {
  const t = toDate(iso).getTime();
  return t >= toDate(debutISO).getTime() && t <= toDate(finISO).getTime();
}

/** Nombre de jours communs entre [aDebut, aFin] et [bDebut, bFin], 0 si aucun chevauchement. */
export function joursChevauchement(aDebut: string, aFin: string, bDebut: string, bFin: string): number {
  const debut = Math.max(toDate(aDebut).getTime(), toDate(bDebut).getTime());
  const fin = Math.min(toDate(aFin).getTime(), toDate(bFin).getTime());
  if (fin < debut) return 0;
  return Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
}
