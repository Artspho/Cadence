// Modale de consentement — commit 4 (phase 6), canal LOCAL uniquement. Même grammaire visuelle que
// ConsentementEnvoiIA.tsx (alertdialog, overlay flouté), mais un rôle différent : l'extraction
// locale a DÉJÀ eu lieu (pdfjs, aucun réseau) au moment où cette modale apparaît — elle ne gate rien
// de nécessaire, elle ne fait que proposer un geste optionnel en plus. D'où deux issues nommées
// différemment de ConsentementEnvoiIA : « continuer sans l'envoyer » n'annule PAS l'import, il
// saute seulement la conservation du fichier.
export function ConsentementConservationDocument({
  nomFichier,
  enCours,
  onConserver,
  onPasser,
}: {
  nomFichier: string;
  enCours: boolean;
  onConserver: () => void;
  onPasser: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titre-consentement-conservation"
      aria-describedby="corps-consentement-conservation"
    >
      <div className="bg-surface border border-line rounded-hero p-6 max-w-[520px] space-y-4">
        <h2 id="titre-consentement-conservation" className="font-display text-lg font-semibold tracking-tight">
          Conserver aussi <span className="text-mint">{nomFichier}</span> sur le serveur ?
        </h2>

        <div id="corps-consentement-conservation" className="space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            Les informations de ce bulletin ont déjà été lues localement, sans quitter ton appareil. Tu peux en plus conserver le fichier lui-même sur le serveur, pour le retrouver
            plus tard dans « Mon dossier » et le retélécharger à tout moment.
          </p>
          <p className="text-sm text-muted leading-relaxed">Si tu préfères ne pas l'envoyer, l'import continue quand même : seules les informations déjà extraites seront enregistrées.</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onConserver}
            disabled={enCours}
            className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {enCours ? "Envoi…" : "Conserver sur le serveur"}
          </button>
          <button onClick={onPasser} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            Non, continuer sans l'envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
