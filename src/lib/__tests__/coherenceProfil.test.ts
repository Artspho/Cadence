import { describe, expect, it } from "vitest";
import { validerCoherenceProfil, validerProfilPourEcriture } from "../coherenceProfil";
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
});
