import { useMemo, useState } from "react";
import type { ConfigFraisReels, Depense } from "../../types/fraisReels";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import { moisEntre } from "../../engine/dateUtils";
import { calculerArbitrageForfaits, libelleRecommandation, type ArbitrageForfaits, type ArbitrageRubrique } from "../../lib/arbitrageForfaits";

interface FraisReelsGraphiquesProps {
  config: ConfigFraisReels;
  ftConfig: FranceTravailConfig;
  depenses: Depense[];
  dateDuJour: string;
}

// Rubriques arbitrables : A et B seules ont un forfait auquel comparer le réel. C1-C9 et D sont
// toujours réels et s'additionnent (spec §4) — il n'y a rien à y arbitrer, donc rien à comparer ici.
// Couleurs alignées sur COULEUR_BADGE_CATEGORIE (categorieLabels.ts) : A = mint, B = teal.
const RUBRIQUES = [
  { cle: "a" as const, categorie: "A" as const, titre: "A — Instruments, matériel technique", libelleForfait: "Forfait 14 %", trait: "stroke-mint", puce: "bg-mint", texte: "text-mint" },
  { cle: "b" as const, categorie: "B" as const, titre: "B — Vestimentaire, représentation", libelleForfait: "Forfait 5 %", trait: "stroke-teal", puce: "bg-teal", texte: "text-teal" },
];

export function FraisReelsGraphiques({ config, ftConfig, depenses, dateDuJour }: FraisReelsGraphiquesProps) {
  const [vue, setVue] = useState<"comparaison" | "temporelle">("comparaison");
  const arbitrage = useMemo(() => calculerArbitrageForfaits(depenses, config, ftConfig), [depenses, config, ftConfig]);

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-medium">Forfait ou réel, rubrique par rubrique</h2>
          <p className="text-sm text-muted">A et B s'arbitrent séparément : tu peux garder le forfait sur l'une et passer au réel sur l'autre (SNAM, note 1).</p>
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0">
          <button onClick={() => setVue("comparaison")} className={`px-2.5 py-1 rounded-full border ${vue === "comparaison" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
            Comparaison annuelle
          </button>
          <button onClick={() => setVue("temporelle")} className={`px-2.5 py-1 rounded-full border ${vue === "temporelle" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
            Au fil de l'année
          </button>
        </div>
      </div>

      {arbitrage.forfaitsDesactives ? (
        <p className="text-sm text-amber bg-amber/10 rounded-lg px-4 py-3">
          Profil « enseignant pur » : aucun forfait 14 %/5 % ne s'applique (SNAM §2), il n'y a donc rien à arbitrer. Les catégories C et D restent déductibles au réel.
        </p>
      ) : vue === "comparaison" ? (
        <VueComparaison arbitrage={arbitrage} />
      ) : (
        <VueTemporelle arbitrage={arbitrage} config={config} depenses={depenses} dateDuJour={dateDuJour} />
      )}
    </section>
  );
}

// ── Vue « Comparaison annuelle » : une paire de barres par rubrique ───────────────────────────

function PaireBarres({ rubrique, arbitrage }: { rubrique: (typeof RUBRIQUES)[number]; arbitrage: ArbitrageRubrique }) {
  const max = Math.max(arbitrage.reel, arbitrage.forfait, 1);

  const barre = (label: string, valeur: number, actif: boolean) => (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-muted shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${actif ? rubrique.puce : "bg-faint"}`} style={{ width: `${(valeur / max) * 100}%` }} />
      </div>
      <span className={`w-24 text-right text-sm tabular-nums shrink-0 ${actif ? "text-ink font-medium" : "text-muted"}`}>{valeur.toFixed(2)} €</span>
    </div>
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-[.03em] text-muted">{rubrique.titre}</h3>
      {barre("Montant réel", arbitrage.reel, arbitrage.meilleur === "reel")}
      {barre(rubrique.libelleForfait, arbitrage.forfait, arbitrage.meilleur === "forfait")}
      <p className={`text-xs ${arbitrage.meilleur === "identique" ? "text-muted" : rubrique.texte}`}>{libelleRecommandation(arbitrage)}</p>
    </div>
  );
}

function VueComparaison({ arbitrage }: { arbitrage: ArbitrageForfaits }) {
  return (
    <div className="space-y-5">
      {RUBRIQUES.map((r) => (
        <PaireBarres key={r.cle} rubrique={r} arbitrage={arbitrage[r.cle]} />
      ))}
      <p className="text-xs text-faint">Les catégories C1 à C9 et D n'ont pas de forfait : elles se déclarent toujours au réel et s'ajoutent, quel que soit ton choix ci-dessus.</p>
    </div>
  );
}

// ── Vue « Au fil de l'année » : cumul réel vs ligne de forfait, par rubrique ──────────────────

const LARGEUR = 900;
const HAUTEUR = 260;
const MARGE = { haut: 20, bas: 32, gauche: 16, droite: 16 };
const MOIS_INITIALES = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

interface SerieRubrique {
  rubrique: (typeof RUBRIQUES)[number];
  arbitrage: ArbitrageRubrique;
  cumulParMois: number[];
  cumulAujourdhui: number;
}

function VueTemporelle({ arbitrage, config, depenses, dateDuJour }: { arbitrage: ArbitrageForfaits; config: ConfigFraisReels; depenses: Depense[]; dateDuJour: string }) {
  const anneeFiscale = config.anneeFiscale;

  const { series, ticks, xAujourdhui, echelleY, maxY, chemin } = useMemo(() => {
    const mois = moisEntre(`${anneeFiscale}-01-01`, `${anneeFiscale}-12-31`); // 12 mois "YYYY-MM"
    const indexAujourdhui = mois.indexOf(dateDuJour.slice(0, 7));
    const dansLAnnee = indexAujourdhui !== -1;

    // Une rubrique sans aucune dépense saisie reste au forfait : sans montant réel à confronter, sa
    // ligne n'apprendrait rien, on ne la trace pas.
    const series: SerieRubrique[] = RUBRIQUES.filter((r) => arbitrage[r.cle].aDepensesReelles).map((rubrique) => {
      let cumul = 0;
      const cumulParMois = mois.map((m) => {
        cumul += depenses.filter((d) => d.categorie === rubrique.categorie && d.date.slice(0, 7) === m).reduce((s, d) => s + d.montantDeductible, 0);
        return cumul;
      });
      return {
        rubrique,
        arbitrage: arbitrage[rubrique.cle],
        cumulParMois,
        cumulAujourdhui: dansLAnnee ? cumulParMois[indexAujourdhui] : cumulParMois[cumulParMois.length - 1],
      };
    });

    const valeurs = series.flatMap((s) => [...s.cumulParMois, s.arbitrage.forfait]);
    const maxY = Math.max(...valeurs, 1) * 1.15;
    const x = (i: number) => MARGE.gauche + (i / 11) * (LARGEUR - MARGE.gauche - MARGE.droite);
    const y = (v: number) => HAUTEUR - MARGE.bas - (v / maxY) * (HAUTEUR - MARGE.haut - MARGE.bas);

    return {
      series,
      maxY,
      echelleY: y,
      ticks: mois.map((m, i) => ({ x: x(i), label: MOIS_INITIALES[i], key: m })),
      xAujourdhui: dansLAnnee ? x(indexAujourdhui) : null,
      chemin: (valeurs: number[]) => `M ${valeurs.map((v, i) => `${x(i)},${y(v)}`).join(" L ")}`,
    };
  }, [arbitrage, config, depenses, dateDuJour, anneeFiscale]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface-2 rounded-lg px-4 py-3">
        Aucune dépense saisie en A ni en B : les deux rubriques restent au forfait, il n'y a pas encore de montant réel à suivre au fil de l'année.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.rubrique.cle} className="flex items-center gap-1.5">
            <span className={`w-3 h-0.5 rounded-full inline-block ${s.rubrique.puce}`} aria-hidden />
            Cumul réel {s.rubrique.categorie}
            <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed inline-block border-faint ml-1.5" aria-hidden />
            {s.rubrique.libelleForfait} ({s.arbitrage.forfait.toFixed(2)} €)
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Cumul des dépenses réelles au fil de l'année pour ${series.map((s) => s.rubrique.categorie).join(" et ")}, comparé au forfait de chaque rubrique`}
      >
        {series.map((s) => (
          <g key={s.rubrique.cle}>
            <line x1={MARGE.gauche} y1={echelleY(s.arbitrage.forfait)} x2={LARGEUR - MARGE.droite} y2={echelleY(s.arbitrage.forfait)} className={s.rubrique.trait} strokeDasharray="4 4" strokeOpacity={0.5} />
            <path d={chemin(s.cumulParMois)} fill="none" className={s.rubrique.trait} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
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
        <title>{`Échelle jusqu'à ${maxY.toFixed(0)} €`}</title>
      </svg>

      <ul className="space-y-1">
        {series.map((s) => {
          const depasse = s.cumulAujourdhui >= s.arbitrage.forfait;
          const reste = Math.max(0, s.arbitrage.forfait - s.cumulAujourdhui);
          return (
            <li key={s.rubrique.cle} className="text-sm text-ink bg-surface-2 rounded-lg px-4 py-2.5">
              <span className="font-medium">{s.rubrique.categorie}</span>{" "}
              {depasse
                ? `— tes dépenses réelles (${s.cumulAujourdhui.toFixed(2)} €) dépassent le forfait : passer au réel est plus avantageux.`
                : `— il te manque ${reste.toFixed(2)} € de dépenses réelles pour dépasser le ${s.rubrique.libelleForfait.toLowerCase()}.`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
