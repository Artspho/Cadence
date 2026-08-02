// Tableau comparatif Existant/Document pour une correspondance proposée (RevueExtraction.tsx).
// Remplace l'ancienne liste "champ : ancien → nouveau" qui ne montrait QUE les champs différents
// (01/08/2026) : un champ identique restait invisible, ce qui ne distinguait pas "identique" de
// "je n'ai pas vérifié ce champ" — même piège que le silence corrigé par diagnosticAbsence.
// Purement informatif : aucune case à cocher, aucune action ici — la décision reste le bouton
// "Confirmer la correspondance" affiché par l'appelant.
import type { ChampComparaison } from "../lib/routageExtraction";
import { formaterValeur, humaniserCle, LABELS_CHAMPS } from "./RevueExtraction";

interface TableauComparaisonContratProps {
  comparaisons: ChampComparaison[];
}

export function TableauComparaisonContrat({ comparaisons }: TableauComparaisonContratProps) {
  if (comparaisons.length === 0) return null;
  const labels = LABELS_CHAMPS.contrat;

  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-[.03em] text-faint border-b border-line">
        <tr>
          <th className="text-left py-1.5 font-medium">Champ</th>
          <th className="text-left py-1.5 font-medium">Existant</th>
          <th className="text-left py-1.5 font-medium">Document</th>
        </tr>
      </thead>
      <tbody>
        {comparaisons.map((c) => {
          const existant = formaterValeur(c.existant).texte;
          const document = formaterValeur(c.document).texte;
          return (
            <tr key={String(c.champ)} className="border-b border-line/60 last:border-0">
              <td className="py-1.5 pr-2 text-muted">{labels[c.champ] ?? humaniserCle(String(c.champ))}</td>
              <td className={`py-1.5 pr-2 ${c.identique ? "text-muted" : "text-faint"}`}>{existant}</td>
              <td className={c.identique ? "py-1.5 text-muted" : "py-1.5 text-ink font-medium"}>{c.identique ? document : `→ ${document}`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
