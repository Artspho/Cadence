import { useState } from "react";
import type { PeriodeAssimilee, TypePeriode } from "../types";

interface PeriodeFormProps {
  valeurInitiale?: Partial<PeriodeAssimilee>;
  onValider: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onAnnuler: () => void;
}

const TYPES_PERIODE: { id: TypePeriode; label: string }[] = [
  { id: "maternite", label: "Maternité" },
  { id: "adoption", label: "Adoption" },
  { id: "accident_travail", label: "Accident du travail" },
  { id: "ald", label: "ALD (affection longue durée)" },
  { id: "suspension_contrat", label: "Suspension de contrat" },
  { id: "maladie_intercontrat", label: "Maladie inter-contrat" },
];

export function PeriodeForm({ valeurInitiale, onValider, onAnnuler }: PeriodeFormProps) {
  const [type, setType] = useState<TypePeriode>(valeurInitiale?.type ?? "maternite");
  const [dateDebut, setDateDebut] = useState(valeurInitiale?.dateDebut ?? "");
  const [dateFin, setDateFin] = useState(valeurInitiale?.dateFin ?? "");

  const datesRenseignees = dateDebut.length > 0 && dateFin.length > 0;
  const datesInvalides = datesRenseignees && dateDebut > dateFin;
  const peutValider = datesRenseignees && !datesInvalides;

  function valider() {
    if (!peutValider) return;
    onValider({ type, dateDebut, dateFin });
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="periode-type">
          Type de période
        </label>
        <select id="periode-type" value={type} onChange={(e) => setType(e.target.value as TypePeriode)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2">
          {TYPES_PERIODE.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="periode-date-debut">
            Date de début
          </label>
          <input id="periode-date-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="periode-date-fin">
            Date de fin
          </label>
          <input id="periode-date-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
      </div>

      {datesInvalides && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">La date de début doit être antérieure ou égale à la date de fin.</p>}

      {type === "ald" && <p className="text-xs rounded-lg px-3 py-2 bg-surface-2 text-muted">Cette période ne compte que si tu avais déjà des droits ouverts à la date de début.</p>}

      {type === "maladie_intercontrat" && (
        <p className="text-xs rounded-lg px-3 py-2 bg-surface-2 text-muted">
          Ce type n'ajoute pas d'heures au décompte des 507 h — il allonge seulement la fenêtre de référence. Ne pas confondre avec un accident du travail ou une ALD, qui eux comptent 5 h/jour.
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={valider} disabled={!peutValider} className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
          Ajouter la période
        </button>
        <button type="button" onClick={onAnnuler} className="px-4 rounded-lg border border-line text-muted">
          Annuler
        </button>
      </div>
    </div>
  );
}
