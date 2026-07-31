// Module prédictif : à ce rythme, les 507 h seront-elles atteintes avant
// la date anniversaire ? Alimente le graphique de projection (le héros du
// tableau de bord) et le statut feu vert / feu rouge.
import type { Contrat, PeriodeAssimilee, Profil, RythmeRequis, StatutPrediction } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, dansIntervalle, diffJours } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";
import type { Fenetre } from "./decompteHeures";
import { calculerFenetreEnCours } from "./periodeReference";

const JOURS_PAR_MOIS = 30; // approximation volontaire pour un rythme "h/mois" lisible, pas une constante réglementaire
const SEUIL_JOURS_ANNIVERSAIRE_IMMINENT = 30;

export function calculerStatutPrediction(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  dateDuJour: string,
): StatutPrediction {
  // calculerFenetreEnCours (pas calculerFenetreReference seule) : la borne de réadmission du cycle
  // EN COURS doit toujours être dérivée de dateAnniversaire, jamais lue depuis
  // dateAnniversairePrecedente tel quel — ce dernier reste réservé à sa vraie vocation historique
  // (borner la reconstruction des cycles PASSÉS, cf. engine/cycles.ts). Bug réel corrigé le
  // 31/07/2026 : lire le champ tel quel ici pouvait soit recompter les heures de l'ancien droit
  // (si le champ portait une borne trop ancienne), soit produire une fenêtre invalide (si le champ
  // avait été mis à jour pour la vocation historique de cycles.ts) — cf. periodeReference.ts,
  // calculerFenetreEnCours pour le détail complet du conflit.
  const fenetre = calculerFenetreEnCours(profil, contrats, periodes, config, dateDuJour);
  // Repli honnête : quand le seuil ajusté de réadmission n'est pas calculable (historique de
  // contrats insuffisant, cf. periodeReference.ts), on ne présente jamais le plafond de sécurité
  // de l'algorithme (ex. 1515 h) comme un vrai seuil — on retombe sur le seuil standard 507 h,
  // et `seuilReadmission.calculable === false` porte l'information pour l'UI (bandeau, alerte).
  const seuilHeures = fenetre.seuilReadmission.calculable ? fenetre.seuilReadmission.seuilHeuresAjuste : config.seuilHeures;

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

  // Heures "certaines à venir" : contrats déjà signés, datés après dateCap, dans la fenêtre.
  // decompteHeures.ts/salaireReference.ts les comptent déjà (ils tournent sur la fenêtre complète,
  // sans notion de "aujourd'hui") — on rend ça explicite ici plutôt que de laisser le hero/graphique
  // les ignorer silencieusement (l'incohérence qu'ils affichaient jusqu'ici : "0 / 507 h" au hero à
  // côté d'une répartition qui comptait déjà ces heures). Pas une projection : un fait déjà dans les
  // données. Math.max(0, ...) est un plancher défensif (jamais négatif), pas une approximation :
  // dans un cas de bord où le plafond cumulé enseignement+formation se réarrange entre les deux
  // fenêtres, il fait tendre vers "moins d'heures certaines affichées" plutôt que l'inverse —
  // jamais de sur-affichage (devoir sacré n°2).
  const decompteFenetreComplete = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
  const heuresCertainesAVenir = Math.max(0, decompteFenetreComplete.total - heuresActuelles);
  const heuresAvecCertain = heuresActuelles + heuresCertainesAVenir;

  const joursEcoules = Math.max(1, diffJours(fenetre.dateDebut, dateCap));
  const rythmeMensuelActuel = (heuresActuelles / joursEcoules) * JOURS_PAR_MOIS;

  const joursRestants = Math.max(0, diffJours(dateCap, fenetre.dateFin));

  // rythmeRequis/dateFranchissementProjetee : le numérateur (heures) tient compte du certain à
  // venir, mais le dénominateur temps reste `joursRestants` (dateCap → fin de fenêtre), PAS la fin
  // du segment certain. Un contrat déjà signé réduit l'écart à combler, il ne consomme pas le
  // calendrier restant — l'utilisateur peut encore signer un AUTRE contrat n'importe quel jour
  // avant l'anniversaire, y compris après la date du dernier contrat déjà connu. (Bug trouvé en
  // testant : baser le dénominateur sur la fin du segment certain fait tomber joursRestants à 0,
  // et donc afficher à tort "delai_expire", dès qu'un contrat à venir tombe pile sur la date
  // anniversaire — alors que l'échéance réelle, elle, n'est pas du tout dépassée.) Identique à
  // heuresRestantes/joursRestants quand heuresCertainesAVenir === 0 : aucun contrat à venir ne
  // change donc rien au comportement existant.
  const heuresRestantesApresCertain = Math.max(0, seuilHeures - heuresAvecCertain);

  // Plus aucun Infinity ici : quand le délai est à zéro, on nomme la vraie cause (donnée
  // manquante vs échéance réellement dépassée) plutôt que de renvoyer une sentinelle brute.
  const rythmeRequis: RythmeRequis =
    joursRestants > 0
      ? { atteignable: true, heuresParMois: (heuresRestantesApresCertain / joursRestants) * JOURS_PAR_MOIS }
      : heuresRestantesApresCertain > 0
        ? { atteignable: false, raison: anniversaireConnu ? "delai_expire" : "anniversaire_inconnu" }
        : { atteignable: true, heuresParMois: 0 };

  let dateFranchissementProjetee: string | null = null;
  if (heuresRestantesApresCertain > 0 && rythmeMensuelActuel > 0) {
    const joursNecessaires = Math.ceil(heuresRestantesApresCertain / (rythmeMensuelActuel / JOURS_PAR_MOIS));
    dateFranchissementProjetee = ajouterJours(dateCap, joursNecessaires);
  }

  let niveau: StatutPrediction["niveau"];
  if (heuresActuelles >= seuilHeures) {
    niveau = "securite";
  } else if (heuresAvecCertain >= seuilHeures) {
    // Correction du faux pessimisme : des contrats déjà signés à venir peuvent suffire à eux seuls,
    // même si le rythme passé est faible ou nul (ex. tout juste réadmis) — ce n'est pas une
    // projection, ne pas attendre que la ligne pointillée "au rythme" le confirme.
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

  const message = construireMessage(niveau, heuresActuelles, seuilHeures, dateFranchissementProjetee, joursRestants, anniversaireConnu, heuresRestantesApresCertain);

  return {
    niveau,
    heuresActuelles,
    seuilHeures,
    heuresRestantes,
    dateAnniversaire: fenetre.dateFin,
    joursRestants,
    anniversaireConnu,
    heuresCertainesAVenir,
    heuresRestantesApresCertain,
    seuilReadmission: fenetre.seuilReadmission,
    rythmeMensuelActuel,
    rythmeRequis,
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
  heuresRestantesApresCertain: number,
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
    // Écart net des heures déjà certaines à venir (contrats signés) — sinon ce message et le
    // "vise environ X h/mois" de alertes.ts (basé sur ce même écart net) se contrediraient.
    return `Rythme insuffisant pour renouveler tes droits : il te manque ${Math.ceil(heuresRestantesApresCertain)} h avant l'échéance.`;
  }
  if (joursRestants <= 0) return `Échéance atteinte sans les ${seuil} h requises.`;
  return `Échéance proche (${joursRestants} j) et ${Math.ceil(heuresRestantesApresCertain)} h manquantes : agis vite.`;
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

/**
 * Série cumulative des heures "certaines à venir" : contrats déjà signés, datés après `dateCap`,
 * dans la fenêtre de référence. Pas une projection — decompteHeures.ts les compte déjà dans le
 * total "pleine fenêtre" (cf. heuresCertainesAVenir de StatutPrediction) ; cette série sert
 * uniquement à positionner ce fait sur le graphique. Premier point = (dateCap, heures acquises à ce
 * jour), pour se raccorder visuellement à la fin de `construireSerieAcquisition`. Aucun contrat à
 * venir → un seul point (dateCap, heuresActuelles), le segment ne se dessine alors pas (longueur 1).
 */
export function construireSerieAVenir(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  fenetre: Fenetre,
  dateCap: string,
): PointSerie[] {
  const decompteAJour = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: fenetre.dateDebut, dateFin: dateCap });
  const datesAVenir = Array.from(
    new Set(contrats.filter((c) => diffJours(dateCap, c.date) > 0 && dansIntervalle(c.date, fenetre.dateDebut, fenetre.dateFin)).map((c) => c.date)),
  ).sort();

  const points: PointSerie[] = [{ date: dateCap, heures: decompteAJour.total }];
  for (const date of datesAVenir) {
    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: fenetre.dateDebut, dateFin: date });
    points.push({ date, heures: decompte.total });
  }
  return points;
}
