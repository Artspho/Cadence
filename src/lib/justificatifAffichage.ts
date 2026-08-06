import type { Depense } from "../types/fraisReels";

export type EtatAffichageJustificatif =
  | { type: "aucun" }
  | { type: "lien"; url: string }
  /** Sur Supabase Storage (phase 6, commit 6) — l'URL se demande à l'instant du clic (jamais mise en
   *  cache, cf. `ClientFichiers`), donc l'appelant doit la résoudre lui-même via `documentId`. */
  | { type: "signe"; documentId: string }
  | { type: "indisponible" };

// Priorité : `documentId` (Supabase Storage, la SEULE destination pour un nouveau justificatif) >
// lien Drive historique (fonctionne indépendamment de la connexion actuelle de l'app — c'est une URL
// Drive normale) > aperçu local base64 historique > badge "sur Drive mais lien absent" (driveFileId
// enregistré sans webViewLink, ex. donnée ancienne/partielle — données préservées, aucune perte, cf.
// [[cadence_schema_lecture_ecriture]]) > aucun justificatif. Les trois derniers cas sont désormais du
// PASSÉ (module Drive retiré, plus aucune écriture base64) : conservés en lecture pour les dépenses
// enregistrées avant ce commit.
export function calculerAffichageJustificatif(depense: Depense): EtatAffichageJustificatif {
  if (depense.documentId) return { type: "signe", documentId: depense.documentId };
  if (depense.driveWebViewLink) return { type: "lien", url: depense.driveWebViewLink };
  if (depense.justificatifData) return { type: "lien", url: depense.justificatifData };
  if (depense.driveFileId) return { type: "indisponible" };
  return { type: "aucun" };
}
