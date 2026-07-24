// Itère `appliquerFranchises` (franchises.ts) mois par mois, en portant l'état (franchise CP
// restante, délai d'attente restant, report du forfait mensuel non consommé) d'un mois sur
// l'autre. Module indépendant : n'importe que `franchises.ts`, jamais `indemnisationMensuelle.ts`.
import { appliquerFranchises } from "./franchises";

export interface MoisInput {
  joursDuMois: number;
  joursTravailes: number; // calculé en amont (heures/10 + cachets)
  estGrise: boolean; // true = mois de réadmission, rien n'est calculé ce mois-ci
}

export interface MoisOutput {
  joursIndemnisables: number;
  ajBrute: number;
  netSocial: number;
  netApresPAS: number;
  franchiseCPConsommee: number;
  delaiConsomme: number;
  estGrise: boolean;
}

export interface ParamsCalculerSerie {
  mois: MoisInput[];
  ajBrute: number;
  ajNetteAvantPAS: number;
  tauxPAS: number;
  franchiseCPTotale: number;
  franchiseCPMensuelleMax: number;
  delaiAttente: number;
}

export function calculerSerie(params: ParamsCalculerSerie): MoisOutput[] {
  const { mois, ajBrute, ajNetteAvantPAS, tauxPAS, franchiseCPTotale, franchiseCPMensuelleMax, delaiAttente } = params;

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
        ajBrute: 0,
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
      ajBrute: joursIndemnisables * ajBrute,
      netSocial,
      netApresPAS: netSocial * (1 - tauxPAS),
      franchiseCPConsommee,
      delaiConsomme,
      estGrise: false,
    });
  }

  return resultats;
}
