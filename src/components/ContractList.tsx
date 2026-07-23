import { useState } from "react";
import type { Contrat } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { heuresBrutesContrat } from "../engine/decompteHeures";

interface ContractListProps {
  contrats: Contrat[];
  config: FranceTravailConfig;
  onSupprimer: (id: string) => void;
  onSupprimerSerie: (recurrenceId: string) => void;
}

const COULEURS_TYPE: Record<Contrat["type"], string> = {
  artiste: "bg-mint/15 text-mint",
  enseignement: "bg-violet/15 text-violet",
  formation: "bg-violet/15 text-violet",
  ptp: "bg-teal/15 text-teal",
};

const LABELS_TYPE: Record<Contrat["type"], string> = {
  artiste: "Artiste",
  enseignement: "Enseignement",
  formation: "Formation",
  ptp: "PTP",
};

type Entree = { kind: "seul"; contrat: Contrat } | { kind: "serie"; recurrenceId: string; contrats: Contrat[] };

function dateTri(entree: Entree): string {
  return entree.kind === "seul" ? entree.contrat.date : entree.contrats[0].date; // contrats d'une série déjà triés desc
}

export function ContractList({ contrats, config, onSupprimer, onSupprimerSerie }: ContractListProps) {
  const [seriesOuvertes, setSeriesOuvertes] = useState<Set<string>>(new Set());

  if (contrats.length === 0) {
    return <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">Aucun contrat enregistré pour l'instant.</p>;
  }

  const groupes = new Map<string, Contrat[]>();
  const isoles: Contrat[] = [];
  for (const c of contrats) {
    if (c.recurrenceId) {
      const arr = groupes.get(c.recurrenceId) ?? [];
      arr.push(c);
      groupes.set(c.recurrenceId, arr);
    } else {
      isoles.push(c);
    }
  }

  const entrees: Entree[] = [
    ...isoles.map((contrat): Entree => ({ kind: "seul", contrat })),
    ...[...groupes.entries()].map(([recurrenceId, cs]): Entree => ({ kind: "serie", recurrenceId, contrats: [...cs].sort((a, b) => (a.date < b.date ? 1 : -1)) })),
  ].sort((a, b) => (dateTri(a) < dateTri(b) ? 1 : -1));

  function basculerSerie(recurrenceId: string) {
    setSeriesOuvertes((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(recurrenceId)) suivant.delete(recurrenceId);
      else suivant.add(recurrenceId);
      return suivant;
    });
  }

  function supprimerSerieAvecConfirmation(recurrenceId: string, employeur: string, nb: number) {
    if (window.confirm(`Supprimer les ${nb} contrats de la série "${employeur}" ? Cette action ne peut pas être annulée depuis l'application (seul un import JSON de sauvegarde le permettrait).`)) {
      onSupprimerSerie(recurrenceId);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-card divide-y divide-line overflow-hidden">
      {entrees.map((entree) => {
        if (entree.kind === "seul") {
          const contrat = entree.contrat;
          const { heures } = heuresBrutesContrat(contrat, config);
          return (
            <div key={contrat.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COULEURS_TYPE[contrat.type]}`}>{LABELS_TYPE[contrat.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{contrat.employeur || "Sans nom"}</p>
                <p className="text-xs text-muted">
                  {contrat.date}
                  {contrat.source === "import_pdf" ? " · importé PDF" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm tabular-nums text-ink">{heures.toFixed(1)} h</p>
                <p className="text-xs text-muted tabular-nums">{contrat.salaireBrut.toFixed(0)} € brut</p>
              </div>
              <button onClick={() => onSupprimer(contrat.id)} aria-label={`Supprimer le contrat ${contrat.employeur}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
                ✕
              </button>
            </div>
          );
        }

        const { recurrenceId, contrats: contratsSerie } = entree;
        const ouverte = seriesOuvertes.has(recurrenceId);
        const employeur = contratsSerie[0].employeur;
        const type = contratsSerie[0].type;
        const premierMois = contratsSerie[contratsSerie.length - 1].date.slice(0, 7);
        const dernierMois = contratsSerie[0].date.slice(0, 7);
        const totalHeures = contratsSerie.reduce((somme, c) => somme + heuresBrutesContrat(c, config).heures, 0);
        const totalSalaire = contratsSerie.reduce((somme, c) => somme + c.salaireBrut, 0);

        return (
          <div key={recurrenceId} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => basculerSerie(recurrenceId)} aria-expanded={ouverte} aria-label={ouverte ? "Replier la série" : "Déplier la série"} className="shrink-0 text-muted w-4">
                {ouverte ? "▾" : "▸"}
              </button>
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COULEURS_TYPE[type]}`}>{LABELS_TYPE[type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{employeur || "Sans nom"}</p>
                <p className="text-xs text-muted">
                  {contratsSerie.length} contrats récurrents · {premierMois} → {dernierMois}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm tabular-nums text-ink">{totalHeures.toFixed(1)} h</p>
                <p className="text-xs text-muted tabular-nums">{totalSalaire.toFixed(0)} € brut</p>
              </div>
              <button
                type="button"
                onClick={() => supprimerSerieAvecConfirmation(recurrenceId, employeur, contratsSerie.length)}
                className="shrink-0 text-xs text-red border border-red/30 rounded-full px-3 py-1 hover:bg-red/10 transition-colors"
              >
                Supprimer la série
              </button>
            </div>
            {ouverte && (
              <div className="mt-3 ml-7 space-y-1.5 border-t border-line pt-3">
                {contratsSerie.map((contrat) => {
                  const { heures } = heuresBrutesContrat(contrat, config);
                  return (
                    <div key={contrat.id} className="flex items-center gap-3 text-sm">
                      <span className="text-muted flex-1">{contrat.date}</span>
                      <span className="tabular-nums text-ink">{heures.toFixed(1)} h</span>
                      <span className="tabular-nums text-muted w-20 text-right">{contrat.salaireBrut.toFixed(0)} €</span>
                      <button onClick={() => onSupprimer(contrat.id)} aria-label={`Supprimer le contrat du ${contrat.date}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
