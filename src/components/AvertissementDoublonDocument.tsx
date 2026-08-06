// Avertissement affiché quand `chercherDoublon` trouve, dans « Mon dossier », un document du même nom
// ET de la même taille que celui qu'on est en train de conserver. Ne bloque jamais : « conserver quand
// même » reste toujours possible, pour ne pas empêcher un dépôt légitime (devoir n°1) sur la seule base
// d'une coïncidence de nom/taille.
import { formaterDateLisible } from "../lib/dateLisible";

export function AvertissementDoublonDocument({
  nomFichier,
  dateDepotExistant,
  enCours,
  onConfirmer,
  onIgnorer,
}: {
  nomFichier: string;
  dateDepotExistant: string;
  enCours: boolean;
  onConfirmer: () => void;
  onIgnorer: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titre-avertissement-doublon"
      aria-describedby="corps-avertissement-doublon"
    >
      <div className="bg-surface border border-line rounded-hero p-6 max-w-[520px] space-y-4">
        <h2 id="titre-avertissement-doublon" className="font-display text-lg font-semibold tracking-tight">
          Ce fichier semble déjà dans « Mon dossier »
        </h2>

        <p id="corps-avertissement-doublon" className="text-sm text-muted leading-relaxed">
          Un document du même nom (<span className="text-ink">{nomFichier}</span>) et de la même taille a déjà été déposé le{" "}
          <span className="text-ink">{formaterDateLisible(dateDepotExistant)}</span>. C'est peut-être le même fichier importé deux fois.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onIgnorer}
            disabled={enCours}
            className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Ne pas le conserver à nouveau
          </button>
          <button onClick={onConfirmer} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            {enCours ? "Envoi…" : "Conserver quand même"}
          </button>
        </div>
      </div>
    </div>
  );
}
