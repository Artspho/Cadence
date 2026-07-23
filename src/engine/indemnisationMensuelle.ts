// Calcule, mois par mois, le nombre de jours réellement indemnisés — pas seulement l'AJ
// théorique. Part d'un solde de départ à une date connue (relevé France Travail réel) : ne
// reconstruit JAMAIS l'historique depuis la réadmission (un mois de régularisation, transition de
// droits en cours de mois, n'a pas de décomposition standard reconstituable — cf. docs/reprise.md).
//
// Ordre de consommation, confirmé par le guide France Travail (p.12-17) et par les relevés réels
// certifiés (fév-mai 2026) : jours non indemnisables → délai d'attente → franchise congés payés →
// paiement du reliquat. Chaque poste ne mord que sur ce que le précédent a laissé.
//
// Franchise CP : plafonnée par un forfait mensuel (2j ou 3j selon le palier, cf.
// franceTravailConfig.ts) qui se reporte d'un mois sur l'autre s'il n'est pas intégralement
// consommé (SoldeIndemnisation.quotaCPCarryOver) — PAS "consommer tout ce qui est disponible"
// (lecture initiale erronée du 2026-07-23, corrigée : le 4j consommé en février 2026 s'explique
// entièrement par le report du forfait de janvier, absorbé par le délai d'attente ce mois-là, pas
// par l'absence de plafond).
import type { DeclarationMensuelle, FranchiseSalairesResultat, MoisIndemnisationEntree, MoisIndemnisationResultat, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { joursDansMois, moisCle } from "./dateUtils";

const FRANCHISE_SALAIRES_NON_CERTIFIEE: FranchiseSalairesResultat = {
  valeur: null,
  avertissement: "franchise_salaires_non_certifiee",
};

// Palier bas/haut du forfait mensuel de franchise CP. Basé sur `franchiseCPRestante` (seule
// grandeur suivie par ce module) faute de suivre le total ORIGINAL accordé à l'ouverture des
// droits — une hypothèse simplificatrice : si le total initial dépassait le seuil (palier haut,
// 3j/mois) puis redescendait en-dessous à force d'être consommé, ce calcul redescendrait à tort
// au palier bas en cours de route. Non observable sur les cas certifiés actuels (restante ≤ 5j
// du début à la fin) — à corriger si un profil avec une franchise totale > seuil se présente.
function forfaitMensuelCP(franchiseCPRestante: number, config: FranceTravailConfig): number {
  const { forfaitMensuelBas, forfaitMensuelHaut, seuilFranchiseTotaleJours } = config.differesEtFranchises.franchiseCongesPayes;
  return franchiseCPRestante <= seuilFranchiseTotaleJours ? forfaitMensuelBas : forfaitMensuelHaut;
}

export function calculerMoisIndemnisation(soldeDepart: SoldeIndemnisation, entree: MoisIndemnisationEntree, config: FranceTravailConfig): MoisIndemnisationResultat {
  const joursNonIndemnisables = Math.ceil(entree.joursDeclares * config.indemnisationMensuelle.coeffJoursNonIndemnisables);
  const reliquatApresTravail = Math.max(0, entree.joursDuMois - joursNonIndemnisables);

  const delaiConsomme = Math.min(soldeDepart.delaiRestant, reliquatApresTravail);
  const reliquatApresDelai = reliquatApresTravail - delaiConsomme;

  const forfaitMensuel = forfaitMensuelCP(soldeDepart.franchiseCPRestante, config);
  const quotaDisponible = soldeDepart.quotaCPCarryOver + forfaitMensuel;
  const franchiseCPConsommee = Math.min(quotaDisponible, soldeDepart.franchiseCPRestante, reliquatApresDelai);
  const joursIndemnises = reliquatApresDelai - franchiseCPConsommee;

  return {
    moisLabel: entree.moisLabel,
    joursNonIndemnisables,
    delaiConsomme,
    franchiseCPConsommee,
    joursIndemnises,
    soldeFin: {
      delaiRestant: soldeDepart.delaiRestant - delaiConsomme,
      franchiseCPRestante: soldeDepart.franchiseCPRestante - franchiseCPConsommee,
      quotaCPCarryOver: quotaDisponible - franchiseCPConsommee,
    },
    franchiseSalaires: FRANCHISE_SALAIRES_NON_CERTIFIEE,
  };
}

// Enchaîne les mois : le soldeFin de chacun nourrit le soldeDepart du suivant.
export function calculerSerieIndemnisation(soldeDepart: SoldeIndemnisation, mois: MoisIndemnisationEntree[], config: FranceTravailConfig): MoisIndemnisationResultat[] {
  const resultats: MoisIndemnisationResultat[] = [];
  let solde = soldeDepart;
  for (const entree of mois) {
    const resultat = calculerMoisIndemnisation(solde, entree, config);
    resultats.push(resultat);
    solde = resultat.soldeFin;
  }
  return resultats;
}

/**
 * Traduit les déclarations mensuelles saisies par l'utilisateur en série calculable, à partir du
 * mois du solde de départ (inclus). Ignore silencieusement toute déclaration antérieure à ce
 * mois : ce ne sont pas des données à recalculer, seulement du contexte que l'utilisateur peut
 * avoir laissé dans l'historique (cf. docs/reprise.md — janvier "régularisé", non reconstituable).
 * Trie par mois croissant : l'ordre de saisie n'a pas à être l'ordre chronologique.
 */
export function calculerSerieDepuisDeclarations(soldeDepart: SoldeIndemnisationDepart, declarations: DeclarationMensuelle[], config: FranceTravailConfig): MoisIndemnisationResultat[] {
  const moisDepart = moisCle(soldeDepart.date);
  const mois: MoisIndemnisationEntree[] = declarations
    .filter((d) => d.mois >= moisDepart)
    .sort((a, b) => a.mois.localeCompare(b.mois))
    .map((d) => ({ moisLabel: d.mois, joursDuMois: joursDansMois(d.mois), joursDeclares: d.joursDeclares }));

  return calculerSerieIndemnisation({ delaiRestant: soldeDepart.delaiRestant, franchiseCPRestante: soldeDepart.franchiseCPRestante, quotaCPCarryOver: soldeDepart.quotaCPCarryOver ?? 0 }, mois, config);
}
