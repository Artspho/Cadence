/**
 * Menu du compte, ancré sur l'avatar du header (07/08/2026 — refonte UI).
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

export function AvatarMenu({ session, onChangerOnglet, client = obtenirClientAuth() }: AvatarMenuProps) {
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

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label="Menu du compte"
        className="w-8 h-8 rounded-full bg-gradient-to-br from-mint to-teal text-bg font-display font-semibold text-sm flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
      >
        {initialeAvatar(session.email)}
      </MenuButton>
      {/* Desktop : popover ancré sous l'avatar. Mobile (`max-sm:`) : feuille depuis le bas, un seul
          composant, repositionné en CSS pur — cf. plan de refonte, point validé pour l'étape 1. */}
      <MenuItems
        className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-1 shadow-lg focus:outline-none
          max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:right-auto max-sm:mt-0 max-sm:w-full max-sm:rounded-t-hero max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:p-2"
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
        <p role="alert" className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-line bg-surface p-3 text-xs text-red shadow-lg max-sm:inset-x-0 max-sm:w-auto">
          {erreur}
        </p>
      )}
    </Menu>
  );
}
