// Moteur pur du module Frais réels — zéro React, aucune constante réglementaire en dur (tout lu
// depuis config.fraisReels, franceTravailConfig.ts). Source de vérité réglementaire : document
// SNAM-CGT « Frais professionnels » (mars 2026), cf. docs/spec_frais_reels_cadence.md.
import type { CategorieFrais, ConfigFraisReels, Depense, ProfilFiscalFraisReels, ResultatFraisReels, RevenuImposableArtistique } from "../types/fraisReels";
import type { FranceTravailConfig } from "../config/franceTravailConfig";

const arrondi = (valeur: number): number => Math.round(valeur * 100) / 100;

/**
 * R (cf. spec §3) = somme des 4 revenus, plafonnée à `config.fraisReels.plafondBaseR2025`. Ne varie
 * PAS selon `profil` — décision actée avec l'utilisateur le 2026-07-26 : `profilFiscal` ne gouverne
 * que l'éligibilité aux forfaits A/B (cf. `calculerFraisReels` ci-dessous), jamais la valeur de R
 * elle-même. Le paramètre est conservé (signature de la spec) pour un usage futur éventuel, mais
 * n'est lu par aucun calcul ici.
 */
export function calculerBaseR(revenu: RevenuImposableArtistique, profil: ProfilFiscalFraisReels, config: FranceTravailConfig): number {
  void profil;
  const somme = revenu.salaireNetImposable + revenu.allocationsAre + revenu.congesSpectacles + revenu.indemnitesJournalieres;
  return Math.min(somme, config.fraisReels.plafondBaseR2025);
}

// Montant réellement déductible d'une dépense — toujours recalculé depuis les champs source
// (jamais un `depense.montantDeductible` pré-calculé qui pourrait être périmé), même logique que
// le reste du moteur Cadence (aucune valeur dérivée ne fait foi, seule la source compte).
function montantDeductible(depense: Depense): number {
  return (depense.montantTotal - depense.remboursementEmployeur) * depense.partPro;
}

const CATEGORIES_C_ET_D: CategorieFrais[] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "D"];

/**
 * Calcule le total des frais réels déclarables et compare au forfait 10 % (abattement standard,
 * tous salariés). `profilFiscal === "enseignant_pur"` désactive entièrement A et B (cf. spec §2,
 * aucune activité artistique = aucun droit aux forfaits 14 %/5 %) ; les 3 autres profils y ont
 * droit intégralement (R ne varie pas selon le profil, cf. `calculerBaseR`).
 *
 * C3 (repas, cf. spec §4) : `config.nombreRepasC3`, si renseigné (> 0), REMPLACE entièrement les
 * dépenses catégorie C3 individuellement saisies (exclusif, pas cumulatif) — décision actée avec
 * l'utilisateur le 2026-07-26, cohérente avec « sans justificatifs suffisamment précis » comme
 * ALTERNATIVE au réel, pas un ajout.
 *
 * C6 (local pro) : aucun traitement spécifique ici — `config.localPro` est réservé à l'UI (étape 2,
 * pré-remplissage suggéré de `Depense.partPro` à la création d'une dépense C6). Le moteur applique
 * la même formule générique (`montantDeductible`) à toutes les catégories, C6 comme les autres.
 */
export function calculerFraisReels(depenses: Depense[], config: ConfigFraisReels, ftConfig: FranceTravailConfig): ResultatFraisReels {
  const baseR = calculerBaseR(config.revenu, config.profilFiscal, ftConfig);

  const depensesParCategorie: Record<string, Depense[]> = {};
  for (const d of depenses) {
    (depensesParCategorie[d.categorie] ??= []).push(d);
  }

  const sommeCategorie = (categorie: CategorieFrais): number => (depensesParCategorie[categorie] ?? []).reduce((total, d) => total + montantDeductible(d), 0);

  const forfaitsDesactives = config.profilFiscal === "enseignant_pur";

  const montantA = forfaitsDesactives ? 0 : config.modeA === "forfait" ? arrondi(ftConfig.fraisReels.tauxForfaitA * baseR) : arrondi(sommeCategorie("A"));

  const montantB = forfaitsDesactives ? 0 : config.modeB === "forfait" ? arrondi(ftConfig.fraisReels.tauxForfaitB * baseR) : arrondi(sommeCategorie("B"));

  const montantC: Record<string, number> = {};
  for (const categorie of CATEGORIES_C_ET_D) {
    if (categorie === "C3" && config.nombreRepasC3 !== undefined && config.nombreRepasC3 > 0) {
      montantC.C3 = arrondi(config.nombreRepasC3 * ftConfig.fraisReels.valeurRepasPersonnel2025);
    } else {
      montantC[categorie] = arrondi(sommeCategorie(categorie));
    }
  }

  const totalC = Object.values(montantC).reduce((total, montant) => total + montant, 0);
  const totalFraisReels = arrondi(montantA + montantB + totalC);

  const forfait10Brut = ftConfig.fraisReels.tauxForfait10 * baseR;
  const forfait10Pct = arrondi(Math.min(Math.max(forfait10Brut, ftConfig.fraisReels.plancher10Pct2025), ftConfig.fraisReels.plafond10Pct2025));

  const avantage = arrondi(totalFraisReels - forfait10Pct);
  const recommandation = avantage > 0 ? "frais_reels" : avantage < 0 ? "forfait_10" : "identique";

  return { baseR, montantA, montantB, montantC, totalFraisReels, forfait10Pct, avantage, recommandation, depensesParCategorie };
}

// Libellés SNAM par catégorie (cf. spec §4, §8) — utilisés uniquement pour la sortie texte, jamais
// pour un calcul.
const LIBELLES_CATEGORIE: Record<CategorieFrais, string> = {
  A: "Frais instruments et materiel 14%",
  B: "Frais vestimentaires, communications, fournitures 5%",
  C1: "Transport domicile-travail",
  C2: "Autres transports professionnels",
  C3: "Repas supplementaires sur lieu de travail",
  C4: "Repas et hebergement en deplacement",
  C5: "Formation et documentation",
  C6: "Local professionnel a domicile",
  C7: "Materiel, mobilier, fournitures",
  C8: "Cotisations professionnelles",
  C9: "Autres frais professionnels",
  D: "Frais specifiques intermittents (recherche d'emploi)",
};

/**
 * Génère le texte prêt à copier-coller pour impots.gouv.fr (cf. spec §8). Contraintes de format
 * strictes : caractères autorisés uniquement (lettres, chiffres, accents, ponctuation courante,
 * `€`), JAMAIS de flèche, multiplication (×), coche, emoji, tiret long ou guillemet courbe —
 * uniquement le tiret court `-`, déjà dans l'ensemble autorisé.
 */
export function genererTexteDeclaration(result: ResultatFraisReels, config: ConfigFraisReels): string {
  const lignes: string[] = [];

  const ligneMontant = (categorie: CategorieFrais, montant: number, suffixe: string): string => `${categorie} - ${LIBELLES_CATEGORIE[categorie]} : ${montant.toFixed(2)} € ${suffixe}`;

  const ligneListe = (categorie: CategorieFrais, montant: number): string => {
    const depenses = result.depensesParCategorie[categorie] ?? [];
    const liste = depenses.map((d) => d.description).join(" ; ");
    const suffixe = liste.length > 0 ? `: ${liste} ; Total ${categorie} : ${montant.toFixed(2)} €` : `: Total ${categorie} : ${montant.toFixed(2)} €`;
    return `${categorie} - ${LIBELLES_CATEGORIE[categorie]} ${suffixe}`;
  };

  if (config.profilFiscal !== "enseignant_pur") {
    lignes.push(config.modeA === "forfait" ? ligneMontant("A", result.montantA, "(forfait 14% de R)") : ligneListe("A", result.montantA));
    lignes.push("");
    lignes.push(config.modeB === "forfait" ? ligneMontant("B", result.montantB, "(forfait 5% de R)") : ligneListe("B", result.montantB));
    lignes.push("");
  }

  for (const categorie of CATEGORIES_C_ET_D) {
    const montant = result.montantC[categorie] ?? 0;
    if (montant === 0 && (result.depensesParCategorie[categorie] ?? []).length === 0) continue;
    if (categorie === "C3" && config.nombreRepasC3) {
      lignes.push(`C3 - ${LIBELLES_CATEGORIE.C3} : ${config.nombreRepasC3} repas x ${result.montantC.C3 !== undefined ? (result.montantC.C3 / config.nombreRepasC3).toFixed(2) : "0.00"} € = ${montant.toFixed(2)} €`);
    } else {
      lignes.push(ligneListe(categorie, montant));
    }
    lignes.push("");
  }

  lignes.push(`TOTAL FRAIS REELS : ${result.totalFraisReels.toFixed(2)} €`);
  const signe = result.avantage >= 0 ? "+" : "";
  lignes.push(`(forfait 10% aurait donne : ${result.forfait10Pct.toFixed(2)} € - avantage frais reels : ${signe}${result.avantage.toFixed(2)} €)`);

  return lignes.join("\n").trim();
}
