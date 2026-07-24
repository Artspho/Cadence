import { useMemo, useState } from "react";
import type { Contrat, DecompteHeuresResultat, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerFenetreReference } from "../engine/periodeReference";
import { calculerDecompteHeures } from "../engine/decompteHeures";
import { calculerSalaireReference } from "../engine/salaireReference";
import { calculerAJBrutePourFenetre } from "../engine/areBrute";
import { calculerAJNette, calculerSJR } from "../engine/areNette";
import { calculerStatutPrediction } from "../engine/prediction";
import { ContractForm } from "./ContractForm";

interface SimulateurProps {
  profil: Profil;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  config: FranceTravailConfig;
  dateDuJour: string;
  decompteActuel: DecompteHeuresResultat;
}

function evaluer(profil: Profil, contrats: Contrat[], periodes: PeriodeAssimilee[], config: FranceTravailConfig, dateDuJour: string) {
  const fenetre = calculerFenetreReference(profil, contrats, periodes, config, dateDuJour);
  const decompte = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
  const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, fenetre);
  const ajBrute = calculerAJBrutePourFenetre(fenetre, decompte.total, sar ?? sr, nht, config);
  const sjr = calculerSJR(sr, nht, config);
  const ajNette = calculerAJNette(ajBrute.brut, sjr, profil, config);
  const prediction = calculerStatutPrediction(profil, contrats, periodes, config, dateDuJour);
  return { decompte, ajBrute, ajNette, prediction };
}

export function Simulateur({ profil, contrats, periodes, config, dateDuJour, decompteActuel }: SimulateurProps) {
  const [contratSimule, setContratSimule] = useState<Omit<Contrat, "id"> | null>(null);

  const avant = useMemo(() => evaluer(profil, contrats, periodes, config, dateDuJour), [profil, contrats, periodes, config, dateDuJour]);
  const apres = useMemo(() => {
    if (!contratSimule) return avant;
    const contratsSimules = [...contrats, { ...contratSimule, id: "simulation" }];
    return evaluer(profil, contratsSimules, periodes, config, dateDuJour);
  }, [avant, contratSimule, contrats, periodes, profil, config, dateDuJour]);

  const deltaHeures = apres.decompte.total - avant.decompte.total;
  const deltaBrut = apres.ajBrute.brut - avant.ajBrute.brut;
  const deltaNet = apres.ajNette.net - avant.ajNette.net;
  const impactMontant = contratSimule?.type === "enseignement" || contratSimule?.type === "formation";

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="font-display text-lg font-medium mb-3">Et si je signe ce contrat ?</h2>
        <ContractForm profil={profil} config={config} decompteActuel={decompteActuel} onValider={setContratSimule} previsualisationSeulement />
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-medium mb-3">Impact estimé</h2>

        {!contratSimule ? (
          <p className="text-muted text-sm bg-surface border border-line rounded-card p-6">Renseigne un contrat à gauche pour voir son impact, sans qu'il ne soit enregistré.</p>
        ) : (
          <>
            <div className="bg-surface border border-line rounded-card p-5">
              <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Heures (507 h)</p>
              <p className="font-display text-2xl tabular-nums">
                {Math.round(avant.decompte.total)} h <span className="text-muted text-base">→</span> {Math.round(apres.decompte.total)} h
              </p>
              <p className={`text-sm ${deltaHeures >= 0 ? "text-mint" : "text-red"}`}>
                {deltaHeures >= 0 ? "+" : ""}
                {Math.round(deltaHeures)} h
              </p>
              {apres.prediction.dateFranchissementProjetee && (
                <p className="text-xs text-faint mt-1">Franchissement projeté des {apres.prediction.seuilHeures} h : {apres.prediction.dateFranchissementProjetee}</p>
              )}
            </div>

            <div className="bg-surface border border-line rounded-card p-5">
              <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Allocation journalière estimée</p>
              <p className="font-display text-2xl tabular-nums">
                {avant.ajBrute.brut.toFixed(2)} € <span className="text-muted text-base">→</span> {apres.ajBrute.brut.toFixed(2)} € brut
              </p>
              <p className={`text-sm ${deltaBrut >= 0 ? "text-mint" : "text-red"}`}>
                {deltaBrut >= 0 ? "+" : ""}
                {deltaBrut.toFixed(2)} € brut · {deltaNet >= 0 ? "+" : ""}
                {deltaNet.toFixed(2)} € net (estimation)
              </p>
              {impactMontant && deltaBrut === 0 && (
                <p className="text-xs text-faint mt-1">L'enseignement et la formation n'augmentent jamais ce montant, seulement le décompte des 507 h.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
