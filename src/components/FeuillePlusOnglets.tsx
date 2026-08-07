/**
 * Feuille « Plus » de la bottom bar mobile (refonte UI, étape 6 — 07/08/2026) : les onglets qui ne
 * tiennent pas dans les 4 boutons fixes de `BottomTabBar.tsx`, plus Export/Import — l'équivalent
 * mobile du bas de `Sidebar.tsx`. Montée UNIQUEMENT quand ouverte (jamais en permanence avec un
 * simple `hidden`) : sans ça, ses boutons dupliqueraient dans le DOM des noms accessibles déjà portés
 * par la sidebar desktop pendant les tests (jsdom ne respecte pas les media queries), en plus d'être
 * un poids mort tant que personne ne l'a ouverte.
 */

import { useEffect, useRef } from "react";
import type { Onglet } from "./TopBar";
import { ONGLETS, ONGLETS_PRINCIPAUX_MOBILE } from "./onglets";

interface FeuillePlusOngletsProps {
  ongletActif: Onglet;
  onChangerOnglet: (onglet: Onglet) => void;
  onExporter: () => void;
  onImporter: () => void;
  onFermer: () => void;
}

export function FeuillePlusOnglets({ ongletActif, onChangerOnglet, onExporter, onImporter, onFermer }: FeuillePlusOngletsProps) {
  const panneau = useRef<HTMLDivElement>(null);
  const ongletsRestants = ONGLETS.filter((o) => !ONGLETS_PRINCIPAUX_MOBILE.includes(o.id));

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (panneau.current && !panneau.current.contains(e.target as Node)) onFermer();
    }
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surEchap);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surEchap);
    };
  }, [onFermer]);

  return (
    <div className="md:hidden fixed inset-0 z-40 bg-bg/60 flex items-end">
      <div ref={panneau} className="w-full bg-surface border-t border-line rounded-t-hero p-4 pb-6 space-y-1 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-2">
          <h2 className="font-display text-sm font-medium tracking-tight">Plus</h2>
          <button type="button" onClick={onFermer} className="text-muted hover:text-ink transition-colors" aria-label="Fermer">
            ✕
          </button>
        </div>
        <nav aria-label="Autres onglets">
          {ongletsRestants.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChangerOnglet(o.id);
                onFermer();
              }}
              aria-current={ongletActif === o.id ? "page" : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${ongletActif === o.id ? "bg-surface-2 text-ink" : "text-muted"}`}
            >
              {o.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-line pt-2 mt-2 space-y-1">
          <button
            type="button"
            onClick={() => {
              onExporter();
              onFermer();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted"
          >
            Exporter mes données (JSON)
          </button>
          <button
            type="button"
            onClick={() => {
              onImporter();
              onFermer();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted"
          >
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}
