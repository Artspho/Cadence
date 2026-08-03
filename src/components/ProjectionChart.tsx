import { useMemo } from "react";
import type { NiveauStatut } from "../types";
import type { PointSerie } from "../engine/prediction";

interface ProjectionChartProps {
  fenetreDebut: string;
  fenetreFin: string;
  dateCap: string;
  serie: PointSerie[];
  serieAVenir: PointSerie[];
  seuilHeures: number;
  heuresActuelles: number;
  heuresCertainesAVenir: number;
  niveau: NiveauStatut;
  dateFranchissementProjetee: string | null;
  rythmeMensuelActuel: number;
  anniversaireConnu: boolean;
}

const LARGEUR = 1000;
const HAUTEUR = 300;
const MARGE = { haut: 24, bas: 36, gauche: 16, droite: 16 };

// Un libellé et une couleur par état, sans zone grise (cf. NiveauStatut dans types/index.ts).
// Le VERT est réservé à "securite" : heures réellement acquises ou contrats déjà signés. Une simple
// extrapolation du rythme passé ("en_bonne_voie") ne peut plus l'obtenir — c'était le faux feu vert
// du point 5 de docs/critique_2026-08-03.md.
// Choix du violet pour "en_bonne_voie" plutôt que du bleu (`teal`) : sur CE graphique, le teal
// désigne déjà le segment « confirmé à venir » (contrats signés, un fait). Réutiliser le teal pour la
// projection remettrait la même couleur sur « fait » et sur « projeté » — précisément la confusion
// qu'on est en train de défaire. `violet` est le seul token froid libre de la charte (§8.1) ; la
// charte interdisant les couleurs inventées, on n'introduit aucun hex hors palette.
const LABELS_STATUT: Record<NiveauStatut, { texte: string; classeFond: string; classeTexte: string; classeCourbe: string }> = {
  securite: { texte: "Sécurité", classeFond: "bg-mint/15", classeTexte: "text-mint", classeCourbe: "#3FD69B" },
  en_bonne_voie: { texte: "En bonne voie", classeFond: "bg-violet/15", classeTexte: "text-violet", classeCourbe: "#9B8CFF" },
  a_rattraper: { texte: "À rattraper", classeFond: "bg-amber/15", classeTexte: "text-amber", classeCourbe: "#F5C46B" },
  bloque: { texte: "Bloqué", classeFond: "bg-red/15", classeTexte: "text-red", classeCourbe: "#F2726B" },
};

function formatDateCourte(iso: string): string {
  const [, mois, jour] = iso.split("-");
  const labels = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${parseInt(jour, 10)} ${labels[parseInt(mois, 10) - 1]}`;
}

const TEAL = "#57A9F0"; // segment "confirmé à venir" — même couleur que "heures scène" (charte §8.1)

export function ProjectionChart({
  fenetreDebut,
  fenetreFin,
  dateCap,
  serie,
  serieAVenir,
  seuilHeures,
  heuresActuelles,
  heuresCertainesAVenir,
  niveau,
  dateFranchissementProjetee,
  rythmeMensuelActuel,
  anniversaireConnu,
}: ProjectionChartProps) {
  const statut = LABELS_STATUT[niveau];

  const { pathAcquis, pathAire, pathCertain, marqueursCertain, pathProjection, xToday, yToday, yLigneObjectif, xFranchissement, yFranchissement, ticksMois } = useMemo(() => {
    const debutMs = new Date(fenetreDebut).getTime();
    const finMs = new Date(fenetreFin).getTime();
    const dureeMs = Math.max(1, finMs - debutMs);

    const maxHeuresSerie = Math.max(0, ...serie.map((p) => p.heures), ...serieAVenir.map((p) => p.heures));
    const maxY = Math.max(seuilHeures * 1.15, maxHeuresSerie * 1.15, 10);

    const x = (iso: string) => MARGE.gauche + ((new Date(iso).getTime() - debutMs) / dureeMs) * (LARGEUR - MARGE.gauche - MARGE.droite);
    const y = (heures: number) => HAUTEUR - MARGE.bas - (heures / maxY) * (HAUTEUR - MARGE.haut - MARGE.bas);

    const pointsAcquis = serie.map((p) => `${x(p.date)},${y(p.heures)}`);
    const pathAcquis = pointsAcquis.length > 0 ? `M ${pointsAcquis.join(" L ")}` : "";
    const pathAire = pointsAcquis.length > 0 ? `${pathAcquis} L ${x(dateCap)},${y(0)} L ${x(fenetreDebut)},${y(0)} Z` : "";

    // Segment "confirmé à venir" : contrats déjà signés, pas une projection. `serieAVenir` commence
    // toujours par (dateCap, heuresActuelles) pour se raccorder à la courbe acquise — un seul point
    // (aucun contrat à venir) ne dessine rien.
    const pathCertain = serieAVenir.length > 1 ? `M ${serieAVenir.map((p) => `${x(p.date)},${y(p.heures)}`).join(" L ")}` : "";
    const marqueursCertain = serieAVenir.slice(1).map((p) => ({ x: x(p.date), y: y(p.heures) }));

    // La projection pointillée repart de (dateCap, heuresActuelles) — comme dateFranchissementProjetee
    // (prediction.ts), elle raisonne sur tout le calendrier restant, pas seulement l'après-certain :
    // un contrat certain réduit l'écart à combler (heuresCertainesAVenir), pas le temps disponible
    // pour signer AUTRE CHOSE. La faire repartir visuellement de la fin du segment certain risquerait
    // de dessiner une ligne "à l'envers" si la date projetée tombe avant la date du dernier contrat
    // certain (le rythme seul suffirait avant même que ce contrat n'ait lieu).
    const capMs = new Date(dateCap).getTime();
    const heuresAvecCertain = serieAVenir.length > 0 ? serieAVenir[serieAVenir.length - 1].heures : heuresActuelles;

    let pathProjection = "";
    let xFranchissement: number | null = null;
    let yFranchissement: number | null = null;
    if (heuresAvecCertain < seuilHeures) {
      const cibleDate = dateFranchissementProjetee && new Date(dateFranchissementProjetee).getTime() <= finMs ? dateFranchissementProjetee : fenetreFin;
      const cibleHeures =
        dateFranchissementProjetee && new Date(dateFranchissementProjetee).getTime() <= finMs
          ? seuilHeures
          : heuresActuelles + (rythmeMensuelActuel * (finMs - capMs)) / (1000 * 60 * 60 * 24 * 30);
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
      pathCertain,
      marqueursCertain,
      pathProjection,
      xToday: x(dateCap),
      yToday: y(heuresActuelles),
      yLigneObjectif: y(seuilHeures),
      xFranchissement,
      yFranchissement,
      ticksMois,
    };
  }, [fenetreDebut, fenetreFin, dateCap, serie, serieAVenir, seuilHeures, heuresActuelles, dateFranchissementProjetee, rythmeMensuelActuel]);

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
          <p className="text-xs text-muted">{!anniversaireConnu ? "date inconnue" : joursRestants > 0 ? `${joursRestants} jours restants` : "échéance atteinte"}</p>
          {heuresCertainesAVenir > 0 && <p className="text-xs text-teal mt-0.5">+ {Math.round(heuresCertainesAVenir)} h déjà signées à venir</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted mb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-mint inline-block" aria-hidden />
          Acquis
        </span>
        {pathCertain && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: TEAL }} aria-hidden />
            Confirmé à venir (contrats déjà signés)
          </span>
        )}
        {pathProjection && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed inline-block" style={{ borderColor: statut.classeCourbe }} aria-hidden />
            Projection au rythme actuel
          </span>
        )}
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

        {/* segment "confirmé à venir" : contrats déjà signés, pas une projection — trait plein distinct (teal), un marqueur par contrat */}
        {pathCertain && <path d={pathCertain} fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {marqueursCertain.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={3.5} fill={TEAL} stroke="#0A0C10" strokeWidth={1.5} />
        ))}

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
