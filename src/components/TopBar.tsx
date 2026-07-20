import { franceTravailConfig } from "../config/franceTravailConfig";

export type Onglet = "dashboard" | "contrats" | "import" | "historique" | "simulateur" | "apropos";

interface TopBarProps {
  ongletActif: Onglet;
  onChangerOnglet: (onglet: Onglet) => void;
  periodeLabel: string;
}

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "contrats", label: "Contrats" },
  { id: "import", label: "Import PDF" },
  { id: "historique", label: "Historique" },
  { id: "simulateur", label: "Simulateur" },
  { id: "apropos", label: "À propos" },
];

export function TopBar({ ongletActif, onChangerOnglet, periodeLabel }: TopBarProps) {
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
      <div className="max-w-[1040px] mx-auto px-6 pb-2 -mt-1">
        <p className="text-[11px] text-faint">Règles vérifiées au {franceTravailConfig.meta.dateEntreeVigueur} — {franceTravailConfig.meta.source}</p>
      </div>
    </header>
  );
}
