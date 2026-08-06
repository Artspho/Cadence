/**
 * Le cadre plein écran des écrans d'accès, extrait le 06/08/2026.
 *
 * Deux écrans le partagent désormais, et c'est la raison de cette extraction : le mur
 * (`EcranConnexionObligatoire.tsx`) et l'écran de nouveau mot de passe
 * (`EcranNouveauMotDePasse.tsx`), qui arrive au retour du lien de réinitialisation. Recopier ces
 * quelques classes aurait suffi techniquement, mais c'est exactement comme ça qu'un projet finit avec
 * deux écrans d'accès qui divergent visuellement sans que personne ne l'ait décidé.
 *
 * Rien ici ne connaît l'authentification : ce fichier ne porte que la mise en page.
 */

export function CadrePleinEcran({ enTete, children }: { enTete?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6 py-10">
      <div className="max-w-[420px] w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-medium">Cadence</h1>
          {enTete}
        </div>
        <div className="bg-surface border border-line rounded-card p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * LES DEUX POIDS DE BOUTON, DÉFINIS UNE FOIS — ET LA RAISON EST UN VRAI DÉFAUT, PAS UNE PRÉFÉRENCE.
 *
 * Le 06/08/2026, Benoît n'a pas pu créer de compte : « Créer un compte reste grisé même avec la case
 * cochée ». Mesuré dans le navigateur, le bouton était bel et bien ACTIF (`disabled=false`, curseur
 * main) — mais son seul écart visuel entre actif et inactif était une opacité de 0,4 à 1, sur du texte
 * gris `text-muted` posé sur un fond transparent, à côté d'un bouton vert vif. Il était donc illisible
 * comme actif. Un test vérifiait pourtant `not.toBeDisabled()` et passait : un test ne compare un
 * composant qu'à lui-même, jamais à ce qu'un œil humain en conclut.
 *
 * D'où la règle : l'action principale d'un écran porte TOUJOURS `PRINCIPAL` (fond plein), et un bouton
 * désactivé doit l'être de façon franche. Ne pas remettre une action essentielle en style secondaire.
 */
export const BOUTON_PRINCIPAL =
  "w-full bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed";

/** Style des actions vraiment secondaires (revenir en arrière, basculer de formulaire). */
export const BOUTON_SECONDAIRE = "w-full rounded-lg border border-line text-ink py-2.5 disabled:opacity-40 disabled:cursor-not-allowed";

export const CLASSE_CHAMP = "w-full bg-surface-2 border border-line rounded-lg px-3 py-2";
export const CLASSE_ETIQUETTE = "block text-xs uppercase tracking-[.03em] text-muted mb-1";
