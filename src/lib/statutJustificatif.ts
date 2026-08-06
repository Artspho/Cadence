import type { CategorieFrais, StatutJustificatif } from "../types/fraisReels";

// 'fourni' si un fichier est présent (Supabase Storage, ou un reliquat de lecture local/Drive
// antérieur au commit 6 de la phase 6), 'non_requis' pour les catégories A/B
// (aucun justificatif requis tant que la qualité d'artiste est incontestable, SNAM §5), 'manquant'
// sinon (C/D) — cf. spec §8. Extrait de DepenseForm.tsx pour rester testable sans React.
export function calculerStatutJustificatif(categorie: CategorieFrais, aUnFichier: boolean): StatutJustificatif {
  if (aUnFichier) return "fourni";
  if (categorie === "A" || categorie === "B") return "non_requis";
  return "manquant";
}
