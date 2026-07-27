import type { AJBruteResultat, AJNetteResultat, DecompteHeuresResultat, RythmeRequis, SeuilReadmission, StatutPrediction } from "../types";
import type { PointSerie } from "../engine/prediction";
import { franceTravailConfig } from "../config/franceTravailConfig";
import { ProjectionChart } from "./ProjectionChart";
import { DetailCalcul } from "./DetailCalcul";

interface DashboardProps {
  prediction: StatutPrediction;
  serie: PointSerie[];
  serieAVenir: PointSerie[];
  fenetreDebut: string;
  dateCap: string;
  decompte: DecompteHeuresResultat;
  ajBrute: AJBruteResultat;
  ajNette: AJNetteResultat;
  sr: number;
  nht: number;
  sar: number | null;
  /**
   * Contradiction de périmètre non tranchée (cf. lib/profilHorsPerimetre.ts, motif
   * `salaires_hors_a10_contradictoires`) : les montants ARE seraient calculés avec les mauvaises
   * règles si le régime déclaré est celui qui est faux. On les masque au lieu de les afficher
   * assortis d'un « peut-être » — un chiffre affiché est un chiffre auquel on se fie.
   */
  montantsNonFiables?: boolean;
}

// Exhaustif par construction : si une raison est ajoutée à RythmeRequis sans traiter son cas
// ici, `_exhaustif` cesse de typer en `never` et la compilation échoue (devoir sacré n°2).
function libelleRythmeRequis(rythmeRequis: RythmeRequis, seuilHeures: number): string {
  if (rythmeRequis.atteignable) return `${rythmeRequis.heuresParMois.toFixed(0)} h/mois`;
  switch (rythmeRequis.raison) {
    case "anniversaire_inconnu":
      return "Renseigne ta date anniversaire pour connaître le rythme requis.";
    case "delai_expire":
      return `Le délai est trop court pour atteindre ${seuilHeures} h à ce rythme.`;
    default: {
      const _exhaustif: never = rythmeRequis.raison;
      return _exhaustif;
    }
  }
}

// Exhaustif par construction, même principe que libelleRythmeRequis ci-dessus : les deux raisons
// de SeuilReadmission "calculable: false" ne sont jamais confondues (devoir n°2) — l'une est un
// manque de données côté Cadence, l'autre un vrai résultat réglementaire (non éligible).
function bandeauSeuilReadmission(seuilReadmission: SeuilReadmission, seuilHeures: number): { titre: string; corps: string; action: string } | null {
  if (seuilReadmission.calculable) return null;
  switch (seuilReadmission.raison) {
    case "historique_insuffisant":
      return {
        titre: "Réadmission : seuil ajusté non calculable",
        corps: `Cadence n'a pas trouvé assez d'heures dans tes contrats saisis pour ajuster ton seuil de réadmission — il manque des contrats antérieurs, ou la date de ta précédente ouverture de droits. Les chiffres ci-dessous sont basés sur le seuil standard (${seuilHeures} h), pas sur un seuil de réadmission ajusté.`,
        action: "Ajoute tes contrats antérieurs si tu en as, ou renseigne ta précédente ouverture de droits dans « Mon profil ».",
      };
    case "hors_bornes":
      return {
        titre: "Réadmission : seuil non atteint",
        corps: `Même en remontant jusqu'à ton ancienne ouverture de droits, le total d'heures retrouvé n'atteint pas le seuil. Les chiffres ci-dessous sont basés sur le seuil standard (${seuilHeures} h), pas sur un seuil de réadmission ajusté.`,
        action: "Si tu as entre 338 et 506 h, la clause de rattrapage peut s'appliquer — contacte France Travail pour confirmer.",
      };
    default: {
      // Assertion sur la valeur entière, pas seulement `.raison` : sur une union à plusieurs
      // variantes `calculable:false`, le switch narrowe correctement `seuilReadmission` ici, mais
      // pas `.raison` pris isolément (vérifié empiriquement — cf. commit, contrairement au cas
      // RythmeRequis ci-dessus qui n'a qu'une seule variante `atteignable:false`).
      const _exhaustif: never = seuilReadmission;
      return _exhaustif;
    }
  }
}

export function Dashboard({ prediction, serie, serieAVenir, fenetreDebut, dateCap, decompte, ajBrute, ajNette, sr, nht, sar, montantsNonFiables = false }: DashboardProps) {
  const bandeauReadmission = bandeauSeuilReadmission(prediction.seuilReadmission, prediction.seuilHeures);
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
          serieAVenir={serieAVenir}
          seuilHeures={prediction.seuilHeures}
          heuresActuelles={prediction.heuresActuelles}
          heuresCertainesAVenir={prediction.heuresCertainesAVenir}
          niveau={prediction.niveau}
          dateFranchissementProjetee={prediction.dateFranchissementProjetee}
          rythmeMensuelActuel={prediction.rythmeMensuelActuel}
          anniversaireConnu={prediction.anniversaireConnu}
        />
        <p className="text-sm text-muted mt-3">{prediction.message}</p>
      </div>

      {bandeauReadmission && (
        <div className="bg-amber/5 border border-amber/30 rounded-card px-5 py-4 text-sm">
          <p className="text-ink font-medium">{bandeauReadmission.titre}</p>
          <p className="text-muted mt-1">{bandeauReadmission.corps}</p>
          <p className="text-xs text-faint mt-2">→ {bandeauReadmission.action}</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-card p-5">
          <p className="text-xs uppercase tracking-[.03em] text-muted mb-2">Allocation journalière estimée</p>
          {montantsNonFiables ? (
            <>
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-faint">— €</p>
              <p className="text-sm text-red mt-1">Non fiable : deux saisies se contredisent</p>
              <p className="text-xs text-faint mt-2">Corrige ton régime déclaré ou tes salaires hors Annexe 10 dans « Mon profil » pour retrouver ce montant.</p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{ajBrute.brut.toFixed(2)} €</p>
              <p className="text-sm text-muted mt-1">≈ {ajNette.net.toFixed(2)} € net / jour</p>
              <p className="text-xs text-faint mt-2">Estimation indicative — {franceTravailConfig.meta.avertissement}</p>
            </>
          )}
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
              className={`h-full ${prediction.rythmeRequis.atteignable && prediction.rythmeMensuelActuel >= prediction.rythmeRequis.heuresParMois ? "bg-mint" : "bg-amber"}`}
              style={{
                width: `${prediction.rythmeRequis.atteignable ? Math.min(100, (prediction.rythmeMensuelActuel / Math.max(1, prediction.rythmeRequis.heuresParMois)) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted">Requis : {libelleRythmeRequis(prediction.rythmeRequis, prediction.seuilHeures)}</p>
        </div>
      </div>

      <DetailCalcul decompte={decompte} ajBrute={ajBrute} ajNette={ajNette} sr={sr} nht={nht} sar={sar} />

      <p className="text-xs text-faint text-center pt-2">{franceTravailConfig.meta.avertissement}</p>
    </div>
  );
}
