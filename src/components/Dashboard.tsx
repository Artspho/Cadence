import type { AJBruteResultat, AJNetteResultat, DecompteHeuresResultat, StatutPrediction } from "../types";
import type { PointSerie } from "../engine/prediction";
import { franceTravailConfig } from "../config/franceTravailConfig";
import { ProjectionChart } from "./ProjectionChart";

interface DashboardProps {
  prediction: StatutPrediction;
  serie: PointSerie[];
  fenetreDebut: string;
  dateCap: string;
  decompte: DecompteHeuresResultat;
  ajBrute: AJBruteResultat;
  ajNette: AJNetteResultat;
}

export function Dashboard({ prediction, serie, fenetreDebut, dateCap, decompte, ajBrute, ajNette }: DashboardProps) {
  const r = decompte.repartition;
  const cachets = r.cachets;
  const scene = r.heuresScene + r.eee + r.ptp + r.assimilees;
  const enseignementFormation = r.enseignementRetenu + r.formationRetenue;
  const totalRepartition = Math.max(1, cachets + scene + enseignementFormation);

  return (
    <div className="space-y-6">
      <div>
        <ProjectionChart
          fenetreDebut={fenetreDebut}
          fenetreFin={prediction.dateAnniversaire}
          dateCap={dateCap}
          serie={serie}
          seuilHeures={prediction.seuilHeures}
          heuresActuelles={prediction.heuresActuelles}
          niveau={prediction.niveau}
          dateFranchissementProjetee={prediction.dateFranchissementProjetee}
          rythmeMensuelActuel={prediction.rythmeMensuelActuel}
        />
        <p className="text-sm text-muted mt-3">{prediction.message}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Allocation journalière estimée</p>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{ajBrute.brut.toFixed(2)} €</p>
          <p className="text-sm text-muted mt-1">≈ {ajNette.net.toFixed(2)} € net / jour</p>
          <p className="text-xs text-faint mt-2">Estimation indicative — {franceTravailConfig.meta.avertissement}</p>
        </div>

        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Répartition des heures</p>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-surface-2 mb-3">
            <div className="bg-mint h-full" style={{ width: `${(cachets / totalRepartition) * 100}%` }} />
            <div className="bg-teal h-full" style={{ width: `${(scene / totalRepartition) * 100}%` }} />
            <div className="bg-violet h-full" style={{ width: `${(enseignementFormation / totalRepartition) * 100}%` }} />
          </div>
          <ul className="text-xs text-muted space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-mint" /> Cachets · {Math.round(cachets)} h
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal" /> Heures scène · {Math.round(scene)} h
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet" /> Enseignement · {Math.round(r.enseignementRetenu)} h · plafond {decompte.plafondEnseignementApplicable} h
            </li>
          </ul>
        </div>

        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Rythme mensuel</p>
          <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">{prediction.rythmeMensuelActuel.toFixed(0)} h/mois</p>
          <div className="h-1.5 rounded-full bg-surface-2 mt-3 mb-2 overflow-hidden">
            <div
              className={`h-full ${prediction.rythmeMensuelActuel >= prediction.rythmeMensuelRequis ? "bg-mint" : "bg-amber"}`}
              style={{ width: `${Math.min(100, (prediction.rythmeMensuelActuel / Math.max(1, prediction.rythmeMensuelRequis)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Requis : {Number.isFinite(prediction.rythmeMensuelRequis) ? `${prediction.rythmeMensuelRequis.toFixed(0)} h/mois` : "objectif hors d'atteinte"}
          </p>
        </div>
      </div>

      <p className="text-xs text-faint text-center pt-2">{franceTravailConfig.meta.avertissement}</p>
    </div>
  );
}
