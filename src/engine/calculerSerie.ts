// Itère `appliquerFranchises` (franchises.ts) mois par mois, en portant l'état (franchise CP
// restante, délai d'attente restant, report du forfait mensuel non consommé) d'un mois sur
// l'autre. Module indépendant : n'importe que `franchises.ts`, jamais `indemnisationMensuelle.ts`.
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

export interface MoisInput {
  joursDuMois: number;
  joursTravailes: number; // calculé en amont, cf. calculerJoursTravailes ci-dessus
  estGrise: boolean; // true = mois de réadmission, rien n'est calculé ce mois-ci
}

export interface MoisOutput {
  joursIndemnisables: number;
  netSocial: number;
  netApresPAS: number;
  franchiseCPConsommee: number;
  delaiConsomme: number;
  estGrise: boolean;
}

export interface ParamsCalculerSerie {
  mois: MoisInput[];
  ajNetteAvantPAS: number;
  tauxPAS: number;
  franchiseCPTotale: number;
  franchiseCPMensuelleMax: number;
  delaiAttente: number;
}

export function calculerSerie(params: ParamsCalculerSerie): MoisOutput[] {
  const { mois, ajNetteAvantPAS, tauxPAS, franchiseCPTotale, franchiseCPMensuelleMax, delaiAttente } = params;

  let franchiseCPRestante = franchiseCPTotale;
  let delaiRestant = delaiAttente;
  let carryOver = 0;

  const resultats: MoisOutput[] = [];

  for (const m of mois) {
    if (m.estGrise) {
      // Mois de réadmission : rien n'est consommé, le forfait mensuel non utilisé se reporte
      // intégralement sur le mois suivant (cf. franceTravailConfig, correctif quotaCPCarryOver).
      carryOver += franchiseCPMensuelleMax;
      resultats.push({
        joursIndemnisables: 0,
        netSocial: 0,
        netApresPAS: 0,
        franchiseCPConsommee: 0,
        delaiConsomme: 0,
        estGrise: true,
      });
      continue;
    }

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
      estGrise: false,
    });
  }

  return resultats;
}
