/**
 * src/types/extraction.ts (v3 — déplacé depuis api/extraction-schema.ts le 28/07/2026)
 *
 * CONTRAT PARTAGÉ entre le backend (api/extract-document.ts, qui valide la réponse
 * de Mistral avec ce schéma) et le front (components/RevueExtraction.tsx, qui affiche
 * les propositions et les route). Source UNIQUE, volontairement : si les deux côtés
 * avaient chacun leur copie, une divergence silencieuse enverrait une valeur dans le
 * mauvais champ — donc un chiffre faux à l'écran (devoir sacré n°2).
 *
 * Rangé dans `src/` et non dans `api/` parce que tsconfig.json n'inclut que `src` :
 * dans l'autre sens, le programme TypeScript du navigateur aurait dû aller chercher un
 * fichier de `api/`, ce qui brouille la frontière que tsconfig.api.json défend
 * explicitement (le code navigateur ne doit pas voir les globals Node). Ce fichier
 * n'utilise que Zod, aucun global Node : `api/` peut l'importer sans risque inverse.
 *
 * ⚠️ Ce n'est PAS le modèle de données de l'app (src/types/index.ts). C'est la forme
 * de ce qu'une IA PROPOSE, avant revue humaine. Rien ici n'est écrit automatiquement.
 * Volontairement pas ré-exporté depuis src/types/index.ts, pour que la distinction
 * « proposition à valider » vs « donnée établie » reste visible à l'import.
 *
 * Corrections de la v2 (retour Claude Code du 28/07/2026) :
 * Corrections apportées suite à l'analyse de Claude Code contre le vrai
 * `src/types/index.ts` :
 * - `type` et `territoire` de propositionContratSchema passent en nullable
 *   (un bulletin de paie n'indique presque jamais ces deux infos — les
 *   laisser requis forçait l'IA à inventer une valeur, contradiction directe
 *   avec la règle "jamais de valeur inventée").
 * - Ajout de `dateLimiteIndemnisation` et `tauxPrelevementSource` à
 *   `profil_ouverture_droits` (déjà présents sur la Notification d'admission
 *   déjà spécifiée — pas la peine d'attendre une V2).
 * - `profil_date_anniversaire` devient `profil_infos`, élargi à
 *   dateNaissance, dateAnniversairePrecedente, situation, dureeDroitsMois.
 * - Nouvelle cible `periode_assimilee` (PeriodeAssimilee confirmée exister).
 * - Exclusions explicites ajoutées en commentaire : `regimeDeclare` (jamais
 *   déduit d'un scan par décision documentée), `salairesHorsAnnexe10PRA`
 *   (piège de contradiction si proposé seul, cf. commit 4c9cfff),
 *   `franceTravailConfig` (constantes réglementaires, jamais écrasées par un
 *   document utilisateur), `activiteHorsAnnexe10` (déprécié),
 *   `SoldeIndemnisationDepart` (choix d'affichage utilisateur, aucun
 *   document ne le contient).
 */

import { z } from "zod";

const niveauConfiance = z.enum(["haute", "moyenne", "faible"]);

// ─── Cible 1 : Contrat (bulletin de paie / AEM / justificatif de déclaration) ──
// Note de nommage : le document qui fait foi est l'AEM (Attestation
// d'Employeur Mensuelle), pas "l'AER" — cf. SPEC §10 et §11.C.
//
// ⚠️ Risque de doublon, non traité ici (décision du 01/08/2026) : un
// « justificatif de déclaration de situation mensuelle » (typeDocumentDetecte
// "justificatif_declaration") arrive généralement APRÈS que l'utilisateur ait
// déjà saisi ses contrats du mois à la main — il ne fait que confirmer une
// déclaration déjà faite. Une proposition "contrat" issue de ce document peut
// donc doublonner un contrat déjà enregistré (même employeur, période proche,
// montant identique ou proche). Aucune détection de doublon n'est construite
// dans ce schéma ni dans routageExtraction.ts : chaque proposition passe par
// le formulaire de contrat comme n'importe quel bulletin, sans comparaison
// aux contrats existants. Risque assumé pour ce premier chantier, pas
// oublié — à traiter séparément (comparaison employeur + période + montant)
// avant de considérer ce canal fiable pour un usage répété sans relecture
// attentive de l'utilisateur à chaque import.
export const propositionContratSchema = z.object({
  cible: z.literal("contrat"),
  donnees: z.object({
    natureDocumentSource: z
      .enum(["aem", "bulletin_paie"])
      .nullable()
      .describe(
        "Nature LITTÉRALE du document lu, pas une supposition. « aem » UNIQUEMENT si le document " +
          "porte explicitement la mention « Attestation d'Employeur Mensuelle » ou l'acronyme « AEM » " +
          "(titre, en-tête, ou pied de page). « bulletin_paie » UNIQUEMENT si le document porte " +
          "explicitement « Bulletin de paie », « Bulletin de salaire », ou un intitulé standard " +
          "équivalent (« Bulletin GHS/sPAIEctacle », etc.). NE DÉDUIS JAMAIS ce champ de la présence " +
          "de champs habituels (brut, cachets, employeur) : un bulletin et une AEM contiennent " +
          "souvent les mêmes informations, seule la mention explicite du type de document permet de " +
          "les distinguer. Sans mention littérale de l'un ou l'autre (photocopie sans en-tête, format " +
          "inhabituel, titre illisible) → null. Ce null est la BONNE réponse et non un échec — ne " +
          "jamais deviner pour faire disparaître un null. Motif : ce champ déclenche un rappel côté " +
          "utilisateur (l'AEM fait foi auprès de France Travail, pas le bulletin) — un « bulletin_paie » " +
          "inventé sur une vraie AEM afficherait un avertissement trompeur ; un « aem » inventé sur un " +
          "vrai bulletin le priverait du rappel dont il a besoin."
      ),
    date: z.string().describe("Date de fin de contrat (ISO)"),
    dateDebut: z.string().nullable().describe("Date de début (ISO), null si absente du document"),
    type: z
      .enum(["artiste", "enseignement", "formation", "ptp"])
      .nullable()
      .describe(
        "Nature de l'ACTIVITÉ, pas le statut administratif. À renseigner quand le document décrit " +
          "l'activité elle-même : cachets de représentation, concert, spectacle, enregistrement → " +
          "« artiste » ; heures de cours, intervention pédagogique, établissement d'enseignement → " +
          "« enseignement ». Reste null sur une simple ligne de statut ou de catégorie d'emploi " +
          "(« Statut : Artiste », « Emploi : Artiste Musicien ») isolée, sans activité décrite : le " +
          "statut administratif et la nature de l'activité ne coïncident pas toujours (des heures de " +
          "cours peuvent être payées par un employeur du spectacle sous statut artiste). Ce champ " +
          "décide des règles de décompte des 507 h et du plafond enseignement 70/120 h — ne jamais " +
          "le deviner."
      ),
    typeRemuneration: z.enum(["cachet", "heures"]).nullable().describe(
      "Ne jamais convertir : si le document montre des heures, reste en heures."
    ),
    territoire: z
      .enum(["france", "eee_suisse_uk"])
      .nullable()
      .describe("Nullable : rarement indiqué explicitement sur un bulletin de paie."),
    nbCachets: z.number().nullable(),
    nbHeures: z.number().nullable(),
    nbJoursEEE: z.number().nullable().describe("Uniquement si territoire = eee_suisse_uk"),
    salaireBrut: z.number().describe("€ bruts AVANT abattement frais professionnels"),
    employeur: z.string(),
    etablissementAgree: z
      .boolean()
      .nullable()
      .describe(
        "Uniquement pertinent si type = enseignement. NE JAMAIS DÉDUIRE true DE LA SEULE PRÉSENCE " +
          "D'UN NOM D'ÉTABLISSEMENT D'ENSEIGNEMENT. « Agréé » est un statut administratif précis, " +
          "presque jamais écrit noir sur blanc sur un bulletin de paie. Ne mets true QUE si le mot " +
          "« agréé » ou « agrément » (ou une mention explicite équivalente, ex. « établissement agréé " +
          "par l'État ») figure LITTÉRALEMENT dans le document à propos de cet établissement. Un nom " +
          "seul — « Conservatoire à rayonnement régional de X », « École de musique Y », « Académie " +
          "Z », un collège, une université — est un NOM, pas un agrément : null. Sans mention " +
          "littérale du mot, null est la BONNE réponse et non un échec. Motif : ce champ conditionne " +
          "(avec enRapportAvecMetier) la prise en compte des heures d'enseignement dans les 507 h — " +
          "un true inventé gonflerait le décompte et afficherait un feu vert que l'utilisateur n'a pas."
      ),
    enRapportAvecMetier: z
      .boolean()
      .nullable()
      .describe(
        "Uniquement pertinent si type = enseignement. NE JAMAIS DÉDUIRE true DE LA SEULE " +
          "PLAUSIBILITÉ DU CONTEXTE. « En rapport avec le métier » est une condition d'éligibilité " +
          "précise, rarement énoncée en ces termes explicites sur un bulletin. Ne mets true QUE si " +
          "le document mentionne LITTÉRALEMENT que l'enseignement est en rapport avec le métier ou " +
          "l'activité artistique de l'intéressé. Un nom de matière, d'établissement ou de discipline " +
          "qui semble musical ou artistique (ex. « Cours de piano », « Conservatoire de X », " +
          "« Professeur de chant ») N'EST PAS une mention explicite du rapport avec le métier — ce " +
          "sont des noms, pas une déclaration de rapport : null. Sans mention littérale, null est la " +
          "BONNE réponse et non un échec. Motif : ce champ conditionne (avec etablissementAgree) la " +
          "prise en compte des heures d'enseignement dans les 507 h — un true inventé gonflerait le " +
          "décompte et afficherait un feu vert que l'utilisateur n'a pas."
      ),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string().describe("Où dans le document cette info a été trouvée"),
});

// ─── Cible 2 : Profil.ouvertureDroits (Notification d'admission) ──────────
export const propositionOuvertureDroitsSchema = z.object({
  cible: z.literal("profil_ouverture_droits"),
  donnees: z.object({
    dateOuverture: z.string().describe("Date à partir de laquelle indemnisable (ISO)"),
    franchiseCPTotale: z.number().nullable().describe("Franchise congés payés, en JOURS"),
    delaiAttenteInitial: z.number().nullable().describe("Délai d'attente, en JOURS"),
    dateLimiteIndemnisation: z
      .string()
      .nullable()
      .describe(
        "Fin de la période d'indemnisation en cours. DEUX formulations équivalentes selon le " +
          "document, confirmées identiques sur deux pièces réelles d'un même dossier : « La date " +
          "limite de votre indemnisation est le JJ/MM/AAAA » (relevé de situation) et « … jusqu'à " +
          "votre date anniversaire, soit le JJ/MM/AAAA inclus » (notification d'admission). Dans la " +
          "seconde, c'est la DEUXIÈME date de la phrase — la première, celle de la fin de contrat, " +
          "va dans dateAnniversaire."
      ),
    tauxPrelevementSource: z
      .number()
      .nullable()
      .describe("Taux de prélèvement à la source (%), présent sur notification/relevé/avis d'imposition."),
    tauxPrelevementSourceDateEffet: z
      .string()
      .nullable()
      .describe(
        "Date (ISO) de la section où la phrase du taux a été trouvée — le libellé « Situation au " +
          "JJ/MM/AAAA » qui précède le tableau contenant la phrase, ou la date de la notification " +
          "elle-même si le document n'a qu'une seule section. Un même document peut contenir " +
          "PLUSIEURS sections avec des dates différentes (un relevé de situation en couvre souvent " +
          "deux) — prends TOUJOURS la date de la section où LA PHRASE DU TAUX ELLE-MÊME apparaît, " +
          "jamais une autre date du document (règlement, période de paiement). Sert à choisir le " +
          "bon taux quand plusieurs documents successifs en donnent des différents : le plus récent " +
          "l'emporte, jamais le premier trouvé ni le taux du document le plus récemment importé."
      ),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 3 : Profil — infos générales (élargi, ex profil_date_anniversaire)
export const propositionProfilInfosSchema = z.object({
  cible: z.literal("profil_infos"),
  donnees: z.object({
    dateAnniversaire: z
      .string()
      .nullable()
      .describe(
        "Fin du dernier contrat de travail ayant OUVERT les droits. ⚠️ CE N'EST PAS une date de " +
          "naissance, et ce n'est PAS la « date anniversaire » au sens de France Travail. Sur une " +
          "notification, la phrase « … fin de votre contrat de travail du DATE_A ayant permis " +
          "l'ouverture de vos droits jusqu'à votre date anniversaire, soit le DATE_B inclus » " +
          "contient DEUX dates à un an d'écart : ce champ vaut DATE_A. DATE_B va dans " +
          "dateLimiteIndemnisation. Erreur observée en test réel : DATE_B retenue ici, soit un an " +
          "d'écart sur la borne qui détermine la fenêtre de référence et tout le décompte des 507 h."
      ),
    dateNaissance: z.string().nullable().describe("Détermine le plafond enseignement 70/120h applicable."),
    dateAnniversairePrecedente: z
      .string()
      .nullable()
      .describe("Trouvée sur une notification précédente — débloque le seuil ajusté en réadmission."),
    situation: z
      .enum(["premiere_admission", "readmission"])
      .nullable()
      .describe("Admission ou réadmission, tel qu'indiqué sur la notification."),
    dureeDroitsMois: z.union([z.literal(12), z.literal(6)]).nullable().describe("12 standard, 6 en clause de rattrapage."),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 4 : PeriodeAssimilee (confirmée existante) ──────────────────────
// ⚠️ Piège identifié par Claude Code : "ald" et "maladie_intercontrat" ont des
// effets opposés sur le décompte, et un simple avis d'arrêt de travail CPAM ne
// permet pas de les distinguer. Dans ce cas précis (arrêt maladie non qualifié),
// l'extraction doit produire une proposition "info_seule" plutôt que de deviner
// le type — jamais de valeur inventée sur un champ qui fausse le décompte des 507h.
export const propositionPeriodeAssimileeSchema = z.object({
  cible: z.literal("periode_assimilee"),
  donnees: z.object({
    type: z.enum(["maternite", "adoption", "accident_travail", "ald", "suspension_contrat", "maladie_intercontrat"]),
    dateDebut: z.string(),
    dateFin: z.string(),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 5 : ajReelleHistorique — la plus sensible ───────────────────────
export const propositionAjReelleSchema = z.object({
  cible: z.literal("aj_reelle_historique"),
  donnees: z.object({
    dateEffet: z.string().describe("Date à partir de laquelle ce montant s'applique (ISO)"),
    valeur: z.number(),
    natureMontant: z
      .enum(["net", "brut", "indetermine"])
      .describe(
        "OBLIGATOIRE : la nature EXACTE trouvée dans le document (mot pour mot). Ne jamais " +
          "deviner, ne jamais convertir — confirmé qu'aucune conversion fiable n'existe côté " +
          "moteur (calculerAJNette est à sens unique, nécessite un SJM indisponible ici, et est " +
          "documentée comme une estimation ; ajReelleHistorique interdit tout fallback estimé)."
      ),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 6 : historique de taux PAS (attestation dédiée) ─────────────────
// Document dédié à cette seule information (espace personnel impots.gouv.fr, rubrique « Gérer mon
// prélèvement à la source » / « Mes attestations ») — à distinguer de
// propositionOuvertureDroitsSchema.tauxPrelevementSource ci-dessus, qui capture un taux trouvé EN
// PLUS sur une notification/relevé (une seule proposition par document, celle-ci retenant la
// section la plus récente faute de mieux). Ici, le document PEUT lister plusieurs taux successifs
// (un historique de changements DGFIP) : chaque taux/date devient sa PROPRE proposition, jamais une
// proposition unique qui choisirait laquelle est "primaire" — fermeture délibérée, pour ce canal,
// du gap documenté dans CLAUDE.md (sélection d'une section comme valeur primaire) : aucune
// sélection automatique n'est possible par construction, l'utilisateur voit et applique chaque
// entrée lui-même. `valeur` et `dateEffet` sont volontairement NON nullables (contrairement à
// tauxPrelevementSource/tauxPrelevementSourceDateEffet) : ce document n'a qu'un seul rôle, donc rien
// à défaut de champ — si un taux ou sa date de prise d'effet ne peut pas être cité littéralement,
// aucune proposition ne doit être produite pour lui (cf. api/extract-document.ts).
export const propositionTauxPASHistoriqueSchema = z.object({
  cible: z.literal("taux_pas_historique"),
  donnees: z.object({
    valeur: z
      .number()
      .describe(
        "Taux de prélèvement à la source (%), UNIQUEMENT s'il est écrit EXPLICITEMENT comme un " +
          "taux (« taux de prélèvement à la source : X % », « taux personnalisé de X % »). NE " +
          "JAMAIS CALCULER un taux à partir d'un montant de retenue en euros et d'un revenu (ex. ne " +
          "divise jamais 15,03 € par un salaire pour en déduire un pourcentage) — si seul un " +
          "montant en euros est écrit, sans le mot « taux » et son pourcentage à côté, aucune " +
          "proposition ne doit être produite pour cette ligne."
      ),
    dateEffet: z
      .string()
      .describe(
        "Date ISO à partir de laquelle CE taux s'applique, telle qu'écrite EXPLICITEMENT à côté de " +
          "ce taux sur l'attestation (« applicable depuis le… », « à compter du… »). Jamais la date " +
          "d'édition du document en haut de page si elle diffère, jamais une date devinée."
      ),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 7 : information seule ────────────────────────────────────────────
// Salaire de référence officiel, NHT officiel, jours non indemnisés, taux
// d'imposition, montants bruts/nets du relevé, ET les périodes assimilées
// ambiguës (arrêt maladie non qualifiable ald/intercontrat) — jamais auto-appliqué.
export const propositionInfoSeuleSchema = z.object({
  cible: z.literal("info_seule"),
  donnees: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

export const propositionSchema = z.discriminatedUnion("cible", [
  propositionContratSchema,
  propositionOuvertureDroitsSchema,
  propositionProfilInfosSchema,
  propositionPeriodeAssimileeSchema,
  propositionAjReelleSchema,
  propositionTauxPASHistoriqueSchema,
  propositionInfoSeuleSchema,
]);

export const extractionResultSchema = z.object({
  typeDocumentDetecte: z.enum([
    "bulletin_paie",
    "aem", // Attestation d'Employeur Mensuelle — pas "AER"
    "notification_admission",
    "releve_situation",
    "declaration_fiscale_annuelle",
    "attestation_cpam",
    "justificatif_declaration", // Justificatif de déclaration de situation mensuelle (actualisation) — ajouté 01/08/2026
    "attestation_taux_pas", // Attestation de taux de prélèvement à la source (impots.gouv.fr) — ajouté 02/08/2026
    "non_reconnu",
    // ⚠️ "contrat_enseignement" est délibérément PAS ajouté ici — décision produit actée le
    // 01/08/2026 (docs/reprise.md) : les contrats d'enseignement ne seront PAS lus/extraits par IA,
    // saisie manuelle uniquement via ContractForm.tsx (etablissementAgree/enRapportAvecMetier déjà
    // couverts). Ce n'est plus une réservation en attente d'un spécimen (l'ancienne note du
    // 01/08/2026, cf. inventaire_donnees_et_documents.md §8.2, envisageait encore un lexique futur)
    // — le nom reste réservé ici uniquement pour qu'un futur chantier ne le réutilise pas par erreur
    // pour autre chose, jamais pour signaler un chantier IA en attente.
  ]),
  propositions: z.array(propositionSchema),
  avertissementsGeneraux: z.array(z.string()),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type Proposition = z.infer<typeof propositionSchema>;

/**
 * Champs et types VOLONTAIREMENT EXCLUS du périmètre d'extraction — à ne
 * jamais ajouter sans revalidation explicite :
 * - `regimeDeclare` : "signalé par l'utilisateur, jamais déduit des contrats"
 *   selon le type lui-même ; le déduire d'un scan reviendrait sur une
 *   décision documentée (SPEC §10/§11.C).
 * - `Profil.salairesHorsAnnexe10PRA` : atteignable en théorie, mais le
 *   renseigner seul (sans regimeDeclare, lui-même exclu) déclenche l'alerte
 *   de contradiction si regimeDeclare = "annexe10_pur" (commit 4c9cfff).
 *   Pas de proposition isolée possible tant que l'UI ne gère pas les deux
 *   ensemble.
 * - `franceTravailConfig` (plafonds enseignement 70/120h, plafond formation
 *   338h, etc.) : constantes réglementaires. Un document utilisateur ne doit
 *   jamais pouvoir écraser une règle.
 * - `Profil.activiteHorsAnnexe10` : déprécié, ne jamais écrire.
 * - `SoldeIndemnisationDepart.dateDepart` : choix d'affichage de
 *   l'utilisateur, aucun document ne le contient.
 */
