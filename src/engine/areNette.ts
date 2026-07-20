// AJ nette estimée : applique les cotisations par palier sur l'AJ brute.
// Rappel affiché côté UI : c'est une estimation — d'autres prélèvements
// (impôt à la source, etc.) peuvent encore minorer le montant réellement versé.
import type { AJNetteResultat, DetailCotisation, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";

/** SJM (Annexe 10) = SR / (NHT / 10). Protégé contre la division par zéro (NHT = 0, ex. tout début de carrière). */
export function calculerSJM(sr: number, nht: number, config: FranceTravailConfig): number {
  if (nht <= 0) return 0;
  return sr / (nht / config.cotisations.diviseurSJM_Annexe10);
}

export function calculerAJNette(ajBrute: number, sjm: number, profil: Profil, config: FranceTravailConfig): AJNetteResultat {
  const { seuilExoneration, seuilRetraiteCompl, tauxRetraiteComplementaire, tauxCSG, tauxCRDS, tauxAlsaceMoselle } = config.cotisations;
  const detailCotisations: DetailCotisation[] = [];

  if (ajBrute < seuilExoneration) {
    return { brut: ajBrute, net: ajBrute, sjm, detailCotisations };
  }

  const retraite = tauxRetraiteComplementaire * sjm;
  detailCotisations.push({ libelle: "Retraite complémentaire (0,93 % du SJM)", montant: retraite });
  let net = ajBrute - retraite;

  if (ajBrute > seuilRetraiteCompl) {
    const taux = profil.baremeCSG === "reduit" ? tauxCSG.reduit : tauxCSG.normal;
    const csg = taux * sjm;
    const crds = tauxCRDS * sjm;
    detailCotisations.push({ libelle: `CSG (${(taux * 100).toFixed(2).replace(/\.?0+$/, "")} % du SJM)`, montant: csg });
    detailCotisations.push({ libelle: "CRDS (0,5 % du SJM)", montant: crds });
    net -= csg + crds;
  }

  if (profil.alsaceMoselle) {
    const alsace = tauxAlsaceMoselle * sjm;
    detailCotisations.push({ libelle: "Régime local Alsace-Moselle (1,50 % du SJM)", montant: alsace });
    net -= alsace;
  }

  return { brut: ajBrute, net: Math.max(0, net), sjm, detailCotisations };
}
