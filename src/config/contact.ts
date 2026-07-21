/**
 * Coordonnées de contact pour la bêta (§11.A — bouton de feedback). Pas une
 * valeur réglementaire, mais même discipline que `valeursDatees`/`valableJusquau` :
 * `null` tant que non renseigné, jamais un placeholder qui ressemble à une
 * vraie adresse. Le feedback ne s'affiche NULLE PART (TopBar, À propos) tant
 * que cette valeur est `null` — maintenant comme plus tard.
 */
export const EMAIL_FEEDBACK: string | null = "benoit.zahra@orange.fr";

const SUJET_FEEDBACK = "Retour sur Cadence";
const CORPS_FEEDBACK = "Ce que je faisais : \n\nCe que j'attendais : \n\nCe qui s'est passé : \n";

/**
 * Construit un lien mailto: pur. Sujet et gabarit de corps fixes, neutres,
 * vides — le seul paramètre est l'adresse elle-même : structurellement,
 * aucune donnée utilisateur (contrats, profil, statut) ne peut s'y glisser,
 * cette fonction n'y a simplement pas accès.
 */
export function construireLienFeedback(email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(SUJET_FEEDBACK)}&body=${encodeURIComponent(CORPS_FEEDBACK)}`;
}
