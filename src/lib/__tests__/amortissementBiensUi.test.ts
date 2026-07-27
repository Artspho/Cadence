import { describe, it, expect } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { BienAmorti } from "../../types/fraisReels";
import { alertesContinuation, construireAmortissementsDossier, depasseSeuilAmortissement, modeDeduction } from "../amortissementBiensUi";
import { calculerAmortissementsAnnee } from "../../engine/fraisReels/calculerAmortissementsAnnee";

const ftConfig = franceTravailConfig;
const seuil = ftConfig.fraisReels.amortissements.seuilAmortissementHT;

let compteur = 0;
function bien(partiel: Partial<BienAmorti> & Pick<BienAmorti, "prixHT" | "dateAchat" | "dureeAns">): BienAmorti {
  compteur += 1;
  return { id: `bien-${compteur}`, designation: `Bien ${compteur}`, categorie: "instrument", tauxPro: 1, ...partiel };
}

describe("depasseSeuilAmortissement / modeDeduction", () => {
  it("au-dessus du seuil : amortissement obligatoire", () => {
    expect(depasseSeuilAmortissement(seuil + 0.01, ftConfig)).toBe(true);
    expect(modeDeduction(seuil + 100, ftConfig)).toBe("amortissement_obligatoire");
  });

  it("au seuil exactement et en-dessous : les deux options restent ouvertes", () => {
    expect(depasseSeuilAmortissement(seuil, ftConfig)).toBe(false);
    expect(modeDeduction(seuil, ftConfig)).toBe("choix_possible");
    expect(modeDeduction(10, ftConfig)).toBe("choix_possible");
  });

  it("lit le seuil depuis la config, sans valeur en dur", () => {
    const configModifiee = { ...ftConfig, fraisReels: { ...ftConfig.fraisReels, amortissements: { ...ftConfig.fraisReels.amortissements, seuilAmortissementHT: 2000 } } };
    expect(depasseSeuilAmortissement(1500, ftConfig)).toBe(true);
    expect(depasseSeuilAmortissement(1500, configModifiee)).toBe(false);
  });
});

describe("alertesContinuation", () => {
  it("un bien partiellement amorti déclenche l'alerte, avec la bonne anneeFin", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // anneeFin = 2027
    const alertes = alertesContinuation(calculerAmortissementsAnnee([b], 2025, ftConfig));
    expect(alertes).toHaveLength(1);
    expect(alertes[0].bien.id).toBe(b.id);
    expect(alertes[0].anneeFin).toBe(2027);
    expect(alertes[0].resteAAmortir).toBeGreaterThan(0);
  });

  it("un bien totalement amorti (reste = 0, dernière année) ne déclenche pas l'alerte", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 });
    const retour = calculerAmortissementsAnnee([b], 2027, ftConfig); // dernière année
    expect(retour.biensEnCours).toHaveLength(1);
    expect(retour.detail[0].resultat.resteAAmortir).toBe(0);
    expect(alertesContinuation(retour)).toEqual([]);
  });

  it("un bien soldé (hors scope) ne déclenche pas l'alerte", () => {
    const b = bien({ prixHT: 900, dateAchat: "2020-01-15", dureeAns: 3 });
    expect(alertesContinuation(calculerAmortissementsAnnee([b], 2025, ftConfig))).toEqual([]);
  });

  it("un bien pas encore commencé (achat futur) ne déclenche pas l'alerte", () => {
    const b = bien({ prixHT: 900, dateAchat: "2027-01-15", dureeAns: 3 });
    expect(alertesContinuation(calculerAmortissementsAnnee([b], 2025, ftConfig))).toEqual([]);
  });
});

describe("construireAmortissementsDossier", () => {
  it("liste vide : amortissements undefined, pas un objet vide", () => {
    expect(construireAmortissementsDossier([], 2025, ftConfig)).toBeUndefined();
  });

  it("expose biensEnCours et totalDeductible pour l'année demandée", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 });
    const dossier = construireAmortissementsDossier([b], 2025, ftConfig);
    expect(dossier?.biensEnCours).toHaveLength(1);
    expect(dossier?.totalDeductible).toBe(300);
  });

  it("le même bien produit encore une annuité les années suivantes, sans ressaisie", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 5 });
    for (const annee of [2025, 2026, 2027, 2028, 2029]) {
      expect(construireAmortissementsDossier([b], annee, ftConfig)?.totalDeductible).toBeGreaterThan(0);
    }
    expect(construireAmortissementsDossier([b], 2030, ftConfig)?.totalDeductible).toBe(0);
  });

  it("supprimer un bien retire ses annuités futures du calcul", () => {
    const b1 = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // annuité 300
    const b2 = bien({ prixHT: 600, dateAchat: "2025-01-15", dureeAns: 5 }); // annuité 120
    expect(construireAmortissementsDossier([b1, b2], 2026, ftConfig)?.totalDeductible).toBe(420);

    const apresSuppression = [b1];
    expect(construireAmortissementsDossier(apresSuppression, 2026, ftConfig)?.totalDeductible).toBe(300);
    expect(construireAmortissementsDossier(apresSuppression, 2027, ftConfig)?.biensEnCours.map((b) => b.id)).toEqual([b1.id]);
  });
});
