// Calcule la fenêtre de référence (365 j glissants) et ses allongements.
//
// Deux mécanismes distincts peuvent l'allonger :
//  1. Maladie inter-contrat indemnisée par la SS : ses jours sont neutralisés
//     et la fenêtre est repoussée d'autant vers le passé.
//  2. Réadmission : si le seuil n'est pas atteint au 365e jour, la fenêtre
//     peut être étendue par tranches de 30 j, chaque tranche ajoutant 42 h
//     au seuil exigé (Annexe 10).
//
// Simplification MVP assumée (cf. §10 du prompt produit) : l'allongement de
// réadmission devrait être borné par la date de la dernière ouverture de
// droits précédente ; ce champ n'existe pas encore dans le modèle Profil.
// On applique donc un plafond pragmatique de tranches (TRANCHES_MAX) pour
// garantir la terminaison, plutôt que d'inventer une borne réglementaire.
import type { Contrat, FenetreReference, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";

const TRANCHES_MAX = 24; // garde-fou de terminaison — cf. note ci-dessus, pas une valeur réglementaire

function sommeJoursMaladie(periodes: PeriodeAssimilee[]): number {
  return periodes
    .filter((p) => p.type === "maladie_intercontrat")
    .reduce((total, p) => {
      const jours = Math.round((new Date(p.dateFin).getTime() - new Date(p.dateDebut).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return total + Math.max(0, jours);
    }, 0);
}

export function calculerFenetreReference(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  dateDuJour: string,
): FenetreReference {
  // Une première admission n'a par définition pas encore de date anniversaire :
  // on utilise alors une fenêtre glissante se terminant aujourd'hui, pour ne
  // jamais produire de division par zéro ni de fenêtre incohérente.
  const dateFin = profil.dateAnniversaire && profil.dateAnniversaire.length > 0 ? profil.dateAnniversaire : dateDuJour;

  const joursAllongementMaladie = sommeJoursMaladie(periodes);
  const dateDebutBase = ajouterJours(dateFin, -(config.periodeReferenceJours - 1));
  const dateDebutAllonge = ajouterJours(dateDebutBase, -joursAllongementMaladie);

  if (profil.situation !== "readmission") {
    return { dateDebut: dateDebutAllonge, dateFin, joursAllongementMaladie, seuilReadmission: { calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: config.seuilHeures } };
  }

  // Date de fin de la précédente période de droits (Profil.dateAnniversairePrecedente,
  // optionnelle, réadmission uniquement) : quand elle est connue, elle devient la vraie borne de
  // recherche — ne jamais recompter des heures déjà utilisées pour justifier les droits
  // précédents. TRANCHES_MAX reste un garde-fou de sécurité absolu (ex. borne saisie par erreur
  // très lointaine), mais ne devrait plus jamais être le facteur limitant réel dès que la borne
  // est renseignée.
  const bourne = profil.dateAnniversairePrecedente && profil.dateAnniversairePrecedente.length > 0 ? profil.dateAnniversairePrecedente : null;

  // Corrigé le 31/07/2026 (chantier renouvellement anticipé) : la borne doit s'appliquer À LA
  // FENÊTRE DE BASE elle-même, pas seulement à l'extension par tranches ci-dessous. Texte officiel
  // du simulateur France Travail (simucalcul.pole-emploi-services.fr, consulté le 31/07/2026) :
  // « Cette période comprend les 365 jours précédant la dernière fin de contrat [...], DANS LA
  // LIMITE de la dernière fin de contrat ayant servi à ouvrir un droit. » Quand le droit précédent
  // s'est terminé il y a MOINS de 365 j (cas de toute demande de renouvellement anticipé, par
  // construction — mais aussi de toute réadmission rapprochée), la fenêtre naïve dateFin-364
  // déborde AVANT cette borne : sans ce correctif, une réadmission dont le seuil est déjà atteint
  // dans la fenêtre naïve ressortait avec une fenêtre trop large (365 j) et un SR/NHT gonflés par
  // des contrats déjà comptés pour le droit précédent — validé par le cas réel du 31/07/2026
  // (Notification 2 : FCT 17/01/2026, fenêtre réelle 24/03/2025→17/01/2026, 299 j, PAS 365 j ; cf.
  // engine/renouvellementAnticipe.test.ts, docs/validation.md Réel #1). Avant ce correctif, aucun
  // test n'exerçait ce cas précis (seuil déjà atteint dans la fenêtre de base ET borne plus proche
  // que 365 j) — cf. periodeReference.test.ts pour les cas déjà couverts (extension réussie,
  // historique insuffisant, borne atteinte SANS succès).
  const dateDebutBorne = bourne !== null && bourne >= dateDebutAllonge ? ajouterJours(bourne, 1) : dateDebutAllonge;

  // Réadmission : on étend par tranches de 30 j tant que le seuil ajusté n'est pas atteint. `trouve`
  // est mis à true UNIQUEMENT au moment du `break` de succès ; `borneAtteinte` UNIQUEMENT au moment
  // du `break` par la borne réelle. Si aucun des deux n'est mis à true, la sortie ne peut venir que
  // de l'épuisement de TRANCHES_MAX (cf. periodeReference.test.ts, "dette tracée" dans
  // validation.md : ne jamais déduire une issue du compteur de tranches par relecture implicite,
  // toujours un booléen explicite posé au point de sortie).
  let tranches = 0;
  let dateDebutCourante = dateDebutBorne;
  let seuilCourant = config.seuilHeures;
  let trouve = false;
  let borneAtteinte = false;

  while (tranches < TRANCHES_MAX) {
    const { total } = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: dateDebutCourante, dateFin });
    if (total >= seuilCourant) {
      trouve = true;
      break;
    }
    const dateDebutSuivante = ajouterJours(dateDebutCourante, -config.readmission.tranchePeriodeJours);
    // TODO: vérifier si la borne est inclusive ou exclusive — source: guide FT mars 2026.
    // Traité ici comme inclusive : la fenêtre peut descendre jusqu'à dateAnniversairePrecedente
    // (égalité autorisée), jamais en-deçà (dateDebutSuivante strictement antérieure = refusée).
    if (bourne !== null && dateDebutSuivante < bourne) {
      borneAtteinte = true;
      break;
    }
    tranches += 1;
    seuilCourant = config.seuilHeures + tranches * config.readmission.affiliationMajoreeParPeriode;
    dateDebutCourante = dateDebutSuivante;
  }

  if (trouve) {
    return {
      dateDebut: dateDebutCourante,
      dateFin,
      joursAllongementMaladie,
      seuilReadmission: { calculable: true, tranchesReadmission: tranches, seuilHeuresAjuste: seuilCourant },
    };
  }

  if (borneAtteinte && bourne !== null) {
    // Recherche menée intégralement jusqu'à la vraie borne, sans succès : un vrai résultat
    // réglementaire (non éligible à l'allongement), pas un manque de données côté Cadence — on
    // garde la fenêtre pleinement étendue (contrairement au cas historique_insuffisant ci-dessous)
    // car elle reflète la recherche complète et honnête, pas une extension arbitraire non validée.
    return {
      dateDebut: dateDebutCourante,
      dateFin,
      joursAllongementMaladie,
      seuilReadmission: { calculable: false, raison: "hors_bornes", tranchesTentees: tranches, dateAnniversairePrecedente: bourne },
    };
  }

  // Épuisé sans solution et sans borne réelle atteinte (pas de dateAnniversairePrecedente connue,
  // ou une borne si lointaine que le garde-fou absolu TRANCHES_MAX a coupé la recherche avant de
  // l'atteindre) : pas de seuil gonflé affiché comme réel (devoir sacré n°2). Repli sur la fenêtre
  // de base non étendue — étendre plus loin n'a rien trouvé de plus (ou n'a pas pu être vérifié
  // jusqu'au bout), donc rien ne justifie de garder une fenêtre poussée sans validation.
  return { dateDebut: dateDebutAllonge, dateFin, joursAllongementMaladie, seuilReadmission: { calculable: false, raison: "historique_insuffisant", tranchesTentees: TRANCHES_MAX } };
}

/**
 * FCT du droit actuellement en cours, déduite de `Profil.dateAnniversaire` (la PROCHAINE échéance,
 * jamais la FCT elle-même, cf. types/index.ts) : échéance - 12 mois exactement, l'inverse de la
 * Règle #2 (engine/renouvellementAnticipe.ts : NouveauDroitCalcule.dateAnniversaire = FCT retenue +
 * 12 mois). Fiable car cette règle s'applique TOUJOURS à l'ouverture d'un droit (naturelle ou
 * anticipée), quelle qu'ait été la durée réelle de la fenêtre qui l'a produite.
 */
export function deriverFctRetenueActuelle(dateAnniversaire: string, config: FranceTravailConfig): string {
  return ajouterJours(dateAnniversaire, -config.periodeReferenceJours);
}

/**
 * Fenêtre du CYCLE EN COURS (progression vers la prochaine échéance, ce que le Dashboard affiche) —
 * à distinguer de `calculerFenetreReference` seule, qui accepte le `dateAnniversairePrecedente`
 * du profil tel quel : utile pour une validation RÉTROSPECTIVE ponctuelle à une FCT choisie (cf.
 * `engine/renouvellementAnticipe.ts`, qui construit son propre profil temporaire), mais PAS pour le
 * suivi en direct.
 *
 * Bug réel corrigé le 31/07/2026 : `Profil.dateAnniversairePrecedente` a UNE seule signification
 * possible à la fois, mais deux usages légitimes et INCOMPATIBLES le réclamaient :
 *  1. `engine/cycles.ts` : reconstruire la vraie borne du cycle PASSÉ (ex. 23/03/2025 — la FCT qui a
 *     ouvert le droit avant l'actuel). Une donnée historique, saisie une fois, qui ne bouge plus.
 *  2. Le suivi du cycle EN COURS (ici) : borner la recherche par tranches pour ne jamais recompter
 *     les heures déjà utilisées pour ouvrir le droit ACTUEL (ex. 17/01/2026 — la FCT du droit
 *     actuel, PAS celle d'avant).
 * Si le champ persisté sert au cas 1 (sa vraie vocation, cf. types/index.ts), l'utiliser tel quel
 * ici recréerait exactement le bug d'origine (recomptage des heures de l'ancien droit) dès que la
 * réadmission est un peu ancienne. La borne du cycle en cours est donc TOUJOURS dérivée de
 * `dateAnniversaire` (`deriverFctRetenueActuelle`), jamais lue depuis `dateAnniversairePrecedente`
 * — qui reste libre de porter sa vraie vocation historique, cf. `engine/cycles.ts`.
 */
export function calculerFenetreEnCours(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  dateDuJour: string,
): FenetreReference {
  if (!profil.dateAnniversaire || profil.situation !== "readmission") {
    return calculerFenetreReference(profil, contrats, periodes, config, dateDuJour);
  }
  const profilCycleEnCours: Profil = { ...profil, dateAnniversairePrecedente: deriverFctRetenueActuelle(profil.dateAnniversaire, config) };
  return calculerFenetreReference(profilCycleEnCours, contrats, periodes, config, dateDuJour);
}
