import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { decouperExercices, fusionnerExercicesGeles } from "../cycles";
import { contrat, profil } from "./testUtils";

describe("decouperExercices", () => {
  it("découpe correctement les exercices entre deux dates anniversaire", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [
      contrat({ date: "2025-06-01", nbCachets: 50 }), // exercice précédent, 600 h -> objectif atteint
      contrat({ date: "2026-03-01", nbCachets: 10 }), // exercice en cours, 120 h -> objectif non atteint
    ];

    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");

    expect(exercices).toHaveLength(2);

    const [enCours, precedent] = exercices;
    expect(enCours.dateDebut).toBe("2026-01-01");
    expect(enCours.dateAnniversaire).toBe("2026-12-31");
    expect(enCours.cloture).toBe(false);
    expect(enCours.heuresAtteintes).toBe(120);
    expect(enCours.objectifAtteint).toBe(false);

    expect(precedent.dateDebut).toBe("2025-01-01");
    expect(precedent.dateAnniversaire).toBe("2025-12-31");
    expect(precedent.cloture).toBe(true);
    expect(precedent.heuresAtteintes).toBe(600);
    expect(precedent.objectifAtteint).toBe(true);
    expect(precedent.ajBrute).toBeDefined();
  });

  it("renvoie un historique vide sans date anniversaire connue (première admission)", () => {
    const p = profil({ dateAnniversaire: "" });
    expect(decouperExercices(p, [], [], franceTravailConfig, "2026-06-01")).toEqual([]);
  });

  it("cycle précédent (i=1) borné par la vraie dateAnniversairePrecedente, pas par une soustraction calendaire de 12 mois (bug réel signalé le 31/07/2026 : Historique affichait un cycle 2025-01-18→2026-01-17 qui n'a jamais existé)", () => {
    // Cas réel : droit en cours ouvert le 18/01/2026 (FCT 17/01/2026, prochaine échéance 17/01/2027).
    // Le droit d'AVANT (renouvellement anticipé) a réellement duré 24/03/2025→17/01/2026 (~300 j, PAS
    // 12 mois pleins) — dateAnniversairePrecedente (23/03/2025) porte la vraie borne.
    const p = profil({ dateAnniversaire: "2027-01-17", dateAnniversairePrecedente: "2025-03-23", situation: "readmission", dateNaissance: "1990-01-01" });
    const contrats = [
      // AVANT la vraie borne (23/03/2025) : appartient à un cycle encore plus ancien, jamais compté
      // dans le cycle précédent — la reconstruction calendaire naïve (2025-01-18→2026-01-17) l'aurait
      // pourtant inclus à tort.
      contrat({ date: "2025-01-20", nbCachets: 20 }), // 240 h, hors du vrai cycle précédent
      // Dans le vrai cycle précédent (24/03/2025→17/01/2026).
      contrat({ date: "2025-06-01", nbCachets: 50 }), // 600 h
      // Cycle en cours (18/01/2026→17/01/2027).
      contrat({ date: "2026-03-01", nbCachets: 10 }), // 120 h
    ];

    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-07-31");
    const precedent = exercices.find((e) => e.dateAnniversaire === "2026-01-17")!;

    expect(precedent).toBeDefined();
    expect(precedent.dateDebut).toBe("2025-03-24"); // borne + 1 j, PAS 2025-01-18 (soustraction calendaire naïve)
    expect(precedent.heuresAtteintes).toBe(600); // uniquement le contrat du vrai cycle, jamais 600 + 240
    expect(precedent.cloture).toBe(true);
  });

  it("cycle précédent (i=1) sans dateAnniversairePrecedente connue : comportement inchangé (reconstruction calendaire, cas le plus courant)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 })];
    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");
    const precedent = exercices.find((e) => e.dateAnniversaire === "2025-12-31")!;
    expect(precedent.dateDebut).toBe("2025-01-01"); // inchangé : reconstruction calendaire par défaut
  });
});

// historiqueOuvertureDroits (07/08/2026, idée de Benoît) : reconstruire N'IMPORTE QUEL cycle passé
// avec de vraies bornes, pas seulement le précédent — additif, comportement inchangé sans lui.
describe("decouperExercices — historiqueOuvertureDroits", () => {
  it("borneReelle vrai pour le cycle en cours (i=0), même sans aucun historique", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const [enCours] = decouperExercices(p, [], [], franceTravailConfig, "2026-06-01");
    expect(enCours.borneReelle).toBe(true);
  });

  it("sans historique : borneReelle faux dès i=1 (reconstruction calendaire, comportement d'avant ce champ)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 })];
    const [, precedent] = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(precedent.borneReelle).toBe(false);
  });

  it("une entrée d'historique couvrant i=1 REMPLACE dateAnniversairePrecedente quand les deux sont présents (plus précise : deux bornes réelles, pas une borne + une soustraction d'un an)", () => {
    const p = profil({
      dateAnniversaire: "2027-01-17",
      dateAnniversairePrecedente: "2025-03-23", // repli legacy — devrait être ignoré ici
      situation: "readmission",
      dateNaissance: "1990-01-01",
      historiqueOuvertureDroits: [{ dateOuverture: "2025-02-01", dateEcheance: "2026-01-17" }], // vraie borne, différente du legacy
    });
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 })]; // 600 h, dans les deux cas
    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-07-31");
    const precedent = exercices.find((e) => e.dateAnniversaire === "2026-01-17")!;

    expect(precedent.dateDebut).toBe("2025-02-01"); // l'entrée d'historique, PAS "2025-03-24" (legacy+1j)
    expect(precedent.borneReelle).toBe(true);
  });

  it("plusieurs entrées couvrent i=1..3 avec de vraies bornes ; au-delà, repli calendaire signalé comme tel", () => {
    const p = profil({
      dateAnniversaire: "2026-12-31",
      dateNaissance: "1990-01-01",
      historiqueOuvertureDroits: [
        // Volontairement PAS triées par date ici : decouperExercices doit trier lui-même (tri
        // d'entrée non garanti, cf. saisie manuelle où l'ordre d'ajout n'est pas forcément
        // chronologique).
        { dateOuverture: "2023-01-01", dateEcheance: "2023-12-31" }, // i=3
        { dateOuverture: "2025-01-01", dateEcheance: "2025-12-31" }, // i=1
        { dateOuverture: "2024-01-01", dateEcheance: "2024-12-31" }, // i=2
      ],
    });
    // Un contrat assez ancien : sans lui, `earliestISO` vaudrait `dateAnniversaire` lui-même et la
    // boucle s'arrêterait dès i=1 (cf. `decouperExercices`, garde-fou "plus de données pertinentes
    // au-delà" — aucun rapport avec `historiqueOuvertureDroits`, juste une condition d'arrêt commune).
    const contrats = [contrat({ date: "2022-06-01", nbCachets: 1 })];
    const exercices = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");

    const i1 = exercices.find((e) => e.dateAnniversaire === "2025-12-31")!;
    const i2 = exercices.find((e) => e.dateAnniversaire === "2024-12-31")!;
    const i3 = exercices.find((e) => e.dateAnniversaire === "2023-12-31")!;
    const i4 = exercices.find((e) => e.dateAnniversaire === "2022-12-31")!; // au-delà du dernier connu

    expect(i1.dateDebut).toBe("2025-01-01");
    expect(i1.borneReelle).toBe(true);
    expect(i2.dateDebut).toBe("2024-01-01");
    expect(i2.borneReelle).toBe(true);
    expect(i3.dateDebut).toBe("2023-01-01");
    expect(i3.borneReelle).toBe(true);
    expect(i4).toBeDefined();
    expect(i4.borneReelle).toBe(false); // reconstruction calendaire, faute de 4e entrée
  });
});

// Bug réel corrigé le 31/07/2026 : decouperExercices seul recalcule TOUT à chaque appel, y compris
// les cycles déjà clos — un contrat ajouté après coup dans une période déjà close (import tardif)
// ou une nouvelle FCT (réadmission) changeait silencieusement l'AJ affichée pour un cycle passé.
// fusionnerExercicesGeles fige ce résultat une fois pour toutes (cf. sa doc dans cycles.ts).
describe("fusionnerExercicesGeles", () => {
  it("exercice en cours (cloture: false) : toujours la valeur fraîche, jamais placé dans aGeler", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-03-01", nbCachets: 10 })]; // exercice en cours, 120 h
    const [enCours] = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");

    const { exercices, aGeler } = fusionnerExercicesGeles([enCours], {});

    expect(exercices).toEqual([enCours]);
    expect(aGeler).toEqual([]);
  });

  it("exercice qui vient de clôturer, pas encore en storage : gardé pour l'affichage ET placé dans aGeler pour être persisté", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 })]; // exercice clos, 600 h
    const [, precedent] = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(precedent.cloture).toBe(true);

    const { exercices, aGeler } = fusionnerExercicesGeles([precedent], {});

    expect(exercices).toEqual([precedent]);
    expect(aGeler).toEqual([precedent]);
  });

  it("exercice déjà figé en storage : la version figée l'emporte TOUJOURS, même si le recalcul frais donnerait un chiffre différent (import tardif, nouvelle FCT...)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", dateNaissance: "1990-01-01" });
    // Recalcul frais : un contrat a été rajouté après coup dans une période déjà close (import
    // tardif) — sans le gel, ce contrat gonflerait silencieusement l'exercice déjà clos.
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 }), contrat({ date: "2025-07-01", nbCachets: 20 })]; // 600 + 240 h
    const [, precedentRecalcule] = decouperExercices(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(precedentRecalcule.heuresAtteintes).toBe(840); // le recalcul frais serait différent...

    const figeEnStorage = { ...precedentRecalcule, heuresAtteintes: 600, ajBrute: 55.02, ajNette: 53.81 }; // ... mais la valeur figée date d'avant l'ajout du 2e contrat
    const { exercices, aGeler } = fusionnerExercicesGeles([precedentRecalcule], { [precedentRecalcule.id]: figeEnStorage });

    expect(exercices).toEqual([figeEnStorage]); // jamais le recalcul frais (840 h)
    expect(aGeler).toEqual([]); // déjà figé : rien à persister de nouveau
  });
});
