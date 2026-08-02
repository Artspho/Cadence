import { describe, expect, it } from "vitest";
import { composerDateIso, dateEstValide, dateIsoEstValide, decouperDateIso } from "../dateJourMoisAnnee";

describe("decouperDateIso", () => {
  it("décompose une date ISO valide", () => {
    expect(decouperDateIso("1994-03-07")).toEqual({ jour: "7", mois: "03", annee: "1994" });
  });

  it("retourne des champs vides pour une chaîne vide ou malformée", () => {
    expect(decouperDateIso("")).toEqual({ jour: "", mois: "", annee: "" });
    expect(decouperDateIso("1994-3-7")).toEqual({ jour: "", mois: "", annee: "" });
  });
});

describe("dateEstValide", () => {
  it("accepte une date réelle", () => {
    expect(dateEstValide(7, 3, 1994)).toBe(true);
  });

  it("rejette un 31 dans un mois qui n'en a pas", () => {
    expect(dateEstValide(31, 4, 1994)).toBe(false);
  });

  it("gère les années bissextiles", () => {
    expect(dateEstValide(29, 2, 2024)).toBe(true);
    expect(dateEstValide(29, 2, 2023)).toBe(false);
  });

  it("rejette un mois ou un jour hors bornes", () => {
    expect(dateEstValide(15, 13, 1994)).toBe(false);
    expect(dateEstValide(0, 6, 1994)).toBe(false);
  });
});

describe("composerDateIso", () => {
  it("recompose une date ISO valide, jour complété par un zéro", () => {
    expect(composerDateIso({ jour: "7", mois: "03", annee: "1994" })).toBe("1994-03-07");
  });

  it("retourne null tant qu'un champ est incomplet", () => {
    expect(composerDateIso({ jour: "", mois: "03", annee: "1994" })).toBeNull();
    expect(composerDateIso({ jour: "7", mois: "", annee: "1994" })).toBeNull();
    expect(composerDateIso({ jour: "7", mois: "03", annee: "199" })).toBeNull();
  });

  it("retourne null pour une combinaison jour/mois invalide", () => {
    expect(composerDateIso({ jour: "31", mois: "04", annee: "1994" })).toBeNull();
  });
});

describe("dateIsoEstValide", () => {
  it("accepte une date ISO réelle", () => {
    expect(dateIsoEstValide("1994-03-07")).toBe(true);
  });

  it("rejette une année à 5 chiffres (cas réel : import JSON corrompu \"19994-06-09\")", () => {
    expect(dateIsoEstValide("19994-06-09")).toBe(false);
  });

  it("rejette une chaîne vide ou mal formée", () => {
    expect(dateIsoEstValide("")).toBe(false);
    expect(dateIsoEstValide("1994-3-7")).toBe(false);
  });

  it("rejette une date calendairement impossible malgré un format correct", () => {
    expect(dateIsoEstValide("1994-02-30")).toBe(false);
  });
});
