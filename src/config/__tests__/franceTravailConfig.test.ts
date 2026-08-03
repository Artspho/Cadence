import { describe, expect, it } from "vitest";
import { franceTravailConfig, joursDepuisDerniereVerification } from "../franceTravailConfig";

// Ce fichier ne testait jusqu'au 03/08/2026 que `estPerime`, supprimée avec la bannière de
// péremption (point 13 de docs/critique_2026-08-03.md). Il teste maintenant le seul calcul de date
// qui reste dans la config.
//
// Rien ici ne vérifie que la config respecte son schéma Zod : ce serait redondant, le module
// s'auto-valide au chargement (`franceTravailConfigSchema.parse(franceTravailConfig)` en fin de
// fichier). Ce garde-fou est plus fort qu'un test — il casse aussi en production.
//
// ⚠️ Aucune date n'est écrite en dur ici : tout est calculé À PARTIR de la config. La routine de
// veille mensuelle met `dateDerniereVerification` à jour (docs/routine-mensuelle-veille.md) ; des
// dates figées dans ces tests les feraient échouer à chaque passage, alors que la fonction serait
// intacte. Un test qui rougit sans qu'aucun code ne soit cassé est un faux signal.
const { dateDerniereVerification, dateEntreeVigueur } = franceTravailConfig.meta;

/** La date de dernière vérification décalée de `n` jours (n négatif = avant). */
function verificationPlus(n: number): Date {
  const d = new Date(dateDerniereVerification);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

describe("joursDepuisDerniereVerification", () => {
  // Le sens même de la fonction : elle compte depuis `dateDerniereVerification`, PAS depuis
  // `dateEntreeVigueur` (l'entrée en vigueur du SMIC configuré). C'est tout l'objet du point 14.
  it("compte depuis la date de dernière vérification, pas depuis l'entrée en vigueur", () => {
    // Les deux dates disent deux choses différentes ; si elles devenaient identiques en config, le
    // test ci-dessous ne prouverait plus rien — d'où cette garde.
    expect(dateDerniereVerification).not.toBe(dateEntreeVigueur);

    expect(joursDepuisDerniereVerification(new Date(dateDerniereVerification))).toBe(0);
    // Le jour de l'entrée en vigueur du SMIC n'est pas le jour de la vérification : le compteur ne
    // peut donc pas y valoir 0. Si le calcul repartait du mauvais champ, ce serait l'inverse.
    expect(joursDepuisDerniereVerification(new Date(dateEntreeVigueur))).not.toBe(0);
  });

  it("rend le nombre de jours révolus, jamais arrondi au-dessus", () => {
    expect(joursDepuisDerniereVerification(verificationPlus(1))).toBe(1);
    expect(joursDepuisDerniereVerification(verificationPlus(10))).toBe(10);

    // 23 h après la vérification : le jour n'est pas révolu, donc 0 — pas 1.
    const presqueUnJour = new Date(dateDerniereVerification);
    presqueUnJour.setUTCHours(presqueUnJour.getUTCHours() + 23);
    expect(joursDepuisDerniereVerification(presqueUnJour)).toBe(0);
  });

  // `dateDuJour` est un paramètre et jamais un `new Date()` interne : c'est ce qui rend la fonction
  // testable, et ce qui garantit qu'elle ne dépend pas de l'horloge de la machine.
  it("ne lit jamais l'horloge : deux appels avec la même date donnent le même résultat", () => {
    const date = verificationPlus(29);
    expect(joursDepuisDerniereVerification(date)).toBe(joursDepuisDerniereVerification(date));
  });
});
