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
// un mois entier) : il est donc conservé mot pour mot comme libellé de référence.
export const MOIS_OUVERTURE_PARTIELLE = {
  avecDroitAnterieur: "Mois de réadmission — partagé entre deux droits, traité ici comme un mois entier (approximation).",
  sansDroitAnterieur:
    "Mois d'ouverture de tes droits — traité ici comme un mois entier (approximation) : les jours qui précèdent l'ouverture ne sont pas indemnisables, et Cadence ne sait pas les distinguer.",
} as const;

/** Libellé du mois d'ouverture partiel selon qu'un droit antérieur existe (réadmission) ou non. */
export function messageMoisOuverturePartielle(avecDroitAnterieur: boolean): string {
  return avecDroitAnterieur ? MOIS_OUVERTURE_PARTIELLE.avecDroitAnterieur : MOIS_OUVERTURE_PARTIELLE.sansDroitAnterieur;
}
