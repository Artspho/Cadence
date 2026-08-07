/**
 * Liste unique des onglets de navigation (refonte UI, étape sidebar — 07/08/2026), partagée entre
 * `Sidebar.tsx` (desktop, liste complète) et `BottomTabBar.tsx`/`FeuillePlusOnglets.tsx` (mobile,
 * répartie en deux groupes) — une seule source, pour ne jamais laisser les deux navigations diverger
 * silencieusement (même principe que `content/mentionsLegales.ts`).
 *
 * « Paramètres » n'y figure PAS : atteignable uniquement depuis le menu de l'avatar
 * (`AvatarMenu.tsx`), décision prise à cette étape (elle était temporairement dans la nav horizontale
 * de `TopBar.tsx` depuis l'étape 3, le temps que cette navigation existe).
 */

import type { Onglet } from "./TopBar";

export interface DefinitionOnglet {
  id: Onglet;
  label: string;
}

export const ONGLETS: DefinitionOnglet[] = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "profil", label: "Mon profil" },
  { id: "contrats", label: "Contrats" },
  { id: "import", label: "Import PDF" },
  { id: "historique", label: "Historique" },
  { id: "simulateur", label: "Simulateur" },
  { id: "revenus", label: "Revenus mensuels" },
  { id: "fraisPro", label: "Frais pro" },
  { id: "dossier", label: "Mon dossier" },
];

/** Sous-ensemble affiché en permanence sur la bottom bar mobile — le reste va dans « Plus ». */
export const ONGLETS_PRINCIPAUX_MOBILE: Onglet[] = ["dashboard", "contrats", "import", "revenus"];

/**
 * Une seule lettre par onglet, dans les deux navigations repliées/icônes — même esprit que
 * l'initiale de l'avatar (`AvatarMenu.tsx`) : pas de nouvelle dépendance à une librairie d'icônes pour
 * une sidebar/bottom-bar aussi simple, cohérent avec le reste de la charte (glyphes unicode bruts,
 * jamais d'emoji couleur — cf. `AlertCenter.tsx`, `MentionsLegales.tsx`).
 */
export const INITIALE_ONGLET: Record<Onglet, string> = {
  dashboard: "T",
  profil: "P",
  contrats: "C",
  import: "I",
  historique: "H",
  simulateur: "S",
  revenus: "R",
  fraisPro: "F",
  dossier: "D",
  parametres: "⚙",
};
