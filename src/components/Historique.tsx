import type { Exercice } from "../types";

interface HistoriqueProps {
  exercices: Exercice[];
  /**
   * Efface le gel d'un exercice clos (cf. engine/cycles.ts, fusionnerExercicesGeles) — au prochain
   * rendu, il est recalculé depuis les contrats/profil actuels puis regelé automatiquement. Filet de
   * rattrapage manuel (bug réel signalé le 31/07/2026 : un exercice figé à tort — reconstruction
   * calendaire fausse, ou contrats corrigés après coup — restait figé indéfiniment sans ce geste).
   * Optionnel : absent, aucun bouton ne s'affiche (ex. écrans de simulation qui n'ont pas de storage).
   */
  onEffacerGel?: (id: string) => void;
  /**
   * Même contradiction de périmètre que Dashboard.tsx (cf. lib/profilHorsPerimetre.ts, motif
   * `salaires_hors_a10_contradictoires`) : les montants ARE seraient calculés avec les mauvaises
   * règles si le régime déclaré est celui qui est faux. On les masque au lieu de les afficher
   * assortis d'un « peut-être » — un chiffre affiché est un chiffre auquel on se fie (devoir n°2).
   * Le décompte d'heures n'est pas concerné : lui reste correct quel que soit le régime déclaré.
   */
  montantsNonFiables?: boolean;
}

export function Historique({ exercices, onEffacerGel, montantsNonFiables = false }: HistoriqueProps) {
  if (exercices.length === 0) {
    return (
      <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">
        Pas encore d'historique — il apparaîtra une fois ta date anniversaire renseignée et un premier cycle écoulé.
      </p>
    );
  }

  function effacerAvecConfirmation(exercice: Exercice) {
    if (
      window.confirm(
        `Recalculer l'exercice ${exercice.dateDebut} → ${exercice.dateAnniversaire} ? À faire uniquement si ses chiffres ne correspondent pas à la réalité (ex. cycle passé mal reconstitué). Il sera recalculé depuis tes contrats actuels puis regelé automatiquement.`,
      )
    ) {
      onEffacerGel?.(exercice.id);
    }
  }

  return (
    <div className="space-y-3">
      {exercices.map((exercice) => (
        <div key={exercice.id} className="bg-surface border border-line rounded-card p-5 flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full shrink-0 ${exercice.objectifAtteint ? "bg-mint" : exercice.cloture ? "bg-red" : "bg-faint"}`} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink">
              {exercice.dateDebut} → {exercice.dateAnniversaire}
            </p>
            <p className="text-xs text-muted">{exercice.cloture ? "Exercice clos" : "Exercice en cours"}</p>
          </div>
          <div className="text-right">
            <p className="text-sm tabular-nums text-ink">{Math.round(exercice.heuresAtteintes)} h</p>
            <p className={`text-xs ${exercice.objectifAtteint ? "text-mint" : "text-muted"}`}>{exercice.objectifAtteint ? "Objectif atteint" : "Objectif non atteint"}</p>
          </div>
          {exercice.ajBrute !== undefined && (
            <div className="text-right border-l border-line pl-4">
              {montantsNonFiables ? (
                <>
                  <p className="text-sm tabular-nums text-faint">— €</p>
                  <p className="text-xs text-red">Non fiable</p>
                </>
              ) : (
                <>
                  <p className="text-sm tabular-nums text-ink">{exercice.ajBrute.toFixed(2)} €</p>
                  <p className="text-xs text-muted tabular-nums">≈ {exercice.ajNette?.toFixed(2)} € net /j</p>
                </>
              )}
            </div>
          )}
          {exercice.cloture && onEffacerGel && (
            <button
              type="button"
              onClick={() => effacerAvecConfirmation(exercice)}
              title="Recalculer cet exercice depuis les contrats actuels"
              aria-label={`Recalculer l'exercice ${exercice.dateDebut} → ${exercice.dateAnniversaire}`}
              className="shrink-0 text-faint hover:text-ink transition-colors px-2 text-sm"
            >
              ↻
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
