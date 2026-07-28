// Textes du MOIS D'OUVERTURE PARTIEL de la série mensuelle : le mois où `dateOuverture` ne tombe pas
// le 1er du mois calendaire, donc jamais simulé par le moteur
// (engine/indemnisationMensuelle.ts, `calculerSerieDepuisContrats`) et recalculé comme un mois
// entier à l'affichage (RevenusMensuels.tsx, `construireLignesAffichage`).
//
// Deux libellés, parce que la CAUSE du caractère partiel n'est pas la même :
// - `avecDroitAnterieur` (réadmission) : le mois est partagé entre l'ancien et le nouveau droit, et
//   Cadence n'a structurellement pas accès à l'ancien.
// - `sansDroitAnterieur` (première admission) : il n'y a aucun droit antérieur à partager — les
//   jours qui précèdent l'ouverture ne sont simplement pas indemnisables, et Cadence ne les connaît
//   pas. Affirmer un partage entre deux droits y serait faux (devoir n°2).
//
// Le déclencheur reste purement calendaire ; c'est `profil.situation` qui décide du TEXTE, seul
// endroit où ce champ dit réellement quelque chose ici : y a-t-il eu un droit précédent, oui ou non.
//
// Source unique : jusqu'au 2026-07-28 ce fait était rédigé DEUX fois, avec deux contenus différents
// — un `messageTooltip` produit par le moteur (« …jamais simulé, consulte ton relevé France
// Travail ») que personne n'affichait, et un `title` codé en dur dans RevenusMensuels.tsx
// (« …traité ici comme un mois entier ») qui était le seul réellement visible. C'est ce dernier qui
// décrit correctement ce que l'utilisateur a sous les yeux (l'affichage recalcule bien ce mois comme
// un mois entier) : sa description est donc reprise mot pour mot ci-dessous.
//
// En revanche le RAPPEL du relevé officiel, lui, n'existait que dans la version morte côté moteur —
// donc jamais affiché à personne, ni en réadmission ni en première admission. Il est réintégré ici
// (2026-07-28, sur demande explicite) : c'est la seule indication gratuite qui dit où trouver le vrai
// chiffre d'un mois que Cadence ne sait pas simuler. Conséquence assumée : le libellé de réadmission
// n'est plus identique au caractère près à celui d'avant le chantier — il est strictement augmenté
// (la description d'origine reste son préfixe exact, ce que le test vérifie).
const RAPPEL_RELEVE = "Consulte ton relevé France Travail pour le montant exact.";

const descriptionAvecDroitAnterieur = "Mois de réadmission — partagé entre deux droits, traité ici comme un mois entier (approximation).";

const descriptionSansDroitAnterieur =
  "Mois d'ouverture de tes droits — traité ici comme un mois entier (approximation) : les jours qui précèdent l'ouverture ne sont pas indemnisables, et Cadence ne sait pas les distinguer.";

export const MOIS_OUVERTURE_PARTIELLE = {
  /** Rappel du document officiel, commun aux deux cas — jamais reformulé ailleurs. */
  rappelReleve: RAPPEL_RELEVE,
  /** Descriptions seules, sans le rappel : exposées pour les tests de non-régression. */
  descriptionAvecDroitAnterieur,
  descriptionSansDroitAnterieur,
  avecDroitAnterieur: `${descriptionAvecDroitAnterieur} ${RAPPEL_RELEVE}`,
  sansDroitAnterieur: `${descriptionSansDroitAnterieur} ${RAPPEL_RELEVE}`,
} as const;

/**
 * Libellé COMPLET (description + rappel du relevé) du mois d'ouverture partiel, selon qu'un droit
 * antérieur existe (réadmission) ou non. Destiné au tooltip de la ligne concernée, qui est lu hors de
 * tout contexte : il doit se suffire à lui-même, rappel compris.
 */
export function messageMoisOuverturePartielle(avecDroitAnterieur: boolean): string {
  return avecDroitAnterieur ? MOIS_OUVERTURE_PARTIELLE.avecDroitAnterieur : MOIS_OUVERTURE_PARTIELLE.sansDroitAnterieur;
}

/**
 * Description SEULE, sans le rappel du relevé — pour la note de bas de tableau, qui enchaîne déjà sur
 * la limite d'approximation puis sur le teaser Premium (« Montant exact disponible en Premium… »). Y
 * répéter « Consulte ton relevé France Travail pour le montant exact » créerait un doublon de
 * vocabulaire à 30 mots d'écart, et deux conseils en tension sur où trouver le montant exact. Le
 * rappel reste porté par le tooltip, où il est seul et utile.
 */
export function descriptionMoisOuverturePartielle(avecDroitAnterieur: boolean): string {
  return avecDroitAnterieur ? MOIS_OUVERTURE_PARTIELLE.descriptionAvecDroitAnterieur : MOIS_OUVERTURE_PARTIELLE.descriptionSansDroitAnterieur;
}
