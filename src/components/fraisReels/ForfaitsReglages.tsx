import type { ConfigFraisReels, Depense, ModeForfait } from "../../types/fraisReels";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFraisReels } from "../../engine/fraisReels";

interface ForfaitsReglagesProps {
  config: ConfigFraisReels;
  depenses: Depense[];
  ftConfig: FranceTravailConfig;
  onChangerConfig: (config: ConfigFraisReels) => void;
}

function RubriqueForfait({ label, mode, montantForfait, montantReel, onChanger }: { label: string; mode: ModeForfait; montantForfait: number; montantReel: number; onChanger: (mode: ModeForfait) => void }) {
  const forfaitAvantageux = montantForfait >= montantReel;
  return (
    <div>
      <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChanger("forfait")}
          className={`text-left rounded-lg border px-3 py-2 transition-colors ${mode === "forfait" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
        >
          <span className={`block text-sm ${forfaitAvantageux ? "text-ink font-semibold" : "text-muted"}`}>Forfait ({montantForfait.toFixed(2)} €)</span>
        </button>
        <button
          type="button"
          onClick={() => onChanger("reel")}
          className={`text-left rounded-lg border px-3 py-2 transition-colors ${mode === "reel" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
        >
          <span className={`block text-sm ${!forfaitAvantageux ? "text-ink font-semibold" : "text-muted"}`}>Montant réel ({montantReel.toFixed(2)} €)</span>
        </button>
      </div>
    </div>
  );
}

export function ForfaitsReglages({ config, depenses, ftConfig, onChangerConfig }: ForfaitsReglagesProps) {
  const forfaitsDesactives = config.profilFiscal === "enseignant_pur";

  const forfaitA = calculerFraisReels(depenses, { ...config, modeA: "forfait" }, ftConfig).montantA;
  const reelA = calculerFraisReels(depenses, { ...config, modeA: "reel" }, ftConfig).montantA;
  const forfaitB = calculerFraisReels(depenses, { ...config, modeB: "forfait" }, ftConfig).montantB;
  const reelB = calculerFraisReels(depenses, { ...config, modeB: "reel" }, ftConfig).montantB;

  const localProActif = Boolean(config.localPro);
  const ratioLocalPro = config.localPro && config.localPro.surfaceTotalM2 > 0 ? (config.localPro.surfaceProM2 / config.localPro.surfaceTotalM2) * 100 : null;
  const surfaceIncoherente = Boolean(config.localPro) && config.localPro!.surfaceProM2 > config.localPro!.surfaceTotalM2;

  const repasActif = config.nombreRepasC3 !== undefined;

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-6">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">Réglages forfaits</h2>
        <p className="text-sm text-muted">14 % et 5 % sont indépendants : choisis, par rubrique, le forfait ou le montant réel (SNAM §1).</p>
      </div>

      {forfaitsDesactives ? (
        <p className="text-sm text-amber bg-amber/10 rounded-lg px-4 py-3">
          Profil « enseignant pur » : aucun forfait 14 %/5 % ne s'applique (SNAM §2). Seules les catégories C et D restent déductibles au réel.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RubriqueForfait label="Rubrique A (14 %)" mode={config.modeA} montantForfait={forfaitA} montantReel={reelA} onChanger={(modeA) => onChangerConfig({ ...config, modeA })} />
          <RubriqueForfait label="Rubrique B (5 %)" mode={config.modeB} montantForfait={forfaitB} montantReel={reelB} onChanger={(modeB) => onChangerConfig({ ...config, modeB })} />
        </div>
      )}

      <div className="border-t border-line pt-5 space-y-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={localProActif}
            onChange={(e) => onChangerConfig({ ...config, localPro: e.target.checked ? { surfaceTotalM2: 0, surfaceProM2: 0 } : undefined })}
          />
          J'ai un local professionnel à domicile (C6)
        </label>
        {localProActif && config.localPro && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div>
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c6-surface-totale">
                Surface totale (m²)
              </label>
              <input
                id="c6-surface-totale"
                type="number"
                min="0"
                step="0.1"
                value={config.localPro.surfaceTotalM2 === 0 ? "" : config.localPro.surfaceTotalM2}
                onChange={(e) => onChangerConfig({ ...config, localPro: { ...config.localPro!, surfaceTotalM2: e.target.value === "" ? 0 : parseFloat(e.target.value) } })}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c6-surface-pro">
                Surface pro (m²)
              </label>
              <input
                id="c6-surface-pro"
                type="number"
                min="0"
                step="0.1"
                value={config.localPro.surfaceProM2 === 0 ? "" : config.localPro.surfaceProM2}
                onChange={(e) => onChangerConfig({ ...config, localPro: { ...config.localPro!, surfaceProM2: e.target.value === "" ? 0 : parseFloat(e.target.value) } })}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
            {ratioLocalPro !== null && (
              <p className="col-span-2 text-xs text-faint">
                {ratioLocalPro.toFixed(1)} % pro — pré-remplira <code>part pro</code> à la création d'une dépense catégorie C6.
              </p>
            )}
            {surfaceIncoherente && <p className="col-span-2 text-xs text-amber">La surface pro dépasse la surface totale — vérifie ces deux valeurs.</p>}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5 space-y-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={repasActif} onChange={(e) => onChangerConfig({ ...config, nombreRepasC3: e.target.checked ? 0 : undefined })} />
          Je déclare mes repas au forfait, sans justificatifs (C3)
        </label>
        {repasActif && (
          <div className="pl-6 space-y-1">
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c3-nombre-repas">
              Nombre de repas concernés dans l'année
            </label>
            <input
              id="c3-nombre-repas"
              type="number"
              min="0"
              step="1"
              value={config.nombreRepasC3 === 0 ? "" : (config.nombreRepasC3 ?? "")}
              onChange={(e) => onChangerConfig({ ...config, nombreRepasC3: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
            />
            <p className="text-xs text-faint">
              = {((config.nombreRepasC3 ?? 0) * ftConfig.fraisReels.valeurRepasPersonnel2025).toFixed(2)} € ({config.nombreRepasC3 ?? 0} repas × {ftConfig.fraisReels.valeurRepasPersonnel2025.toFixed(2)} €)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
