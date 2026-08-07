// @vitest-environment jsdom
//
// Étape 2 de la refonte UI (07/08/2026) : la checklist relie désormais ses lignes manquantes à
// l'import IA (bouton « Importer ce document ») et affiche une jauge de progression — sur un
// dénominateur dynamique, jamais un total fixe (cf. lib/documentsRequis.ts, progressionDocuments).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChecklistDocuments } from "../ChecklistDocuments";
import { profil } from "../../engine/__tests__/testUtils";

describe("ChecklistDocuments — jauge de progression", () => {
  it("affiche un dénominateur non nul et honnête, jamais un total fixe", () => {
    render(<ChecklistDocuments profil={null} contrats={[]} />);
    // Profil null, aucun contrat : 0 combles sur le total applicable en première admission.
    expect(screen.getByText(/^0\/\d+ informations bloquantes renseignées$/)).toBeInTheDocument();
  });

  it("progresse une fois le profil renseigné", () => {
    const p = profil({
      ajReelleHistorique: [{ dateEffet: "2026-02-05", valeur: 53.81 }],
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    render(<ChecklistDocuments profil={p} contrats={[]} />);
    expect(screen.getByText(/^4\/\d+ informations bloquantes renseignées$/)).toBeInTheDocument();
  });
});

describe("ChecklistDocuments — bouton « Importer ce document »", () => {
  it("apparaît sur une ligne incomplète et appelle le callback avec le bon type", () => {
    const onDemanderImport = vi.fn();
    render(<ChecklistDocuments profil={null} contrats={[]} onDemanderImport={onDemanderImport} />);
    fireEvent.click(screen.getAllByRole("button", { name: /importer ce document/i })[0]);
    expect(onDemanderImport).toHaveBeenCalledWith("notification_are");
  });

  it("propose aussi l'import pour la ligne bulletins/AEM quand aucun contrat n'est renseigné", () => {
    const onDemanderImport = vi.fn();
    render(<ChecklistDocuments profil={null} contrats={[]} onDemanderImport={onDemanderImport} />);
    const boutons = screen.getAllByRole("button", { name: /importer ce document/i });
    expect(boutons).toHaveLength(2);
    fireEvent.click(boutons[1]);
    expect(onDemanderImport).toHaveBeenCalledWith("aem_bulletin");
  });

  it("n'affiche aucun bouton sans callback fourni", () => {
    render(<ChecklistDocuments profil={null} contrats={[]} />);
    expect(screen.queryByRole("button", { name: /importer ce document/i })).not.toBeInTheDocument();
  });

  it("n'affiche plus le bouton sur une ligne devenue complète", () => {
    const complet = profil({
      ajReelleHistorique: [{ dateEffet: "2026-02-05", valeur: 53.81 }],
      ouvertureDroits: { dateOuverture: "2026-02-05", franchiseCPTotale: 12, delaiAttenteInitial: 7, dateLimiteIndemnisation: "2027-01-17" },
    });
    render(<ChecklistDocuments profil={complet} contrats={[]} onDemanderImport={vi.fn()} />);
    // La notification est complète : plus de bouton pour elle. Bulletins reste incomplet (aucun contrat).
    expect(screen.getAllByRole("button", { name: /importer ce document/i })).toHaveLength(1);
  });

  it("les lignes de complément (relevé, CPAM, attestation de taux) n'ont jamais de bouton", () => {
    render(<ChecklistDocuments profil={null} contrats={[]} onDemanderImport={vi.fn()} />);
    // Seules les deux lignes requises (notification, bulletins) en ont un.
    expect(screen.getAllByRole("button", { name: /importer ce document/i })).toHaveLength(2);
  });
});
