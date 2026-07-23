// Calcule, mois par mois, le nombre de jours réellement indemnisés — pas seulement l'AJ
// théorique. Part d'un solde de départ à une date connue (relevé France Travail réel) : ne
// reconstruit JAMAIS l'historique depuis la réadmission (un mois de régularisation, transition de
// droits en cours de mois, n'a pas de décomposition standard reconstituable — cf. docs/reprise.md).
//
// Ordre de consommation, confirmé par le guide France Travail (p.12-17) et par les relevés réels
// certifiés (fév-mai 2026) : jours non indemnisables → délai d'attente → franchise congés payés →
// paiement du reliquat. Chaque poste ne mord que sur ce que le précédent a laissé, jamais de
// plafond mensuel forfaitaire sur la franchise CP (cf. franceTravailConfig.ts, forfaitMensuelBas/
// Haut commentés — contredits par ces mêmes relevés).
import type { DeclarationMensuelle, FranchiseSalairesResultat, MoisIndemnisationEntree, MoisIndemnisationResultat, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { joursDansMois, moisCle } from "./dateUtils";

const FRANCHISE_SALAIRES_NON_CERTIFIEE: FranchiseSalairesResultat = {
  valeur: null,
  avertissement: "franchise_salaires_non_certifiee",
};

export function calculerMoisIndemnisation(soldeDepart: SoldeIndemnisation, entree: MoisIndemnisationEntree, config: FranceTravailConfig): MoisIndemnisationResultat {
  const joursNonIndemnisables = Math.ceil(entree.joursDeclares * config.indemnisationMensuelle.coeffJoursNonIndemnisables);
  const reliquatApresTravail = Math.max(0, entree.joursDuMois - joursNonIndemnisables);

  const delaiConsomme = Math.min(soldeDepart.delaiRestant, reliquatApresTravail);
  const reliquatApresDelai = reliquatApresTravail - delaiConsomme;

  const franchiseCPConsommee = Math.min(soldeDepart.franchiseCPRestante, reliquatApresDelai);
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

  return calculerSerieIndemnisation({ delaiRestant: soldeDepart.delaiRestant, franchiseCPRestante: soldeDepart.franchiseCPRestante }, mois, config);
}
