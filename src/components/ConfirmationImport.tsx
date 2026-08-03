// Écran de confirmation avant tout import — garde-fou anti-écrasement
// (devoir sacré n°1). Purement de l'affichage : la logique (sauvegarde
// automatique, validation, écriture) vit entièrement dans App.tsx /
// storage/localStorageAdapter.ts, jamais ici.
interface ConfirmationImportProps {
  nbContratsActuels: number;
  profilActuel: boolean;
  nomFichier: string;
  enCours: boolean;
  onAnnuler: () => void;
  onConfirmer: () => void;
}

export function ConfirmationImport({ nbContratsActuels, profilActuel, nomFichier, enCours, onAnnuler, onConfirmer }: ConfirmationImportProps) {
  // Rien à écraser : ni profil, ni contrat. Cas du chemin de récupération ouvert au point 23
  // (restauration depuis l'écran d'onboarding) — mais aussi de n'importe quel import sur une app
  // vide. Annoncer « Action irréversible / ceci va remplacer tes données actuelles » y serait
  // faux, et anxiogène au pire moment : celui de quelqu'un qui vient justement de tout perdre.
  // Le devoir sacré n°2 vaut aussi pour les avertissements — un avertissement sans objet est un
  // faux avertissement. Le chemin d'écriture, lui, est rigoureusement le même dans les deux cas
  // (App.tsx, confirmerImport : sauvegarde, puis validation, puis écriture).
  const rienAEcraser = nbContratsActuels === 0 && !profilActuel;
  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="titre-confirmation-import">
      <div className={`bg-surface border rounded-hero p-6 max-w-[520px] space-y-4 ${rienAEcraser ? "border-mint/30" : "border-amber/30"}`}>
        {!rienAEcraser && (
          <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-amber/15 text-amber">
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
            Action irréversible
          </span>
        )}
        <h2 id="titre-confirmation-import" className="font-display text-lg font-semibold tracking-tight">
          {rienAEcraser ? "Restaurer cette sauvegarde" : "Ceci va remplacer tes données actuelles"}
        </h2>
        {rienAEcraser ? (
          <p className="text-sm text-muted leading-relaxed">
            Tu es sur le point de restaurer <span className="text-ink">{nomFichier}</span>. Cadence est vide pour l'instant : <span className="text-ink">rien ne sera écrasé</span>.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted leading-relaxed">
              Tu es sur le point d'importer <span className="text-ink">{nomFichier}</span>. Ça va remplacer{" "}
              <span className="text-ink">
                {nbContratsActuels} contrat{nbContratsActuels > 1 ? "s" : ""} enregistré{nbContratsActuels > 1 ? "s" : ""}
              </span>
              {profilActuel ? " et ton profil actuel" : ""}.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              Une sauvegarde de ton état actuel va être <span className="text-ink">téléchargée automatiquement</span> avant le remplacement, que
              l'import réussisse ou non — tu pourras toujours revenir en arrière en la réimportant.
            </p>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onConfirmer}
            disabled={enCours}
            className={`flex-1 text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${rienAEcraser ? "bg-mint" : "bg-amber"}`}
          >
            {enCours ? "Import en cours…" : rienAEcraser ? "Restaurer" : "Continuer"}
          </button>
          <button onClick={onAnnuler} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
