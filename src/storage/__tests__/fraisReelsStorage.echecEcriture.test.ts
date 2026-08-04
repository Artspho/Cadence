// @vitest-environment jsdom
//
// Point 2 de docs/critique_2026-08-03.md, porte oubliée par la fiche. Elle ne visait que
// `localStorageAdapter.ts` et `App.tsx` ; or `sauvegarderFraisReels` et `sauvegarderBiensAmortis`
// faisaient un `setItem` NU, et leurs deux appelants (`FraisReels.tsx`, des `useEffect`) n'attendaient
// pas la promesse. Un stockage plein partait donc en rejet de promesse **non traité** : la dépense
// disparaissait sans un mot, écran inchangé — le devoir sacré n°1 violé exactement comme au point 2,
// mais sur l'écran où les justificatifs (base64, gros) saturent réellement le stockage.
//
// Même dispositif de simulation que chargementEtSauvegarde.test.ts : espion sur `Storage.prototype`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chargerFraisReels, sauvegarderBiensAmortis, sauvegarderFraisReels, type DonneesFraisReels } from "../fraisReelsStorage";
import type { BienAmorti } from "../../types/fraisReels";

const DONNEES: DonneesFraisReels = {
  config: null,
  depenses: [
    {
      id: "d1",
      anneeFiscale: 2026,
      date: "2026-03-10",
      categorie: "C1",
      description: "Péage",
      montantTotal: 12.5,
      remboursementEmployeur: 0,
      partPro: 1,
      montantDeductible: 12.5,
      statutJustificatif: "fourni",
    },
  ],
};

const BIENS: BienAmorti[] = [{ id: "b1", designation: "Violon", categorie: "instrument", prixHT: 4000, dateAchat: "2026-01-15", dureeAns: 5, tauxPro: 1 }];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("sauvegarderFraisReels — un échec d'écriture se dit, il ne se perd pas", () => {
  it("écriture réussie : verdict ok, et les données sont bien relues", async () => {
    expect(await sauvegarderFraisReels(2026, DONNEES)).toEqual({ ok: true });
    expect((await chargerFraisReels(2026)).depenses).toHaveLength(1);
  });

  it("stockage plein : verdict ok:false avec l'erreur brute du navigateur, jamais une exception qui se perd", async () => {
    simulerStockagePlein();
    const resultat = await sauvegarderFraisReels(2026, DONNEES);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    // Le message porte l'erreur du navigateur telle quelle : c'est elle qui s'affiche dans le bandeau,
    // et la reformuler risquerait d'annoncer une cause fausse.
    expect(resultat.message).toMatch(/Quota/i);
  });

  it("stockage plein : les données de l'exercice déjà enregistrées ne sont pas abîmées", async () => {
    await sauvegarderFraisReels(2026, DONNEES);
    const avant = window.localStorage.getItem("cadence_frais_reels_2026");

    simulerStockagePlein();
    await sauvegarderFraisReels(2026, { ...DONNEES, depenses: [...DONNEES.depenses, { ...DONNEES.depenses[0], id: "d2" }] });
    vi.restoreAllMocks();

    expect(window.localStorage.getItem("cadence_frais_reels_2026")).toBe(avant);
  });
});

describe("sauvegarderBiensAmortis — même verdict, même exigence", () => {
  it("écriture réussie : verdict ok", async () => {
    expect(await sauvegarderBiensAmortis(BIENS)).toEqual({ ok: true });
  });

  it("stockage plein : verdict ok:false, pas un rejet silencieux", async () => {
    // Un bien amorti perdu en silence, c'est une annuité qui manquera pendant cinq ans à la
    // déclaration — et personne pour s'apercevoir qu'elle a disparu le jour de la saisie.
    simulerStockagePlein();
    const resultat = await sauvegarderBiensAmortis(BIENS);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.message).toMatch(/Quota/i);
  });
});

/** Voir chargementEtSauvegarde.test.ts : l'espion doit porter sur `Storage.prototype`, pas sur l'instance. */
function simulerStockagePlein() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  });
}
