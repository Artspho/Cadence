// Couche de persistance, encapsulée derrière des fonctions async pour
// pouvoir être remplacée par une API Node/Express (V2, cf. §11.B) sans
// toucher aux composants : ceux-ci n'appellent jamais localStorage
// directement, seulement les fonctions exportées ici.
import { z } from "zod";
import type { Contrat, PeriodeAssimilee, Profil } from "../types";
import { profilSchema } from "../lib/coherenceProfil";

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
}

const donneesVides: DonneesApp = { profil: null, contrats: [], periodes: [] };

// Validation à la frontière (import JSON, lecture localStorage) : un
// utilisateur peut importer un fichier corrompu ou modifié à la main.
const contratSchema = z.object({
  id: z.string(),
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

// profilSchema (forme + cohérence situation/date) vit désormais dans lib/coherenceProfil.ts —
// unique définition, réutilisée ici ET par App.tsx (validerProfilPourEcriture), pour que l'import
// JSON et l'édition en mémoire referment exactement la même porte (cf. lib/coherenceProfil.ts).

const donneesAppSchema = z.object({
  profil: profilSchema.nullable(),
  contrats: z.array(contratSchema),
  periodes: z.array(periodeSchema),
});

export async function chargerDonnees(): Promise<DonneesApp> {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return donneesVides;
    const parse = donneesAppSchema.safeParse(JSON.parse(brut));
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

  const parse = donneesAppSchema.safeParse(brut);
  if (!parse.success) {
    throw new Error("Ce fichier n'a pas la structure attendue par Cadence.");
  }
  return parse.data;
}

export function creerContrat(partiel: Omit<Contrat, "id">): Contrat {
  return { id: crypto.randomUUID(), ...partiel };
}

export function creerPeriode(partiel: Omit<PeriodeAssimilee, "id">): PeriodeAssimilee {
  return { id: crypto.randomUUID(), ...partiel };
}
