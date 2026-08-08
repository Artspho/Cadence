/**
 * Nombre d'abonnés payants actuels, et seuil auquel le prix de l'abonnement baisse — saisis à la
 * main par Benoît, même principe que `franceTravailConfig.ts` : Cadence n'a pas (encore) de système
 * de paiement intégré (pas de Stripe, pas de table d'abonnement dans Supabase), donc ce nombre ne
 * peut pas être compté automatiquement aujourd'hui. `nombreActuel: 0` n'est pas un placeholder
 * inventé — c'est le compte réel tant qu'aucun paiement n'est encore suivi.
 *
 * À mettre à jour ici à la main à mesure que des comptes paient l'abonnement (et à re-brancher sur
 * un vrai comptage le jour où un système de paiement existera).
 */
export const abonnesConfig = {
  nombreActuel: 0,
  /** Premier palier — 08/08/2026, confirmé par Benoît. */
  seuilProchaineReduction: 100,
};
