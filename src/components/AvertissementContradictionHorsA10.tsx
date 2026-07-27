// Bandeau de la contradiction "A10 pur déclaré + salaires hors A10 > 0" (cf.
// lib/profilHorsPerimetre.ts, motif `salaires_hors_a10_contradictoires`).
//
// Volontairement NON bloquant, contrairement à AvertissementHorsPerimetre : ici on ne sait pas
// laquelle des deux saisies est fausse. Bloquer toute l'app sur un malentendu possible (champ mal
// compris) serait disproportionné — en revanche les montants ARE sont masqués tant que la
// contradiction dure, parce qu'ils seraient faux si c'est bien le régime déclaré qui est erroné.
interface AvertissementContradictionHorsA10Props {
  onAllerVersProfil: () => void;
}

export function AvertissementContradictionHorsA10({ onAllerVersProfil }: AvertissementContradictionHorsA10Props) {
  return (
    <div className="bg-red/5 border border-red/30 rounded-card p-5 space-y-3">
      <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-red/15 text-red">
        <span aria-hidden>●</span>
        Deux saisies se contredisent
      </span>
      <p className="text-sm text-ink leading-relaxed">
        Tu as déclaré relever <strong>uniquement de l'Annexe 10</strong>, mais tu as renseigné des <strong>salaires perçus hors Annexe 10</strong>{" "}
        (technicien Annexe 8, régime général…). Ces deux informations ne peuvent pas être vraies en même temps.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        Tant que c'est le cas, l'allocation journalière et la projection sont masquées : si c'est bien ton régime déclaré qui est faux, elles seraient
        calculées avec les mauvaises règles. Le reste de Cadence reste utilisable — tu peux continuer à saisir tes contrats.
      </p>
      <button type="button" onClick={onAllerVersProfil} className="text-sm text-ink font-medium underline underline-offset-4 decoration-red/40 hover:decoration-red">
        Ouvrir « Mon profil » pour corriger l'une des deux saisies →
      </button>
    </div>
  );
}
