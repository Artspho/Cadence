// Détection de contrats déjà saisis qui pourraient correspondre à un document nouvellement importé
// (AEM, bulletin, justificatif de déclaration mensuelle) — mécanisme UNIQUE, partagé par deux
// besoins qui posaient le même problème (décision du 01/08/2026, plan « cycle de vie du contrat ») :
//
// 1. Un contrat "a_verifier" (saisi de mémoire, pas encore adossé à un document officiel) qui
//    reçoit enfin son AEM/bulletin — le document doit se raccrocher à ce contrat plutôt que d'en
//    créer un second (cf. RevueExtraction.tsx, confirmation de correspondance).
// 2. Le risque de doublon déjà noté mais jamais construit sur le chantier `justificatif_declaration`
//    (cf. types/extraction.ts, commentaire « Risque de doublon ») : ce document arrive souvent
//    APRÈS que l'utilisateur ait déjà saisi ses contrats du mois à la main.
//
// Un seul mécanisme pour les deux, pas deux implémentations séparées du même problème.
import type { Contrat } from "../types";
import { joursChevauchement, moisCle } from "../engine/dateUtils";

export interface CandidatCorrespondance {
  employeur: string;
  date: string; // ISO, date de fin de contrat
  dateDebut: string; // ISO
  salaireBrut: number;
}

/**
 * Normalisation volontairement LÉGÈRE (casse, accents, espaces) — une tolérance de formatage, pas
 * une heuristique de devinette. Pas de correspondance floue/phonétique au-delà de ça : le SPEC
 * rejette déjà explicitement les heuristiques sur un nom d'employeur ailleurs dans le projet (cf.
 * la limite documentée sur la détection des profils mixtes) — même principe ici.
 */
function normaliserEmployeur(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "") // diacritiques (accents) une fois décomposés par NFD
    .replace(/\s+/g, " ");
}

/**
 * Contrats existants qui pourraient correspondre à `candidat` (un document nouvellement importé).
 * Critères, TOUS requis sauf le dernier :
 * - `statutVerification === "a_verifier"` : on ne propose une correspondance qu'avec un contrat
 *   qui attend justement une confirmation — pas avec un contrat déjà confirmé (qui n'a pas besoin
 *   d'être retrouvé) ni un contrat sans statut connu (données anciennes, aucune preuve qu'il attend
 *   quoi que ce soit).
 * - Employeur identique une fois normalisé.
 * - Même mois civil (réutilise `moisCle`, déjà la même notion de proximité que
 *   `cachetsParMois` dans engine/decompteHeures.ts) OU chevauchement réel des périodes.
 * - Montant : PAS un filtre — c'est justement ce qui peut légitimement diverger entre une saisie de
 *   mémoire et le document officiel (cf. plan validé) — seulement un signal de tri par proximité
 *   quand plusieurs candidats existent.
 *
 * Ne choisit JAMAIS automatiquement : réduit la liste à des candidats plausibles, la décision finale
 * reste une revue humaine (cf. RevueExtraction.tsx).
 */
export function trouverContratsCorrespondants(candidat: CandidatCorrespondance, contratsExistants: Contrat[]): Contrat[] {
  const employeurCandidat = normaliserEmployeur(candidat.employeur);
  const moisCandidat = moisCle(candidat.date);

  return contratsExistants
    .filter((c) => c.statutVerification === "a_verifier")
    .filter((c) => normaliserEmployeur(c.employeur) === employeurCandidat)
    .filter((c) => moisCle(c.date) === moisCandidat || joursChevauchement(c.dateDebut, c.date, candidat.dateDebut, candidat.date) > 0)
    .sort((a, b) => Math.abs(a.salaireBrut - candidat.salaireBrut) - Math.abs(b.salaireBrut - candidat.salaireBrut));
}
