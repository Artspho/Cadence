// Textes du MOIS D'OUVERTURE PARTIEL de la série mensuelle : le mois où `dateOuverture` ne tombe pas
// le 1er du mois calendaire. Ce mois EST calculé par le moteur
// (engine/indemnisationMensuelle.ts, `calculerSerieDepuisContrats`), mais sur la seule fenêtre qui
// relève du nouveau droit — `dateOuverture` → fin du mois.
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
// Le RAPPEL du relevé officiel est commun aux deux cas depuis le 2026-07-28 : c'est la seule
// indication gratuite qui dit où trouver le chiffre qui fait foi.
//
// ⚠️ Les deux descriptions ont été RÉÉCRITES le 03/08/2026, et pas seulement retouchées. Elles
// disaient « traité ici comme un mois entier (approximation) », ce qui décrivait fidèlement le
// comportement de l'époque — l'affichage recalculait bel et bien ce mois sur 31 jours. Ce
// comportement était la cause du bug chiffré du point 21 (674,93 € d'ARE annoncés sur deux mois que
// les relevés chiffrent à 0) ; il a été supprimé. Conserver l'ancienne phrase reviendrait donc à
// décrire à l'utilisateur un calcul qui n'existe plus — le contraire de ce que ces textes servent à
// faire. Le mois est maintenant calculé sur sa vraie fenêtre : ce que ces libellés doivent dire,
// c'est ce que la fenêtre couvre, et ce qu'elle ne couvre pas.
const RAPPEL_RELEVE = "Consulte ton relevé France Travail pour le montant exact.";

const descriptionAvecDroitAnterieur =
  "Mois de réadmission — seuls les jours à partir de l'ouverture de tes droits sont comptés ici. Le début du mois relève de ton droit précédent, que Cadence ne connaît pas : son montant n'est pas inclus.";

const descriptionSansDroitAnterieur =
  "Mois d'ouverture de tes droits — seuls les jours à partir de l'ouverture sont comptés ici : ceux qui précèdent ne sont pas indemnisables.";

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
