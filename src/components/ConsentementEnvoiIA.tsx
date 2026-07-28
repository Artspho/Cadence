// Modale de consentement, affichée APRÈS le dépôt du fichier et AVANT tout appel réseau.
//
// Calquée sur ConfirmationImport.tsx, l'autre porte bloquante de l'app (même grammaire visuelle :
// alertdialog, badge ambre, deux issues nommées). Purement de l'affichage : le `fetch` ne vit PAS
// ici, il vit dans le gestionnaire branché sur `onConfirmer` — même principe que ConfirmationImport,
// dont la logique reste entièrement dans App.tsx.
//
// Le garde-fou tient par construction, pas par discipline : l'appelant ne doit connaître qu'un seul
// chemin vers le réseau (`lib/extraireDocumentIA.ts`), et ce chemin part de `onConfirmer`. Tant que
// l'utilisateur n'a pas cliqué « Envoyer ce document », zéro octet ne quitte l'appareil.
//
// Bloquante à CHAQUE envoi, sans case « ne plus afficher » : une telle case recréerait le
// consentement unique en petits caractères, exactement ce que la décision du 28/07/2026 exclut
// (cf. content/mentionEnvoiIA.ts pour le pourquoi).

import { LIBELLE_ANNULER, LIBELLE_ENVOYER, MENTION_ENVOI_IA_PHRASES } from "../content/mentionEnvoiIA";

interface ConsentementEnvoiIAProps {
  /** Nom du fichier déposé, pour que l'utilisateur sache exactement ce qu'il s'apprête à envoyer. */
  nomFichier: string;
  /** Envoi en cours : neutralise les deux boutons, évite le double envoi d'un même document. */
  enCours: boolean;
  onAnnuler: () => void;
  onConfirmer: () => void;
}

export function ConsentementEnvoiIA({ nomFichier, enCours, onAnnuler, onConfirmer }: ConsentementEnvoiIAProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titre-consentement-ia"
      aria-describedby="corps-consentement-ia"
    >
      <div className="bg-surface border border-amber/30 rounded-hero p-6 max-w-[520px] space-y-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-amber/15 text-amber">
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
          Ce document va quitter ton appareil
        </span>

        <h2 id="titre-consentement-ia" className="font-display text-lg font-semibold tracking-tight">
          Envoyer <span className="text-amber">{nomFichier}</span> pour lecture automatique ?
        </h2>

        {/* La mention validée, en entier. Les trois phrases viennent d'une source unique et leur
            concaténation est testée : impossible d'en afficher une version tronquée par accident. */}
        <div id="corps-consentement-ia" className="space-y-3">
          <p className="text-sm text-muted leading-relaxed">{MENTION_ENVOI_IA_PHRASES[0]}</p>
          {/* La phrase qui coûte : traitée comme telle, pas noyée dans le paragraphe. */}
          <p className="text-sm text-ink leading-relaxed bg-amber/10 border border-amber/20 rounded-lg px-3 py-2.5">
            {MENTION_ENVOI_IA_PHRASES[1]}
          </p>
          <p className="text-sm text-muted leading-relaxed">{MENTION_ENVOI_IA_PHRASES[2]}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onConfirmer}
            disabled={enCours}
            className="flex-1 bg-amber text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {enCours ? "Envoi en cours…" : LIBELLE_ENVOYER}
          </button>
          <button onClick={onAnnuler} disabled={enCours} className="px-4 rounded-lg border border-line text-muted disabled:opacity-40">
            {LIBELLE_ANNULER}
          </button>
        </div>
      </div>
    </div>
  );
}
