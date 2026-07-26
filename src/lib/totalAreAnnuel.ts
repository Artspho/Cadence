// Pré-remplissage (éditable) du champ "Allocations ARE" du module Frais réels (section "Mon revenu
// imposable", cf. docs/spec_frais_reels_cadence.md §8). Recalculé indépendamment de
// RevenusMensuels.tsx via les mêmes fonctions moteur (calculerSerieDepuisContrats, calculerSerie)
// plutôt que réutilisé depuis ce composant, non modifiable dans ce chantier. Simplification
// assumée : le mois de réadmission (partagé entre deux droits) est exclu de ce total — cf.
// RevenusMensuels.tsx pour le traitement complet (estimation incluse) ; ici, une valeur légèrement
// sous-estimée sur l'année de réadmission est acceptable puisque ce total n'est qu'un
// PRÉ-REMPLISSAGE, toujours éditable par l'utilisateur, jamais la source de vérité.
import type { Contrat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";
import { calculerSerie } from "../engine/calculerSerie";
import { getAjReelleAt } from "../engine/ajReelleUtils";
import { joursDansMois } from "../engine/dateUtils";

/** Total ARE (net avant PAS, cf. §3 : "Salaire net imposable" — la base R est un montant AVANT
 * prélèvement à la source, le PAS n'étant qu'une modalité de collecte) perçu sur l'année civile
 * `anneeFiscale`. `null` si le calcul n'est structurellement pas possible. */
export function calculerTotalAreAnnuel(profil: Profil, soldeDepart: SoldeIndemnisationDepart | null, contrats: Contrat[], config: FranceTravailConfig, dateDuJour: string, anneeFiscale: number): number | null {
  if (!profil.ouvertureDroits || !soldeDepart) return null;
  if ((profil.ajReelleHistorique ?? []).length === 0) return null;

  const resultat = calculerSerieDepuisContrats(profil, soldeDepart, contrats, dateDuJour, config);
  if (!resultat.calculable) return null;

  const moisCalculables = resultat.mois.filter((m) => m.calculable);
  if (moisCalculables.length === 0) return null;

  const { ouvertureDroits } = profil;
  const serie = calculerSerie({
    mois: moisCalculables.map((m) => ({ joursDuMois: joursDansMois(m.moisLabel), joursTravailes: m.joursNonIndemnisables })),
    ajNetteAvantPAS: 0,
    tauxPAS: 0,
    franchiseCPTotale: ouvertureDroits.franchiseCPTotale,
    delaiAttente: ouvertureDroits.delaiAttenteInitial,
    config,
  });

  let total = 0;
  moisCalculables.forEach((m, i) => {
    if (!m.moisLabel.startsWith(String(anneeFiscale))) return;
    const ajNette = getAjReelleAt(profil.ajReelleHistorique, `${m.moisLabel}-01`);
    if (ajNette === null) return;
    total += serie[i].joursIndemnisables * ajNette;
  });

  return Math.round(total * 100) / 100;
}
