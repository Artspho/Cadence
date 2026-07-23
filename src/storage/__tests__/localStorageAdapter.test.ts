import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_DONNEES, exporterJSON, importerJSON, type DonneesApp } from "../localStorageAdapter";
import { contrat, periode, profil } from "../../engine/__tests__/testUtils";

const DATE_EXPORT_FIXE = new Date("2026-07-20T10:00:00.000Z");

describe("exporterJSON / importerJSON — round-trip", () => {
  it("round-trip avec des données réelles : export puis import redonne le même état", () => {
    const donnees: DonneesApp = {
      profil: profil({ dateAnniversaire: "2026-12-31" }),
      contrats: [contrat({ date: "2026-06-01", nbCachets: 10 })],
      periodes: [periode({ type: "maternite", dateDebut: "2026-01-01", dateFin: "2026-02-01" })],
      declarationsMensuelles: [{ id: "1", mois: "2026-02", joursDeclares: 14, source: "lecture_releve" }],
      soldeIndemnisationDepart: { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2 },
    };

    const exporte = exporterJSON(donnees, DATE_EXPORT_FIXE);
    const reimporte = importerJSON(exporte);

    expect(reimporte).toEqual(donnees);
  });

  it("round-trip sur l'état vide (tout premier utilisateur de la bêta) : ne lève pas, redonne le même état", () => {
    const donneesVides: DonneesApp = { profil: null, contrats: [], periodes: [], declarationsMensuelles: [], soldeIndemnisationDepart: null };

    const exporte = exporterJSON(donneesVides, DATE_EXPORT_FIXE);
    expect(() => importerJSON(exporte)).not.toThrow();
    expect(importerJSON(exporte)).toEqual(donneesVides);
  });

  it("le fichier exporté porte un schemaVersion et un horodatage d'export", () => {
    const exporte = JSON.parse(exporterJSON({ profil: null, contrats: [], periodes: [], declarationsMensuelles: [], soldeIndemnisationDepart: null }, DATE_EXPORT_FIXE));
    expect(exporte.schemaVersion).toBe(SCHEMA_VERSION_DONNEES);
    expect(exporte.exporteLe).toBe(DATE_EXPORT_FIXE.toISOString());
  });

  it("importe sans perte un export antérieur au module indemnisation mensuelle (champs absents, pas juste vides)", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: profil({ dateAnniversaire: "2026-12-31" }),
      contrats: [],
      periodes: [],
      // declarationsMensuelles / soldeIndemnisationDepart : absents, comme un vrai export d'avant ce module.
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.declarationsMensuelles).toEqual([]);
    expect(reimporte.soldeIndemnisationDepart).toBeNull();
  });

  it("importe sans perte un solde de départ configuré avant l'ajout de quotaCPCarryOver (correctif franchise CP)", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: null,
      contrats: [],
      periodes: [],
      declarationsMensuelles: [],
      soldeIndemnisationDepart: { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5 }, // quotaCPCarryOver absent
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.soldeIndemnisationDepart?.quotaCPCarryOver).toBe(0);
  });
});

describe("importerJSON — trois refus distincts, trois messages distincts", () => {
  it("refuse un JSON syntaxiquement invalide, sans planter silencieusement", () => {
    expect(() => importerJSON("{ceci n'est pas du JSON")).toThrow(/JSON valide/i);
  });

  it("refuse un schemaVersion inconnu, même si la forme est par ailleurs correcte", () => {
    const fichierVersionInconnue = JSON.stringify({ schemaVersion: SCHEMA_VERSION_DONNEES + 1, profil: null, contrats: [], periodes: [] });
    expect(() => importerJSON(fichierVersionInconnue)).toThrow(/version différente/i);
  });

  it("refuse un fichier de schemaVersion correct mais de forme invalide (champ manquant)", () => {
    const fichierFormeInvalide = JSON.stringify({ schemaVersion: SCHEMA_VERSION_DONNEES, profil: null, contrats: "pas un tableau", periodes: [] });
    expect(() => importerJSON(fichierFormeInvalide)).toThrow(/structure attendue/i);
  });

  it("ne retourne jamais d'état partiel : les trois refus lèvent, aucun ne renvoie de valeur", () => {
    const tentatives = [
      () => importerJSON("pas du JSON"),
      () => importerJSON(JSON.stringify({ schemaVersion: 999, profil: null, contrats: [], periodes: [] })),
      () => importerJSON(JSON.stringify({ schemaVersion: SCHEMA_VERSION_DONNEES, profil: { incomplet: true }, contrats: [], periodes: [] })),
    ];
    for (const tentative of tentatives) {
      expect(tentative).toThrow();
    }
  });
});
