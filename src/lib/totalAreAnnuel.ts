// Pré-remplissage (éditable) du champ "Allocations ARE" du module Frais réels (section "Mon revenu
// imposable", cf. docs/spec_frais_reels_cadence.md §8).
//
// Corrigé le 03/08/2026 (point 16 de docs/critique_2026-08-03.md) : ce module appelait
// `calculerSerieDepuisContrats` (moteur A), JETAIT les jours indemnisés qu'il venait d'obtenir, puis
// les recalculait avec `calculerSerie` (moteur B, ordre de consommation inverse et depuis supprimé).
// Même divergence que le point 3, sur un autre écran. Il lit désormais directement le résultat du
// moteur unique — un seul chemin, donc plus aucun écart possible avec le tableau « Revenus
// mensuels ».
//
// Deuxième conséquence du même correctif : le mois d'ouverture partiel n'est plus exclu de ce total.
// Il l'était parce que le moteur ne le calculait pas ; il est maintenant calculé sur sa vraie fenêtre
// (cf. engine/indemnisationMensuelle.ts), donc sa part du nouveau droit entre légitimement dans le
// total de l'année. La part relevant du droit PRÉCÉDENT reste, elle, absente — Cadence n'y a pas
// accès, et ce total demeure un pré-remplissage toujours éditable, jamais la source de vérité.
import type { Contrat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";

/** Total ARE (net avant PAS, cf. §3 : "Salaire net imposable" — la base R est un montant AVANT
 * prélèvement à la source, le PAS n'étant qu'une modalité de collecte) perçu sur l'année civile
 * `anneeFiscale`. `null` si le calcul n'est structurellement pas possible. */
export function calculerTotalAreAnnuel(profil: Profil, soldeDepart: SoldeIndemnisationDepart | null, contrats: Contrat[], config: FranceTravailConfig, dateDuJour: string, anneeFiscale: number): number | null {
  if (!profil.ouvertureDroits || !soldeDepart) return null;
  if ((profil.ajReelleHistorique ?? []).length === 0) return null;

  const resultat = calculerSerieDepuisContrats(profil, soldeDepart, contrats, dateDuJour, config);
  if (!resultat.calculable) return null;
  if (resultat.mois.length === 0) return null;

  // `montantMensuel.montant` = joursIndemnises × AJ réelle applicable à CE mois-là (getAjReelleAt,
  // cf. engine/indemnisationMensuelle.ts) : exactement ce que le tableau mensuel affiche, sans le
  // recalculer une seconde fois ici. `calculable: false` (AJ inconnue pour ce mois) contribue 0
  // plutôt qu'un montant deviné — devoir n°2, comportement inchangé.
  const total = resultat.mois
    .filter((m) => m.moisLabel.startsWith(String(anneeFiscale)))
    .reduce((somme, m) => (m.montantMensuel.calculable ? somme + m.montantMensuel.montant : somme), 0);

  return Math.round(total * 100) / 100;
}
