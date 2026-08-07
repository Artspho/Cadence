import type { SessionConnectee } from "../auth/session";
import { AvatarMenu } from "./AvatarMenu";

export type Onglet = "dashboard" | "profil" | "contrats" | "import" | "historique" | "simulateur" | "revenus" | "fraisPro" | "dossier" | "parametres";

// `dateDuJour` a été retirée des props le 03/08/2026 : elle ne servait qu'à `estPerime`, supprimé
// avec la bannière de péremption (point 13). Le bandeau n'énonce plus qu'un fait déclaré en config,
// qui ne dépend pas du jour où on le lit.
interface TopBarProps {
  onChangerOnglet: (onglet: Onglet) => void;
  periodeLabel: string;
  /** Pour surligner le badge de cycle quand on est déjà sur « Historique » — cf. le commentaire
   * juste au-dessus du bouton. */
  ongletActif: Onglet;
  /** Résolue par le mur (`EcranConnexionObligatoire.tsx`, via `App.tsx`) — `TopBar` n'est jamais rendu avant. */
  session: SessionConnectee;
}

// Nav horizontale retirée à l'étape « sidebar » de la refonte UI (07/08/2026) — remplacée par
// `Sidebar.tsx` (desktop, qui porte aussi désormais le logo) et `BottomTabBar.tsx` (mobile), toutes
// deux dans `onglets.tsx` pour la liste des onglets. Le bandeau réglementaire (« Règles vérifiées
// le… ») et le lien de feedback ont suivi le même mouvement le 07/08/2026 : direction le pied de
// page de `App.tsx`, une information de bas de page plutôt qu'un habillage d'en-tête. `TopBar` ne
// porte donc plus que le badge de cycle et — sur mobile seulement — l'avatar : sur desktop, il vit
// désormais en bas de `Sidebar.tsx` (`onChangerOnglet` reste utile ici : c'est lui que consomme
// `AvatarMenu` pour aller aux Paramètres).
export function TopBar({ onChangerOnglet, periodeLabel, ongletActif, session }: TopBarProps) {
  return (
    <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1040px] mx-auto px-6 py-4 flex items-center gap-4">
        {/* Le badge de cycle se comporte comme un onglet (07/08/2026, à la demande de Benoît) plutôt
            que comme une simple étiquette : cliquer y bascule sur « Historique », qui détaille déjà
            chaque cycle passé (dates, heures, AJ) — pas la peine d'inventer un second écran pour la
            même information. */}
        <button
          type="button"
          onClick={() => onChangerOnglet("historique")}
          aria-current={ongletActif === "historique" ? "page" : undefined}
          title="Voir l'historique de chaque cycle"
          className={`text-xs uppercase tracking-[.03em] rounded-full px-3 py-1 border transition-colors ${
            ongletActif === "historique" ? "bg-surface-2 text-ink border-line" : "text-muted bg-surface-2 border-line hover:text-ink"
          }`}
        >
          {periodeLabel}
        </button>
        <div className="ml-auto md:hidden">
          <AvatarMenu session={session} onChangerOnglet={onChangerOnglet} />
        </div>
      </div>
    </header>
  );
}
