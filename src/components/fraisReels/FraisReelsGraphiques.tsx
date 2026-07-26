import { useMemo, useState } from "react";
import type { ConfigFraisReels, Depense, ResultatFraisReels } from "../../types/fraisReels";
import { moisEntre } from "../../engine/dateUtils";

interface FraisReelsGraphiquesProps {
  resultat: ResultatFraisReels;
  config: ConfigFraisReels;
  depenses: Depense[];
  dateDuJour: string;
}

const CATEGORIES_C_ET_D = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "D"] as const;

export function FraisReelsGraphiques({ resultat, config, depenses, dateDuJour }: FraisReelsGraphiquesProps) {
  const [vue, setVue] = useState<"comparaison" | "temporelle">("comparaison");

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-medium">Comparaison forfait 10 % / frais réels</h2>
        <div className="flex items-center gap-1 text-xs">
          <button onClick={() => setVue("comparaison")} className={`px-2.5 py-1 rounded-full border ${vue === "comparaison" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
            Comparaison annuelle
          </button>
          <button onClick={() => setVue("temporelle")} className={`px-2.5 py-1 rounded-full border ${vue === "temporelle" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
            Au fil de l'année
          </button>
        </div>
      </div>

      {vue === "comparaison" ? <VueComparaison resultat={resultat} /> : <VueTemporelle resultat={resultat} config={config} depenses={depenses} dateDuJour={dateDuJour} />}
    </section>
  );
}

function VueComparaison({ resultat }: { resultat: ResultatFraisReels }) {
  const totalC = CATEGORIES_C_ET_D.reduce((s, c) => s + (resultat.montantC[c] ?? 0), 0);
  const max = Math.max(resultat.forfait10Pct, resultat.totalFraisReels, 1);

  const barre = (label: string, valeur: number, couleur: string) => (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-muted shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(valeur / max) * 100}%`, backgroundColor: couleur }} />
      </div>
      <span className="w-24 text-right text-sm tabular-nums shrink-0">{valeur.toFixed(2)} €</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {barre("Forfait 10 %", resultat.forfait10Pct, "#8B95A6")}
      <div className="space-y-1">
        {barre("Frais réels", resultat.totalFraisReels, "#3FD69B")}
        <div className="pl-[8.5rem] space-y-1 text-[11px] text-faint">
          {resultat.montantA > 0 && <p>dont A (14 %) : {resultat.montantA.toFixed(2)} €</p>}
          {resultat.montantB > 0 && <p>dont B (5 %) : {resultat.montantB.toFixed(2)} €</p>}
          {totalC > 0 && <p>dont C (total) : {totalC.toFixed(2)} €</p>}
        </div>
      </div>

      <div className={`rounded-lg px-4 py-3 text-sm font-medium ${resultat.avantage > 0 ? "bg-mint/10 text-mint" : "bg-amber/10 text-amber"}`}>
        {resultat.avantage > 0
          ? `+${resultat.avantage.toFixed(2)} € → Frais réels recommandés`
          : resultat.avantage < 0
            ? `${resultat.avantage.toFixed(2)} € → Forfait 10 % suffisant pour l'instant`
            : "Montants identiques"}
      </div>
    </div>
  );
}

const LARGEUR = 900;
const HAUTEUR = 260;
const MARGE = { haut: 20, bas: 32, gauche: 16, droite: 16 };

function VueTemporelle({ resultat, config, depenses, dateDuJour }: { resultat: ResultatFraisReels; config: ConfigFraisReels; depenses: Depense[]; dateDuJour: string }) {
  const anneeFiscale = config.anneeFiscale;

  const { chemin, cheminProjection, ticks, xAujourdhui, yForfait, forfaitDejaDepasse, manque } = useMemo(() => {
    const debut = `${anneeFiscale}-01-01`;
    const fin = `${anneeFiscale}-12-31`;
    const mois = moisEntre(debut, fin); // 12 mois "YYYY-MM"

    // Cumul C réel : dépenses catégories C1..D (hors C3 si le forfait repas est actif, même
    // exclusivité que calculerFraisReels) + le forfait C3 lui-même ajouté dès le 1er mois (montant
    // connu à l'avance, ne "croît" pas au fil de l'année comme les dépenses individuelles).
    const forfaitC3 = config.nombreRepasC3 && config.nombreRepasC3 > 0 ? (resultat.montantC.C3 ?? 0) : 0;
    const depensesReellesC = depenses.filter((d) => CATEGORIES_C_ET_D.includes(d.categorie as (typeof CATEGORIES_C_ET_D)[number]) && !(d.categorie === "C3" && forfaitC3 > 0));

    let cumul = forfaitC3;
    const cumulParMois = mois.map((m) => {
      cumul += depensesReellesC.filter((d) => d.date.slice(0, 7) === m).reduce((s, d) => s + d.montantDeductible, 0);
      return cumul;
    });

    const aujourdhuiMoisCle = dateDuJour.slice(0, 7);
    const indexAujourdhui = mois.indexOf(aujourdhuiMoisCle);
    const dansLAnnee = indexAujourdhui !== -1;
    const cumulAujourdhui = dansLAnnee ? cumulParMois[indexAujourdhui] : cumulParMois[cumulParMois.length - 1];

    const maxY = Math.max(resultat.forfait10Pct, ...cumulParMois, 1) * 1.15;
    const x = (i: number) => MARGE.gauche + (i / 11) * (LARGEUR - MARGE.gauche - MARGE.droite);
    const y = (v: number) => HAUTEUR - MARGE.bas - (v / maxY) * (HAUTEUR - MARGE.haut - MARGE.bas);

    const chemin = `M ${cumulParMois.map((v, i) => `${x(i)},${y(v)}`).join(" L ")}`;

    // Projection pointillée : extrapolation du rythme actuel (cumul à date / mois écoulés) jusqu'en décembre.
    let cheminProjection = "";
    if (dansLAnnee && indexAujourdhui < 11) {
      const rythmeMensuel = cumulAujourdhui / Math.max(1, indexAujourdhui + 1);
      const points = [`${x(indexAujourdhui)},${y(cumulAujourdhui)}`];
      for (let i = indexAujourdhui + 1; i <= 11; i++) {
        points.push(`${x(i)},${y(cumulAujourdhui + rythmeMensuel * (i - indexAujourdhui))}`);
      }
      cheminProjection = `M ${points.join(" L ")}`;
    }

    const ticks = mois.map((m, i) => ({ x: x(i), label: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i], key: m }));

    const forfaitDejaDepasse = resultat.montantA + resultat.montantB >= resultat.forfait10Pct;
    const manque = Math.max(0, resultat.forfait10Pct - resultat.montantA - resultat.montantB - cumulAujourdhui);

    return { chemin, cheminProjection, ticks, xAujourdhui: dansLAnnee ? x(indexAujourdhui) : null, yForfait: y(resultat.forfait10Pct), forfaitDejaDepasse, manque };
  }, [resultat, config, depenses, dateDuJour, anneeFiscale]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed inline-block border-faint" aria-hidden />
          Forfait 10 % ({resultat.forfait10Pct.toFixed(2)} €)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-mint inline-block" aria-hidden />
          Cumul frais C réels
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed inline-block border-mint" aria-hidden />
          Projection au rythme actuel
        </span>
      </div>

      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="w-full h-auto" role="img" aria-label="Cumul des frais réels catégorie C au fil de l'année, comparé au forfait 10 %">
        <line x1={MARGE.gauche} y1={yForfait} x2={LARGEUR - MARGE.droite} y2={yForfait} stroke="rgba(255,255,255,.14)" strokeDasharray="4 4" />
        <path d={chemin} fill="none" stroke="#3FD69B" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {cheminProjection && <path d={cheminProjection} fill="none" stroke="#3FD69B" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />}
        {xAujourdhui !== null && <line x1={xAujourdhui} y1={MARGE.haut} x2={xAujourdhui} y2={HAUTEUR - MARGE.bas} stroke="rgba(255,255,255,.10)" />}
        {xAujourdhui !== null && (
          <text x={xAujourdhui} y={MARGE.haut - 6} textAnchor="middle" className="fill-muted text-[11px]">
            Aujourd'hui
          </text>
        )}
        {ticks.map((t) => (
          <text key={t.key} x={t.x} y={HAUTEUR - 10} textAnchor="middle" className="fill-faint text-[11px]">
            {t.label}
          </text>
        ))}
      </svg>

      <p className="text-sm text-ink bg-surface-2 rounded-lg px-4 py-3">
        {forfaitDejaDepasse
          ? "Les forfaits A + B seuls dépassent déjà le forfait 10 %. Chaque euro de frais C est un bonus."
          : `Il te manque ${manque.toFixed(2)} € de frais C pour dépasser le forfait 10 %.`}
      </p>
    </div>
  );
}
