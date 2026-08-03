// Point 7 de docs/critique_2026-08-03.md, correctif retenu : un contrat ne couvre jamais deux mois
// civils, règle imposée à l'ÉCRITURE. Ces tests portent sur la décision pure — c'est elle qu'App.tsx
// branche sur ses trois fonctions d'écriture (ajouterContrat / modifierContrat /
// ajouterContratsRecurrents), donc les tester ici teste le vrai rempart, pas une doublure.
import { describe, expect, it } from "vitest";
import { MESSAGE_CONTRAT_DEUX_MOIS, contratSurPlusieursMois, validerContratsPourEcriture } from "../contratUnSeulMois";

describe("contratSurPlusieursMois", () => {
  it("refuse le cas de la critique : une tournée du 20/02 au 10/03", () => {
    expect(contratSurPlusieursMois({ dateDebut: "2026-02-20", date: "2026-03-10" })).toBe(true);
  });

  it("accepte un contrat d'un seul jour", () => {
    expect(contratSurPlusieursMois({ dateDebut: "2026-03-05", date: "2026-03-05" })).toBe(false);
  });

  it("accepte un contrat long mais contenu dans un seul mois civil", () => {
    expect(contratSurPlusieursMois({ dateDebut: "2026-03-01", date: "2026-03-31" })).toBe(false);
  });

  it("accepte le mois entier généré par les contrats récurrents (1er → fin de mois)", () => {
    // lib/contratRecurrent.ts produit exactement cette forme (« engagement mensuel complet ») : la
    // règle doit valider ce qui existe déjà, sinon elle casserait la saisie récurrente.
    expect(contratSurPlusieursMois({ dateDebut: "2026-02-01", date: "2026-02-28" })).toBe(false);
  });

  it("refuse un chevauchement d'un seul jour (31/03 → 01/04)", () => {
    // Cas limite : deux jours consécutifs, mais deux mois — donc deux déclarations France Travail.
    expect(contratSurPlusieursMois({ dateDebut: "2026-03-31", date: "2026-04-01" })).toBe(true);
  });

  it("refuse un chevauchement d'année (décembre → janvier)", () => {
    expect(contratSurPlusieursMois({ dateDebut: "2025-12-28", date: "2026-01-05" })).toBe(true);
  });

  it("refuse un contrat couvrant le même mois de deux années différentes (mars 2025 → mars 2026)", () => {
    // Piège d'implémentation : comparer seulement le numéro de mois ("03" === "03") laisserait passer
    // un contrat d'un an. La comparaison porte sur la clé année-mois complète.
    expect(contratSurPlusieursMois({ dateDebut: "2025-03-10", date: "2026-03-10" })).toBe(true);
  });

  it("une date manquante n'est pas une violation de CETTE règle (brouillon de formulaire incomplet)", () => {
    // Refuser ici afficherait « ce contrat s'étend sur deux mois » à quelqu'un qui n'a simplement pas
    // fini de remplir le formulaire : un message faux, donc interdit (devoir n°2).
    expect(contratSurPlusieursMois({ dateDebut: "", date: "2026-03-10" })).toBe(false);
    expect(contratSurPlusieursMois({ dateDebut: "2026-03-10", date: "" })).toBe(false);
  });
});

describe("validerContratsPourEcriture", () => {
  it("laisse passer un lot entièrement conforme", () => {
    const verdict = validerContratsPourEcriture([
      { dateDebut: "2026-02-01", date: "2026-02-28" },
      { dateDebut: "2026-03-01", date: "2026-03-31" },
    ]);
    expect(verdict.ok).toBe(true);
  });

  it("refuse tout le lot dès qu'un seul contrat est à cheval, avec le message unique", () => {
    // Une série récurrente s'écrit en un seul geste : accepter les contrats conformes et jeter
    // l'intrus créerait une série trouée, sans le dire. Tout ou rien, et on l'annonce.
    const verdict = validerContratsPourEcriture([
      { dateDebut: "2026-02-01", date: "2026-02-28" },
      { dateDebut: "2026-03-20", date: "2026-04-05" }, // l'intrus
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toBe(MESSAGE_CONTRAT_DEUX_MOIS);
  });

  it("un lot vide passe (aucune écriture à refuser)", () => {
    expect(validerContratsPourEcriture([]).ok).toBe(true);
  });

  it("le message dit quoi faire, pas seulement que c'est refusé", () => {
    // Un refus sans mode d'emploi laisse l'utilisateur bloqué devant un formulaire qui ne s'enregistre
    // pas : le message doit nommer la solution (deux contrats séparés) et son pourquoi (le relevé).
    expect(MESSAGE_CONTRAT_DEUX_MOIS).toMatch(/deux contrats séparés/i);
    expect(MESSAGE_CONTRAT_DEUX_MOIS).toMatch(/relevé France Travail/i);
  });
});
