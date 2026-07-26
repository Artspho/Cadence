import { estPerime, franceTravailConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";

export type Onglet = "dashboard" | "profil" | "contrats" | "import" | "historique" | "simulateur" | "revenus" | "fraisPro";

interface TopBarProps {
  ongletActif: Onglet;
  onChangerOnglet: (onglet: Onglet) => void;
  periodeLabel: string;
  dateDuJour: string;
}

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "profil", label: "Mon profil" },
  { id: "contrats", label: "Contrats" },
  { id: "import", label: "Import PDF" },
  { id: "historique", label: "Historique" },
  { id: "simulateur", label: "Simulateur" },
  { id: "revenus", label: "Revenus mensuels" },
  { id: "fraisPro", label: "Frais pro" },
];

export function TopBar({ ongletActif, onChangerOnglet, periodeLabel, dateDuJour }: TopBarProps) {
  const perime = estPerime(new Date(dateDuJour), franceTravailConfig.meta.valableJusquau);

  return (
    <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1040px] mx-auto px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-teal shrink-0" aria-hidden />
          <span className="font-display font-semibold text-lg tracking-tight">Cadence</span>
        </div>
        <span className="text-xs uppercase tracking-[.03em] text-muted bg-surface-2 border border-line rounded-full px-3 py-1">{periodeLabel}</span>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto" aria-label="Navigation principale">
          {ONGLETS.map((onglet) => (
            <button
              key={onglet.id}
              onClick={() => onChangerOnglet(onglet.id)}
              aria-current={ongletActif === onglet.id ? "page" : undefined}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${
                ongletActif === onglet.id ? "bg-surface-2 text-ink border border-line-strong" : "text-muted hover:text-ink"
              }`}
            >
              {onglet.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="max-w-[1040px] mx-auto px-6 pb-2 -mt-1 flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-[11px] flex items-center gap-1.5 ${perime ? "text-amber" : "text-faint"}`}>
          {perime && (
            <span className="inline-flex items-center gap-1 font-medium" aria-hidden={false}>
              <span aria-hidden>⚠</span> Règles à vérifier —
            </span>
          )}
          Règles vérifiées au {franceTravailConfig.meta.dateEntreeVigueur} — {franceTravailConfig.meta.source}
        </p>
        {EMAIL_FEEDBACK && (
          <a href={construireLienFeedback(EMAIL_FEEDBACK)} className="text-[11px] text-faint hover:text-muted transition-colors shrink-0">
            Un avis ? Écris à {EMAIL_FEEDBACK}
          </a>
        )}
      </div>
    </header>
  );
}
