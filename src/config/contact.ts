/**
 * Coordonnées de contact pour la bêta (§11.A — bouton de feedback). Pas une
 * valeur réglementaire, mais même discipline que `franceTravailConfig.valeursDatees` :
 * `null` tant que non renseigné, jamais un placeholder qui ressemble à une
 * vraie adresse. Le feedback ne s'affiche NULLE PART (TopBar, Mon profil) tant
 * que cette valeur est `null` — maintenant comme plus tard.
 *
 * Rappel de contexte (cf. `franceTravailConfig.meta.avertissement`) : ce lien ne sert qu'à
 * recueillir un avis sur l'app elle-même. Cadence reste une estimation indicative qui ne se
 * substitue jamais à une notification officielle de France Travail, et ne couvre que le régime
 * Annexe 10 — pour une question sur ses droits, direction France Travail, pas ce mail.
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
