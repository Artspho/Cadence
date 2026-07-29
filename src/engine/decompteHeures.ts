// Décompte des heures retenues pour l'affiliation (seuil des 507 h).
// Fonction pure : (contrats, périodes, profil, config, fenêtre) -> résultat.
//
// Piège central du régime, rappelé ici car il structure toute la fonction :
// ce décompte (heuresPour507) et celui utilisé pour LE MONTANT de l'ARE
// (cf. salaireReference.ts : SR / NHT) sont DEUX compteurs différents.
// L'enseignement et la formation comptent ici, mais sont totalement exclus
// du second. Ne jamais les fusionner.
import type { Contrat, DecompteHeuresResultat, PeriodeAssimilee, Profil, RepartitionHeures } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ageAuJour, ajouterJours, dansIntervalle, joursChevauchement, moisCle } from "./dateUtils";

export interface Fenetre {
  dateDebut: string;
  dateFin: string;
}

/**
 * Heures brutes (avant tout plafond) qu'un contrat apporte au décompte 507 h,
 * ventilées par catégorie. Exportée pour permettre à ContractForm.tsx
 * d'afficher un aperçu temps réel SANS dupliquer cette logique dans l'UI.
 */
export function heuresBrutesContrat(contrat: Contrat, config: FranceTravailConfig): { categorie: keyof RepartitionHeures | "enseignementBrut" | "formationBrut"; heures: number } {
  if (contrat.territoire === "eee_suisse_uk") {
    return { categorie: "eee", heures: (contrat.nbJoursEEE ?? 0) * config.heuresParJourEEE };
  }
  switch (contrat.type) {
    case "ptp":
      return { categorie: "ptp", heures: contrat.nbHeures ?? 0 };
    case "enseignement": {
      const conditionsRemplies = Boolean(contrat.etablissementAgree) && Boolean(contrat.enRapportAvecMetier);
      if (!conditionsRemplies) return { categorie: "enseignementBrut", heures: 0 };
      const heures = contrat.typeRemuneration === "cachet" ? (contrat.nbCachets ?? 0) * config.heuresParCachet : contrat.nbHeures ?? 0;
      return { categorie: "enseignementBrut", heures };
    }
    case "formation": {
      const heures = contrat.typeRemuneration === "cachet" ? (contrat.nbCachets ?? 0) * config.heuresParCachet : contrat.nbHeures ?? 0;
      return { categorie: "formationBrut", heures };
    }
    case "artiste":
    default:
      if (contrat.typeRemuneration === "cachet") {
        return { categorie: "cachets", heures: (contrat.nbCachets ?? 0) * config.heuresParCachet };
      }
      return { categorie: "heuresScene", heures: contrat.nbHeures ?? 0 };
  }
}

/**
 * Jours d'une période assimilée retenus dans la fenêtre, **en excluant les jours déjà couverts par un
 * contrat compté dans ce même décompte**.
 *
 * ════════ POURQUOI CETTE EXCLUSION (corrigé le 29/07/2026) ════════
 *
 * Sans elle, un jour couvert à la fois par un contrat et par une période assimilée était compté
 * DEUX FOIS : une fois par ses heures de contrat, une fois par les 5 h/jour assimilées. Le compteur
 * des 507 h s'en trouvait gonflé — donc un feu vert que l'utilisateur n'a pas (devoir sacré n°2).
 *
 * Ce n'est pas qu'une précaution : maternité, adoption, ALD, accident du travail et maladie
 * inter-contrat sont **par définition hors contrat ou entre deux contrats** (guide France Travail).
 * Un chevauchement viole donc la condition réglementaire elle-même — l'exclure est conforme au guide,
 * pas un choix prudentiel de Cadence.
 *
 * Le défaut était LATENT jusqu'ici : aucun chemin d'écriture n'existe pour créer une période
 * (`DonneesApp.periodes` ne peut être peuplé que par un import JSON), donc le tableau est vide en
 * pratique. C'est l'écran de saisie à venir qui l'aurait armé — d'où cette correction AVANT lui.
 *
 * Périmètre de l'exclusion : les contrats **comptés dans cette fenêtre**, et eux seuls. C'est
 * exactement l'ensemble qui apporte des heures ici, donc exactement celui qui peut produire un double
 * compte. Un contrat hors fenêtre n'apporte aucune heure à ce décompte : exclure ses jours
 * sous-compterait sans rien corriger.
 *
 * `suspension_contrat` N'APPELLE PAS cette fonction (cf. `heuresAssimileesFenetre` ci-dessous) : ce
 * type se produit par nature pendant un contrat actif, donc il chevauche toujours un contrat, et
 * cette exclusion le ramènerait à 0 h — ce qui contredit la règle « 5 h/jour, comptent pour 507 h ».
 * Confirmé par le tableau des 6 types de périodes (guide France Travail, 29/07/2026) : il compte
 * toujours 5 h/jour, chevauchement ou non.
 */
export function joursAssimilesHorsContrat(periode: PeriodeAssimilee, fenetre: Fenetre, contratsComptes: Contrat[]): number {
  const debut = periode.dateDebut > fenetre.dateDebut ? periode.dateDebut : fenetre.dateDebut;
  const fin = periode.dateFin < fenetre.dateFin ? periode.dateFin : fenetre.dateFin;

  // Parcours jour par jour plutôt qu'un calcul d'intervalles : une période dure des jours à des mois
  // et les contrats sont peu nombreux, donc le coût est négligeable — et la lisibilité de la règle
  // « ce jour est-il couvert par un contrat ? » vaut mieux ici qu'une arithmétique d'intersections
  // dont les cas limites (contrats qui se chevauchent entre eux) se relisent mal.
  // Comparaison de chaînes ISO (AAAA-MM-JJ) : ordre lexicographique = ordre chronologique.
  let jours = 0;
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    if (!contratsComptes.some((c) => dansIntervalle(jour, c.dateDebut, c.date))) jours += 1;
  }
  return jours;
}

/**
 * Heures apportées par les périodes assimilées (maternité, adoption, AT, ALD, suspension) qui
 * chevauchent la fenêtre. Les maladies inter-contrat n'apportent aucune heure ici : elles n'agissent
 * que sur la fenêtre (cf. periodeReference.ts).
 *
 * `suspension_contrat` compte tous ses jours de chevauchement avec la fenêtre, SANS l'exclusion des
 * jours sous contrat appliquée aux autres types (cf. `joursAssimilesHorsContrat` ci-dessus) : par
 * nature elle se produit pendant un contrat actif, donc l'exclure la viderait toujours.
 */
function heuresAssimileesFenetre(periodes: PeriodeAssimilee[], fenetre: Fenetre, contratsComptes: Contrat[], config: FranceTravailConfig): number {
  return periodes
    .filter((p) => p.type !== "maladie_intercontrat")
    .reduce((total, p) => {
      const jours =
        p.type === "suspension_contrat"
          ? joursChevauchement(p.dateDebut, p.dateFin, fenetre.dateDebut, fenetre.dateFin)
          : joursAssimilesHorsContrat(p, fenetre, contratsComptes);
      return total + jours * config.heuresAssimileesParJour;
    }, 0);
}

export function calculerDecompteHeures(
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  profil: Profil,
  config: FranceTravailConfig,
  fenetre: Fenetre,
): DecompteHeuresResultat {
  const contratsDansFenetre = contrats.filter((c) => dansIntervalle(c.date, fenetre.dateDebut, fenetre.dateFin));

  const repartition: RepartitionHeures = {
    cachets: 0,
    heuresScene: 0,
    eee: 0,
    assimilees: 0,
    ptp: 0,
    enseignementRetenu: 0,
    enseignementExcedentaire: 0,
    formationRetenue: 0,
    formationExcedentaire: 0,
  };

  let enseignementBrutTotal = 0;
  let formationBrutTotal = 0;
  const cachetsParMois: Record<string, number> = {};

  for (const contrat of contratsDansFenetre) {
    const { categorie, heures } = heuresBrutesContrat(contrat, config);
    if (categorie === "enseignementBrut") {
      enseignementBrutTotal += heures;
    } else if (categorie === "formationBrut") {
      formationBrutTotal += heures;
    } else {
      repartition[categorie] += heures;
    }
    if (contrat.territoire !== "eee_suisse_uk" && contrat.typeRemuneration === "cachet" && contrat.type !== "enseignement" && contrat.type !== "formation") {
      const cle = moisCle(contrat.date);
      cachetsParMois[cle] = (cachetsParMois[cle] ?? 0) + (contrat.nbCachets ?? 0);
    }
  }

  repartition.assimilees = heuresAssimileesFenetre(periodes, fenetre, contratsDansFenetre, config);

  // Plafond enseignement : dépend de l'âge à la date anniversaire (fin de fenêtre).
  const age = ageAuJour(profil.dateNaissance, fenetre.dateFin);
  const plafondEnseignementApplicable = age >= 50 ? config.enseignement.plafond50ansEtPlus : config.enseignement.plafondMoins50ans;

  const enseignementRetenuAvantCumul = Math.min(enseignementBrutTotal, plafondEnseignementApplicable);
  const plafondCumul = config.enseignement.plafondCumulEnseignementFormation;
  const formationRetenue = Math.max(0, Math.min(formationBrutTotal, plafondCumul - enseignementRetenuAvantCumul));

  repartition.enseignementRetenu = enseignementRetenuAvantCumul;
  repartition.enseignementExcedentaire = enseignementBrutTotal - enseignementRetenuAvantCumul;
  repartition.formationRetenue = formationRetenue;
  repartition.formationExcedentaire = formationBrutTotal - formationRetenue;

  const total =
    repartition.cachets +
    repartition.heuresScene +
    repartition.eee +
    repartition.assimilees +
    repartition.ptp +
    repartition.enseignementRetenu +
    repartition.formationRetenue;

  return { total, repartition, plafondEnseignementApplicable, cachetsParMois };
}
