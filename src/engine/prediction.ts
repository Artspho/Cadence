// Module prédictif : à ce rythme, les 507 h seront-elles atteintes avant
// la date anniversaire ? Alimente le graphique de projection (le héros du
// tableau de bord) et le statut feu vert / feu rouge.
import type { Contrat, PeriodeAssimilee, Profil, StatutPrediction } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, dansIntervalle, diffJours } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";
import type { Fenetre } from "./decompteHeures";
import { calculerFenetreReference } from "./periodeReference";

const JOURS_PAR_MOIS = 30; // approximation volontaire pour un rythme "h/mois" lisible, pas une constante réglementaire
const SEUIL_JOURS_ANNIVERSAIRE_IMMINENT = 30;

export function calculerStatutPrediction(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  dateDuJour: string,
): StatutPrediction {
  const fenetre = calculerFenetreReference(profil, contrats, periodes, config, dateDuJour);
  const seuilHeures = fenetre.seuilHeuresAjuste;

  // Sans date anniversaire connue (première admission sans historique),
  // periodeReference.ts referme la fenêtre sur "aujourd'hui" faute de mieux :
  // ce n'est qu'un artifice de calcul, jamais une vraie échéance dépassée.
  // On ne doit donc jamais en déduire un statut "bloqué" (règle non négociable).
  const anniversaireConnu = Boolean(profil.dateAnniversaire);

  // dateCap : on ne compte que ce qui est réellement acquis à ce jour, même
  // si des contrats déjà signés portent une date future dans la fenêtre.
  const dateCap = diffJours(dateDuJour, fenetre.dateFin) >= 0 ? dateDuJour : fenetre.dateFin;

  const decompteAJour = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: fenetre.dateDebut, dateFin: dateCap });
  const heuresActuelles = decompteAJour.total;
  const heuresRestantes = Math.max(0, seuilHeures - heuresActuelles);

  const joursEcoules = Math.max(1, diffJours(fenetre.dateDebut, dateCap));
  const rythmeMensuelActuel = (heuresActuelles / joursEcoules) * JOURS_PAR_MOIS;

  const joursRestants = Math.max(0, diffJours(dateCap, fenetre.dateFin));
  const rythmeMensuelRequis = joursRestants > 0 ? (heuresRestantes / joursRestants) * JOURS_PAR_MOIS : heuresRestantes > 0 ? Infinity : 0;

  let dateFranchissementProjetee: string | null = null;
  if (heuresRestantes > 0 && rythmeMensuelActuel > 0) {
    const joursNecessaires = Math.ceil(heuresRestantes / (rythmeMensuelActuel / JOURS_PAR_MOIS));
    dateFranchissementProjetee = ajouterJours(dateCap, joursNecessaires);
  }

  let niveau: StatutPrediction["niveau"];
  if (heuresActuelles >= seuilHeures) {
    niveau = "securite";
  } else if (anniversaireConnu && joursRestants <= 0) {
    niveau = "bloque";
  } else if (dateFranchissementProjetee !== null && diffJours(dateFranchissementProjetee, fenetre.dateFin) >= 0) {
    niveau = "securite";
  } else if (anniversaireConnu && joursRestants <= SEUIL_JOURS_ANNIVERSAIRE_IMMINENT) {
    niveau = "bloque";
  } else {
    niveau = "alerte";
  }

  const { seuilBas, seuilHaut } = config.readmission.clauseRattrapage;
  const eligibleRattrapage = niveau !== "securite" && heuresActuelles >= seuilBas && heuresActuelles <= seuilHaut;

  const message = construireMessage(niveau, heuresActuelles, seuilHeures, dateFranchissementProjetee, joursRestants, anniversaireConnu);

  return {
    niveau,
    heuresActuelles,
    seuilHeures,
    heuresRestantes,
    dateAnniversaire: fenetre.dateFin,
    joursRestants,
    rythmeMensuelActuel,
    rythmeMensuelRequis,
    dateFranchissementProjetee,
    eligibleRattrapage,
    message,
  };
}

function formatDateCourte(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  const mois_labels = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${parseInt(jour, 10)} ${mois_labels[parseInt(mois, 10) - 1]}`;
}

function construireMessage(
  niveau: StatutPrediction["niveau"],
  heuresActuelles: number,
  seuil: number,
  dateFranchissement: string | null,
  joursRestants: number,
  anniversaireConnu: boolean,
): string {
  if (niveau === "securite") {
    if (heuresActuelles >= seuil) return "Tu as atteint tes 507 h sur cette période.";
    if (dateFranchissement) return `À ton rythme actuel, tu atteins ${seuil} h autour du ${formatDateCourte(dateFranchissement)}.`;
    return "Tu es sur la bonne trajectoire.";
  }
  if (niveau === "alerte") {
    if (!anniversaireConnu) {
      return `Renseigne ta date anniversaire pour un suivi précis. Pour l'instant, tu as ${Math.round(heuresActuelles)} h sur ${seuil} h.`;
    }
    return `Rythme insuffisant pour renouveler tes droits : il te manque ${Math.ceil(seuil - heuresActuelles)} h avant l'échéance.`;
  }
  if (joursRestants <= 0) return `Échéance atteinte sans les ${seuil} h requises.`;
  return `Échéance proche (${joursRestants} j) et ${Math.ceil(seuil - heuresActuelles)} h manquantes : agis vite.`;
}

export interface PointSerie {
  date: string;
  heures: number;
}

/**
 * Série cumulative des heures acquises entre le début de la fenêtre et
 * `dateCap` (aujourd'hui, en pratique), un point par date de contrat.
 * Réutilisée telle quelle par ProjectionChart.tsx : l'UI ne recalcule
 * jamais elle-même un décompte d'heures.
 */
export function construireSerieAcquisition(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  fenetre: Fenetre,
  dateCap: string,
): PointSerie[] {
  const datesContrats = Array.from(new Set(contrats.filter((c) => dansIntervalle(c.date, fenetre.dateDebut, dateCap)).map((c) => c.date))).sort();

  const points: PointSerie[] = [{ date: fenetre.dateDebut, heures: 0 }];
  for (const date of datesContrats) {
    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: fenetre.dateDebut, dateFin: date });
    points.push({ date, heures: decompte.total });
  }
  if (points[points.length - 1].date !== dateCap) {
    const decompteFinal = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: fenetre.dateDebut, dateFin: dateCap });
    points.push({ date: dateCap, heures: decompteFinal.total });
  }
  return points;
}
