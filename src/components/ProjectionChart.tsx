import { useMemo } from "react";
import type { NiveauStatut } from "../types";
import type { PointSerie } from "../engine/prediction";

interface ProjectionChartProps {
  fenetreDebut: string;
  fenetreFin: string;
  dateCap: string;
  serie: PointSerie[];
  seuilHeures: number;
  heuresActuelles: number;
  niveau: NiveauStatut;
  dateFranchissementProjetee: string | null;
  rythmeMensuelActuel: number;
}

const LARGEUR = 1000;
const HAUTEUR = 300;
const MARGE = { haut: 24, bas: 36, gauche: 16, droite: 16 };

const LABELS_STATUT: Record<NiveauStatut, { texte: string; classeFond: string; classeTexte: string; classeCourbe: string }> = {
  securite: { texte: "Sécurité", classeFond: "bg-mint/15", classeTexte: "text-mint", classeCourbe: "#3FD69B" },
  alerte: { texte: "Alerte", classeFond: "bg-amber/15", classeTexte: "text-amber", classeCourbe: "#F5C46B" },
  bloque: { texte: "Bloqué", classeFond: "bg-red/15", classeTexte: "text-red", classeCourbe: "#F2726B" },
};

function formatDateCourte(iso: string): string {
  const [, mois, jour] = iso.split("-");
  const labels = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${parseInt(jour, 10)} ${labels[parseInt(mois, 10) - 1]}`;
}

export function ProjectionChart({ fenetreDebut, fenetreFin, dateCap, serie, seuilHeures, heuresActuelles, niveau, dateFranchissementProjetee, rythmeMensuelActuel }: ProjectionChartProps) {
  const statut = LABELS_STATUT[niveau];

  const { pathAcquis, pathAire, pathProjection, xToday, yToday, yLigneObjectif, xFranchissement, yFranchissement, ticksMois } = useMemo(() => {
    const debutMs = new Date(fenetreDebut).getTime();
    const finMs = new Date(fenetreFin).getTime();
    const capMs = new Date(dateCap).getTime();
    const dureeMs = Math.max(1, finMs - debutMs);

    const maxHeuresSerie = serie.length > 0 ? Math.max(...serie.map((p) => p.heures)) : 0;
    const maxY = Math.max(seuilHeures * 1.15, maxHeuresSerie * 1.15, 10);

    const x = (iso: string) => MARGE.gauche + ((new Date(iso).getTime() - debutMs) / dureeMs) * (LARGEUR - MARGE.gauche - MARGE.droite);
    const y = (heures: number) => HAUTEUR - MARGE.bas - (heures / maxY) * (HAUTEUR - MARGE.haut - MARGE.bas);

    const pointsAcquis = serie.map((p) => `${x(p.date)},${y(p.heures)}`);
    const pathAcquis = pointsAcquis.length > 0 ? `M ${pointsAcquis.join(" L ")}` : "";
    const pathAire = pointsAcquis.length > 0 ? `${pathAcquis} L ${x(dateCap)},${y(0)} L ${x(fenetreDebut)},${y(0)} Z` : "";

    let pathProjection = "";
    let xFranchissement: number | null = null;
    let yFranchissement: number | null = null;
    if (heuresActuelles < seuilHeures) {
      const cibleDate = dateFranchissementProjetee && new Date(dateFranchissementProjetee).getTime() <= finMs ? dateFranchissementProjetee : fenetreFin;
      const cibleHeures = dateFranchissementProjetee && new Date(dateFranchissementProjetee).getTime() <= finMs ? seuilHeures : heuresActuelles + (rythmeMensuelActuel * (finMs - capMs)) / (1000 * 60 * 60 * 24 * 30);
      pathProjection = `M ${x(dateCap)},${y(heuresActuelles)} L ${x(cibleDate)},${y(Math.min(cibleHeures, maxY))}`;
      if (dateFranchissementProjetee && new Date(dateFranchissementProjetee).getTime() <= finMs) {
        xFranchissement = x(dateFranchissementProjetee);
        yFranchissement = y(seuilHeures);
      }
    }

    const ticksMois: { x: number; label: string }[] = [];
    const nbMois = Math.max(1, Math.round(dureeMs / (1000 * 60 * 60 * 24 * 30)));
    for (let i = 0; i <= nbMois; i += Math.max(1, Math.round(nbMois / 6))) {
      const t = debutMs + (dureeMs * i) / nbMois;
      const iso = new Date(t).toISOString().slice(0, 10);
      ticksMois.push({ x: x(iso), label: formatDateCourte(iso) });
    }

    return {
      pathAcquis,
      pathAire,
      pathProjection,
      xToday: x(dateCap),
      yToday: y(heuresActuelles),
      yLigneObjectif: y(seuilHeures),
      xFranchissement,
      yFranchissement,
      ticksMois,
    };
  }, [fenetreDebut, fenetreFin, dateCap, serie, seuilHeures, heuresActuelles, dateFranchissementProjetee, rythmeMensuelActuel]);

  const joursRestants = Math.max(0, Math.round((new Date(fenetreFin).getTime() - new Date(dateCap).getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="bg-surface border border-line rounded-hero p-6 md:p-7">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statut.classeFond} ${statut.classeTexte}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
            {statut.texte}
          </span>
        </div>
        <div className="text-right">
          <span className="font-display text-2xl md:text-3xl font-semibold tabular-nums tracking-tight">{Math.round(heuresActuelles)}</span>
          <span className="text-muted"> / {seuilHeures} h</span>
          <p className="text-xs text-muted">{joursRestants > 0 ? `${joursRestants} jours restants` : "échéance atteinte"}</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="w-full h-auto" role="img" aria-label="Projection des heures acquises vers l'objectif de 507 heures">
        <defs>
          <linearGradient id="aireMenthe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3FD69B" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3FD69B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ligne objectif */}
        <line x1={MARGE.gauche} y1={yLigneObjectif} x2={LARGEUR - MARGE.droite} y2={yLigneObjectif} stroke="rgba(255,255,255,.14)" strokeDasharray="4 4" />
        <text x={LARGEUR - MARGE.droite} y={yLigneObjectif - 6} textAnchor="end" className="fill-faint text-[11px]">
          Objectif · {seuilHeures} h
        </text>

        {/* aire + courbe acquise */}
        {pathAire && <path d={pathAire} fill="url(#aireMenthe)" />}
        {pathAcquis && <path d={pathAcquis} fill="none" stroke="#3FD69B" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}

        {/* projection pointillée */}
        {pathProjection && <path d={pathProjection} fill="none" stroke={statut.classeCourbe} strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />}

        {/* marqueur "aujourd'hui" */}
        <line x1={xToday} y1={MARGE.haut} x2={xToday} y2={HAUTEUR - MARGE.bas} stroke="rgba(255,255,255,.10)" />
        <circle cx={xToday} cy={yToday} r={4.5} fill="#3FD69B" stroke="#0A0C10" strokeWidth={2} />
        <text x={xToday} y={MARGE.haut - 8} textAnchor="middle" className="fill-muted text-[11px]">
          Aujourd'hui
        </text>

        {/* bulle de franchissement */}
        {xFranchissement !== null && yFranchissement !== null && dateFranchissementProjetee && (
          <g>
            <circle cx={xFranchissement} cy={yFranchissement} r={4} fill={statut.classeCourbe} />
            <text x={xFranchissement} y={yFranchissement - 10} textAnchor="middle" className="fill-ink text-[11px] font-medium">
              {seuilHeures} h · ~{formatDateCourte(dateFranchissementProjetee)}
            </text>
          </g>
        )}

        {/* axe des mois */}
        {ticksMois.map((tick, i) => (
          <text key={i} x={tick.x} y={HAUTEUR - 10} textAnchor="middle" className="fill-faint text-[11px]">
            {tick.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
