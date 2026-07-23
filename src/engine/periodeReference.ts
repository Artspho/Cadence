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

  // Réadmission : on étend par tranches de 30 j tant que le seuil ajusté n'est pas atteint. `trouve`
  // est mis à true UNIQUEMENT au moment du `break` de succès ; `borneAtteinte` UNIQUEMENT au moment
  // du `break` par la borne réelle. Si aucun des deux n'est mis à true, la sortie ne peut venir que
  // de l'épuisement de TRANCHES_MAX (cf. periodeReference.test.ts, "dette tracée" dans
  // validation.md : ne jamais déduire une issue du compteur de tranches par relecture implicite,
  // toujours un booléen explicite posé au point de sortie).
  let tranches = 0;
  let dateDebutCourante = dateDebutAllonge;
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
