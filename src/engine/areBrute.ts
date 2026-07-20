// AJ brute (Annexe 10) : AJ = A + B + C, bornée par un plancher et un plafond.
import type { AJBruteResultat, FenetreReference } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { clamp } from "./dateUtils";

export interface ParametresAJBrute {
  /** SR, ou SAR si un aménagement s'applique (cf. salaireReference.ts). */
  salaireRetenu: number;
  nht: number;
  config: FranceTravailConfig;
  /** Période allongée (réadmission) : les diviseurs de A et B changent (cf. §6.4). */
  readmissionAllongee?: boolean;
  /** Nombre d'heures NH (> 507), requis si readmissionAllongee est vrai. */
  nh?: number;
  /** SMIC horaire brut, requis si readmissionAllongee est vrai (config.valeursDatees.smicHoraireBrut). */
  smicHoraireBrut?: number | null;
}

export function calculerAJBrute(params: ParametresAJBrute): AJBruteResultat {
  const { salaireRetenu, nht, config } = params;
  const { partieA, partieB, partieC, ajMinimale, plancherAnnexe10, plafond } = config.are;

  let diviseurA: number = partieA.diviseur;
  let diviseurB: number = partieB.diviseur;

  if (params.readmissionAllongee) {
    if (!params.nh || params.nh <= config.seuilHeures) {
      throw new Error("Calcul en période allongée : le nombre d'heures NH (> 507) est requis.");
    }
    if (params.smicHoraireBrut == null) {
      throw new Error(
        "Calcul en période allongée : SMIC horaire brut manquant (config.valeursDatees.smicHoraireBrut). " +
          "Renseigner cette valeur depuis la source officielle avant de lancer ce calcul — aucune approximation n'est appliquée.",
      );
    }
    diviseurA = params.nh * params.smicHoraireBrut;
    diviseurB = params.nh;
  }

  const a = (ajMinimale * (partieA.coeffSousSeuil * Math.min(salaireRetenu, partieA.seuilSR) + partieA.coeffAuDelaSeuil * Math.max(0, salaireRetenu - partieA.seuilSR))) / diviseurA;
  const b = (ajMinimale * (partieB.coeffSousSeuil * Math.min(nht, partieB.seuilNHT) + partieB.coeffAuDelaSeuil * Math.max(0, nht - partieB.seuilNHT))) / diviseurB;
  const c = ajMinimale * partieC.coeff;

  const brutAvantClamp = a + b + c;
  const brut = clamp(brutAvantClamp, plancherAnnexe10, plafond);

  return {
    a,
    b,
    c,
    brutAvantClamp,
    brut,
    plancherApplique: brutAvantClamp < plancherAnnexe10,
    plafondApplique: brutAvantClamp > plafond,
  };
}

/**
 * Point d'entrée unique pour calculer l'AJ brute "réellement affichée" à
 * partir d'une fenêtre de référence : décide seule si la formule allongée
 * (réadmission) doit s'appliquer, et se rabat sur la formule standard sans
 * jamais lever d'exception quand une donnée manque (SMIC non renseigné, ou
 * NH insuffisant même après extension). App.tsx et Simulateur.tsx doivent
 * appeler CETTE fonction plutôt que calculerAJBrute directement, pour ne
 * jamais dupliquer la décision "standard vs allongée".
 */
export function calculerAJBrutePourFenetre(fenetre: FenetreReference, decompteTotal: number, salaireRetenu: number, nht: number, config: FranceTravailConfig): AJBruteResultat {
  const smicHoraireBrut = config.valeursDatees.smicHoraireBrut;
  const enPeriodeAllongee = fenetre.tranchesReadmission > 0 && decompteTotal > config.seuilHeures && smicHoraireBrut !== null;

  return calculerAJBrute({
    salaireRetenu,
    nht,
    config,
    readmissionAllongee: enPeriodeAllongee,
    nh: enPeriodeAllongee ? decompteTotal : undefined,
    smicHoraireBrut,
  });
}
