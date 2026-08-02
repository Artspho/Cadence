// Renouvellement anticipé (réadmission sur demande expresse, Annexe 10) : compare le droit
// actuellement en cours ("ancien") au droit recalculé si l'artiste demande un réexamen anticipé de
// ses droits à une FCT antérieure à sa date anniversaire actuelle. Cela clôt l'ancien droit et en
// ouvre un nouveau — parfois à la baisse (devoir sacré n°2 : jamais de faux feu vert ici).
//
// Règle #1 (cf. cas réel du 31/07/2026, notifications 1 et 2, docs/validation.md) : le nouveau droit
// se calcule avec le moteur STANDARD (fenêtre 365 j se terminant à la FCT retenue) — aucune formule
// à part. Ce module ne fait donc QUE construire la fenêtre/le profil temporaires nécessaires et
// enchaîner periodeReference.ts -> salaireReference.ts -> areBrute.ts -> areNette.ts, exactement
// comme App.tsx (cf. calculs useMemo) — jamais une formule dupliquée.
//
// Zones non certifiées, jamais chiffrées (devoir sacré n°2) :
//  - tropPercuRisque est un booléen de PRUDENCE (jamais un montant, cf. tropPercuChiffrable toujours
//    false) : il vaut `true` sauf quand la simulation mensuelle réelle (calculerSerieDepuisContrats,
//    réutilisée telle quelle) prouve que la franchise CP de l'ancien droit est retombée à 0 un mois
//    calendaire complet AVANT celui de la FCT retenue. En cas de doute (premier mois, mois de la FCT
//    retenue lui-même, données insuffisantes), le risque reste signalé.
//    Sourçage complété le 03/08/2026 (cf. le bloc « Trop-perçu » sur ComparaisonRenouvellementAnticipe
//    plus bas et docs/validation.md) : le DÉCLENCHEUR est désormais confirmé à la source primaire, la
//    FORMULE du montant l'est aussi au niveau réglementaire — mais elle reste NON CALCULABLE par
//    Cadence aujourd'hui, pour trois raisons nommées là-bas. Aucun montant n'est donc câblé, et ce
//    n'est pas un oubli.
//  - la franchise salaires du nouveau droit n'est pas calculée ici : cf. F2 (content/renouvellementAnticipe.ts),
//    affichée par l'écran, jamais un 0 qui laisserait croire qu'elle est nulle.
import type { AJBruteResultat, AJNetteResultat, Contrat, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, dansIntervalle, diffJours, moisCle } from "./dateUtils";
import { calculerFenetreReference } from "./periodeReference";
import { calculerDecompteHeures } from "./decompteHeures";
import { calculerSalaireReference } from "./salaireReference";
import { calculerAJBrutePourFenetre } from "./areBrute";
import { calculerAJNette, calculerSJM } from "./areNette";
import { calculerSerieDepuisContrats } from "./indemnisationMensuelle";

/**
 * Droit actuellement en cours, AVANT le renouvellement anticipé. Chiffres DÉCLARÉS (notification
 * France Travail réelle : Profil.ouvertureDroits + dernière entrée de Profil.ajReelleHistorique),
 * jamais recalculés par Cadence ici — la comparaison doit s'appuyer sur les vrais montants notifiés
 * (devoir sacré n°2), pas sur une reconstitution qui pourrait diverger du relevé réel.
 */
export interface AncienDroit {
  /** Date de la notification qui a ouvert le droit en cours (Profil.ouvertureDroits.dateOuverture) —
   * sert à juger si le délai d'attente a déjà couru dans les 12 derniers mois, et de point de départ
   * à la simulation mensuelle qui vérifie l'épuisement de la franchise CP. */
  dateOuverture: string;
  /** FCT retenue ayant ouvert le droit en cours — borne la fenêtre de référence du nouveau droit
   * (Profil.dateAnniversairePrecedente, periodeReference.ts) : le guide et le simulateur officiels
   * confirment que la période de référence ne remonte JAMAIS avant la dernière FCT ayant servi à
   * ouvrir un droit, même quand moins de 365 j se sont écoulés depuis (le cas de tout renouvellement
   * anticipé, par construction). */
  fctRetenue: string;
  /** Date anniversaire actuellement notifiée — celle que le renouvellement anticipé fait sauter. */
  dateAnniversaire: string;
  /** Dernière AJ nette notifiée (Profil.ajReelleHistorique, entrée la plus récente). */
  ajNette: number;
  /** Franchise CP totale notifiée à l'ouverture (Profil.ouvertureDroits.franchiseCPTotale). */
  franchiseCPTotale: number;
  /** Délai d'attente notifié à l'ouverture (Profil.ouvertureDroits.delaiAttenteInitial). */
  delaiAttenteInitial: number;
}

export interface NouveauDroitCalcule {
  fctRetenue: string;
  /** FCT retenue + 12 mois exactement (config.periodeReferenceJours) — sans lien avec l'ancienne
   * date anniversaire, cf. règle #2 du cas réel. */
  dateAnniversaire: string;
  /** Début réel de la fenêtre de référence utilisée (periodeReference.ts) — souvent plus courte que
   * 365 j quand l'ancien droit est récent, cf. `AncienDroit.fctRetenue` qui la borne. Affichée à
   * l'utilisateur pour la transparence du calcul (même logique que `fenetreDebut` sur Dashboard.tsx). */
  fenetreDateDebut: string;
  sr: number;
  sar: number | null;
  nht: number;
  ajBrute: AJBruteResultat;
  ajNette: AJNetteResultat;
  /** Jours travaillés distincts sur la nouvelle fenêtre de référence — base de l'acquisition de la
   * franchise CP, cf. calculerJoursTravaillesFenetre. */
  joursTravaillesFenetre: number;
  /** Franchise CP acquise sur la nouvelle fenêtre (jours travaillés × 2,5 / 24, plafonnée à 30 j). */
  franchiseCPTotale: number;
  /** 0 si le délai ne se réapplique pas (cf. delaiReapplique), sinon config.differesEtFranchises.delaiAttenteJours. */
  delaiAttenteInitial: number;
  /** false = le délai d'attente a déjà couru il y a moins de 12 mois, il ne se réapplique pas. */
  delaiReapplique: boolean;
}

export interface ComparaisonRenouvellementAnticipe {
  ancien: AncienDroit;
  nouveau: NouveauDroitCalcule;
  /** nouveau.ajNette.net - ancien.ajNette, arrondi au centime. Négatif = baisse. */
  ecartAJ: number;
  /** true si ecartAJ est négatif au-delà d'un arrondi négligeable (cf. cas B2 : un écart de quelques
   * centimes dû aux arrondis de calcul n'est pas une "baisse" à signaler comme telle). */
  baisse: boolean;
  /**
   * ── Trop-perçu : ce qui est SOURCÉ, et pourquoi rien n'est chiffré ────────────────────────────
   * Sourçage mené le 03/08/2026 sur pièces primaires (détail et citations : docs/validation.md).
   *
   * DÉCLENCHEUR — confirmé, et il correspond bien à ce que ce champ signale :
   *   Guide France Travail « Intermittents du spectacle », éd. juillet 2026, p.19 : « La réadmission
   *   expresse ou à date anniversaire peuvent entraîner : [...] Un trop-perçu si les franchises
   *   précédentes n'ont pas été intégralement prélevées. »
   *   Même guide, encadré « Attention » p.15 : « Lorsque les franchises congés payés et salaires
   *   totales n'ont pu être intégralement déduites au terme de votre période d'indemnisation
   *   (atteinte de votre date anniversaire ou demande de réadmission avant votre date anniversaire),
   *   un trop-perçu équivalent au reliquat de franchises vous sera notifié (dans la limite de ce que
   *   vous avez perçu). »
   *   ⚠️ Ce n'est PAS le plafond de cumul à 118 % du PMSS (`indemnisationMensuelle.plafondCumulCoeffPMSS`) :
   *   celui-là est un écrêtement PROSPECTIF du montant mensuel à verser (guide p.17, étape 5), calculé
   *   avant paiement — il ne produit un indu que sur déclaration erronée, mécanisme distinct et non
   *   modélisé ici.
   *
   * FORMULE — sourcée au niveau réglementaire, mais NON CALCULABLE par Cadence :
   *   Annexe X au règlement général (convention d'assurance chômage), article 31 §2 — texte identique
   *   à l'article 23 §2 de l'Annexe 8 : « Lorsque les franchises déterminées conformément aux
   *   modalités de l'article 29 § 1er n'ont pu être intégralement appliquées au terme de la période
   *   d'indemnisation, il est procédé à une récupération des allocations versées à tort, sur la base
   *   du montant de l'allocation journalière déterminée à l'ouverture de droits ou de la réadmission. »
   *   Soit : reliquat de franchises (en jours) × AJ de l'ouverture/réadmission, borné par les
   *   allocations réellement versées. Trois verrous empêchent de l'appliquer honnêtement aujourd'hui :
   *     1. ASSIETTE INCOMPLÈTE — le reliquat porte sur les franchises CP **et salaires** (art. 29 §1er).
   *        Cadence ne calcule pas la franchise salaires (`FRANCHISE_SALAIRES_NON_CERTIFIEE` :
   *        aucun appelant ne fournit SR/SJM à `calculerSerieDepuisContrats`) et `Profil.ouvertureDroits`
   *        n'a pas de champ déclaratif pour son total. Chiffrer la seule part CP donnerait un montant
   *        systématiquement SOUS-ESTIMÉ, présenté comme complet — un faux signal rassurant.
   *     2. NATURE DE L'AJ NON TRANCHÉE — le règlement dit « allocation journalière déterminée à
   *        l'ouverture de droits », mais récupère des « allocations versées à tort » (donc nettes).
   *        Cadence ne stocke que l'AJ NETTE déclarée (`Profil.ajReelleHistorique`). Brute ou nette :
   *        aucune source consultée ne le dit, et l'écart (~2,2 %) n'est pas négligeable sur 30 jours.
   *     3. PLAFOND NON DISPONIBLE — « dans la limite de ce que vous avez perçu » exige le cumul
   *        réellement versé depuis l'ouverture du droit ; la série mensuelle de Cadence démarre d'un
   *        solde DÉCLARÉ à une date choisie par l'utilisateur, pas de l'ouverture.
   *
   * TODO (ordre de levée) : (1) câbler la franchise salaires (SR/SJM déjà calculés côté « montant
   * ARE », cf. le paramètre optionnel `srSjmPourFranchiseSalaires`) OU ajouter un champ déclaratif
   * `franchiseSalairesTotale` à `ouvertureDroits` ; (2) trancher brute/nette sur un relevé réel
   * portant un trop-perçu notifié. Tant que (1) n'est pas levé, ne rien chiffrer.
   */
  tropPercuRisque: boolean;
  /**
   * Toujours false : aucun montant de trop-perçu n'est câblé — cf. les trois verrous ci-dessus.
   * ⚠️ LIMITE CONNUE de `tropPercuRisque` lui-même, découverte par le sourçage du 03/08/2026 et
   * NON corrigée ici (décision produit en attente, cf. CLAUDE.md) : la règle officielle vise les
   * franchises CP **et salaires**, alors que `ancienneFranchiseCPEpuisee` ne regarde que la CP.
   * `tropPercuRisque === false` signifie donc « franchise CP prouvée épuisée », pas « aucun risque » —
   * si une franchise salaires non nulle subsistait, le risque existerait quand même.
   */
  tropPercuChiffrable: false;
}

/**
 * Jours travaillés distincts dans une fenêtre — base de l'acquisition de la franchise CP (guide FT :
 * jours travaillés × 2,5 / 24). Compte chaque jour calendaire de la fenêtre couvert par AU MOINS un
 * contrat, TOUS TYPES CONFONDUS (contrairement à SR/NHT dans salaireReference.ts, qui excluent
 * l'enseignement et la formation : la franchise CP porte sur les jours réellement travaillés, un
 * jour de cours en est un), sans compter deux fois un jour couvert par plusieurs contrats qui se
 * chevauchent.
 *
 * Day-by-day, même style que joursAssimilesHorsContrat (decompteHeures.ts) : la fenêtre fait au plus
 * 365 j et les contrats sont peu nombreux, le coût est négligeable — la lisibilité de la règle
 * « ce jour est-il couvert par un contrat ? » vaut mieux ici qu'une arithmétique d'intersections.
 */
export function calculerJoursTravaillesFenetre(contrats: Contrat[], fenetre: { dateDebut: string; dateFin: string }): number {
  let jours = 0;
  for (let jour = fenetre.dateDebut; jour <= fenetre.dateFin; jour = ajouterJours(jour, 1)) {
    if (contrats.some((c) => dansIntervalle(jour, c.dateDebut, c.date))) jours += 1;
  }
  return jours;
}

/**
 * Acquisition de la franchise CP (guide FT : (jours travaillés × 2,5) / 24, plafonnée à
 * config.differesEtFranchises.franchiseCongesPayes.plafondJours). Formule ✅ certifiée en config,
 * mais jusqu'ici jamais câblée nulle part dans le moteur — validée ici à l'unité de jour près sur le
 * cas réel du 31/07/2026 (61 j → 6 j, 57 j → 5 j, cf. renouvellementAnticipe.test.ts).
 */
export function calculerFranchiseCPAcquise(joursTravailles: number, config: FranceTravailConfig): number {
  const { tauxAcquisition, base, plafondJours } = config.differesEtFranchises.franchiseCongesPayes;
  return Math.min(Math.floor((joursTravailles * tauxAcquisition) / base), plafondJours);
}

/**
 * Le délai d'attente ne se réapplique pas s'il a déjà couru sur les 12 derniers mois (✅ guide FT,
 * cf. le commentaire de franceTravailConfig.differesEtFranchises.delaiAttenteJours : "une fois par
 * période de 12 mois"). Il court au tout début du droit (`dateOuvertureAncienne`) : si moins de
 * `delaiAttentePeriodeReapplicationJours` se sont écoulés jusqu'à la FCT retenue du nouveau droit, il
 * ne se réapplique pas. Jamais de prorata partiel : aucun cas réel ne le confirme (cf. cas D1/D2).
 */
export function delaiSeReapplique(dateOuvertureAncienne: string, fctRetenueNouvelle: string, config: FranceTravailConfig): boolean {
  return diffJours(dateOuvertureAncienne, fctRetenueNouvelle) >= config.differesEtFranchises.delaiAttentePeriodeReapplicationJours;
}

/**
 * La franchise CP de l'ANCIEN droit était-elle sûrement épuisée avant la FCT retenue du nouveau
 * droit ? Réutilise tel quel `calculerSerieDepuisContrats` (indemnisationMensuelle.ts) — aucune
 * formule à part — pour simuler mois par mois la consommation réelle depuis `ancien.dateOuverture`.
 *
 * Prudence délibérée (devoir sacré n°2) : seule une franchise dont le solde de fin de mois est tombé
 * à 0 un mois calendaire COMPLET avant celui de la FCT retenue est considérée comme sûrement
 * épuisée. Le mois de la FCT retenue lui-même n'est jamais utilisé (la franchise pourrait s'y épuiser
 * APRÈS le jour exact de la FCT) ; l'absence de mois antérieur calculable (historique trop court)
 * renvoie `false` (non prouvée épuisée) plutôt qu'une présomption optimiste.
 *
 * ⚠️ Ne regarde QUE la franchise congés payés, alors que la règle officielle vise les franchises CP
 * **et salaires** (cf. le bloc « Trop-perçu » sur ComparaisonRenouvellementAnticipe) : un `true`
 * renvoyé ici ne prouve donc pas l'absence de tout reliquat. Écart connu, laissé tel quel faute de
 * pouvoir calculer la franchise salaires — ne pas « simplifier » cette fonction sans lire ce bloc.
 */
function ancienneFranchiseCPEpuisee(contrats: Contrat[], profil: Profil, ancien: AncienDroit, fctRetenue: string, config: FranceTravailConfig): boolean {
  const profilAncien: Profil = {
    ...profil,
    dateAnniversaire: ancien.dateAnniversaire,
    ouvertureDroits: { dateOuverture: ancien.dateOuverture, franchiseCPTotale: ancien.franchiseCPTotale, delaiAttenteInitial: ancien.delaiAttenteInitial },
  };
  const serie = calculerSerieDepuisContrats(profilAncien, { dateDepart: ancien.dateOuverture }, contrats, fctRetenue, config);
  if (!serie.calculable) return false;

  const moisCible = moisCle(fctRetenue);
  const moisAvant = serie.mois.filter((m) => m.calculable && m.moisLabel < moisCible);
  if (moisAvant.length === 0) return false;

  const dernier = moisAvant[moisAvant.length - 1];
  return dernier.calculable && dernier.soldeFin.franchiseCPRestante === 0;
}

/**
 * Calcule la comparaison ancien/nouveau droit pour un renouvellement anticipé demandé à `fctRetenue`.
 * Fonction pure, sans dépendance React/DOM (cf. SPEC.md §12) : l'appelant (écran) est responsable de
 * construire `ancien` depuis `Profil.ouvertureDroits` + la dernière entrée de `Profil.ajReelleHistorique`.
 */
export function calculerRenouvellementAnticipe(
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  profil: Profil,
  config: FranceTravailConfig,
  ancien: AncienDroit,
  fctRetenue: string,
): ComparaisonRenouvellementAnticipe {
  // Fenêtre standard du moteur existant (règle #1, cas réel du 31/07/2026 : "le moteur standard,
  // fenêtre 365 j se terminant à cette FCT, suffit — pas de formule à part"), bornée par la FCT de
  // l'ancien droit (`dateAnniversairePrecedente`) : confirmé texto par le simulateur officiel France
  // Travail ("dans la limite de la dernière fin de contrat ayant servi à ouvrir un droit", consulté
  // le 31/07/2026) et par le cas réel lui-même (Notification 2 : fenêtre réelle 24/03/2025→17/01/2026,
  // 299 j, PAS 365 j — cf. periodeReference.ts, corrigé le même jour pour appliquer cette borne à la
  // fenêtre de base et pas seulement à son extension).
  const profilFenetre: Profil = { ...profil, dateAnniversaire: fctRetenue, situation: "readmission", dateAnniversairePrecedente: ancien.fctRetenue };
  const fenetre = calculerFenetreReference(profilFenetre, contrats, periodes, config, fctRetenue);

  const decompte = calculerDecompteHeures(contrats, periodes, profilFenetre, config, fenetre);
  const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profilFenetre, config, fenetre);
  const ajBrute = calculerAJBrutePourFenetre(fenetre, decompte.total, sar ?? sr, nht, config);
  // Découvert le 31/07/2026 (cas E1) puis corrigé partout (App.tsx, Simulateur.tsx, cycles.ts,
  // RevenusMensuels.tsx) : le SJM doit utiliser le même salaire retenu que l'AJ brute (sar ?? sr),
  // jamais sr seul — confirmé par le simulateur officiel France Travail, qui n'expose qu'un champ
  // "salaire de référence" unique réutilisé identiquement en aval.
  const sjm = calculerSJM(sar ?? sr, nht, config);
  const ajNette = calculerAJNette(ajBrute.brut, sjm, profilFenetre, config);

  const joursTravaillesFenetre = calculerJoursTravaillesFenetre(contrats, fenetre);
  const franchiseCPTotale = calculerFranchiseCPAcquise(joursTravaillesFenetre, config);

  const delaiReapplique = delaiSeReapplique(ancien.dateOuverture, fctRetenue, config);
  const delaiAttenteInitial = delaiReapplique ? config.differesEtFranchises.delaiAttenteJours : 0;

  const dateAnniversaire = ajouterJours(fctRetenue, config.periodeReferenceJours);

  const nouveau: NouveauDroitCalcule = {
    fctRetenue,
    dateAnniversaire,
    fenetreDateDebut: fenetre.dateDebut,
    sr,
    sar,
    nht,
    ajBrute,
    ajNette,
    joursTravaillesFenetre,
    franchiseCPTotale,
    delaiAttenteInitial,
    delaiReapplique,
  };

  const ecartAJ = Math.round((nouveau.ajNette.net - ancien.ajNette) * 100) / 100;
  const baisse = ecartAJ < -0.005;

  const tropPercuRisque = !ancienneFranchiseCPEpuisee(contrats, profil, ancien, fctRetenue, config);

  return { ancien, nouveau, ecartAJ, baisse, tropPercuRisque, tropPercuChiffrable: false };
}
