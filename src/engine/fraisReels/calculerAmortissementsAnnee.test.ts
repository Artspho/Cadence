import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import type { BienAmorti } from "../../types/fraisReels";
import { calculerAmortissementsAnnee } from "./calculerAmortissementsAnnee";

let compteur = 0;
function bien(partiel: Partial<BienAmorti> & Pick<BienAmorti, "prixHT" | "dateAchat" | "dureeAns">): BienAmorti {
  compteur += 1;
  return {
    id: `bien-${compteur}`,
    designation: `Bien ${compteur}`,
    categorie: "instrument",
    tauxPro: 1,
    ...partiel,
  };
}

describe("calculerAmortissementsAnnee", () => {
  it("1. liste vide : totalDeductible 0, toutes les listes vides", () => {
    const r = calculerAmortissementsAnnee([], 2025, franceTravailConfig);
    expect(r.totalDeductible).toBe(0);
    expect(r.detail).toEqual([]);
    expect(r.biensFuturs).toEqual([]);
    expect(r.biensSoldes).toEqual([]);
    expect(r.biensEnCours).toEqual([]);
    expect(r.aContinuerAnneeSuivante).toEqual([]);
  });

  it("2. bien en première année : dans biensEnCours, estPremiereAnnee true", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 });
    const r = calculerAmortissementsAnnee([b], 2025, franceTravailConfig);
    expect(r.biensEnCours).toEqual([b]);
    expect(r.detail[0].resultat.estPremiereAnnee).toBe(true);
    expect(r.totalDeductible).toBe(300);
  });

  it("3. bien soldé (anneeImposition après anneeFin) : dans biensSoldes, ne contribue pas au total", () => {
    const b = bien({ prixHT: 900, dateAchat: "2020-01-15", dureeAns: 3 }); // anneeFin = 2022
    const r = calculerAmortissementsAnnee([b], 2025, franceTravailConfig);
    expect(r.biensSoldes).toEqual([b]);
    expect(r.biensEnCours).toEqual([]);
    expect(r.totalDeductible).toBe(0);
  });

  it("4. bien pas encore commencé (achat futur) : dans biensFuturs", () => {
    const b = bien({ prixHT: 900, dateAchat: "2027-01-15", dureeAns: 3 });
    const r = calculerAmortissementsAnnee([b], 2025, franceTravailConfig);
    expect(r.biensFuturs).toEqual([b]);
    expect(r.biensEnCours).toEqual([]);
    expect(r.totalDeductible).toBe(0);
  });

  it("5. deux biens actifs la même année : totalDeductible = somme des deux annuités", () => {
    const b1 = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // annuité 300
    const b2 = bien({ prixHT: 600, dateAchat: "2025-01-15", dureeAns: 5 }); // annuité 120
    const r = calculerAmortissementsAnnee([b1, b2], 2025, franceTravailConfig);
    expect(r.biensEnCours).toHaveLength(2);
    expect(r.totalDeductible).toBe(420);
  });

  it("6. bien dont anneeFin > anneeImposition : dans aContinuerAnneeSuivante", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // anneeFin = 2027
    const r = calculerAmortissementsAnnee([b], 2025, franceTravailConfig);
    expect(r.aContinuerAnneeSuivante).toEqual([b]);
  });

  it("7. bien dont anneeFin === anneeImposition : PAS dans aContinuerAnneeSuivante", () => {
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // anneeFin = 2027
    const r = calculerAmortissementsAnnee([b], 2027, franceTravailConfig);
    expect(r.biensEnCours).toEqual([b]);
    expect(r.aContinuerAnneeSuivante).toEqual([]);
  });

  it("défense en profondeur : un bien ≤ seuil est ignoré silencieusement", () => {
    const b = bien({ prixHT: 400, dateAchat: "2025-01-15", dureeAns: 3 });
    const r = calculerAmortissementsAnnee([b], 2025, franceTravailConfig);
    expect(r.detail).toEqual([]);
    expect(r.biensEnCours).toEqual([]);
    expect(r.biensFuturs).toEqual([]);
    expect(r.biensSoldes).toEqual([]);
    expect(r.totalDeductible).toBe(0);
  });
});
