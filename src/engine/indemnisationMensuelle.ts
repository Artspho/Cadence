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
import type { Contrat, FranchiseSalairesResultat, LigneSerieIndemnisation, MoisIndemnisationEntree, MoisIndemnisationResultat, MontantMensuelResultat, Profil, SerieIndemnisationResultat, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { bornesDuMois, joursDansMois, moisCle, moisSuivant } from "./dateUtils";
import { getAjReelleAt } from "./ajReelleUtils";
import { repartirContratParMois } from "./decoupageMensuel";

const FRANCHISE_SALAIRES_NON_CERTIFIEE: FranchiseSalairesResultat = {
  valeur: null,
  avertissement: "franchise_salaires_non_certifiee",
};

// Placeholder : `calculerMoisIndemnisation`/`calculerSerieIndemnisation` n'ont pas connaissance de
// l'historique d'AJ réelle (leur `moisLabel` est purement informatif, jamais une vraie date, cf.
// `MoisIndemnisationEntree`) — seul `calculerSerieDepuisContrats`, qui manipule de vrais mois
// "YYYY-MM", recalcule ce champ correctement (même mécanique que `franchiseSalaires` ci-dessus).
const MONTANT_MENSUEL_INDISPONIBLE: MontantMensuelResultat = { calculable: false, raison: "aj_manquante" };

// Montant réellement versé pour un mois donné = joursIndemnises × AJ réelle applicable ce mois-là.
// `debutDuMoisISO` doit être une vraie date ISO (ex. "2026-03-01") — jamais un `moisLabel` non
// vérifié, cf. avertissement ci-dessus.
function calculerMontantMensuel(joursIndemnises: number, debutDuMoisISO: string, ajReelleHistorique: { dateEffet: string; valeur: number }[] | undefined, tauxPrelevementSource?: number): MontantMensuelResultat {
  const ajUtilisee = getAjReelleAt(ajReelleHistorique, debutDuMoisISO);
  if (ajUtilisee === null) {
    return { calculable: false, raison: "aj_manquante" };
  }
  const montant = Math.round(joursIndemnises * ajUtilisee * 100) / 100;
  const montantNet = tauxPrelevementSource != null ? Math.round(montant * (1 - tauxPrelevementSource / 100) * 100) / 100 : undefined;
  return { calculable: true, montant, ajUtilisee, montantNet };
}

// Mois de transition — décisions actées, pas encore câblées (TODO d'implémentation, pas de
// question ouverte) :
//
// Q1 — Mois chevauchant deux droits (réadmission) : DÉCISION — ne pas calculer ce mois. Le moteur
// démarre à `ouvertureDroits.dateOuverture` du nouveau droit ; si le premier mois du tableau
// contient cette date et qu'il reste des jours avant elle dans le même mois calendaire, ce mois
// doit être affiché comme "mois de réadmission" non calculé (cf. Q3), jamais calculé comme si le
// mois entier relevait du nouveau droit. Fondement : relevés réels de Benoît, janvier 2026 —
// France Travail fait deux passes séparées (ancien droit 54,55 €/j jusqu'au 17/01, nouveau droit
// 55,02 €/j à partir du 18/01, chacun avec son propre décompte), jamais une moyenne. Cadence n'a
// structurellement pas accès à l'ancien droit (ni ses paramètres ni son historique de contrats),
// donc ce mois ne peut être reconstitué sans deviner (devoir n°2).
//
// Q2 — Taux PAS multi-années : DÉCISION — `tauxPrelevementSource` reste un scalaire unique sur
// `Profil.ouvertureDroits` (pas de tableau `{ annee, taux }[]` pour l'instant, reporté en V2 si
// besoin réel se confirme). À la place : une alerte "attention" déclenchée automatiquement chaque
// année en janvier (premier mois calculé de l'année civile), si `tauxPrelevementSource` est
// renseigné : "Ton taux de prélèvement à la source a peut-être été mis à jour au 1ᵉʳ janvier par
// la DGFIP. Vérifie sur impots.gouv.fr ou ton dernier relevé France Travail et corrige-le dans le
// profil si besoin." Pas encore câblée dans `alertes.ts`.
//
// Q3 — Affichage du mois de transition (RevenusMensuels.tsx) : DÉCISION — une ligne grisée non
// calculée, avec un tooltip : "Mois de réadmission — le calcul est partagé entre deux droits.
// Consulte ton relevé France Travail pour le montant exact." Aucun montant affiché sur cette
// ligne, aucun cumul dans les totaux. La ligne reste présente (pas retirée du tableau) pour que la
// chronologie mois par mois reste continue, sans trou silencieux.
//
// Q1 et Q3 sont désormais câblés (cf. `calculerSerieDepuisContrats` plus bas et
// `LigneSerieIndemnisation` dans types/index.ts). Q2 (alerte taux PAS multi-années) reste à
// faire — pas encore câblée dans `alertes.ts`.

// Palier bas/haut du forfait mensuel de franchise CP, décidé par la franchise TOTALE accordée à
// l'ouverture des droits (Profil.ouvertureDroits.franchiseCPTotale) — pas par le restant courant.
// Corrige une limite connue (cf. docs/reprise.md, 2026-07-23) : baser la décision sur le restant
// ferait redescendre à tort au palier bas un profil dont le total dépassait le seuil, une fois
// consommé sous ce seuil.
function forfaitMensuelCP(franchiseCPTotale: number, config: FranceTravailConfig): number {
  const { forfaitMensuelBas, forfaitMensuelHaut, seuilFranchiseTotaleJours } = config.differesEtFranchises.franchiseCongesPayes;
  return franchiseCPTotale <= seuilFranchiseTotaleJours ? forfaitMensuelBas : forfaitMensuelHaut;
}

// Quota mensuel de franchise salaires : total réparti sur min(dureeDroitsMois, repartitionMoisMax)
// mois, arrondi au jour supérieur (jamais un reliquat de jour perdu par arrondi vers le bas).
// `valeur: null` (franchise non certifiée, cf. calculerFranchiseSalaires) -> quota 0, aucune
// application plutôt qu'un chiffre deviné (devoir n°2). Recalculé fraîchement à chaque mois à
// partir de la franchise TOTALE (jamais du restant courant) — même principe que forfaitMensuelCP.
function quotaMensuelSalaires(franchiseSalaires: FranchiseSalairesResultat, dureeDroitsMois: 12 | 6, config: FranceTravailConfig): number {
  if (franchiseSalaires.valeur === null) return 0;
  const nbMoisRepartition = Math.min(dureeDroitsMois, config.differesEtFranchises.franchiseSalaires.repartitionMoisMax);
  return Math.ceil(franchiseSalaires.valeur / nbMoisRepartition);
}

// `franchiseCPTotale` : optionnel, défaut = `soldeDepart.franchiseCPRestante` — préserve à
// l'identique le comportement historique (limite connue incluse) pour tout appelant qui ne la
// fournit pas explicitement, notamment les tests bas niveau existants. Seul
// `calculerSerieDepuisContrats` fournit la vraie valeur (Profil.ouvertureDroits.franchiseCPTotale),
// constante sur toute la série, corrigeant la limite pour le nouveau chemin automatique.
// `franchiseSalaires`/`dureeDroitsMois` : mêmes défauts (non certifiée / 12 mois) pour ne rien
// changer au comportement des appelants qui ne les fournissent pas — seul
// `calculerSerieDepuisContrats` peut fournir un résultat réel, et seulement si le SR/SJM
// nécessaires à `calculerFranchiseSalaires` lui sont explicitement passés (cf. plus bas).
export function calculerMoisIndemnisation(
  soldeDepart: SoldeIndemnisation,
  entree: MoisIndemnisationEntree,
  config: FranceTravailConfig,
  franchiseCPTotale: number = soldeDepart.franchiseCPRestante,
  franchiseSalaires: FranchiseSalairesResultat = FRANCHISE_SALAIRES_NON_CERTIFIEE,
  dureeDroitsMois: 12 | 6 = 12,
): MoisIndemnisationResultat {
  // floor confirmé par relevés réels A10 (fév/mars/avril/mai 2026, cf. docs/reprise.md) — PAS
  // ceil, contrairement à un premier essai de formule qui s'en écartait dès le premier mois testé.
  // floor(153×1,3/10)=19, floor(105×1,3/10)=13, floor(93×1,3/10)=12, floor(21×1,3/10)=2 :
  // exactement les jours non indemnisés des 4 relevés France Travail réels, aucun écart.
  const joursNonIndemnisables = Math.floor((entree.heuresDuMois * config.indemnisationMensuelle.coeffJoursNonIndemnisables) / config.indemnisationMensuelle.diviseurJoursTravaillesA10);
  const reliquatApresTravail = Math.max(0, entree.joursDuMois - joursNonIndemnisables);

  const delaiConsomme = Math.min(soldeDepart.delaiRestant, reliquatApresTravail);
  const reliquatApresDelai = reliquatApresTravail - delaiConsomme;

  const forfaitMensuel = forfaitMensuelCP(franchiseCPTotale, config);
  const quotaDisponible = soldeDepart.quotaCPCarryOver + forfaitMensuel;
  const franchiseCPConsommee = Math.min(quotaDisponible, soldeDepart.franchiseCPRestante, reliquatApresDelai);
  const reliquatApresFranchiseCP = reliquatApresDelai - franchiseCPConsommee;

  // Franchise salaires : APRÈS le délai d'attente ET la franchise CP (ordre confirmé par le guide
  // officiel, point 3 de la liste page 17) — même mécanisme de carry-over que la franchise CP
  // ci-dessus (report du non-consommé, plafonné par le restant réel ET par les jours du mois
  // encore disponibles, jamais de jours indemnisés négatifs).
  const quotaMensuel = quotaMensuelSalaires(franchiseSalaires, dureeDroitsMois, config);
  const quotaSalairesDisponible = soldeDepart.quotaSalairesCarryOver + quotaMensuel;
  const franchiseSalairesConsommee = Math.min(quotaSalairesDisponible, soldeDepart.franchiseSalairesRestante, reliquatApresFranchiseCP);
  const joursIndemnises = reliquatApresFranchiseCP - franchiseSalairesConsommee;

  return {
    calculable: true,
    moisLabel: entree.moisLabel,
    heuresDuMois: entree.heuresDuMois,
    joursNonIndemnisables,
    delaiConsomme,
    franchiseCPConsommee,
    joursIndemnises,
    soldeFin: {
      delaiRestant: soldeDepart.delaiRestant - delaiConsomme,
      franchiseCPRestante: soldeDepart.franchiseCPRestante - franchiseCPConsommee,
      quotaCPCarryOver: quotaDisponible - franchiseCPConsommee,
      franchiseSalairesRestante: soldeDepart.franchiseSalairesRestante - franchiseSalairesConsommee,
      quotaSalairesCarryOver: quotaSalairesDisponible - franchiseSalairesConsommee,
    },
    franchiseSalaires,
    montantMensuel: MONTANT_MENSUEL_INDISPONIBLE,
  };
}

// Enchaîne les mois : le soldeFin de chacun nourrit le soldeDepart du suivant. `franchiseCPTotale`
// (optionnel, même défaut que calculerMoisIndemnisation par mois) reste CONSTANTE sur toute la
// série quand fournie — c'est la même ouverture de droits du début à la fin. Idem
// `franchiseSalaires`/`dureeDroitsMois`.
export function calculerSerieIndemnisation(
  soldeDepart: SoldeIndemnisation,
  mois: MoisIndemnisationEntree[],
  config: FranceTravailConfig,
  franchiseCPTotale?: number,
  franchiseSalaires: FranchiseSalairesResultat = FRANCHISE_SALAIRES_NON_CERTIFIEE,
  dureeDroitsMois: 12 | 6 = 12,
): MoisIndemnisationResultat[] {
  const resultats: MoisIndemnisationResultat[] = [];
  let solde = soldeDepart;
  for (const entree of mois) {
    const resultat = calculerMoisIndemnisation(solde, entree, config, franchiseCPTotale ?? solde.franchiseCPRestante, franchiseSalaires, dureeDroitsMois);
    resultats.push(resultat);
    solde = resultat.soldeFin;
  }
  return resultats;
}

/**
 * Calcule la série mensuelle directement depuis les VRAIS contrats. La simulation de l'état
 * interne (délai d'attente, franchise CP) tourne depuis `Profil.ouvertureDroits.dateOuverture` —
 * la VRAIE date d'origine, jamais une date de relevé de mi-parcours saisie à la main (cf.
 * docs/reprise.md, 2026-07-25) — jusqu'au dernier mois couvert par un contrat ou aujourd'hui (le
 * plus tardif des deux). `soldeDepart.dateDepart` ne sert qu'à choisir à partir de quel mois le
 * résultat est RETOURNÉ (affiché) : les mois antérieurs entre l'ouverture et `dateDepart` sont
 * simulés (avec 0 h si aucun contrat ne les couvre) mais jamais renvoyés — seul un état de départ
 * correct pour `dateDepart` en dépend.
 *
 * heuresDuMois est agrégée mois par mois via repartirContratParMois (engine/decoupageMensuel.ts),
 * qui répartit chaque contrat sur les mois civils qu'il chevauche au prorata des jours. Un mois
 * sans aucun contrat obtient 0 h (jours non indemnisables = 0) — comportement honnête, pas une
 * absence silencieuse.
 *
 * `calculable: false` si `Profil.ouvertureDroits` est absent : aucun point de départ n'est
 * inventé (devoir n°2).
 *
 * `srSjmPourFranchiseSalaires` optionnel : `calculerFranchiseSalaires` a besoin du SR (salaire de
 * référence) et du SJM, deux grandeurs du compteur "montant ARE" (`salaireReference.ts`), pas de
 * celui-ci ("jours indemnisés") — cf. règle d'or "deux compteurs, jamais mélangés". Tant qu'aucun
 * appelant ne les fournit explicitement, la franchise salaires reste `franchise_salaires_non_certifiee`
 * (comportement historique inchangé) plutôt que de deviner un total à partir de 0 (devoir n°2).
 */
export function calculerSerieDepuisContrats(
  profil: Profil,
  soldeDepart: SoldeIndemnisationDepart,
  contrats: Contrat[],
  dateDuJour: string,
  config: FranceTravailConfig,
  srSjmPourFranchiseSalaires?: { srContrats: number; sjm: number },
): SerieIndemnisationResultat {
  const { ouvertureDroits } = profil;
  if (!ouvertureDroits) {
    return { calculable: false, raison: "ouverture_droits_manquante" };
  }

  const moisOuverture = moisCle(ouvertureDroits.dateOuverture);
  const moisAffichageDebut = moisCle(soldeDepart.dateDepart);

  // Mois de réadmission (Q1, cf. commentaire "Mois de transition" plus haut) : dateOuverture ne
  // tombe pas le 1er du mois calendaire -> ce mois est partagé avec l'ancien droit, jamais
  // simulé. La simulation réelle démarre au mois suivant.
  const estMoisReadmission = ouvertureDroits.dateOuverture !== bornesDuMois(moisOuverture).debut;
  const moisDebutCalcul = estMoisReadmission ? moisSuivant(moisOuverture) : moisOuverture;

  const heuresParMois = new Map<string, number>();
  for (const contrat of contrats) {
    for (const part of repartirContratParMois(contrat, config)) {
      heuresParMois.set(part.moisCle, (heuresParMois.get(part.moisCle) ?? 0) + part.heures);
    }
  }

  const moisTries = [...heuresParMois.keys(), moisCle(dateDuJour), moisAffichageDebut, moisDebutCalcul].sort();
  const moisFin = moisTries[moisTries.length - 1];

  const mois: MoisIndemnisationEntree[] = [];
  for (let curseur = moisDebutCalcul; curseur <= moisFin; curseur = moisSuivant(curseur)) {
    mois.push({ moisLabel: curseur, joursDuMois: joursDansMois(curseur), heuresDuMois: heuresParMois.get(curseur) ?? 0 });
  }

  // Franchise salaires : calculée une seule fois, au démarrage de la série (c'est un TOTAL fixé à
  // l'ouverture des droits, pas une valeur qui varie mois par mois). `valeur: null` -> restante à 0,
  // aucune application (devoir n°2) — cf. quotaMensuelSalaires, qui donne alors un quota de 0.
  const franchiseSalaires: FranchiseSalairesResultat = srSjmPourFranchiseSalaires
    ? calculerFranchiseSalaires(srSjmPourFranchiseSalaires.srContrats, srSjmPourFranchiseSalaires.sjm, profil, config)
    : FRANCHISE_SALAIRES_NON_CERTIFIEE;
  const dureeDroitsMois = profil.dureeDroitsMois ?? 12;

  const soldeInitial: SoldeIndemnisation = {
    delaiRestant: ouvertureDroits.delaiAttenteInitial,
    franchiseCPRestante: ouvertureDroits.franchiseCPTotale,
    quotaCPCarryOver: 0,
    franchiseSalairesRestante: franchiseSalaires.valeur ?? 0,
    quotaSalairesCarryOver: 0,
  };

  const resultatsComplets = calculerSerieIndemnisation(soldeInitial, mois, config, ouvertureDroits.franchiseCPTotale, franchiseSalaires, dureeDroitsMois);

  // moisLabel provient ici d'un vrai "YYYY-MM" énuméré ci-dessus, contrairement au moisLabel
  // purement informatif de calculerMoisIndemnisation/calculerSerieIndemnisation — recalcul du
  // montant mensuel sûr uniquement à ce niveau.
  const resultatsAffiches: LigneSerieIndemnisation[] = resultatsComplets
    .filter((resultat) => resultat.moisLabel >= moisAffichageDebut)
    .map((resultat) => ({
      ...resultat,
      montantMensuel: calculerMontantMensuel(resultat.joursIndemnises, `${resultat.moisLabel}-01`, profil.ajReelleHistorique, ouvertureDroits.tauxPrelevementSource),
    }));

  // Ligne "mois de réadmission" (Q3) : seulement si ce mois entre dans la plage affichée
  // (dateDepart peut être choisi après lui, auquel cas il ne doit jamais apparaître).
  const ligneReadmission: LigneSerieIndemnisation[] =
    estMoisReadmission && moisOuverture >= moisAffichageDebut
      ? [
          {
            calculable: false,
            type: "readmission",
            moisLabel: moisOuverture,
            messageTooltip: "Mois de réadmission — le calcul est partagé entre deux droits. Consulte ton relevé France Travail pour le montant exact.",
          },
        ]
      : [];

  return { calculable: true, mois: [...ligneReadmission, ...resultatsAffiches] };
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
 * Répartition mensuelle câblée (2026-07-25, cf. quotaMensuelSalaires/SoldeIndemnisation ci-dessus) :
 * cette fonction calcule le TOTAL, consommé ensuite mois par mois sur `min(dureeDroitsMois,
 * repartitionMoisMax)` mois avec report du non-consommé — même mécanique que la franchise CP.
 * Reste non câblé : le SR/SJM réels ne sont fournis nulle part dans l'app (`calculerSerieDepuisContrats`
 * les accepte en paramètre optionnel `srSjmPourFranchiseSalaires`, mais aucun appelant — RevenusMensuels.tsx,
 * alertes.ts — ne les calcule et ne les lui passe pour l'instant) : `calculerMoisIndemnisation` continue
 * donc de renvoyer `franchise_salaires_non_certifiee` en pratique jusqu'à ce chantier (cf. docs/reprise.md).
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
