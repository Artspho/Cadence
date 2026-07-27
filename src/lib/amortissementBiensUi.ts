// Aide purement présentationnelle pour l'amortissement multi-années des biens > seuil (C7, cf.
// spec §7). Aucune règle de calcul ni valeur réglementaire ici : le seuil vient de `ftConfig`, les
// annuités/années de fin/restes à amortir viennent de calculerAmortissementsAnnee (moteur déjà
// validé, cf. engine/fraisReels/calculerAmortissementsAnnee.ts) — ce module ne fait que dériver
// des libellés d'affichage et assembler le résultat pour l'export PDF.
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import type { BienAmorti, CategorieBienAmorti } from "../types/fraisReels";
import { calculerAmortissementsAnnee, type RetourCalculerAmortissementsAnnee } from "../engine/fraisReels/calculerAmortissementsAnnee";

export const LIBELLE_CATEGORIE_BIEN: Record<CategorieBienAmorti, string> = {
  informatique: "Informatique",
  sonorisation_electronique: "Sonorisation / électronique",
  instrument: "Instrument",
  mobilier_bureau: "Mobilier de bureau",
  autre_outillage: "Autre outillage",
};

export const CATEGORIES_BIEN_ORDONNEES: CategorieBienAmorti[] = ["instrument", "informatique", "sonorisation_electronique", "mobilier_bureau", "autre_outillage"];

// Texte fixe d'avertissement — présentation, pas une constante de calcul : la durée d'amortissement
// n'est PAS fixée par la loi (SNAM-CGT §7, « se rapprocher des services fiscaux au cas par cas »),
// d'où un champ libre côté UI et ce rappel permanent, jamais une durée imposée par Cadence.
export const MENTION_DUREE_A_VALIDER = "Durée à déterminer au cas par cas — rapproche-toi de ton comptable ou des services fiscaux avant de valider.";

/**
 * Au-delà du seuil (lu depuis `ftConfig`, jamais en dur), la déduction en une fois est impossible :
 * le bien DOIT être amorti. En-deçà, les deux options restent ouvertes (déduction immédiate en C7,
 * ou amortissement si l'utilisateur préfère lisser).
 */
export function depasseSeuilAmortissement(prixHT: number, ftConfig: FranceTravailConfig): boolean {
  return prixHT > ftConfig.fraisReels.amortissements.seuilAmortissementHT;
}

export type ModeDeduction = "amortissement_obligatoire" | "choix_possible";

export function modeDeduction(prixHT: number, ftConfig: FranceTravailConfig): ModeDeduction {
  return depasseSeuilAmortissement(prixHT, ftConfig) ? "amortissement_obligatoire" : "choix_possible";
}

export interface AlerteContinuation {
  bien: BienAmorti;
  anneeFin: number;
  resteAAmortir: number;
}

/**
 * Biens qui généreront encore une annuité après l'année d'imposition affichée — pour que
 * l'utilisateur pense à les reporter les années suivantes. Basé sur le `resteAAmortir` retourné
 * par le moteur : un bien intégralement amorti (reste 0, typiquement sa dernière année) ne doit
 * PAS déclencher l'alerte, même s'il est encore « en cours » cette année-là.
 */
export function alertesContinuation(retour: RetourCalculerAmortissementsAnnee): AlerteContinuation[] {
  return retour.detail
    .filter((d) => !d.resultat.horsScope && d.resultat.resteAAmortir > 0)
    .map((d) => ({ bien: d.bien, anneeFin: d.resultat.anneeFin, resteAAmortir: d.resultat.resteAAmortir }));
}

/**
 * Construit `dossier.amortissements` (cf. exportPdfFraisReels.ts) pour l'année d'imposition
 * demandée. Aucun bien enregistré = section absente du dossier (`undefined`), jamais un retour à
 * zéro — même pattern que `construireFraisKmDossier` (cf. fraisKilometriquesUi.ts).
 */
export function construireAmortissementsDossier(biens: BienAmorti[], anneeImposition: number, ftConfig: FranceTravailConfig): RetourCalculerAmortissementsAnnee | undefined {
  if (biens.length === 0) return undefined;
  return calculerAmortissementsAnnee(biens, anneeImposition, ftConfig);
}
