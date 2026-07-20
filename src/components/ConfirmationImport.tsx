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
  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="titre-confirmation-import">
      <div className="bg-surface border border-amber/30 rounded-hero p-6 max-w-[520px] space-y-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-amber/15 text-amber">
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
          Action irréversible
        </span>
        <h2 id="titre-confirmation-import" className="font-display text-lg font-semibold tracking-tight">
          Ceci va remplacer tes données actuelles
        </h2>
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
        <div className="flex gap-2 pt-2">
          <button
            onClick={onConfirmer}
            disabled={enCours}
            className="flex-1 bg-amber text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {enCours ? "Import en cours…" : "Continuer"}
          </button>
          <button onClick={onAnnuler} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
