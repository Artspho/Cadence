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

// ─── Cible 1 : Contrat (bulletin de paie / AEM) ────────────────────────────
// Note de nommage : le document qui fait foi est l'AEM (Attestation
// d'Employeur Mensuelle), pas "l'AER" — cf. SPEC §10 et §11.C.
export const propositionContratSchema = z.object({
  cible: z.literal("contrat"),
  donnees: z.object({
    date: z.string().describe("Date de fin de contrat (ISO)"),
    dateDebut: z.string().nullable().describe("Date de début (ISO), null si absente du document"),
    type: z
      .enum(["artiste", "enseignement", "formation", "ptp"])
      .nullable()
      .describe(
        "Nullable : un bulletin de paie n'indique presque jamais artiste vs enseignement. " +
          "Ne jamais deviner — laisser null plutôt qu'inventer."
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
    etablissementAgree: z.boolean().nullable().describe("Uniquement pertinent si type = enseignement"),
    enRapportAvecMetier: z.boolean().nullable().describe("Uniquement pertinent si type = enseignement"),
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
        "Le document dit mot pour mot : « La date limite de votre indemnisation est le JJ/MM/AAAA »."
      ),
    tauxPrelevementSource: z
      .number()
      .nullable()
      .describe("Taux de prélèvement à la source (%), présent sur notification/relevé/avis d'imposition."),
  }),
  confiance: z.record(niveauConfiance),
  justification: z.string(),
});

// ─── Cible 3 : Profil — infos générales (élargi, ex profil_date_anniversaire)
export const propositionProfilInfosSchema = z.object({
  cible: z.literal("profil_infos"),
  donnees: z.object({
    dateAnniversaire: z.string().nullable(),
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

// ─── Cible 6 : information seule ────────────────────────────────────────────
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
    "non_reconnu",
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
