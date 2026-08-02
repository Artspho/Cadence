import { describe, expect, it } from "vitest";
import { genererContratsRecurrents, listeMoisDeLaPlage } from "../contratRecurrent";

function idsDeterministes() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("genererContratsRecurrents", () => {
  it("génère un contrat par mois de la plage, daté du dernier jour du mois", () => {
    const contrats = genererContratsRecurrents(
      {
        employeur: "Conservatoire Test",
        moisDebut: "2026-09",
        moisFin: "2026-12",
        moisExclus: [],
        nbHeuresParMois: 12,
        salaireBrutParMois: 450,
        etablissementAgree: true,
        enRapportAvecMetier: true,
      },
      idsDeterministes(),
    );

    expect(contrats).toHaveLength(4);
    expect(contrats.map((c) => c.date)).toEqual(["2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31"]);
    for (const c of contrats) {
      expect(c.type).toBe("enseignement");
      expect(c.typeRemuneration).toBe("heures");
      expect(c.territoire).toBe("france");
      expect(c.nbHeures).toBe(12);
      expect(c.salaireBrut).toBe(450);
      expect(c.employeur).toBe("Conservatoire Test");
      expect(c.etablissementAgree).toBe(true);
      expect(c.enRapportAvecMetier).toBe(true);
      expect(c.source).toBe("recurrent");
    }
  });

  it("partage le même recurrenceId entre tous les contrats générés en une fois", () => {
    const contrats = genererContratsRecurrents({
      employeur: "X",
      moisDebut: "2026-09",
      moisFin: "2026-11",
      moisExclus: [],
      nbHeuresParMois: 10,
      salaireBrutParMois: 300,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    const ids = new Set(contrats.map((c) => c.recurrenceId));
    expect(ids.size).toBe(1);
    expect(contrats[0].recurrenceId).toBeTruthy();
  });

  it("génère des id de contrat tous différents (et différents du recurrenceId)", () => {
    const contrats = genererContratsRecurrents(
      { employeur: "X", moisDebut: "2026-09", moisFin: "2026-11", moisExclus: [], nbHeuresParMois: 10, salaireBrutParMois: 300, etablissementAgree: true, enRapportAvecMetier: true },
      idsDeterministes(),
    );
    const ids = contrats.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(contrats[0].recurrenceId);
  });

  it("exclut les mois listés dans moisExclus", () => {
    const contrats = genererContratsRecurrents({
      employeur: "X",
      moisDebut: "2026-09",
      moisFin: "2026-12",
      moisExclus: ["2026-10", "2026-12"],
      nbHeuresParMois: 10,
      salaireBrutParMois: 300,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    expect(contrats.map((c) => c.date)).toEqual(["2026-09-30", "2026-11-30"]);
  });

  it("tous les mois exclus -> tableau vide, ne plante pas", () => {
    const contrats = genererContratsRecurrents({
      employeur: "X",
      moisDebut: "2026-09",
      moisFin: "2026-09",
      moisExclus: ["2026-09"],
      nbHeuresParMois: 10,
      salaireBrutParMois: 300,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    expect(contrats).toEqual([]);
  });

  it("moisFin avant moisDebut -> tableau vide, ne plante pas", () => {
    const contrats = genererContratsRecurrents({
      employeur: "X",
      moisDebut: "2026-12",
      moisFin: "2026-09",
      moisExclus: [],
      nbHeuresParMois: 10,
      salaireBrutParMois: 300,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    expect(contrats).toEqual([]);
  });

  // Point H de la cartographie du 01/08/2026 (garde-fou heures/cachets) : le modèle récurrent n'a
  // aucun paramètre `nbCachetsParMois` — structurellement non-mixte, jamais besoin de la case
  // "Activité mixte" pour une occurrence générée. Verrouille cet invariant contre une régression
  // future (ex. si `nbCachetsParMois` était ajouté un jour sans y penser).
  it("aucune occurrence générée ne porte jamais nbCachets — le modèle récurrent est structurellement non-mixte (point H)", () => {
    const contrats = genererContratsRecurrents({
      employeur: "Conservatoire Test",
      moisDebut: "2026-09",
      moisFin: "2026-11",
      moisExclus: [],
      nbHeuresParMois: 12,
      salaireBrutParMois: 450,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    for (const c of contrats) {
      expect(c.nbCachets).toBeUndefined();
    }
  });

  it("un seul mois (moisDebut === moisFin) -> un seul contrat", () => {
    const contrats = genererContratsRecurrents({
      employeur: "X",
      moisDebut: "2026-09",
      moisFin: "2026-09",
      moisExclus: [],
      nbHeuresParMois: 10,
      salaireBrutParMois: 300,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    expect(contrats).toHaveLength(1);
    expect(contrats[0].date).toBe("2026-09-30");
  });
});

describe("listeMoisDeLaPlage", () => {
  it("liste les mois inclus, bornes comprises", () => {
    expect(listeMoisDeLaPlage("2026-09", "2026-12")).toEqual(["2026-09", "2026-10", "2026-11", "2026-12"]);
  });

  it("plage inversée -> vide", () => {
    expect(listeMoisDeLaPlage("2026-12", "2026-09")).toEqual([]);
  });
});
