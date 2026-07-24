// Applique la franchise congés payés puis le délai d'attente sur les jours indemnisables
// d'un mois donné — ordre confirmé par le relevé France Travail du 14/04/2026 ("franchise CP 4 /
// différé 5 / travail 19"), franchise CP en premier, délai d'attente ensuite, dans le même mois.
//
// Ce module est volontairement indépendant de `indemnisationMensuelle.ts` (aucun import dans un
// sens ni dans l'autre) : il ne connaît pas la notion de report d'un mois sur l'autre
// (`quotaCPCarryOver`) — c'est à l'appelant de calculer le plafond mensuel EFFECTIF
// (`franchiseCPMensuelleMax`, forfait + report éventuel du mois précédent) avant d'appeler cette
// fonction. Un mois où tout est travail (rien à consommer) laisse le report inchangé côté
// appelant, cf. le cas « mois grisé » dans les tests.
export interface ParamsAppliquerFranchises {
  joursDuMois: number;
  joursTravailes: number;
  franchiseCPRestante: number;
  franchiseCPMensuelleMax: number;
  delaiAttente: number;
}

export interface ResultatAppliquerFranchises {
  joursIndemnisables: number;
  franchiseCPRestante: number;
  delaiAttenteRestant: number;
}

export function appliquerFranchises(params: ParamsAppliquerFranchises): ResultatAppliquerFranchises {
  const { joursDuMois, joursTravailes, franchiseCPRestante, franchiseCPMensuelleMax, delaiAttente } = params;

  let joursDisponibles = joursDuMois - joursTravailes;

  const cpCeMois = Math.min(franchiseCPRestante, franchiseCPMensuelleMax, joursDisponibles);
  joursDisponibles -= cpCeMois;

  const delaiCeMois = Math.min(delaiAttente, joursDisponibles);
  joursDisponibles -= delaiCeMois;

  return {
    joursIndemnisables: joursDisponibles,
    franchiseCPRestante: franchiseCPRestante - cpCeMois,
    delaiAttenteRestant: delaiAttente - delaiCeMois,
  };
}
