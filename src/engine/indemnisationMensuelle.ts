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
import type { Contrat, FranchiseSalairesResultat, MoisIndemnisationEntree, MoisIndemnisationResultat, MontantMensuelResultat, Profil, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { joursDansMois, moisCle, moisSuivant } from "./dateUtils";
import { getAjReelleAt } from "./ajReelleUtils";
import { repartirContratParMois } from "./decoupageMensuel";

const FRANCHISE_SALAIRES_NON_CERTIFIEE: FranchiseSalairesResultat = {
  valeur: null,
  avertissement: "franchise_salaires_non_certifiee",
};

// Placeholder : `calculerMoisIndemnisation`/`calculerSerieIndemnisation` n'ont pas connaissance de
// l'historique d'AJ réelle (leur `moisLabel` est purement informatif, jamais une vraie date, cf.
// `MoisIndemnisationEntree`) — seul `calculerSerieDepuisDeclarations`, qui manipule de vrais mois
// "YYYY-MM", recalcule ce champ correctement (même mécanique que `franchiseSalaires` ci-dessus).
const MONTANT_MENSUEL_INDISPONIBLE: MontantMensuelResultat = { calculable: false, raison: "aj_manquante" };

// Montant réellement versé pour un mois donné = joursIndemnises × AJ réelle applicable ce mois-là.
// `debutDuMoisISO` doit être une vraie date ISO (ex. "2026-03-01") — jamais un `moisLabel` non
// vérifié, cf. avertissement ci-dessus.
function calculerMontantMensuel(joursIndemnises: number, debutDuMoisISO: string, ajReelleHistorique: { dateEffet: string; valeur: number }[] | undefined): MontantMensuelResultat {
  const ajUtilisee = getAjReelleAt(ajReelleHistorique, debutDuMoisISO);
  if (ajUtilisee === null) {
    return { calculable: false, raison: "aj_manquante" };
  }
  return { calculable: true, montant: Math.round(joursIndemnises * ajUtilisee * 100) / 100, ajUtilisee };
}

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
  // floor, PAS ceil — validé mot pour mot sur 3 mois réels indépendants (fév/avril/mai 2026,
  // cf. docs/reprise.md) : floor(153×1,3/10)=19, floor(93×1,3/10)=12, floor(21×1,3/10)=2,
  // exactement les jours non indemnisés des relevés France Travail réels.
  const joursNonIndemnisables = Math.floor((entree.heuresDuMois * config.indemnisationMensuelle.coeffJoursNonIndemnisables) / config.indemnisationMensuelle.diviseurJoursTravaillesA10);
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
    montantMensuel: MONTANT_MENSUEL_INDISPONIBLE,
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
 * Calcule la série mensuelle directement depuis les VRAIS contrats, à partir du mois du solde de
 * départ (inclus) jusqu'au dernier mois couvert par un contrat ou aujourd'hui (le plus tardif des
 * deux) — remplace la saisie manuelle de "jours déclarés" (cf. docs/reprise.md, 2026-07-24) :
 * heuresDuMois est agrégée mois par mois via repartirContratParMois (engine/decoupageMensuel.ts),
 * qui répartit chaque contrat sur les mois civils qu'il chevauche au prorata des jours.
 * Un mois sans aucun contrat obtient 0 h (jours non indemnisables = 0, mois entièrement indemnisé
 * une fois délai/franchise épuisés) — comportement honnête, pas une absence silencieuse.
 */
export function calculerSerieDepuisContrats(soldeDepart: SoldeIndemnisationDepart, contrats: Contrat[], dateDuJour: string, config: FranceTravailConfig): MoisIndemnisationResultat[] {
  const moisDepart = moisCle(soldeDepart.date);

  const heuresParMois = new Map<string, number>();
  for (const contrat of contrats) {
    for (const part of repartirContratParMois(contrat, config)) {
      heuresParMois.set(part.moisCle, (heuresParMois.get(part.moisCle) ?? 0) + part.heures);
    }
  }

  const moisTries = [...heuresParMois.keys(), moisCle(dateDuJour)].sort();
  const moisFin = moisTries[moisTries.length - 1];

  const mois: MoisIndemnisationEntree[] = [];
  for (let curseur = moisDepart; curseur <= moisFin; curseur = moisSuivant(curseur)) {
    mois.push({ moisLabel: curseur, joursDuMois: joursDansMois(curseur), heuresDuMois: heuresParMois.get(curseur) ?? 0 });
  }

  const resultats = calculerSerieIndemnisation({ delaiRestant: soldeDepart.delaiRestant, franchiseCPRestante: soldeDepart.franchiseCPRestante, quotaCPCarryOver: soldeDepart.quotaCPCarryOver ?? 0 }, mois, config);

  // moisLabel provient ici d'un vrai "YYYY-MM" énuméré ci-dessus, contrairement au moisLabel
  // purement informatif de calculerMoisIndemnisation/calculerSerieIndemnisation — recalcul du
  // montant mensuel sûr uniquement à ce niveau.
  return resultats.map((resultat) => ({
    ...resultat,
    montantMensuel: calculerMontantMensuel(resultat.joursIndemnises, `${resultat.moisLabel}-01`, soldeDepart.ajReelleHistorique),
  }));
}

// Cherche la valeur historique la plus récente dont la date d'effet est ≤ la date cible — null si
// la date cible est antérieure à toute revalorisation connue (jamais une valeur extrapolée).
function valeurALaDate(dateISO: string, historique: { dateEffet: string; valeur: number }[]): number | null {
  const applicables = historique.filter((h) => h.dateEffet <= dateISO).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  return applicables.length > 0 ? applicables[0].valeur : null;
}

/**
 * Franchise salaires : `arrondi( (SR_total / SMIC_mensuel) × (SJM / (3 × SMIC_journalier)) −
 * seuilNonIndemnisationJours )`, jamais négative. Formule confirmée mot pour mot depuis le texte
 * du guide officiel France Travail (`GUIDE-INTERMITTENT.pdf`, page 14, lu en entier le
 * 2026-07-24) — plus une extraction d'image incertaine. SMIC lu à la date de fin de PRA
 * (`Profil.dateAnniversaire`), pas la valeur courante — confirmé texto page 14 (« valeurs à la
 * date de fin de la période de référence »), une PRA close avant la dernière revalorisation doit
 * lire l'ancienne valeur.
 *
 * TODO : SR_total devrait inclure tous salaires PRA non plafonnés y compris hors A10 (confirmé
 * texto page 14 : « quel que soit le régime de l'activité ») — champ
 * `Profil.salairesHorsAnnexe10PRA` prévu mais optionnel en bêta. Seule réserve restante :
 * vérifier sur un relevé réel avec franchise salaires > 0 avant de retirer l'avertissement
 * `sousEstimeeHorsA10` (aucun relevé fourni à ce jour ne montre cette franchise active).
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
  const brut = Math.round((srTotal / smicMensuel) * (sjm / (3 * smicJournalier)) - config.indemnisationMensuelle.seuilNonIndemnisationJours);

  return { valeur: Math.max(0, brut), totalNonVerifie: true, sousEstimeeHorsA10: profil.salairesHorsAnnexe10PRA == null };
}
