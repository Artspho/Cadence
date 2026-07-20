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
  const { seuilExoneration, seuilRetraiteCompl, tauxRetraiteComplementaire, tauxCSG, tauxCRDS, tauxAlsaceMoselle, tauxAssietteCSGCRDS, plancherEcretementJournalier } = config.cotisations;
  const detailCotisations: DetailCotisation[] = [];

  if (ajBrute < seuilExoneration) {
    return { brut: ajBrute, net: ajBrute, sjm, detailCotisations };
  }

  const retraite = tauxRetraiteComplementaire * sjm;
  detailCotisations.push({ libelle: "Retraite complémentaire (0,93 % du SJM)", montant: retraite });
  let net = ajBrute - retraite;

  if (ajBrute > seuilRetraiteCompl) {
    if (plancherEcretementJournalier == null) {
      throw new Error(
        "CSG/CRDS : plancher d'écrêtement manquant (config.cotisations.plancherEcretementJournalier). " +
          "Renseigner cette valeur depuis la source officielle avant de lancer ce calcul — aucune approximation n'est appliquée.",
      );
    }

    // Bande 60 € < AJ brute et allocation déjà au plancher (ou en dessous) une
    // fois la retraite complémentaire déduite : aucune CSG/CRDS ne peut être
    // prélevée sans faire passer l'allocation sous ce plancher — donc on ne
    // prélève rien. Sans cette branche, l'écrêtement ci-dessous calculerait un
    // montant NÉGATIF (net > brut), un chiffre faux (devoir sacré n°2).
    if (net > plancherEcretementJournalier) {
      const taux = profil.baremeCSG === "reduit" ? tauxCSG.reduit : tauxCSG.normal;
      const assiette = tauxAssietteCSGCRDS * net; // 98,25 % de l'allocation APRÈS retraite, pas le SJM
      const csgTheorique = taux * assiette;
      const crdsTheorique = tauxCRDS * assiette;
      const netSansEcretement = net - csgTheorique - crdsTheorique;

      if (netSansEcretement < plancherEcretementJournalier) {
        const montantEcrete = net - plancherEcretementJournalier; // net > plancher ici, donc toujours > 0
        detailCotisations.push({ libelle: `CSG + CRDS écrêtées (plancher ${plancherEcretementJournalier} €/j)`, montant: montantEcrete });
        net = plancherEcretementJournalier;
      } else {
        detailCotisations.push({ libelle: `CSG (${(taux * 100).toFixed(2).replace(/\.?0+$/, "")} % de l'allocation après retraite)`, montant: csgTheorique });
        detailCotisations.push({ libelle: "CRDS (0,5 % de l'allocation après retraite)", montant: crdsTheorique });
        net = netSansEcretement;
      }
    }
  }

  if (profil.alsaceMoselle) {
    const alsace = tauxAlsaceMoselle * sjm;
    detailCotisations.push({ libelle: "Régime local Alsace-Moselle (1,50 % du SJM)", montant: alsace });
    net -= alsace;
  }

  return { brut: ajBrute, net: Math.max(0, net), sjm, detailCotisations };
}
