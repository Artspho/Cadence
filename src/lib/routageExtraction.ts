/**
 * Routage des propositions d'extraction IA vers le modèle de données de l'app.
 *
 * Logique PURE et testable, volontairement séparée de RevueExtraction.tsx : c'est ici que se
 * joue le devoir sacré n°2. Une proposition d'IA n'est jamais écrite telle quelle — chacune est
 * d'abord évaluée pour savoir si l'app a une case d'arrivée SÛRE pour elle. Quand la réponse est
 * non, on refuse d'appliquer et on l'explique, plutôt que d'écrire une valeur approchée.
 *
 * Les deux refus structurels (ne pas les « corriger » sans revalidation explicite) :
 *
 * 1. `aj_reelle_historique` avec natureMontant ≠ "net". `Profil.ajReelleHistorique` contient une
 *    AJ NETTE : c'est ce que dit l'UI de saisie (MonProfil.tsx, « Allocation journalière nette »)
 *    et ce que suppose le moteur, qui applique ENSUITE le prélèvement à la source dessus
 *    (engine/indemnisationMensuelle.ts : montantNet = montant × (1 − taux/100)). Y écrire une
 *    allocation BRUTE — ce que dit typiquement un relevé de situation — gonflerait tous les
 *    montants mensuels affichés. Aucune conversion n'est possible ici : calculerAJNette est à
 *    sens unique, exige un SJM absent du document, et est elle-même documentée comme une
 *    estimation (or ajReelleHistorique interdit tout repli estimé).
 *
 * 2. `profil_ouverture_droits` incomplet. `Profil.ouvertureDroits` exige franchiseCPTotale ET
 *    delaiAttenteInitial (jours). Ces deux nombres décalent les dates de versement et donc les
 *    montants ; mettre 0 « en attendant » serait un chiffre inventé. Si le document ne les donne
 *    pas, on n'écrit rien et on affiche ce qui a été lu pour saisie manuelle.
 *
 * `periode_assimilee` n'est PLUS un refus depuis le 31/07/2026 (CRUD construit le 29/07/2026,
 * commit `d664344` — `PeriodeForm`/`PeriodeList`/`ajouterPeriode` dans `App.tsx` ; le routage
 * lui-même câblé le 31/07/2026, cf. `periodeDepuisProposition` ci-dessous). Traité en
 * `revue_formulaire`, comme `contrat` : jamais appliqué directement, toujours relu dans
 * `PeriodeForm` avant enregistrement — `ald` et `maladie_intercontrat` ayant des effets opposés sur
 * le décompte (cf. `types/extraction.ts`), la confirmation humaine du type reste requise même
 * quand l'IA en propose un avec confiance haute.
 */

import type { Contrat, PeriodeAssimilee, Profil } from "../types";
import type { ExtractionResult, Proposition } from "../types/extraction";

export type StatutProposition =
  /** Va dans le formulaire de contrat, pré-rempli, pour relecture champ par champ. Jamais direct. */
  | "revue_formulaire"
  /** Peut être appliqué au profil en un clic (modifierProfil revalide derrière, cf. App.tsx). */
  | "applicable"
  /** Information utile à vérifier/recopier : c'est sa nature, pas un problème. */
  | "information"
  /** L'app n'a pas de case d'arrivée sûre : on n'écrit rien et on dit pourquoi. */
  | "non_applicable";

export interface PropositionEvaluee {
  proposition: Proposition;
  /** Libellé lisible de la destination, pour l'en-tête de la carte. */
  titre: string;
  statut: StatutProposition;
  /** Renseigné si statut === "non_applicable" ou "information" : la raison, en français simple. */
  motif?: string;
  /**
   * Avertissements propres à cette proposition — typiquement les champs que le document
   * n'indiquait pas et que le formulaire va remplir avec une valeur par défaut. Les signaler
   * évite qu'une valeur par défaut soit lue comme une valeur extraite.
   */
  avertissements: string[];
}

const TITRES: Record<Proposition["cible"], string> = {
  contrat: "Contrat (bulletin de paie / AEM)",
  profil_ouverture_droits: "Ouverture de droits (notification France Travail)",
  profil_infos: "Informations de profil",
  periode_assimilee: "Période assimilée",
  aj_reelle_historique: "Allocation journalière réelle",
  info_seule: "Information à vérifier",
};

/** Libellés des champs de contrat que le document laisse souvent muets, et défaut du formulaire. */
const DEFAUTS_FORMULAIRE_CONTRAT: { champ: "type" | "typeRemuneration" | "territoire"; libelle: string; defaut: string }[] = [
  { champ: "type", libelle: "la nature du contrat (artiste, enseignement…)", defaut: "Artiste" },
  { champ: "typeRemuneration", libelle: "le mode de rémunération (cachets ou heures)", defaut: "Cachets" },
  { champ: "territoire", libelle: "le territoire", defaut: "France" },
];

export function evaluerProposition(proposition: Proposition, profil: Profil): PropositionEvaluee {
  const titre = TITRES[proposition.cible];

  switch (proposition.cible) {
    case "contrat": {
      // Un contrat passe TOUJOURS par le formulaire : c'est la relecture humaine qui fait foi.
      // On signale les champs non lus, sinon la valeur par défaut du formulaire (« Artiste »,
      // « Cachets », « France ») se lirait comme une information venue du document.
      const avertissements = DEFAUTS_FORMULAIRE_CONTRAT.filter((d) => proposition.donnees[d.champ] === null).map(
        (d) => `Le document n'indique pas ${d.libelle} : le formulaire propose « ${d.defaut} » par défaut. Vérifie ce champ avant d'enregistrer.`
      );
      return { proposition, titre, statut: "revue_formulaire", avertissements };
    }

    case "profil_ouverture_droits": {
      const { dateOuverture, franchiseCPTotale, delaiAttenteInitial, tauxPrelevementSource, dateLimiteIndemnisation } = proposition.donnees;
      const baseDejaConnue = profil.ouvertureDroits !== undefined;
      const champUtileSeul = tauxPrelevementSource !== null || dateLimiteIndemnisation !== null;
      if (baseDejaConnue && champUtileSeul) {
        return { proposition, titre, statut: "applicable", avertissements: [] };
      }
      const manquants: string[] = [];
      if (!dateOuverture) manquants.push("la date d'ouverture des droits");
      if (franchiseCPTotale === null) manquants.push("la franchise congés payés (en jours)");
      if (delaiAttenteInitial === null) manquants.push("le délai d'attente (en jours)");

      if (manquants.length > 0) {
        return {
          proposition,
          titre,
          statut: "non_applicable",
          motif:
            `Il manque ${manquants.join(", ")}. Ces valeurs décalent tes dates de versement, donc tes montants : ` +
            `mettre 0 par défaut afficherait des chiffres faux. Rien n'est enregistré — reporte ce qui est lisible ci-dessous ` +
            `dans « Mon profil » après vérification sur ta notification.`,
          avertissements: [],
        };
      }
      return { proposition, titre, statut: "applicable", avertissements: [] };
    }

    case "profil_infos": {
      const renseignes = Object.values(proposition.donnees).filter((v) => v !== null);
      if (renseignes.length === 0) {
        return {
          proposition,
          titre,
          statut: "non_applicable",
          motif: "Aucun champ n'a pu être lu dans le document. Rien à appliquer.",
          avertissements: [],
        };
      }
      return { proposition, titre, statut: "applicable", avertissements: [] };
    }

    case "aj_reelle_historique": {
      const { natureMontant } = proposition.donnees;
      if (natureMontant !== "net") {
        const constat =
          natureMontant === "brut"
            ? "Le document donne une allocation BRUTE."
            : "Le document ne dit pas clairement si ce montant est net ou brut.";
        return {
          proposition,
          titre,
          statut: "non_applicable",
          motif:
            `${constat} Cadence a besoin de l'allocation journalière NETTE (celle du libellé ` +
            `« Allocation journalière nette » de ta notification d'ouverture de droits) : c'est sur elle que le calcul ` +
            `applique ensuite ton prélèvement à la source. Enregistrer un montant brut à sa place gonflerait tous tes ` +
            `montants mensuels. Aucune conversion fiable n'est possible — rien n'est enregistré.`,
          avertissements: [],
        };
      }
      return { proposition, titre, statut: "applicable", avertissements: [] };
    }

    case "periode_assimilee":
      // Type, dateDebut, dateFin sont tous les trois non-nullables dans le schéma d'extraction
      // (cf. types/extraction.ts) : quand l'IA n'est pas sûre du type (ex. simple avis d'arrêt
      // maladie non qualifié), elle doit produire "info_seule" plutôt qu'une proposition ici —
      // donc rien à avertir sur un champ "non lu, valeur par défaut du formulaire" (contrairement à
      // `contrat`, où type/typeRemuneration/territoire sont nullables). La confirmation humaine du
      // type reste néanmoins requise (revue_formulaire, jamais "applicable") : la confiance
      // par-champ affichée par RevueExtraction.tsx reste le signal si l'IA elle-même doute.
      return { proposition, titre, statut: "revue_formulaire", avertissements: [] };

    case "info_seule":
      return {
        proposition,
        titre,
        statut: "information",
        motif:
          "Donnée relevée dans le document, sans destination automatique dans l'app. Sert à vérifier " +
          "les calculs de Cadence contre les chiffres officiels — à comparer toi-même.",
        avertissements: [],
      };
  }
}

export function evaluerExtraction(resultat: ExtractionResult, profil: Profil): PropositionEvaluee[] {
  return resultat.propositions.map((p) => evaluerProposition(p, profil));
}

/**
 * Convertit une proposition de contrat en valeurs initiales pour ContractForm.
 * `null` (non lu) devient `undefined` : le formulaire appliquera son défaut, signalé à l'utilisateur
 * par les avertissements de `evaluerProposition`. Aucune valeur n'est inventée ici.
 */
export function contratDepuisProposition(donnees: Extract<Proposition, { cible: "contrat" }>["donnees"]): Partial<Contrat> {
  return {
    date: donnees.date,
    dateDebut: donnees.dateDebut ?? undefined,
    type: donnees.type ?? undefined,
    typeRemuneration: donnees.typeRemuneration ?? undefined,
    territoire: donnees.territoire ?? undefined,
    nbCachets: donnees.nbCachets ?? undefined,
    nbHeures: donnees.nbHeures ?? undefined,
    nbJoursEEE: donnees.nbJoursEEE ?? undefined,
    salaireBrut: donnees.salaireBrut,
    employeur: donnees.employeur,
    etablissementAgree: donnees.etablissementAgree ?? undefined,
    enRapportAvecMetier: donnees.enRapportAvecMetier ?? undefined,
    source: "import_pdf",
  };
}

/**
 * Convertit une proposition de période assimilée en valeurs initiales pour PeriodeForm. Les trois
 * champs sont non-nullables dans le schéma d'extraction (cf. types/extraction.ts) : rien à replier
 * sur `undefined` ici, contrairement à `contratDepuisProposition` — mais le type reste à confirmer
 * par l'utilisateur dans le formulaire avant tout enregistrement (statut "revue_formulaire",
 * jamais "applicable"), ald/maladie_intercontrat ayant des effets opposés sur le décompte.
 */
export function periodeDepuisProposition(donnees: Extract<Proposition, { cible: "periode_assimilee" }>["donnees"]): Partial<PeriodeAssimilee> {
  return { type: donnees.type, dateDebut: donnees.dateDebut, dateFin: donnees.dateFin };
}

/**
 * Construit le profil CANDIDAT résultant de l'application d'une proposition.
 * Ne persiste rien : l'appelant passe le candidat à `modifierProfil`, qui le valide (forme Zod +
 * cohérence) et ne l'écrit que s'il est valide. Un champ non lu (`null`) laisse la valeur
 * existante intacte — appliquer une proposition n'efface jamais une donnée déjà saisie
 * (devoir sacré n°1).
 *
 * Lève si la proposition n'est pas applicable : ce cas est déjà filtré par `evaluerProposition`,
 * l'exception n'est qu'un garde-fou contre un futur appel qui contournerait l'évaluation.
 */
export function profilAvecProposition(profil: Profil, proposition: Proposition): Profil {
  switch (proposition.cible) {
    case "profil_ouverture_droits": {
      const d = proposition.donnees;
      const dateOuverture = d.dateOuverture || profil.ouvertureDroits?.dateOuverture;
      const franchiseCPTotale = d.franchiseCPTotale ?? profil.ouvertureDroits?.franchiseCPTotale;
      const delaiAttenteInitial = d.delaiAttenteInitial ?? profil.ouvertureDroits?.delaiAttenteInitial;
      if (!dateOuverture || franchiseCPTotale == null || delaiAttenteInitial == null) {
        throw new Error("Proposition d'ouverture de droits incomplète : non applicable (cf. evaluerProposition).");
      }
      return {
        ...profil,
        ouvertureDroits: {
          dateOuverture,
          franchiseCPTotale,
          delaiAttenteInitial,
          // Champs optionnels : on ne remplace une valeur déjà saisie que si le document en donne une.
          tauxPrelevementSource: d.tauxPrelevementSource ?? profil.ouvertureDroits?.tauxPrelevementSource,
          dateLimiteIndemnisation: d.dateLimiteIndemnisation ?? profil.ouvertureDroits?.dateLimiteIndemnisation,
        },
      };
    }

    case "profil_infos": {
      const d = proposition.donnees;
      return {
        ...profil,
        dateNaissance: d.dateNaissance ?? profil.dateNaissance,
        dateAnniversaire: d.dateAnniversaire ?? profil.dateAnniversaire,
        dateAnniversairePrecedente: d.dateAnniversairePrecedente ?? profil.dateAnniversairePrecedente,
        situation: d.situation ?? profil.situation,
        dureeDroitsMois: d.dureeDroitsMois ?? profil.dureeDroitsMois,
      };
    }

    case "aj_reelle_historique": {
      const d = proposition.donnees;
      if (d.natureMontant !== "net") {
        throw new Error("Montant d'AJ non net : non applicable (cf. evaluerProposition).");
      }
      const historique = profil.ajReelleHistorique ?? [];
      // Même règle que la saisie manuelle (MonProfil.tsx) : tri croissant par date d'effet, le
      // moteur lisant le taux applicable à un mois donné via getAjReelleAt.
      const fusionne = [...historique.filter((e) => e.dateEffet !== d.dateEffet), { dateEffet: d.dateEffet, valeur: d.valeur }].sort((a, b) =>
        a.dateEffet.localeCompare(b.dateEffet)
      );
      return { ...profil, ajReelleHistorique: fusionne };
    }

    default:
      throw new Error(`La cible « ${proposition.cible} » ne s'applique pas au profil.`);
  }
}
