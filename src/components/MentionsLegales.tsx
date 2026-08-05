// Modale des mentions légales et de la politique de confidentialité — même grammaire visuelle que
// ConsentementEnvoiIA.tsx (alertdialog, overlay flouté), sans le badge ambre : ce n'est pas une
// décision à prendre, seulement une référence à lire.
//
// Un seul lien d'entrée (section « Mon profil »), un seul texte (content/mentionsLegales.ts) : pas de
// seconde copie qui pourrait diverger.

import { CONTACT_LEGAL, MENTIONS_LEGALES, POLITIQUE_CONFIDENTIALITE, type SectionLegale } from "../content/mentionsLegales";

function Section({ section }: { section: SectionLegale }) {
  return (
    <div>
      <h3 className="font-display text-sm font-medium tracking-tight mb-1.5">{section.titre}</h3>
      <div className="space-y-1.5">
        {section.paragraphes.map((paragraphe, i) => (
          <p key={i} className="text-sm text-muted leading-relaxed">
            {paragraphe}
          </p>
        ))}
      </div>
    </div>
  );
}

export function MentionsLegales({ onFermer }: { onFermer: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titre-mentions-legales"
    >
      <div className="bg-surface border border-line rounded-hero p-6 max-w-[560px] max-h-[85vh] overflow-y-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="titre-mentions-legales" className="font-display text-lg font-semibold tracking-tight">
            Mentions légales &amp; confidentialité
          </h2>
          <button onClick={onFermer} className="text-muted hover:text-ink transition-colors shrink-0" aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[.03em] text-faint">Mentions légales</p>
          {MENTIONS_LEGALES.map((section) => (
            <Section key={section.titre} section={section} />
          ))}
        </div>

        <div className="border-t border-line pt-4 space-y-4">
          <p className="text-xs uppercase tracking-[.03em] text-faint">Politique de confidentialité</p>
          {POLITIQUE_CONFIDENTIALITE.map((section) => (
            <Section key={section.titre} section={section} />
          ))}
        </div>

        <p className="text-xs text-faint leading-relaxed">
          Une question, une demande sur tes données ? Écris à {CONTACT_LEGAL}.
        </p>
      </div>
    </div>
  );
}
