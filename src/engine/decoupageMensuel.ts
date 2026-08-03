// Répartit un contrat sur les mois civils qu'il chevauche, au prorata des jours calendaires —
// nécessaire pour calculer correctement les jours non indemnisables mensuels (JNI, cf.
// indemnisationMensuelle.ts) à partir des VRAIS contrats plutôt que d'une saisie manuelle.
//
// Réutilise heuresBrutesContrat (decompteHeures.ts) pour les heures totales du contrat — une seule
// définition de "combien d'heures apporte ce contrat", jamais dupliquée ici.
//
// Pas de plafond mensuel appliqué ici (ex. 28 cachets/mois = 336 h) : ce plafond gouverne
// l'affiliation aux 507 h (decompteHeures.ts), un compteur volontairement distinct (cf. CLAUDE.md,
// "deux compteurs distincts, à ne jamais mélanger") — aucun des 4 mois certifiés (fév-mai 2026,
// jusqu'à 153 h) ne l'approche, rien ne confirme qu'il s'applique aussi au calcul des JNI.
import type { Contrat } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { bornesDuMois, diffJours, joursChevauchement, moisEntre } from "./dateUtils";
import { heuresBrutesContrat } from "./decompteHeures";

export interface RepartitionMensuelle {
  moisCle: string; // "YYYY-MM"
  heures: number;
  salaireBrut: number;
}

/**
 * Répartit heures et salaire brut d'un contrat sur les mois civils de [dateDebut, date], au
 * prorata des jours calendaires de chaque mois. Le dernier mois reçoit le reliquat exact
 * (heures/salaire totaux − déjà distribués) plutôt qu'un arrondi indépendant, pour garantir que
 * la somme des mois égale toujours exactement le total du contrat (jamais de perte ni de surplus
 * par accumulation d'arrondis).
 */
/**
 * Heures apportées par un lot de contrats sur une fenêtre de dates ARBITRAIRE (pas forcément un mois
 * civil entier), au prorata des jours calendaires — même règle de prorata que
 * `repartirContratParMois` ci-dessous, appliquée à une borne libre.
 *
 * Sert au MOIS D'OUVERTURE PARTIEL : quand les droits s'ouvrent le 18/01, seuls les jours du 18 au
 * 31 relèvent du nouveau droit, et les heures à retenir sont celles de cette fenêtre — pas celles du
 * mois civil entier. Compter le mois entier revenait à déduire un travail effectué sous le droit
 * PRÉCÉDENT (mesuré le 03/08/2026 : 129 h au lieu de 93 h en janvier 2026, donc 16 jours non
 * indemnisables au lieu de 12).
 *
 * Arrondi au jour près comme `repartirContratParMois` (une valeur d'heures entière, affichable telle
 * quelle) : le décompte des jours non indemnisables plancherait de toute façon ensuite.
 */
export function heuresContratsSurFenetre(contrats: Contrat[], fenetreDebut: string, fenetreFin: string, config: FranceTravailConfig): number {
  const total = contrats.reduce((somme, contrat) => {
    const joursDansLaFenetre = joursChevauchement(contrat.dateDebut, contrat.date, fenetreDebut, fenetreFin);
    if (joursDansLaFenetre === 0) return somme;
    const dureeTotaleJours = diffJours(contrat.dateDebut, contrat.date) + 1;
    return somme + (heuresBrutesContrat(contrat, config).heures * joursDansLaFenetre) / dureeTotaleJours;
  }, 0);
  return Math.round(total);
}

export function repartirContratParMois(contrat: Contrat, config: FranceTravailConfig): RepartitionMensuelle[] {
  const heuresTotales = heuresBrutesContrat(contrat, config).heures;
  const salaireBrutTotal = contrat.salaireBrut;
  const dureeTotaleJours = diffJours(contrat.dateDebut, contrat.date) + 1;
  const mois = moisEntre(contrat.dateDebut, contrat.date);

  let heuresRestantes = heuresTotales;
  let salaireRestant = salaireBrutTotal;

  return mois.map((cle, index) => {
    const estDernier = index === mois.length - 1;
    if (estDernier) {
      return { moisCle: cle, heures: heuresRestantes, salaireBrut: Math.round(salaireRestant * 100) / 100 };
    }

    const { debut, fin } = bornesDuMois(cle);
    const joursDansCeMois = joursChevauchement(contrat.dateDebut, contrat.date, debut, fin);
    const heures = Math.round((heuresTotales * joursDansCeMois) / dureeTotaleJours);
    const salaireBrut = Math.round(((salaireBrutTotal * joursDansCeMois) / dureeTotaleJours) * 100) / 100;

    heuresRestantes -= heures;
    salaireRestant -= salaireBrut;

    return { moisCle: cle, heures, salaireBrut };
  });
}
