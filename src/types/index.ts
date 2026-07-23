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
  date: string; // ISO (date de fin de contrat)
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
  source?: "manuel" | "import_pdf"; // provenance ; un import PDF est revu avant validation
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
  | "seuil_readmission_non_calculable"; // réadmission : historique de contrats insuffisant pour ajuster le seuil

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
// a atteint le seuil), soit l'algorithme a épuisé ses tentatives sans jamais y arriver. Dans ce
// second cas, aucun seuil gonflé n'est présenté comme réel (devoir sacré n°2) : la cause la plus
// probable est un historique de contrats saisi pas assez loin dans le passé, ou l'absence de la
// date de la précédente ouverture de droits (qui bornerait correctement la recherche — ce champ
// n'existe pas encore dans le modèle Profil, cf. periodeReference.ts).
export type SeuilReadmission =
  | { calculable: true; tranchesReadmission: number; seuilHeuresAjuste: number }
  | { calculable: false; raison: "historique_insuffisant"; tranchesTentees: number };

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
