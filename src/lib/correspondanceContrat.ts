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
 * - `statutVerification !== "confirme"` : on exclut seulement un contrat déjà EXPLICITEMENT
 *   confirmé par un document (qui n'a pas besoin d'être retrouvé une seconde fois). Corrigé le
 *   01/08/2026 (bug réel trouvé en testant sur les vrais contrats de Benoît) : le filtre exigeait
 *   auparavant `=== "a_verifier"`, ce qui excluait SILENCIEUSEMENT tout contrat sans
 *   `statutVerification` du tout — soit la totalité des contrats créés avant l'ajout de ce champ
 *   (01/08/2026, plan « cycle de vie du contrat »). Un réimport de document (ex. justificatif de
 *   déclaration mensuelle) sur ces contrats-là ne détectait donc jamais aucun doublon potentiel.
 *   `statutVerification` absent est traité comme équivalent à `"a_verifier"` UNIQUEMENT pour cette
 *   détection — jamais réécrit sur le contrat lui-même (devoir n°1 : rien n'est renseigné
 *   rétroactivement, cf. types/index.ts).
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
    .filter((c) => c.statutVerification !== "confirme")
    .filter((c) => normaliserEmployeur(c.employeur) === employeurCandidat)
    .filter((c) => moisCle(c.date) === moisCandidat || joursChevauchement(c.dateDebut, c.date, candidat.dateDebut, candidat.date) > 0)
    .sort((a, b) => Math.abs(a.salaireBrut - candidat.salaireBrut) - Math.abs(b.salaireBrut - candidat.salaireBrut));
}

/**
 * Diagnostic PUREMENT INFORMATIF, appelé UNIQUEMENT quand `trouverContratsCorrespondants` renvoie
 * un tableau vide — jamais une seconde façon de proposer une correspondance (ce serait dupliquer la
 * décision), seulement une piste sur POURQUOI rien n'est remonté. Un « aucune correspondance »
 * silencieux peut recouvrir des causes très différentes (cas réel du 01/08/2026 : un contrat
 * existant "LEVALLOIS" n'a jamais matché un document "COMMUNE DE LEVALLOIS PERRET", pas par bug
 * mais par écart de nom — indiscernable depuis l'écran sans relire le code). Ne choisit et n'écrit
 * jamais rien : `RevueExtraction.tsx` affiche le résultat, ne pré-coche aucune action.
 *
 * Trois issues possibles, dans cet ordre de priorité :
 * - `"deja_confirme"` : un contrat du même employeur et de la même période existe, mais il est déjà
 *   `"confirme"` — exactement le seul cas qu'exclut `trouverContratsCorrespondants` (cf. son
 *   commentaire) : rien d'anormal, ce contrat n'a pas besoin d'être retrouvé une seconde fois.
 * - `"nom_different_meme_mois"` : un contrat de la même période existe, mais son employeur normalisé
 *   diffère de celui du document — le signe le plus probable d'un écart de saisie (raccourci,
 *   orthographe), PAS une preuve : reste à l'utilisateur de juger, jamais une fusion automatique.
 * - `"aucune_piste"` : rien n'explique l'absence — vraisemblablement un contrat qui n'existe
 *   simplement pas encore dans le profil.
 */
export type DiagnosticAbsenceCorrespondance =
  | { type: "deja_confirme"; contratExistant: Contrat }
  // `employeurDocument` : le nom TEL QU'ÉCRIT sur le document (candidat.employeur, pas sa forme
  // normalisée) — pour que l'utilisateur puisse comparer les deux graphies telles qu'il les
  // reconnaît, exactement le rapprochement qui a permis de repérer le cas réel LEVALLOIS.
  | { type: "nom_different_meme_mois"; contratExistant: Contrat; employeurDocument: string }
  | { type: "aucune_piste" };

export function diagnostiquerAbsenceCorrespondance(candidat: CandidatCorrespondance, contratsExistants: Contrat[]): DiagnosticAbsenceCorrespondance {
  const employeurCandidat = normaliserEmployeur(candidat.employeur);
  const memePeriode = (c: Contrat) => moisCle(c.date) === moisCle(candidat.date) || joursChevauchement(c.dateDebut, c.date, candidat.dateDebut, candidat.date) > 0;

  const dejaConfirme = contratsExistants.find((c) => c.statutVerification === "confirme" && normaliserEmployeur(c.employeur) === employeurCandidat && memePeriode(c));
  if (dejaConfirme) return { type: "deja_confirme", contratExistant: dejaConfirme };

  const nomDifferent = contratsExistants.find((c) => normaliserEmployeur(c.employeur) !== employeurCandidat && memePeriode(c));
  if (nomDifferent) return { type: "nom_different_meme_mois", contratExistant: nomDifferent, employeurDocument: candidat.employeur };

  return { type: "aucune_piste" };
}
