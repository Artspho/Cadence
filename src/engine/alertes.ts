// Centre d'alertes : détecte les problèmes à venir à partir des mêmes
// données que le module prédictif. Fonction pure, calculée à l'affichage
// (cf. §7.5 et la limite structurelle correspondante en §10 : en SPA locale,
// ces alertes ne peuvent pas être proactives — pas de backend pour les
// pousser avant l'échéance, app fermée).
import type { Alerte, Contrat, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerDecompteHeures } from "./decompteHeures";
import { moisCle } from "./dateUtils";
import { calculerSerieDepuisContrats } from "./indemnisationMensuelle";
import { calculerFenetreEnCours } from "./periodeReference";
import { calculerStatutPrediction } from "./prediction";
import { profilHorsPerimetre } from "../lib/profilHorsPerimetre";
import { CONTRADICTION_HORS_A10 } from "../content/contradictionHorsA10";

const SEUIL_APPROCHE_CUMUL_ENS_FORMATION = 0.9; // 90 % du plafond de 338 h : avertir avant d'y être

// `soldeDepart` optionnel (défaut `null`) : seul le module Revenus mensuels le configure (cf.
// RevenusMensuels.tsx) — les appelants qui n'en ont pas encore un ne déclenchent simplement pas
// l'alerte "pas_taux_janvier" (rien à vérifier tant qu'aucune série n'est affichée).
export function detecterAlertes(
  profil: Profil,
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  config: FranceTravailConfig,
  dateDuJour: string,
  soldeDepart: SoldeIndemnisationDepart | null = null,
): Alerte[] {
  const perimetre = profilHorsPerimetre(profil);

  // Garde-fou "situation mixte", cas DÉCLARÉ (mixte / "je ne sais pas") : signalé par l'utilisateur,
  // jamais déduit des contrats. Court-circuit volontaire — aucune autre alerte ne doit être renvoyée
  // à côté, puisqu'elles reposeraient toutes sur un décompte/montant Annexe 10 qui n'est plus fiable
  // pour ce profil (devoir sacré n°2 : jamais de faux feu vert, même partiel).
  if (perimetre.bloquant) {
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

  // Contradiction interne (A10 pur déclaré + salaires hors A10 > 0). PAS de court-circuit ici : on
  // ne sait pas laquelle des deux saisies est fausse, donc l'app reste utilisable et les autres
  // alertes gardent leur sens. L'alerte est en tête de liste et en `critique` — et le tableau de
  // bord masque les montants ARE tant que la contradiction dure (cf. App.tsx).
  //
  // Textes lus dans content/contradictionHorsA10.ts, partagés avec le bandeau dédié : le même fait
  // n'est plus rédigé deux fois. L'alerte reste produite ici même quand le bandeau est affiché —
  // elle alimente le compteur d'alertes critiques visible sur TOUS les onglets, y compris ceux sans
  // bandeau (Contrats, Import PDF, Frais pro). C'est l'affichage du centre d'alertes qui évite la
  // redite, pas la détection (cf. lib/alertesAffichage.ts).
  if (perimetre.motif === "salaires_hors_a10_contradictoires") {
    alertes.push({
      code: "salaires_hors_a10_contradictoires",
      niveau: "critique",
      titre: CONTRADICTION_HORS_A10.titre,
      message: CONTRADICTION_HORS_A10.messageAlerte,
      actionSuggeree: CONTRADICTION_HORS_A10.action,
    });
  }

  // calculerFenetreEnCours (pas calculerFenetreReference seule, cf. App.tsx même correctif du
  // 31/07/2026) : la borne de réadmission du cycle en cours se dérive toujours de dateAnniversaire.
  const fenetre = calculerFenetreEnCours(profil, contrats, periodes, config, dateDuJour);
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

  // Renouvellement anticipé (SPEC.md §11.B, règle sourcée et validée le 31/07/2026, cf.
  // docs/validation.md) : signale la POSSIBILITÉ d'un réexamen anticipé, jamais un feu vert sur son
  // issue (parfois à la baisse, cf. engine/renouvellementAnticipe.ts) — juste une invite à simuler.
  // `heuresActuelles >= seuilHeures` délibérément, PAS `prediction.niveau === "securite"` seul : ce
  // dernier peut aussi valoir "securite" via `heuresAvecCertain` (contrats déjà signés à venir, pas
  // encore travaillés) — annoncer un seuil "atteint" sur cette seule base serait prématuré et faux
  // (devoir n°2). `joursRestants > 0` couvre "avant sa date anniversaire" (et exclut de fait le cas
  // où la date anniversaire est inconnue, la fenêtre se refermant alors sur "aujourd'hui").
  if (prediction.heuresActuelles >= prediction.seuilHeures && prediction.joursRestants > 0) {
    alertes.push({
      code: "renouvellement_anticipe_possible",
      niveau: "info",
      titre: "Réexamen anticipé possible",
      message: `Tu as atteint ${Math.ceil(prediction.heuresActuelles)} h sur ta période en cours, avant ta date anniversaire (${prediction.dateAnniversaire}) — tu peux demander à France Travail un réexamen anticipé de tes droits, parfois à la baisse.`,
      actionSuggeree: "Simule d'abord dans « Mon profil » → « Renouvellement anticipé », puis contacte France Travail pour la démarche réelle.",
    });
  }

  // Taux PAS multi-années (Q2, cf. commentaire "Mois de transition" dans indemnisationMensuelle.ts) :
  // depuis le 01/08/2026, `tauxPrelevementSourceHistorique` peut porter plusieurs taux datés et le
  // moteur choisit déjà le bon par mois (getTauxPASAt) — cette alerte n'existe plus pour compenser
  // une limite structurelle, mais pour rappeler à l'utilisateur de VÉRIFIER si la DGFIP a revalorisé
  // son taux et, si oui, d'AJOUTER une nouvelle entrée datée (sans quoi le dernier taux connu
  // continue de s'appliquer, à tort). Ne se déclenche que si un vrai janvier "en cours
  // d'indemnisation" (pas le mois d'ouverture lui-même, qui n'a jamais connu qu'un seul taux)
  // apparaît dans la série affichée — une seule fois par série, jamais une ligne par janvier trouvé.
  if (profil.ouvertureDroits && (profil.ouvertureDroits.tauxPrelevementSourceHistorique?.length ?? 0) > 0 && soldeDepart) {
    const serie = calculerSerieDepuisContrats(profil, soldeDepart, contrats, dateDuJour, config);
    const moisOuverture = moisCle(profil.ouvertureDroits.dateOuverture);
    const janvierEnCours = serie.calculable && serie.mois.some((m) => m.calculable && m.moisLabel.endsWith("-01") && m.moisLabel !== moisOuverture);
    if (janvierEnCours) {
      alertes.push({
        code: "pas_taux_janvier",
        niveau: "attention",
        titre: "Taux PAS à vérifier",
        message:
          "Ton taux de prélèvement à la source a peut-être été mis à jour au 1ᵉʳ janvier par la DGFIP. Vérifie sur impots.gouv.fr ou ton dernier relevé France Travail, et ajoute une nouvelle ligne datée dans le profil si le taux a changé.",
      });
    }
  }

  return alertes;
}
