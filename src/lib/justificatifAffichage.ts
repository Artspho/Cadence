import type { Depense } from "../types/fraisReels";

export type EtatAffichageJustificatif = { type: "aucun" } | { type: "lien"; url: string } | { type: "indisponible" };

// Priorité : lien Drive (fonctionne indépendamment de la connexion actuelle de l'app — c'est une
// URL Drive normale) > aperçu local base64 > badge "sur Drive mais lien absent" (driveFileId
// enregistré sans webViewLink, ex. donnée ancienne/partielle — données préservées, aucune perte,
// cf. [[cadence_schema_lecture_ecriture]]) > aucun justificatif.
export function calculerAffichageJustificatif(depense: Depense): EtatAffichageJustificatif {
  if (depense.driveWebViewLink) return { type: "lien", url: depense.driveWebViewLink };
  if (depense.justificatifData) return { type: "lien", url: depense.justificatifData };
  if (depense.driveFileId) return { type: "indisponible" };
  return { type: "aucun" };
}
