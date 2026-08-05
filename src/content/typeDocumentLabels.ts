// Libellés français des 10 valeurs de `documents.type_document` (migration 0003) — UI uniquement,
// aucune logique. Utilisé par MonDossier.tsx (liste + sélecteur « corriger le type ») et, plus tard,
// par le sélecteur affiché quand l'IA ne reconnaît rien (commit 5).
import type { TypeDocument } from "../storage/documentsStorage";

export const LIBELLES_TYPE_DOCUMENT: Record<TypeDocument, string> = {
  aem_bulletin: "Bulletin de paie / AEM",
  notification_are: "Notification d'admission ARE",
  releve_situation: "Relevé de situation",
  declaration_fiscale: "Déclaration fiscale",
  justificatif_frais: "Justificatif de frais réels",
  attestation_cpam: "Attestation CPAM",
  justificatif_declaration: "Justificatif de déclaration de situation mensuelle",
  attestation_taux_pas: "Attestation de taux de prélèvement à la source",
  document_non_classe: "Document non classé",
  planning_travail: "Planning de travail / feuille de route",
};

/** Ordre d'affichage stable — celui du sélecteur « corriger le type » et de tout futur regroupement. */
export const TYPES_DOCUMENT_ORDONNES: TypeDocument[] = [
  "aem_bulletin",
  "notification_are",
  "releve_situation",
  "declaration_fiscale",
  "justificatif_frais",
  "attestation_cpam",
  "justificatif_declaration",
  "attestation_taux_pas",
  "planning_travail",
  "document_non_classe",
];
