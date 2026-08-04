// Règle d'intégrité de SAISIE : aucun champ numérique de Cadence n'accepte une valeur négative.
//
// POURQUOI. Aucune grandeur manipulée par l'app n'a de sens en négatif — des heures, des cachets, des
// jours, des kilomètres, des mètres carrés, des euros de salaire ou d'allocation. Décision de Benoît
// le 04/08/2026 : « ça n'a pas de sens ». Ce n'est PAS un jugement de vraisemblance (le point 10,
// écarté, porte sur la justesse d'un chiffre plausible : 2 000 € de salaire, 500 €/cachet) mais une
// impossibilité structurelle — la distinction est explicite dans la fiche du point 10.
//
// CE QUE `min="0"` NE FAISAIT PAS, et c'est tout le sujet. Les 24 champs numériques de l'app portent
// déjà `min="0"` (ou `min="1"`), mais cet attribut n'agit QUE lors de la soumission d'un `<form>` :
//   - dans un vrai formulaire (ContractForm, ContractFormRecurrent, DepenseForm, AmortissementBiens),
//     le navigateur bloque effectivement l'enregistrement. Vérifié à l'écran le 04/08/2026 : saisir
//     −3 jours EEE et cliquer « Enregistrer » n'ajoute aucun contrat ;
//   - dans les écrans qui écrivent À LA FRAPPE, sans `<form>` ni bouton de soumission — Frais réels
//     (revenu imposable, surfaces du local pro, repas, barème kilométrique) et Mon profil —
//     `min="0"` est purement décoratif. La valeur négative entre dans le modèle, est persistée, et
//     ressort dans un calcul.
// Mesuré à l'écran, sur le vrai écran Frais pro : un salaire net imposable saisi à −5 000 € affiche
// **« Base R = -5000.00 € »** et se stocke dans `cadence_frais_reels_2026`. Base R sert aux forfaits
// 14 % et 5 % : un chiffre faux, affiché sans réserve — devoir sacré n°2.
//
// COMMENT. La frappe qui rendrait la valeur négative est IGNORÉE : le modèle n'est pas mis à jour,
// donc le champ (contrôlé) réaffiche la valeur précédente. Deux raisons de ne PAS ramener
// silencieusement à 0 :
//   - écrire 0 là où l'utilisateur a tapé −5 serait remplacer sa saisie par une autre valeur, sans le
//     dire — exactement le reproche fait ailleurs aux « corrections » silencieuses ;
//   - un champ qui refuse la frappe se comprend immédiatement, sans message à maintenir (Benoît a
//     refusé un bandeau de plus au point 13).
//
// ⚠️ CE GARDE NE TOUCHE PAS AUX DONNÉES DÉJÀ ENREGISTRÉES. Une valeur négative héritée (import JSON,
// saisie antérieure) reste lue et calculée telle quelle : on ne réécrit jamais les données de
// l'utilisateur à la lecture (devoir n°1). Fermer aussi cette porte relève des bornes structurelles à
// l'écriture — non demandé le 04/08/2026, à traiter séparément et sciemment, pas en passant.

/**
 * `true` si la valeur brute d'un `<input type="number">` représente un nombre strictement négatif.
 *
 * À utiliser en garde au début d'un `onChange` : `if (estSaisieNegative(e.target.value)) return;`
 *
 * Les cas non numériques renvoient `false` — ils ne sont pas des négatifs et ne doivent pas être
 * traités comme tels :
 *   - chaîne vide : c'est un champ qu'on vide, geste légitime que les appelants traduisent déjà par 0 ;
 *   - saisie en cours invalide : un `<input type="number">` renvoie `""` tant que la valeur n'est pas
 *     un nombre complet (taper « - » seul donne `""`, jamais `"-"`), donc bloquer ici empêcherait de
 *     commencer à taper.
 */
export function estSaisieNegative(valeur: string): boolean {
  // `NaN < 0` vaut `false` : les cas non numériques ci-dessus sont donc écartés par la comparaison
  // elle-même, sans test supplémentaire. Ne pas ajouter de `Number.isFinite` ici — ce serait laisser
  // passer `-Infinity`, seule valeur négative que le garde manquerait alors.
  return parseFloat(valeur) < 0;
}
