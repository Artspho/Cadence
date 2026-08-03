// Règle d'intégrité : un contrat ne couvre JAMAIS deux mois civils.
//
// POURQUOI. Chaque mois se déclare séparément à France Travail. Un engagement qui court du 20/02 au
// 10/03 donne donc deux déclarations, pas une — et doit être saisi dans Cadence comme deux contrats,
// un par mois. Ce n'est pas une commodité de calcul : c'est la forme que prennent les relevés qui
// servent de référence à toute l'app.
//
// CE QUE ÇA REMPLACE. Point 7 de docs/critique_2026-08-03.md : l'alerte « plafond de cachets
// dépassé » pouvait annoncer « 30 cachets en mars » là où la réalité était 15 + 15, parce que
// engine/decompteHeures.ts attribuait TOUS les cachets d'un contrat au mois de sa date de FIN. Deux
// correctifs ont été envisagés puis écartés, et il vaut la peine de dire pourquoi :
//   - répartir au prorata des jours calendaires — inventerait une règle que docs/SPEC.md:534 range
//     explicitement parmi les cas de bord NON sourcés, et pourrait produire une AUTRE fausse alerte
//     (un contrat 25/02→05/03 de 28 cachets prorate à 15,6 en mars ; ajouté à 15 cachets réels, il
//     annoncerait « 30,6 en mars » alors que les 28 ont pu être joués en février) ;
//   - afficher une fourchette « entre X et Y cachets » — gérerait une ambiguïté qui n'a pas lieu
//     d'être, puisque la donnée ambiguë ne devrait jamais entrer.
// La bonne réponse est en amont : empêcher la saisie ambiguë. `moisCle(contrat.date)` redevient alors
// exact par construction, et le calcul n'a plus rien à deviner.
//
// OÙ ELLE S'APPLIQUE. À l'ÉCRITURE d'un contrat, jamais à la LECTURE des contrats déjà enregistrés
// (devoir sacré n°1) :
//   - pas dans le schéma Zod de lecture, sous peine de rendre illisible un fichier légitime ;
//   - pas non plus dans `donneesAppSchemaEcriture` (localStorageAdapter.ts), qui valide le jeu de
//     données ENTIER à chaque sauvegarde : un seul contrat à cheval hérité y rendrait l'app incapable
//     de sauvegarder quoi que ce soit, soit le devoir n°1 violé en miroir.
// Elle est donc appliquée là où l'on ne voit qu'UN contrat, celui qu'on est en train d'écrire :
// `ajouterContrat` / `modifierContrat` / `ajouterContratsRecurrents` dans App.tsx, seul point de
// passage commun à toutes les portes d'écriture (formulaire, import de bulletin, revue d'extraction
// IA, édition depuis la liste). Le formulaire bloque en plus à la saisie, pour expliquer avant de
// refuser — mais c'est le garde d'App.tsx qui ferme réellement la porte, sinon un contrat à cheval
// rentrerait par l'IA ou l'import pendant que le formulaire React, lui, refuse poliment.
//
// Vérifié le 03/08/2026 sur les 62 contrats restaurés de docs/cadence-fusion-2026-08-03.json : aucun
// ne couvre deux mois civils. La règle ne condamne donc aucune donnée existante légitime.
//
// À noter : lib/contratRecurrent.ts génère déjà des contrats calés sur le mois (`dateDebut` = 1er du
// mois, `date` = fin du mois, « engagement mensuel complet ») — cette règle formalise une intention
// qui existait déjà dans le générateur récurrent, elle ne l'invente pas.
import type { Contrat } from "../types";
import { moisCle } from "../engine/dateUtils";

/** Message unique, affiché partout où un contrat à cheval est refusé — jamais réécrit ailleurs. */
export const MESSAGE_CONTRAT_DEUX_MOIS =
  "Ce contrat s'étend sur deux mois — déclare-le en deux contrats séparés, un par mois, comme sur ton relevé France Travail.";

/**
 * `true` si le contrat couvre deux mois civils ou plus. Ne prend que les deux dates : utilisable sur
 * un contrat déjà créé comme sur un brouillon de formulaire (`Omit<Contrat, "id">`).
 */
export function contratSurPlusieursMois(contrat: Pick<Contrat, "dateDebut" | "date">): boolean {
  // Un `dateDebut` vide (brouillon de formulaire pas encore rempli) n'est pas une violation : c'est
  // une saisie incomplète, traitée ailleurs par les validations d'obligation du formulaire. Ne jamais
  // refuser un contrat pour une raison qui n'est pas la vraie (devoir n°2 côté messages d'erreur).
  if (!contrat.dateDebut || !contrat.date) return false;
  return moisCle(contrat.dateDebut) !== moisCle(contrat.date);
}

/**
 * Verdict d'écriture pour un lot de contrats (un seul, ou toute une série récurrente). Même forme que
 * `validerProfilPourEcriture` (lib/coherenceProfil.ts) et même intention : la DÉCISION vit dans une
 * fonction pure, testable sans rendre l'app, et App.tsx ne fait que la brancher à son état. Sans ça,
 * le seul vrai rempart d'écriture ne serait vérifiable qu'en pilotant l'interface — précisément le
 * reproche du point 12 quater de la critique (un test qui ne valide pas le chemin de production).
 */
export function validerContratsPourEcriture(contrats: Pick<Contrat, "dateDebut" | "date">[]): { ok: true } | { ok: false; message: string } {
  if (contrats.some(contratSurPlusieursMois)) return { ok: false, message: MESSAGE_CONTRAT_DEUX_MOIS };
  return { ok: true };
}
