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
import { ageAuJour, dansIntervalle, joursChevauchement, moisCle } from "./dateUtils";

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

/** Heures apportées par les périodes assimilées (maternité, adoption, AT, ALD, suspension) qui chevauchent la fenêtre. Les maladies inter-contrat n'apportent aucune heure ici : elles n'agissent que sur la fenêtre (cf. periodeReference.ts). */
function heuresAssimileesFenetre(periodes: PeriodeAssimilee[], fenetre: Fenetre, config: FranceTravailConfig): number {
  return periodes
    .filter((p) => p.type !== "maladie_intercontrat")
    .reduce((total, p) => total + joursChevauchement(p.dateDebut, p.dateFin, fenetre.dateDebut, fenetre.dateFin) * config.heuresAssimileesParJour, 0);
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

  repartition.assimilees = heuresAssimileesFenetre(periodes, fenetre, config);

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
