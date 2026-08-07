import type { Exercice } from "../types";
import { formaterDateLisible, formaterMoisAnnee } from "../lib/dateLisible";

interface HistoriqueProps {
  exercices: Exercice[];
  /** Seuil des 507 h (`config.seuilHeures`) — pour la barre de progression du cycle en cours. */
  seuilHeures: number;
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

/**
 * Vue unifiée du cycle en cours et des cycles passés (07/08/2026, idée de Benoît) — remplace le
 * badge de cycle qui vivait jusqu'ici dans TopBar.tsx (dupliquait en résumé ce que cet onglet dit déjà
 * en détail) et la liste plate d'« exercices » sans distinction visuelle entre en cours et clos.
 * Même mot partout désormais (« cycle »), même format de date, une seule ligne chronologique.
 */
export function Historique({ exercices, seuilHeures, onEffacerGel, montantsNonFiables = false }: HistoriqueProps) {
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
        `Recalculer le cycle ${formaterDateLisible(exercice.dateDebut)} → ${formaterDateLisible(exercice.dateAnniversaire)} ? À faire uniquement si ses chiffres ne correspondent pas à la réalité (ex. cycle passé mal reconstitué). Il sera recalculé depuis tes contrats actuels puis regelé automatiquement.`,
      )
    ) {
      onEffacerGel?.(exercice.id);
    }
  }

  // Au plus un cycle non clos (`cycles.ts` ne construit qu'un seul i=0) — sauf date anniversaire
  // dépassée sans mise à jour, cas limite où plus aucun cycle n'est « en cours » : la carte du haut
  // disparaît alors simplement, le dernier cycle clos reste visible dans la ligne chronologique.
  const enCours = exercices.find((e) => !e.cloture);
  const clos = exercices.filter((e) => e.cloture);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">Tes cycles</h2>
        <p className="text-sm text-muted">Cycle en cours et cycles passés, dans l'ordre chronologique.</p>
      </div>

      {enCours && (
        <div className="bg-surface border border-mint/25 bg-gradient-to-b from-mint/[0.06] to-transparent rounded-hero p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-mint/15 text-mint">
              <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
              Cycle en cours
            </span>
            <span className="text-sm text-ink">
              {formaterMoisAnnee(enCours.dateDebut)} → {formaterMoisAnnee(enCours.dateAnniversaire)}
            </span>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${Math.min(100, (enCours.heuresAtteintes / seuilHeures) * 100)}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink whitespace-nowrap">
              {Math.round(enCours.heuresAtteintes)} / {seuilHeures} h
            </span>
          </div>
          <p className="text-xs text-muted">
            {enCours.heuresAtteintes >= seuilHeures
              ? `Seuil atteint — le cycle se clôt le ${formaterDateLisible(enCours.dateAnniversaire)}.`
              : `${Math.ceil(seuilHeures - enCours.heuresAtteintes)} h restantes avant le ${formaterDateLisible(enCours.dateAnniversaire)}.`}
          </p>
        </div>
      )}

      {clos.length > 0 ? (
        <div className="relative pl-7">
          <div className="absolute left-[11px] top-1 bottom-1 w-px bg-line-strong" aria-hidden />
          {clos.map((exercice) => (
            <div key={exercice.id} className="relative py-3.5 border-b border-line last:border-0">
              <span className={`absolute -left-7 top-5 w-3 h-3 rounded-full border-2 border-bg ${exercice.objectifAtteint ? "bg-mint" : "bg-red"}`} aria-hidden />
              <div className="flex items-center gap-4 flex-wrap">
                <div className="min-w-[190px]">
                  <p className="text-sm text-ink">
                    {formaterDateLisible(exercice.dateDebut)} → {formaterDateLisible(exercice.dateAnniversaire)}
                  </p>
                  <p className="text-xs text-muted">
                    Cycle clos · {exercice.objectifAtteint ? <span className="text-mint">Objectif atteint</span> : <span className="text-red">Objectif non atteint</span>}
                    {!exercice.borneReelle && (
                      <span className="text-amber ml-1.5" title="Reconstruit par soustraction calendaire de 12 mois, faute de notification d'admission connue pour ce cycle — ajoute-la dans « Mon profil » pour des dates exactes.">
                        · Dates estimées — notification manquante
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-ink">{Math.round(exercice.heuresAtteintes)} h</p>
                {exercice.ajBrute !== undefined && (
                  <div className="text-right ml-auto">
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
                {onEffacerGel && (
                  <button
                    type="button"
                    onClick={() => effacerAvecConfirmation(exercice)}
                    title="Recalculer ce cycle depuis les contrats actuels"
                    aria-label={`Recalculer le cycle ${formaterDateLisible(exercice.dateDebut)} → ${formaterDateLisible(exercice.dateAnniversaire)}`}
                    className={`shrink-0 text-faint hover:text-ink transition-colors px-2 text-sm ${exercice.ajBrute === undefined ? "ml-auto" : ""}`}
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-faint">Pas encore de cycle clos — il apparaîtra ici une fois le cycle en cours terminé.</p>
      )}
    </div>
  );
}
