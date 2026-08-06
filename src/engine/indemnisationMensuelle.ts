// Calcule, mois par mois, le nombre de jours réellement indemnisés — pas seulement l'AJ théorique.
// MOTEUR UNIQUE du tableau mensuel depuis le 03/08/2026 : `engine/calculerSerie.ts` et
// `engine/franchises.ts`, second moteur concurrent qui consommait la franchise CP AVANT le délai
// d'attente, ont été supprimés (points 3 et 16 de docs/critique_2026-08-03.md). L'ordre inverse
// qu'ils appliquaient est explicitement contredit par les deux sources officielles ci-dessous, et
// par les relevés réels de Benoît (janvier 2026 : 2 jours de DÉLAI consommés, pas 2 de franchise ;
// février 2026 : « franchise CP 4 / différé 5 / travail 19 »).
//
// Ordre de consommation — deux sources officielles concordantes :
//  - Annexe X au règlement annexé à la convention du 15/11/2024, article 23 §1er : « L'application
//    des dispositions des articles 21 et 22 s'effectue dans l'ordre suivant : différé
//    d'indemnisation, délai d'attente, franchise de congés payés, franchise. »
//  - Guide France Travail « Intermittents du spectacle », p.12 : « S'appliquent ensuite sur des
//    jours indemnisables (soit après la prise en compte d'activités professionnelles), dans l'ordre
//    suivant : un délai d'attente, une franchise mensuelle congés payés, une franchise mensuelle
//    salaires. » — décomposé en cinq étapes p.17, cf. `calculerMoisIndemnisation`.
// Soit : jours non indemnisables → délai d'attente → franchise CP du mois → franchise salaires du
// mois → reliquats reportés. Chaque poste ne mord que sur ce que le précédent a laissé.
//
// Le différé d'indemnisation spécifique (étape 0 de l'ordre officiel) n'est pas modélisé : guide
// p.12, « les intermittents du spectacle étant principalement employés sous CDD d'usage ne
// prévoyant pas le versement d'indemnités de rupture, ce différé est rarement appliqué ».
//
// Franchise CP : plafonnée par un forfait mensuel (2j ou 3j selon le palier, cf.
// franceTravailConfig.ts) qui se reporte d'un mois sur l'autre s'il n'est pas intégralement
// consommé (SoldeIndemnisation.quotaCPCarryOver) — PAS "consommer tout ce qui est disponible"
// (lecture initiale erronée du 2026-07-23, corrigée : le 4j consommé en février 2026 s'explique
// entièrement par le report du forfait de janvier, absorbé par le délai d'attente ce mois-là, pas
// par l'absence de plafond).
import type { Contrat, FranchiseSalairesResultat, LigneSerieIndemnisation, MoisIndemnisationEntree, MoisIndemnisationResultat, MontantMensuelResultat, Profil, SerieIndemnisationResultat, SoldeIndemnisation, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { bornesDuMois, diffJours, joursDansMois, moisCle, moisSuivant } from "./dateUtils";
import { getAjReelleAt, getTauxPASAt } from "./ajReelleUtils";
import { heuresContratsSurFenetre, repartirContratParMois } from "./decoupageMensuel";
import { messageMoisOuverturePartielle } from "../content/moisOuverturePartielle";

const FRANCHISE_SALAIRES_NON_CERTIFIEE: FranchiseSalairesResultat = {
  valeur: null,
  avertissement: "franchise_salaires_non_certifiee",
};

// Placeholder : `calculerMoisIndemnisation`/`calculerSerieIndemnisation` n'ont pas connaissance de
// l'historique d'AJ réelle (leur `moisLabel` est purement informatif, jamais une vraie date, cf.
// `MoisIndemnisationEntree`) — seul `calculerSerieDepuisContrats`, qui manipule de vrais mois
// "YYYY-MM", recalcule ce champ correctement (même mécanique que `franchiseSalaires` ci-dessus).
const MONTANT_MENSUEL_INDISPONIBLE: MontantMensuelResultat = { calculable: false, raison: "aj_manquante" };

// Plafond de cumul ARE + rémunérations à 118 % du PMSS (point 25 de docs/critique_2026-08-03.md,
// guide France Travail p.17 étape 5) : « Le montant total de vos rémunérations cumulé au montant de
// l'ARE à verser ne doit pas dépasser 118 % du plafond mensuel de la sécurité sociale. […] Si le
// cumul est supérieur au plafond : le montant mensuel de l'ARE à verser est recalculé = Montant du
// plafond − rémunérations brutes mensuelles. » Le guide précise aussi que le nombre de jours
// indemnisables est alors recalculé, arrondi à l'entier supérieur, depuis le montant écrêté —
// exposé ici en `joursIndemnisesEcretes`, purement informatif : jamais réinjecté dans le solde ou
// les franchises, qui se consomment sur le TRAVAIL du mois, pas sur ce plafond (règle d'or « deux
// compteurs, jamais mélangés »).
//
// `pmssMensuel` nullable (`config.valeursDatees`) : `null` → aucun écrêtement plutôt qu'un plafond
// deviné (devoir n°2, même principe que `smicMensuelBrut`/`smicJournalierBrut` ci-dessous).
//
// ⚠️ Le guide compare le cumul au « montant de l'ARE à verser » sans préciser s'il s'agit du montant
// avant ou après prélèvement à la source — même réserve non tranchée que `RisqueTropPercu`
// (docs/validation.md, « Verrou 2 »). Faute de source qui le précise POUR CE PLAFOND-CI, la
// comparaison porte sur `montant` (AJ réelle × jours, avant PAS), pas sur le net.
function calculerEcretementPMSS(
  montant: number,
  ajUtilisee: number,
  salairesContratsBruts: number,
  config: FranceTravailConfig,
): { montantEcrete: number; montantAvantEcretement: number; plafond: number; joursIndemnisesEcretes: number } | null {
  const { pmssMensuel } = config.valeursDatees;
  if (pmssMensuel === null) return null;
  const plafond = Math.round(pmssMensuel * config.indemnisationMensuelle.plafondCumulCoeffPMSS * 100) / 100;
  if (salairesContratsBruts + montant <= plafond) return null;
  const montantEcrete = Math.max(0, Math.round((plafond - salairesContratsBruts) * 100) / 100);
  const joursIndemnisesEcretes = ajUtilisee > 0 ? Math.ceil(montantEcrete / ajUtilisee) : 0;
  return { montantEcrete, montantAvantEcretement: montant, plafond, joursIndemnisesEcretes };
}

// Montant réellement versé pour un mois donné = joursIndemnises × AJ réelle applicable ce mois-là.
// `debutDuMoisISO` doit être une vraie date ISO (ex. "2026-03-01") — jamais un `moisLabel` non
// vérifié, cf. avertissement ci-dessus.
function calculerMontantMensuel(
  joursIndemnises: number,
  debutDuMoisISO: string,
  ajReelleHistorique: { dateEffet: string; valeur: number }[] | undefined,
  tauxPrelevementSourceHistorique: { dateEffet: string; valeur: number }[] | undefined,
  salairesContratsBruts: number,
  config: FranceTravailConfig,
): MontantMensuelResultat {
  const ajUtilisee = getAjReelleAt(ajReelleHistorique, debutDuMoisISO);
  if (ajUtilisee === null) {
    return { calculable: false, raison: "aj_manquante" };
  }
  const montantAvantEcretement = Math.round(joursIndemnises * ajUtilisee * 100) / 100;
  const ecretement = calculerEcretementPMSS(montantAvantEcretement, ajUtilisee, salairesContratsBruts, config);
  const montant = ecretement ? ecretement.montantEcrete : montantAvantEcretement;
  // Taux applicable CE mois-là (getTauxPASAt), jamais le taux courant réappliqué à tous les mois
  // passés — cf. types/index.ts, tauxPrelevementSourceHistorique. Appliqué au montant déjà écrêté :
  // le PAS se prélève sur ce qui est réellement versé, pas sur un montant théorique dépassé.
  const tauxPAS = getTauxPASAt(tauxPrelevementSourceHistorique, debutDuMoisISO);
  const montantNet = tauxPAS != null ? Math.round(montant * (1 - tauxPAS / 100) * 100) / 100 : undefined;
  return {
    calculable: true,
    montant,
    ajUtilisee,
    montantNet,
    ...(ecretement ? { ecretementPMSS: { montantAvantEcretement: ecretement.montantAvantEcretement, plafond: ecretement.plafond, joursIndemnisesEcretes: ecretement.joursIndemnisesEcretes } } : {}),
  };
}

// Mois de transition — décisions actées, pas encore câblées (TODO d'implémentation, pas de
// question ouverte) :
//
// Q1 — Mois chevauchant deux droits (réadmission) : DÉCISION RÉVISÉE le 03/08/2026. Le fait
// fondateur est confirmé et inchangé : France Travail fait DEUX PASSES SÉPARÉES sur ce mois
// (relevés réels de Benoît, janvier 2026 — ancien droit 54,55 €/j jusqu'au 17/01, nouveau droit
// 55,02 €/j à partir du 18/01, chacun son propre décompte), jamais une moyenne, et Cadence n'a
// structurellement pas accès à l'ancien droit. La décision qui en était tirée — « ne pas calculer ce
// mois du tout » — allait trop loin : elle jetait aussi la seconde passe, celle du NOUVEAU droit,
// dont tous les paramètres sont connus (date d'ouverture, franchises, contrats).
// Nouvelle règle : Cadence calcule la passe du nouveau droit, sur la fenêtre `dateOuverture` → fin
// du mois, et ne devine JAMAIS celle de l'ancien (devoir n°2 intact). Confirmé par l'exemple 9 du
// guide France Travail p.13 : un droit ouvert le 19/12/22 fait courir le délai d'attente « du 19 au
// 25/12/22 », pas du 1er au 7 — le mois d'ouverture démarre bien à la date d'ouverture. Et vérifié
// par la mesure : cette règle reproduit les 4 mois certifiés sans écart, là où aucune des deux
// implémentations antérieures n'y parvenait.
//
// Q2 — Taux PAS multi-années : DÉCISION RENVERSÉE le 01/08/2026 — le besoin réel envisagé ici s'est
// confirmé (relevés de situation réels d'un utilisateur : 3,30 % mi-2025, 3,10 % dès fin
// 2025/début 2026, la DGFIP le revalorise, pas seulement en janvier). `tauxPrelevementSource`
// scalaire unique remplacé par `tauxPrelevementSourceHistorique` (même pattern que
// `ajReelleHistorique`, cf. types/index.ts et `getTauxPASAt`, engine/ajReelleUtils.ts) : chaque mois
// de la série utilise désormais le taux réellement en vigueur CE mois-là, jamais le taux courant
// réappliqué rétroactivement à tous les mois passés (devoir n°2 — c'était le bug réel avant ce
// correctif). L'alerte de vigilance annuelle envisagée initialement n'est plus le mécanisme
// retenu : un historique correct rend inutile un simple rappel "vérifie en janvier".
//
// Q3 — Affichage du mois de transition (RevenusMensuels.tsx) : une ligne CALCULÉE depuis le
// 03/08/2026 (cf. Q1 révisé), portant `ouverturePartielle` — la fenêtre retenue et un tooltip qui
// dit ce que ce mois couvre et ce qu'il ne couvre pas. Le texte vit dans
// content/moisOuverturePartielle.ts et dépend de l'existence d'un droit antérieur (réadmission) ou
// non (première admission ouverte en cours de mois). La ligne reste toujours présente pour que la
// chronologie mois par mois reste continue, sans trou silencieux.
//
// Q1, Q2 et Q3 sont câblés (cf. `calculerSerieDepuisContrats` plus bas, `LigneSerieIndemnisation`
// dans types/index.ts, `getTauxPASAt`).

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

  // Ordre officiel en CINQ étapes, cité mot pour mot du guide France Travail p.17, étape 6
  // (« Votre nombre de jours indemnisables obtenu après la prise en compte d'une activité
  // professionnelle, est réduit dans l'ordre suivant ») :
  //   1. Déduction du délai d'attente.
  //   2. Déduction de la franchise congés payés mensuelle applicable.
  //   3. Déduction de la franchise salaire mensuelle applicable.
  //   4. Déduction du reliquat éventuel de franchise congés payés mensuelle non appliqué sur les
  //      mois antérieurs.
  //   5. Déduction du reliquat éventuel de franchise salaire mensuelle non appliqué sur les mois
  //      antérieurs.
  // Corrigé le 03/08/2026 : le code fondait auparavant le REPORT dans le plafond mensuel
  // (`quotaCPCarryOver + forfaitMensuel` en une seule borne), ce qui déduisait le reliquat de
  // franchise CP AVANT la franchise salaires du mois courant, à l'inverse des étapes 3 et 4.
  // Sans effet tant que la franchise salaires est inactive (quota 0 -> étapes 3 et 5 neutres, les
  // deux formulations sont alors mathématiquement identiques) ; l'écart apparaît dès qu'elle est
  // câblée ET que les jours disponibles sont la contrainte mordante — et il porte sur la
  // RÉPARTITION entre les deux franchises, donc sur le reliquat qui fonde le trop-perçu.
  const delaiConsomme = Math.min(soldeDepart.delaiRestant, reliquatApresTravail);
  const apresDelai = reliquatApresTravail - delaiConsomme;

  const forfaitMensuel = forfaitMensuelCP(franchiseCPTotale, config);
  const cpForfaitConsomme = Math.min(forfaitMensuel, soldeDepart.franchiseCPRestante, apresDelai);
  const apresCPDuMois = apresDelai - cpForfaitConsomme;

  const quotaMensuel = quotaMensuelSalaires(franchiseSalaires, dureeDroitsMois, config);
  const salairesForfaitConsomme = Math.min(quotaMensuel, soldeDepart.franchiseSalairesRestante, apresCPDuMois);
  const apresSalairesDuMois = apresCPDuMois - salairesForfaitConsomme;

  const cpReliquatConsomme = Math.min(soldeDepart.quotaCPCarryOver, soldeDepart.franchiseCPRestante - cpForfaitConsomme, apresSalairesDuMois);
  const apresReliquatCP = apresSalairesDuMois - cpReliquatConsomme;

  const salairesReliquatConsomme = Math.min(soldeDepart.quotaSalairesCarryOver, soldeDepart.franchiseSalairesRestante - salairesForfaitConsomme, apresReliquatCP);
  const joursIndemnises = apresReliquatCP - salairesReliquatConsomme;

  const franchiseCPConsommee = cpForfaitConsomme + cpReliquatConsomme;
  const franchiseSalairesConsommee = salairesForfaitConsomme + salairesReliquatConsomme;

  return {
    calculable: true,
    moisLabel: entree.moisLabel,
    heuresDuMois: entree.heuresDuMois,
    joursNonIndemnisables,
    delaiConsomme,
    franchiseCPConsommee,
    joursIndemnises,
    joursDeLaFenetre: entree.joursDuMois,
    soldeFin: {
      delaiRestant: soldeDepart.delaiRestant - delaiConsomme,
      franchiseCPRestante: soldeDepart.franchiseCPRestante - franchiseCPConsommee,
      // Report = ce qui restait en report, plus le forfait du mois, moins tout ce qui a été
      // effectivement déduit au titre de la franchise CP ce mois-ci. Jamais négatif : chaque
      // déduction est bornée par la part qu'elle consomme.
      quotaCPCarryOver: soldeDepart.quotaCPCarryOver + forfaitMensuel - franchiseCPConsommee,
      franchiseSalairesRestante: soldeDepart.franchiseSalairesRestante - franchiseSalairesConsommee,
      quotaSalairesCarryOver: soldeDepart.quotaSalairesCarryOver + quotaMensuel - franchiseSalairesConsommee,
    },
    franchiseSalaires,
    montantMensuel: MONTANT_MENSUEL_INDISPONIBLE,
    // Placeholder, même mécanique que montantMensuel ci-dessus : calculerMoisIndemnisation n'a pas
    // accès aux contrats — seul calculerSerieDepuisContrats recalcule ce champ correctement.
    salairesContratsBruts: 0,
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

  // Mois d'ouverture PARTIEL : dateOuverture ne tombe pas le 1er du mois calendaire -> ce mois n'est
  // indemnisé qu'en partie. Critère purement calendaire, valable en réadmission (mois partagé avec
  // l'ancien droit) comme en première admission (jours antérieurs à l'ouverture, non indemnisables)
  // — seul le libellé distingue les deux, cf. messageMoisOuverturePartielle.
  //
  // Corrigé le 03/08/2026 (points 3, 4 et 21 de docs/critique_2026-08-03.md). Ce mois était
  // auparavant SAUTÉ ici (`moisDebutCalcul = moisSuivant(moisOuverture)`) au motif que Cadence n'a
  // pas accès à l'ancien droit. Le motif est exact, la conclusion était trop large : la part du
  // NOUVEAU droit, elle, est entièrement connue (sa date de début, ses franchises, ses contrats).
  // La sauter avait deux effets, tous deux mesurés sur les données réelles de Benoît :
  //  - le moteur repartait au mois suivant avec franchise et délai INTACTS, donc décalés d'un mois ;
  //  - l'affichage, lui, recalculait ce mois comme un mois calendaire ENTIER avec un second moteur
  //    (`calculerSerie`, supprimé le même jour), en y déduisant du travail effectué sous le droit
  //    précédent — 129 h au lieu de 93 h en janvier 2026.
  // Résultat : 674,93 € d'ARE annoncés sur janvier et février 2026, deux mois que les relevés
  // France Travail chiffrent à 0. Le mois est désormais simulé sur sa VRAIE fenêtre
  // (`dateOuverture` -> fin du mois), ce qui reproduit exactement les 4 mois certifiés
  // (cf. engine/__tests__/moisOuvertureCertifie.test.ts).
  const bornesMoisOuverture = bornesDuMois(moisOuverture);
  const moisOuverturePartiel = ouvertureDroits.dateOuverture !== bornesMoisOuverture.debut;
  const moisDebutCalcul = moisOuverture;

  const heuresParMois = new Map<string, number>();
  // Salaires bruts des contrats attribués à chaque mois (repartirContratParMois prorate déjà
  // salaireBrut au même titre que les heures) — enseignement ET spectacle, aucun filtre de type
  // ici (à la différence de SR/NHT dans salaireReference.ts, un compteur volontairement distinct).
  const salairesParMois = new Map<string, number>();
  for (const contrat of contrats) {
    for (const part of repartirContratParMois(contrat, config)) {
      heuresParMois.set(part.moisCle, (heuresParMois.get(part.moisCle) ?? 0) + part.heures);
      salairesParMois.set(part.moisCle, (salairesParMois.get(part.moisCle) ?? 0) + part.salaireBrut);
    }
  }

  const moisTries = [...heuresParMois.keys(), moisCle(dateDuJour), moisAffichageDebut, moisDebutCalcul].sort();
  let moisFin = moisTries[moisTries.length - 1];

  // Borne dure sur la fin réelle des droits (ouvertureDroits.dateLimiteIndemnisation, fait déclaré
  // par l'utilisateur depuis sa notification, jamais calculé ici) — pas seulement un filtre
  // d'affichage : aucun mois au-delà n'est simulé, jamais montré comme s'il faisait partie d'une
  // période d'indemnisation qui n'existe plus. Optionnel : tant qu'absent, comportement historique
  // inchangé (série non bornée, cf. dateDuJour/contrats/moisAffichageDebut ci-dessus).
  if (ouvertureDroits.dateLimiteIndemnisation) {
    const moisLimite = moisCle(ouvertureDroits.dateLimiteIndemnisation);
    if (moisLimite < moisFin) moisFin = moisLimite;
  }

  const mois: MoisIndemnisationEntree[] = [];
  for (let curseur = moisDebutCalcul; curseur <= moisFin; curseur = moisSuivant(curseur)) {
    // Seul le mois d'ouverture partiel a une fenêtre plus courte que son mois civil : elle démarre à
    // `dateOuverture`. Ses heures sont reprises des contrats sur CETTE fenêtre (jamais sur le mois
    // entier, sinon on déduit du travail relevant du droit précédent), cf. heuresContratsSurFenetre.
    const estMoisOuverturePartiel = curseur === moisOuverture && moisOuverturePartiel;
    mois.push(
      estMoisOuverturePartiel
        ? {
            moisLabel: curseur,
            joursDuMois: diffJours(ouvertureDroits.dateOuverture, bornesMoisOuverture.fin) + 1,
            heuresDuMois: heuresContratsSurFenetre(contrats, ouvertureDroits.dateOuverture, bornesMoisOuverture.fin, config),
          }
        : { moisLabel: curseur, joursDuMois: joursDansMois(curseur), heuresDuMois: heuresParMois.get(curseur) ?? 0 },
    );
  }

  // Franchise salaires : calculée une seule fois, au démarrage de la série (c'est un TOTAL fixé à
  // l'ouverture des droits, pas une valeur qui varie mois par mois). `valeur: null` -> restante à 0,
  // aucune application (devoir n°2) — cf. quotaMensuelSalaires, qui donne alors un quota de 0.
  // Ordre de priorité (03/08/2026) : le total DÉCLARÉ depuis la notification l'emporte toujours sur
  // un total recalculé — c'est la pièce qui fait foi, et le calcul ne peut de toute façon pas
  // reconstituer fidèlement les « salaires de la période de référence, quel que soit le régime »
  // (cf. Profil.ouvertureDroits.franchiseSalairesTotale). `0` déclaré est une VALEUR, pas une
  // absence : `?? undefined` serait faux ici, d'où le test explicite sur `undefined`.
  const totalDeclare = ouvertureDroits.franchiseSalairesTotale;
  const franchiseSalaires: FranchiseSalairesResultat =
    totalDeclare !== undefined
      ? { valeur: totalDeclare, totalNonVerifie: false, sousEstimeeHorsA10: false, declaree: true }
      : srSjmPourFranchiseSalaires
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
  // `situation` est lu ICI et nulle part ailleurs dans ce moteur : uniquement pour dire s'il existe
  // un droit antérieur avec lequel le mois d'ouverture est partagé — le calcul, lui, est identique
  // dans les deux cas.
  const resultatsAffiches: LigneSerieIndemnisation[] = resultatsComplets
    .filter((resultat) => resultat.moisLabel >= moisAffichageDebut)
    .map((resultat) => {
      const salairesContratsBruts = salairesParMois.get(resultat.moisLabel) ?? 0;
      return {
        ...resultat,
        montantMensuel: calculerMontantMensuel(resultat.joursIndemnises, `${resultat.moisLabel}-01`, profil.ajReelleHistorique, ouvertureDroits.tauxPrelevementSourceHistorique, salairesContratsBruts, config),
        salairesContratsBruts,
        ...(resultat.moisLabel === moisOuverture && moisOuverturePartiel
          ? {
              ouverturePartielle: {
                depuis: ouvertureDroits.dateOuverture,
                messageTooltip: messageMoisOuverturePartielle(profil.situation === "readmission"),
              },
            }
          : {}),
      };
    });

  return { calculable: true, mois: resultatsAffiches };
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
