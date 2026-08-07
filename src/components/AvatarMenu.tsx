/**
 * Menu du compte (07/08/2026 — refonte UI). Vit en bas de `Sidebar.tsx` sur desktop (variante
 * "sidebar", pastille + libellé au survol comme le reste de la barre) et dans `TopBar.tsx` sur mobile
 * uniquement (variante par défaut "topbar", `md:hidden` côté appelant — la sidebar n'existe pas sous
 * `md:`, donc sans ce repli mobile le menu du compte deviendrait inatteignable sur petit écran).
 *
 * Deux gestes : aller aux « Paramètres » (nouvel onglet, cf. ParametresSourcesEtMentions.tsx) et
 * « Se déconnecter ». La section « Compte » complète (changement de mot de passe, témoin
 * d'enregistrement serveur) reste dans « Mon profil » (`Compte.tsx`) — un formulaire de mot de passe
 * n'a pas sa place dans un menu déroulant.
 */

import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { obtenirClientAuth, type ClientAuth } from "../auth/supabaseClient";
import type { SessionConnectee } from "../auth/session";
import { seDeconnecter } from "../auth/actions";
import type { Onglet } from "./TopBar";

interface AvatarMenuProps {
  session: SessionConnectee;
  onChangerOnglet: (onglet: Onglet) => void;
  /** Injecté par les tests ; par défaut le client de l'app (même pattern que `Compte.tsx`). */
  client?: ClientAuth | null;
  /** "topbar" (défaut) : pastille seule, menu ancré à droite sous le bouton. "sidebar" : ligne
   * pleine largeur assortie aux autres boutons de `Sidebar.tsx`, menu ouvert vers le haut (le bouton
   * vit tout en bas de la barre, un menu qui s'ouvrirait vers le bas sortirait de l'écran). */
  variante?: "topbar" | "sidebar";
  /** Sidebar dépliée ou repliée — ignoré en variante "topbar". Contrôle l'affichage du libellé. */
  ouverte?: boolean;
  /** Variante "sidebar" uniquement : relaie le focus du bouton pour garder la barre déployée, même
   * mécanisme que les autres boutons de `Sidebar.tsx` (`onFocus={() => setSurvolee(true)}`). */
  onFocusRow?: () => void;
}

/**
 * L'initiale affichée sur l'avatar. Dérivée de l'e-mail, seule donnée garantie sur une session
 * connectée (`Profil` ne porte pas de prénom rattaché au compte) — jamais devinée : `null` rend un
 * caractère générique plutôt qu'une lettre inventée.
 */
function initialeAvatar(email: string | null): string {
  const car = email?.trim().charAt(0);
  return car ? car.toUpperCase() : "?";
}

export function AvatarMenu({ session, onChangerOnglet, client = obtenirClientAuth(), variante = "topbar", ouverte = true, onFocusRow }: AvatarMenuProps) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Même remarque que `Compte.tsx` : un succès n'a rien à faire ici, `App.tsx` détecte le changement
  // de session via son propre `useSession` et remplace tout le rendu par le mur de connexion.
  async function deconnecter() {
    if (!client) return;
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await seDeconnecter(client);
      if (!resultat.ok) setErreur(resultat.message);
    } finally {
      setEnCours(false);
    }
  }

  const pastille = (
    <span
      className={
        variante === "sidebar"
          ? "w-5 h-5 shrink-0 rounded-full bg-gradient-to-br from-mint to-teal text-bg font-display font-semibold text-[10px] flex items-center justify-center"
          : "w-8 h-8 rounded-full bg-gradient-to-br from-mint to-teal text-bg font-display font-semibold text-sm flex items-center justify-center"
      }
      aria-hidden={variante === "sidebar"}
    >
      {initialeAvatar(session.email)}
    </span>
  );

  return (
    <Menu as="div" className={variante === "sidebar" ? "relative w-full" : "relative shrink-0"}>
      {variante === "sidebar" ? (
        <MenuButton
          onFocus={onFocusRow}
          aria-label="Menu du compte"
          title="Mon compte"
          className="w-full flex items-center gap-3 px-[18px] py-2 text-xs text-muted hover:text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        >
          {pastille}
          {ouverte && <span className="truncate">{session.email ?? "Mon compte"}</span>}
        </MenuButton>
      ) : (
        <MenuButton aria-label="Menu du compte" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint rounded-full">
          {pastille}
        </MenuButton>
      )}
      {/* Variante "topbar" desktop : popover ancré sous l'avatar. Mobile (`max-sm:`) : feuille depuis
          le bas, un seul composant, repositionné en CSS pur — cf. plan de refonte, point validé pour
          l'étape 1. Variante "sidebar" : le bouton vit tout en bas de la barre, donc le popover
          s'ouvre vers le HAUT (`bottom-full`) — vers le bas, il sortirait de l'écran. */}
      <MenuItems
        className={
          variante === "sidebar"
            ? "absolute left-0 bottom-full z-20 mb-2 w-56 rounded-card border border-line bg-surface p-1 shadow-lg focus:outline-none"
            : "absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-1 shadow-lg focus:outline-none max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:right-auto max-sm:mt-0 max-sm:w-full max-sm:rounded-t-hero max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:p-2"
        }
      >
        <div className="px-3 py-2 text-xs text-faint truncate">{session.email ?? session.utilisateurId}</div>
        <MenuItem>
          <button
            type="button"
            onClick={() => onChangerOnglet("parametres")}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted data-focus:bg-surface-2 data-focus:text-ink"
          >
            Paramètres
          </button>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={deconnecter}
            disabled={enCours}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted data-focus:bg-surface-2 data-focus:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enCours ? "…" : "Se déconnecter"}
          </button>
        </MenuItem>
      </MenuItems>
      {/* En dehors de `MenuItems`, volontairement : sélectionner un item ferme le menu (comportement
          Headless UI standard), donc un message placé à l'intérieur disparaîtrait avant même que la
          déconnexion échouée n'ait eu le temps de s'afficher. */}
      {erreur !== null && (
        <p
          role="alert"
          className={
            variante === "sidebar"
              ? "absolute left-0 bottom-full z-20 mb-2 w-56 rounded-card border border-line bg-surface p-3 text-xs text-red shadow-lg"
              : "absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-3 text-xs text-red shadow-lg max-sm:inset-x-0 max-sm:w-auto"
          }
        >
          {erreur}
        </p>
      )}
    </Menu>
  );
}
