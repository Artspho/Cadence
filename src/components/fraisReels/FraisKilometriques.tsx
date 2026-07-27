// Câblage UI du barème kilométrique (C1/C2, cf. spec §4/§7) sur le moteur déjà validé
// (engine/fraisReels/calculerFraisKilometriques.ts, 11 tests) — aucune règle de calcul ni
// constante réglementaire ici : tout vient de `ftConfig` (tranches de puissance fiscale, plafond
// 40 km) et du résultat retourné par le moteur.
import type { ConfigFraisReels } from "../../types/fraisReels";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFraisKilometriques, type ParamsFraisKilometriques, type TypeVehicule } from "../../engine/fraisReels/calculerFraisKilometriques";
import { afficherQuestionChoixPersonnel, descriptifFraisKm, optionsPuissanceFiscale } from "../../lib/fraisKilometriquesUi";

interface FraisKilometriquesProps {
  config: ConfigFraisReels;
  ftConfig: FranceTravailConfig;
  onChangerConfig: (config: ConfigFraisReels) => void;
}

function paramsParDefaut(mode: "c1" | "c2", ftConfig: FranceTravailConfig): ParamsFraisKilometriques {
  const vehicule = { type: "voiture" as const, puissanceFiscale: optionsPuissanceFiscale("voiture", ftConfig)[0]?.cvMax };
  return mode === "c1" ? { vehicule, trajet: { mode: "c1", distanceDomicileTravail: 0, nombreAR: 0 } } : { vehicule, trajet: { mode: "c2", kmParcourus: 0 } };
}

function ChampsVehicule({
  idPrefix,
  vehicule,
  ftConfig,
  onChanger,
}: {
  idPrefix: string;
  vehicule: ParamsFraisKilometriques["vehicule"];
  ftConfig: FranceTravailConfig;
  onChanger: (vehicule: ParamsFraisKilometriques["vehicule"]) => void;
}) {
  const options = optionsPuissanceFiscale(vehicule.type, ftConfig);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor={`${idPrefix}-type`}>
          Type de véhicule
        </label>
        <select
          id={`${idPrefix}-type`}
          value={vehicule.type}
          onChange={(e) => {
            const type = e.target.value as TypeVehicule;
            onChanger({ type, puissanceFiscale: optionsPuissanceFiscale(type, ftConfig)[0]?.cvMax, motorisation: type === "voiture" ? vehicule.motorisation : undefined });
          }}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
        >
          <option value="voiture">Voiture</option>
          <option value="moto">Moto</option>
          <option value="cyclomoteur">Cyclomoteur</option>
        </select>
      </div>

      {options.length > 0 && (
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor={`${idPrefix}-puissance`}>
            Puissance fiscale
          </label>
          <select
            id={`${idPrefix}-puissance`}
            value={vehicule.puissanceFiscale ?? options[0]?.cvMax}
            onChange={(e) => onChanger({ ...vehicule, puissanceFiscale: Number(e.target.value) })}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
          >
            {options.map((o) => (
              <option key={o.cvMax} value={o.cvMax}>
                {o.libelle}
              </option>
            ))}
          </select>
        </div>
      )}

      {vehicule.type === "voiture" && (
        <label className="col-span-2 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={vehicule.motorisation === "electrique"} onChange={(e) => onChanger({ ...vehicule, motorisation: e.target.checked ? "electrique" : undefined })} />
          Véhicule 100 % électrique
        </label>
      )}
    </div>
  );
}

function BandeauPlafonnement() {
  return (
    <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber flex items-start gap-2">
      <span aria-hidden>⚠</span>
      <span>Distance supérieure à 40 km — la déduction est plafonnée à 40 km aller (SNAM §4).</span>
    </p>
  );
}

function BlocC1({ params, ftConfig, onChanger }: { params: ParamsFraisKilometriques | undefined; ftConfig: FranceTravailConfig; onChanger: (p: ParamsFraisKilometriques | undefined) => void }) {
  const trajet = params && params.trajet.mode === "c1" ? params.trajet : undefined;
  const resultat = params ? calculerFraisKilometriques(params, ftConfig) : null;
  const afficherChoixPersonnel = trajet ? afficherQuestionChoixPersonnel(trajet.distanceDomicileTravail, ftConfig) : false;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={params !== undefined} onChange={(e) => onChanger(e.target.checked ? paramsParDefaut("c1", ftConfig) : undefined)} />
        C1 — Transport domicile ↔ travail au barème kilométrique
      </label>

      {params && trajet && (
        <div className="pl-6 space-y-3">
          <ChampsVehicule idPrefix="c1-vehicule" vehicule={params.vehicule} ftConfig={ftConfig} onChanger={(vehicule) => onChanger({ ...params, vehicule })} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c1-distance">
                Distance aller (km)
              </label>
              <input
                id="c1-distance"
                type="number"
                min="0"
                step="0.1"
                value={trajet.distanceDomicileTravail === 0 ? "" : trajet.distanceDomicileTravail}
                onChange={(e) => onChanger({ ...params, trajet: { ...trajet, distanceDomicileTravail: e.target.value === "" ? 0 : parseFloat(e.target.value) } })}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c1-ar">
                Nombre d'allers-retours (année)
              </label>
              <input
                id="c1-ar"
                type="number"
                min="0"
                step="1"
                value={trajet.nombreAR === 0 ? "" : trajet.nombreAR}
                onChange={(e) => onChanger({ ...params, trajet: { ...trajet, nombreAR: e.target.value === "" ? 0 : parseInt(e.target.value, 10) } })}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {afficherChoixPersonnel && (
            <div>
              <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Ce trajet résulte-t-il d'un choix personnel ?</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChanger({ ...params, trajet: { ...trajet, choixPersonnel: true } })}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${trajet.choixPersonnel === true ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
                >
                  <span className="block text-sm text-ink">Oui, choix personnel</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChanger({ ...params, trajet: { ...trajet, choixPersonnel: false } })}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${trajet.choixPersonnel === false ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
                >
                  <span className="block text-sm text-ink">Non, éloignement subi</span>
                </button>
              </div>
            </div>
          )}

          {resultat && (
            <div className="bg-surface-2 border border-line rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm text-ink">
                Km retenus : <span className="font-display font-semibold tabular-nums">{resultat.kmRetenus.toLocaleString("fr-FR")} km</span> — Montant déductible :{" "}
                <span className="font-display font-semibold tabular-nums">{resultat.montantDeductible.toFixed(2)} €</span>
              </p>
              <p className="text-xs text-faint">{descriptifFraisKm(params, resultat)}</p>
            </div>
          )}

          {resultat?.plafonneA40km && <BandeauPlafonnement />}
        </div>
      )}
    </div>
  );
}

function BlocC2({ params, ftConfig, onChanger }: { params: ParamsFraisKilometriques | undefined; ftConfig: FranceTravailConfig; onChanger: (p: ParamsFraisKilometriques | undefined) => void }) {
  const trajet = params && params.trajet.mode === "c2" ? params.trajet : undefined;
  const resultat = params ? calculerFraisKilometriques(params, ftConfig) : null;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={params !== undefined} onChange={(e) => onChanger(e.target.checked ? paramsParDefaut("c2", ftConfig) : undefined)} />
        C2 — Autres trajets professionnels au barème kilométrique
      </label>

      {params && trajet && (
        <div className="pl-6 space-y-3">
          <ChampsVehicule idPrefix="c2-vehicule" vehicule={params.vehicule} ftConfig={ftConfig} onChanger={(vehicule) => onChanger({ ...params, vehicule })} />

          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="c2-km">
              Kilomètres parcourus (année)
            </label>
            <input
              id="c2-km"
              type="number"
              min="0"
              step="0.1"
              value={trajet.kmParcourus === 0 ? "" : trajet.kmParcourus}
              onChange={(e) => onChanger({ ...params, trajet: { ...trajet, kmParcourus: e.target.value === "" ? 0 : parseFloat(e.target.value) } })}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
            />
          </div>

          {resultat && (
            <div className="bg-surface-2 border border-line rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm text-ink">
                Montant déductible : <span className="font-display font-semibold tabular-nums">{resultat.montantDeductible.toFixed(2)} €</span>
              </p>
              <p className="text-xs text-faint">{descriptifFraisKm(params, resultat)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FraisKilometriques({ config, ftConfig, onChangerConfig }: FraisKilometriquesProps) {
  function changerC1(c1: ParamsFraisKilometriques | undefined) {
    onChangerConfig({ ...config, fraisKm: { ...config.fraisKm, c1 } });
  }
  function changerC2(c2: ParamsFraisKilometriques | undefined) {
    onChangerConfig({ ...config, fraisKm: { ...config.fraisKm, c2 } });
  }

  return (
    <div className="border-t border-line pt-5 space-y-5">
      <div>
        <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Barème kilométrique (C1/C2)</span>
        <p className="text-sm text-muted">Alternative aux frais réels justifiés : Cadence calcule le montant depuis le barème administratif (SNAM §4).</p>
      </div>
      <BlocC1 params={config.fraisKm?.c1} ftConfig={ftConfig} onChanger={changerC1} />
      <BlocC2 params={config.fraisKm?.c2} ftConfig={ftConfig} onChanger={changerC2} />
    </div>
  );
}
