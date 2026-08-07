// Module prédictif : à ce rythme, les 507 h seront-elles atteintes avant
// la date anniversaire ? Alimente le graphique de projection (le héros du
// tableau de bord) et le badge de statut. Ce badge distingue quatre situations
// que l'app confondait avant le 03/08/2026 — acquis, projeté, rattrapable,
// hors de portée : cf. NiveauStatut dans types/index.ts pour le pourquoi.
import type { Contrat, PeriodeAssimilee, Profil, RythmeRequis, StatutPrediction } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, dansIntervalle, diffJours } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";
import type { Fenetre } from "./decompteHeures";
import { calculerFenetreEnCours } from "./periodeReference";
import { formaterDateLisible } from "../lib/dateLisible";

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

  // Plafond de ce qui reste humainement/légalement faisable d'ici l'échéance, en heures. Sert
  // uniquement à ne JAMAIS afficher « Bloqué » sur une situation encore rattrapable (point 6 de la
  // critique du 03/08/2026 : avant, « Bloqué » rouge s'affichait dès 30 jours de l'échéance sans
  // regarder combien d'heures manquaient — il pouvait n'en manquer que 10, soit un seul cachet).
  // Aucun chiffre inventé ici : le plafond de 28 cachets/mois est celui de l'Annexe 10, déjà sourcé
  // dans la config, et un cachet vaut 12 h (config aussi) — soit 336 h/mois. Il est délibérément très
  // GÉNÉREUX (≈ 11 h par jour, tous les jours), et c'est voulu : toute imprécision doit faire pencher
  // vers « encore possible », jamais vers un rouge définitif qui pousserait à renoncer (devoir n°2).
  const heuresMaxParMois = config.plafondCachetsParMois * config.heuresParCachet;
  const heuresMaxAtteignables = (heuresMaxParMois * joursRestants) / JOURS_PAR_MOIS;

  // La projection au rythme passé atteint-elle le seuil avant l'échéance ? C'est une EXTRAPOLATION,
  // jamais un droit acquis — d'où "en_bonne_voie" et non "securite" (point 5 de la critique).
  const projectionSuffit = dateFranchissementProjetee !== null && diffJours(dateFranchissementProjetee, fenetre.dateFin) >= 0;

  let niveau: StatutPrediction["niveau"];
  if (heuresActuelles >= seuilHeures) {
    // Seul vrai vert : heures réellement travaillées.
    niveau = "securite";
  } else if (heuresAvecCertain >= seuilHeures) {
    // Vert aussi : des contrats DÉJÀ SIGNÉS suffisent à eux seuls, même si le rythme passé est faible
    // ou nul (ex. tout juste réadmis). Un fait présent dans les données, pas une projection — ne pas
    // attendre que la ligne pointillée "au rythme" le confirme (correction du faux pessimisme). La
    // critique (point 5) range explicitement les contrats signés du côté « acquis ».
    niveau = "securite";
  } else if (anniversaireConnu && joursRestants <= 0) {
    // Échéance réellement dépassée sans les heures : le seul « Bloqué » qui ne dépend d'aucun seuil
    // d'appréciation. `anniversaireConnu` obligatoire : sans date anniversaire, periodeReference.ts
    // referme la fenêtre sur "aujourd'hui" faute de mieux, joursRestants vaut 0 par artifice de
    // calcul et non parce qu'une échéance serait passée (règle non négociable, cf. plus haut).
    niveau = "bloque";
  } else if (projectionSuffit) {
    niveau = "en_bonne_voie";
  } else if (anniversaireConnu && heuresRestantesApresCertain > heuresMaxAtteignables) {
    // Hors de portée même au plafond légal : là, « Bloqué » est mérité. Même garde
    // `anniversaireConnu` que ci-dessus — sur une fenêtre fictive, joursRestants vaut 0, donc
    // heuresMaxAtteignables vaut 0, et tout profil neuf basculerait à tort en rouge.
    niveau = "bloque";
  } else {
    // Le rythme actuel ne suffit pas, mais l'écart reste atteignable dans le temps restant. Couvre
    // aussi le cas « anniversaire inconnu » (aucun rouge possible ci-dessus) : c'était déjà l'ancien
    // "alerte", même absence d'alarme rouge.
    niveau = "a_rattraper";
  }

  // Imminence : décorrélée du niveau depuis la refonte (elle ne dit rien du caractère atteignable).
  // Volontairement calculée sur `heuresAvecCertain` et non sur le niveau, pour rester un fait
  // vérifiable ; c'est alertes.ts qui décide quoi en faire selon le niveau.
  const echeanceImminente = anniversaireConnu && joursRestants > 0 && joursRestants <= SEUIL_JOURS_ANNIVERSAIRE_IMMINENT && heuresAvecCertain < seuilHeures;

  const { seuilBas, seuilHaut } = config.readmission.clauseRattrapage;
  // "en_bonne_voie" exclu au même titre que "securite" : ces cas valaient tous les deux "securite"
  // avant la refonte, et l'invite « clause de rattrapage mobilisable » n'y apparaissait donc pas.
  // Ne pas l'exclure aurait fait surgir une alerte info supplémentaire (alertes.ts,
  // "eligible_rattrapage") chez quelqu'un dont la trajectoire suffit — du bruit, pas une correction.
  const eligibleRattrapage = niveau !== "securite" && niveau !== "en_bonne_voie" && heuresActuelles >= seuilBas && heuresActuelles <= seuilHaut;

  const message = construireMessage(
    niveau,
    heuresActuelles,
    seuilHeures,
    dateFranchissementProjetee,
    joursRestants,
    anniversaireConnu,
    heuresRestantesApresCertain,
    echeanceImminente,
    heuresMaxParMois,
  );

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
    echeanceImminente,
    message,
  };
}

// Exhaustif par construction (`_exhaustif: never`) : ajouter un état à NiveauStatut sans écrire son
// message ici casse la compilation, plutôt que d'afficher silencieusement un texte d'un autre état.
function construireMessage(
  niveau: StatutPrediction["niveau"],
  heuresActuelles: number,
  seuil: number,
  dateFranchissement: string | null,
  joursRestants: number,
  anniversaireConnu: boolean,
  heuresRestantesApresCertain: number,
  echeanceImminente: boolean,
  heuresMaxParMois: number,
): string {
  switch (niveau) {
    case "securite":
      if (heuresActuelles >= seuil) return `Tu as atteint tes ${seuil} h sur cette période.`;
      // Le seuil n'est pas atteint par les heures travaillées : ce sont des contrats déjà signés qui
      // l'assurent. On le dit, au lieu de laisser croire que les heures sont déjà faites.
      return `Tes contrats déjà signés te font atteindre ${seuil} h sur cette période.`;

    case "en_bonne_voie":
      // Jamais une promesse : la réserve « rien n'est encore acquis » n'est pas une politesse, c'est
      // le fond du point 5 — cette date ne vaut que si le rythme passé se prolonge à l'identique.
      if (dateFranchissement) {
        return `À ton rythme actuel, tu atteindrais ${seuil} h autour du ${formaterDateLisible(dateFranchissement)} — rien n'est encore acquis : il te manque ${Math.ceil(heuresRestantesApresCertain)} h.`;
      }
      return `Ta trajectoire actuelle suffirait à atteindre ${seuil} h, mais rien n'est encore acquis : il te manque ${Math.ceil(heuresRestantesApresCertain)} h.`;

    case "a_rattraper":
      if (!anniversaireConnu) {
        return `Renseigne ta date anniversaire pour un suivi précis. Pour l'instant, tu as ${Math.round(heuresActuelles)} h sur ${seuil} h.`;
      }
      // Écart net des heures déjà certaines à venir (contrats signés) — sinon ce message et le
      // "vise environ X h/mois" de alertes.ts (basé sur ce même écart net) se contrediraient.
      if (echeanceImminente) {
        return `Échéance proche (${joursRestants} j) et ${Math.ceil(heuresRestantesApresCertain)} h manquantes : c'est encore atteignable, mais il faut agir maintenant.`;
      }
      return `Ton rythme actuel ne suffit pas : il te manque ${Math.ceil(heuresRestantesApresCertain)} h en ${joursRestants} j. C'est encore atteignable, mais il faut accélérer.`;

    case "bloque":
      if (joursRestants <= 0) return `Échéance atteinte sans les ${seuil} h requises.`;
      // Le seul cas où l'app annonce que c'est hors de portée avant l'échéance : on dit sur quoi
      // repose ce jugement, pour qu'il soit contestable plutôt que subi.
      return `Il te manque ${Math.ceil(heuresRestantesApresCertain)} h en ${joursRestants} j : hors de portée même au maximum de l'Annexe 10 (${heuresMaxParMois} h/mois). Contacte France Travail pour étudier tes options.`;

    default: {
      const _exhaustif: never = niveau;
      return _exhaustif;
    }
  }
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
