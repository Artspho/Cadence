// Source de texte UNIQUE de la contradiction « Annexe 10 pur déclaré + salaires hors A10 > 0 »
// (motif `salaires_hors_a10_contradictoires`, cf. lib/profilHorsPerimetre.ts).
//
// Pourquoi une seule source : ce même fait était rédigé deux fois — dans l'alerte du centre
// d'alertes (engine/alertes.ts) et dans le bandeau dédié
// (components/AvertissementContradictionHorsA10.tsx) — et les deux libellés avaient DÉJÀ divergé :
// « l'allocation estimée n'est pas fiable » d'un côté, « l'allocation journalière et la projection
// sont masquées » de l'autre. Deux descriptions différentes du même masquage, dont une seule pouvait
// être exacte : exactement le genre d'écart qui fait douter l'utilisateur de ce qui est réellement
// masqué (devoir n°2). Désormais les deux composants lisent ces chaînes, ils ne peuvent plus
// diverger.
//
// Texte BRUT volontairement : ni fragments accentués, ni balisage à parser. L'emphase reste
// l'affaire du composant (classes CSS sur le titre/badge), le contenu reste une chaîne réutilisable
// telle quelle par un composant React comme par une Alerte du moteur, qui ne connaît que des
// `string`.
const constatation =
  "Tu as déclaré relever uniquement de l'Annexe 10, mais tu as renseigné des salaires perçus hors Annexe 10 (technicien Annexe 8, régime général…). Ces deux informations ne peuvent pas être vraies en même temps.";

const consequence =
  "Tant que c'est le cas, l'allocation journalière et la projection sont masquées : si c'est bien ton régime déclaré qui est faux, elles seraient calculées avec les mauvaises règles. Le reste de Cadence reste utilisable — tu peux continuer à saisir tes contrats.";

export const CONTRADICTION_HORS_A10 = {
  titre: "Deux saisies se contredisent",
  constatation,
  consequence,
  /** Message de l'alerte moteur : constatation + conséquence, pour que l'alerte reste autonome et
   * exacte partout où elle serait affichée sans le bandeau (aujourd'hui elle alimente au minimum le
   * compteur d'alertes critiques, visible sur tous les onglets, cf. lib/alertesAffichage.ts). */
  messageAlerte: `${constatation} ${consequence}`,
  /** Action, formulée pour une alerte (préfixée « → » par AlertCenter). */
  action: "Ouvre « Mon profil » pour corriger l'une des deux : ton régime déclaré, ou le montant des salaires hors Annexe 10.",
  /** Même action, formulée pour le bouton du bandeau, qui bascule lui-même sur l'onglet. */
  libelleBouton: "Ouvrir « Mon profil » pour corriger l'une des deux saisies →",
} as const;
