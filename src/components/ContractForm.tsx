import { useMemo, useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil, Territoire, TypeContrat, TypeRemuneration } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { heuresBrutesContrat } from "../engine/decompteHeures";

interface ContractFormProps {
  profil: Profil;
  config: FranceTravailConfig;
  /** Décompte déjà atteint sur la fenêtre en cours, AVANT ce contrat — sert uniquement à l'aperçu temps réel des plafonds. */
  decompteActuel: DecompteHeuresResultat;
  valeurInitiale?: Partial<Contrat>;
  onValider: (contrat: Omit<Contrat, "id">) => void;
  onAnnuler?: () => void;
}

const TYPES_CONTRAT: { id: TypeContrat; label: string }[] = [
  { id: "artiste", label: "Artiste" },
  { id: "enseignement", label: "Enseignement" },
  { id: "formation", label: "Formation" },
  { id: "ptp", label: "PTP" },
];

export function ContractForm({ profil, config, decompteActuel, valeurInitiale, onValider, onAnnuler }: ContractFormProps) {
  const [type, setType] = useState<TypeContrat>(valeurInitiale?.type ?? "artiste");
  const [typeRemuneration, setTypeRemuneration] = useState<TypeRemuneration>(valeurInitiale?.typeRemuneration ?? "cachet");
  const [territoire, setTerritoire] = useState<Territoire>(valeurInitiale?.territoire ?? "france");
  const [date, setDate] = useState(valeurInitiale?.date ?? "");
  const [employeur, setEmployeur] = useState(valeurInitiale?.employeur ?? "");
  const [salaireBrut, setSalaireBrut] = useState(valeurInitiale?.salaireBrut?.toString() ?? "");
  const [nbCachets, setNbCachets] = useState(valeurInitiale?.nbCachets?.toString() ?? "");
  const [nbHeures, setNbHeures] = useState(valeurInitiale?.nbHeures?.toString() ?? "");
  const [nbJoursEEE, setNbJoursEEE] = useState(valeurInitiale?.nbJoursEEE?.toString() ?? "");
  const [etablissementAgree, setEtablissementAgree] = useState(valeurInitiale?.etablissementAgree ?? false);
  const [enRapportAvecMetier, setEnRapportAvecMetier] = useState(valeurInitiale?.enRapportAvecMetier ?? false);

  const brouillon: Contrat = {
    id: "brouillon",
    date: date || new Date().toISOString().slice(0, 10),
    type,
    typeRemuneration,
    territoire,
    nbCachets: nbCachets ? parseFloat(nbCachets) : undefined,
    nbHeures: nbHeures ? parseFloat(nbHeures) : undefined,
    nbJoursEEE: nbJoursEEE ? parseFloat(nbJoursEEE) : undefined,
    salaireBrut: parseFloat(salaireBrut) || 0,
    employeur,
    etablissementAgree,
    enRapportAvecMetier,
  };

  const apercu = useMemo(() => heuresBrutesContrat(brouillon, config), [brouillon, config]);

  const alerteEnseignement = useMemo(() => {
    if (type !== "enseignement") return null;
    if (!etablissementAgree || !enRapportAvecMetier) {
      return { niveau: "attention" as const, texte: "Sans établissement agréé ET lien avec le métier, ces heures ne comptent pas du tout." };
    }
    const cumulApres = decompteActuel.repartition.enseignementRetenu + apercu.heures;
    if (cumulApres > decompteActuel.plafondEnseignementApplicable) {
      const excedent = cumulApres - decompteActuel.plafondEnseignementApplicable;
      return {
        niveau: "attention" as const,
        texte: `${Math.round(excedent)} h dépasseront le plafond de ${decompteActuel.plafondEnseignementApplicable} h : elles ne compteront pas.`,
      };
    }
    return { niveau: "info" as const, texte: `${Math.round(cumulApres)} h / ${decompteActuel.plafondEnseignementApplicable} h de plafond enseignement.` };
  }, [type, etablissementAgree, enRapportAvecMetier, apercu, decompteActuel]);

  const alerteCumul = useMemo(() => {
    const cumulEnseignementFormation = decompteActuel.repartition.enseignementRetenu + decompteActuel.repartition.formationRetenue + (type === "formation" ? apercu.heures : 0);
    const plafond = config.enseignement.plafondCumulEnseignementFormation;
    if (type === "formation" && cumulEnseignementFormation > plafond) {
      return `${Math.round(cumulEnseignementFormation - plafond)} h dépasseront le cumul enseignement + formation (plafond ${plafond} h).`;
    }
    return null;
  }, [type, apercu, decompteActuel, config]);

  const alerteCachets = useMemo(() => {
    if (typeRemuneration !== "cachet" || territoire === "eee_suisse_uk" || !date) return null;
    const mois = date.slice(0, 7);
    const dejaCeMois = Object.entries(decompteActuel.cachetsParMois).find(([cle]) => cle === mois)?.[1] ?? 0;
    const total = dejaCeMois + (parseFloat(nbCachets) || 0);
    if (total > config.plafondCachetsParMois) {
      return `${total} cachets ce mois-ci : au-delà du plafond de ${config.plafondCachetsParMois}/mois.`;
    }
    return null;
  }, [typeRemuneration, territoire, date, nbCachets, decompteActuel, config]);

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    onValider({
      date: brouillon.date,
      type,
      typeRemuneration,
      territoire,
      nbCachets: brouillon.nbCachets,
      nbHeures: brouillon.nbHeures,
      nbJoursEEE: brouillon.nbJoursEEE,
      salaireBrut: brouillon.salaireBrut,
      employeur,
      etablissementAgree: type === "enseignement" ? etablissementAgree : undefined,
      enRapportAvecMetier: type === "enseignement" ? enRapportAvecMetier : undefined,
      source: valeurInitiale?.source ?? "manuel",
    });
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-line rounded-card p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {TYPES_CONTRAT.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setType(t.id)}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${type === t.id ? "border-mint bg-mint/10 text-ink" : "border-line bg-surface-2 text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="employeur">
            Employeur
          </label>
          <input id="employeur" value={employeur} onChange={(e) => setEmployeur(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="date-fin">
            Date de fin de contrat
          </label>
          <input id="date-fin" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
      </div>

      <div>
        <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Territoire</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTerritoire("france")} className={`rounded-lg border px-3 py-2 text-sm ${territoire === "france" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}>
            France
          </button>
          <button
            type="button"
            onClick={() => setTerritoire("eee_suisse_uk")}
            className={`rounded-lg border px-3 py-2 text-sm ${territoire === "eee_suisse_uk" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
          >
            EEE / Suisse / UK
          </button>
        </div>
      </div>

      {territoire === "eee_suisse_uk" ? (
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="jours-eee">
            Nombre de jours travaillés
          </label>
          <input id="jours-eee" type="number" min="0" step="0.5" value={nbJoursEEE} onChange={(e) => setNbJoursEEE(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          <p className="text-xs text-faint mt-1">{config.heuresParJourEEE} h retenues par jour.</p>
        </div>
      ) : (
        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Rémunération</span>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setTypeRemuneration("cachet")} className={`rounded-lg border px-3 py-2 text-sm ${typeRemuneration === "cachet" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}>
              Cachets
            </button>
            <button type="button" onClick={() => setTypeRemuneration("heures")} className={`rounded-lg border px-3 py-2 text-sm ${typeRemuneration === "heures" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}>
              Heures
            </button>
          </div>
          {typeRemuneration === "cachet" ? (
            <input type="number" min="0" step="1" placeholder="Nombre de cachets" value={nbCachets} onChange={(e) => setNbCachets(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          ) : (
            <input type="number" min="0" step="0.5" placeholder="Nombre d'heures" value={nbHeures} onChange={(e) => setNbHeures(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          )}
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="salaire-brut">
          Salaire brut (€)
        </label>
        <input id="salaire-brut" type="number" min="0" step="0.01" value={salaireBrut} onChange={(e) => setSalaireBrut(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
      </div>

      {type === "enseignement" && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={etablissementAgree} onChange={(e) => setEtablissementAgree(e.target.checked)} />
            Établissement agréé
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={enRapportAvecMetier} onChange={(e) => setEnRapportAvecMetier(e.target.checked)} />
            En rapport avec le métier
          </label>
        </div>
      )}

      {alerteEnseignement && (
        <p className={`text-xs rounded-lg px-3 py-2 ${alerteEnseignement.niveau === "attention" ? "bg-amber/10 text-amber" : "bg-teal/10 text-teal"}`}>{alerteEnseignement.texte}</p>
      )}
      {alerteCumul && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{alerteCumul}</p>}
      {alerteCachets && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{alerteCachets}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5">
          Enregistrer le contrat
        </button>
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} className="px-4 rounded-lg border border-line text-muted">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
