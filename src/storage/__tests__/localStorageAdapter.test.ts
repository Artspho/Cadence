import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_DONNEES, exporterJSON, importerJSON, type DonneesApp } from "../localStorageAdapter";
import { contrat, periode, profil } from "../../engine/__tests__/testUtils";

const DATE_EXPORT_FIXE = new Date("2026-07-20T10:00:00.000Z");

describe("exporterJSON / importerJSON — round-trip", () => {
  it("round-trip avec des données réelles : export puis import redonne le même état", () => {
    const donnees: DonneesApp = {
      profil: profil({
        dateAnniversaire: "2026-12-31",
        ajReelleHistorique: [{ dateEffet: "2026-01-18", valeur: 55.02 }],
        ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 10, delaiAttenteInitial: 7 },
      }),
      contrats: [contrat({ date: "2026-06-01", nbCachets: 10 })],
      periodes: [periode({ type: "maternite", dateDebut: "2026-01-01", dateFin: "2026-02-01" })],
      soldeIndemnisationDepart: { dateDepart: "2026-02-01" },
    };

    const exporte = exporterJSON(donnees, DATE_EXPORT_FIXE);
    const reimporte = importerJSON(exporte);

    expect(reimporte).toEqual(donnees);
  });

  it("round-trip sur l'état vide (tout premier utilisateur de la bêta) : ne lève pas, redonne le même état", () => {
    const donneesVides: DonneesApp = { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null };

    const exporte = exporterJSON(donneesVides, DATE_EXPORT_FIXE);
    expect(() => importerJSON(exporte)).not.toThrow();
    expect(importerJSON(exporte)).toEqual(donneesVides);
  });

  it("le fichier exporté porte un schemaVersion et un horodatage d'export", () => {
    const exporte = JSON.parse(exporterJSON({ profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null }, DATE_EXPORT_FIXE));
    expect(exporte.schemaVersion).toBe(SCHEMA_VERSION_DONNEES);
    expect(exporte.exporteLe).toBe(DATE_EXPORT_FIXE.toISOString());
  });

  it("importe sans perte un export antérieur au module indemnisation mensuelle (champ soldeIndemnisationDepart absent, pas juste vide)", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: profil({ dateAnniversaire: "2026-12-31" }),
      contrats: [],
      periodes: [],
      // soldeIndemnisationDepart : absent, comme un vrai export d'avant ce module.
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.soldeIndemnisationDepart).toBeNull();
  });

  it("importe sans perte un export qui contient encore declarationsMensuelles (champ retiré le 2026-07-24, saisie manuelle remplacée par un calcul automatique depuis les contrats)", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: null,
      contrats: [],
      periodes: [],
      declarationsMensuelles: [{ id: "1", mois: "2026-02", joursDeclares: 14, source: "lecture_releve" }],
      soldeIndemnisationDepart: null,
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte).not.toHaveProperty("declarationsMensuelles");
  });

  it("importe sans perte un contrat enregistré avant l'ajout de dateDebut (découpage mensuel)", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: null,
      contrats: [{ id: "c1", date: "2026-06-15", type: "artiste", typeRemuneration: "cachet", territoire: "france", nbCachets: 5, salaireBrut: 500, employeur: "Test" }], // dateDebut absent
      periodes: [],
      soldeIndemnisationDepart: null,
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.contrats[0].dateDebut).toBe("2026-06-15"); // repli sur `date` — contrat traité comme un seul jour
  });

  it("importe sans perte un solde de départ configuré avant le passage à Profil.ouvertureDroits (2026-07-25) : ne garde que dateDepart", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: null,
      contrats: [],
      periodes: [],
      soldeIndemnisationDepart: { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2 },
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.soldeIndemnisationDepart).toEqual({ dateDepart: "2026-02-01" });
  });

  it("migration silencieuse : ajReelleHistorique encore sur soldeIndemnisationDepart (avant son passage à Profil le 2026-07-25) est déplacé vers profil", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: { dateNaissance: "1990-01-01", dateAnniversaire: "2026-01-18", situation: "readmission" },
      contrats: [],
      periodes: [],
      soldeIndemnisationDepart: {
        date: "2026-02-01",
        delaiRestant: 5,
        franchiseCPRestante: 5,
        quotaCPCarryOver: 2,
        ajReelleHistorique: [{ dateEffet: "2026-01-18", valeur: 55.02 }],
      },
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.profil?.ajReelleHistorique).toEqual([{ dateEffet: "2026-01-18", valeur: 55.02 }]);
    expect(reimporte.soldeIndemnisationDepart).toEqual({ dateDepart: "2026-02-01" });
  });

  it("migration silencieuse : un solde avec l'ancien champ ajReelle (correctif du 2026-07-23) est converti puis déplacé vers profil.ajReelleHistorique", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: { dateNaissance: "1990-01-01", dateAnniversaire: "2026-01-18", situation: "readmission" },
      contrats: [],
      periodes: [],
      soldeIndemnisationDepart: { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2, ajReelle: 55.02 },
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.profil?.ajReelleHistorique).toEqual([{ dateEffet: "2000-01-01", valeur: 55.02 }]);
  });

  it("migration silencieuse : ajReelle null (jamais renseignée) ne produit aucune entrée", () => {
    const exportAncien = JSON.stringify({
      schemaVersion: SCHEMA_VERSION_DONNEES,
      profil: { dateNaissance: "1990-01-01", dateAnniversaire: "2026-01-18", situation: "readmission" },
      contrats: [],
      periodes: [],
      soldeIndemnisationDepart: { date: "2026-02-01", delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2, ajReelle: null },
    });
    const reimporte = importerJSON(exportAncien);
    expect(reimporte.profil?.ajReelleHistorique).toBeUndefined();
    expect(reimporte.soldeIndemnisationDepart).toEqual({ dateDepart: "2026-02-01" });
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
