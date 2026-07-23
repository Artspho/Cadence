// Centre d'alertes : détecte les problèmes à venir à partir des mêmes
// données que le module prédictif. Fonction pure, calculée à l'affichage
// (cf. §7.5 et la limite structurelle correspondante en §10 : en SPA locale,
// ces alertes ne peuvent pas être proactives — pas de backend pour les
// pousser avant l'échéance, app fermée).
import type { Alerte, Contrat, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerDecompteHeures } from "./decompteHeures";
import { calculerFenetreReference } from "./periodeReference";
import { calculerStatutPrediction } from "./prediction";
import { profilHorsPerimetre } from "../lib/profilHorsPerimetre";

const SEUIL_APPROCHE_CUMUL_ENS_FORMATION = 0.9; // 90 % du plafond de 338 h : avertir avant d'y être

export function detecterAlertes(profil: Profil, contrats: Contrat[], periodes: PeriodeAssimilee[], config: FranceTravailConfig, dateDuJour: string): Alerte[] {
  // Garde-fou "situation mixte" : signalé par l'utilisateur (jamais déduit des
  // contrats). Court-circuit volontaire — aucune autre alerte ne doit être
  // renvoyée à côté, puisqu'elles reposeraient toutes sur un décompte/montant
  // Annexe 10 qui n'est plus fiable pour ce profil (devoir sacré n°2 : jamais
  // de faux feu vert, même partiel).
  if (profilHorsPerimetre(profil)) {
    return [
      {
        code: "situation_mixte",
        niveau: "critique",
        titre: "Profil hors périmètre",
        message: "Tu as signalé une activité hors Annexe 10 : Cadence ne peut pas fournir d'estimation fiable pour ce profil.",
        actionSuggeree: "Rapproche-toi de ton conseiller France Travail pour une estimation fiable de tes droits.",
      },
    ];
  }

  const alertes: Alerte[] = [];

  const fenetre = calculerFenetreReference(profil, contrats, periodes, config, dateDuJour);
  const decompte = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
  const prediction = calculerStatutPrediction(profil, contrats, periodes, config, dateDuJour);

  if (!prediction.seuilReadmission.calculable) {
    // Deux raisons distinctes, jamais confondues (devoir n°2) : "historique_insuffisant" = manque
    // de données côté Cadence (pas de dateAnniversairePrecedente, ou garde-fou de sécurité atteint
    // avant une borne trop lointaine) ; "hors_bornes" = recherche complète jusqu'à la vraie borne,
    // un vrai résultat réglementaire (non éligible à l'allongement), pas un manque de données.
    switch (prediction.seuilReadmission.raison) {
      case "historique_insuffisant":
        alertes.push({
          code: "seuil_readmission_non_calculable",
          niveau: "attention",
          titre: "Seuil de réadmission non calculable",
          message: "Seuil de réadmission non calculable avec tes données actuelles.",
          actionSuggeree: "Ajoute tes contrats antérieurs si tu en as, ou renseigne ta précédente ouverture de droits dans « Mon profil ».",
        });
        break;
      case "hors_bornes":
        alertes.push({
          code: "seuil_readmission_non_calculable",
          niveau: "attention",
          titre: "Seuil de réadmission non atteint",
          message: "Même en remontant jusqu'à ton ancienne ouverture de droits, le total d'heures retrouvé n'atteint pas le seuil.",
          actionSuggeree: "Si tu as entre 338 et 506 h, la clause de rattrapage peut s'appliquer — contacte France Travail pour confirmer.",
        });
        break;
      default: {
        // Exhaustivité forcée par le compilateur (comme libelleRythmeRequis dans Dashboard.tsx) :
        // jamais de `return` ici, ce switch est imbriqué dans une fonction qui construit encore
        // d'autres alertes après ce bloc — un `return` tronquerait le reste de `detecterAlertes`.
        // Assertion sur la valeur entière, pas seulement `.raison` (narrowing du switch limité à
        // la sous-propriété sur une union à plusieurs variantes `calculable:false` — vérifié
        // empiriquement, cf. commit).
        const _exhaustif: never = prediction.seuilReadmission;
        void _exhaustif;
      }
    }
  }

  if (prediction.niveau === "alerte" && prediction.rythmeRequis.atteignable) {
    alertes.push({
      code: "rythme_insuffisant",
      niveau: "attention",
      titre: "Rythme insuffisant",
      message: `À ce rythme, tu n'atteindras pas ${prediction.seuilHeures} h avant le ${prediction.dateAnniversaire}. Il manque ${Math.ceil(prediction.heuresRestantesApresCertain)} h.`,
      actionSuggeree: `Vise environ ${Math.ceil(prediction.rythmeRequis.heuresParMois)} h/mois d'ici l'échéance pour rattraper le rythme.`,
    });
  }
  // prediction.rythmeRequis.atteignable === false ET niveau === "alerte" signifie forcément
  // raison "anniversaire_inconnu" (le cas "delai_expire" bascule toujours en niveau "bloque",
  // cf. prediction.ts) : rien n'est "imminent" pour un profil dont la date anniversaire est
  // inconnue, donc aucune alerte de rythme ici — l'invite à renseigner la date vit dans
  // Dashboard.tsx (branche atteignable:false), pas dans une alerte.

  if (prediction.niveau === "bloque") {
    alertes.push({
      code: "anniversaire_imminent",
      niveau: "critique",
      titre: prediction.joursRestants > 0 ? "Échéance imminente" : "Échéance atteinte",
      message: prediction.message,
      actionSuggeree: prediction.eligibleRattrapage
        ? "Vérifie ton éligibilité à la clause de rattrapage auprès de France Travail."
        : "Contacte France Travail pour étudier tes options avant l'échéance.",
    });
  }

  if (decompte.repartition.enseignementExcedentaire > 0) {
    alertes.push({
      code: "plafond_enseignement",
      niveau: "attention",
      titre: "Plafond d'enseignement dépassé",
      message: `${Math.ceil(decompte.repartition.enseignementExcedentaire)} h d'enseignement ne comptent plus (plafond de ${decompte.plafondEnseignementApplicable} h atteint).`,
      actionSuggeree: "Les heures excédentaires n'augmentent ni le décompte des 507 h ni le montant de l'ARE.",
    });
  }

  const cumulEnsFormation = decompte.repartition.enseignementRetenu + decompte.repartition.formationRetenue;
  const plafondCumul = config.enseignement.plafondCumulEnseignementFormation;
  if (decompte.repartition.formationExcedentaire > 0) {
    alertes.push({
      code: "cumul_ens_formation",
      niveau: "attention",
      titre: "Cumul enseignement + formation dépassé",
      message: `${Math.ceil(decompte.repartition.formationExcedentaire)} h de formation excédentaires : le cumul avec l'enseignement est plafonné à ${plafondCumul} h.`,
    });
  } else if (cumulEnsFormation >= plafondCumul * SEUIL_APPROCHE_CUMUL_ENS_FORMATION) {
    alertes.push({
      code: "cumul_ens_formation",
      niveau: "info",
      titre: "Cumul enseignement + formation proche du plafond",
      message: `${Math.ceil(cumulEnsFormation)} h sur ${plafondCumul} h cumulés (enseignement + formation).`,
    });
  }

  for (const [mois, nbCachets] of Object.entries(decompte.cachetsParMois)) {
    if (nbCachets > config.plafondCachetsParMois) {
      alertes.push({
        code: "plafond_cachets_mois",
        niveau: "attention",
        titre: "Plafond de cachets mensuel dépassé",
        message: `${nbCachets} cachets déclarés en ${mois}, au-delà du plafond de ${config.plafondCachetsParMois} cachets/mois (Annexe 10).`,
        actionSuggeree: "Vérifie la saisie ou renseigne-toi sur les règles de proratisation applicables.",
      });
    }
  }

  if (prediction.eligibleRattrapage && prediction.niveau !== "securite") {
    alertes.push({
      code: "eligible_rattrapage",
      niveau: "info",
      titre: "Clause de rattrapage potentiellement mobilisable",
      message: `Entre ${config.readmission.clauseRattrapage.seuilBas} h et ${config.readmission.clauseRattrapage.seuilHaut} h, tu peux être éligible à la clause de rattrapage sous conditions (ancienneté, délai de demande).`,
      actionSuggeree: `Demande à faire dans les ${config.readmission.clauseRattrapage.delaiDemandeJours} jours suivant l'échéance — vérifie l'éligibilité complète auprès de France Travail.`,
    });
  }

  return alertes;
}
