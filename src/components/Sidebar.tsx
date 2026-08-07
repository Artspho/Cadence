/**
 * Sidebar rétractable desktop (refonte UI, étape 6 — 07/08/2026 ; logo remonté depuis `TopBar.tsx`
 * le 07/08/2026 pour ne plus laisser un bandeau quasi vide en haut de l'écran). Remplace la nav
 * horizontale qui vivait dans `TopBar.tsx` : celui-ci ne porte plus que le badge de période.
 *
 * Repliée par défaut (icônes seules), s'ouvre au survol OU au focus clavier (jamais hover seul —
 * exclurait le clavier et le tactile), et peut être épinglée ouverte (préférence persistée dans
 * `localStorage`, clé UI dédiée `cadence:ui:sidebarEpinglee`, JAMAIS `storage/localStorageAdapter.ts`
 * — ce n'est qu'une préférence d'affichage, pas une donnée soumise aux devoirs sacrés).
 *
 * `aria-label="Navigation principale"` — INCHANGÉ depuis l'ancienne nav de `TopBar.tsx` : plusieurs
 * tests (`App.bascule.test.tsx`, `App.compteObligatoire.test.tsx`) l'utilisent comme signal de
 * disponibilité de l'app. `aria-label` explicite sur chaque bouton, TOUJOURS présent (pas seulement
 * quand la sidebar est ouverte) : c'est lui qui porte le nom accessible en état replié, où le libellé
 * textuel n'est pas dans le DOM.
 */

import { useEffect, useState } from "react";
import type { Onglet } from "./TopBar";
import { ONGLETS, ICONE_ONGLET } from "./onglets";
import { AvatarMenu } from "./AvatarMenu";
import type { SessionConnectee } from "../auth/session";

const CLE_SIDEBAR_EPINGLEE = "cadence:ui:sidebarEpinglee";

interface SidebarProps {
  ongletActif: Onglet;
  onChangerOnglet: (onglet: Onglet) => void;
  onExporter: () => void;
  onImporter: () => void;
  /** Optionnelle : seul `App.tsx` la fournit (une fois le mur de connexion passé). Sans elle, la
   * ligne « compte » ne se rend pas — évite d'imposer une session à chaque test de `Sidebar`. */
  session?: SessionConnectee;
}

export function Sidebar({ ongletActif, onChangerOnglet, onExporter, onImporter, session }: SidebarProps) {
  const [epinglee, setEpinglee] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(CLE_SIDEBAR_EPINGLEE) === "1");
  const [survolee, setSurvolee] = useState(false);
  const ouverte = epinglee || survolee;

  useEffect(() => {
    window.localStorage.setItem(CLE_SIDEBAR_EPINGLEE, epinglee ? "1" : "0");
  }, [epinglee]);

  return (
    <aside
      className={`hidden md:flex md:sticky md:top-0 md:self-start md:h-screen flex-col shrink-0 border-r border-line bg-surface transition-[width] duration-500 ease-in-out overflow-hidden ${ouverte ? "w-64" : "w-16"}`}
      onMouseEnter={() => setSurvolee(true)}
      onMouseLeave={() => setSurvolee(false)}
    >
      <div className="flex items-center gap-3 px-[18px] py-4 border-b border-line">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-teal shrink-0" aria-hidden />
        {ouverte && <span className="font-display font-semibold text-lg tracking-tight whitespace-nowrap">Cadence</span>}
      </div>
      <nav className="flex-1 pt-5 pb-3 space-y-0.5 overflow-y-auto" aria-label="Navigation principale">
        {ONGLETS.map((o) => {
          const Icone = ICONE_ONGLET[o.id];
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChangerOnglet(o.id)}
              onFocus={() => setSurvolee(true)}
              aria-current={ongletActif === o.id ? "page" : undefined}
              aria-label={o.label}
              title={o.label}
              className={`w-full flex items-center gap-3 px-[18px] py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${
                ongletActif === o.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <span className="w-5 h-5 shrink-0 text-faint" aria-hidden>
                <Icone className="w-5 h-5" />
              </span>
              {ouverte && <span>{o.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-line py-3 space-y-0.5">
        <button
          type="button"
          onClick={onExporter}
          onFocus={() => setSurvolee(true)}
          aria-label="Exporter mes données (JSON)"
          title="Exporter mes données (JSON)"
          className="w-full flex items-center gap-3 px-[18px] py-2 text-xs text-muted hover:text-ink transition-colors"
        >
          <span className="w-5 h-5 shrink-0 flex items-center justify-center" aria-hidden>
            ↓
          </span>
          {ouverte && <span>Exporter mes données (JSON)</span>}
        </button>
        <button
          type="button"
          onClick={onImporter}
          onFocus={() => setSurvolee(true)}
          aria-label="Importer"
          title="Importer"
          className="w-full flex items-center gap-3 px-[18px] py-2 text-xs text-muted hover:text-ink transition-colors"
        >
          <span className="w-5 h-5 shrink-0 flex items-center justify-center" aria-hidden>
            ↑
          </span>
          {ouverte && <span>Importer</span>}
        </button>
        <button
          type="button"
          onClick={() => setEpinglee((v) => !v)}
          onFocus={() => setSurvolee(true)}
          aria-pressed={epinglee}
          aria-label={epinglee ? "Détacher la barre de navigation" : "Épingler la barre de navigation ouverte"}
          title={epinglee ? "Détacher" : "Épingler"}
          className="w-full flex items-center gap-3 px-[18px] py-2 text-xs text-faint hover:text-muted transition-colors"
        >
          <span className="w-5 h-5 shrink-0 flex items-center justify-center" aria-hidden>
            {epinglee ? "◉" : "○"}
          </span>
          {ouverte && <span>{epinglee ? "Détacher" : "Épingler"}</span>}
        </button>
        {session && (
          <AvatarMenu session={session} onChangerOnglet={onChangerOnglet} variante="sidebar" ouverte={ouverte} onFocusRow={() => setSurvolee(true)} />
        )}
      </div>
    </aside>
  );
}
