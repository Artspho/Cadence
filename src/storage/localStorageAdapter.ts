// Couche de persistance, encapsulée derrière des fonctions async pour
// pouvoir être remplacée par une API Node/Express (V2, cf. §11.B) sans
// toucher aux composants : ceux-ci n'appellent jamais localStorage
// directement, seulement les fonctions exportées ici.
import { z } from "zod";
import type { Contrat, Exercice, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "../types";
import { profilSchema, profilSchemaForme } from "../lib/coherenceProfil";

export const CLE_STOCKAGE = "cadence:v1:donnees";
/** Version précédant l'écriture en cours — filet de restauration, cf. `sauvegarderDonnees`. */
export const CLE_SAUVEGARDE = "cadence:v1:donnees.backup";
/** Contenu illisible mis de côté avant un « repartir de zéro », cf. `reinitialiserDonnees`. */
export const CLE_QUARANTAINE = "cadence:v1:donnees.illisible";

/**
 * Version du SCHÉMA du fichier export/import JSON — distincte de
 * `franceTravailConfig.meta.version` (qui décrit les règles réglementaires).
 * Un fichier dont `schemaVersion` ne correspond pas EXACTEMENT à cette
 * constante est refusé à l'import, jamais interprété au mieux : on ne gère
 * pas encore de migration entre versions de schéma.
 */
export const SCHEMA_VERSION_DONNEES = 1;

export interface DonneesApp {
  profil: Profil | null;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  soldeIndemnisationDepart: SoldeIndemnisationDepart | null;
  // Exercices clos figés une fois pour toutes (cf. engine/cycles.ts, fusionnerExercicesGeles) —
  // clé = Exercice.id. Un import ou une nouvelle FCT ne doit plus jamais changer l'AJ affichée pour
  // un cycle déjà clos ; ce sont ces valeurs-là, et seulement elles, qu'Historique.tsx affiche pour
  // un exercice figé, jamais une version recalculée à la volée.
  exercicesGeles: Record<string, Exercice>;
}

/** Fabrique (et non constante partagée) : chaque appelant reçoit son propre objet, jamais une
 * référence commune qu'une mutation accidentelle propagerait partout. */
export function creerDonneesVides(): DonneesApp {
  return { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} };
}

// Validation à la frontière (import JSON, lecture localStorage) : un
// utilisateur peut importer un fichier corrompu ou modifié à la main.
const contratSchema = z.object({
  id: z.string(),
  // Toujours une chaîne après migrerContratsDateDebut() (repli sur `date` si absente à la
  // lecture) — jamais optionnelle ici, pour matcher exactement Contrat.dateDebut: string.
  dateDebut: z.string(),
  date: z.string(),
  type: z.enum(["artiste", "enseignement", "formation", "ptp"]),
  typeRemuneration: z.enum(["cachet", "heures"]),
  territoire: z.enum(["france", "eee_suisse_uk"]),
  nbCachets: z.number().optional(),
  nbHeures: z.number().optional(),
  nbJoursEEE: z.number().optional(),
  salaireBrut: z.number(),
  employeur: z.string(),
  etablissementAgree: z.boolean().optional(),
  enRapportAvecMetier: z.boolean().optional(),
  source: z.enum(["manuel", "import_pdf", "recurrent"]).optional(),
  recurrenceId: z.string().optional(),
  statutVerification: z.enum(["a_verifier", "confirme"]).optional(),
});

const periodeSchema = z.object({
  id: z.string(),
  type: z.enum(["maternite", "adoption", "accident_travail", "ald", "suspension_contrat", "maladie_intercontrat"]),
  dateDebut: z.string(),
  dateFin: z.string(),
});

// Ne porte plus que dateDepart depuis le 2026-07-25 (cf. types/index.ts) — l'état interne
// (délai/franchise CP) est simulé par le moteur depuis Profil.ouvertureDroits.
const soldeIndemnisationDepartSchema = z.object({
  dateDepart: z.string(),
});

// Exercice figé (cf. engine/cycles.ts, fusionnerExercicesGeles) — mêmes champs que le type
// Exercice, aucun champ recalculable n'est omis : une fois figé, il n'est plus jamais régénéré,
// donc il doit déjà porter tout ce qu'Historique.tsx affiche.
const exerciceSchema = z.object({
  id: z.string(),
  dateDebut: z.string(),
  dateAnniversaire: z.string(),
  heuresAtteintes: z.number(),
  objectifAtteint: z.boolean(),
  ajBrute: z.number().optional(),
  ajNette: z.number().optional(),
  cloture: z.boolean(),
});

// Migration silencieuse (2026-07-24) : un solde de départ configuré avant le passage de
// `ajReelle: number | null` à un historique de taux (`ajReelleHistorique`) n'a que l'ancien champ.
// Convertit en une entrée unique à une date arbitrairement ancienne (couvre tout mois déjà
// déclaré) — aucune perte pour un solde déjà configuré (devoir sacré n°1). `ajReelle: null` (jamais
// renseignée) ne produit aucune entrée : `ajReelleHistorique` retombe sur son défaut `[]` normal.
function migrerAjReelleHistorique(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null) return brut;
  const donnees = brut as Record<string, unknown>;
  const solde = donnees.soldeIndemnisationDepart;
  if (typeof solde !== "object" || solde === null || Array.isArray(solde)) return brut;
  const s = solde as Record<string, unknown>;
  if (typeof s.ajReelle !== "number" || s.ajReelleHistorique !== undefined) return brut;
  return { ...donnees, soldeIndemnisationDepart: { ...s, ajReelleHistorique: [{ dateEffet: "2000-01-01", valeur: s.ajReelle }] } };
}

// Migration silencieuse (2026-07-25) : `ajReelleHistorique` vivait sur `soldeIndemnisationDepart`
// avant de devenir une caractéristique de `Profil.ouvertureDroits` (cf. types/index.ts). Déplace
// la valeur si elle existe encore là-bas et que le profil ne l'a pas déjà (jamais d'écrasement
// d'une valeur déjà migrée) — aucune perte pour un solde déjà configuré (devoir sacré n°1).
function migrerAjReelleHistoriqueVersProfil(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null) return brut;
  const donnees = brut as Record<string, unknown>;
  const solde = donnees.soldeIndemnisationDepart;
  if (typeof solde !== "object" || solde === null || Array.isArray(solde)) return brut;
  const s = solde as Record<string, unknown>;
  if (!Array.isArray(s.ajReelleHistorique)) return brut;
  const profilBrut = donnees.profil;
  if (typeof profilBrut !== "object" || profilBrut === null) return brut;
  const p = profilBrut as Record<string, unknown>;
  if (p.ajReelleHistorique !== undefined) return brut;
  return { ...donnees, profil: { ...p, ajReelleHistorique: s.ajReelleHistorique } };
}

// Migration silencieuse (2026-08-01) : un profil enregistré avant le passage de
// `ouvertureDroits.tauxPrelevementSource: number` à un historique de taux
// (`tauxPrelevementSourceHistorique`, cf. types/index.ts) n'a que l'ancien champ scalaire. Convertit
// en une entrée unique à une date arbitrairement ancienne (couvre tout mois déjà déclaré) — aucune
// perte pour un profil déjà configuré (devoir sacré n°1). Même pattern que
// `migrerAjReelleHistorique` ci-dessus.
function migrerTauxPASHistorique(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null) return brut;
  const donnees = brut as Record<string, unknown>;
  const profilBrut = donnees.profil;
  if (typeof profilBrut !== "object" || profilBrut === null) return brut;
  const p = profilBrut as Record<string, unknown>;
  const ouverture = p.ouvertureDroits;
  if (typeof ouverture !== "object" || ouverture === null || Array.isArray(ouverture)) return brut;
  const o = ouverture as Record<string, unknown>;
  if (typeof o.tauxPrelevementSource !== "number" || o.tauxPrelevementSourceHistorique !== undefined) return brut;
  const { tauxPrelevementSource, ...ouvertureSansTaux } = o;
  return {
    ...donnees,
    profil: { ...p, ouvertureDroits: { ...ouvertureSansTaux, tauxPrelevementSourceHistorique: [{ dateEffet: "2000-01-01", valeur: tauxPrelevementSource }] } },
  };
}

// Migration silencieuse (2026-07-25) : un solde de départ configuré avant le passage à
// `Profil.ouvertureDroits` portait `delaiRestant`/`franchiseCPRestante`/`quotaCPCarryOver`,
// désormais simulés automatiquement par le moteur. Ne garde que `date` → `dateDepart` (à partir de
// quel mois afficher le tableau) — aucune reconstruction possible de `ouvertureDroits` depuis ces
// anciennes valeurs (devoir n°2 : jamais un chiffre deviné) : l'utilisateur devra la renseigner
// depuis sa notification dans « Mon profil » (RevenusMensuels.tsx l'indique explicitement).
function migrerSoldeVersDateDepart(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null) return brut;
  const donnees = brut as Record<string, unknown>;
  const solde = donnees.soldeIndemnisationDepart;
  if (typeof solde !== "object" || solde === null || Array.isArray(solde)) return brut;
  const s = solde as Record<string, unknown>;
  if (s.dateDepart !== undefined) return brut;
  if (typeof s.date !== "string") return brut;
  return { ...donnees, soldeIndemnisationDepart: { dateDepart: s.date } };
}

// Migration silencieuse (2026-07-24) : un contrat enregistré avant l'ajout de `dateDebut`
// (découpage mensuel, cf. engine/decoupageMensuel.ts) n'a que `date`. Repli sur `date` comme
// `dateDebut` — traite le contrat comme couvrant un seul jour, comportement identique à avant
// ce champ (aucune régression, aucune perte, devoir sacré n°1).
function migrerContratsDateDebut(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null) return brut;
  const donnees = brut as Record<string, unknown>;
  if (!Array.isArray(donnees.contrats)) return brut;
  const contrats = donnees.contrats.map((c) => {
    if (typeof c !== "object" || c === null) return c;
    const contrat = c as Record<string, unknown>;
    if (contrat.dateDebut !== undefined) return contrat;
    return { ...contrat, dateDebut: contrat.date };
  });
  return { ...donnees, contrats };
}

// profilSchema/profilSchemaForme (forme, +cohérence pour le second) vivent désormais dans
// lib/coherenceProfil.ts — définitions uniques, réutilisées ici ET par App.tsx
// (validerProfilPourEcriture). Deux schémas de données distincts ci-dessous, PAS un seul :
// - `donneesAppSchemaLecture` (profilSchemaForme, sans cohérence) pour `chargerDonnees` — un
//   profil déjà enregistré avant l'ajout d'une nouvelle règle de cohérence ne doit jamais se
//   mettre à échouer au simple chargement de page (devoir sacré n°1, cf. lib/coherenceProfil.ts).
// - `donneesAppSchemaEcriture` (profilSchema, avec cohérence) pour `importerJSON` — une action
//   explicite de l'utilisateur, doit fermer la même porte que l'édition en mémoire (cf.
//   validerProfilPourEcriture) : sinon un JSON incohérent (le tien, ou celui d'un ami en retour
//   d'usage, cf. SPEC §11.A) pourrait réinjecter ce que ni l'onboarding ni l'édition n'auraient
//   jamais laissé naître.
const champsCommuns = {
  contrats: z.array(contratSchema),
  periodes: z.array(periodeSchema),
  // .default(null) : un export antérieur au module indemnisation mensuelle n'a pas ce champ du
  // tout — pas une migration de schemaVersion, juste une donnée absente qui redevient l'état vide
  // (devoir sacré n°1 : un ancien export doit toujours pouvoir se réimporter sans perte).
  // `declarationsMensuelles` (ancienne saisie manuelle de "jours déclarés") retiré le 2026-07-24 :
  // remplacé par un calcul automatique depuis les contrats (calculerSerieDepuisContrats), cf.
  // docs/reprise.md. Un ancien export qui contient encore cette clé n'échoue pas pour autant —
  // Zod ignore silencieusement les clés inconnues.
  soldeIndemnisationDepart: soldeIndemnisationDepartSchema.nullable().default(null),
  // .default({}) : un export antérieur à ce champ n'a jamais rien figé — état vide, jamais un
  // échec de lecture (devoir sacré n°1, même principe que soldeIndemnisationDepart ci-dessus).
  exercicesGeles: z.record(exerciceSchema).default({}),
};
const donneesAppSchemaLecture = z.object({ profil: profilSchemaForme.nullable(), ...champsCommuns });
const donneesAppSchemaEcriture = z.object({ profil: profilSchema.nullable(), ...champsCommuns });

function migrer(brut: unknown) {
  return migrerTauxPASHistorique(migrerSoldeVersDateDepart(migrerAjReelleHistoriqueVersProfil(migrerContratsDateDebut(migrerAjReelleHistorique(brut)))));
}

/**
 * Issue d'une tentative de lecture — TROIS cas distincts, jamais confondus (correctif du
 * 03/08/2026, point 🔴 n°1 de docs/critique_2026-08-03.md).
 *
 * Avant ce correctif, `chargerDonnees` renvoyait le même état vide pour « il n'y a rien » et pour
 * « il y a quelque chose que je n'arrive pas à lire ». L'appelant ne pouvait donc pas se comporter
 * différemment : `App.tsx` plaçait cet état vide dans son état, et son effet de sauvegarde le
 * réécrivait aussitôt PAR-DESSUS le contenu d'origine, sans le moindre clic de l'utilisateur. Un
 * contenu souvent parfaitement récupérable à la main (un JSON complet dont un seul champ gêne Zod)
 * était détruit en silence — violation directe du devoir sacré n°1.
 *
 * La distinction `vide` / `illisible` EST le correctif : elle seule permet à l'appelant de savoir
 * qu'il n'a pas le droit d'écrire.
 */
export type ResultatChargement =
  /** Contenu lu et validé. Écriture autorisée. */
  | { statut: "ok"; donnees: DonneesApp }
  /** Aucune clé en stockage : vrai premier lancement. Écriture autorisée. */
  | { statut: "vide" }
  /**
   * Une clé existe mais son contenu est refusé (JSON invalide, schéma non respecté, migration en
   * échec, accès au stockage refusé). **Écriture formellement interdite** tant que l'utilisateur n'a
   * pas tranché : `brut` transporte le texte intact pour qu'il puisse le sauvegarder ailleurs,
   * `detail` la raison technique, `sauvegarde` la copie de secours si elle est exploitable.
   */
  | { statut: "illisible"; brut: string | null; detail: string; sauvegarde: DonneesApp | null };

/** Issue d'une tentative d'écriture — l'échec REMONTE, il n'est plus avalé (filet minimal du point n°2). */
export type ResultatSauvegarde = { ok: true } | { ok: false; message: string };

function detailErreur(erreur: unknown): string {
  if (erreur instanceof Error) return `${erreur.name} : ${erreur.message}`;
  return String(erreur);
}

/** Lecture brute qui ne lève jamais — `null` si la clé est absente OU si le stockage est inaccessible. */
function lireBrut(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

/**
 * Copie de secours exploitable, ou `null`. Ne lève jamais : une sauvegarde elle-même illisible est
 * traitée comme absente — on ne va pas faire échouer l'écran de secours avec un second échec.
 */
function lireSauvegarde(): DonneesApp | null {
  const brut = lireBrut(CLE_SAUVEGARDE);
  if (brut === null) return null;
  try {
    const parse = donneesAppSchemaLecture.safeParse(migrer(JSON.parse(brut)));
    return parse.success ? parse.data : null;
  } catch {
    return null;
  }
}

export async function chargerDonnees(): Promise<ResultatChargement> {
  let brut: string | null;
  try {
    brut = window.localStorage.getItem(CLE_STOCKAGE);
  } catch (erreur) {
    // Stockage inaccessible (navigation privée verrouillée, réglages restrictifs). On ne prétend
    // PAS que l'utilisateur est nouveau : on ne sait rien, donc on n'écrit rien.
    return { statut: "illisible", brut: null, detail: detailErreur(erreur), sauvegarde: null };
  }

  // `null` = la clé n'existe pas du tout. Une chaîne vide, elle, n'est PAS un stockage vide : c'est
  // une clé présente et illisible (elle tombera dans le catch de JSON.parse ci-dessous).
  if (brut === null) return { statut: "vide" };

  try {
    const parse = donneesAppSchemaLecture.safeParse(migrer(JSON.parse(brut)));
    if (!parse.success) {
      return { statut: "illisible", brut, detail: parse.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" · "), sauvegarde: lireSauvegarde() };
    }
    return { statut: "ok", donnees: parse.data };
  } catch (erreur) {
    // Couvre JSON.parse ET une migration qui lèverait sur une donnée inattendue.
    return { statut: "illisible", brut, detail: detailErreur(erreur), sauvegarde: lireSauvegarde() };
  }
}

/**
 * Écrit l'état, après avoir fait glisser la version précédente dans la copie de secours
 * (`CLE_SAUVEGARDE`) — filet ajouté le 03/08/2026 pour permettre une restauration si l'écriture qui
 * suit s'avérait mauvaise.
 *
 * Ordre délibéré — la copie de secours est écrite APRÈS le succès de l'écriture principale :
 *  - si l'écriture principale échoue (stockage plein), rien n'a bougé, l'existant est intact ;
 *  - la copie n'est qu'un bonus, son propre échec ne doit jamais compromettre la donnée de record.
 *
 * Écrire un contenu identique à celui déjà en place n'est PAS une écriture : on sort tôt. Sans ça,
 * chaque ouverture de l'app (qui réécrit ce qu'elle vient de lire) écraserait la copie de secours
 * par une copie du présent — la version précédente serait perdue à chaque démarrage.
 */
export async function sauvegarderDonnees(donnees: DonneesApp): Promise<ResultatSauvegarde> {
  const serialise = JSON.stringify(donnees);
  const precedent = lireBrut(CLE_STOCKAGE);
  if (precedent === serialise) return { ok: true };

  try {
    window.localStorage.setItem(CLE_STOCKAGE, serialise);
  } catch (erreur) {
    return { ok: false, message: detailErreur(erreur) };
  }

  if (precedent !== null) {
    try {
      window.localStorage.setItem(CLE_SAUVEGARDE, precedent);
    } catch {
      // Copie de secours non écrite (stockage plein) : la donnée principale, elle, est bien
      // enregistrée. On ne transforme pas un bonus manquant en échec.
    }
  }
  return { ok: true };
}

/**
 * Repartir de zéro depuis l'écran de données illisibles — SEULE action de tout ce chemin autorisée
 * à écrire, et seulement après confirmation explicite de l'utilisateur (cf.
 * `EcranDonneesIllisibles.tsx` : case à cocher obligatoire, bouton désactivé sans elle).
 *
 * Le contenu illisible est déplacé dans une clé de quarantaine avant d'être remplacé : même après
 * ce geste volontaire, rien n'est réellement détruit tant que le navigateur n'est pas vidé.
 */
export async function reinitialiserDonnees(): Promise<DonneesApp> {
  const brut = lireBrut(CLE_STOCKAGE);
  if (brut !== null) {
    try {
      window.localStorage.setItem(CLE_QUARANTAINE, brut);
    } catch {
      // Quarantaine impossible (stockage plein) : l'utilisateur a déjà été invité à télécharger le
      // brut avant d'arriver ici, on ne bloque pas son redémarrage pour autant.
    }
  }
  const vides = creerDonneesVides();
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(vides));
  return vides;
}

/** Réinstalle la copie de secours comme donnée courante (bouton « restaurer la version précédente »). */
export async function restaurerSauvegarde(donnees: DonneesApp): Promise<void> {
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
}

/**
 * Sérialise les données pour l'export JSON (filet anti-perte, cf. §11.A).
 * `dateExport` est un paramètre (pas `new Date()` interne) pour rester
 * testable de façon déterministe — en production, l'appelant ne le passe
 * jamais, il prend simplement l'instant présent par défaut.
 */
export function exporterJSON(donnees: DonneesApp, dateExport: Date = new Date()): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION_DONNEES, exporteLe: dateExport.toISOString(), ...donnees }, null, 2);
}

/**
 * Parse et valide un fichier JSON importé. Trois échecs distincts, trois
 * messages distincts (JSON invalide / version de schéma inconnue / forme
 * invalide) — dans les trois cas la fonction LÈVE, elle ne retourne jamais
 * un état partiel : tant qu'elle n'a pas rendu un objet, rien ne doit être
 * écrit par l'appelant (devoir sacré n°1 — l'état existant doit survivre
 * intact à un import raté).
 */
export function importerJSON(contenu: string): DonneesApp {
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }

  const schemaVersionRecue = typeof brut === "object" && brut !== null ? (brut as Record<string, unknown>).schemaVersion : undefined;
  if (schemaVersionRecue !== SCHEMA_VERSION_DONNEES) {
    throw new Error(
      `Ce fichier a été exporté par une version différente de Cadence (version ${schemaVersionRecue ?? "inconnue"}, attendue ${SCHEMA_VERSION_DONNEES}) — import refusé, pas de conversion automatique.`,
    );
  }

  const parse = donneesAppSchemaEcriture.safeParse(migrer(brut));
  if (!parse.success) {
    // Message de cohérence spécifique (ex. dateLimiteIndemnisation avant dateOuverture) si c'est la
    // cause du refus (`.refine()`, cf. lib/coherenceProfil.ts) — message générique de forme sinon,
    // pour ne pas changer le comportement déjà testé sur un fichier structurellement invalide.
    const messageCoherence = parse.error.issues.find((i) => i.code === "custom")?.message;
    throw new Error(messageCoherence ?? "Ce fichier n'a pas la structure attendue par Cadence.");
  }
  return parse.data;
}

/**
 * Statut de vérification par défaut à la CRÉATION d'un contrat, selon sa provenance (`source`) —
 * jamais un choix de l'utilisateur dans le formulaire (cf. types/index.ts). Un document déjà lu
 * (`import_pdf`) EST la confirmation ; une saisie de mémoire (`manuel`, ou `recurrent` — anticipée,
 * pas encore adossée à un document) reste "a_verifier" jusqu'à preuve du contraire. Un
 * `statutVerification` déjà fourni explicitement par l'appelant (ex. mise à jour d'un contrat
 * existant) n'est jamais écrasé par ce défaut.
 */
function statutVerificationParDefaut(partiel: Omit<Contrat, "id">): "a_verifier" | "confirme" {
  if (partiel.statutVerification) return partiel.statutVerification;
  return partiel.source === "import_pdf" ? "confirme" : "a_verifier";
}

export function creerContrat(partiel: Omit<Contrat, "id">): Contrat {
  return { id: crypto.randomUUID(), ...partiel, statutVerification: statutVerificationParDefaut(partiel) };
}

export function creerPeriode(partiel: Omit<PeriodeAssimilee, "id">): PeriodeAssimilee {
  return { id: crypto.randomUUID(), ...partiel };
}
