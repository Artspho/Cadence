/**
 * Barre de navigation mobile fixe en bas d'écran (refonte UI, étape 6 — 07/08/2026), remplace la nav
 * horizontale scrollable qui vivait dans `TopBar.tsx` sur petit écran. 4 onglets fixes
 * (`ONGLETS_PRINCIPAUX_MOBILE`, cf. onglets.ts) + un 5e bouton « Plus » ouvrant
 * `FeuillePlusOnglets.tsx` pour le reste.
 *
 * `aria-label="Navigation mobile"` — délibérément DIFFÉRENT de « Navigation principale »
 * (`Sidebar.tsx`) : les deux existent en même temps dans le DOM (jsdom ne respecte pas `md:hidden`),
 * un même nom accessible casserait `findByRole("navigation", { name: /navigation principale/i })`
 * dans les tests existants en lui faisant matcher deux éléments.
 */

import { useState } from "react";
import type { Onglet } from "./TopBar";
import { ONGLETS, ONGLETS_PRINCIPAUX_MOBILE, INITIALE_ONGLET } from "./onglets";
import { FeuillePlusOnglets } from "./FeuillePlusOnglets";

interface BottomTabBarProps {
  ongletActif: Onglet;
  onChangerOnglet: (onglet: Onglet) => void;
  onExporter: () => void;
  onImporter: () => void;
}

export function BottomTabBar({ ongletActif, onChangerOnglet, onExporter, onImporter }: BottomTabBarProps) {
  const [plusOuvert, setPlusOuvert] = useState(false);
  const principaux = ONGLETS.filter((o) => ONGLETS_PRINCIPAUX_MOBILE.includes(o.id));
  // « Plus » est actif dès qu'on est sur un onglet qu'il contient (le reste, cf. FeuillePlusOnglets) —
  // sinon l'utilisateur perdrait tout repère de position une fois la feuille refermée.
  const plusActif = !ONGLETS_PRINCIPAUX_MOBILE.includes(ongletActif);

  return (
    <>
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-line flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {principaux.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChangerOnglet(o.id)}
            aria-current={ongletActif === o.id ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${ongletActif === o.id ? "text-mint" : "text-muted"}`}
          >
            <span className="text-sm" aria-hidden>
              {INITIALE_ONGLET[o.id]}
            </span>
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPlusOuvert(true)}
          aria-current={plusActif ? "page" : undefined}
          aria-haspopup="dialog"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${plusActif ? "text-mint" : "text-muted"}`}
        >
          <span className="text-sm" aria-hidden>
            •••
          </span>
          Plus
        </button>
      </nav>

      {plusOuvert && (
        <FeuillePlusOnglets
          ongletActif={ongletActif}
          onChangerOnglet={onChangerOnglet}
          onExporter={onExporter}
          onImporter={onImporter}
          onFermer={() => setPlusOuvert(false)}
        />
      )}
    </>
  );
}
