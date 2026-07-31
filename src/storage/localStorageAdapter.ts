// Couche de persistance, encapsulée derrière des fonctions async pour
// pouvoir être remplacée par une API Node/Express (V2, cf. §11.B) sans
// toucher aux composants : ceux-ci n'appellent jamais localStorage
// directement, seulement les fonctions exportées ici.
import { z } from "zod";
import type { Contrat, Exercice, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "../types";
import { profilSchema, profilSchemaForme } from "../lib/coherenceProfil";

const CLE_STOCKAGE = "cadence:v1:donnees";

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

const donneesVides: DonneesApp = { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {} };

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
  return migrerSoldeVersDateDepart(migrerAjReelleHistoriqueVersProfil(migrerContratsDateDebut(migrerAjReelleHistorique(brut))));
}

export async function chargerDonnees(): Promise<DonneesApp> {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return donneesVides;
    const parse = donneesAppSchemaLecture.safeParse(migrer(JSON.parse(brut)));
    if (!parse.success) {
      console.error("Données locales corrompues, réinitialisation.", parse.error);
      return donneesVides;
    }
    return parse.data;
  } catch (erreur) {
    console.error("Impossible de lire les données locales.", erreur);
    return donneesVides;
  }
}

export async function sauvegarderDonnees(donnees: DonneesApp): Promise<void> {
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

export function creerContrat(partiel: Omit<Contrat, "id">): Contrat {
  return { id: crypto.randomUUID(), ...partiel };
}

export function creerPeriode(partiel: Omit<PeriodeAssimilee, "id">): PeriodeAssimilee {
  return { id: crypto.randomUUID(), ...partiel };
}
