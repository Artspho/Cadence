import { useMemo, useState } from "react";
import type { Contrat } from "../types";
import { genererContratsRecurrents, listeMoisDeLaPlage } from "../lib/contratRecurrent";

interface ContractFormRecurrentProps {
  onValider: (contrats: Contrat[]) => void;
  onAnnuler: () => void;
}

function libelleMois(cle: string): string {
  const [annee, mois] = cle.split("-");
  const noms = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${noms[Number(mois) - 1]} ${annee}`;
}

export function ContractFormRecurrent({ onValider, onAnnuler }: ContractFormRecurrentProps) {
  const [employeur, setEmployeur] = useState("");
  const [moisDebut, setMoisDebut] = useState("");
  const [moisFin, setMoisFin] = useState("");
  const [moisExclus, setMoisExclus] = useState<Set<string>>(new Set());
  const [nbHeuresParMois, setNbHeuresParMois] = useState("");
  const [salaireBrutParMois, setSalaireBrutParMois] = useState("");
  const [etablissementAgree, setEtablissementAgree] = useState(false);
  const [enRapportAvecMetier, setEnRapportAvecMetier] = useState(false);

  const plage = useMemo(() => (moisDebut && moisFin ? listeMoisDeLaPlage(moisDebut, moisFin) : []), [moisDebut, moisFin]);
  const plageInversee = Boolean(moisDebut && moisFin && plage.length === 0);
  const moisInclus = plage.filter((m) => !moisExclus.has(m));
  const nbContrats = moisInclus.length;

  function basculerMoisExclu(cle: string) {
    setMoisExclus((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (nbContrats === 0) return;
    const contrats = genererContratsRecurrents({
      employeur,
      moisDebut,
      moisFin,
      moisExclus: [...moisExclus],
      nbHeuresParMois: parseFloat(nbHeuresParMois) || 0,
      salaireBrutParMois: parseFloat(salaireBrutParMois) || 0,
      etablissementAgree,
      enRapportAvecMetier,
    });
    onValider(contrats);
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-line rounded-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-ink">Contrat récurrent — enseignement</h3>
        <p className="text-xs text-muted mt-1">Pour un CDD hebdomadaire répétitif (même employeur, mêmes heures chaque mois) sur une période donnée : un contrat sera créé par mois inclus.</p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="employeur-recurrent">
          Employeur
        </label>
        <input
          id="employeur-recurrent"
          value={employeur}
          onChange={(e) => setEmployeur(e.target.value)}
          required
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="mois-debut">
            Premier mois
          </label>
          <input id="mois-debut" type="month" value={moisDebut} onChange={(e) => setMoisDebut(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="mois-fin">
            Dernier mois
          </label>
          <input id="mois-fin" type="month" value={moisFin} onChange={(e) => setMoisFin(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
      </div>

      {plageInversee && <p className="text-xs rounded-lg px-3 py-2 bg-red/10 text-red">Le dernier mois doit être égal ou postérieur au premier mois.</p>}

      {plage.length > 0 && (
        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Mois à exclure (vacances, etc.)</span>
          <div className="flex flex-wrap gap-2">
            {plage.map((cle) => {
              const exclu = moisExclus.has(cle);
              return (
                <button
                  type="button"
                  key={cle}
                  onClick={() => basculerMoisExclu(cle)}
                  aria-pressed={exclu}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${exclu ? "border-line bg-surface-2 text-faint line-through" : "border-mint bg-mint/10 text-ink"}`}
                >
                  {libelleMois(cle)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="heures-par-mois">
            Heures par mois
          </label>
          <input
            id="heures-par-mois"
            type="number"
            min="0"
            step="0.5"
            value={nbHeuresParMois}
            onChange={(e) => setNbHeuresParMois(e.target.value)}
            required
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="salaire-par-mois">
            Salaire brut par mois (€)
          </label>
          <input
            id="salaire-par-mois"
            type="number"
            min="0"
            step="0.01"
            value={salaireBrutParMois}
            onChange={(e) => setSalaireBrutParMois(e.target.value)}
            required
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
          />
        </div>
      </div>

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

      {(!etablissementAgree || !enRapportAvecMetier) && (
        <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">Sans établissement agréé ET lien avec le métier, ces heures ne compteront pas du tout.</p>
      )}

      {plage.length > 0 && (
        <p className="text-xs text-muted">
          {nbContrats > 0
            ? `${nbContrats} contrat${nbContrats > 1 ? "s" : ""} seront créés (${moisInclus.length !== plage.length ? `${plage.length - moisInclus.length} mois exclu(s)` : "aucun mois exclu"}).`
            : "Tous les mois de la plage sont exclus : aucun contrat ne serait créé."}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={nbContrats === 0} className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
          Générer {nbContrats > 0 ? `les ${nbContrats} contrats` : "les contrats"}
        </button>
        <button type="button" onClick={onAnnuler} className="px-4 rounded-lg border border-line text-muted">
          Annuler
        </button>
      </div>
    </form>
  );
}
