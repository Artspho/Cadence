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
import { trouverContratsCorrespondants } from "./correspondanceContrat";

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
  /**
   * Contrats "a_verifier" existants qui pourraient être LE MÊME contrat que celui-ci (même
   * employeur, période proche/qui se recoupe, cf. lib/correspondanceContrat.ts) — uniquement pour
   * `cible: "contrat"`, toujours vide sinon. Présence de candidats = RevueExtraction.tsx doit
   * proposer une correspondance plutôt qu'une création directe (jamais choisie automatiquement).
   */
  correspondances?: Contrat[];
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

export function evaluerProposition(proposition: Proposition, profil: Profil, contratsExistants: Contrat[] = []): PropositionEvaluee {
  const titre = TITRES[proposition.cible];

  switch (proposition.cible) {
    case "contrat": {
      // Un contrat passe TOUJOURS par le formulaire : c'est la relecture humaine qui fait foi.
      // On signale les champs non lus, sinon la valeur par défaut du formulaire (« Artiste »,
      // « Cachets », « France ») se lirait comme une information venue du document.
      const avertissements = DEFAUTS_FORMULAIRE_CONTRAT.filter((d) => proposition.donnees[d.champ] === null).map(
        (d) => `Le document n'indique pas ${d.libelle} : le formulaire propose « ${d.defaut} » par défaut. Vérifie ce champ avant d'enregistrer.`
      );
      const correspondances = trouverContratsCorrespondants(
        { employeur: proposition.donnees.employeur, date: proposition.donnees.date, dateDebut: proposition.donnees.dateDebut ?? proposition.donnees.date, salaireBrut: proposition.donnees.salaireBrut },
        contratsExistants
      );
      return { proposition, titre, statut: "revue_formulaire", avertissements, correspondances };
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

type PropositionContrat = Extract<Proposition, { cible: "contrat" }>;

/**
 * Bug réel observé en production (01/08/2026, spécimen AEM) : le modèle peut décrire UN SEUL
 * contrat physique (heures ET cachets coexistant sur le même document, cf. CAS 7 du prompt) par
 * DEUX propositions "contrat" séparées au lieu d'une seule — chacune portant le MÊME `salaireBrut`.
 * L'avertissement général généré disait déjà « même contrat », mais rien n'empêchait techniquement
 * l'utilisateur de valider les deux cartes de revue, ce qui aurait compté 245 € deux fois dans le
 * SR/NHT (devoir n°2). Une consigne de prompt plus explicite avait déjà été ajoutée avant ce test
 * (« sur la MÊME proposition ») et n'a pas suffi à elle seule — ce garde-fou de routage ne dépend
 * donc plus de l'obéissance du modèle à cette consigne.
 *
 * Détection volontairement STRICTE (conservatrice) : ne fusionne que deux propositions "contrat"
 * partageant EXACTEMENT le même employeur, la même période (dateDebut + date) et le même
 * salaireBrut, avec des `typeRemuneration` complémentaires (une "heures", une "cachet") portant
 * chacune sa propre valeur (nbHeures / nbCachets) non nulle. Un critère plus large risquerait de
 * fusionner deux contrats réellement distincts qui partageraient par coïncidence employeur et
 * montant — pas acceptable non plus (perte d'information, devoir n°1).
 *
 * ✅ Mise à jour du 01/08/2026, confirmée par Benoît (règle réelle du régime) : un contrat peut
 * porter seulement des cachets, seulement des heures, OU LES DEUX à la fois — quand les deux sont
 * présents, les deux comptent, ce n'est jamais un choix exclusif. `engine/decompteHeures.ts` a été
 * corrigé en conséquence (`heuresCombinees = nbHeures + nbCachets × heuresParCachet`) : cette
 * fusion élimine la duplication du SALAIRE ET les deux champs comptent désormais réellement dans
 * le décompte des 507 h une fois la proposition fusionnée. `Contrat.typeRemuneration` reste un
 * champ unique mais n'exclut plus l'autre valeur du calcul — il ne sert plus qu'à l'attribution
 * d'affichage (répartition cachets/heures de scène) et n'a plus d'incidence sur le total.
 */
export function fusionnerContratsDupliques(propositions: Proposition[]): Proposition[] {
  const consommes = new Set<number>();
  const resultat: Proposition[] = [];

  for (let i = 0; i < propositions.length; i++) {
    if (consommes.has(i)) continue;
    const p = propositions[i];
    if (p.cible !== "contrat") {
      resultat.push(p);
      continue;
    }

    let indexDoublon = -1;
    for (let j = i + 1; j < propositions.length; j++) {
      if (consommes.has(j)) continue;
      const q = propositions[j];
      if (q.cible === "contrat" && sontUnContratDuplique(p, q)) {
        indexDoublon = j;
        break;
      }
    }

    if (indexDoublon === -1) {
      resultat.push(p);
      continue;
    }
    consommes.add(indexDoublon);
    resultat.push(fusionnerContrats(p, propositions[indexDoublon] as PropositionContrat));
  }

  return resultat;
}

function sontUnContratDuplique(a: PropositionContrat, b: PropositionContrat): boolean {
  const memeContrat =
    a.donnees.employeur === b.donnees.employeur && a.donnees.dateDebut === b.donnees.dateDebut && a.donnees.date === b.donnees.date && a.donnees.salaireBrut === b.donnees.salaireBrut;
  if (!memeContrat) return false;

  const typesRemuneration = new Set([a.donnees.typeRemuneration, b.donnees.typeRemuneration]);
  const complementaires = typesRemuneration.has("heures") && typesRemuneration.has("cachet");
  if (!complementaires) return false;

  const proprietaireHeures = a.donnees.typeRemuneration === "heures" ? a : b;
  const proprietaireCachets = a.donnees.typeRemuneration === "cachet" ? a : b;
  return proprietaireHeures.donnees.nbHeures != null && proprietaireCachets.donnees.nbCachets != null;
}

function fusionnerContrats(a: PropositionContrat, b: PropositionContrat): PropositionContrat {
  const proprietaireHeures = a.donnees.typeRemuneration === "heures" ? a : b;
  const proprietaireCachets = a.donnees.typeRemuneration === "cachet" ? a : b;

  return {
    cible: "contrat",
    donnees: {
      ...a.donnees,
      nbHeures: proprietaireHeures.donnees.nbHeures,
      nbCachets: proprietaireCachets.donnees.nbCachets,
      // Un seul salaireBrut compte pour ce contrat (identique sur les deux propositions d'origine,
      // cf. sontUnContratDuplique) — jamais la somme des deux.
      salaireBrut: a.donnees.salaireBrut,
    },
    confiance: { ...b.confiance, ...a.confiance },
    justification:
      `${a.justification} — Fusionné avec une seconde proposition détectée comme le même contrat ` +
      `(heures et cachets coexistent sur ce document pour un seul salaire, jamais deux) : ${b.justification} ` +
      `Les deux champs (nombre d'heures et nombre de cachets) comptent ensemble dans le décompte des ` +
      `507 h — vérifie simplement que les deux valeurs correspondent bien au document avant d'enregistrer.`,
  };
}

export function evaluerExtraction(resultat: ExtractionResult, profil: Profil, contratsExistants: Contrat[] = []): PropositionEvaluee[] {
  return fusionnerContratsDupliques(resultat.propositions).map((p) => evaluerProposition(p, profil, contratsExistants));
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
 * Champs (parmi ceux du contrat) qui DIFFÉRERAIENT entre un contrat existant et les valeurs lues
 * dans un document — pour l'écran « Ancien → Nouveau » avant confirmation d'une correspondance
 * (cf. plan « cycle de vie du contrat », §3 : l'AEM fait foi, mais jamais silencieusement). Un champ
 * non lu par le document (`null`) n'est jamais compté comme une divergence : la valeur existante
 * n'est jamais présentée comme "sur le point de changer" pour un champ que le document ne dit pas.
 */
const CHAMPS_COMPARABLES: (keyof Contrat)[] = [
  "date",
  "dateDebut",
  "type",
  "typeRemuneration",
  "territoire",
  "nbCachets",
  "nbHeures",
  "nbJoursEEE",
  "salaireBrut",
  "employeur",
  "etablissementAgree",
  "enRapportAvecMetier",
];

export interface ChampDivergent {
  champ: keyof Contrat;
  ancien: unknown;
  nouveau: unknown;
}

/** Divergences entre un contrat existant et ce qu'un document propose — jamais les champs non lus. */
export function champsDivergents(existant: Contrat, proposition: Extract<Proposition, { cible: "contrat" }>["donnees"]): ChampDivergent[] {
  const nouveau = contratDepuisProposition(proposition);
  return CHAMPS_COMPARABLES.filter((champ) => nouveau[champ] !== undefined && nouveau[champ] !== existant[champ]).map((champ) => ({
    champ,
    ancien: existant[champ],
    nouveau: nouveau[champ],
  }));
}

/**
 * Contrat existant mis à jour avec les valeurs du document, champ par champ — JAMAIS un spread
 * aveugle de `contratDepuisProposition` (qui porte `undefined` sur chaque champ non lu : un spread
 * l'écraserait sur la valeur déjà saisie, violant le devoir n°1). Même principe que
 * `profilAvecProposition` : un champ non lu conserve la valeur déjà présente sur le contrat.
 * `recurrenceId` est préservé tel quel — confirmé sans risque : `ContractList.tsx` regroupe les
 * contrats d'une série uniquement par `recurrenceId`, jamais par `statutVerification` ni par les
 * autres champs métier, donc les mettre à jour ne modifie ni le regroupement ni la suppression de
 * la série (`supprimerSerie`, qui filtre uniquement sur `recurrenceId`).
 */
export function contratConfirmeDepuisCorrespondance(existant: Contrat, proposition: Extract<Proposition, { cible: "contrat" }>["donnees"]): Omit<Contrat, "id"> {
  const nouveau = contratDepuisProposition(proposition);
  return {
    date: nouveau.date ?? existant.date,
    dateDebut: nouveau.dateDebut ?? existant.dateDebut,
    type: nouveau.type ?? existant.type,
    typeRemuneration: nouveau.typeRemuneration ?? existant.typeRemuneration,
    territoire: nouveau.territoire ?? existant.territoire,
    nbCachets: nouveau.nbCachets ?? existant.nbCachets,
    nbHeures: nouveau.nbHeures ?? existant.nbHeures,
    nbJoursEEE: nouveau.nbJoursEEE ?? existant.nbJoursEEE,
    salaireBrut: nouveau.salaireBrut ?? existant.salaireBrut,
    employeur: nouveau.employeur ?? existant.employeur,
    etablissementAgree: nouveau.etablissementAgree ?? existant.etablissementAgree,
    enRapportAvecMetier: nouveau.enRapportAvecMetier ?? existant.enRapportAvecMetier,
    source: "import_pdf",
    recurrenceId: existant.recurrenceId,
    statutVerification: "confirme",
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
