// Barème kilométrique (C1/C2) — moteur pur, zéro React, zéro localStorage. Source : DGFiP, barème
// revenus 2025 (déclaration 2026), inchangé depuis 2023, cf. franceTravailConfig.fraisReels.baremesKilometriques.
//
// Ne calcule PAS les frais complémentaires sur justificatifs cités par le SNAM mais séparés du
// barème (péages, parking, frais de garage, intérêts d'emprunt véhicule) — lignes C1/C2 séparées
// dans l'UI, hors de cette fonction.
import type { FranceTravailConfig } from "../../config/franceTravailConfig";

export type TypeVehicule = "voiture" | "moto" | "cyclomoteur";
export type Motorisation = "thermique_hybride" | "electrique";

// Mode C1 : domicile ↔ travail — plafond 40 km (Q3) applicable.
export interface TrajetC1 {
  mode: "c1";
  distanceDomicileTravail: number; // km aller simple
  nombreAR: number; // allers-retours dans l'année
  // Si distanceDomicileTravail > config.plafondC1AllerKm :
  //   false → éloignement pas un choix personnel → km réels
  //   true  → choix personnel → plafonné à plafondC1AllerKm
  //   null/undefined → pas renseigné → traitement conservateur (plafonné, comme true)
  choixPersonnel?: boolean | null;
}

// Mode C2 : autres trajets professionnels — plafond 40 km non applicable.
export interface TrajetC2 {
  mode: "c2";
  kmParcourus: number;
}

export interface ParamsFraisKilometriques {
  vehicule: {
    type: TypeVehicule;
    motorisation?: Motorisation; // uniquement voiture ; défaut 'thermique_hybride'
    puissanceFiscale?: number; // CV ; ignoré pour cyclomoteur
  };
  trajet: TrajetC1 | TrajetC2;
}

export type AvertissementKm =
  | "choix_personnel_non_renseigne" // distance > 40 km, choixPersonnel non renseigné
  | "distance_superieure_40km_non_plafonnee"; // info : > 40 km mais éloignement justifié, pas de plafond

export interface ResultatFraisKilometriques {
  kmBruts: number; // km avant application du plafond Q3
  kmRetenus: number; // km après plafonnement éventuel
  montantDeductible: number; // arrondi à 2 décimales
  plafonneA40km: boolean; // true si la règle des 40 km a réduit les km retenus
  avertissement?: AvertissementKm;
}

const arrondi = (valeur: number): number => Math.round(valeur * 100) / 100;

// Première tranche dont kmMax ≥ km, ou la dernière (kmMax === null, sans plafond) sinon.
function trouverIndexTranche(tranches: readonly { kmMax: number | null }[], km: number): number {
  const index = tranches.findIndex((t) => t.kmMax === null || km <= t.kmMax);
  return index === -1 ? tranches.length - 1 : index;
}

function calculerMontantBareme(vehicule: ParamsFraisKilometriques["vehicule"], km: number, config: FranceTravailConfig): number {
  const baremes = config.fraisReels.baremesKilometriques;

  if (vehicule.type === "cyclomoteur") {
    const { tranches, coefficients, fixes } = baremes.cyclomoteur;
    const i = trouverIndexTranche(tranches, km);
    return arrondi(km * coefficients[i] + fixes[i]);
  }

  // Première ligne dont cvMax ≥ puissanceFiscale (lignes ordonnées par cvMax croissant, la
  // dernière — 99 — couvre "7 CV et plus"). puissanceFiscale non renseignée -> ligne la plus basse.
  const groupe = vehicule.type === "voiture" ? baremes.voiture : baremes.moto;
  const puissance = vehicule.puissanceFiscale ?? 0;
  const ligne = groupe.lignes.find((l) => l.cvMax >= puissance) ?? groupe.lignes[groupe.lignes.length - 1];
  const i = trouverIndexTranche(groupe.tranches, km);
  const montant = km * ligne.coefficients[i] + ligne.fixes[i];

  if (vehicule.type === "voiture" && vehicule.motorisation === "electrique") {
    return arrondi(montant * (1 + baremes.voiture.majorationElectrique));
  }
  return arrondi(montant);
}

export function calculerFraisKilometriques(params: ParamsFraisKilometriques, config: FranceTravailConfig): ResultatFraisKilometriques {
  const { vehicule, trajet } = params;

  if (trajet.mode === "c2") {
    const montantDeductible = calculerMontantBareme(vehicule, trajet.kmParcourus, config);
    return { kmBruts: trajet.kmParcourus, kmRetenus: trajet.kmParcourus, montantDeductible, plafonneA40km: false };
  }

  const plafondAllerKm = config.fraisReels.baremesKilometriques.plafondC1AllerKm;
  const kmBruts = trajet.distanceDomicileTravail * 2 * trajet.nombreAR;

  let kmRetenus = kmBruts;
  let plafonneA40km = false;
  let avertissement: AvertissementKm | undefined;

  if (trajet.distanceDomicileTravail > plafondAllerKm) {
    if (trajet.choixPersonnel === false) {
      avertissement = "distance_superieure_40km_non_plafonnee";
    } else {
      // choixPersonnel === true, ou non renseigné (undefined/null) -> conservateur : plafonné.
      kmRetenus = plafondAllerKm * 2 * trajet.nombreAR;
      plafonneA40km = true;
      if (trajet.choixPersonnel !== true) {
        avertissement = "choix_personnel_non_renseigne";
      }
    }
  }

  const montantDeductible = calculerMontantBareme(vehicule, kmRetenus, config);
  return { kmBruts, kmRetenus, montantDeductible, plafonneA40km, avertissement };
}
