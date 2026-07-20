// Couche de persistance, encapsulée derrière des fonctions async pour
// pouvoir être remplacée par une API Node/Express (V2, cf. §11.B) sans
// toucher aux composants : ceux-ci n'appellent jamais localStorage
// directement, seulement les fonctions exportées ici.
import { z } from "zod";
import type { Contrat, PeriodeAssimilee, Profil } from "../types";

const CLE_STOCKAGE = "cadence:v1:donnees";

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
  source: z.enum(["manuel", "import_pdf"]).optional(),
});

const periodeSchema = z.object({
  id: z.string(),
  type: z.enum(["maternite", "adoption", "accident_travail", "ald", "suspension_contrat", "maladie_intercontrat"]),
  dateDebut: z.string(),
  dateFin: z.string(),
});

const profilSchema = z.object({
  dateNaissance: z.string(),
  dateAnniversaire: z.string(),
  situation: z.enum(["premiere_admission", "readmission"]),
  alsaceMoselle: z.boolean().optional(),
  baremeCSG: z.enum(["normal", "reduit"]).optional(),
  activiteHorsAnnexe10: z.boolean().optional(),
});

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

/** Sérialise les données pour l'export JSON (filet anti-perte, cf. §11.A). */
export function exporterJSON(donnees: DonneesApp): string {
  return JSON.stringify({ version: 1, ...donnees }, null, 2);
}

/** Parse et valide un fichier JSON importé. Lève une erreur explicite si le format est invalide, jamais de correction silencieuse. */
export function importerJSON(contenu: string): DonneesApp {
  const parse = donneesAppSchema.safeParse(JSON.parse(contenu));
  if (!parse.success) {
    throw new Error("Le fichier importé n'a pas le format attendu par Cadence.");
  }
  return parse.data;
}

export function creerContrat(partiel: Omit<Contrat, "id">): Contrat {
  return { id: crypto.randomUUID(), ...partiel };
}

export function creerPeriode(partiel: Omit<PeriodeAssimilee, "id">): PeriodeAssimilee {
  return { id: crypto.randomUUID(), ...partiel };
}
