import { describe, expect, it } from "vitest";
import { profilSchema, profilSchemaForme, validerCoherenceProfil, validerProfilPourEcriture } from "../coherenceProfil";
import { profil } from "../../engine/__tests__/testUtils";

describe("validerCoherenceProfil", () => {
  it("première admission sans date anniversaire : cohérent (cas sain géré par le moteur)", () => {
    expect(validerCoherenceProfil({ dateNaissance: "1990-01-01", situation: "premiere_admission", dateAnniversaire: "" })).toEqual({ coherent: true });
  });

  it("première admission AVEC une date anniversaire renseignée : cohérent aussi", () => {
    expect(validerCoherenceProfil({ dateNaissance: "1990-01-01", situation: "premiere_admission", dateAnniversaire: "2026-12-31" })).toEqual({
      coherent: true,
    });
  });

  it("réadmission avec date anniversaire connue : cohérent", () => {
    expect(validerCoherenceProfil({ dateNaissance: "1990-01-01", situation: "readmission", dateAnniversaire: "2026-12-31" })).toEqual({ coherent: true });
  });

  it("réadmission SANS date anniversaire : incohérent (le piège identifié — profil bancal)", () => {
    const resultat = validerCoherenceProfil({ dateNaissance: "1990-01-01", situation: "readmission", dateAnniversaire: "" });
    expect(resultat.coherent).toBe(false);
    expect(resultat.raison).toMatch(/réadmission/i);
  });

  it("date de naissance vide : incohérent, quelle que soit la situation", () => {
    const resultat = validerCoherenceProfil({ dateNaissance: "", situation: "premiere_admission", dateAnniversaire: "" });
    expect(resultat.coherent).toBe(false);
  });

  it("date de naissance à année malformée (5 chiffres, cas réel \"19994-06-09\") : incohérent, jamais un NaN silencieux", () => {
    const resultat = validerCoherenceProfil({ dateNaissance: "19994-06-09", situation: "premiere_admission", dateAnniversaire: "" });
    expect(resultat.coherent).toBe(false);
    expect(resultat.raison).toMatch(/date de naissance/i);
  });

  it("date de naissance calendairement impossible (31 février) : incohérent", () => {
    const resultat = validerCoherenceProfil({ dateNaissance: "1990-02-31", situation: "premiere_admission", dateAnniversaire: "" });
    expect(resultat.coherent).toBe(false);
  });

  it("dateLimiteIndemnisation antérieure à dateOuverture : incohérent (cas réel — faute de frappe sur l'année)", () => {
    const resultat = validerCoherenceProfil({
      dateNaissance: "1990-01-01",
      situation: "readmission",
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2027-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2017-01-17" },
    });
    expect(resultat.coherent).toBe(false);
    expect(resultat.raison).toMatch(/postérieure/i);
  });

  it("dateLimiteIndemnisation égale à dateOuverture : incohérent aussi (aucune période d'indemnisation réelle)", () => {
    const resultat = validerCoherenceProfil({
      dateNaissance: "1990-01-01",
      situation: "readmission",
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2026-01-18" },
    });
    expect(resultat.coherent).toBe(false);
  });

  it("dateLimiteIndemnisation postérieure à dateOuverture : cohérent (cas normal)", () => {
    const resultat = validerCoherenceProfil({
      dateNaissance: "1990-01-01",
      situation: "readmission",
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    expect(resultat.coherent).toBe(true);
  });

  it("dateLimiteIndemnisation absente : cohérent (champ optionnel, non-régression)", () => {
    const resultat = validerCoherenceProfil({
      dateNaissance: "1990-01-01",
      situation: "readmission",
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    });
    expect(resultat.coherent).toBe(true);
  });
});

describe("profilSchemaForme vs profilSchema — lecture permissive, écriture stricte (devoir n°1)", () => {
  const profilIncoherent = {
    dateNaissance: "1990-01-01",
    dateAnniversaire: "2027-01-17",
    situation: "readmission" as const,
    ouvertureDroits: { dateOuverture: "2027-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2017-01-17" },
  };

  it("profilSchemaForme (lecture, chargerDonnees) ACCEPTE un profil déjà stocké incohérent — jamais de faux « données perdues » sur un simple chargement de page", () => {
    const resultat = profilSchemaForme.safeParse(profilIncoherent);
    expect(resultat.success).toBe(true);
  });

  it("profilSchema (écriture, validerProfilPourEcriture/importerJSON) REFUSE le même profil incohérent", () => {
    const resultat = profilSchema.safeParse(profilIncoherent);
    expect(resultat.success).toBe(false);
  });
});

describe("validerProfilPourEcriture", () => {
  it("profil cohérent et bien formé : accepté, renvoie le profil typé", () => {
    const candidat = profil({ situation: "readmission", dateAnniversaire: "2026-12-31" });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.profil).toEqual(candidat);
  });

  it("profil réadmission sans date anniversaire : refusé, jamais accepté", () => {
    const candidat = profil({ situation: "readmission", dateAnniversaire: "" });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreur).toMatch(/réadmission/i);
  });

  it("forme invalide (champ manquant) : refusé avant même la cohérence", () => {
    const resultat = validerProfilPourEcriture({ situation: "premiere_admission" });
    expect(resultat.ok).toBe(false);
  });

  it("réadmission avec dateAnniversairePrecedente renseignée : accepté", () => {
    const candidat = profil({ situation: "readmission", dateAnniversaire: "2026-12-31", dateAnniversairePrecedente: "2024-06-01" });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.profil.dateAnniversairePrecedente).toBe("2024-06-01");
  });

  it("réadmission SANS dateAnniversairePrecedente : toujours accepté (champ optionnel, non-régression)", () => {
    const candidat = profil({ situation: "readmission", dateAnniversaire: "2026-12-31" });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.profil.dateAnniversairePrecedente).toBeUndefined();
  });

  it("dateLimiteIndemnisation avant dateOuverture : refusé à l'écriture (cas réel signalé le 2026-07-26)", () => {
    const candidat = profil({
      situation: "readmission",
      dateAnniversaire: "2026-12-31",
      ouvertureDroits: { dateOuverture: "2027-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2017-01-17" },
    });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreur).toMatch(/postérieure/i);
  });

  it("dateNaissance à année malformée (import JSON corrompu) : refusé à l'écriture, message clair (pas un plafond enseignement faussé en silence)", () => {
    const candidat = profil({ dateNaissance: "19994-06-09" });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreur).toMatch(/date de naissance/i);
  });

  it("profilSchema conserve tauxPrelevementSourceHistorique (non-régression : Zod l'écartait silencieusement avant le fix historique, cf. docs/reprise.md)", () => {
    const candidat = profil({
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 10, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-01-18", valeur: 7.2 }] },
    });
    const resultat = validerProfilPourEcriture(candidat);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.profil.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2026-01-18", valeur: 7.2 }]);
  });
});
