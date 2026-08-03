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

  // Heures directes ET cachets convertis comptent ENSEMBLE quand les deux champs sont renseignés
  // sur le MÊME contrat — jamais un choix exclusif entre les deux selon `typeRemuneration`. Confirmé
  // sur pièce réelle le 01/08/2026 (AEM GHS sPAIEctacle : 14 h de répétition + 3 cachets de
  // représentation sur la même attestation, les deux comptent pour les 507 h) et par Benoît, qui
  // connaît la règle réelle : un contrat peut porter seulement des cachets, seulement des heures,
  // ou les deux à la fois. `typeRemuneration` n'est donc PAS un discriminant qui exclut l'autre
  // champ — juste une indication (mode de rémunération principal) qui ne change plus le calcul ici.
  // Avant ce correctif, un ternaire sur `typeRemuneration` ne retenait que l'un des deux champs et
  // ignorait l'autre en silence — sous-comptant un contrat mixte, un vrai bug de calcul (le total
  // heuresPour507 ET le NHT du montant ARE en dépendent, cf. salaireReference.ts).
  // Un contrat qui n'a que l'un des deux (l'autre `null`) se comporte exactement comme avant :
  // `?? 0` neutralise le champ absent, aucune régression sur le cas non-mixte.
  const heuresCombinees = (contrat.nbHeures ?? 0) + (contrat.nbCachets ?? 0) * config.heuresParCachet;

  switch (contrat.type) {
    case "ptp":
      return { categorie: "ptp", heures: contrat.nbHeures ?? 0 }; // PTP : jamais de cachets (1 h = 1 h), règle produit distincte
    case "enseignement": {
      const conditionsRemplies = Boolean(contrat.etablissementAgree) && Boolean(contrat.enRapportAvecMetier);
      return { categorie: "enseignementBrut", heures: conditionsRemplies ? heuresCombinees : 0 };
    }
    case "formation":
      return { categorie: "formationBrut", heures: heuresCombinees };
    case "artiste":
    default:
      // ⚠️ Limite connue, documentée, PAS une erreur de calcul : le total ci-dessus (heuresCombinees)
      // est toujours correct, mais quand les DEUX champs sont renseignés, il est attribué en entier
      // à UNE SEULE des deux catégories d'affichage (repartition.cachets OU .heuresScene, cf.
      // calculerDecompteHeures) selon `typeRemuneration` — la répartition VISUELLE du Dashboard peut
      // donc sous-représenter l'une des deux natures d'heures. Le TOTAL et le NHT ne sont jamais
      // affectés : les deux somment cachets + heuresScene de toute façon (cf. calculerDecompteHeures,
      // salaireReference.ts). À scinder en deux contributions séparées si la répartition visuelle
      // devient elle-même un besoin réel — pas fait ici pour limiter le risque de ce correctif aux
      // 5 points d'appel existants de cette fonction.
      return contrat.typeRemuneration === "cachet" ? { categorie: "cachets", heures: heuresCombinees } : { categorie: "heuresScene", heures: heuresCombinees };
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
    // nbCachets != null plutôt que typeRemuneration === "cachet" : un contrat mixte (heures ET
    // cachets, cf. heuresBrutesContrat ci-dessus) doit compter ses cachets pour l'alerte
    // plafond_cachets_mois même si typeRemuneration vaut "heures" pour ce contrat.
    if (contrat.territoire !== "eee_suisse_uk" && contrat.nbCachets != null && contrat.type !== "enseignement" && contrat.type !== "formation") {
      // `moisCle(contrat.date)` (mois de FIN) est exact PARCE QU'un contrat ne couvre plus deux mois
      // civils : la règle est imposée à l'écriture depuis le 03/08/2026 (lib/contratUnSeulMois.ts),
      // date de début et date de fin tombent donc dans le même mois. C'est ce qui clôt le point 7 de
      // docs/critique_2026-08-03.md : l'alerte « 30 cachets en mars » sur une réalité de 15 + 15
      // venait d'un contrat à cheval, une saisie qui ne peut plus entrer.
      // Réserve assumée : un contrat à cheval ENREGISTRÉ avant cette règle serait encore compté sur
      // son seul mois de fin ici. Aucun cas dans les données de Benoît (vérifié le 03/08/2026 sur les
      // 62 contrats de docs/cadence-fusion-2026-08-03.json : zéro contrat à cheval) — et surtout, la
      // règle ne doit pas s'appliquer à la lecture, qui rejetterait des données légitimes (devoir n°1).
      const cle = moisCle(contrat.date);
      cachetsParMois[cle] = (cachetsParMois[cle] ?? 0) + contrat.nbCachets;
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
