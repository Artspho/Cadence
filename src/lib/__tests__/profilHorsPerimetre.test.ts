import { describe, expect, it } from "vitest";
import { perimetreBloquant, profilHorsPerimetre, regimeEffectif } from "../profilHorsPerimetre";
import { profil } from "../../engine/__tests__/testUtils";

// ── Non-régression : les 7 cas couverts AVANT l'ajout du motif explicite ────────────────────────
// Mêmes profils, mêmes conclusions — seule la forme du retour a changé (booléen -> StatutPerimetre).
describe("profilHorsPerimetre — cas historiques (non-régression)", () => {
  it("regimeDeclare 'mixte' -> hors périmètre, bloquant", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "mixte" }));
    expect(s.horsPerimetre).toBe(true);
    expect(s.motif).toBe("declare_mixte");
    expect(s.bloquant).toBe(true);
  });

  it("regimeDeclare 'inconnu' -> hors périmètre, bloquant (même traitement que mixte, au moindre doute)", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "inconnu" }));
    expect(s.horsPerimetre).toBe(true);
    expect(s.motif).toBe("declare_inconnu");
    expect(s.bloquant).toBe(true);
  });

  it("regimeDeclare 'annexe10_pur' -> dans le périmètre", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur" }));
    expect(s.horsPerimetre).toBe(false);
    expect(s.motif).toBe("annexe10_pur");
    expect(s.bloquant).toBe(false);
  });

  it("aucun champ renseigné (profil neuf) -> dans le périmètre par défaut", () => {
    expect(profilHorsPerimetre(profil({}))).toEqual({ horsPerimetre: false, motif: "annexe10_pur", bloquant: false });
  });

  it("migration : activiteHorsAnnexe10=true legacy sans regimeDeclare -> reste hors périmètre et bloquant", () => {
    const p = profil({ activiteHorsAnnexe10: true });
    expect(p.regimeDeclare).toBeUndefined();
    expect(profilHorsPerimetre(p).horsPerimetre).toBe(true);
    expect(profilHorsPerimetre(p).bloquant).toBe(true);
    expect(regimeEffectif(p)).toBe("mixte");
  });

  it("migration : activiteHorsAnnexe10=false legacy sans regimeDeclare -> reste dans le périmètre", () => {
    const p = profil({ activiteHorsAnnexe10: false });
    expect(profilHorsPerimetre(p).horsPerimetre).toBe(false);
    expect(regimeEffectif(p)).toBe("annexe10_pur");
  });

  it("regimeDeclare a priorité sur le champ déprécié quand les deux sont présents", () => {
    const p = profil({ activiteHorsAnnexe10: true, regimeDeclare: "annexe10_pur" });
    expect(profilHorsPerimetre(p).horsPerimetre).toBe(false);
  });
});

// ── Nouveau : contradiction interne A10 pur déclaré + salaires hors A10 > 0 ─────────────────────
describe("profilHorsPerimetre — contradiction salaires hors Annexe 10", () => {
  it("A10 pur déclaré + salaires hors A10 > 0 -> hors périmètre, NON bloquant", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }));
    expect(s.horsPerimetre).toBe(true);
    expect(s.motif).toBe("salaires_hors_a10_contradictoires");
    expect(s.bloquant).toBe(false); // l'app reste utilisable, seuls les montants sont masqués
  });

  it("déclenche dès le premier centime au-dessus de zéro", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 0.01 })).motif).toBe("salaires_hors_a10_contradictoires");
  });

  it("anti-faux-positif : salaires hors A10 = 0 -> aucune contradiction", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 0 }));
    expect(s.horsPerimetre).toBe(false);
    expect(s.motif).toBe("annexe10_pur");
  });

  it("anti-faux-positif : salaires hors A10 = null (champ vidé) -> aucune contradiction", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: null })).horsPerimetre).toBe(false);
  });

  it("anti-faux-positif : champ absent -> aucune contradiction", () => {
    const p = profil({ regimeDeclare: "annexe10_pur" });
    expect(p.salairesHorsAnnexe10PRA).toBeUndefined();
    expect(profilHorsPerimetre(p).horsPerimetre).toBe(false);
  });

  it("anti-faux-positif : salaires négatifs (saisie aberrante) ne déclenchent pas", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: -100 })).horsPerimetre).toBe(false);
  });

  it("une déclaration explicite « mixte » reste prioritaire et bloquante, même avec des salaires hors A10", () => {
    const s = profilHorsPerimetre(profil({ regimeDeclare: "mixte", salairesHorsAnnexe10PRA: 8000 }));
    expect(s.motif).toBe("declare_mixte");
    expect(s.bloquant).toBe(true);
  });

  it("profil legacy sans regimeDeclare + salaires hors A10 > 0 -> contradiction aussi détectée", () => {
    const p = profil({ salairesHorsAnnexe10PRA: 5000 });
    expect(p.regimeDeclare).toBeUndefined();
    expect(profilHorsPerimetre(p).motif).toBe("salaires_hors_a10_contradictoires");
  });

  // `situation` écrit EXPLICITEMENT dans les deux cas : la fabrique `profil()` vaut
  // "premiere_admission" par défaut, donc les tests ci-dessus couvraient déjà ce cas sans le dire —
  // un lecteur ne pouvait pas le savoir sans ouvrir testUtils.ts, et un changement de défaut aurait
  // silencieusement fait perdre la couverture. Le champ `salairesHorsAnnexe10PRA` est resté longtemps
  // inatteignable en première admission depuis l'UI (il vivait dans une section réservée à la
  // réadmission, cf. MonProfil.tsx) : la règle, elle, n'a jamais dépendu de `situation`.
  it("contradiction détectée en PREMIÈRE ADMISSION (la règle ne dépend pas de `situation`)", () => {
    const s = profilHorsPerimetre(profil({ situation: "premiere_admission", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }));
    expect(s.horsPerimetre).toBe(true);
    expect(s.motif).toBe("salaires_hors_a10_contradictoires");
    expect(s.bloquant).toBe(false);
  });

  it("contradiction détectée en RÉADMISSION, exactement au même titre", () => {
    const premiereAdmission = profilHorsPerimetre(profil({ situation: "premiere_admission", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }));
    const readmission = profilHorsPerimetre(profil({ situation: "readmission", regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }));
    expect(readmission).toEqual(premiereAdmission);
  });

  it("anti-faux-positif conservé dans les deux situations : 0 € ne déclenche rien", () => {
    for (const situation of ["premiere_admission", "readmission"] as const) {
      expect(profilHorsPerimetre(profil({ situation, regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 0 })).horsPerimetre).toBe(false);
    }
  });
});

describe("perimetreBloquant", () => {
  it("ne bloque QUE les déclarations explicites, jamais la contradiction", () => {
    expect(perimetreBloquant(profil({ regimeDeclare: "mixte" }))).toBe(true);
    expect(perimetreBloquant(profil({ regimeDeclare: "inconnu" }))).toBe(true);
    expect(perimetreBloquant(profil({ regimeDeclare: "annexe10_pur", salairesHorsAnnexe10PRA: 8000 }))).toBe(false);
    expect(perimetreBloquant(profil({ regimeDeclare: "annexe10_pur" }))).toBe(false);
  });
});
