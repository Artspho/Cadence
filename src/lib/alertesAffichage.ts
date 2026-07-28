import type { Alerte } from "../types";

export interface AffichageCentreAlertes {
  /** Alertes à passer à `AlertCenter` (ordre d'origine préservé). */
  alertes: Alerte[];
  /** Faut-il monter `AlertCenter` du tout ? Cf. le piège du faux « Aucune alerte » ci-dessous. */
  afficherCentre: boolean;
}

/**
 * Que doit afficher le centre d'alertes sur l'écran courant, sachant qu'un bandeau dédié y est
 * peut-être déjà rendu ?
 *
 * Le cas traité : la contradiction « A10 pur déclaré + salaires hors A10 > 0 » était visible DEUX
 * fois de suite sur le tableau de bord — une fois par l'alerte du centre d'alertes, une fois par
 * `AvertissementContradictionHorsA10`. Le bandeau est strictement plus riche (il porte le bouton qui
 * bascule sur « Mon profil ») : c'est donc l'alerte, doublon appauvri, qui cède l'écran.
 *
 * Deux décisions à ne pas défaire par inadvertance :
 *
 * 1. **Le filtrage est ici, à l'AFFICHAGE — jamais dans `detecterAlertes`.** L'alerte doit continuer
 *    d'exister dans le modèle : le compteur d'alertes critiques (App.tsx, `AlertCenterResume`) est
 *    affiché sur TOUS les onglets, y compris les trois qui ne portent aucun bandeau (Contrats,
 *    Import PDF, Frais pro) — il y est le seul signal de la contradiction. La retirer du moteur
 *    rendrait la contradiction totalement invisible sur ces écrans.
 * 2. **Jamais « ✓ Aucune alerte pour l'instant » à côté d'un bandeau critique.** `AlertCenter`
 *    affiche ce message dès que sa liste est vide ; or la contradiction est souvent la seule alerte
 *    d'un profil. Filtrer sans plus de précaution afficherait donc un feu vert juste au-dessus d'un
 *    bandeau rouge (devoir sacré n°2). D'où `afficherCentre: false` quand il ne reste rien : c'est le
 *    bandeau qui tient le rôle du centre d'alertes sur cet écran.
 */
export function centreAlertesPourEcran(alertes: Alerte[], bandeauContradictionAffiche: boolean): AffichageCentreAlertes {
  if (!bandeauContradictionAffiche) {
    return { alertes, afficherCentre: true };
  }
  const restantes = alertes.filter((a) => a.code !== "salaires_hors_a10_contradictoires");
  return { alertes: restantes, afficherCentre: restantes.length > 0 };
}
