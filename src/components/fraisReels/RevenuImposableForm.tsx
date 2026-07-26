import type { ProfilFiscalFraisReels, RevenuImposableArtistique } from "../../types/fraisReels";

interface RevenuImposableFormProps {
  revenu: RevenuImposableArtistique;
  profilFiscal: ProfilFiscalFraisReels;
  baseR: number;
  plafondBaseR: number;
  totalAreCalcule: number | null;
  onChangerRevenu: (revenu: RevenuImposableArtistique) => void;
  onChangerProfilFiscal: (profilFiscal: ProfilFiscalFraisReels) => void;
}

const OPTIONS_PROFIL_FISCAL: { id: ProfilFiscalFraisReels; label: string; aide: string }[] = [
  { id: "artiste_exclusif", label: "Artiste musicien exclusif", aide: "Revenus exclusivement artistiques — forfaits 14 % et 5 % sur tout." },
  { id: "artiste_enseignant_majoritaire", label: "Artiste et enseignant (artistique majoritaire)", aide: "Forfaits 14 % et 5 % sur revenus artistiques + enseignement." },
  { id: "artiste_enseignant_accessoire", label: "Artiste et enseignant (artistique accessoire)", aide: "Forfaits 14 % et 5 % sur les revenus artistiques seulement." },
  { id: "enseignant_pur", label: "Enseignant pur (aucune activité artistique)", aide: "Pas de forfaits 14 %/5 % — seuls les frais réels catégories C et D restent déductibles." },
];

function champNombre(valeur: number, onChange: (v: number) => void, id: string, label: string, aide?: string) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="0.01"
        value={valeur === 0 ? "" : valeur}
        placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
      />
      {aide && <p className="text-xs text-faint mt-1">{aide}</p>}
    </div>
  );
}

export function RevenuImposableForm({ revenu, profilFiscal, baseR, plafondBaseR, totalAreCalcule, onChangerRevenu, onChangerProfilFiscal }: RevenuImposableFormProps) {
  const plafonne = revenu.salaireNetImposable + revenu.allocationsAre + revenu.congesSpectacles + revenu.indemnitesJournalieres > plafondBaseR;

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-5">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">Mon revenu imposable artistique</h2>
        <p className="text-sm text-muted">Base R (§3 du guide SNAM-CGT) — sert au calcul des forfaits 14 % et 5 %.</p>
      </div>

      <div>
        <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Ta situation fiscale</span>
        <div className="grid grid-cols-1 gap-2">
          {OPTIONS_PROFIL_FISCAL.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChangerProfilFiscal(o.id)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${profilFiscal === o.id ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              <span className="block text-sm text-ink">{o.label}</span>
              <span className="block text-xs text-faint mt-0.5">{o.aide}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {champNombre(revenu.salaireNetImposable, (v) => onChangerRevenu({ ...revenu, salaireNetImposable: v }), "fr-salaire", "Salaire net imposable (activité artistique)")}

        <div>
          {champNombre(revenu.allocationsAre, (v) => onChangerRevenu({ ...revenu, allocationsAre: v }), "fr-are", "Allocations ARE")}
          {totalAreCalcule !== null && Math.round(totalAreCalcule * 100) !== Math.round(revenu.allocationsAre * 100) && (
            <button
              type="button"
              onClick={() => onChangerRevenu({ ...revenu, allocationsAre: totalAreCalcule })}
              className="text-xs text-mint hover:underline mt-1"
            >
              Reprendre le total calculé dans « Revenus mensuels » ({totalAreCalcule.toFixed(2)} €)
            </button>
          )}
        </div>

        {champNombre(revenu.congesSpectacles, (v) => onChangerRevenu({ ...revenu, congesSpectacles: v }), "fr-conges", "Congés spectacles")}
        {champNombre(revenu.indemnitesJournalieres, (v) => onChangerRevenu({ ...revenu, indemnitesJournalieres: v }), "fr-ij", "Indemnités journalières (maladie/maternité)")}
      </div>

      <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
        <p className="text-sm text-ink">
          Base R = <span className="font-display font-semibold tabular-nums">{baseR.toFixed(2)} €</span>
          <span className="text-muted"> (plafonnée à {plafondBaseR.toLocaleString("fr-FR")} €)</span>
        </p>
        {plafonne && <p className="text-xs text-amber mt-1">Ton total dépasse le plafond — R est retenue au plafond, pas au total réel.</p>}
      </div>
    </section>
  );
}
