// Libellés complets (UI uniquement) — distincts des libellés compacts d'engine/fraisReels.ts
// (contraints par les caractères autorisés impots.gouv.fr, cf. spec §8). Aucune valeur chiffrée
// ici, uniquement du texte d'affichage.
import type { CategorieFrais } from "../../types/fraisReels";

export const LIBELLES_CATEGORIE_COMPLETS: Record<CategorieFrais, string> = {
  A: "A — Instruments, matériel technique (forfait 14 %)",
  B: "B — Vestimentaire, représentation, communications (forfait 5 %)",
  C1: "C1 — Transport domicile ↔ travail",
  C2: "C2 — Autres transports professionnels",
  C3: "C3 — Repas supplémentaires sur le lieu de travail",
  C4: "C4 — Repas et hébergement en déplacement",
  C5: "C5 — Formation et documentation",
  C6: "C6 — Local professionnel à domicile",
  C7: "C7 — Matériel, mobilier, fournitures",
  C8: "C8 — Cotisations professionnelles",
  C9: "C9 — Autres frais professionnels",
  D: "D — Frais spécifiques intermittents (recherche d'emploi)",
};

export const CATEGORIES_ORDONNEES: CategorieFrais[] = ["A", "B", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "D"];

export const COULEUR_BADGE_CATEGORIE: Record<CategorieFrais, string> = {
  A: "bg-mint/15 text-mint",
  B: "bg-teal/15 text-teal",
  C1: "bg-surface-2 text-muted",
  C2: "bg-surface-2 text-muted",
  C3: "bg-surface-2 text-muted",
  C4: "bg-surface-2 text-muted",
  C5: "bg-surface-2 text-muted",
  C6: "bg-surface-2 text-muted",
  C7: "bg-surface-2 text-muted",
  C8: "bg-surface-2 text-muted",
  C9: "bg-surface-2 text-muted",
  D: "bg-amber/15 text-amber",
};
