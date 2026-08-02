import { describe, expect, it } from "vitest";
import type { Profil } from "../../types";
import type { ExtractionResult, Proposition } from "../../types/extraction";
import { contrat } from "../../engine/__tests__/testUtils";
import { RAPPEL_AEM_FAIT_FOI } from "../../content/rappelAEM";
import {
  comparerContratExistant,
  contratConfirmeDepuisCorrespondance,
  contratDepuisProposition,
  detecterMergeAmbiguHeuresCachets,
  evaluerExtraction,
  evaluerProposition,
  fusionnerContratsDupliques,
  periodeDepuisProposition,
  profilAvecProposition,
} from "../routageExtraction";
import {
  extractionAemDupliqueeHeuresCachets,
  extractionAemHeuresEtCachets,
  extractionAttestationTauxPAS,
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

// Partagée entre les deux describe ci-dessous : depuis le 02/08/2026, TOUT canal (relevé/notification
// ou attestation dédiée) qui trouve un taux produit ce type de proposition, jamais un champ sur
// profil_ouverture_droits (cf. types/extraction.ts, Cible 2 vs Cible 6).
function propositionTaux(valeur: number, dateEffet: string): Proposition {
  return {
    cible: "taux_pas_historique",
    donnees: { valeur, dateEffet },
    confiance: { valeur: "haute", dateEffet: "haute" },
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
  // Depuis le 02/08/2026, cette cible ne porte plus AUCUN champ de taux (cf. types/extraction.ts,
  // Cible 2) : un relevé/notification qui en trouve un produit une proposition taux_pas_historique
  // séparée (cf. describe ci-dessous), jamais un champ ici.
  const complete: Proposition = {
    cible: "profil_ouverture_droits",
    donnees: { dateOuverture: "2026-02-01", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-31" },
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

  it("ne touche jamais tauxPrelevementSourceHistorique, quel que soit son contenu (cette cible n'a plus aucun champ de taux)", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2025-02-01", valeur: 3.1 }], dateLimiteIndemnisation: "2026-01-31" },
    };
    const sansDateLimite = { ...complete, donnees: { ...complete.donnees, dateLimiteIndemnisation: null } } as Proposition;
    const resultat = profilAvecProposition(profil, sansDateLimite);
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2025-02-01", valeur: 3.1 }]);
    expect(resultat.ouvertureDroits?.dateLimiteIndemnisation).toBe("2026-01-31");
  });

  it("applicable si dateLimiteIndemnisation est donné seul, quand ouvertureDroits existe déjà (ex. relevé qui ne redonne que la date limite)", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const dateLimiteSeule = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: "2026-01-31" },
    } as Proposition;
    expect(evaluerProposition(dateLimiteSeule, profil).statut).toBe("applicable");
  });

  it("récupère dateOuverture/franchiseCPTotale/delaiAttenteInitial du profil existant quand la proposition ne donne que dateLimiteIndemnisation", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 },
    };
    const dateLimiteSeule = {
      ...complete,
      donnees: { ...complete.donnees, dateOuverture: "", franchiseCPTotale: null, delaiAttenteInitial: null, dateLimiteIndemnisation: "2026-01-31" },
    } as Proposition;
    const resultat = profilAvecProposition(profil, dateLimiteSeule);
    expect(resultat.ouvertureDroits?.dateOuverture).toBe("2025-02-01");
    expect(resultat.ouvertureDroits?.franchiseCPTotale).toBe(5);
    expect(resultat.ouvertureDroits?.delaiAttenteInitial).toBe(7);
    expect(resultat.ouvertureDroits?.dateLimiteIndemnisation).toBe("2026-01-31");
  });
});

describe("taux_pas_historique — commun à tout canal depuis le 02/08/2026, une proposition par taux, jamais un choix de valeur primaire", () => {
  it("non applicable tant qu'aucune ouverture de droits n'est connue (rien où le rattacher)", () => {
    const evaluee = evaluerProposition(propositionTaux(3.1, "2026-01-01"), profilBase);
    expect(evaluee.statut).toBe("non_applicable");
    expect(evaluee.motif).toMatch(/ouverture de droits/i);
  });

  it("applicable dès qu'une ouverture de droits existe déjà", () => {
    const profil: Profil = { ...profilBase, ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 } };
    expect(evaluerProposition(propositionTaux(3.1, "2026-01-01"), profil).statut).toBe("applicable");
  });

  it("refuse d'écrire au profil même si l'évaluation est contournée, sans ouvertureDroits", () => {
    expect(() => profilAvecProposition(profilBase, propositionTaux(3.1, "2026-01-01"))).toThrow(/ouverture de droits/i);
  });

  it("ajoute le taux à l'historique existant sans écraser les entrées déjà présentes", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2025-02-01", valeur: 2.9 }] },
    };
    const resultat = profilAvecProposition(profil, propositionTaux(3.45, "2026-01-01"));
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([
      { dateEffet: "2025-02-01", valeur: 2.9 },
      { dateEffet: "2026-01-01", valeur: 3.45 },
    ]);
  });

  it("ne touche à aucun autre champ de ouvertureDroits (franchise, délai, date limite inchangés)", () => {
    const profil: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2026-01-31" },
    };
    const resultat = profilAvecProposition(profil, propositionTaux(3.1, "2026-01-01"));
    expect(resultat.ouvertureDroits?.franchiseCPTotale).toBe(5);
    expect(resultat.ouvertureDroits?.delaiAttenteInitial).toBe(7);
    expect(resultat.ouvertureDroits?.dateLimiteIndemnisation).toBe("2026-01-31");
  });

  it("un même dateEffet réappliqué remplace l'entrée existante plutôt que d'en créer une seconde (document réimporté)", () => {
    const profilExistant: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-03-24", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-17", valeur: 3.1 }] },
    };
    const resultat = profilAvecProposition(profilExistant, propositionTaux(3.1, "2026-02-17"));
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([{ dateEffet: "2026-02-17", valeur: 3.1 }]);
  });

  it("régression réelle 01/08/2026 : un second relevé plus récent AJOUTE une entrée, ne remplace jamais l'historique (3,30 % mi-2025 puis 3,10 % fin 2025/2026, cf. relevés réels du dossier)", () => {
    const profilApresPremierReleve: Profil = {
      ...profilBase,
      ouvertureDroits: { dateOuverture: "2025-03-24", franchiseCPTotale: 5, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2025-07-03", valeur: 3.3 }] },
    };
    const resultat = profilAvecProposition(profilApresPremierReleve, propositionTaux(3.1, "2026-02-17"));
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([
      { dateEffet: "2025-07-03", valeur: 3.3 },
      { dateEffet: "2026-02-17", valeur: 3.1 },
    ]);
  });

  // Le cœur de CE chantier (02/08/2026) : un relevé/notification qui montre deux sections datées à
  // des taux DIFFÉRENTS ne doit jamais en choisir une comme "primaire" — chaque section devient sa
  // propre proposition taux_pas_historique, exactement comme pour l'attestation dédiée (cf. fixture
  // attestation_taux_pas ci-dessous). Aucune fixture dédiée : construit inline, ce canal ne produit
  // plus de champ de taux sur profil_ouverture_droits (cf. describe précédent).
  it("relevé de situation à deux sections avec des taux DIFFÉRENTS : les deux propositions taux_pas_historique s'appliquent séparément, aucune n'est perdue ni choisie comme primaire", () => {
    const ouverture: Proposition = {
      cible: "profil_ouverture_droits",
      donnees: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
      confiance: {},
      justification: "test",
    };
    const sectionAncienne = propositionTaux(2.9, "2026-06-28"); // « Situation au 28/06/2026 »
    const sectionRecente = propositionTaux(3.45, "2026-07-13"); // « Situation au 13/07/2026 »

    let profil = profilAvecProposition(profilBase, ouverture);
    profil = profilAvecProposition(profil, sectionAncienne);
    profil = profilAvecProposition(profil, sectionRecente);

    expect(profil.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([
      { dateEffet: "2026-06-28", valeur: 2.9 },
      { dateEffet: "2026-07-13", valeur: 3.45 },
    ]);
  });

  // Répond à la question d'ordre posée avant la rédaction du prompt (étape 3) : evaluerExtraction
  // est un simple .map() par proposition (cf. routageExtraction.ts), sans dépendance entre elles —
  // l'ordre des deux propositions dans le tableau `propositions` n'a donc AUCUNE influence sur leur
  // statut individuel. Testé dans les deux ordres pour le prouver, pas juste l'affirmer.
  it.each([
    ["profil_ouverture_droits avant taux_pas_historique", true],
    ["taux_pas_historique avant profil_ouverture_droits", false],
  ])("ordre dans le tableau propositions (%s) : chaque statut ne dépend que du profil actuel, jamais de la position dans le tableau", (_cas, ouvertureEnPremier) => {
    const ouverture: Proposition = {
      cible: "profil_ouverture_droits",
      donnees: { dateOuverture: "2026-01-18", franchiseCPTotale: 5, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
      confiance: {},
      justification: "test",
    };
    const taux = propositionTaux(3.1, "2026-01-18");
    const resultat: ExtractionResult = {
      typeDocumentDetecte: "releve_situation",
      propositions: ouvertureEnPremier ? [ouverture, taux] : [taux, ouverture],
      avertissementsGeneraux: [],
    };

    // Sans ouvertureDroits connue : la proposition profil_ouverture_droits est TOUJOURS applicable
    // (elle ne dépend de rien d'autre), le taux TOUJOURS non_applicable (rien où le rattacher) —
    // quel que soit l'ordre des deux dans le tableau.
    const evaluees = evaluerExtraction(resultat, profilBase);
    const evalueeOuverture = evaluees.find((e) => e.proposition.cible === "profil_ouverture_droits")!;
    const evalueeTaux = evaluees.find((e) => e.proposition.cible === "taux_pas_historique")!;
    expect(evalueeOuverture.statut).toBe("applicable");
    expect(evalueeTaux.statut).toBe("non_applicable");

    // Une fois profil_ouverture_droits appliqué (clic utilisateur sur cette carte), une réévaluation
    // du MÊME tableau — RevueExtraction.tsx recalcule evaluerExtraction à chaque rendu, cf.
    // routageExtraction.ts — fait immédiatement passer le taux à "applicable" : rien n'est perdu,
    // l'utilisateur n'a qu'à appliquer les deux cartes dans l'ordre où elles se présentent à l'écran.
    const profilApresOuverture = profilAvecProposition(profilBase, evalueeOuverture.proposition);
    const evalueesApres = evaluerExtraction(resultat, profilApresOuverture);
    const evalueeTauxApres = evalueesApres.find((e) => e.proposition.cible === "taux_pas_historique")!;
    expect(evalueeTauxApres.statut).toBe("applicable");
  });

  // Le cœur du chantier (cf. types/extraction.ts) : une attestation qui liste plusieurs taux
  // successifs produit une proposition PAR taux, jamais une seule proposition qui aurait choisi le
  // taux le plus récent (ou tout autre critère) comme valeur "primaire" au détriment des autres.
  it("fixture attestation_taux_pas — deux taux distincts restent deux propositions séparées, jamais fusionnées ni réduites à une seule", () => {
    const propositions = extractionAttestationTauxPAS.propositions;
    expect(propositions).toHaveLength(2);
    expect(propositions.every((p) => p.cible === "taux_pas_historique")).toBe(true);
    const valeurs = propositions.map((p) => (p as Extract<Proposition, { cible: "taux_pas_historique" }>).donnees.valeur);
    expect(valeurs).toEqual([2.9, 3.45]);
  });

  it("fixture attestation_taux_pas — appliquer les deux propositions dans l'ordre reconstruit tout l'historique", () => {
    const profil: Profil = { ...profilBase, ouvertureDroits: { dateOuverture: "2025-02-01", franchiseCPTotale: 5, delaiAttenteInitial: 7 } };
    let resultat = profil;
    for (const evaluee of evaluerExtraction(extractionAttestationTauxPAS, profil)) {
      expect(evaluee.statut).toBe("applicable");
      resultat = profilAvecProposition(resultat, evaluee.proposition);
    }
    expect(resultat.ouvertureDroits?.tauxPrelevementSourceHistorique).toEqual([
      { dateEffet: "2025-01-01", valeur: 2.9 },
      { dateEffet: "2026-01-01", valeur: 3.45 },
    ]);
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
    // 4, pas 3 : extractionBulletinPaie a natureDocumentSource: "bulletin_paie" (cf.
    // fixturesExtraction.ts) — s'ajoute donc l'avertissement AEM vs bulletin (cf. describe dédié).
    expect(avertissements).toHaveLength(4);
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

  // 01/08/2026 : diagnosticAbsence n'est renseigné QUE quand correspondances est vide — jamais une
  // seconde correspondance, seulement une piste sur pourquoi rien n'a été proposé.
  it("renseigne diagnosticAbsence quand aucun contrat existant ne correspond", () => {
    const { correspondances, diagnosticAbsence } = evaluerProposition(proposition, profilBase, []);
    expect(correspondances).toEqual([]);
    expect(diagnosticAbsence).toEqual({ type: "aucune_piste" });
  });

  it("laisse diagnosticAbsence absent dès qu'une correspondance existe", () => {
    const contratExistant = contrat({
      date: proposition.donnees.date,
      dateDebut: proposition.donnees.dateDebut ?? proposition.donnees.date,
      employeur: proposition.donnees.employeur,
      salaireBrut: proposition.donnees.salaireBrut,
      statutVerification: "a_verifier",
    });
    const { correspondances, diagnosticAbsence } = evaluerProposition(proposition, profilBase, [contratExistant]);
    expect(correspondances).toHaveLength(1);
    expect(diagnosticAbsence).toBeUndefined();
  });
});

// 01/08/2026 : plan "cycle de vie du contrat" — une proposition "contrat" issue d'un document
// importé doit signaler les contrats "a_verifier" existants qui pourraient être le même contrat,
// pour que RevueExtraction.tsx propose une correspondance plutôt qu'une création systématique.
// 02/08/2026 : l'alerte statique du canal manuel (ImportBulletins.tsx) n'existait que là — le canal
// IA ne distinguait jamais un bulletin d'une AEM pour avertir l'utilisateur. natureDocumentSource
// (types/extraction.ts) ferme ce trou : un avertissement conditionnel, jamais un blocage, jamais un
// avertissement sur un cas non déterminé (faux positif aussi gênant qu'un faux silence).
describe("contrat — avertissement AEM vs bulletin de paie (natureDocumentSource)", () => {
  function propositionAvecNature(nature: "aem" | "bulletin_paie" | null): Extract<Proposition, { cible: "contrat" }> {
    return {
      cible: "contrat",
      donnees: {
        natureDocumentSource: nature,
        date: "2026-06-28",
        dateDebut: "2026-06-24",
        type: null,
        typeRemuneration: null,
        territoire: null,
        nbCachets: null,
        nbHeures: null,
        nbJoursEEE: null,
        salaireBrut: 500,
        employeur: "Test",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: {},
      justification: "test",
    };
  }

  it("aucun avertissement quand le document est une vraie AEM", () => {
    const { avertissements } = evaluerProposition(propositionAvecNature("aem"), profilBase);
    expect(avertissements.some((a) => a.includes("AEM"))).toBe(false);
  });

  it("avertissement clair quand le document est un bulletin de paie", () => {
    const { avertissements } = evaluerProposition(propositionAvecNature("bulletin_paie"), profilBase);
    const alerte = avertissements.find((a) => a.includes("bulletin de paie"));
    expect(alerte).toBeDefined();
    expect(alerte).toMatch(/AEM/);
    expect(alerte).toMatch(/France Travail/);
  });

  it("aucun avertissement quand le document ne permet pas de trancher (null) — jamais un faux avertissement", () => {
    const { avertissements } = evaluerProposition(propositionAvecNature(null), profilBase);
    expect(avertissements.some((a) => a.includes("AEM"))).toBe(false);
  });

  it("fixture réelle : extractionAemHeuresEtCachets (aem) ne déclenche aucun avertissement AEM", () => {
    const propositionAem = extractionAemHeuresEtCachets.propositions[0] as Extract<Proposition, { cible: "contrat" }>;
    const { avertissements } = evaluerProposition(propositionAem, profilBase);
    expect(avertissements.some((a) => a.includes("bulletin de paie"))).toBe(false);
  });

  it("fixture réelle : extractionJustificatifDeclaration (ni AEM ni bulletin, natureDocumentSource null) ne déclenche aucun avertissement AEM", () => {
    const propositions = extractionJustificatifDeclaration.propositions.filter((p) => p.cible === "contrat");
    for (const p of propositions) {
      const { avertissements } = evaluerProposition(p, profilBase);
      expect(avertissements.some((a) => a.includes("AEM"))).toBe(false);
    }
  });

  it("l'avertissement reprend le texte de référence unique RAPPEL_AEM_FAIT_FOI (content/rappelAEM.ts), harmonisé avec le canal manuel", () => {
    const { avertissements } = evaluerProposition(propositionAvecNature("bulletin_paie"), profilBase);
    const alerte = avertissements.find((a) => a.includes("bulletin de paie"));
    expect(alerte).toContain(RAPPEL_AEM_FAIT_FOI);
  });
});

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

describe("comparerContratExistant — tableau Existant/Document avant confirmation d'une correspondance", () => {
  const propositionDonnees = (extractionBulletinPaie.propositions[0] as Extract<Proposition, { cible: "contrat" }>).donnees;

  it("marque un champ différent avec identique: false (ex. salaireBrut saisi à la main vs document)", () => {
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: 999 });
    const comparaisons = comparerContratExistant(existant, propositionDonnees);
    const salaire = comparaisons.find((c) => c.champ === "salaireBrut");
    expect(salaire).toEqual({ champ: "salaireBrut", existant: 999, document: propositionDonnees.salaireBrut, identique: false });
  });

  // 01/08/2026 : un champ identique n'est plus filtré — il apparaît comme une ligne à part
  // entière (identique: true), pour que le tableau reste complet et ne recrée pas le piège
  // "silence = identique, pas explicite" déjà corrigé pour les correspondances absentes.
  it("marque un champ identique avec identique: true, ne le filtre PAS hors du résultat", () => {
    const existant = contrat({
      date: propositionDonnees.date,
      dateDebut: propositionDonnees.dateDebut ?? propositionDonnees.date,
      employeur: propositionDonnees.employeur,
      salaireBrut: propositionDonnees.salaireBrut,
    });
    const comparaisons = comparerContratExistant(existant, propositionDonnees);
    const employeur = comparaisons.find((c) => c.champ === "employeur");
    expect(employeur).toEqual({ champ: "employeur", existant: propositionDonnees.employeur, document: propositionDonnees.employeur, identique: true });
  });

  it("n'inclut JAMAIS un champ que le document n'a pas lu (null), même si le contrat existant a une valeur", () => {
    // extractionBulletinPaie a type/typeRemuneration/territoire à null (cf. fixturesExtraction.ts)
    const existant = contrat({ date: propositionDonnees.date, employeur: propositionDonnees.employeur, salaireBrut: propositionDonnees.salaireBrut, type: "enseignement" });
    const comparaisons = comparerContratExistant(existant, propositionDonnees);
    expect(comparaisons.find((c) => c.champ === "type")).toBeUndefined();
  });

  it("quand tout correspond déjà, retourne une ligne par champ lu, toutes identique: true — jamais un tableau vide", () => {
    const existant = contrat({
      date: propositionDonnees.date,
      dateDebut: propositionDonnees.dateDebut ?? propositionDonnees.date,
      employeur: propositionDonnees.employeur,
      salaireBrut: propositionDonnees.salaireBrut,
    });
    const comparaisons = comparerContratExistant(existant, propositionDonnees);
    expect(comparaisons.length).toBeGreaterThan(0); // date, dateDebut, salaireBrut, employeur — pas []
    expect(comparaisons.every((c) => c.identique)).toBe(true);
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

// Point E de la cartographie du 01/08/2026 : "Confirmer la correspondance" appelle
// contratConfirmeDepuisCorrespondance en écriture directe, en un clic, sans passer par
// ContractForm — donc sans la case "Activité mixte". detecterMergeAmbiguHeuresCachets protège CE
// chemin précis : RevueExtraction.tsx ne doit jamais appeler contratConfirmeDepuisCorrespondance
// quand cette fonction retourne un diagnostic — elle affiche un état "à vérifier manuellement" à
// la place (aucune fusion, aucune donnée réinitialisée).
describe("detecterMergeAmbiguHeuresCachets — protège 'Confirmer la correspondance' (point E)", () => {
  const seulementHeures = (extractionAemDupliqueeHeuresCachets.propositions[0] as Extract<Proposition, { cible: "contrat" }>).donnees; // nbHeures: 14, nbCachets: null
  const seulementCachets = (extractionAemDupliqueeHeuresCachets.propositions[1] as Extract<Proposition, { cible: "contrat" }>).donnees; // nbCachets: 3, nbHeures: null
  const lesDeux = (extractionAemHeuresEtCachets.propositions[0] as Extract<Proposition, { cible: "contrat" }>).donnees; // nbCachets: 3, nbHeures: 14

  it("détecte l'ambiguïté : document ne fournit que nbHeures, le contrat existant a déjà nbCachets", () => {
    const existant = contrat({ date: seulementHeures.date, employeur: seulementHeures.employeur, salaireBrut: 245, nbCachets: 6 });
    const diagnostic = detecterMergeAmbiguHeuresCachets(existant, seulementHeures);
    expect(diagnostic).toEqual({ champManquant: "nbCachets", valeurExistante: 6 });
  });

  it("détecte l'ambiguïté dans l'autre sens : document ne fournit que nbCachets, le contrat existant a déjà nbHeures", () => {
    const existant = contrat({ date: seulementCachets.date, employeur: seulementCachets.employeur, salaireBrut: 245, nbHeures: 72 });
    const diagnostic = detecterMergeAmbiguHeuresCachets(existant, seulementCachets);
    expect(diagnostic).toEqual({ champManquant: "nbHeures", valeurExistante: 72 });
  });

  it("pas d'ambiguïté quand le document fournit les deux champs (mixte confirmé par la source elle-même)", () => {
    const existant = contrat({ date: lesDeux.date, employeur: lesDeux.employeur, salaireBrut: 245, nbCachets: 6, nbHeures: 72 });
    expect(detecterMergeAmbiguHeuresCachets(existant, lesDeux)).toBeNull();
  });

  it("pas d'ambiguïté quand le contrat existant n'a pas l'autre champ (rien à écraser)", () => {
    const existant = contrat({ date: seulementHeures.date, employeur: seulementHeures.employeur, salaireBrut: 245 });
    expect(detecterMergeAmbiguHeuresCachets(existant, seulementHeures)).toBeNull();
  });

  it("reproduit le bug réel (avant garde-fou) : contratConfirmeDepuisCorrespondance fusionnerait silencieusement — preuve que le garde-fou est nécessaire en amont", () => {
    const existant = contrat({ date: seulementHeures.date, employeur: seulementHeures.employeur, salaireBrut: 245, nbCachets: 6 });
    // Le diagnostic doit être posé AVANT tout appel à contratConfirmeDepuisCorrespondance —
    // RevueExtraction.tsx ne l'appelle que si detecterMergeAmbiguHeuresCachets est null.
    expect(detecterMergeAmbiguHeuresCachets(existant, seulementHeures)).not.toBeNull();
    // Si l'appel avait quand même lieu (comportement d'avant ce chantier), la fusion doublerait
    // bien les heures — la preuve que ce cas doit être intercepté, pas laissé passer.
    const fusionSiAppelee = contratConfirmeDepuisCorrespondance(existant, seulementHeures);
    expect(fusionSiAppelee.nbHeures).toBe(14);
    expect(fusionSiAppelee.nbCachets).toBe(6); // les deux se retrouveraient sommés par le moteur
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
  it("la notification est applicable, hors information et hors le taux (qui attend que l'ouverture de droits soit d'abord appliquée)", () => {
    // Le taux (proposition séparée depuis le 02/08/2026) est non_applicable ici car profilBase n'a
    // pas encore d'ouvertureDroits — comportement attendu, pas un bug : cf. le test d'ordre plus haut
    // (« ordre dans le tableau propositions »), il repasse à "applicable" dès que la proposition
    // profil_ouverture_droits voisine est appliquée.
    const statuts = evaluerExtraction(extractionNotificationAdmission, profilBase).map((e) => e.statut);
    expect(statuts).toEqual(["applicable", "non_applicable", "applicable", "applicable", "information"]);
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
