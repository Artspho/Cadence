import { describe, expect, it } from "vitest";
import type { Depense } from "../../types/fraisReels";
import { calculerAffichageJustificatif } from "../justificatifAffichage";

function depense(partiel: Partial<Depense> = {}): Depense {
  return {
    id: "d-1",
    anneeFiscale: 2026,
    date: "2026-03-01",
    categorie: "C1",
    description: "Dépense test",
    montantTotal: 10,
    remboursementEmployeur: 0,
    partPro: 1,
    montantDeductible: 10,
    statutJustificatif: "fourni",
    ...partiel,
  };
}

describe("calculerAffichageJustificatif", () => {
  it("aucun justificatif : type 'aucun'", () => {
    expect(calculerAffichageJustificatif(depense())).toEqual({ type: "aucun" });
  });

  it("documentId (Supabase Storage) : type 'signe', l'URL se résout au clic", () => {
    const d = depense({ documentId: "doc-1" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "signe", documentId: "doc-1" });
  });

  it("documentId a priorité sur tout le reste, y compris un ancien lien Drive", () => {
    const d = depense({ documentId: "doc-1", driveFileId: "f1", driveWebViewLink: "https://drive.google.com/file/d/f1/view", justificatifData: "data:xxx" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "signe", documentId: "doc-1" });
  });

  it("justificatifData (mode local) : lien vers la donnée base64", () => {
    const d = depense({ justificatifData: "data:application/pdf;base64,xxx" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "lien", url: "data:application/pdf;base64,xxx" });
  });

  it("driveWebViewLink présent : lien direct vers Drive", () => {
    const d = depense({ driveFileId: "f1", driveWebViewLink: "https://drive.google.com/file/d/f1/view" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "lien", url: "https://drive.google.com/file/d/f1/view" });
  });

  it("driveFileId présent sans driveWebViewLink (Drive déconnecté au moment de l'upload, donnée partielle) : indisponible, jamais perdu", () => {
    const d = depense({ driveFileId: "f1" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "indisponible" });
  });

  it("driveWebViewLink a priorité sur justificatifData si les deux sont présents", () => {
    const d = depense({ justificatifData: "data:xxx", driveFileId: "f1", driveWebViewLink: "https://drive.google.com/file/d/f1/view" });
    expect(calculerAffichageJustificatif(d)).toEqual({ type: "lien", url: "https://drive.google.com/file/d/f1/view" });
  });
});
