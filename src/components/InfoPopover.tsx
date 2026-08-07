/**
 * Info-bulle légère (icône « i ») pour du texte explicatif qu'on ne veut plus imposer en pleine page
 * (refonte UI, 07/08/2026 — remplace les sections « Périmètre du MVP »/« Limites structurelles » de
 * `MonProfil.tsx`).
 *
 * État React simple plutôt que `Popover` de Headless UI : Headless UI ne s'ouvre nativement qu'au
 * clic/focus, pas au survol, et le geste demandé ici est « survol desktop, tap mobile » — une
 * enveloppe maison est plus directe qu'un contournement de la state machine de Headless UI pour un
 * composant aussi simple.
 */

import { useEffect, useRef, useState } from "react";

interface InfoPopoverProps {
  titre: string;
  children: React.ReactNode;
  /** Vers l'onglet Paramètres, où le texte complet vit aussi (cf. ParametresSourcesEtMentions.tsx). */
  onEnSavoirPlus: () => void;
}

export function InfoPopover({ titre, children, onEnSavoirPlus }: InfoPopoverProps) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  return (
    <div ref={conteneur} className="relative inline-block" onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-label={`En savoir plus : ${titre}`}
        className="w-4 h-4 rounded-full border border-line-strong text-[10px] leading-none text-faint hover:text-ink hover:border-ink transition-colors inline-flex items-center justify-center"
      >
        i
      </button>
      {ouvert && (
        <div role="tooltip" className="absolute z-20 mt-2 w-72 max-w-[80vw] rounded-card border border-line bg-surface p-3 shadow-lg text-xs text-muted leading-relaxed space-y-2 left-0">
          {children}
          <button type="button" onClick={onEnSavoirPlus} className="block text-mint hover:underline">
            En savoir plus →
          </button>
        </div>
      )}
    </div>
  );
}
