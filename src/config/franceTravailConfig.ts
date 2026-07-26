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
    source: "Guide France Travail — Intermittents du spectacle, éd. mars 2026 (constantes du régime) ; arrêté du 22 mai 2026 (SMIC horaire brut)",
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
    plafond: 174.8, // ✅ depuis 01/01/2024
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

  // ── Valeurs volatiles à renseigner (revalorisées régulièrement) ──
  valeursDatees: {
    smicHoraireBrut: 12.31 as number | null, // ✅ arrêté du 22 mai 2026, en vigueur au 01/06/2026 (ancienne valeur : 12,02 € au 01/01/2026)
    smicMensuelBrut: 1867.02 as number | null, // ✅ arrêté du 22 mai 2026, en vigueur au 01/06/2026 (ancienne valeur : 1823,03 € au 01/01/2026)
    // 🔶 Non certifié : dérivé de smicHoraireBrut × 7 — à confirmer depuis une source officielle
    // (utilisé pour la franchise salaires, cf. engine/indemnisationMensuelle.ts, docs/reprise.md).
    smicJournalierBrut: 86.17 as number | null,
    pmssMensuel: null as number | null, // 🔶 TODO (plafond de cumul)
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
  differesEtFranchises: z.object({
    delaiAttenteJours: z.number(),
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
