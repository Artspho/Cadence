import { useState } from "react";
import type { ConfigFraisReels, ResultatFraisReels } from "../../types/fraisReels";
import { genererTexteDeclaration } from "../../engine/fraisReels";

interface DeclarationTexteProps {
  resultat: ResultatFraisReels;
  config: ConfigFraisReels;
}

export function DeclarationTexte({ resultat, config }: DeclarationTexteProps) {
  const [texte, setTexte] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  async function copier() {
    if (!texte) return;
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible (permissions navigateur) — le texte reste sélectionnable
      // manuellement dans le textarea, aucune fonctionnalité perdue.
    }
  }

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">Sortie déclaration</h2>
        <p className="text-sm text-muted">Texte prêt à copier-coller dans la case dédiée sur impots.gouv.fr.</p>
      </div>

      {!texte ? (
        <button onClick={() => setTexte(genererTexteDeclaration(resultat, config))} className="bg-mint text-bg font-medium rounded-lg px-4 py-2.5 text-sm">
          Générer le texte de déclaration
        </button>
      ) : (
        <div className="space-y-3">
          <textarea readOnly value={texte} rows={14} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-ink" />
          <div className="flex items-center gap-2">
            <button onClick={copier} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm">
              {copie ? "Copié !" : "Copier"}
            </button>
            <button onClick={() => setTexte(genererTexteDeclaration(resultat, config))} className="px-4 py-2 rounded-lg border border-line text-muted text-sm">
              Regénérer
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-3 py-2">
        Indicatif · Source SNAM-CGT mars 2026 · Les règles fiscales peuvent évoluer.
      </p>
    </section>
  );
}
