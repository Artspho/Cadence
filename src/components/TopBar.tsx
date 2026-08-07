import { franceTravailConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { formaterDateLisible } from "../lib/dateLisible";
import type { SessionConnectee } from "../auth/session";
import { AvatarMenu } from "./AvatarMenu";

export type Onglet = "dashboard" | "profil" | "contrats" | "import" | "historique" | "simulateur" | "revenus" | "fraisPro" | "dossier" | "parametres";

// `dateDuJour` a été retirée des props le 03/08/2026 : elle ne servait qu'à `estPerime`, supprimé
// avec la bannière de péremption (point 13). Le bandeau n'énonce plus qu'un fait déclaré en config,
// qui ne dépend pas du jour où on le lit.
interface TopBarProps {
  onChangerOnglet: (onglet: Onglet) => void;
  periodeLabel: string;
  /** Résolue par le mur (`EcranConnexionObligatoire.tsx`, via `App.tsx`) — `TopBar` n'est jamais rendu avant. */
  session: SessionConnectee;
}

// Nav horizontale retirée à l'étape « sidebar » de la refonte UI (07/08/2026) — remplacée par
// `Sidebar.tsx` (desktop) et `BottomTabBar.tsx` (mobile), toutes deux dans `onglets.tsx` pour la
// liste des onglets. `TopBar` ne porte plus que le logo, le badge de période et — sur mobile
// seulement — l'avatar : sur desktop, il vit désormais en bas de `Sidebar.tsx` (`onChangerOnglet`
// reste utile ici : c'est lui que consomme `AvatarMenu` pour aller aux Paramètres).
export function TopBar({ onChangerOnglet, periodeLabel, session }: TopBarProps) {
  return (
    <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1040px] mx-auto px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-mint to-teal shrink-0" aria-hidden />
          <span className="font-display font-semibold text-lg tracking-tight">Cadence</span>
        </div>
        <span className="text-xs uppercase tracking-[.03em] text-muted bg-surface-2 border border-line rounded-full px-3 py-1">{periodeLabel}</span>
        <div className="ml-auto md:hidden">
          <AvatarMenu session={session} onChangerOnglet={onChangerOnglet} />
        </div>
      </div>
      <div className="max-w-[1040px] mx-auto px-6 pb-2 -mt-1 flex items-center justify-between gap-3 flex-wrap">
        {/* Une seule date affichée, et c'est bien celle de la dernière vérification — plus
            `dateEntreeVigueur`, qui datait l'entrée en vigueur du SMIC et n'avait rien à faire
            derrière ce libellé (point 14). Chaque source porte sa propre date dans `meta.source`. */}
        <p className="text-[11px] flex items-center gap-1.5 text-faint">
          Règles vérifiées le {formaterDateLisible(franceTravailConfig.meta.dateDerniereVerification)} — {franceTravailConfig.meta.source}
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
