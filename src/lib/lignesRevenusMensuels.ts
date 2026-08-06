// Construction des lignes AFFICHÉES du tableau « Revenus mensuels », extraite de
// components/RevenusMensuels.tsx le 03/08/2026.
//
// Pourquoi hors du composant : le point 12 quater de docs/critique_2026-08-03.md réclame un test qui
// « part d'une notification d'ouverture réelle et déroule toute la chaîne jusqu'aux lignes
// affichées ». Tant que cette construction vivait dans le `.tsx`, aucun test ne pouvait l'atteindre
// sans monter le composant, et le seul test « certifié » du projet alimentait le moteur à la main
// avec un solde de mi-parcours qui encodait déjà le résultat du premier mois — il validait donc un
// calcul démarrant APRÈS le bug. Cf. lib/__tests__/lignesRevenusMensuels.test.ts.
//
// Ce module ne calcule plus RIEN. Avant ce chantier, il rejouait toute la série avec un second
// moteur (`engine/calculerSerie.ts`, supprimé) dont l'ordre de consommation était l'inverse de celui
// du guide officiel, et recalculait le mois d'ouverture comme un mois calendaire entier. Il se
// contente désormais de mettre en forme ce que `calculerSerieDepuisContrats` a produit — un seul
// moteur, une seule vérité (points 3, 4, 16 et 21).
import type { LigneSerieIndemnisation } from "../types";

export interface LigneAffichage {
  moisLabel: string;
  heuresDuMois: number;
  joursNonIndemnisables: number;
  delaiConsomme: number;
  franchiseCPConsommee: number;
  joursIndemnisables: number;
  montant: number | null;
  montantNet: number | null;
  salairesContratsBruts: number;
  /** Nombre de jours de la fenêtre retenue — inférieur aux jours du mois civil sur le seul mois
   * d'ouverture partiel (cf. `messageOuverturePartielle`). */
  joursDeLaFenetre: number;
  estimation: boolean;
  /** Libellé du mois d'ouverture partiel, tel que produit par le moteur (source unique,
   * content/moisOuverturePartielle.ts) — `null` sur un mois normal. Jamais reformulé ici. */
  messageOuverturePartielle: string | null;
  /** Présent seulement quand le plafond de cumul à 118 % du PMSS a réellement écrêté ce mois
   * (point 25, `engine/indemnisationMensuelle.ts`) — `montant` porte déjà la valeur écrêtée. */
  ecretementPMSS: { montantAvantEcretement: number; plafond: number } | null;
}

/**
 * Tout mois calculé par Cadence est une ESTIMATION, sans exception, jusqu'à ce que l'utilisateur
 * importe le document réel du mois (relevé de situation France Travail).
 *
 * Décision de Benoît, 03/08/2026 : « tu livres ton estimation tant que l'utilisateur n'a pas importé
 * les documents réels ». Elle remplace la règle précédente — `estimation = franchise CP restante > 0
 * || délai restant > 0` — qui faisait DISPARAÎTRE le badge dès les franchises épuisées. Conséquence
 * mesurée sur les données réelles de Benoît le 03/08/2026 : les mois d'août 2026 à janvier 2027,
 * soit environ 9 000 € d'ARE bâtis sur des contrats récurrents pas encore travaillés, s'affichaient
 * SANS la moindre réserve — un faux feu vert du même genre que le point 5, sur des euros au lieu
 * d'un badge.
 *
 * Quatre raisons connues, documentées et non résolues empêchent encore d'affirmer un montant exact
 * (cf. docs/critique_2026-08-03.md) : formule des jours non indemnisables calée sur 4 relevés et non
 * déduite du texte ; total de franchise salaires déclaré et non calculé ; jours d'inscription
 * supposés couvrir le mois entier ; et un modèle validé sur quatre mois d'un seul droit. Aucune ne se
 * referme par du code seul. (Le plafond de cumul à 118 % du PMSS, cinquième raison listée à
 * l'origine, est appliqué depuis le 07/08/2026 — point 25, `engine/indemnisationMensuelle.ts`.)
 *
 * Quand l'import de relevé existera, c'est ICI que la distinction se fera : un mois dont le document
 * a été importé n'est plus une estimation — son chiffre est celui du relevé, pas celui du moteur.
 */
export function estMoisEnEstimation(_ligne: LigneSerieIndemnisation): boolean {
  return true;
}

/** Met en forme la série produite par `calculerSerieDepuisContrats` pour le tableau. Aucun calcul. */
export function construireLignesAffichage(mois: LigneSerieIndemnisation[]): LigneAffichage[] {
  return mois.map((m) => ({
    moisLabel: m.moisLabel,
    heuresDuMois: m.heuresDuMois,
    joursNonIndemnisables: m.joursNonIndemnisables,
    delaiConsomme: m.delaiConsomme,
    franchiseCPConsommee: m.franchiseCPConsommee,
    joursIndemnisables: m.joursIndemnises,
    // Montant et net viennent du moteur (`calculerMontantMensuel`, qui lit l'AJ ET le taux PAS
    // applicables À CE MOIS-LÀ via getAjReelleAt/getTauxPASAt). Ils étaient auparavant recalculés
    // une seconde fois ici, à partir des mêmes fonctions — duplication supprimée.
    montant: m.montantMensuel.calculable ? m.montantMensuel.montant : null,
    montantNet: m.montantMensuel.calculable ? (m.montantMensuel.montantNet ?? null) : null,
    ecretementPMSS: m.montantMensuel.calculable && m.montantMensuel.ecretementPMSS ? { montantAvantEcretement: m.montantMensuel.ecretementPMSS.montantAvantEcretement, plafond: m.montantMensuel.ecretementPMSS.plafond } : null,
    salairesContratsBruts: m.salairesContratsBruts,
    joursDeLaFenetre: m.joursDeLaFenetre,
    estimation: estMoisEnEstimation(m),
    messageOuverturePartielle: m.ouverturePartielle?.messageTooltip ?? null,
  }));
}
