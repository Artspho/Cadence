/**
 * PHASE 5 — LE BANDEAU D'ÉCHEC D'ENREGISTREMENT SERVEUR.
 *
 * POURQUOI IL EXISTE, alors que la section « Compte » porte déjà un témoin : ce témoin n'est visible
 * que si on navigue jusqu'à l'onglet « Mon profil » — et la section « Compte » est tout en bas, si peu
 * trouvable que Benoît l'a déjà prise pour une panne. Depuis la bascule, un échec d'enregistrement
 * signifie que la saisie n'est PAS à l'endroit qui fait référence. Le laisser dans un onglet
 * reviendrait à cacher exactement l'information qu'il faut voir tout de suite.
 *
 * Rouge et non refermable, comme `BandeauStockagePlein` : tant qu'il est là, ce qui vient d'être saisi
 * n'est pas là où on le croit. Et surtout, la formulation ne rassure pas à tort — la saisie est bien
 * dans ce navigateur, mais ce navigateur n'est plus la référence, et c'est CE décalage qui doit être
 * dit. La copie locale existe et l'export est à portée de clic : c'est le seul geste qui met à l'abri.
 */

interface BandeauEchecEnregistrementProps {
  /** Message brut du serveur — affiché tel quel, jamais reformulé. */
  message: string;
  onExporter: () => void;
}

export function BandeauEchecEnregistrement({ message, onExporter }: BandeauEchecEnregistrementProps) {
  return (
    <div role="alert" className="bg-red/15 text-red px-6 py-3 text-sm">
      <p>
        <strong className="font-medium">Ta dernière modification n'est pas enregistrée sur le serveur.</strong> Elle est dans ce navigateur, donc tu ne l'as pas perdue — mais c'est le
        serveur qui fait référence depuis un autre appareil, et il ne l'a pas. Cadence réessaiera à ta prochaine modification.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" onClick={onExporter} className="bg-red text-bg font-medium rounded-lg px-3 py-1.5 text-xs">
          Télécharger ma sauvegarde maintenant
        </button>
        <span className="text-xs opacity-80 font-mono break-words">{message}</span>
      </div>
    </div>
  );
}
