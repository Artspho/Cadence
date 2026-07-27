// Agrège le plan d'amortissement de plusieurs biens pour une année d'imposition donnée — moteur
// pur, zéro React, zéro localStorage. Chaque bien est délégué à calculerAmortissement (une année
// = un bien = un appel) ; ce module ne fait qu'agréger et classer les biens (en cours, soldés,
// futurs), rien de plus.
import type { BienAmorti } from "../../types/fraisReels";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAmortissement, type ResultatAmortissement } from "./calculerAmortissement";

export interface DetailAmortissement {
  bien: BienAmorti;
  resultat: ResultatAmortissement;
}

export interface RetourCalculerAmortissementsAnnee {
  totalDeductible: number; // somme des annuiteDeductible de tous les biens actifs (biensEnCours)
  detail: DetailAmortissement[]; // tous les biens retenus (futurs, soldés, en cours), avec leur résultat
  biensFuturs: BienAmorti[]; // horsScope car pas encore commencés
  biensSoldes: BienAmorti[]; // horsScope car terminés
  biensEnCours: BienAmorti[]; // contribuent à l'année
  aContinuerAnneeSuivante: BienAmorti[]; // en cours ET anneeFin > anneeImposition
}

const arrondi = (valeur: number): number => Math.round(valeur * 100) / 100;

export function calculerAmortissementsAnnee(biens: BienAmorti[], anneeImposition: number, config: FranceTravailConfig): RetourCalculerAmortissementsAnnee {
  const seuil = config.fraisReels.amortissements.seuilAmortissementHT;

  const detail: DetailAmortissement[] = [];
  const biensFuturs: BienAmorti[] = [];
  const biensSoldes: BienAmorti[] = [];
  const biensEnCours: BienAmorti[] = [];
  const aContinuerAnneeSuivante: BienAmorti[] = [];
  let totalDeductible = 0;

  for (const bien of biens) {
    // Défense en profondeur : un bien ≤ seuil ne devrait jamais arriver ici (la déduction intégrale
    // est gérée avant, hors de ce module) — ignoré silencieusement plutôt que de fausser le total.
    if (bien.prixHT <= seuil) continue;

    const resultat = calculerAmortissement({ prixHT: bien.prixHT, dateAchat: bien.dateAchat, dureeAns: bien.dureeAns, anneeImposition, tauxPro: bien.tauxPro }, seuil);
    detail.push({ bien, resultat });

    if (resultat.horsScope) {
      if (anneeImposition < resultat.anneeDebut) biensFuturs.push(bien);
      else biensSoldes.push(bien);
      continue;
    }

    biensEnCours.push(bien);
    totalDeductible += resultat.annuiteDeductible;
    if (resultat.anneeFin > anneeImposition) aContinuerAnneeSuivante.push(bien);
  }

  return { totalDeductible: arrondi(totalDeductible), detail, biensFuturs, biensSoldes, biensEnCours, aContinuerAnneeSuivante };
}
