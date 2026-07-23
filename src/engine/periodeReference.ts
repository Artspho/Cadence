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

  // Réadmission : on étend par tranches de 30 j tant que le seuil ajusté
  // n'est pas atteint, borné par TRANCHES_MAX. `trouve` est mis à true UNIQUEMENT au moment du
  // `break` : si la boucle sort par épuisement du compteur, `trouve` reste false — la dernière
  // fenêtre testée n'a jamais été validée contre son propre seuil (cf. periodeReference.test.ts,
  // "dette tracée" dans validation.md). Ne jamais déduire "trouvé" de `tranches === TRANCHES_MAX`
  // par relecture implicite : ce booléen explicite est la seule source de vérité.
  let tranches = 0;
  let dateDebutCourante = dateDebutAllonge;
  let seuilCourant = config.seuilHeures;
  let trouve = false;

  while (tranches < TRANCHES_MAX) {
    const { total } = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut: dateDebutCourante, dateFin });
    if (total >= seuilCourant) {
      trouve = true;
      break;
    }
    tranches += 1;
    seuilCourant = config.seuilHeures + tranches * config.readmission.affiliationMajoreeParPeriode;
    dateDebutCourante = ajouterJours(dateDebutCourante, -config.readmission.tranchePeriodeJours);
  }

  if (!trouve) {
    // Épuisé sans solution : pas de seuil gonflé affiché comme réel (devoir sacré n°2). On
    // retombe sur la fenêtre de base non étendue — étendre plus loin n'a rien trouvé de plus,
    // donc rien ne justifie de garder une fenêtre poussée à 24 tranches sans validation.
    return { dateDebut: dateDebutAllonge, dateFin, joursAllongementMaladie, seuilReadmission: { calculable: false, raison: "historique_insuffisant", tranchesTentees: TRANCHES_MAX } };
  }

  return {
    dateDebut: dateDebutCourante,
    dateFin,
    joursAllongementMaladie,
    seuilReadmission: { calculable: true, tranchesReadmission: tranches, seuilHeuresAjuste: seuilCourant },
  };
}
