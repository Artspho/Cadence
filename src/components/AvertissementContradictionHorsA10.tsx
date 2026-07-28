// Bandeau de la contradiction "A10 pur déclaré + salaires hors A10 > 0" (cf.
// lib/profilHorsPerimetre.ts, motif `salaires_hors_a10_contradictoires`).
//
// Volontairement NON bloquant, contrairement à AvertissementHorsPerimetre : ici on ne sait pas
// laquelle des deux saisies est fausse. Bloquer toute l'app sur un malentendu possible (champ mal
// compris) serait disproportionné — en revanche les montants ARE sont masqués tant que la
// contradiction dure, parce qu'ils seraient faux si c'est bien le régime déclaré qui est erroné.
//
// Textes lus dans content/contradictionHorsA10.ts, partagés avec l'alerte du moteur : plus aucun
// libellé propre à ce composant, donc plus de divergence possible entre les deux rendus du même
// fait. L'emphase est portée par les classes CSS (badge de titre), jamais par le contenu.
import { CONTRADICTION_HORS_A10 } from "../content/contradictionHorsA10";

interface AvertissementContradictionHorsA10Props {
  onAllerVersProfil: () => void;
}

export function AvertissementContradictionHorsA10({ onAllerVersProfil }: AvertissementContradictionHorsA10Props) {
  return (
    <div className="bg-red/5 border border-red/30 rounded-card p-5 space-y-3">
      <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-red/15 text-red">
        <span aria-hidden>●</span>
        {CONTRADICTION_HORS_A10.titre}
      </span>
      <p className="text-sm text-ink leading-relaxed">{CONTRADICTION_HORS_A10.constatation}</p>
      <p className="text-sm text-muted leading-relaxed">{CONTRADICTION_HORS_A10.consequence}</p>
      <button type="button" onClick={onAllerVersProfil} className="text-sm text-ink font-medium underline underline-offset-4 decoration-red/40 hover:decoration-red">
        {CONTRADICTION_HORS_A10.libelleBouton}
      </button>
    </div>
  );
}
