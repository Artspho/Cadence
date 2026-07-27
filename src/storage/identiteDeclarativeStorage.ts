// Identité déclarative — nom, prénom, profession, adresse. Sert UNIQUEMENT à remplir l'en-tête du
// PDF « État détaillé des frais professionnels » (cf. ProfilDeclarant, lib/exportPdfFraisReels.ts).
//
// ⚠️ CLÉ VOLONTAIREMENT ISOLÉE, et c'est la raison d'être de ce fichier.
// Ces données sont les seules de tout Cadence à identifier nommément l'utilisateur. Elles vivent
// donc dans leur propre clé localStorage, distincte à la fois de :
//   - `cadence:v1:donnees` (storage/localStorageAdapter.ts) — le SEUL périmètre que
//     `exporterJSON`/`importerJSON` sérialisent, or la SPEC §11.A prévoit de collecter ces exports
//     JSON auprès des testeurs de la bêta. Y mettre un nom et une adresse les ferait circuler.
//   - `cadence_frais_reels_<annee>` (storage/fraisReelsStorage.ts) — l'identité ne dépend pas de
//     l'exercice fiscal, la dupliquer par année n'aurait aucun sens.
//
// Aucune fonction de ce fichier n'est appelée par localStorageAdapter.ts, et réciproquement :
// `exporterJSON` ne lit jamais le localStorage (il sérialise l'objet qu'on lui passe) et
// `importerJSON` n'écrit que `cadence:v1:donnees`. Cette clé est donc structurellement hors de
// portée de l'export/import de test. Vérifié par
// `src/storage/__tests__/identiteDeclarativeStorage.test.ts`.
import { z } from "zod";

const CLE_IDENTITE_DECLARATIVE = "cadence_identite_declarative";

export interface IdentiteDeclarative {
  nom: string;
  prenom: string;
  profession: string;
  adresse?: string; // optionnelle : ProfilDeclarant.adresse l'est aussi
}

const identiteDeclarativeSchema = z.object({
  nom: z.string(),
  prenom: z.string(),
  profession: z.string(),
  adresse: z.string().optional(),
});

export const identiteVide: IdentiteDeclarative = { nom: "", prenom: "", profession: "" };

/**
 * `nom`, `prenom` et `profession` sont requis par `ProfilDeclarant` (non optionnels) : sans eux, le
 * PDF partirait aux impôts avec un en-tête incomplet. `adresse` reste facultative.
 */
export function identiteComplete(identite: IdentiteDeclarative): boolean {
  return identite.nom.trim() !== "" && identite.prenom.trim() !== "" && identite.profession.trim() !== "";
}

export async function chargerIdentiteDeclarative(): Promise<IdentiteDeclarative> {
  try {
    const brut = window.localStorage.getItem(CLE_IDENTITE_DECLARATIVE);
    if (!brut) return identiteVide;
    const parse = identiteDeclarativeSchema.safeParse(JSON.parse(brut));
    if (!parse.success) {
      console.error("Identité déclarative corrompue, réinitialisation.", parse.error);
      return identiteVide;
    }
    return parse.data;
  } catch (erreur) {
    console.error("Impossible de lire l'identité déclarative.", erreur);
    return identiteVide;
  }
}

export async function sauvegarderIdentiteDeclarative(identite: IdentiteDeclarative): Promise<void> {
  window.localStorage.setItem(CLE_IDENTITE_DECLARATIVE, JSON.stringify(identite));
}

/** Exposée pour les tests d'isolation — jamais utilisée par l'UI. */
export const CLE_IDENTITE_DECLARATIVE_POUR_TESTS = CLE_IDENTITE_DECLARATIVE;
