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
import { RAPPEL_AEM_FAIT_FOI } from "../content/rappelAEM";
import { diagnostiquerAbsenceCorrespondance, trouverContratsCorrespondants, type DiagnosticAbsenceCorrespondance } from "./correspondanceContrat";

export type StatutProposition =
  /** Va dans le formulaire de contrat, pré-rempli, pour relecture champ par champ. Jamais direct. */
  | "revue_formulaire"
  /** Peut être appliqué au profil en un clic (modifierProfil revalide derrière, cf. App.tsx). */
  | "applicable"
  /**
   * 07/08/2026 — bug réel : réimporter une notification différente écrasait silencieusement
   * `dateOuverture`/`dateLimiteIndemnisation`/`dateAnniversaire`/… déjà saisis, décalant la fenêtre
   * qui borne le moteur (cf. `champsEcrases` sur `PropositionEvaluee`, et le commentaire de
   * `statutSelonEcrasement` ci-dessous). Comme `applicable`, mais seulement après que
   * `RevueExtraction.tsx` a montré ancien → nouveau et que l'utilisateur a cliqué quand même —
   * jamais en un clic aveugle.
   */
  | "confirmation_ecrasement"
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
  /**
   * Renseigné UNIQUEMENT quand `correspondances` est vide (cf. lib/correspondanceContrat.ts,
   * diagnostiquerAbsenceCorrespondance) — une piste sur POURQUOI rien n'a été proposé, jamais une
   * seconde correspondance. Purement informatif : RevueExtraction.tsx l'affiche, ne décide rien.
   */
  diagnosticAbsence?: DiagnosticAbsenceCorrespondance;
  /**
   * Renseigné UNIQUEMENT quand `statut === "confirmation_ecrasement"` — les champs que cette
   * proposition remplacerait par une valeur DIFFÉRENTE de celle déjà connue (`cible:
   * "profil_ouverture_droits"` ou `"profil_infos"`). Toujours la liste complète des champs
   * comparables, jamais seulement ceux qui diffèrent (même principe que `comparerContratExistant` :
   * un champ identique masqué serait indiscernable d'un champ jamais comparé).
   */
  champsEcrases?: ChampComparaison[];
}

/**
 * Compare chaque champ RENSEIGNÉ par le document à la valeur déjà connue — même principe que
 * `comparerContratExistant` plus bas, généralisé à `profil_ouverture_droits`/`profil_infos`
 * (07/08/2026). Un champ non lu par le document (`null`) ou jamais renseigné dans le profil
 * (`undefined`) n'est jamais comparé : remplir un blanc n'est pas écraser une valeur, ces deux cas
 * doivent rester "applicable" en un clic.
 */
function comparerChampsProfil(existant: Record<string, unknown>, nouveau: Record<string, unknown>): ChampComparaison[] {
  // `""` compte comme « non lu », au même titre que `null`/`undefined` — les champs texte de ces
  // deux cibles utilisent `||` (falsy) pour le repli sur l'existant, pas `??` (cf.
  // profilAvecProposition) : une chaîne vide n'est jamais une VALEUR à comparer, seuls les champs
  // numériques (`franchiseCPTotale`/`delaiAttenteInitial`) autorisent `0` comme valeur réelle.
  return Object.keys(nouveau)
    .filter((champ) => nouveau[champ] !== null && nouveau[champ] !== undefined && nouveau[champ] !== "" && existant[champ] !== undefined)
    .map((champ) => ({ champ, existant: existant[champ], document: nouveau[champ], identique: existant[champ] === nouveau[champ] }));
}

/**
 * Décide si une proposition `profil_ouverture_droits`/`profil_infos` peut s'appliquer en un clic,
 * ou doit d'abord montrer ce qu'elle écraserait.
 *
 * BUG RÉEL CORRIGÉ ICI (07/08/2026, signalé par Benoît) : `profilAvecProposition` ci-dessous écrit
 * la valeur du document dès qu'elle est présente, quelle que soit la valeur déjà enregistrée —
 * alors que son propre commentaire affirme le contraire (« n'efface jamais une donnée déjà
 * saisie »). `evaluerProposition` marquait ces deux cibles « applicable » (un clic, sans montrer
 * l'ancienne valeur) dès que le profil avait déjà une base. Cas réel : réimporter une notification
 * d'admission PASSÉE a réécrit `dateOuverture` ET (via `profil_infos`, même document)
 * `dateAnniversaire`/`dateAnniversairePrecedente` avec des valeurs périmées — la fenêtre qui borne
 * `calculerSerieDepuisContrats` et celle de `calculerFenetreReference` (periodeReference.ts) se
 * sont décalées d'un coup, produisant une période de référence de plus de 12 mois et des montants
 * mensuels incohérents. Ce correctif ne touche PAS `profilAvecProposition` (l'écriture reste la
 * même une fois confirmée) : il intercale une étape de confirmation AVANT, exactement comme
 * `comparerContratExistant`/`TableauComparaisonContrat` le font déjà pour les contrats.
 */
function statutSelonEcrasement(proposition: Proposition, titre: string, existant: Record<string, unknown> | undefined, nouveau: Record<string, unknown>): PropositionEvaluee {
  if (!existant) return { proposition, titre, statut: "applicable", avertissements: [] };
  const champsEcrases = comparerChampsProfil(existant, nouveau);
  if (champsEcrases.some((c) => !c.identique)) {
    return { proposition, titre, statut: "confirmation_ecrasement", avertissements: [], champsEcrases };
  }
  return { proposition, titre, statut: "applicable", avertissements: [] };
}

const TITRES: Record<Proposition["cible"], string> = {
  contrat: "Contrat (bulletin de paie / AEM)",
  profil_ouverture_droits: "Ouverture de droits (notification France Travail)",
  profil_infos: "Informations de profil",
  periode_assimilee: "Période assimilée",
  aj_reelle_historique: "Allocation journalière réelle",
  taux_pas_historique: "Taux de prélèvement à la source",
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
      // AEM vs bulletin de paie (cf. types/extraction.ts, natureDocumentSource) : avertissement
      // CONDITIONNEL, uniquement quand le document se déclare lui-même « bulletin de paie » —
      // jamais sur une vraie AEM (rien à signaler), jamais sur un document non déterminé (silence
      // honnête plutôt qu'un faux avertissement, cf. commentaire du schéma). Même fait que le canal
      // manuel (ImportBulletins.tsx), texte de référence unique (content/rappelAEM.ts).
      if (proposition.donnees.natureDocumentSource === "bulletin_paie") {
        avertissements.push(`Ce document semble être un bulletin de paie, pas l'AEM. ${RAPPEL_AEM_FAIT_FOI} Vérifie que ton employeur te l'a bien transmise séparément.`);
      }
      const candidat = { employeur: proposition.donnees.employeur, date: proposition.donnees.date, dateDebut: proposition.donnees.dateDebut ?? proposition.donnees.date, salaireBrut: proposition.donnees.salaireBrut };
      const correspondances = trouverContratsCorrespondants(candidat, contratsExistants);
      const diagnosticAbsence = correspondances.length === 0 ? diagnostiquerAbsenceCorrespondance(candidat, contratsExistants) : undefined;
      return { proposition, titre, statut: "revue_formulaire", avertissements, correspondances, diagnosticAbsence };
    }

    case "profil_ouverture_droits": {
      const { dateOuverture, franchiseCPTotale, delaiAttenteInitial, dateLimiteIndemnisation } = proposition.donnees;
      const existant = profil.ouvertureDroits as unknown as Record<string, unknown> | undefined;
      const baseDejaConnue = existant !== undefined;
      // Le taux ne fait plus partie de cette cible depuis le 02/08/2026 (cf. types/extraction.ts,
      // Cible 2) : seule dateLimiteIndemnisation reste un champ "utile seul".
      const champUtileSeul = dateLimiteIndemnisation !== null;
      if (baseDejaConnue && champUtileSeul) {
        return statutSelonEcrasement(proposition, titre, existant, { dateOuverture, franchiseCPTotale, delaiAttenteInitial, dateLimiteIndemnisation });
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
      return statutSelonEcrasement(proposition, titre, existant, { dateOuverture, franchiseCPTotale, delaiAttenteInitial, dateLimiteIndemnisation });
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
      // Protégé seulement si une ouverture de droits est DÉJÀ connue : avant ça, dateAnniversaire
      // etc. ne sont que des valeurs d'onboarding provisoires (cf. Profil, toujours renseignées avec
      // un défaut) — un premier vrai document doit pouvoir les combler librement. Une fois
      // l'ouverture de droits confirmée une première fois, ces champs deviennent la donnée réelle
      // qu'un réimport ne doit plus écraser sans le dire (même signal que profil_ouverture_droits).
      const existant = profil.ouvertureDroits !== undefined ? (profil as unknown as Record<string, unknown>) : undefined;
      return statutSelonEcrasement(proposition, titre, existant, proposition.donnees);
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

    case "taux_pas_historique": {
      // Un taux PAS n'a de sens qu'accroché à une ouverture de droits déjà connue (c'est
      // Profil.ouvertureDroits.tauxPrelevementSourceHistorique qui le porte, cf. types/index.ts) —
      // sans base, il n'y a nulle part où l'écrire sans inventer les autres champs requis
      // (dateOuverture/franchiseCPTotale/delaiAttenteInitial), même refus de principe que
      // `profil_ouverture_droits` incomplet ci-dessus.
      if (!profil.ouvertureDroits) {
        return {
          proposition,
          titre,
          statut: "non_applicable",
          motif:
            "Ce taux ne peut être rattaché qu'à une ouverture de droits déjà connue. Renseigne d'abord la date d'ouverture de tes droits dans « Mon profil », " +
            "section « Mon indemnisation en cours », puis reviens appliquer cette proposition.",
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

export interface ChampComparaison {
  /** `keyof Contrat` pour une comparaison de contrat ; une clé de `donnees` pour un profil (07/08/2026,
   * cf. `comparerChampsProfil` plus bas) — élargi à `string` pour couvrir les deux sans dupliquer le type. */
  champ: string;
  existant: unknown;
  document: unknown;
  /** `true` si les deux valeurs sont égales — sert à l'affichage neutre (pas masqué, cf.
   * TableauComparaisonContrat.tsx) plutôt qu'à filtrer la ligne. */
  identique: boolean;
}

/**
 * Compare CHAQUE champ lu par le document à la valeur existante — identique ou non, jamais les
 * champs non lus (`null`), qui restent affichés ailleurs sur la carte (« À vérifier dans le
 * formulaire »). Remplace `champsDivergents` (01/08/2026) : une ligne « champ identique » masquée
 * silencieusement laissait croire à une comparaison complète alors qu'elle n'en montrait qu'une
 * partie — même piège que "aucune correspondance" avant `diagnostiquerAbsenceCorrespondance`.
 */
export function comparerContratExistant(existant: Contrat, proposition: Extract<Proposition, { cible: "contrat" }>["donnees"]): ChampComparaison[] {
  const nouveau = contratDepuisProposition(proposition);
  return CHAMPS_COMPARABLES.filter((champ) => nouveau[champ] !== undefined).map((champ) => ({
    champ,
    existant: existant[champ],
    document: nouveau[champ],
    identique: nouveau[champ] === existant[champ],
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
/**
 * Détecte le cas où confirmer une correspondance risquerait de recréer le bug réel du 01/08/2026
 * (deux contrats avec un `nbHeures` résidu égal à `nbCachets × 12`, comptés en double par le
 * moteur) — mais cette fois via la fusion `contratConfirmeDepuisCorrespondance`, pas via une saisie
 * manuelle (le garde-fou de `ContractForm.tsx`, case "Activité mixte", ne protège QUE ce chemin-là,
 * jamais la confirmation en un clic ci-dessous, cf. RevueExtraction.tsx).
 *
 * Retourne un diagnostic (jamais `null` silencieusement transformé en fusion) dès que TOUTES ces
 * conditions sont réunies :
 * - Le document ne fournit qu'UN SEUL des deux champs (l'autre est `null`, donc pas une activité
 *   mixte confirmée par le document lui-même).
 * - Le contrat existant a DÉJÀ une valeur sur l'AUTRE champ (celui que le document ne fournit pas).
 *
 * Dans ce cas, PAS de fusion automatique en un clic : `RevueExtraction.tsx` doit afficher un état
 * "à vérifier manuellement" plutôt que le bouton de confirmation habituel — aucune donnée n'est
 * jamais réinitialisée ni fusionnée silencieusement par cette fonction (devoir n°1). L'utilisateur
 * tranche lui-même en passant par l'édition normale du contrat (`ContractList.tsx` → « Modifier »),
 * où la case "Activité mixte" s'applique.
 */
export interface MergeAmbiguHeuresCachets {
  /** Le champ que le document NE fournit PAS, mais que le contrat existant porte déjà. */
  champManquant: "nbHeures" | "nbCachets";
  /** La valeur déjà présente sur le contrat existant pour ce champ. */
  valeurExistante: number;
}

export function detecterMergeAmbiguHeuresCachets(existant: Contrat, donnees: Extract<Proposition, { cible: "contrat" }>["donnees"]): MergeAmbiguHeuresCachets | null {
  const documentFournitHeures = donnees.nbHeures != null;
  const documentFournitCachets = donnees.nbCachets != null;

  // Les deux fournis par le document : mixte confirmé par la source elle-même, pas ambigu.
  if (documentFournitHeures && documentFournitCachets) return null;

  if (!documentFournitHeures && documentFournitCachets && existant.nbHeures != null) {
    return { champManquant: "nbHeures", valeurExistante: existant.nbHeures };
  }
  if (!documentFournitCachets && documentFournitHeures && existant.nbCachets != null) {
    return { champManquant: "nbCachets", valeurExistante: existant.nbCachets };
  }
  return null;
}

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
 * Ajoute (ou remplace, même `dateEffet`) une entrée dans un historique de taux PAS — jamais un
 * écrasement du reste de l'historique. Trié croissant par `dateEffet`, même convention que
 * `ajReelleHistorique` (cf. MonProfil.tsx, GestionAjReelle/GestionTauxPAS).
 */
function fusionnerTauxPASHistorique(historique: { dateEffet: string; valeur: number }[] | undefined, dateEffet: string, valeur: number): { dateEffet: string; valeur: number }[] {
  const base = (historique ?? []).filter((h) => h.dateEffet !== dateEffet);
  return [...base, { dateEffet, valeur }].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
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
          // Le taux n'arrive plus jamais par cette cible depuis le 02/08/2026 : seul le cas
          // "taux_pas_historique" ci-dessous écrit tauxPrelevementSourceHistorique désormais, quel
          // que soit le document d'origine (relevé/notification ou attestation dédiée). On se
          // contente ici de préserver l'historique déjà présent, inchangé.
          tauxPrelevementSourceHistorique: profil.ouvertureDroits?.tauxPrelevementSourceHistorique,
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

    case "taux_pas_historique": {
      if (!profil.ouvertureDroits) {
        throw new Error("Aucune ouverture de droits connue : non applicable (cf. evaluerProposition).");
      }
      const d = proposition.donnees;
      return {
        ...profil,
        ouvertureDroits: {
          ...profil.ouvertureDroits,
          // Chaque proposition taux_pas_historique porte UN SEUL couple (taux, date) — jamais un
          // choix de valeur "primaire" (cf. types/extraction.ts) : appliquer plusieurs propositions
          // successives (une par entrée affichée sur l'attestation) reconstruit tout l'historique,
          // une entrée à la fois, via la même fonction d'ajout que le canal notification/relevé.
          tauxPrelevementSourceHistorique: fusionnerTauxPASHistorique(profil.ouvertureDroits.tauxPrelevementSourceHistorique, d.dateEffet, d.valeur),
        },
      };
    }

    default:
      throw new Error(`La cible « ${proposition.cible} » ne s'applique pas au profil.`);
  }
}
