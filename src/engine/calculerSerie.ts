// Itère `appliquerFranchises` (franchises.ts) mois par mois, en portant l'état (franchise CP
// restante, délai d'attente restant, report du forfait mensuel non consommé) d'un mois sur
// l'autre. Module indépendant : n'importe que `franchises.ts`, jamais `indemnisationMensuelle.ts`.
//
// Le moteur ne calcule jamais `franchiseCPTotale`/`delaiAttente` — ce sont des faits lus par
// l'utilisateur sur sa notification France Travail et saisis tels quels (Profil.ouvertureDroits).
// Ce module se contente de les CONSOMMER mois après mois, y compris sur le mois de réadmission
// lui-même (plus aucun mois sauté) : le découpage jour-mois exact de ce mois partiel entre
// l'ancien et le nouveau droit n'étant pas reconstituable, ce mois est traité comme un mois
// entier — une estimation assumée et affichée comme telle à l'utilisateur (cf. RevenusMensuels.tsx,
// badge "Estimation"), jamais un bug caché.
import { appliquerFranchises } from "./franchises";
import type { FranceTravailConfig } from "../config/franceTravailConfig";

// Une part de contrat sur un mois donné : heures hors-cachet (enseignement, CDDU horaires) et
// nombre de cachets. Les deux sont convertis en un total d'heures unique (cachets × config.
// heuresParCachet) avant application du coefficient Annexe 10 — même constantes que
// `indemnisationMensuelle.ts` (`coeffJoursNonIndemnisables`, `diviseurJoursTravaillesA10`), lues
// depuis la config plutôt qu'en dur, mais aucune dépendance de code vers ce fichier.
export interface ContratMois {
  heures: number;
  cachets: number;
}

/** floor((Σheures + Σcachets × heuresParCachet) × coeffJoursNonIndemnisables / diviseurJoursTravaillesA10). */
export function calculerJoursTravailes(contratsMois: ContratMois[], config: FranceTravailConfig): number {
  const totalHeures = contratsMois.reduce((total, c) => total + c.heures + c.cachets * config.heuresParCachet, 0);
  return Math.floor((totalHeures * config.indemnisationMensuelle.coeffJoursNonIndemnisables) / config.indemnisationMensuelle.diviseurJoursTravaillesA10);
}

// Palier bas/haut du forfait mensuel de franchise CP, décidé par la franchise TOTALE déclarée
// (pas par le restant courant) — même règle et même raisonnement que `forfaitMensuelCP` dans
// `indemnisationMensuelle.ts` (dupliquée ici volontairement, modules indépendants par conception).
function forfaitMensuelCP(franchiseCPTotale: number, config: FranceTravailConfig): number {
  const { forfaitMensuelBas, forfaitMensuelHaut, seuilFranchiseTotaleJours } = config.differesEtFranchises.franchiseCongesPayes;
  return franchiseCPTotale <= seuilFranchiseTotaleJours ? forfaitMensuelBas : forfaitMensuelHaut;
}

export interface MoisInput {
  joursDuMois: number;
  joursTravailes: number; // calculé en amont, cf. calculerJoursTravailes ci-dessus
}

export interface MoisOutput {
  joursIndemnisables: number;
  netSocial: number;
  netApresPAS: number;
  franchiseCPConsommee: number;
  delaiConsomme: number;
  // Restantes APRÈS ce mois — sert notamment à décider si le badge "Estimation" doit encore
  // s'afficher sur le mois SUIVANT (cf. RevenusMensuels.tsx : badge tant que l'un des deux était
  // encore > 0 à l'ENTRÉE du mois affiché).
  franchiseCPRestante: number;
  delaiRestant: number;
}

export interface ParamsCalculerSerie {
  mois: MoisInput[];
  ajNetteAvantPAS: number;
  tauxPAS: number;
  franchiseCPTotale: number;
  delaiAttente: number;
  config: FranceTravailConfig;
}

export function calculerSerie(params: ParamsCalculerSerie): MoisOutput[] {
  const { mois, ajNetteAvantPAS, tauxPAS, franchiseCPTotale, delaiAttente, config } = params;

  let franchiseCPRestante = franchiseCPTotale;
  let delaiRestant = delaiAttente;
  let carryOver = 0;

  const resultats: MoisOutput[] = [];

  for (const m of mois) {
    const franchiseCPMensuelleMax = forfaitMensuelCP(franchiseCPTotale, config);
    const plafondEffectif = franchiseCPMensuelleMax + carryOver;
    const resultat = appliquerFranchises({
      joursDuMois: m.joursDuMois,
      joursTravailes: m.joursTravailes,
      franchiseCPRestante,
      franchiseCPMensuelleMax: plafondEffectif,
      delaiAttente: delaiRestant,
    });

    const franchiseCPConsommee = franchiseCPRestante - resultat.franchiseCPRestante;
    const delaiConsomme = delaiRestant - resultat.delaiAttenteRestant;

    carryOver = plafondEffectif - franchiseCPConsommee;
    franchiseCPRestante = resultat.franchiseCPRestante;
    delaiRestant = resultat.delaiAttenteRestant;

    const { joursIndemnisables } = resultat;
    const netSocial = joursIndemnisables * ajNetteAvantPAS;

    resultats.push({
      joursIndemnisables,
      netSocial,
      netApresPAS: netSocial * (1 - tauxPAS),
      franchiseCPConsommee,
      delaiConsomme,
      franchiseCPRestante,
      delaiRestant,
    });
  }

  return resultats;
}

// TODO — incohérence connue, non corrigée (hors périmètre de ce chantier) : ce module consomme
// franchise CP PUIS délai d'attente (cf. franchises.ts), alors que le guide officiel France Travail
// (GUIDE-INTERMITTENT.pdf, p.12-17, cité dans indemnisationMensuelle.ts) confirme texto l'ordre
// inverse — délai d'attente PUIS franchise CP. Sans conséquence sur les cas de test certifiés
// actuels (délai déjà épuisé ou disponibilités suffisantes pour saturer les deux dans le même
// mois, l'ordre ne change alors pas le résultat), mais reste un écart réel entre les deux moteurs
// "indépendants" à corriger le jour où un cas réel le distingue.
