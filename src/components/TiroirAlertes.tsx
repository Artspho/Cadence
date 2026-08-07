/**
 * Tiroir d'alertes (refonte UI, 07/08/2026) — remplace l'affichage en ligne d'`AlertCenter.tsx`,
 * jusqu'ici empilé au-dessus de `Dashboard.tsx` et visible uniquement sur cet onglet. Ouvert depuis
 * n'importe quel onglet par le badge `AlertCenterResume` (App.tsx), devenu cliquable.
 *
 * Wrapper de POSITIONNEMENT uniquement : la logique et le rendu des alertes restent dans
 * `AlertCenter.tsx`, inchangés. Non-modal à dessein (pas de `Dialog` Headless UI, pas d'overlay
 * assombrissant l'arrière-plan) : le graphique et les KPI du tableau de bord ne doivent jamais être
 * masqués, décision validée du plan de refonte.
 *
 * Desktop : panneau fixe à droite. Mobile (`max-sm:`) : feuille qui monte du bas.
 */

import { useEffect, useRef } from "react";
import type { Alerte } from "../types";
import { AlertCenter } from "./AlertCenter";

interface TiroirAlertesProps {
  ouvert: boolean;
  onFermer: () => void;
  alertes: Alerte[];
  /**
   * Vrai quand la seule alerte qui existerait ici (la contradiction Annexe 10) est déjà annoncée par
   * le bandeau dédié de l'onglet courant (`AvertissementContradictionHorsA10`, visible sur Tableau de
   * bord/Historique/Simulateur/Revenus mensuels) — même dédoublonnage que l'ancien affichage en ligne
   * (cf. `lib/alertesAffichage.ts`), étendu à tous les onglets puisque le tiroir, lui, s'ouvre partout.
   * Sans ce cas, le tiroir afficherait « ✓ Aucune alerte » juste à côté d'un bandeau critique — le
   * faux feu vert que ce dédoublonnage existe justement pour éviter (devoir sacré n°2).
   */
  masqueeParBandeauContradiction: boolean;
}

export function TiroirAlertes({ ouvert, onFermer, alertes, masqueeParBandeauContradiction }: TiroirAlertesProps) {
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
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
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      ref={panneau}
      role="complementary"
      aria-label="Alertes"
      className="fixed z-30 bg-surface border-line shadow-lg overflow-y-auto
        right-0 top-0 h-full w-[360px] max-w-[90vw] border-l
        max-sm:inset-x-0 max-sm:right-auto max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[80vh] max-sm:w-auto max-sm:max-w-none max-sm:border-l-0 max-sm:border-t max-sm:rounded-t-hero"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-surface">
        <h2 className="font-display text-base font-medium tracking-tight">Alertes</h2>
        <button type="button" onClick={onFermer} className="text-muted hover:text-ink transition-colors" aria-label="Fermer le tiroir d'alertes">
          ✕
        </button>
      </div>
      <div className="p-5">
        {masqueeParBandeauContradiction ? (
          <p className="text-sm text-muted leading-relaxed">La seule alerte en cours est déjà affichée en haut de cet onglet — rien d'autre à signaler ici.</p>
        ) : (
          <AlertCenter alertes={alertes} />
        )}
      </div>
    </div>
  );
}
