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

  it("ne propose PAS un contrat sans statutVerification connu (données anciennes, aucune preuve qu'il attend quelque chose)", () => {
    const ancien = contrat({ date: "2026-06-28", employeur: "Association Fictive", salaireBrut: 245 });
    const resultat = trouverContratsCorrespondants({ employeur: "Association Fictive", date: "2026-06-28", dateDebut: "2026-06-26", salaireBrut: 245 }, [ancien]);
    expect(resultat).toEqual([]);
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
});
