import { describe, expect, it } from "vitest";
import { trouverContratsCorrespondants } from "../correspondanceContrat";
import { contrat } from "../../engine/__tests__/testUtils";

describe("trouverContratsCorrespondants", () => {
  it("trouve un contrat 'a_verifier' du même employeur et du même mois", () => {
    const existant = contrat({ date: "2026-06-28", dateDebut: "2026-06-26", employeur: "Association Fictive", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 250 }, [existant]);
    expect(resultat).toEqual([existant]);
  });

  it("tolère la casse et les accents dans le nom de l'employeur", () => {
    const existant = contrat({ date: "2026-06-28", employeur: "Association du Festival de St Germain en Laye", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants(
      { employeur: "ASSOCIATION DU FESTIVAL DE ST GERMAIN EN LAYE", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 },
      [existant]
    );
    expect(resultat).toEqual([existant]);
  });

  it("ne propose PAS un contrat déjà 'confirme' (n'a pas besoin d'être retrouvé)", () => {
    const confirme = contrat({ date: "2026-06-28", employeur: "Association Fictive", salaireBrut: 245, statutVerification: "confirme" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [confirme]);
    expect(resultat).toEqual([]);
  });

  // Régression réelle corrigée le 01/08/2026 : le filtre exigeait auparavant EXACTEMENT
  // `=== "a_verifier"`, ce qui excluait silencieusement tout contrat sans `statutVerification` DU
  // TOUT — la clé absente (pas `undefined` explicite assigné), exactement l'état des 56 vrais
  // contrats de Benoît, tous créés avant l'ajout de ce champ. Un réimport de document ne détectait
  // donc jamais aucun doublon potentiel sur eux. `statutVerification` absent doit désormais être
  // traité comme équivalent à `"a_verifier"` pour cette détection — sans jamais le réécrire sur le
  // contrat lui-même (devoir n°1, cf. types/index.ts).
  it("trouve un contrat SANS statutVerification (clé absente, comme sur les vrais contrats antérieurs au 01/08/2026) — bug réel corrigé", () => {
    const ancien = contrat({ date: "2026-06-28", employeur: "Association Fictive", salaireBrut: 245 });
    expect(ancien.statutVerification).toBeUndefined();
    expect("statutVerification" in ancien).toBe(false);
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [ancien]);
    expect(resultat).toEqual([ancien]);
  });

  it("ne propose PAS un employeur différent, même mois et montant identiques", () => {
    const autre = contrat({ date: "2026-06-28", employeur: "Un Tout Autre Employeur", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [autre]);
    expect(resultat).toEqual([]);
  });

  it("le montant n'est jamais un filtre — un écart important n'exclut pas un candidat sinon plausible", () => {
    const existant = contrat({ date: "2026-06-28", employeur: "Association Fictive", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 1000 }, [existant]);
    expect(resultat).toEqual([existant]);
  });

  it("trie plusieurs candidats par proximité de montant, le plus proche en premier", () => {
    const loin = contrat({ date: "2026-06-05", employeur: "Association Fictive", salaireBrut: 900, statutVerification: "a_verifier" });
    const proche = contrat({ date: "2026-06-20", employeur: "Association Fictive", salaireBrut: 260, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [loin, proche]);
    expect(resultat).toEqual([proche, loin]);
  });

  it("reconnaît un chevauchement de période même hors du même mois civil", () => {
    const existant = contrat({ date: "2026-07-02", dateDebut: "2026-06-28", employeur: "Association Fictive", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-07-05", dateDebut: "2026-06-30", salaireBrut: 245 }, [existant]);
    expect(resultat).toEqual([existant]);
  });

  it("ne trouve rien si ni le mois ni la période ne correspondent", () => {
    const existant = contrat({ date: "2026-01-15", employeur: "Association Fictive", salaireBrut: 245, statutVerification: "a_verifier" });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [existant]);
    expect(resultat).toEqual([]);
  });

  // Scénario réaliste inspiré d'un cas réel (01/08/2026, données anonymisées) : plusieurs contrats
  // déjà saisis à la main par un utilisateur, sans champ statutVerification (comme tout contrat
  // créé avant l'ajout de ce champ), face à des activités du même mois relues sur un justificatif
  // de déclaration mensuelle — même employeur, mêmes dates, mêmes montants, mais aucun des deux
  // employeurs concernés n'apparaît qu'une seule fois dans le mois (l'un des deux a deux périodes
  // distinctes). Avant le correctif, aucun des 4 n'était détecté.
  it("détecte plusieurs contrats déjà saisis sans statutVerification comme correspondance d'un justificatif de déclaration du même mois", () => {
    const contratsExistants = [
      contrat({ employeur: "Commune de Villefictive", dateDebut: "2026-05-01", date: "2026-05-31", salaireBrut: 400 }),
      contrat({ employeur: "Orchestre Fictif de Testville", dateDebut: "2026-05-01", date: "2026-05-01", salaireBrut: 150 }),
      contrat({ employeur: "Orchestre Fictif de Testville", dateDebut: "2026-05-10", date: "2026-05-15", salaireBrut: 700 }),
      contrat({ employeur: "Ensemble Imaginaire du Sud", dateDebut: "2026-05-17", date: "2026-05-21", salaireBrut: 550 }),
    ];
    const activitesDeclarees = [
      { employeur: "ORCHESTRE FICTIF DE TESTVILLE", dateDebut: "2026-05-01", date: "2026-05-01", salaireBrut: 150 },
      { employeur: "COMMUNE DE VILLEFICTIVE", dateDebut: "2026-05-01", date: "2026-05-31", salaireBrut: 400 },
      { employeur: "ORCHESTRE FICTIF DE TESTVILLE", dateDebut: "2026-05-10", date: "2026-05-15", salaireBrut: 700 },
      { employeur: "Ensemble Imaginaire du Sud", dateDebut: "2026-05-17", date: "2026-05-21", salaireBrut: 550 },
    ];

    for (const activite of activitesDeclarees) {
      const resultat = trouverContratsCorrespondants(activite, contratsExistants);
      expect(resultat.map((c) => c.salaireBrut)).toContain(activite.salaireBrut);
    }
  });
});
