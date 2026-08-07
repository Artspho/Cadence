import { describe, expect, it } from "vitest";
import { aDesManquesBloquants, documentsRequis, progressionDocuments, type IdDocument, type LigneDocument } from "../documentsRequis";
import { contrat, profil } from "../../engine/__tests__/testUtils";
import type { Profil } from "../../types";

function ligne(lignes: LigneDocument[], id: IdDocument): LigneDocument {
  const trouvee = lignes.find((l) => l.id === id);
  if (!trouvee) throw new Error(`Ligne « ${id} » absente de la checklist.`);
  return trouvee;
}

function libelles(l: LigneDocument): string[] {
  return l.manques.map((m) => m.libelle);
}

/** Profil dont TOUT ce que la checklist réclame est renseigné (première admission). */
const profilComplet: Profil = profil({
  ajReelleHistorique: [{ dateEffet: "2026-02-05", valeur: 53.81 }],
  ouvertureDroits: {
    dateOuverture: "2026-02-05",
    franchiseCPTotale: 12,
    delaiAttenteInitial: 7,
    tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-05", valeur: 3.1 }],
    dateLimiteIndemnisation: "2027-01-17",
  },
});

describe("documentsRequis — notification d'admission", () => {
  it("profil null (tout premier lancement) -> rien de renseigné", () => {
    const l = ligne(documentsRequis(null, []), "notification_admission");
    expect(l.statut).toBe("rien_renseigne");
    expect(l.nbManquesBloquants).toBe(3);
  });

  it("profil complet -> complet, aucun manque", () => {
    const l = ligne(documentsRequis(profilComplet, []), "notification_admission");
    expect(l.statut).toBe("complet");
    expect(l.manques).toEqual([]);
    expect(l.nbManquesBloquants).toBe(0);
  });

  it("profil partiellement renseigné -> incomplet, PAS « rien de renseigné »", () => {
    // La date de naissance est là (via la fabrique), le reste non : c'est bien un état intermédiaire.
    const l = ligne(documentsRequis(profil(), []), "notification_admission");
    expect(l.statut).toBe("incomplet");
    expect(l.nbManquesBloquants).toBe(2);
    expect(libelles(l)).toContain("Allocation journalière nette");
    expect(libelles(l)).not.toContain("Date de naissance");
  });

  it("les trois paramètres d'ouverture ne font qu'UN manque, jamais trois", () => {
    const l = ligne(documentsRequis(profil(), []), "notification_admission");
    const ouverture = l.manques.filter((m) => m.libelle.startsWith("Paramètres de ton ouverture"));
    expect(ouverture).toHaveLength(1);
  });

  it("le manque d'AJ nette renvoie vers la notification et avertit du montant brut du relevé", () => {
    // Signalétique du Point 2 (brut/nette) : la checklist ne convertit rien, elle oriente. Ce test
    // fixe la promesse — sans lui, une reformulation pourrait la faire disparaître sans bruit.
    const l = ligne(documentsRequis(profil(), []), "notification_admission");
    const aj = l.manques.find((m) => m.libelle === "Allocation journalière nette");
    expect(aj?.consequence).toContain("BRUT");
    expect(aj?.consequence).toContain("nette");
  });

  it("les manques bloquants sont listés avant les précisions", () => {
    const p = profil({ ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7 } });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    const indexPremierePrecision = l.manques.findIndex((m) => m.poids === "precision");
    const indexDernierBloquant = l.manques.map((m) => m.poids).lastIndexOf("bloquant");
    expect(indexDernierBloquant).toBeLessThan(indexPremierePrecision);
  });
});

describe("documentsRequis — dateAnniversaire, légitimement absente en première admission", () => {
  // Piège vérifié dans le code : `periodeReference.ts:41` retombe sur la date du jour, et
  // l'onboarding propose explicitement « je ne la connais pas ». La réclamer en première admission
  // afficherait un manque que l'utilisateur ne peut pas combler — un faux « manquant ».
  it("première admission sans date anniversaire -> PAS un manque", () => {
    const p = profil({ ...profilComplet, situation: "premiere_admission", dateAnniversaire: "" });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    expect(l.statut).toBe("complet");
    expect(libelles(l).join(" ")).not.toContain("Date anniversaire (fin du contrat");
  });

  it("réadmission sans date anniversaire -> manque bloquant", () => {
    const p = profil({ ...profilComplet, situation: "readmission", dateAnniversaire: "" });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    expect(l.statut).toBe("incomplet");
    expect(libelles(l)).toContain("Date anniversaire (fin du contrat qui a ouvert tes droits)");
  });

  it("réadmission sans date anniversaire précédente -> précision seulement, n'empêche pas « complet »", () => {
    const p = profil({ ...profilComplet, situation: "readmission" });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    expect(l.statut).toBe("complet");
    expect(l.nbManquesBloquants).toBe(0);
    expect(libelles(l)).toContain("Date anniversaire précédente (sur ta notification précédente)");
  });

  it("première admission : la date anniversaire précédente n'est jamais réclamée", () => {
    const l = ligne(documentsRequis(profilComplet, []), "notification_admission");
    expect(libelles(l).join(" ")).not.toContain("précédente");
  });
});

describe("documentsRequis — précisions inatteignables non réclamées", () => {
  // Sans `ouvertureDroits`, ces deux champs ne peuvent PAS exister : les lister ferait deux faux
  // manques de plus pour un seul et même trou, déjà signalé par le manque des paramètres d'ouverture.
  it("ouvertureDroits absent -> ni date limite ni taux dans les manques", () => {
    const l = ligne(documentsRequis(profil(), []), "notification_admission");
    expect(libelles(l)).not.toContain("Date limite de ton indemnisation");
    expect(libelles(l)).not.toContain("Taux de prélèvement à la source");
  });

  it("ouvertureDroits présent mais incomplet -> les deux champs apparaissent", () => {
    const p = profil({ ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7 } });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    expect(libelles(l)).toContain("Date limite de ton indemnisation");
    expect(libelles(l)).toContain("Taux de prélèvement à la source");
  });
});

describe("documentsRequis — bloquant vs précision : la frontière est « l'app affiche-t-elle un chiffre faux ? »", () => {
  const ouvertureSansDateLimite = { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-05", valeur: 3.1 }] };

  it("dateLimiteIndemnisation est BLOQUANTE : son absence produit de vrais mois erronés", () => {
    // Vérifié le 29/07/2026 dans le moteur : la borne dure de calculerSerieDepuisContrats est sautée
    // quand le champ est absent (indemnisationMensuelle.ts:254), la série retombe sur dateDuJour
    // (:246), et RevenusMensuels.tsx ne mentionne ce champ nulle part — aucune troncature, aucun
    // avertissement. Deux tests voisins du moteur le prouvent sur le même profil
    // (indemnisationMensuelle.test.ts:372 et :401) : 2027-01 avec la date, 2027-02 sans elle, ce
    // dernier mois portant un montant alors que les droits sont clos.
    // Ce test verrouille le classement : le repasser en "precision" rendrait « complète » atteignable
    // avec de faux montants à l'écran — devoir sacré n°2.
    const p = profil({ ...profilComplet, ouvertureDroits: ouvertureSansDateLimite });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    const manque = l.manques.find((m) => m.libelle === "Date limite de ton indemnisation");
    expect(manque?.poids).toBe("bloquant");
    expect(l.statut).toBe("incomplet");
    expect(l.nbManquesBloquants).toBe(1);
  });

  it("le taux PAS est une PRÉCISION : l'app dégrade honnêtement et le dit", () => {
    // Contraste vérifié : sans le taux, l'en-tête devient « ≈ Montant (AJ relevé) » au lieu de
    // « Montant net avant PAS » (RevenusMensuels.tsx:364) et un avertissement ambre invite à le
    // renseigner (:446). Aucun chiffre faux — d'où « précision », et « complète » reste atteignable.
    const p = profil({
      ...profilComplet,
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    const l = ligne(documentsRequis(p, []), "notification_admission");
    expect(l.manques.find((m) => m.libelle === "Taux de prélèvement à la source")?.poids).toBe("precision");
    expect(l.statut).toBe("complet");
    expect(l.nbManquesBloquants).toBe(0);
  });
});

describe("documentsRequis — données volontairement jamais réclamées", () => {
  // dureeDroitsMois : absent, le moteur retombe sur 12, et la franchise salaires qui le consomme
  // n'est jamais active dans l'app (aucun appelant ne fournit le SR/SJM). Le réclamer enverrait
  // chercher un chiffre sans effet observable. salairesHorsAnnexe10PRA : indissociable de
  // regimeDeclare, jamais déduit d'un document.
  it("ni dureeDroitsMois, ni salaires hors Annexe 10, ni situation ne sont réclamés", () => {
    const tout = documentsRequis(profil(), [])
      .flatMap(libelles)
      .join(" ")
      .toLowerCase();
    expect(tout).not.toContain("durée de tes droits");
    expect(tout).not.toContain("hors annexe");
    expect(tout).not.toContain("première admission");
  });
});

describe("documentsRequis — bulletins / AEM : jamais « complet »", () => {
  // Limite assumée, et la plus importante du fichier : l'app ne connaît pas la liste des mois
  // travaillés. Un « complet » ici serait un faux feu vert sur le compteur des 507 h lui-même.
  it("aucun contrat -> rien de renseigné, un manque bloquant", () => {
    const l = ligne(documentsRequis(profilComplet, []), "bulletins_aem");
    expect(l.statut).toBe("rien_renseigne");
    expect(l.nbManquesBloquants).toBe(1);
    expect(l.nbContrats).toBe(0);
  });

  it("des contrats -> non évaluable, JAMAIS complet, et la limite est dite", () => {
    const contrats = [contrat({ date: "2026-03-15" }), contrat({ date: "2026-04-20" })];
    const l = ligne(documentsRequis(profilComplet, contrats), "bulletins_aem");
    expect(l.statut).toBe("non_evaluable");
    expect(l.statut).not.toBe("complet");
    expect(l.manques).toEqual([]);
    expect(l.nbContrats).toBe(2);
    expect(l.note).toBeDefined();
    expect(l.note).toContain("507");
  });

  it("beaucoup de contrats ne suffisent jamais à passer « complet »", () => {
    const contrats = Array.from({ length: 30 }, (_, i) => contrat({ date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}` }));
    expect(ligne(documentsRequis(profilComplet, contrats), "bulletins_aem").statut).toBe("non_evaluable");
  });
});

describe("documentsRequis — lignes de complément et d'exception", () => {
  it("le relevé de situation n'a pas de statut calculable et avertit du montant brut", () => {
    const l = ligne(documentsRequis(profilComplet, []), "releve_situation");
    expect(l.statut).toBe("non_evaluable");
    expect(l.role).toBe("complement");
    expect(l.manques).toEqual([]);
    expect(l.note).toContain("BRUT");
  });

  it("l'attestation CPAM ne promet rien tant qu'aucune période ne peut être enregistrée", () => {
    const l = ligne(documentsRequis(profilComplet, []), "attestation_cpam");
    expect(l.statut).toBe("non_evaluable");
    expect(l.role).toBe("seulement_si_concerne");
    expect(l.note).toContain("ne sait pas encore");
  });

  it("l'attestation de taux n'apparaît QUE si le taux manque", () => {
    // Une ligne sans objet dans une checklist dilue les vrais manques.
    expect(documentsRequis(profilComplet, []).map((l) => l.id)).not.toContain("attestation_taux");

    const sansTaux = profil({
      ...profilComplet,
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7 },
    });
    expect(documentsRequis(sansTaux, []).map((l) => l.id)).toContain("attestation_taux");
  });

  it("profil null : l'attestation de taux est proposée (le taux manque forcément)", () => {
    expect(documentsRequis(null, []).map((l) => l.id)).toContain("attestation_taux");
  });
});

describe("aDesManquesBloquants", () => {
  it("profil et contrats complets -> aucun manque bloquant", () => {
    const lignes = documentsRequis(profilComplet, [contrat({ date: "2026-03-15" })]);
    expect(aDesManquesBloquants(lignes)).toBe(false);
  });

  it("des précisions manquantes ne déclenchent PAS de mise en avant", () => {
    // Crier au loup pour une précision reviendrait à user l'attention sur ce qui ne bloque rien.
    const p = profil({ ...profilComplet, situation: "readmission" }); // dateAnniversairePrecedente absente
    const lignes = documentsRequis(p, [contrat({ date: "2026-03-15" })]);
    expect(lignes.some((l) => l.manques.some((m) => m.poids === "precision"))).toBe(true);
    expect(aDesManquesBloquants(lignes)).toBe(false);
  });

  it("un contrat manquant suffit à déclencher la mise en avant", () => {
    expect(aDesManquesBloquants(documentsRequis(profilComplet, []))).toBe(true);
  });
});

describe("progressionDocuments — dénominateur dynamique, jamais un total fixe", () => {
  // Le nombre de bloquants applicables dépend de la situation (première admission vs réadmission) et
  // de ce qui est déjà renseigné (dateLimiteIndemnisation n'est applicable que si ouvertureDroits
  // existe) — un « /9 » écrit en dur mentirait dans les deux cas.
  it("profil null, aucun contrat -> rien de comblé, sur le total applicable en première admission", () => {
    // notification : ouverture, AJ nette, naissance = 3 bloquants applicables (dateAnniversaire et
    // dateLimite ne le sont pas sans réadmission/ouverture). bulletins : 1 (aucun contrat).
    const { combles, total } = progressionDocuments(documentsRequis(null, []));
    expect(total).toBe(4);
    expect(combles).toBe(0);
  });

  it("profil complet + un contrat, première admission -> tout comblé", () => {
    // + dateLimiteIndemnisation, applicable puisque ouvertureDroits existe désormais = 4 bloquants
    // applicables sur la notification, + 1 sur bulletins.
    const { combles, total } = progressionDocuments(documentsRequis(profilComplet, [contrat({ date: "2026-03-15" })]));
    expect(total).toBe(5);
    expect(combles).toBe(5);
  });

  it("réadmission : le dénominateur grandit d'un cran (date anniversaire redevient bloquante)", () => {
    const p = profil({ ...profilComplet, situation: "readmission" });
    const { combles, total } = progressionDocuments(documentsRequis(p, [contrat({ date: "2026-03-15" })]));
    expect(total).toBe(6);
    expect(combles).toBe(6);
  });

  it("les lignes non évaluables (relevé, CPAM, attestation de taux) ne gonflent jamais le total", () => {
    // profil() (donc taux absent) fait apparaître la ligne « attestation_taux » en plus des lignes
    // relevé/CPAM déjà toujours présentes — aucune des trois ne doit peser dans la somme.
    const lignes = documentsRequis(profil(), []);
    expect(lignes.map((l) => l.id)).toContain("attestation_taux");
    const { total } = progressionDocuments(lignes);
    const totalNotificationEtBulletins = (lignes.find((l) => l.id === "notification_admission")?.nbBloquantsApplicables ?? 0) + 1;
    expect(total).toBe(totalNotificationEtBulletins);
  });
});
