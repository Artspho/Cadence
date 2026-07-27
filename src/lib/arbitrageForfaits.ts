// Arbitrage forfait / réel des rubriques A et B — INDÉPENDAMMENT l'une de l'autre (formulaire
// SNAM-CGT, note de bas de page (1) : « Les forfaits de 14 % et 5 % sont indépendants l'un de
// l'autre […] Au cas où le montant des frais énumérés ci-dessus dépasserait le forfait
// correspondant, celui-ci peut être abandonné et les frais sont déclarés pour leur montant réel »).
//
// Aucune règle de calcul ici : les deux montants de chaque rubrique sont obtenus en rejouant
// `calculerFraisReels` avec le mode forcé, exactement comme le faisait déjà ForfaitsReglages.tsx —
// les taux 14 %/5 % restent lus par le moteur dans ftConfig, jamais dupliqués ici.
//
// L'abattement 10 % (`resultat.forfait10Pct`) n'a délibérément AUCUNE place dans cet arbitrage : il
// tranche « déclarer aux frais réels ou pas », question globale et distincte, jamais « forfait ou
// réel sur telle rubrique ».
import type { ConfigFraisReels, Depense } from "../types/fraisReels";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerFraisReels } from "../engine/fraisReels";

export type OptionAvantageuse = "forfait" | "reel" | "identique";

export interface ArbitrageRubrique {
  reel: number; // somme des dépenses réelles de la rubrique
  forfait: number; // taux × R, tel que calculé par le moteur
  meilleur: OptionAvantageuse;
  ecart: number; // gain de l'option la plus avantageuse, toujours >= 0
  aDepensesReelles: boolean; // au moins une dépense saisie dans cette rubrique
}

export interface ArbitrageForfaits {
  a: ArbitrageRubrique;
  b: ArbitrageRubrique;
  // profil « enseignant pur » : aucun droit aux forfaits A/B (spec §2), il n'y a rien à arbitrer.
  forfaitsDesactives: boolean;
}

function comparer(reel: number, forfait: number, aDepensesReelles: boolean): ArbitrageRubrique {
  const ecart = Math.abs(reel - forfait);
  const meilleur: OptionAvantageuse = reel > forfait ? "reel" : forfait > reel ? "forfait" : "identique";
  return { reel, forfait, meilleur, ecart: Math.round(ecart * 100) / 100, aDepensesReelles };
}

export function calculerArbitrageForfaits(depenses: Depense[], config: ConfigFraisReels, ftConfig: FranceTravailConfig): ArbitrageForfaits {
  const forfaitA = calculerFraisReels(depenses, { ...config, modeA: "forfait" }, ftConfig).montantA;
  const reelA = calculerFraisReels(depenses, { ...config, modeA: "reel" }, ftConfig).montantA;
  const forfaitB = calculerFraisReels(depenses, { ...config, modeB: "forfait" }, ftConfig).montantB;
  const reelB = calculerFraisReels(depenses, { ...config, modeB: "reel" }, ftConfig).montantB;

  return {
    a: comparer(reelA, forfaitA, depenses.some((d) => d.categorie === "A")),
    b: comparer(reelB, forfaitB, depenses.some((d) => d.categorie === "B")),
    forfaitsDesactives: config.profilFiscal === "enseignant_pur",
  };
}

/** Phrase de recommandation d'une rubrique — présentation uniquement. */
export function libelleRecommandation(rubrique: ArbitrageRubrique): string {
  if (rubrique.meilleur === "identique") return "Forfait et réel à égalité";
  if (rubrique.meilleur === "forfait") return `Forfait recommandé (+${rubrique.ecart.toFixed(2)} €)`;
  return `Passe en réel (+${rubrique.ecart.toFixed(2)} €)`;
}
