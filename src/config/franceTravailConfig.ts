import { z } from "zod";

/**
 * franceTravailConfig — TOUTES les constantes réglementaires du régime
 * Annexe 10 (musiciens classiques et assimilés) vivent ici, et nulle part
 * ailleurs. Aucune fonction du moteur (src/engine) ne doit contenir de
 * valeur numérique réglementaire en dur : elle doit toujours la lire ici.
 *
 * Source : Guide France Travail — Intermittents du spectacle, éd. mars 2026.
 *
 * Les valeurs marquées ✅ sont certifiées par le guide. Les valeurs
 * marquées 🔶 TODO sont volatiles (revalorisées régulièrement, ex. SMIC,
 * PMSS) : elles sont laissées à `null` tant qu'elles n'ont pas été
 * recopiées depuis la source officielle. Aucune valeur n'est devinée.
 */
export const franceTravailConfig = {
  meta: {
    version: "2026.06",
    dateEntreeVigueur: "2026-06-01",
    source:
      "Guide France Travail — Intermittents du spectacle, éd. mars 2026 (constantes du régime) ; arrêté du 22 mai 2026 (SMIC horaire brut) ; " +
      "Unédic, « Paramètres utiles » avril 2026 (plafond ARE annexes VIII/X, PMSS — vérifié le 03/08/2026)",
    avertissement:
      "Estimation indicative. Ne se substitue pas à une notification officielle de France Travail.",
    // Date déclarée jusqu'à laquelle ces règles sont réputées valides — PAS un seuil de durée
    // inventé (ex. "> 6 mois = périmé"), qui mentirait dans les deux sens. Reste `null` tant
    // qu'aucune date certaine n'est connue (aucune échéance officielle publiée à ce jour) :
    // même discipline que `valeursDatees` (non certain = null, jamais deviné).
    valableJusquau: null as string | null,
  },

  // ── Conditions d'affiliation ──────────────────────────────────
  seuilHeures: 507, // ✅
  periodeReferenceJours: 365, // ✅ 12 mois glissants (dernière FCT)
  ageLimiteIndemnisation: 67, // ✅
  heuresApresDemission: 455, // ✅ admission possible malgré démission

  // ── Décompte des heures ───────────────────────────────────────
  heuresParCachet: 12, // ✅
  plafondCachetsParMois: 28, // ✅ (Annexe 10)
  heuresParJourEEE: 6, // ✅ EEE/Suisse/UK, artistes
  heuresAssimileesParJour: 5, // ✅ maternité, adoption, AT, ALD, suspension

  // ── Heures d'enseignement (comptent pour 507 h, PAS pour le montant) ──
  enseignement: {
    plafondMoins50ans: 70, // ✅
    plafond50ansEtPlus: 120, // ✅
    plafondCumulEnseignementFormation: 338, // ✅ 2/3 de 507
  },
  formation: {
    plafond: 338, // ✅ formation non rémunérée, limite 2/3
    // Cumul enseignement + formation également plafonné à 338 h — cf. enseignement.plafondCumulEnseignementFormation
  },

  // ── Formule de l'AJ brute (Annexe 10) : AJ = A + B + C ────────
  are: {
    ajMinimale: 31.96, // ✅ depuis 01/07/2023
    plancherAnnexe10: 44, // ✅ AJ brute minimale
    // Valeur COURANTE, conservée pour la commodité d'affichage (ex. seuil de plausibilité de
    // MonProfil.tsx) : aucun calcul métier ne doit la lire. Le clamp de l'AJ brute passe par
    // `plafondHistorique` via `getPlafondAreAt` (engine/plafondAreUtils.ts) — cf. ci-dessous.
    plafond: 181.18, // ✅ Unédic « Paramètres utiles » avril 2026, p.23 — en vigueur depuis le 01/01/2026, vérifié sur pièce le 03/08/2026 (valeurs antérieures dans `plafondHistorique` ci-dessous)
    // Historique daté du plafond, sur le modèle de `valeursDatees.smicHoraireBrutHistorique` — même
    // raison d'être (devoir sacré n°2) : un calcul portant sur une FCT PASSÉE doit appliquer le
    // plafond en vigueur À CETTE DATE, jamais le plafond courant. Deux appelants exposés au cas :
    // `RenouvellementAnticipe.tsx` (FCT choisie librement, aucune borne min/max sur l'input date) et
    // `engine/cycles.ts` (reconstruit jusqu'à 10 cycles en arrière). Avant le 03/08/2026, `plafond`
    // était un scalaire unique et ces deux chemins appliquaient 181,18 € à des dates où le plafond
    // réel était 174,80 € — limite corrigée ici, cf. CLAUDE.md.
    // ⚠️ Contradiction de sources, non résolue (constatée le 03/08/2026) : le Guide France Travail
    // (éd. juillet 2026) et plusieurs pages cultureetspectacle.francetravail.fr affirment 174,80 €
    // comme plafond inchangé depuis 01/01/2024 — contradiction non résolue avec les valeurs Unédic
    // ci-dessous. Config alignée sur Unédic (organisme gestionnaire des paramètres), écart visible
    // uniquement à SR proche du plafond de la partie A (13 700 €) — cas extrême, même famille que
    // l'écart de formule à SR extrême déjà déprioritisé. Non résolu avec certitude à 100 %, contact
    // direct Unédic/France Travail nécessaire pour trancher définitivement.
    // TODO: valeur(s) antérieure(s) au 01/01/2024 inconnues — aucune source certifiée à ce jour
    // (éditions Unédic archivées remontées jusqu'à janvier 2024, rien de plus ancien en accès
    // libre). Tant qu'elles manquent, `getPlafondAreAt` retombe explicitement sur la plus ancienne
    // entrée connue pour toute date antérieure (repli documenté, jamais une extrapolation).
    plafondHistorique: [
      // ✅ Unédic « Paramètres utiles » janvier 2024, p.22 — « Maximum théorique du 1er janvier au
      // 31 décembre 2024 » = 174,80 €. Date d'effet confirmée sur pièce le 03/08/2026.
      { dateEffet: "2024-01-01", valeur: 174.8 },
      // ✅ Unédic « Paramètres utiles » janvier 2025 ET juillet 2025, p.23 — valeur identique dans
      // les deux éditions (stable toute l'année malgré la revalorisation de juillet, qui ne touche
      // que l'allocation minimale / partie fixe).
      { dateEffet: "2025-01-01", valeur: 177.56 },
      { dateEffet: "2026-01-01", valeur: 181.18 }, // ✅ Unédic « Paramètres utiles » avril 2026, p.23, vérifié sur pièce le 03/08/2026
    ] as { dateEffet: string; valeur: number }[],
    partieA: { seuilSR: 13700, coeffSousSeuil: 0.36, coeffAuDelaSeuil: 0.05, diviseur: 5000 }, // ✅
    partieB: { seuilNHT: 690, coeffSousSeuil: 0.26, coeffAuDelaSeuil: 0.08, diviseur: 507 }, // ✅
    partieC: { coeff: 0.7 }, // ✅ AJ minimale × 0,70 (Annexe 10)
  },

  // ── Cotisations sur l'AJ (pour l'AJ nette) ────────────────────
  // Terminologie France Travail vs Cadence :
  //   "Allocation brute" FT  = sortie de la formule AJ (A+B+C) ci-dessus, ex. 55,02 €/j.
  //   "Montant net social" FT = AJ brute − retraite complémentaire, ex. 53,81 €/j.
  //   Cadence appelle ce montant "AJ nette avant PAS" — c'est la même valeur.
  //   Écart ~2,2 % (pas 5 %) — validé à l'euro près sur fév–juin 2026.
  cotisations: {
    seuilExoneration: 31.96, // ✅ AJ brute < ce seuil : aucune cotisation
    seuilRetraiteCompl: 60, // ✅ 31,96 < AJ ≤ 60 : retraite compl. seule
    tauxRetraiteComplementaire: 0.0093, // ✅ 0,93 % du SJM
    tauxCSG: { normal: 0.062, reduit: 0.038 }, // ✅ selon barème d'imposition
    tauxCRDS: 0.005, // ✅
    tauxAlsaceMoselle: 0.015, // ✅ régime local
    diviseurSJM_Annexe10: 10, // ✅ SJM = SR / (NHTM / 10)
    tauxAssietteCSGCRDS: 0.9825, // ✅ abattement de 1,75 % sur l'allocation après retraite — cf. docs/validation.md, cas #2/#3
    plancherEcretementJournalier: 62.0, // ✅ simulateur officiel FT (docs/validation.md, cas #2/#3) — distinct de valeursDatees.smicJournalierBrut (réservé à la franchise salaires, valeur/usage potentiellement différents)
  },

  // ── Réadmission & clause de rattrapage ────────────────────────
  readmission: {
    affiliationMajoreeParPeriode: 42, // ✅ h suppl. par tranche…
    tranchePeriodeJours: 30, // ✅ …de 30 j au-delà du 365e
    // En période allongée : diviseur A = NH × SMIC horaire ; diviseur B = NH.
    clauseRattrapage: {
      dureeMois: 6, // ✅
      seuilBas: 338,
      seuilHaut: 506, // ✅ éligibilité entre 338 et 506 h
      ancienneteAnnees: 5, // ✅
      ancienneteHeures: 2535, // ✅ 5 × 507 h
      affiliation12mois: 338, // ✅ 338 h dans les 12 mois précédents
      delaiDemandeJours: 30, // ✅
    },
  },

  // ── Différés & franchises (module « indemnisation mensuelle », V2) ──
  differesEtFranchises: {
    delaiAttenteJours: 7, // ✅ une fois par période de 12 mois
    // ✅ Forme numérique explicite de la même règle que ci-dessus ("une fois par période de 12
    // mois") — jusqu'ici seulement en commentaire, jamais câblée dans le moteur. Sert à décider si
    // le délai d'attente se réapplique lors d'un renouvellement anticipé (cf.
    // engine/renouvellementAnticipe.ts, delaiSeReapplique) : distincte de `periodeReferenceJours`
    // (durée d'affiliation) bien que numériquement égale aujourd'hui — deux règles légales
    // différentes qui pourraient diverger un jour, jamais partagées par appel à la même constante.
    delaiAttentePeriodeReapplicationJours: 365,
    differeSpecifiquePlafondJours: 75, // ✅ (rarement applicable aux CDDU)
    franchiseCongesPayes: {
      tauxAcquisition: 2.5,
      base: 24, // ✅ (jours travaillés × 2,5) / 24
      plafondJours: 30, // ✅
      // ✅ Réactivés (2026-07-23) : la lecture initiale de Phase 1 ("pas de plafond mensuel
      // constaté sur les relevés réels") était fausse — le 4j consommé en février 2026 s'explique
      // entièrement par le report du forfait de janvier (2j non consommés, absorbés par le délai
      // d'attente ce mois-là) + le forfait de février (2j) = 4j, pas par l'absence de plafond.
      // Modèle correct : quota mensuel = report du mois précédent + forfait, cf.
      // engine/indemnisationMensuelle.ts (SoldeIndemnisation.quotaCPCarryOver), docs/reprise.md.
      forfaitMensuelBas: 2, // ✅ si franchise totale ≤ seuilFranchiseTotaleJours
      forfaitMensuelHaut: 3, // ✅ si franchise totale > seuilFranchiseTotaleJours
      seuilFranchiseTotaleJours: 24, // ✅ palier bas/haut du forfait mensuel
    },
    franchiseSalaires: {
      repartitionMoisMax: 8, // ✅ répartie sur 8 mois max
      // Formule transcrite dans engine/indemnisationMensuelle.ts
      // calculerFranchiseSalaires — source : guide FT mars 2026 p.14
    },
  },

  // ── Indemnisation mensuelle & cumul (module V2) ───────────────
  indemnisationMensuelle: {
    seuilNonIndemnisationJours: 27, // ✅ (Annexe 10)
    coeffJoursNonIndemnisables: 1.3, // ✅ jours travaillés × 1,3
    diviseurJoursTravaillesA10: 10, // ✅ heures mensuelles / 10
    plafondCumulCoeffPMSS: 1.18, // ✅ ARE + salaires ≤ 118 % du PMSS
  },

  // ── Estimation paie GUSO (brut → net cachets) ─────────────────
  guso: {
    tauxNetApproxSurBrut: 0.77, // ⚠️ APPROXIMATION, pas un taux réglementaire unique — varie
    // selon convention collective et statut cadre/non-cadre. Source : agrégation de simulateurs
    // spécialisés (compta-online.com, taux URSSAF officiels, mise à jour 25/03/2026 : cotisation
    // chômage salariale intermittents 2,4 % non abattue + maladie/vieillesse/AT/allocations
    // familiales/FNAL au taux de droit commun après abattement de 30 % + CSG/CRDS ~9,7 % sans
    // abattement), pas un texte officiel unique. Seul le simulateur GUSO officiel
    // (www.guso.fr) donne le montant exact.
    dateVerification: "2026-07-26",
  },

  // ── Frais professionnels réels (module « Frais réels ») ───────
  // Source : document SNAM-CGT « Frais professionnels » (mars 2026), cf. docs/spec_frais_reels_cadence.md.
  fraisReels: {
    plafondBaseR2025: 145_550, // ✅ plafond de R (base des forfaits 14 %/5 %), 2025
    tauxForfaitA: 0.14, // ✅ forfait 14 % (instruments, matériel, formation chorégraphique/lyrique...)
    tauxForfaitB: 0.05, // ✅ forfait 5 % (vestimentaire, représentation, communications...)
    tauxForfait10: 0.1, // ✅ abattement forfaitaire standard, tous salariés (comparaison)
    plancher10Pct2025: 495, // ✅ minimum de l'abattement 10 %, 2025
    plafond10Pct2025: 14_171, // ✅ maximum de l'abattement 10 %, 2025
    valeurRepasPersonnel2025: 5.45, // ✅ valeur forfaitaire d'un repas au domicile (C3), 2025
    // Amortissement linéaire (C7) — cf. engine/fraisReels/calculerAmortissement.ts. Durées
    // indicatives par nature de bien (proposées à l'UI, jamais devinées par le moteur qui reçoit
    // toujours dureeAns explicitement de l'appelant).
    amortissements: {
      dureesParDefaut: {
        informatique: 3, // ✅ BOFIP BOI-RSA-BASE-30-50-30-20170621
        sonorisation_electronique: 5, // ✅
        instrument: 5, // 🔶 cas d'espèce — durée à valider avec le fisc
        mobilier_bureau: 10, // ✅
        autre_outillage: 5, // ✅
      },
      seuilAmortissementHT: 500, // ✅ en dessous : déduction intégrale, pas d'amortissement
    },
    // Barème kilométrique (C1/C2) — cf. engine/fraisReels/calculerFraisKilometriques.ts. Source
    // DGFiP, barème revenus 2025 (déclaration 2026), inchangé depuis 2023. Lignes ordonnées par
    // cvMax croissant (99 = "7 CV et plus", plafond conventionnel) ; tranches ordonnées par kmMax
    // croissant (null = dernière tranche, sans plafond). coefficients[i]/fixes[i] = tranche i.
    baremesKilometriques: {
      // Cast au niveau du tableau (pas de l'élément) : sous le `as const` englobant toute la
      // config, un tableau littéral devient un tuple `readonly`, incompatible avec le type mutable
      // `number[]`/`{...}[]` attendu par FranceTravailConfig (inféré depuis le schéma Zod ci-dessous,
      // lu par le moteur) — même pattern que valeursDatees.smicHoraireBrutHistorique plus bas.
      voiture: {
        tranches: [
          { kmMax: 5000 }, // tranche 0 : montant = d × coeff
          { kmMax: 20000 }, // tranche 1 : montant = (d × coeff) + fixe
          { kmMax: null }, // tranche 2 : montant = d × coeff
        ] as { kmMax: number | null }[],
        lignes: [
          { cvMax: 3, coefficients: [0.529, 0.316, 0.37], fixes: [0, 1065, 0] }, // ✅
          { cvMax: 4, coefficients: [0.606, 0.34, 0.407], fixes: [0, 1330, 0] }, // ✅
          { cvMax: 5, coefficients: [0.636, 0.357, 0.427], fixes: [0, 1395, 0] }, // ✅
          { cvMax: 6, coefficients: [0.665, 0.374, 0.447], fixes: [0, 1457, 0] }, // ✅
          { cvMax: 99, coefficients: [0.697, 0.394, 0.47], fixes: [0, 1515, 0] }, // ✅ 7 CV et plus
        ] as { cvMax: number; coefficients: number[]; fixes: number[] }[],
        majorationElectrique: 0.2, // ✅ majoration forfaitaire véhicule 100 % électrique
      },
      moto: {
        tranches: [{ kmMax: 3000 }, { kmMax: 6000 }, { kmMax: null }] as { kmMax: number | null }[],
        lignes: [
          { cvMax: 2, coefficients: [0.395, 0.099, 0.248], fixes: [0, 891, 0] }, // ✅
          { cvMax: 5, coefficients: [0.468, 0.082, 0.275], fixes: [0, 1158, 0] }, // ✅
          { cvMax: 99, coefficients: [0.606, 0.079, 0.343], fixes: [0, 1583, 0] }, // ✅
        ] as { cvMax: number; coefficients: number[]; fixes: number[] }[],
      },
      cyclomoteur: {
        // Pas de puissance fiscale (cylindrée ≤ 50 cm³) : un seul jeu de coefficients/fixes.
        tranches: [{ kmMax: 3000 }, { kmMax: 6000 }, { kmMax: null }] as { kmMax: number | null }[],
        coefficients: [0.315, 0.079, 0.198] as number[], // ✅
        fixes: [0, 711, 0] as number[], // ✅
      },
      plafondC1AllerKm: 40, // ✅ Q3 — plafond domicile↔travail (km aller simple)
    },
  },

  // ── Valeurs volatiles à renseigner (revalorisées régulièrement) ──
  valeursDatees: {
    smicHoraireBrut: 12.31 as number | null, // ✅ arrêté du 22 mai 2026, en vigueur au 01/06/2026 (ancienne valeur : 12,02 € au 01/01/2026)
    smicMensuelBrut: 1867.02 as number | null, // ✅ arrêté du 22 mai 2026, en vigueur au 01/06/2026 (ancienne valeur : 1823,03 € au 01/01/2026)
    // 🔶 Non certifié : dérivé de smicHoraireBrut × 7 — à confirmer depuis une source officielle
    // (utilisé pour la franchise salaires, cf. engine/indemnisationMensuelle.ts, docs/reprise.md).
    smicJournalierBrut: 86.17 as number | null,
    pmssMensuel: 4005 as number | null, // ✅ Unédic « Paramètres utiles » avril 2026, p.3 — en vigueur du 01/01/2026 au 31/12/2026, vérifié sur pièce le 03/08/2026. Toujours non lu par le moteur (plafond de cumul, module V2 non construit, cf. SPEC.md §11.B).
    // Historiques datés, réservés au module indemnisation mensuelle (V2) — distincts des valeurs
    // courantes ci-dessus (lues telles quelles par areBrute.ts pour la réadmission allongée ; ne
    // PAS y toucher, cf. docs/reprise.md). La franchise salaires exige le SMIC à la date de fin de
    // PRA, potentiellement une date passée : une valeur courante unique donnerait un résultat faux
    // sur toute PRA antérieure à la dernière revalorisation (devoir sacré n°2).
    smicHoraireBrutHistorique: [
      { dateEffet: "2026-01-01", valeur: 12.02 }, // ✅ info.gouv.fr
      { dateEffet: "2026-06-01", valeur: 12.31 }, // ✅ arrêté du 22 mai 2026
    ] as { dateEffet: string; valeur: number }[],
    smicMensuelBrutHistorique: [
      { dateEffet: "2026-01-01", valeur: 1823.03 }, // ✅ info.gouv.fr
      { dateEffet: "2026-06-01", valeur: 1867.02 }, // ✅ arrêté du 22 mai 2026
    ] as { dateEffet: string; valeur: number }[],
    // 🔶 Non certifiés : dérivés de smicHoraireBrutHistorique × 7 — mêmes réserves que
    // smicJournalierBrut ci-dessus, à confirmer depuis une source officielle.
    smicJournalierBrutHistorique: [
      { dateEffet: "2026-01-01", valeur: 84.14 },
      { dateEffet: "2026-06-01", valeur: 86.17 },
    ] as { dateEffet: string; valeur: number }[],
  },
} as const;

// ── Schéma de validation Zod ─────────────────────────────────────
// Garantit qu'une modification de la config reste structurellement valide
// (types, présence des champs) avant même d'être utilisée par le moteur.
const nullableNumber = z.number().nullable();

export const franceTravailConfigSchema = z.object({
  meta: z.object({
    version: z.string(),
    dateEntreeVigueur: z.string(),
    source: z.string(),
    avertissement: z.string(),
    valableJusquau: z.string().nullable(),
  }),
  seuilHeures: z.number().positive(),
  periodeReferenceJours: z.number().positive(),
  ageLimiteIndemnisation: z.number().positive(),
  heuresApresDemission: z.number().positive(),
  heuresParCachet: z.number().positive(),
  plafondCachetsParMois: z.number().positive(),
  heuresParJourEEE: z.number().positive(),
  heuresAssimileesParJour: z.number().positive(),
  enseignement: z.object({
    plafondMoins50ans: z.number().positive(),
    plafond50ansEtPlus: z.number().positive(),
    plafondCumulEnseignementFormation: z.number().positive(),
  }),
  formation: z.object({
    plafond: z.number().positive(),
  }),
  are: z.object({
    ajMinimale: z.number().positive(),
    plancherAnnexe10: z.number().positive(),
    plafond: z.number().positive(),
    // `.min(1)` : un historique vide ferait échouer le calcul à l'exécution (getPlafondAreAt n'a
    // alors AUCUNE valeur sur laquelle se replier) — mieux vaut casser au chargement du module.
    plafondHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number().positive() })).min(1),
    partieA: z.object({
      seuilSR: z.number().positive(),
      coeffSousSeuil: z.number(),
      coeffAuDelaSeuil: z.number(),
      diviseur: z.number().positive(),
    }),
    partieB: z.object({
      seuilNHT: z.number().positive(),
      coeffSousSeuil: z.number(),
      coeffAuDelaSeuil: z.number(),
      diviseur: z.number().positive(),
    }),
    partieC: z.object({ coeff: z.number() }),
  }),
  cotisations: z.object({
    seuilExoneration: z.number(),
    seuilRetraiteCompl: z.number(),
    tauxRetraiteComplementaire: z.number(),
    tauxCSG: z.object({ normal: z.number(), reduit: z.number() }),
    tauxCRDS: z.number(),
    tauxAlsaceMoselle: z.number(),
    diviseurSJM_Annexe10: z.number().positive(),
    tauxAssietteCSGCRDS: z.number().positive(),
    plancherEcretementJournalier: z.number().positive(),
  }),
  readmission: z.object({
    affiliationMajoreeParPeriode: z.number().positive(),
    tranchePeriodeJours: z.number().positive(),
    clauseRattrapage: z.object({
      dureeMois: z.number().positive(),
      seuilBas: z.number(),
      seuilHaut: z.number(),
      ancienneteAnnees: z.number(),
      ancienneteHeures: z.number(),
      affiliation12mois: z.number(),
      delaiDemandeJours: z.number(),
    }),
  }),
  guso: z.object({
    tauxNetApproxSurBrut: z.number().positive(),
    dateVerification: z.string(),
  }),
  fraisReels: z.object({
    plafondBaseR2025: z.number().positive(),
    tauxForfaitA: z.number().positive(),
    tauxForfaitB: z.number().positive(),
    tauxForfait10: z.number().positive(),
    plancher10Pct2025: z.number().positive(),
    plafond10Pct2025: z.number().positive(),
    valeurRepasPersonnel2025: z.number().positive(),
    amortissements: z.object({
      dureesParDefaut: z.object({
        informatique: z.number().positive(),
        sonorisation_electronique: z.number().positive(),
        instrument: z.number().positive(),
        mobilier_bureau: z.number().positive(),
        autre_outillage: z.number().positive(),
      }),
      seuilAmortissementHT: z.number().positive(),
    }),
    baremesKilometriques: z.object({
      voiture: z.object({
        tranches: z.array(z.object({ kmMax: z.number().positive().nullable() })),
        lignes: z.array(z.object({ cvMax: z.number().positive(), coefficients: z.array(z.number().positive()), fixes: z.array(z.number()) })),
        majorationElectrique: z.number().positive(),
      }),
      moto: z.object({
        tranches: z.array(z.object({ kmMax: z.number().positive().nullable() })),
        lignes: z.array(z.object({ cvMax: z.number().positive(), coefficients: z.array(z.number().positive()), fixes: z.array(z.number()) })),
      }),
      cyclomoteur: z.object({
        tranches: z.array(z.object({ kmMax: z.number().positive().nullable() })),
        coefficients: z.array(z.number().positive()),
        fixes: z.array(z.number()),
      }),
      plafondC1AllerKm: z.number().positive(),
    }),
  }),
  differesEtFranchises: z.object({
    delaiAttenteJours: z.number(),
    delaiAttentePeriodeReapplicationJours: z.number(),
    differeSpecifiquePlafondJours: z.number(),
    franchiseCongesPayes: z.object({
      tauxAcquisition: z.number(),
      base: z.number(),
      plafondJours: z.number(),
      forfaitMensuelBas: z.number(),
      forfaitMensuelHaut: z.number(),
      seuilFranchiseTotaleJours: z.number(),
    }),
    franchiseSalaires: z.object({
      repartitionMoisMax: z.number(),
    }),
  }),
  indemnisationMensuelle: z.object({
    seuilNonIndemnisationJours: z.number(),
    coeffJoursNonIndemnisables: z.number(),
    diviseurJoursTravaillesA10: z.number(),
    plafondCumulCoeffPMSS: z.number(),
  }),
  valeursDatees: z.object({
    smicHoraireBrut: nullableNumber,
    smicMensuelBrut: nullableNumber,
    smicJournalierBrut: nullableNumber,
    pmssMensuel: nullableNumber,
    smicHoraireBrutHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number() })),
    smicMensuelBrutHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number() })),
    smicJournalierBrutHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number() })),
  }),
});

export type FranceTravailConfig = z.infer<typeof franceTravailConfigSchema>;

// Valide la config au chargement du module : une erreur de structure
// (ex. régression lors d'une mise à jour annuelle) casse au démarrage
// plutôt que de produire un calcul silencieusement faux.
franceTravailConfigSchema.parse(franceTravailConfig);

/** Nombre de jours écoulés depuis la dernière mise à jour de la config — purement informatif (bandeau "règles vérifiées au…"), jamais un jugement de péremption. */
export function joursDepuisMiseAJourConfig(dateDuJour: Date): number {
  const entreeVigueur = new Date(franceTravailConfig.meta.dateEntreeVigueur);
  const diffMs = dateDuJour.getTime() - entreeVigueur.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Les règles sont-elles réputées périmées ? Compare `valableJusquau` (un
 * FAIT déclaré en config, jamais un seuil de durée deviné) à `dateDuJour`,
 * passée en paramètre — jamais `new Date()` interne, pour rester testable.
 * `null` (rien de déclaré) ou date future -> pas périmé : on ne porte aucun
 * jugement sans base déclarée.
 */
export function estPerime(dateDuJour: Date, valableJusquau: string | null): boolean {
  if (!valableJusquau) return false;
  return dateDuJour.getTime() > new Date(valableJusquau).getTime();
}
