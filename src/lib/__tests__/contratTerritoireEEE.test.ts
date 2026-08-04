// Point 17 de docs/critique_2026-08-03.md : un contrat EEE sans jours saisis compte zéro heure en
// silence. Correctif retenu par Benoît le 04/08/2026 — garde à l'ÉCRITURE, en un point unique, plus
// le refus des contrats EEE qui portent des cachets ou des heures que le décompte ignore.
//
// Ces tests portent sur la DÉCISION pure : c'est elle qu'App.tsx branche sur ses trois fonctions
// d'écriture (ajouterContrat / modifierContrat / ajouterContratsRecurrents), donc les tester ici teste
// le vrai rempart — pas une doublure. Le même dispositif que contratUnSeulMois.test.ts pour le point 7.
import { describe, expect, it } from "vitest";
import {
  MESSAGE_EEE_REMUNERATION_IGNOREE,
  MESSAGE_EEE_SANS_JOURS,
  contratEEEAvecRemunerationIgnoree,
  contratEEESansJours,
  raisonsRefusEEE,
  validerContratsEEEPourEcriture,
} from "../contratTerritoireEEE";

describe("contratEEESansJours", () => {
  it("refuse le cas de la critique : territoire EEE, champ jours absent", () => {
    expect(contratEEESansJours({ territoire: "eee_suisse_uk", nbJoursEEE: undefined })).toBe(true);
  });

  it("refuse aussi 0 jour : le contrat n'apporterait rien non plus", () => {
    // L'absence du champ et un 0 explicite donnent exactement le même résultat à l'écran
    // (`(nbJoursEEE ?? 0) × 6` = 0 h). Les traiter différemment reviendrait à laisser passer la
    // moitié du problème.
    expect(contratEEESansJours({ territoire: "eee_suisse_uk", nbJoursEEE: 0 })).toBe(true);
  });

  it("accepte un contrat EEE avec des jours, y compris une demi-journée", () => {
    expect(contratEEESansJours({ territoire: "eee_suisse_uk", nbJoursEEE: 12 })).toBe(false);
    expect(contratEEESansJours({ territoire: "eee_suisse_uk", nbJoursEEE: 0.5 })).toBe(false);
  });

  it("ne dit JAMAIS rien d'un contrat France, avec ou sans jours EEE", () => {
    // Un contrat France n'a aucune raison de porter `nbJoursEEE`, et son absence n'est pas un défaut :
    // refuser ici afficherait un message faux à quelqu'un qui n'a rien fait de mal (devoir n°2).
    expect(contratEEESansJours({ territoire: "france", nbJoursEEE: undefined })).toBe(false);
    expect(contratEEESansJours({ territoire: "france", nbJoursEEE: 0 })).toBe(false);
    expect(contratEEESansJours({ territoire: "france", nbJoursEEE: 8 })).toBe(false);
  });
});

describe("contratEEEAvecRemunerationIgnoree", () => {
  it("refuse un contrat EEE qui porte des cachets — le décompte les ignore en entier", () => {
    // Cas réel et facile à produire : saisir des cachets, puis basculer le territoire sur EEE.
    expect(contratEEEAvecRemunerationIgnoree({ territoire: "eee_suisse_uk", nbCachets: 12, nbHeures: undefined })).toBe(true);
  });

  it("refuse un contrat EEE qui porte des heures", () => {
    expect(contratEEEAvecRemunerationIgnoree({ territoire: "eee_suisse_uk", nbCachets: undefined, nbHeures: 40 })).toBe(true);
  });

  it("accepte un contrat EEE qui ne porte ni cachets ni heures", () => {
    expect(contratEEEAvecRemunerationIgnoree({ territoire: "eee_suisse_uk", nbCachets: undefined, nbHeures: undefined })).toBe(false);
    expect(contratEEEAvecRemunerationIgnoree({ territoire: "eee_suisse_uk", nbCachets: 0, nbHeures: 0 })).toBe(false);
  });

  it("ne dit jamais rien d'un contrat France, quels que soient ses cachets et ses heures", () => {
    // C'est le cas NORMAL de la quasi-totalité des contrats (62/62 chez Benoît au 04/08/2026).
    expect(contratEEEAvecRemunerationIgnoree({ territoire: "france", nbCachets: 12, nbHeures: 40 })).toBe(false);
  });
});

describe("raisonsRefusEEE", () => {
  it("un contrat conforme n'a aucune raison de refus", () => {
    expect(raisonsRefusEEE({ territoire: "eee_suisse_uk", nbJoursEEE: 10, nbCachets: undefined, nbHeures: undefined })).toEqual([]);
    expect(raisonsRefusEEE({ territoire: "france", nbJoursEEE: undefined, nbCachets: 3, nbHeures: undefined })).toEqual([]);
  });

  it("un contrat qui cumule les deux défauts renvoie les DEUX raisons, pas la première", () => {
    // Sinon l'utilisateur corrige les jours, réessaie, et se fait refuser une seconde fois pour une
    // raison qu'on connaissait déjà : deux refus pour un seul problème, moitié dit à chaque tour.
    const raisons = raisonsRefusEEE({ territoire: "eee_suisse_uk", nbJoursEEE: undefined, nbCachets: 12, nbHeures: undefined });
    expect(raisons).toEqual([MESSAGE_EEE_SANS_JOURS, MESSAGE_EEE_REMUNERATION_IGNOREE]);
  });
});

describe("validerContratsEEEPourEcriture", () => {
  it("laisse passer un lot entièrement conforme", () => {
    const verdict = validerContratsEEEPourEcriture([
      { territoire: "france", nbJoursEEE: undefined, nbCachets: 3, nbHeures: undefined },
      { territoire: "eee_suisse_uk", nbJoursEEE: 10, nbCachets: undefined, nbHeures: undefined },
    ]);
    expect(verdict.ok).toBe(true);
  });

  it("refuse tout le lot dès qu'un seul contrat est en faute, avec le message unique", () => {
    // Tout ou rien, comme pour la règle des deux mois : accepter les conformes et jeter l'intrus
    // créerait une série récurrente trouée, sans le dire.
    const verdict = validerContratsEEEPourEcriture([
      { territoire: "france", nbJoursEEE: undefined, nbCachets: 3, nbHeures: undefined },
      { territoire: "eee_suisse_uk", nbJoursEEE: undefined, nbCachets: undefined, nbHeures: undefined }, // l'intrus
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toBe(MESSAGE_EEE_SANS_JOURS);
  });

  it("un lot vide passe (aucune écriture à refuser)", () => {
    expect(validerContratsEEEPourEcriture([]).ok).toBe(true);
  });

  it("deux contrats fautifs de la MÊME façon ne répètent pas le message deux fois", () => {
    const verdict = validerContratsEEEPourEcriture([
      { territoire: "eee_suisse_uk", nbJoursEEE: undefined, nbCachets: undefined, nbHeures: undefined },
      { territoire: "eee_suisse_uk", nbJoursEEE: 0, nbCachets: undefined, nbHeures: undefined },
    ]);
    expect(verdict.ok === false && verdict.message).toBe(MESSAGE_EEE_SANS_JOURS);
  });

  it("les deux messages disent quoi faire, pas seulement que c'est refusé", () => {
    // Un refus sans mode d'emploi laisse l'utilisateur devant un formulaire qui ne s'enregistre pas.
    expect(MESSAGE_EEE_SANS_JOURS).toMatch(/nombre de jours travaillés/i);
    expect(MESSAGE_EEE_REMUNERATION_IGNOREE).toMatch(/retire-les|territoire France/i);
  });

  it("aucun message ne prétend que les cachets EEE vont être comptés", () => {
    // Garde-fou contre une dérive de rédaction : additionner jours EEE et cachets serait inventer une
    // règle du régime que rien ne source (piste écartée par Benoît le 04/08/2026). Les messages
    // annoncent un REFUS d'enregistrer, jamais un changement de calcul.
    expect(MESSAGE_EEE_REMUNERATION_IGNOREE).toMatch(/ignorés/i);
    expect(MESSAGE_EEE_REMUNERATION_IGNOREE).not.toMatch(/comptés en plus|ajoutés/i);
  });
});
