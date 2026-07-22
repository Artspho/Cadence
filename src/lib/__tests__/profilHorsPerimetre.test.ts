import { describe, expect, it } from "vitest";
import { profilHorsPerimetre, regimeEffectif } from "../profilHorsPerimetre";
import { profil } from "../../engine/__tests__/testUtils";

describe("profilHorsPerimetre", () => {
  it("regimeDeclare 'mixte' -> hors périmètre", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "mixte" }))).toBe(true);
  });

  it("regimeDeclare 'inconnu' -> hors périmètre (même chemin que mixte, au moindre doute)", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "inconnu" }))).toBe(true);
  });

  it("regimeDeclare 'annexe10_pur' -> dans le périmètre", () => {
    expect(profilHorsPerimetre(profil({ regimeDeclare: "annexe10_pur" }))).toBe(false);
  });

  it("aucun champ renseigné (profil neuf) -> dans le périmètre par défaut", () => {
    expect(profilHorsPerimetre(profil({}))).toBe(false);
  });

  it("non-régression migration : activiteHorsAnnexe10=true legacy sans regimeDeclare -> reste hors périmètre", () => {
    const p = profil({ activiteHorsAnnexe10: true });
    expect(p.regimeDeclare).toBeUndefined();
    expect(profilHorsPerimetre(p)).toBe(true);
    expect(regimeEffectif(p)).toBe("mixte");
  });

  it("non-régression migration : activiteHorsAnnexe10=false legacy sans regimeDeclare -> reste dans le périmètre", () => {
    const p = profil({ activiteHorsAnnexe10: false });
    expect(profilHorsPerimetre(p)).toBe(false);
    expect(regimeEffectif(p)).toBe("annexe10_pur");
  });

  it("regimeDeclare a priorité sur le champ déprécié quand les deux sont présents", () => {
    const p = profil({ activiteHorsAnnexe10: true, regimeDeclare: "annexe10_pur" });
    expect(profilHorsPerimetre(p)).toBe(false);
  });
});
