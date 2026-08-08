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
  { id: "import", label: "Déposer un document" },
  { id: "historique", label: "Historique" },
  { id: "simulateur", label: "Simulateur" },
  { id: "revenus", label: "Revenus mensuels" },
  { id: "fraisPro", label: "Frais pro" },
  { id: "dossier", label: "Mon dossier" },
];

/** Sous-ensemble affiché en permanence sur la bottom bar mobile — le reste va dans « Plus ». */
export const ONGLETS_PRINCIPAUX_MOBILE: Onglet[] = ["dashboard", "contrats", "import", "revenus"];

type IconeProps = { className?: string };

const TRAIT = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Tableau de bord : grille de 4 cases, le pictogramme le plus répandu pour un écran d'accueil. */
function IconeDashboard({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <rect x="3" y="3" width="6" height="6" rx="1.3" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" />
    </svg>
  );
}

/** Profil : silhouette (tête + épaules). */
function IconeProfil({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <circle cx="10" cy="6.8" r="3.2" />
      <path d="M4 17c0-3.5 2.7-6 6-6s6 2.5 6 6" />
    </svg>
  );
}

/** Contrats : papier écrit (coin plié + lignes de texte). */
function IconeContrats({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <path d="M6 3h5l3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M11 3v3h3" />
      <line x1="7" y1="10.5" x2="13" y2="10.5" />
      <line x1="7" y1="13.5" x2="13" y2="13.5" />
      <line x1="7" y1="16" x2="10.5" y2="16" />
    </svg>
  );
}

/** Import : flèche vers le bas surmontant un trait (dépôt de fichier). */
function IconeImport({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <line x1="10" y1="3" x2="10" y2="12.5" />
      <path d="M6.3 9l3.7 3.7L13.7 9" />
      <line x1="4.5" y1="16.5" x2="15.5" y2="16.5" />
    </svg>
  );
}

/** Historique : horloge. */
function IconeHistorique({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <circle cx="10" cy="10.5" r="7" />
      <path d="M10 6.7v3.8l2.8 1.9" />
    </svg>
  );
}

/** Simulateur : calculatrice, touches × + −. */
function IconeSimulateur({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <rect x="4" y="2" width="12" height="16" rx="2" />
      <rect x="6" y="4.3" width="8" height="3.2" rx="0.6" />
      <path d="M5.6 12.2l2 2M7.6 12.2l-2 2" />
      <path d="M10 11.9v2.6M8.7 13.2h2.6" />
      <line x1="12.8" y1="13.2" x2="15.2" y2="13.2" />
    </svg>
  );
}

/** Revenus mensuels : symbole €. */
function IconeRevenus({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <path d="M13.2 5.3a5.3 5.3 0 1 0 0 9.4" />
      <line x1="4" y1="8.3" x2="11.5" y2="8.3" />
      <line x1="4" y1="11.4" x2="11.5" y2="11.4" />
    </svg>
  );
}

/** Frais pro : ticket de note de frais (bord dentelé + lignes). */
function IconeFraisPro({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <path d="M6 2.5h8v12.5l-1.4-1.1-1.4 1.1-1.4-1.1-1.4 1.1-1.4-1.1-1.4 1.1z" />
      <line x1="8" y1="6" x2="12" y2="6" />
      <line x1="8" y1="9" x2="12" y2="9" />
    </svg>
  );
}

/** Mon dossier : chemise. */
function IconeDossier({ className }: IconeProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <path d="M3 6.2a1 1 0 0 1 1-1h3.6l1.6 1.6H16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.2z" />
    </svg>
  );
}

/** Paramètres : roue dentée. N'apparaît dans aucune des deux navigations (cf. commentaire d'en-tête),
 * gardée uniquement pour la complétude du `Record<Onglet, …>` ci-dessous. */
function IconeParametres({ className }: IconeProps) {
  const dents = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <svg viewBox="0 0 20 20" className={className} {...TRAIT}>
      <circle cx="10" cy="10" r="3" />
      {dents.map((angle) => (
        <line key={angle} x1="10" y1="3.2" x2="10" y2="5.4" transform={`rotate(${angle} 10 10)`} />
      ))}
    </svg>
  );
}

/**
 * Un pictogramme SVG par onglet, dans les deux navigations repliées/icônes — remplace les initiales
 * lettrées d'origine (07/08/2026) : plus lisible en un coup d'œil, et toujours des traits bruts
 * `currentColor`, jamais d'emoji couleur (même politique que l'ancienne `INITIALE_ONGLET`, cf.
 * `AlertCenter.tsx`, `MentionsLegales.tsx`).
 */
export const ICONE_ONGLET: Record<Onglet, (props: IconeProps) => JSX.Element> = {
  dashboard: IconeDashboard,
  profil: IconeProfil,
  contrats: IconeContrats,
  import: IconeImport,
  historique: IconeHistorique,
  simulateur: IconeSimulateur,
  revenus: IconeRevenus,
  fraisPro: IconeFraisPro,
  dossier: IconeDossier,
  parametres: IconeParametres,
};
