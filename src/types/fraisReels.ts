// ── Module Frais réels ──────────────────────────────────────────
// Source de vérité réglementaire : document SNAM-CGT « Frais professionnels » (mars 2026), cf.
// docs/spec_frais_reels_cadence.md. Toutes les constantes chiffrées vivent dans
// franceTravailConfig.ts (config.fraisReels) — jamais en dur ici ni dans engine/fraisReels.ts.

export type CategorieFrais = "A" | "B" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "D";
export type StatutJustificatif = "fourni" | "manquant" | "non_requis";
export type ModeForfait = "forfait" | "reel"; // par rubrique, A et B uniquement

export interface Depense {
  id: string;
  anneeFiscale: number; // 2025, 2026...
  date: string; // ISO — date du ticket/facture (date voyage pour SNCF)
  categorie: CategorieFrais;
  description: string; // libellé libre
  montantTotal: number; // TTC payé
  remboursementEmployeur: number; // à déduire (défaut 0)
  partPro: number; // % usage pro (défaut 1.0 = 100%) — sert aussi au pro-rata surface (C6, cf. spec §4)
  montantDeductible: number; // calculé : (montantTotal - remboursementEmployeur) × partPro
  statutJustificatif: StatutJustificatif;
  justificatifNom?: string; // nom du fichier uploadé
  // Stockage localStorage (mode défaut) :
  justificatifData?: string; // base64
  // Stockage Google Drive (mode optionnel, chantier séparé) — exclusif de justificatifData :
  driveFileId?: string;
  driveWebViewLink?: string;
  notes?: string;
}

// R (base des forfaits A/B, cf. spec §3) = somme des 4 champs ci-dessous, plafonnée à
// config.fraisReels.plafondBaseR2025. `salaireNetImposable` est par convention déjà la portion
// artistique seule (jamais mélangée à un salaire d'enseignement) — cf. calculerBaseR,
// engine/fraisReels.ts : R ne varie pas selon ProfilFiscalFraisReels, qui ne gouverne que
// l'éligibilité aux forfaits A/B (calculerFraisReels), décision actée avec l'utilisateur le
// 2026-07-26 (le modèle de données n'a qu'un seul champ de salaire, pas de split artistique/
// enseignement séparé).
export interface RevenuImposableArtistique {
  anneeFiscale: number;
  salaireNetImposable: number; // salaires nets imposables activité artistique
  allocationsAre: number; // ARE — peut être pré-rempli depuis l'onglet indemnisation
  congesSpectacles: number;
  indemnitesJournalieres: number; // maladie / maternité
}

export type ProfilFiscalFraisReels =
  | "artiste_exclusif" // 14%+5% sur tout
  | "artiste_enseignant_majoritaire" // 14%+5% sur artistique + enseignement
  | "artiste_enseignant_accessoire" // 14%+5% sur artistique seulement
  | "enseignant_pur"; // pas de forfaits A/B, C/D seulement

export interface ConfigFraisReels {
  anneeFiscale: number;
  profilFiscal: ProfilFiscalFraisReels;
  revenu: RevenuImposableArtistique;
  modeA: ModeForfait; // 'forfait' = 14% de R, 'reel' = somme des dépenses catégorie A
  modeB: ModeForfait; // 'forfait' = 5% de R, 'reel' = somme des dépenses catégorie B
  // C6 : réservé à l'UI (étape 2, pré-remplissage suggéré de `partPro` à la création d'une dépense
  // C6) — le moteur n'en a pas besoin, `Depense.partPro` (générique, déjà utilisé par C7) porte
  // déjà le pourcentage retenu pour chaque dépense, décision actée avec l'utilisateur le 2026-07-26.
  localPro?: {
    surfaceTotalM2: number;
    surfaceProM2: number;
  };
  // C3 : si renseigné (> 0), remplace entièrement les dépenses catégorie C3 individuellement
  // saisies dans le calcul du total (exclusif, pas cumulatif) — cf. engine/fraisReels.ts,
  // décision actée avec l'utilisateur le 2026-07-26 : « sans justificatifs suffisamment précis »
  // est une ALTERNATIVE aux dépenses réelles, pas un ajout.
  nombreRepasC3?: number;
}

export type RecommandationFraisReels = "frais_reels" | "forfait_10" | "identique";

export interface ResultatFraisReels {
  baseR: number;
  montantA: number;
  montantB: number;
  montantC: Record<string, number>; // clé = CategorieFrais parmi C1..C9, D (A et B exclus, déjà séparés)
  totalFraisReels: number; // montantA + montantB + Σ montantC
  forfait10Pct: number; // 10% × baseR, borné [plancher10Pct2025, plafond10Pct2025]
  avantage: number; // totalFraisReels - forfait10Pct (positif = frais réels gagnant)
  recommandation: RecommandationFraisReels;
  // Dépenses groupées par catégorie (toutes, y compris A/B) — nécessaire à genererTexteDeclaration
  // pour lister les libellés individuels par rubrique (cf. spec §8), sans que la fonction ait
  // besoin de recevoir `depenses` séparément (décision actée avec l'utilisateur le 2026-07-26).
  depensesParCategorie: Record<string, Depense[]>;
}
