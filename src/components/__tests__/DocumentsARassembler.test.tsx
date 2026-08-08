// @vitest-environment jsdom
//
// Remplace ChecklistDocuments.test.tsx (08/08/2026, fusion avec DocumentsUtiles.tsx — demande de
// Benoît) : mêmes garanties que l'ancienne checklist (jauge, bouton d'import), plus la couverture du
// groupement statique (documentsUtiles.ts) désormais fusionné dans le même composant.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DocumentsARassembler } from "../DocumentsARassembler";
import { profil } from "../../engine/__tests__/testUtils";

describe("DocumentsARassembler — jauge de progression", () => {
  it("affiche un dénominateur non nul et honnête, jamais un total fixe", () => {
    render(<DocumentsARassembler profil={null} contrats={[]} />);
    expect(screen.getByText(/^0\/\d+ informations bloquantes renseignées$/)).toBeInTheDocument();
  });

  it("progresse une fois le profil renseigné", () => {
    const p = profil({
      ajReelleHistorique: [{ dateEffet: "2026-02-05", valeur: 53.81 }],
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    render(<DocumentsARassembler profil={p} contrats={[]} />);
    expect(screen.getByText(/^4\/\d+ informations bloquantes renseignées$/)).toBeInTheDocument();
  });
});

describe("DocumentsARassembler — bouton « Importer ce document »", () => {
  it("apparaît sur une ligne incomplète et appelle le callback avec le bon type", () => {
    const onDemanderImport = vi.fn();
    render(<DocumentsARassembler profil={null} contrats={[]} onDemanderImport={onDemanderImport} />);
    fireEvent.click(screen.getAllByRole("button", { name: /importer ce document/i })[0]);
    expect(onDemanderImport).toHaveBeenCalledWith("notification_are");
  });

  it("propose aussi l'import pour la ligne bulletins/AEM quand aucun contrat n'est renseigné", () => {
    const onDemanderImport = vi.fn();
    render(<DocumentsARassembler profil={null} contrats={[]} onDemanderImport={onDemanderImport} />);
    const boutons = screen.getAllByRole("button", { name: /importer ce document/i });
    expect(boutons).toHaveLength(2);
    fireEvent.click(boutons[1]);
    expect(onDemanderImport).toHaveBeenCalledWith("aem_bulletin");
  });

  it("n'affiche aucun bouton sans callback fourni", () => {
    render(<DocumentsARassembler profil={null} contrats={[]} />);
    expect(screen.queryByRole("button", { name: /importer ce document/i })).not.toBeInTheDocument();
  });

  it("n'affiche plus le bouton sur une ligne devenue complète", () => {
    const complet = profil({
      ajReelleHistorique: [{ dateEffet: "2026-02-05", valeur: 53.81 }],
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    render(<DocumentsARassembler profil={complet} contrats={[]} onDemanderImport={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /importer ce document/i })).toHaveLength(1);
  });

  it("les lignes de complément (relevé, CPAM) n'ont jamais de bouton", () => {
    render(<DocumentsARassembler profil={null} contrats={[]} onDemanderImport={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /importer ce document/i })).toHaveLength(2);
  });
});

describe("DocumentsARassembler — fusion avec la référence statique (documentsUtiles.ts)", () => {
  it("regroupe les documents par situation, avec les titres de groupe de la référence statique", () => {
    render(<DocumentsARassembler profil={null} contrats={[]} />);
    expect(screen.getByText("Toujours utile")).toBeInTheDocument();
    expect(screen.getByText("Si tu enseignes")).toBeInTheDocument();
  });

  it("affiche une ligne sans statut calculable (contrat d'enseignement) avec ses badges statiques", () => {
    render(<DocumentsARassembler profil={null} contrats={[]} />);
    const ligne = screen.getByText("Contrat d'enseignement").closest("summary")!;
    expect(within(ligne).getByText("indispensable")).toBeInTheDocument();
    expect(within(ligne).getByText("saisie manuelle")).toBeInTheDocument();
  });

  it("masque la ligne « attestation de taux » une fois le taux renseigné", () => {
    const sansTaux = profil({ ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7 } });
    const { unmount } = render(<DocumentsARassembler profil={sansTaux} contrats={[]} />);
    expect(screen.getByText(/attestation de taux de prélèvement à la source/i)).toBeInTheDocument();
    unmount();

    const avecTaux = profil({
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, tauxPrelevementSourceHistorique: [{ dateEffet: "2026-02-05", valeur: 3.1 }] },
    });
    render(<DocumentsARassembler profil={avecTaux} contrats={[]} />);
    expect(screen.queryByText(/attestation de taux de prélèvement à la source/i)).not.toBeInTheDocument();
  });
});
