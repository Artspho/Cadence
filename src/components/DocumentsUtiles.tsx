/**
 * Référence STATIQUE des documents utiles à Cadence, groupés par situation.
 *
 * À ne pas confondre avec `ChecklistDocuments.tsx` (onglet Import PDF) : celle-ci lit l'état réel
 * du profil pour dire ce qui manque encore ; celle-ci ne lit RIEN — aucune prop de données, aucun
 * statut « reçu / manquant ». C'est un inventaire à consulter une fois, pas un badge qui bouge avec
 * la saisie (cf. content/documentsUtiles.ts pour la distinction complète).
 *
 * Repliée par défaut, même grammaire que ChecklistDocuments.tsx : vue d'ensemble d'abord.
 */

import { GROUPES_DOCUMENTS_UTILES, type DocumentUtile } from "../content/documentsUtiles";

const LIBELLE_ROLE: Record<DocumentUtile["role"], string> = {
  indispensable: "indispensable",
  utile: "utile",
  complement: "en complément",
};

const LIBELLE_CANAL: Record<DocumentUtile["canal"], string> = {
  ia_possible: "dépôt IA possible",
  manuel_uniquement: "saisie manuelle",
};

function LigneDocument({ doc }: { doc: DocumentUtile }) {
  return (
    <details className="border-b border-line last:border-b-0 group">
      <summary className="px-4 py-3 text-sm cursor-pointer list-none flex items-start gap-2 hover:bg-surface-2/50 transition-colors">
        <span className="text-faint text-xs mt-1 group-open:rotate-90 transition-transform" aria-hidden>
          ▸
        </span>
        <span className="flex items-center justify-between gap-3 flex-wrap w-full">
          <span className="text-ink">{doc.nom}</span>
          <span className="flex gap-1.5">
            <span className="text-xs rounded-full border px-2.5 py-0.5 whitespace-nowrap bg-surface-2 border-line text-muted">{LIBELLE_ROLE[doc.role]}</span>
            <span className="text-xs rounded-full border px-2.5 py-0.5 whitespace-nowrap bg-surface-2 border-line text-faint">{LIBELLE_CANAL[doc.canal]}</span>
          </span>
        </span>
      </summary>
      <div className="px-4 pb-4 pl-9 space-y-2 text-sm">
        <p className="text-muted leading-relaxed">{doc.pourquoi}</p>
        <p className="text-xs text-faint leading-relaxed">{doc.noteCanal}</p>
      </div>
    </details>
  );
}

export function DocumentsUtiles() {
  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-sm font-medium tracking-tight">Documents à rassembler</h4>
        <p className="text-xs text-faint leading-relaxed mt-1">
          Une référence à lire une fois — pas un suivi de ce qu'il te manque : pour ça, l'espace dépôt (onglet « Import PDF ») calcule une checklist à jour de tes vraies données.
        </p>
      </div>
      <div className="border-t border-line">
        {GROUPES_DOCUMENTS_UTILES.map((groupe) => (
          <div key={groupe.titre}>
            <p className="px-4 pt-3 pb-1 text-xs uppercase tracking-[.03em] text-faint bg-surface-2/50">{groupe.titre}</p>
            {groupe.documents.map((doc) => (
              <LigneDocument key={doc.id} doc={doc} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
