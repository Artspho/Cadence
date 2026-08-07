import type { SessionConnectee } from "../auth/session";
import { AvatarMenu } from "./AvatarMenu";

export type Onglet = "dashboard" | "profil" | "contrats" | "import" | "historique" | "simulateur" | "revenus" | "fraisPro" | "dossier" | "parametres";

interface TopBarProps {
  onChangerOnglet: (onglet: Onglet) => void;
  /** Résolue par le mur (`EcranConnexionObligatoire.tsx`, via `App.tsx`) — `TopBar` n'est jamais rendu avant. */
  session: SessionConnectee;
}

// Nav horizontale retirée à l'étape « sidebar » de la refonte UI (07/08/2026) — remplacée par
// `Sidebar.tsx` (desktop, qui porte aussi désormais le logo) et `BottomTabBar.tsx` (mobile), toutes
// deux dans `onglets.tsx` pour la liste des onglets. Le bandeau réglementaire (« Règles vérifiées
// le… ») et le lien de feedback ont suivi le même mouvement le 07/08/2026 : direction le pied de
// page de `App.tsx`.
//
// Le badge de cycle, seul habitant restant de `TopBar`, a suivi à son tour le 07/08/2026 (idée de
// Benoît) : le cycle en cours vit désormais dans l'onglet « Historique » lui-même (Historique.tsx),
// dans une seule vue chronologique avec les cycles passés, plutôt que dupliqué ici en résumé. Sur
// desktop, `TopBar` n'avait donc plus rien à porter — `Sidebar.tsx` gère déjà l'avatar en bas — d'où
// `md:hidden` : il ne reste que sur mobile, pour l'unique raison qui le justifie encore, l'accès à
// l'avatar (menu du compte, Paramètres).
export function TopBar({ onChangerOnglet, session }: TopBarProps) {
  return (
    <header className="md:hidden border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1040px] mx-auto px-6 py-4 flex items-center justify-end">
        <AvatarMenu session={session} onChangerOnglet={onChangerOnglet} />
      </div>
    </header>
  );
}
