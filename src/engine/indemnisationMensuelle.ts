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
import type { DeclarationMensuelle, FranchiseSalairesResultat, MoisIndemnisationEntree, MoisIndemnisationResultat, Profil, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
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

// Cherche la valeur historique la plus récente dont la date d'effet est ≤ la date cible — null si
// la date cible est antérieure à toute revalorisation connue (jamais une valeur extrapolée).
function valeurALaDate(dateISO: string, historique: { dateEffet: string; valeur: number }[]): number | null {
  const applicables = historique.filter((h) => h.dateEffet <= dateISO).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  return applicables.length > 0 ? applicables[0].valeur : null;
}

/**
 * Franchise salaires (guide France Travail p.14, formule certifiée le 2026-07-23 — ARTCENA +
 * flyer officiel) : `arrondi( (SR_total / SMIC_mensuel) × (SJM / (3 × SMIC_journalier)) − 27 )`,
 * jamais négative. SMIC lu à la date de fin de PRA (`Profil.dateAnniversaire`), pas la valeur
 * courante — une PRA close avant la dernière revalorisation doit lire l'ancienne valeur.
 *
 * TODO : SR_total devrait inclure tous salaires PRA non plafonnés y compris hors A10 — champ
 * `Profil.salairesHorsAnnexe10PRA` prévu mais optionnel en bêta. Vérifier sur un relevé réel avec
 * franchise salaires > 0 avant de retirer l'avertissement `sousEstimeeHorsA10`.
 *
 * PAS ENCORE câblée sur la consommation mensuelle (répartition sur `min(dureeDroitsMois,
 * repartitionMoisMax)` mois + report, cf. franchise CP) : cette fonction calcule seulement le
 * TOTAL, `calculerMoisIndemnisation` continue de renvoyer `franchise_salaires_non_certifiee`
 * jusqu'à ce que la répartition soit conçue et câblée (cf. docs/reprise.md).
 */
export function calculerFranchiseSalaires(srContrats: number, sjm: number, profil: Profil, config: FranceTravailConfig): FranchiseSalairesResultat {
  const dateFinPRA = profil.dateAnniversaire;
  if (!dateFinPRA) {
    return FRANCHISE_SALAIRES_NON_CERTIFIEE;
  }

  const smicMensuel = valeurALaDate(dateFinPRA, config.valeursDatees.smicMensuelBrutHistorique);
  const smicJournalier = valeurALaDate(dateFinPRA, config.valeursDatees.smicJournalierBrutHistorique);
  if (smicMensuel === null || smicJournalier === null) {
    return FRANCHISE_SALAIRES_NON_CERTIFIEE;
  }

  const srTotal = srContrats + (profil.salairesHorsAnnexe10PRA ?? 0);
  const brut = Math.round((srTotal / smicMensuel) * (sjm / (3 * smicJournalier)) - 27);

  return { valeur: Math.max(0, brut), totalNonVerifie: true, sousEstimeeHorsA10: profil.salairesHorsAnnexe10PRA == null };
}
