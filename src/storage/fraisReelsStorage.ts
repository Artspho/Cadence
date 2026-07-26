// Persistance du module Frais réels — clé localStorage séparée PAR ANNÉE FISCALE
// (`cadence_frais_reels_<annee>`), indépendante de `cadence:v1:donnees` (storage/
// localStorageAdapter.ts, non touché). Même pattern général (Zod à la lecture, jamais de donnée
// perdue silencieusement) mais un seul schéma ici : aucune règle de cohérence bloquante n'existe
// encore pour ConfigFraisReels (contrairement à profilSchema/coherenceProfil.ts), donc pas de
// split lecture/écriture pour l'instant — à introduire le jour où une vraie règle apparaît (même
// piège que documenté dans coherenceProfil.ts : ne jamais faire échouer un chargement de page sur
// une donnée déjà stockée avant l'ajout d'une règle).
import { z } from "zod";
import type { ConfigFraisReels, Depense } from "../types/fraisReels";

const categorieFraisSchema = z.enum(["A", "B", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "D"]);

const depenseSchema = z.object({
  id: z.string(),
  anneeFiscale: z.number(),
  date: z.string(),
  categorie: categorieFraisSchema,
  description: z.string(),
  montantTotal: z.number(),
  remboursementEmployeur: z.number(),
  partPro: z.number(),
  montantDeductible: z.number(),
  statutJustificatif: z.enum(["fourni", "manquant", "non_requis"]),
  justificatifNom: z.string().optional(),
  justificatifData: z.string().optional(),
  driveFileId: z.string().optional(),
  driveWebViewLink: z.string().optional(),
  notes: z.string().optional(),
});

const revenuImposableSchema = z.object({
  anneeFiscale: z.number(),
  salaireNetImposable: z.number(),
  allocationsAre: z.number(),
  congesSpectacles: z.number(),
  indemnitesJournalieres: z.number(),
});

const configFraisReelsSchema = z.object({
  anneeFiscale: z.number(),
  profilFiscal: z.enum(["artiste_exclusif", "artiste_enseignant_majoritaire", "artiste_enseignant_accessoire", "enseignant_pur"]),
  revenu: revenuImposableSchema,
  modeA: z.enum(["forfait", "reel"]),
  modeB: z.enum(["forfait", "reel"]),
  localPro: z.object({ surfaceTotalM2: z.number(), surfaceProM2: z.number() }).optional(),
  nombreRepasC3: z.number().optional(),
});

const donneesFraisReelsSchema = z.object({
  config: configFraisReelsSchema.nullable(),
  depenses: z.array(depenseSchema),
});

export interface DonneesFraisReels {
  config: ConfigFraisReels | null;
  depenses: Depense[];
}

const donneesVides: DonneesFraisReels = { config: null, depenses: [] };

function cleStockage(anneeFiscale: number): string {
  return `cadence_frais_reels_${anneeFiscale}`;
}

export async function chargerFraisReels(anneeFiscale: number): Promise<DonneesFraisReels> {
  try {
    const brut = window.localStorage.getItem(cleStockage(anneeFiscale));
    if (!brut) return donneesVides;
    const parse = donneesFraisReelsSchema.safeParse(JSON.parse(brut));
    if (!parse.success) {
      console.error("Données frais réels corrompues, réinitialisation.", parse.error);
      return donneesVides;
    }
    return parse.data;
  } catch (erreur) {
    console.error("Impossible de lire les données frais réels.", erreur);
    return donneesVides;
  }
}

export async function sauvegarderFraisReels(anneeFiscale: number, donnees: DonneesFraisReels): Promise<void> {
  window.localStorage.setItem(cleStockage(anneeFiscale), JSON.stringify(donnees));
}

export function creerDepense(partiel: Omit<Depense, "id">): Depense {
  return { id: crypto.randomUUID(), ...partiel };
}
