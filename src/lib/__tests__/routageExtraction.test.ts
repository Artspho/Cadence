import { describe, expect, it } from "vitest";
import type { Profil } from "../../types";
import type { Proposition } from "../../types/extraction";
import { contrat } from "../../engine/__tests__/testUtils";
import {
  champsDivergents,
  contratConfirmeDepuisCorrespondance,
  contratDepuisProposition,
  evaluerExtraction,
  evaluerProposition,
  fusionnerContratsDupliques,
  periodeDepuisProposition,
  profilAvecProposition,
} from "../routageExtraction";
import {
  extractionAemDupliqueeHeuresCachets,
  extractionAemHeuresEtCachets,
  extractionBulletinPaie,
  extractionJustificatifDeclaration,
  extractionNotificationAdmission,
  extractionReleveAvecRefus,
} from "../fixturesExtraction";

const profilBase: Profil = {
  dateNaissance: "1988-04-12",
  dateAnniversaire: "2025-11-30",
  situation: "readmission",
};

function propositionAj(natureMontant: "net" | "brut" | "indetermine", valeur = 60): Proposition {
  return {
    cible: "aj_reelle_historique",
    donnees: { dateEffet: "2026-03-01", valeur, natureMontant },
    confiance: { valeur: "haute" },
    justification: "test",
  };
}

describe("aj_reelle_historique — le champ de l'app attend une AJ NETTE", () => {
  it("accepte un montant explicitement net", () => {
    const evaluee = evaluerProposition(propositionAj("net"), profilBase);
    expect(evaluee.statut).toBe("applicable");
  });

  // Devoir n°2 : le moteur applique le prélèvement à la source SUR cette valeur. Y mettre un brut
  // gonflerait tous les montants mensuels affichés.
  it("refuse un montant brut", () => {
    const evaluee = evaluerProposition(propositionAj("brut"), profilBase);
    expect(evaluee.statut).toBe("non_applicable");
    expect(evaluee.motif).toMatch(/BRUTE/);
  });

  it("refuse un montant de nature indéterminée", () => {
    const evaluee = evaluerProposition(propositionAj("indetermine"), profilBase);
    expect(evaluee.statut).toBe("non_applicable");
  });

  it("refuse d'écrire un montant non net même si l'évaluation est contournée", () => {
    expect(() => profilAvecProposition(profilBase, propositionAj("brut"))).toThrow(/non net/);
    expect(() => profilAvecProposition(profilBase, propositionAj("indetermine"))).toThrow(/non net/);
  });

  it("insère le montant net en gardant l'historique trié par date d'effet", () => {
    const profil: Profil = { ...profilBase, ajReelleHistorique: [{ dateEffet: "2026-05-01", valeur: 55.02 }] };
    const resultat = profilAvecProposition(profil, propositionAj("net", 54.55));
    expect(resultat.ajReelleHistorique).toEqual([
      { dateEffet: "2026-03-01", valeur: 54.55 },
      { dateEffet: "2026-05-01", valeur: 55.02 },
    ]);
  });

  it("remplace l'entrée existante de même date d'effet au lieu de la dupliquer", () => {
    const profil: Profil = { ...profilBase, ajReelleHistorique: [{ dateEffet: "2026-03-01", valeur: 50 }] };
    const resultat = profilAvecProposition(profil, propositionAj("net", 54.55));
    expect(resultat.ajReelleHistorique).toEqual([{ dateEffet: "2026-03-01", valeur: 54.55 }]);
  });
});

describe("profil_ouverture_droits — refus si un chiffre qui change les montants manque", () => {
  const complete: Proposition = {
    cible: "profil_ouverture_droits",
    donnees: { dateOuverture: "2026-02-01", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-31", tauxPrelevementSource: 7.2, tauxPrelevementSourceDateEffet: "2026-02-01" },
    confiance: {},
    justification: "test",
  };

  it("applique une notification complète", () => {
    expect(evaluerProposition(complete, profilBase).statut).toBe("applicable");
    const resultat = profilAvecProposition(profilBase, complete);
    expect(resultat.ouvertureDroits).toEqual({
      dateOuverture: "2026-02-01",
      franchiseCPTotale: 12,
      delaiAttenteInitial: 7,
      dateLimiteIndemnisation: "2027-01-31",
      tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-01", valeur: 7.2 }],
    });
  });

  // Mettre 0 par défaut décalerait les dates de versement : chiffre inventé, donc refus.
  it.each([
    ["franchiseCPTotale", { franchiseCPTotale: null }],
    ["delaiAttenteInitial", { delaiAttenteInitial: null }],
    ["dateOuverture", { dateOuverture: "" }],
  ])("refuse quand %s manque", (_champ, remplacement) => {
    const partielle = { ...complete, donnees: { ...complete.donnees, ...remplacement } } as Proposition;
    const evaluee = evaluerProposition(partielle, profilBase);
    expect(evaluee.statut).toBe("non_applicable");
    expect(() => profilAvecProposition(profilBase, partielle)).toThrow();
  });

  it("ne perd pas un taux déjà saisi quand le document n'en donne pas", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2025-02-01", valeur: 3.1 }], dateLimiteIndemnisation: "2026-01-31" },
    };
    const sansTaux = { ...complete, donnees: { ...complete.donnees, tauxPrelevementSource: null, tauxPrelevementSourceDateEffet: null, dateLimiteIndemnisation: null } } as Proposition;
    const resultat = profilAvecProposition(profil, sansTaux);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2025-02-01", valeur: 3.1 }]);
    expect(resultat.ouvertureDroits?.dateLimiteIndemnisation).toBe("2026-01-31");
  });

  it("applicable si un champ utile est donné seul, quand ouvertureDroits existe déjà (ex. avis d'imposition seul)", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const tauxSeul = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2025-06-01" },
    } as Proposition;
    expect(evaluerProposition(tauxSeul, profil).statut).toBe("applicable");
  });

  it("récupère dateOuverture/franchiseCPTotale/delaiAttenteInitial du profil existant quand la proposition ne donne que le taux", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const tauxSeul = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2025-06-01" },
    } as Proposition;
    const resultat = profilAvecProposition(profil, tauxSeul);
    expect(resultat.ouvertureDroits?.dateOuverture).toBe("2025-02-01");
    expect(resultat.ouvertureDroits?.franchiseCPTotale).toBe(5);
    expect(resultat.ouvertureDroits?.delaiAttenteInitial).toBe(7);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2025-06-01", valeur: 3.1 }]);
  });

  it("applicable même si le relevé redonne dateOuverture en plus du taux, franchise/délai non redonnés", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const releve = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "2026-01-18", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2026-01-18" },
    } as Proposition;
    expect(evaluerProposition(releve, profil).statut).toBe("applicable");
  });

  it("un relevé qui redonne dateOuverture met quand même à jour le taux sans perdre franchise/délai", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const releve = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "2026-01-18", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2026-01-18" },
    } as Proposition;
    const resultat = profilAvecProposition(profil, releve);
    expect(resultat.ouvertureDroits?.dateOuverture).toBe("2026-01-18");
    expect(resultat.ouvertureDroits?.franchiseCPTotale).toBe(5);
    expect(resultat.ouvertureDroits?.delaiAttenteInitial).toBe(7);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2026-01-18", valeur: 3.1 }]);
  });

  it("sans dateEffet lisible, le taux n'est pas appliqué (pas de date inventée, devoir n°2)", () => {
    const sansDate = { ...complete, donnees: { ...complete.donnees, tauxPrelevementSourceDateEffet: null } } as Proposition;
    const resultat = profilAvecProposition(profilBase, sansDate);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toBeUndefined();
  });

  it("régression réelle 01/08/2026 : un second relevé plus récent AJOUTE une entrée, ne remplace jamais l'historique (3,30 % mi-2025 puis 3,10 % fin 2025/2026, cf. relevés réels du dossier)", () => {
    const profilApresPremierReleve: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-03-24", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2025-07-03", valeur: 3.3 }] },
    };
    const secondReleve = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "2025-03-24", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2026-02-17" },
    } as Proposition;
    const resultat = profilAvecProposition(profilApresPremierReleve, secondReleve);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([
      { dateEffet: "2025-07-03", valeur: 3.3 },
      { dateEffet: "2026-02-17", valeur: 3.1 },
    ]);
  });

  it("un même document réimporté (même dateEffet) remplace l'entrée existante plutôt que d'en créer une seconde", () => {
    const profilExistant: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-03-24", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-17", valeur: 3.1 }] },
    };
    const memeDocument = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "2025-03-24", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: null, tauxPrelevementSource: 3.1, tauxPrelevementSourceDateEffet: "2026-02-17" },
    } as Proposition;
    const resultat = profilAvecProposition(profilExistant, memeDocument);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2026-02-17", valeur: 3.1 }]);
  });
});

describe("profil_infos — un champ non lu n'efface jamais une valeur déjà saisie (devoir n°1)", () => {
  it("ne modifie que les champs effectivement lus", () => {
    const proposition: Proposition = {
      cible: "profil_infos",
      donnees: { dateAnniversaire: "2026-01-15", dateNaissance: null, dateAnniversairePrecedente: null, situation: null, dureeDroitsMois: null },
      confiance: {},
      justification: "test",
    };
    const resultat = profilAvecProposition(profilBase, proposition);
    expect(resultat.dateAnniversaire).toBe("2026-01-15");
    expect(resultat.dateNaissance).toBe("1988-04-12");
    expect(resultat.situation).toBe("readmission");
  });

  it("n'a rien à appliquer si aucun champ n'a été lu", () => {
    const proposition: Proposition = {
      cible: "profil_infos",
      donnees: { dateAnniversaire: null, dateNaissance: null, dateAnniversairePrecedente: null, situation: null, dureeDroitsMois: null },
      confiance: {},
      justification: "test",
    };
    expect(evaluerProposition(proposition, profilBase).statut).toBe("non_applicable");
  });
});

describe("periode_assimilee — toujours relue dans PeriodeForm, jamais appliquée directement (CRUD + routage construits le 31/07/2026)", () => {
  const proposition: Proposition = {
    cible: "periode_assimilee",
    donnees: { type: "accident_travail", dateDebut: "2026-04-06", dateFin: "2026-04-24" },
    confiance: {},
    justification: "test",
  };

  it("passe par le formulaire (comme contrat), jamais 'applicable' directement", () => {
    const evaluee = evaluerProposition(proposition, profilBase);
    expect(evaluee.statut).toBe("revue_formulaire");
    expect(evaluee.avertissements).toEqual([]); // type/dateDebut/dateFin non-nullables : rien à défaut
  });

  it("convertit les trois champs sans en inventer aucun (tous non-nullables dans le schéma)", () => {
    const valeurs = periodeDepuisProposition(proposition.donnees);
    expect(valeurs).toEqual({ type: "accident_travail", dateDebut: "2026-04-06", dateFin: "2026-04-24" });
  });

  it("ne s'applique pas directement au profil (periode_assimilee ne cible pas Profil)", () => {
    expect(() => profilAvecProposition(profilBase, proposition)).toThrow();
  });
});

describe("contrat — toujours relu dans le formulaire, jamais appliqué directement", () => {
  const proposition = extractionBulletinPaie.propositions[0] as Extract<Proposition, { cible: "contrat" }>;

  it("passe par le formulaire", () => {
    expect(evaluerProposition(proposition, profilBase).statut).toBe("revue_formulaire");
  });

  it("signale chaque champ que le document n'indiquait pas, pour ne pas faire passer un défaut du formulaire pour une valeur lue", () => {
    const { avertissements } = evaluerProposition(proposition, profilBase);
    expect(avertissements).toHaveLength(3);
    expect(avertissements.join(" ")).toMatch(/Artiste/);
    expect(avertissements.join(" ")).toMatch(/Cachets/);
    expect(avertissements.join(" ")).toMatch(/France/);
  });

  it("convertit les champs non lus en `undefined` sans inventer de valeur", () => {
    const valeurs = contratDepuisProposition(proposition.donnees);
    expect(valeurs.type).toBeUndefined();
    expect(valeurs.typeRemuneration).toBeUndefined();
    expect(valeurs.territoire).toBeUndefined();
    expect(valeurs.nbCachets).toBeUndefined();
    expect(valeurs.salaireBrut).toBe(1420.5);
    expect(valeurs.employeur).toBe("Compagnie du Exemple Fictif");
    expect(valeurs.source).toBe("import_pdf");
  });

  it("ne s'applique pas au profil", () => {
    expect(() => profilAvecProposition(profilBase, proposition)).toThrow();
  });

  // 01/08/2026 (spécimen AEM réel) : nbHeures et nbCachets peuvent être TOUS LES DEUX renseignés
  // sur le même contrat — ni l'un ni l'autre ne doit être supprimé ou converti au routage.
  it("conserve nbHeures ET nbCachets simultanément quand les deux sont renseignés (AEM heures + cachets)", () => {
    const propositionMixte = extractionAemHeuresEtCachets.propositions[0] as Extract<Proposition, { cible: "contrat" }>;
    const valeurs = contratDepuisProposition(propositionMixte.donnees);
    expect(valeurs.nbHeures).toBe(14);
    expect(valeurs.nbCachets).toBe(3);
  });
});

// 01/08/2026 : plan "cycle de vie du contrat" — une proposition "contrat" issue d'un document
// importé doit signaler les contrats "a_verifier" existants qui pourraient être le même contrat,
// pour que RevueExtraction.tsx propose une correspondance plutôt qu'une création systématique.
describe("evaluerProposition / evaluerExtraction — correspondances avec des contrats existants", () => {
  const propositionContrat = extractionBulletinPaie.propositions[0] as Extract<Proposition, { cible: "contrat" }>;

  it("sans contratsExistants (paramètre par défaut), correspondances est un tableau vide", () => {
    const { correspondances } = evaluerProposition(propositionContrat, profilBase);
    expect(correspondances).toEqual([]);
  });

  it("trouve un contrat 'a_verifier' existant qui correspond (même employeur, même mois)", () => {
    const existant = contrat({
      date: propositionContrat.donnees.date,
      employeur: propositionContrat.donnees.employeur,
      salaireBrut: propositionContrat.donnees.salaireBrut,
      statutVerification: "a_verifier",
    });
    const { correspondances } = evaluerProposition(propositionContrat, profilBase, [existant]);
    expect(correspondances).toEqual([existant]);
  });

  it("ne trouve rien pour les cibles autres que 'contrat'", () => {
    const existant = contrat({ date: "2026-01-01", employeur: "Peu importe", statutVerification: "a_verifier" });
    const { correspondances } = evaluerProposition(propositionAj("net"), profilBase, [existant]);
    expect(correspondances).toBeUndefined();
  });

  it("evaluerExtraction propage contratsExistants à chaque proposition 'contrat'", () => {
    const existant = contrat({
      date: propositionContrat.donnees.date,
      employeur: propositionContrat.donnees.employeur,
      salaireBrut: propositionContrat.donnees.salaireBrut,
      statutVerification: "a_verifier",
    });
    const evaluees = evaluerExtraction(extractionBulletinPaie, profilBase, [existant]);
    const contratEvalue = evaluees.find((e) => e.proposition.cible === "contrat");
    expect(contratEvalue?.correspondances).toEqual([existant]);
  });
});

describe("champsDivergents — Ancien → Nouveau avant confirmation d'une correspondance", () => {
  const propositionDonnees = (extractionBulletinPaie.propositions[0] as Extract<Proposition, { cible: "contrat" }>).donnees;

  it("signale un champ dont la valeur diffère (ex. salaireBrut saisi à la main vs document)", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: 999 });
    const divergences = champsDivergents(existant, propositionDonnees);
    const salaire = divergences.find((d) => d.champ === "salaireBrut");
    expect(salaire).toEqual({ champ: "salaireBrut", ancien: 999, nouveau: propositionDonnees.salaireBrut });
  });

  it("ne signale JAMAIS un champ que le document n'a pas lu (null), même si le contrat existant a une valeur", () => {
    // extractionBulletinPaie a type/typeRemuneration/territoire à null (cf. fixturesExtraction.ts)
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, type: "enseignement" });
    const divergences = champsDivergents(existant, propositionDonnees);
    expect(divergences.find((d) => d.champ === "type")).toBeUndefined();
  });

  it("ne signale rien quand tout correspond déjà", () => {
    const existant = contrat({
      date: propositionDonnees.date,
      dateDebut: propositionDonnees.dateDebut ?? propositionDonnees.date,
      employeur: propositionDonnees.employeur,
      salaireBrut: propositionDonnees.salaireBrut,
    });
    expect(champsDivergents(existant, propositionDonnees)).toEqual([]);
  });
});

describe("contratConfirmeDepuisCorrespondance — l'AEM fait foi, mais jamais silencieusement", () => {
  const propositionDonnees = (extractionBulletinPaie.propositions[0] as Extract<Proposition, { cible: "contrat" }>).donnees;

  it("remplace la valeur existante par celle du document quand le document en donne une", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: 999 });
    const confirme = contratConfirmeDepuisCorrespondance(existant, propositionDonnees);
    expect(confirme.salaireBrut).toBe(propositionDonnees.salaireBrut);
  });

  it("conserve la valeur existante pour un champ que le document ne lit pas (jamais un spread aveugle qui écraserait avec undefined)", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, type: "enseignement" });
    const confirme = contratConfirmeDepuisCorrespondance(existant, propositionDonnees);
    expect(confirme.type).toBe("enseignement"); // le document ne lit pas `type` (null dans la fixture)
  });

  it("bascule statutVerification à 'confirme'", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, statutVerification: "a_verifier" });
    const confirme = contratConfirmeDepuisCorrespondance(existant, propositionDonnees);
    expect(confirme.statutVerification).toBe("confirme");
  });

  it("préserve recurrenceId — confirmer un contrat de série récurrente ne le retire pas de sa série", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, recurrenceId: "serie-test" });
    const confirme = contratConfirmeDepuisCorrespondance(existant, propositionDonnees);
    expect(confirme.recurrenceId).toBe("serie-test");
  });

  it("source devient 'import_pdf' — les valeurs actuelles viennent maintenant du document", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, source: "manuel" });
    const confirme = contratConfirmeDepuisCorrespondance(existant, propositionDonnees);
    expect(confirme.source).toBe("import_pdf");
  });
});

describe("fusionnerContratsDupliques — bug réel du 01/08/2026 : salaire dupliqué sur deux propositions", () => {
  it("fusionne deux propositions du même contrat (heures + cachet, même salaire) en une seule", () => {
    const fusionnees = fusionnerContratsDupliques(extractionAemDupliqueeHeuresCachets.propositions);
    const contrats = fusionnees.filter((p) => p.cible === "contrat");
    expect(contrats).toHaveLength(1);
  });

  it("ne compte le salaire qu'une seule fois après fusion, jamais la somme des deux propositions d'origine", () => {
    const fusionnees = fusionnerContratsDupliques(extractionAemDupliqueeHeuresCachets.propositions) as Extract<Proposition, { cible: "contrat" }>[];
    const totalSalaire = fusionnees.filter((p) => p.cible === "contrat").reduce((total, p) => total + p.donnees.salaireBrut, 0);
    expect(totalSalaire).toBe(245); // pas 490 (245 × 2), le bug qu'aurait produit les deux propositions non fusionnées
  });

  it("conserve nbHeures ET nbCachets sur la proposition fusionnée, sans en perdre aucun", () => {
    const [fusionnee] = fusionnerContratsDupliques(extractionAemDupliqueeHeuresCachets.propositions) as Extract<Proposition, { cible: "contrat" }>[];
    expect(fusionnee.donnees.nbHeures).toBe(14);
    expect(fusionnee.donnees.nbCachets).toBe(3);
  });

  // Mis à jour le 01/08/2026 : confirmé par Benoît (règle réelle) que les deux champs comptent
  // ENSEMBLE, jamais un choix exclusif — le moteur a été corrigé en conséquence (decompteHeures.ts).
  it("signale dans la justification que les deux champs comptent ensemble, pas un choix exclusif", () => {
    const [fusionnee] = fusionnerContratsDupliques(extractionAemDupliqueeHeuresCachets.propositions) as Extract<Proposition, { cible: "contrat" }>[];
    expect(fusionnee.justification).toMatch(/comptent ensemble/i);
  });

  it("bout en bout via evaluerExtraction : une seule carte de revue, pas deux, pour ce document", () => {
    const evaluees = evaluerExtraction(extractionAemDupliqueeHeuresCachets, profilBase);
    const contrats = evaluees.filter((e) => e.proposition.cible === "contrat");
    expect(contrats).toHaveLength(1);
  });

  it("ne fusionne PAS deux contrats aux montants différents (pas un vrai doublon)", () => {
    const [a, b] = extractionAemDupliqueeHeuresCachets.propositions as Extract<Proposition, { cible: "contrat" }>[];
    const bMontantDifferent = { ...b, donnees: { ...b.donnees, salaireBrut: 300 } };
    const fusionnees = fusionnerContratsDupliques([a, bMontantDifferent]);
    expect(fusionnees.filter((p) => p.cible === "contrat")).toHaveLength(2);
  });

  it("ne fusionne PAS deux contrats d'employeurs différents, même mêmes dates et montant", () => {
    const [a, b] = extractionAemDupliqueeHeuresCachets.propositions as Extract<Proposition, { cible: "contrat" }>[];
    const bAutreEmployeur = { ...b, donnees: { ...b.donnees, employeur: "Un Autre Employeur Fictif" } };
    const fusionnees = fusionnerContratsDupliques([a, bAutreEmployeur]);
    expect(fusionnees.filter((p) => p.cible === "contrat")).toHaveLength(2);
  });

  it("laisse intacts des contrats normaux qui ne sont pas des doublons (aucun effet de bord)", () => {
    const fusionnees = fusionnerContratsDupliques(extractionBulletinPaie.propositions);
    expect(fusionnees).toEqual(extractionBulletinPaie.propositions);
  });
});

describe("info_seule — jamais routée, jamais perdue", () => {
  it("est signalée comme information avec un motif", () => {
    const proposition: Proposition = {
      cible: "info_seule",
      donnees: { salaireDeReferenceOfficiel: 24800 },
      confiance: { salaireDeReferenceOfficiel: "haute" },
      justification: "test",
    };
    const evaluee = evaluerProposition(proposition, profilBase);
    expect(evaluee.statut).toBe("information");
    expect(evaluee.motif).toBeTruthy();
  });
});

describe("fixtures de démonstration — couvrent bien chaque branche", () => {
  it("la notification est entièrement applicable, hors information", () => {
    const statuts = evaluerExtraction(extractionNotificationAdmission, profilBase).map((e) => e.statut);
    expect(statuts).toEqual(["applicable", "applicable", "applicable", "information"]);
  });

  it("le relevé produit deux refus, une revue formulaire (periode_assimilee) et une information", () => {
    const statuts = evaluerExtraction(extractionReleveAvecRefus, profilBase).map((e) => e.statut);
    expect(statuts.filter((s) => s === "non_applicable")).toHaveLength(2);
    expect(statuts.filter((s) => s === "revue_formulaire")).toHaveLength(1);
    expect(statuts.filter((s) => s === "information")).toHaveLength(1);
  });

  it("appliquer toute la notification produit un profil valide et complet", () => {
    let profil = profilBase;
    for (const evaluee of evaluerExtraction(extractionNotificationAdmission, profilBase)) {
      if (evaluee.statut === "applicable") profil = profilAvecProposition(profil, evaluee.proposition);
    }
    expect(profil.ouvertureDroits?.franchiseCPTotale).toBe(12);
    expect(profil.ouvertureDroits?.delaiAttenteInitial).toBe(7);
    expect(profil.dateAnniversaire).toBe("2026-01-15");
    expect(profil.dureeDroitsMois).toBe(12);
    expect(profil.ajReelleHistorique).toEqual([{ dateEffet: "2026-02-01", valeur: 54.55 }]);
  });

  // 01/08/2026 : le même employeur peut apparaître deux fois dans un justificatif de déclaration
  // mensuelle (un cachet isolé, puis une semaine plus tard) — chaque encadré doit rester une
  // proposition "contrat" indépendante, jamais fusionnée en une seule (cf. api/extract-document.ts).
  it("justificatif de déclaration — le même employeur deux fois reste deux propositions distinctes, jamais fusionnées", () => {
    const contrats = extractionJustificatifDeclaration.propositions.filter((p) => p.cible === "contrat");
    expect(contrats).toHaveLength(3);
    const memeEmployeur = contrats.filter((p) => p.donnees.employeur === "Orchestre Fictif de la Vallée");
    expect(memeEmployeur).toHaveLength(2);
    expect(memeEmployeur[0].donnees.dateDebut).not.toBe(memeEmployeur[1].donnees.dateDebut);
    expect(memeEmployeur[0].donnees.nbCachets).not.toBe(memeEmployeur[1].donnees.nbCachets);

    const statuts = evaluerExtraction(extractionJustificatifDeclaration, profilBase).map((e) => e.statut);
    expect(statuts.filter((s) => s === "revue_formulaire")).toHaveLength(3); // une par encadré, pas une par employeur
    expect(statuts.filter((s) => s === "information")).toHaveLength(1); // le total mixte, jamais un contrat
  });

  it("justificatif de déclaration — le total mixte du bas de document ne remplit aucun nbHeures/nbCachets individuel", () => {
    for (const p of extractionJustificatifDeclaration.propositions) {
      if (p.cible !== "contrat") continue;
      // Chaque contrat individuel a soit nbHeures soit nbCachets, jamais les deux mélangés dans un
      // seul champ composite comme le "105 h (21 h + 7 cachet(s))" du total.
      expect(typeof p.donnees.nbHeures === "number" ? p.donnees.nbCachets : p.donnees.nbHeures).toBeNull();
    }
  });
});
