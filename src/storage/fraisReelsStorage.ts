// Persistance du module Frais réels — clé localStorage séparée PAR ANNÉE FISCALE
// (`cadence_frais_reels_<annee>`), indépendante de `cadence:v1:donnees` (storage/
// localStorageAdapter.ts, non touché). Même pattern général (Zod à la lecture, jamais de donnée
// perdue silencieusement) mais un seul schéma ici : aucune règle de cohérence bloquante n'existe
// encore pour ConfigFraisReels (contrairement à profilSchema/coherenceProfil.ts), donc pas de
// split lecture/écriture pour l'instant — à introduire le jour où une vraie règle apparaît (même
// piège que documenté dans coherenceProfil.ts : ne jamais faire échouer un chargement de page sur
// une donnée déjà stockée avant l'ajout d'une règle).
import { z } from "zod";
import type { BienAmorti, ConfigFraisReels, Depense } from "../types/fraisReels";

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

const vehiculeFraisKmSchema = z.object({
  type: z.enum(["voiture", "moto", "cyclomoteur"]),
  motorisation: z.enum(["thermique_hybride", "electrique"]).optional(),
  puissanceFiscale: z.number().optional(),
});

const paramsFraisKmC1Schema = z.object({
  vehicule: vehiculeFraisKmSchema,
  trajet: z.object({
    mode: z.literal("c1"),
    distanceDomicileTravail: z.number(),
    nombreAR: z.number(),
    choixPersonnel: z.boolean().nullable().optional(),
  }),
});

const paramsFraisKmC2Schema = z.object({
  vehicule: vehiculeFraisKmSchema,
  trajet: z.object({
    mode: z.literal("c2"),
    kmParcourus: z.number(),
  }),
});

const configFraisReelsSchema = z.object({
  anneeFiscale: z.number(),
  profilFiscal: z.enum(["artiste_exclusif", "artiste_enseignant_majoritaire", "artiste_enseignant_accessoire", "enseignant_pur"]),
  revenu: revenuImposableSchema,
  modeA: z.enum(["forfait", "reel"]),
  modeB: z.enum(["forfait", "reel"]),
  localPro: z.object({ surfaceTotalM2: z.number(), surfaceProM2: z.number() }).optional(),
  nombreRepasC3: z.number().optional(),
  stockageJustificatifs: z.enum(["local", "drive"]).optional(),
  driveConnecte: z.boolean().optional(),
  fraisKm: z.object({ c1: paramsFraisKmC1Schema.optional(), c2: paramsFraisKmC2Schema.optional() }).optional(),
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

/** Verdict d'écriture — `message` porte l'erreur brute du navigateur, jamais reformulée. */
export type ResultatSauvegardeFraisReels = { ok: true } | { ok: false; message: string };

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

/**
 * Même forme de verdict que `sauvegarderDonnees` (storage/localStorageAdapter.ts), et pour la même
 * raison — point 2 de docs/critique_2026-08-03.md, devoir sacré n°1.
 *
 * ⚠️ Trouvé le 04/08/2026 en finissant le point 2 : ces deux fonctions faisaient un `setItem` NU, et
 * leurs appelants (`FraisReels.tsx`, deux `useEffect`) n'attendaient pas la promesse. Un stockage plein
 * partait donc en rejet de promesse **non traité** : la dépense disparaissait sans un mot, écran
 * inchangé. La fiche du point 2 ne visait que `localStorageAdapter.ts` et `App.tsx` — cette porte-là
 * n'y était pas, alors que c'est justement celle où les justificatifs (base64, gros) saturent.
 */
export async function sauvegarderFraisReels(anneeFiscale: number, donnees: DonneesFraisReels): Promise<ResultatSauvegardeFraisReels> {
  try {
    window.localStorage.setItem(cleStockage(anneeFiscale), JSON.stringify(donnees));
    return { ok: true };
  } catch (erreur) {
    return { ok: false, message: erreur instanceof Error ? `${erreur.name} : ${erreur.message}` : String(erreur) };
  }
}

export function creerDepense(partiel: Omit<Depense, "id">): Depense {
  return { id: crypto.randomUUID(), ...partiel };
}

// ── Biens amortis (C7, Q1/Q4) ───────────────────────────────────────────────────────────────
// Clé DÉLIBÉRÉMENT NON suffixée par l'année, contrairement à `cadence_frais_reels_<annee>` :
// un bien acheté en 2025 et amorti sur 5 ans doit encore générer une annuité en 2026…2029 sans
// que l'utilisateur le ressaisisse. On stocke donc la liste BRUTE des biens (désignation, date
// d'achat, prix HT, durée retenue) une seule fois, et c'est `calculerAmortissementsAnnee` qui
// dérive, pour une année d'imposition donnée, quels biens sont en cours et quelle annuité
// s'applique. Aucune donnée calculée (annuité, reste à amortir) n'est persistée : elle serait
// périmée dès le changement d'année (même discipline que `Depense.montantDeductible`, toujours
// recalculé depuis les champs source par le moteur).
const CLE_BIENS_AMORTIS = "cadence_frais_reels_biens_amortis";

const bienAmortiSchema = z.object({
  id: z.string(),
  designation: z.string(),
  categorie: z.enum(["informatique", "sonorisation_electronique", "instrument", "mobilier_bureau", "autre_outillage"]),
  prixHT: z.number(),
  dateAchat: z.string(),
  dureeAns: z.number(),
  tauxPro: z.number(),
  justificatifId: z.string().optional(),
});

const biensAmortisSchema = z.array(bienAmortiSchema);

export async function chargerBiensAmortis(): Promise<BienAmorti[]> {
  try {
    const brut = window.localStorage.getItem(CLE_BIENS_AMORTIS);
    if (!brut) return [];
    const parse = biensAmortisSchema.safeParse(JSON.parse(brut));
    if (!parse.success) {
      console.error("Biens amortis corrompus, réinitialisation.", parse.error);
      return [];
    }
    return parse.data;
  } catch (erreur) {
    console.error("Impossible de lire les biens amortis.", erreur);
    return [];
  }
}

export async function sauvegarderBiensAmortis(biens: BienAmorti[]): Promise<ResultatSauvegardeFraisReels> {
  try {
    window.localStorage.setItem(CLE_BIENS_AMORTIS, JSON.stringify(biens));
    return { ok: true };
  } catch (erreur) {
    return { ok: false, message: erreur instanceof Error ? `${erreur.name} : ${erreur.message}` : String(erreur) };
  }
}

export function creerBienAmorti(partiel: Omit<BienAmorti, "id">): BienAmorti {
  return { id: crypto.randomUUID(), ...partiel };
}
