import type { Contrat } from "../types";

/**
 * Le dashboard est-il "vide" (compte neuf) ? Se déclenche sur l'ABSENCE de
 * contrat, jamais sur "0 heure comptée au montant" — un profil 100 %
 * enseignement a des contrats mais 0 h au montant ARE (exclu par
 * salaireReference.ts) ; ce n'est PAS un compte vide, son dashboard doit
 * vivre normalement. Pas de logique réglementaire ici, juste une présence
 * de données.
 */
export function dashboardEstVide(contrats: Contrat[]): boolean {
  return contrats.length === 0;
}
