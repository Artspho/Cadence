// ── Modèle métier « Cadence » ─────────────────────────────────────
// Toutes les dates sont des chaînes ISO (YYYY-MM-DD). Un artiste au
// cachet saisit des cachets (jamais des heures) : toute conversion est
// faite par le moteur (src/engine) via la config, jamais dans l'UI.

export type TypeContrat =
  | "artiste" // représentation, enregistrement, répétition, résidence
  | "enseignement" // compte pour 507 h, exclu du montant
  | "formation" // non rémunérée, limite 2/3
  | "ptp"; // projet de transition pro : 1 h = 1 h

export type TypeRemuneration = "cachet" | "heures";
export type Territoire = "france" | "eee_suisse_uk"; // EEE : 6 h/jour (artistes)

export interface Contrat {
  id: string;
  // Plage couverte par le contrat — nécessaire pour répartir heures/salaire au prorata des jours
  // calendaires quand le contrat chevauche deux mois civils (cf. engine/decoupageMensuel.ts).
  // Migration silencieuse à la lecture pour un contrat enregistré avant l'ajout de ce champ :
  // dateDebut = date (contrat traité comme un contrat d'un seul jour), cf. localStorageAdapter.ts.
  dateDebut: string; // ISO (premier jour du contrat)
  date: string; // ISO (date de fin de contrat, inchangé)
  type: TypeContrat;
  typeRemuneration: TypeRemuneration;
  territoire: Territoire;
  nbCachets?: number;
  nbHeures?: number;
  nbJoursEEE?: number; // si territoire === "eee_suisse_uk"
  salaireBrut: number; // € bruts AVANT abattement frais pro
  employeur: string;
  etablissementAgree?: boolean; // enseignement : condition de prise en compte
  enRapportAvecMetier?: boolean; // enseignement : condition de prise en compte
  source?: "manuel" | "import_pdf" | "recurrent"; // provenance ; un import PDF est revu avant validation
  // Présent uniquement sur les contrats matérialisés par un contrat récurrent (lib/contratRecurrent.ts) :
  // même valeur partagée par tous les contrats générés en une fois, sert à les regrouper/les
  // supprimer ensemble dans ContractList.tsx. Absent = contrat saisi normalement, comportement
  // inchangé (champ optionnel, aucune migration requise).
  recurrenceId?: string;
}

// Périodes assimilées (5 h/jour) & événements affectant la période de référence
export type TypePeriode =
  | "maternite"
  | "adoption"
  | "accident_travail"
  | "ald"
  | "suspension_contrat" // 5 h/jour, comptent pour 507 h
  | "maladie_intercontrat"; // NEUTRALISÉE : allonge la fenêtre de 365 j

export interface PeriodeAssimilee {
  id: string;
  type: TypePeriode;
  dateDebut: string; // ISO
  dateFin: string; // ISO
}

export interface Profil {
  dateNaissance: string; // ISO — plafond enseignement 70/120 h
  dateAnniversaire: string; // ISO — fin du dernier contrat ouvrant les droits
  situation: "premiere_admission" | "readmission";
  alsaceMoselle?: boolean; // cotisation locale (AJ nette)
  baremeCSG?: "normal" | "reduit"; // taux CSG applicable
  /** @deprecated Remplacé par `regimeDeclare`. Conservé en lecture seule pour ne jamais faire
   * régresser un profil déjà enregistré (devoir sacré n°1) : `lib/profilHorsPerimetre.ts` le lit
   * en repli quand `regimeDeclare` est absent. Plus jamais écrit par l'UI. */
  activiteHorsAnnexe10?: boolean;
  // Garde-fou "situation mixte" : signalé par l'utilisateur, jamais déduit des contrats.
  // "annexe10_pur" = artiste (+ enseignement/formation, déjà modélisés) uniquement.
  // "mixte" = présence de technicien (Annexe 8) ou d'un emploi hors spectacle au régime général.
  // "inconnu" ("je ne sais pas") traité comme hors périmètre par prudence (au moindre doute → FT).
  regimeDeclare?: "annexe10_pur" | "mixte" | "inconnu";
  // Réadmission uniquement (non applicable en première admission, pas juste "inconnue" — d'où un
  // champ optionnel plutôt qu'une chaîne vide comme `dateAnniversaire`). Date de fin de la période
  // de droits précédente : borne la recherche d'heures en réadmission (periodeReference.ts) pour ne
  // jamais recompter des heures déjà utilisées pour justifier les droits précédents. Absent =
  // comportement inchangé (garde-fou TRANCHES_MAX, cf. SeuilReadmission "historique_insuffisant") ;
  // aucune migration requise pour les profils déjà enregistrés (champ optionnel).
  dateAnniversairePrecedente?: string;
  // Durée de la période de droits en mois, connue à l'ouverture (notification France Travail) —
  // sert à la répartition de la franchise salaires (min(dureeDroitsMois, repartitionMoisMax) mois,
  // cf. engine/indemnisationMensuelle.ts). Standard = 12 ; clause de rattrapage (6 mois,
  // franceTravailConfig.readmission.clauseRattrapage) = 6. Optionnel, jamais déduit de
  // l'historique d'activité (devoir sacré n°2) — absent tant que non renseigné.
  dureeDroitsMois?: 12 | 6;
  // Salaires perçus pendant la PRA hors Annexe 10 (technicien A8, régime général…), non plafonnés
  // — composante de SR_total pour la franchise salaires. `null`/absent : la franchise salaires est
  // alors estimée sur les seuls salaires Annexe 10 (peut être sous-estimée), jamais bloquant —
  // cf. FranchiseSalairesResultat.sousEstimeeHorsA10.
  salairesHorsAnnexe10PRA?: number | null;
  // AJ nette notifiée par France Travail pour la réadmission en cours (déplacé depuis
  // `SoldeIndemnisationDepart` le 2026-07-25 : c'est une caractéristique de l'ouverture de droits,
  // pas du point de départ choisi pour afficher le tableau mensuel). Peut couvrir plusieurs taux
  // successifs sur une même période d'indemnisation (ex. 54,55 € jusqu'au 17/01/2026 puis 55,02 €
  // à partir du 18/01/2026, cf. docs/reprise.md). Chaque entrée : `dateEffet` ISO, `valeur` en € ;
  // tableau trié croissant par `dateEffet`. Vide ou absent : la simulation mensuelle est bloquée —
  // aucun fallback sur une AJ estimée n'est possible ici (devoir n°2).
  ajReelleHistorique?: { dateEffet: string; valeur: number }[];
  // Paramètres de l'ouverture de droits en cours, saisis une fois depuis la notification France
  // Travail — consommés automatiquement mois par mois par le moteur
  // (engine/indemnisationMensuelle.ts : calculerSerieDepuisContrats simule depuis dateOuverture),
  // jamais reconstruits ni devinés. Absent = simulation mensuelle bloquée (RevenusMensuels.tsx),
  // jamais un chiffre inventé (devoir n°2).
  ouvertureDroits?: {
    dateOuverture: string; // ISO — date de la notification France Travail
    franchiseCPTotale: number; // jours — chiffre exact de la notification, PAS le solde restant
    delaiAttenteInitial: number; // jours — presque toujours 7
    tauxPrelevementSource?: number; // % entier ou décimal, ex. 7.2
    // Date de fin de la période d'indemnisation en cours — chiffre exact de la notification
    // France Travail (« La date limite de votre indemnisation est le JJ/MM/AAAA »), jamais
    // calculée par Cadence (même principe que franchiseCPTotale/delaiAttenteInitial : le moteur ne
    // devine pas une durée réglementaire, il consomme un fait déclaré). Optionnel pour ne rien
    // casser sur un profil déjà enregistré avant l'ajout de ce champ — tant qu'absent, la série
    // mensuelle reste non bornée (comportement historique). Borne dure (pas seulement un filtre
    // d'affichage) : cf. calculerSerieDepuisContrats, engine/indemnisationMensuelle.ts — aucun mois
    // au-delà n'est simulé, jamais montré comme s'il faisait partie de droits qui n'existent plus.
    dateLimiteIndemnisation?: string;
  };
}

// ── Historique : un exercice = un cycle de 12 mois entre deux dates anniversaire ──
export interface Exercice {
  id: string;
  dateDebut: string; // ISO
  dateAnniversaire: string; // ISO — fin du cycle
  heuresAtteintes: number;
  objectifAtteint: boolean; // 507 h atteintes ?
  ajBrute?: number; // allocation obtenue sur le cycle
  ajNette?: number;
  cloture: boolean; // exercice passé (true) vs en cours (false)
}

// ── Alertes : problèmes détectés par le moteur ──
export type NiveauAlerte = "info" | "attention" | "critique";
export type CodeAlerte =
  | "rythme_insuffisant" // projection < 507 avant l'anniversaire
  | "anniversaire_imminent" // échéance proche + heures manquantes
  | "plafond_enseignement" // heures d'enseignement qui ne compteront plus
  | "cumul_ens_formation" // approche des 338 h
  | "plafond_cachets_mois" // > 28 cachets sur un mois civil
  | "eligible_rattrapage" // 338–506 h : clause de rattrapage possible
  | "situation_mixte" // garde-fou hors périmètre Annexe 10 pur
  | "seuil_readmission_non_calculable" // réadmission : historique de contrats insuffisant pour ajuster le seuil
  | "pas_taux_janvier"; // taux de prélèvement à la source potentiellement mis à jour au 1er janvier par la DGFIP

export interface Alerte {
  code: CodeAlerte;
  niveau: NiveauAlerte;
  titre: string;
  message: string; // formulé côté utilisateur, avec l'action à mener
  actionSuggeree?: string;
}

// ── Import PDF : résultat d'extraction, TOUJOURS revu avant enregistrement ──
export interface BulletinExtrait {
  champs: Partial<Contrat>; // ce que l'extraction a pu lire
  confiance: Record<string, "haute" | "moyenne" | "faible">; // par champ
  texteBrut: string; // pour vérification manuelle
  avertissements: string[]; // ex. « montant illisible », « date ambiguë »
}

// ── Résultats des fonctions du moteur (engine/) ───────────────────

export interface RepartitionHeures {
  cachets: number;
  heuresScene: number;
  eee: number;
  assimilees: number;
  ptp: number;
  enseignementRetenu: number;
  enseignementExcedentaire: number;
  formationRetenue: number;
  formationExcedentaire: number;
}

export interface DecompteHeuresResultat {
  total: number; // heuresPour507 : total retenu pour l'affiliation
  repartition: RepartitionHeures;
  plafondEnseignementApplicable: number; // 70 ou 120, selon l'âge à l'anniversaire
  cachetsParMois: Record<string, number>; // clé "YYYY-MM" -> nb de cachets, pour l'alerte plafond
}

// Résultat de la recherche du seuil ajusté en réadmission (periodeReference.ts) : soit un
// nombre de tranches et un seuil réellement trouvés (le total d'heures dans la fenêtre étendue
// a atteint le seuil), soit l'algorithme n'y arrive jamais — mais pour deux raisons bien
// différentes, jamais confondues (devoir sacré n°2 : aucun seuil gonflé n'est présenté comme réel) :
// - "historique_insuffisant" : pas de `dateAnniversairePrecedente` connue (ou une borne si lointaine
//   que le garde-fou absolu TRANCHES_MAX coupe la recherche avant de l'atteindre) — manque de
//   données côté Cadence, pas une conclusion sur l'éligibilité.
// - "hors_bornes" : `dateAnniversairePrecedente` connue et respectée jusqu'au bout, la recherche a
//   été menée intégralement et n'a simplement pas trouvé assez d'heures — un vrai résultat
//   réglementaire (non éligible à l'allongement), pas un manque de données.
export type SeuilReadmission =
  | { calculable: true; tranchesReadmission: number; seuilHeuresAjuste: number }
  | { calculable: false; raison: "historique_insuffisant"; tranchesTentees: number }
  | { calculable: false; raison: "hors_bornes"; tranchesTentees: number; dateAnniversairePrecedente: string };

export interface FenetreReference {
  dateDebut: string;
  dateFin: string;
  joursAllongementMaladie: number; // jours ajoutés par les maladies inter-contrat
  seuilReadmission: SeuilReadmission;
}

export interface SalaireReferenceResultat {
  sr: number; // salaire de référence (hors enseignement/formation)
  nht: number; // nombre d'heures travaillées retenues (hors enseignement/formation)
  sar: number | null; // salaire aménagé, non-null si des périodes assimilées sont retenues
  joursPeriodeAssimileesRetenues: number;
}

export interface AJBruteResultat {
  a: number;
  b: number;
  c: number;
  brutAvantClamp: number;
  brut: number; // après application du plancher/plafond
  plancherApplique: boolean;
  plafondApplique: boolean;
}

export interface DetailCotisation {
  libelle: string;
  montant: number; // montant retenu, en €/jour
}

export interface AJNetteResultat {
  brut: number;
  net: number;
  sjm: number;
  detailCotisations: DetailCotisation[];
}

export type NiveauStatut = "securite" | "alerte" | "bloque";

// Raison pour laquelle un rythme mensuel requis ne peut pas être calculé :
// - "anniversaire_inconnu" : donnée manquante (profil neuf sans date anniversaire), pas une
//   échéance dépassée — un message "délai expiré" serait un faux signal (devoir sacré n°2).
// - "delai_expire" : anniversaire connu ET déjà dépassé (niveau "bloque").
// Volontairement pas de 3e raison "rythme_hors_limite" (rythme fini mais humainement
// absurde) : nécessite un seuil non réglementaire (décision produit), différé au backlog.
export type RythmeRequis = { atteignable: true; heuresParMois: number } | { atteignable: false; raison: "anniversaire_inconnu" | "delai_expire" };

export interface StatutPrediction {
  niveau: NiveauStatut;
  heuresActuelles: number;
  seuilHeures: number;
  heuresRestantes: number;
  dateAnniversaire: string;
  joursRestants: number;
  // false quand l'anniversaire est inconnu : dans ce cas, `dateAnniversaire` et `joursRestants`
  // reposent sur la fenêtre fictive "se terminant aujourd'hui" (cf. periodeReference.ts) — un
  // artifice de calcul, jamais une vraie échéance. Tout consommateur de `joursRestants` doit
  // vérifier ce booléen avant d'en tirer un texte du type "échéance atteinte" (devoir sacré n°2).
  anniversaireConnu: boolean;
  // Heures des contrats déjà signés mais datés après aujourd'hui (`dateCap`), dans la fenêtre de
  // référence — 0 si aucun. Pas une projection : decompteHeures.ts/salaireReference.ts les comptent
  // déjà dans le total "pleine fenêtre" (utilisé pour l'AJ affichée) ; ce champ rend explicite,
  // côté prédiction/graphique, ce que ces deux modules savaient déjà silencieusement. Sert à
  // distinguer "acquis" (heuresActuelles) / "confirmé à venir" (ce champ) / "projection au rythme"
  // (dateFranchissementProjetee) — jamais à mélanger les trois (devoir sacré n°2).
  heuresCertainesAVenir: number;
  // Écart net à combler = seuilHeures - (heuresActuelles + heuresCertainesAVenir), jamais négatif.
  // Distinct de `heuresRestantes` (qui ignore le certain à venir) : tout texte "il te manque X h" ou
  // "vise X h/mois" doit lire CE champ, pas `heuresRestantes`, sous peine de deux chiffres
  // contradictoires dans le même message (devoir sacré n°2 — bug trouvé en testant : l'alerte disait
  // "il manque 507 h" à côté d'un "vise 90 h/mois" qui, lui, tenait déjà compte du certain).
  heuresRestantesApresCertain: number;
  // Reflète fenetre.seuilReadmission (periodeReference.ts) : quand `calculable` est faux,
  // `seuilHeures` ci-dessus est retombé sur le seuil standard (507 h), pas un chiffre gonflé —
  // tout consommateur qui veut afficher l'état honnête (bandeau, alerte dédiée) doit lire ce champ.
  seuilReadmission: SeuilReadmission;
  rythmeMensuelActuel: number; // h/mois, moyenne depuis le début de la période de référence
  rythmeRequis: RythmeRequis; // h/mois requis pour atteindre le seuil avant l'anniversaire, ou raison si inatteignable
  dateFranchissementProjetee: string | null; // date projetée d'atteinte du seuil au rythme actuel
  eligibleRattrapage: boolean; // 338–506 h : clause de rattrapage potentiellement mobilisable
  message: string; // phrase courte, orientée utilisateur (cf. charte §8.7)
}

// ── Module indemnisation mensuelle (V2) ─────────────────────────────
// Reprend d'un solde de départ à une date connue (relevé France Travail réel), jamais reconstruit
// depuis la réadmission : un mois de régularisation (transition de droits en cours de mois) n'a pas
// de décomposition standard reconstituable, toute tentative produirait un solde faux en cascade —
// cf. docs/reprise.md.
export interface SoldeIndemnisation {
  delaiRestant: number; // jours de délai d'attente encore consommables
  franchiseCPRestante: number; // jours de franchise congés payés encore consommables
  // Report du forfait mensuel de franchise CP non consommé le mois précédent (2j ou 3j selon le
  // palier, cf. franceTravailConfig.differesEtFranchises.franchiseCongesPayes). Sans ce report,
  // un mois avec beaucoup de place disponible consommerait à tort plus que le quota mensuel
  // autorisé — corrigé le 2026-07-23 après une lecture initiale erronée des relevés réels
  // (cf. docs/reprise.md) qui avait fait conclure, à tort, à l'absence de tout plafond mensuel.
  quotaCPCarryOver: number;
  // Franchise salaires : jours restants à consommer — même modèle exact que franchiseCPRestante,
  // consommée APRÈS le délai d'attente ET la franchise CP (ordre confirmé par le guide officiel,
  // page 17). `0` si la franchise salaires totale n'a pas pu être calculée (`valeur: null`, cf.
  // FranchiseSalairesResultat) — pas d'application plutôt qu'un chiffre deviné (devoir n°2).
  franchiseSalairesRestante: number;
  // Report du quota mensuel de franchise salaires non consommé le mois précédent — même mécanique
  // que quotaCPCarryOver, cf. commentaire ci-dessus.
  quotaSalairesCarryOver: number;
}

export interface MoisIndemnisationEntree {
  moisLabel: string; // ex. "2026-02" — purement informatif (affichage, tests), aucun calcul de date dessus
  joursDuMois: number;
  // Heures effectivement travaillées ce mois-ci, tous contrats confondus — calculées depuis les
  // contrats réels via repartirContratParMois (engine/decoupageMensuel.ts), plus une saisie
  // manuelle de "jours déclarés" (remplacée le 2026-07-24, cf. docs/reprise.md : validé sur 3 mois
  // réels indépendants que jours_non_indemnisables = floor(heures × 1,3 / 10) directement).
  heuresDuMois: number;
}

// Franchise salaires (guide p.14, formule certifiée le 2026-07-23 — ARTCENA + flyer officiel
// France Travail). Deux issues possibles :
// - `valeur: null` : entrées manquantes (date de fin de PRA inconnue, ou SMIC mensuel/journalier
//   non trouvé à cette date dans l'historique) — jamais une formule devinée à partir de données
//   absentes (devoir sacré n°2).
// - `valeur: number` : calculée, mais avec deux réserves distinctes, toujours à afficher
//   ensemble : `totalNonVerifie` (toujours `true` pour l'instant — le TOTAL n'a jamais été
//   confronté à un relevé réel montrant une franchise salaires active, seule la répartition
//   mensuelle l'a été officiellement, cf. docs/reprise.md) et `sousEstimeeHorsA10` (`true` quand
//   `Profil.salairesHorsAnnexe10PRA` est absent : SR_total ne compte alors que les salaires
//   Annexe 10, potentiellement sous-estimé).
export type FranchiseSalairesResultat =
  | { valeur: null; avertissement: "franchise_salaires_non_certifiee" }
  | { valeur: number; totalNonVerifie: true; sousEstimeeHorsA10: boolean };

// Choisi une seule fois par l'utilisateur : à partir de quel mois le tableau mensuel devient
// visible (cf. RevenusMensuels.tsx). Ne porte plus aucun solde depuis le 2026-07-25 — l'état
// interne (délai d'attente, franchise CP restante) est désormais simulé automatiquement par le
// moteur depuis `Profil.ouvertureDroits`, jamais saisi ici (cf. engine/indemnisationMensuelle.ts,
// docs/reprise.md). `null` tant que l'utilisateur n'a pas encore configuré le module.
export interface SoldeIndemnisationDepart {
  dateDepart: string; // ISO
}

// Montant réellement versé pour un mois = joursIndemnises × AJ réelle applicable à ce mois-là
// (`getAjReelleAt`, cf. engine/ajReelleUtils.ts — plusieurs taux successifs possibles sur une
// même période d'indemnisation). `calculable: false` couvre à la fois une AJ jamais renseignée et
// un mois antérieur à toute entrée connue de l'historique — dans les deux cas Cadence ne peut pas
// recalculer l'AJ réelle elle-même (devoir n°2 : jamais un montant sur la base d'une AJ devinée).
export type MontantMensuelResultat = { calculable: false; raison: "aj_manquante" } | { calculable: true; montant: number; ajUtilisee: number; montantNet?: number };

export interface MoisIndemnisationResultat {
  calculable: true; // discriminant partagé avec MoisReadmissionNonCalcule, cf. LigneSerieIndemnisation
  moisLabel: string;
  heuresDuMois: number; // repasse l'entrée (calculée depuis les contrats) pour affichage, cf. RevenusMensuels.tsx
  joursNonIndemnisables: number; // Math.floor(heuresDuMois × coeffJoursNonIndemnisables / diviseurJoursTravaillesA10), première opération du réducteur
  delaiConsomme: number;
  franchiseCPConsommee: number;
  joursIndemnises: number; // reliquat du mois après non-indemnisable, délai, franchise CP
  soldeFin: SoldeIndemnisation; // à réinjecter comme soldeDepart du mois suivant
  franchiseSalaires: FranchiseSalairesResultat;
  montantMensuel: MontantMensuelResultat;
  // Somme des salaireBrut des contrats attribués à ce mois calendaire après repartirContratParMois.
  // Toujours >= 0. Inclut enseignement (Levallois etc.) et spectacle.
  salairesContratsBruts: number;
}

// Mois de réadmission (transition entre deux droits) : `ouvertureDroits.dateOuverture` ne tombe
// pas le 1er du mois calendaire, ce mois est donc partagé entre l'ancien et le nouveau droit.
// Cadence n'a structurellement pas accès à l'ancien droit — jamais simulé, jamais un chiffre
// deviné (devoir n°2), cf. engine/indemnisationMensuelle.ts (calculerSerieDepuisContrats).
export interface MoisReadmissionNonCalcule {
  calculable: false;
  type: "readmission";
  moisLabel: string; // ISO "YYYY-MM"
  messageTooltip: string;
  // Toujours 0 (jamais calculé pour ce mois) — présent uniquement pour que RevenusMensuels.tsx
  // puisse itérer sur un seul tableau sans garde-fou spécifique à ce champ, cf. LigneSerieIndemnisation.
  salairesContratsBruts: number;
}

// Une ligne de la série mensuelle affichée : soit un mois normalement calculé, soit un mois de
// réadmission non calculé — discriminées par `calculable`, cf. RevenusMensuels.tsx.
export type LigneSerieIndemnisation = MoisIndemnisationResultat | MoisReadmissionNonCalcule;

// Résultat de `calculerSerieDepuisContrats` : `calculable: false` quand `Profil.ouvertureDroits`
// est absent — la simulation entière est bloquée plutôt que de deviner un point de départ
// (devoir n°2), cf. RevenusMensuels.tsx.
export type SerieIndemnisationResultat = { calculable: false; raison: "ouverture_droits_manquante" } | { calculable: true; mois: LigneSerieIndemnisation[] };
