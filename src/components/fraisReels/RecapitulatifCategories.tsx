// Récapitulatif ligne à ligne du formulaire SNAM « État détaillé des frais professionnels » —
// miroir à l'écran de la page 1 du PDF (cf. lignesFormulaire, lib/exportPdfFraisReels.ts). Aucun
// calcul ici : chaque montant est lu tel quel dans `resultat` (engine/fraisReels.ts), la seule
// dérivation est la clé d'explication (code de catégorie en minuscules).
import type { CategorieFrais, ResultatFraisReels } from "../../types/fraisReels";
import { CATEGORIES_ORDONNEES, LIBELLES_CATEGORIE_COMPLETS } from "./categorieLabels";
import { explicationsFraisReels } from "../../content/explicationsFraisReels";
import { AidePopover } from "./AideContextuelle";

interface RecapitulatifCategoriesProps {
  resultat: ResultatFraisReels;
}

function montantLigne(resultat: ResultatFraisReels, categorie: CategorieFrais): number {
  if (categorie === "A") return resultat.montantA;
  if (categorie === "B") return resultat.montantB;
  return resultat.montantC[categorie] ?? 0;
}

export function RecapitulatifCategories({ resultat }: RecapitulatifCategoriesProps) {
  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">État détaillé par catégorie</h2>
        <p className="text-sm text-muted">Chaque ligne du formulaire SNAM, avec son montant retenu. Le ⓘ explique ce qu'on peut y mettre.</p>
      </div>

      <ul className="divide-y divide-line">
        {CATEGORIES_ORDONNEES.map((categorie) => {
          const explication = explicationsFraisReels[categorie.toLowerCase()];
          const montant = montantLigne(resultat, categorie);
          return (
            <li key={categorie} className="flex items-start gap-2 py-2">
              <span className="flex-1 text-sm text-ink">
                {LIBELLES_CATEGORIE_COMPLETS[categorie]}{" "}
                {explication && <AidePopover explication={explication} libelleCourt={categorie} />}
              </span>
              <span className={`text-sm tabular-nums shrink-0 ${montant > 0 ? "text-ink font-medium" : "text-faint"}`}>{montant.toFixed(2)} €</span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">Total des frais déduits</span>
        <span className="font-display font-semibold tabular-nums text-ink">{resultat.totalFraisReels.toFixed(2)} €</span>
      </div>
    </section>
  );
}
