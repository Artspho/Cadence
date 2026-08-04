// @vitest-environment jsdom
//
// Chantier de sortie des justificatifs du localStorage (04/08/2026). Les tests de
// lib/__tests__/envoiJustificatifsEnAttente.test.ts prouvent la logique d'envoi ; celui-ci prouve ce que
// l'utilisateur VOIT et ce que le bouton fait réellement — dont le compte-rendu, qui doit nommer les
// fichiers restés en arrière plutôt qu'afficher un nombre nu.
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JustificatifsEnAttente } from "../JustificatifsEnAttente";
import type { Depense } from "../../../types/fraisReels";

const DATA_URL = `data:application/pdf;base64,${btoa("x".repeat(3000))}`;

vi.mock("../../../lib/googleDriveAuth", () => ({ getToken: () => "jeton-de-test" }));
const uploader = vi.fn();
vi.mock("../../../lib/googleDriveStorage", () => ({ uploaderJustificatif: (...args: unknown[]) => uploader(...args) }));

function depense(partiel: Partial<Depense> = {}): Depense {
  return {
    id: "d1",
    anneeFiscale: 2026,
    date: "2026-03-10",
    categorie: "C1",
    description: "Péage",
    montantTotal: 12.5,
    remboursementEmployeur: 0,
    partPro: 1,
    montantDeductible: 12.5,
    statutJustificatif: "fourni",
    ...partiel,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

function rendre(depenses: Depense[], driveConnecte = true) {
  const onRemplacerDepenses = vi.fn();
  render(<JustificatifsEnAttente depenses={depenses} driveConnecte={driveConnecte} onRemplacerDepenses={onRemplacerDepenses} />);
  return onRemplacerDepenses;
}

describe("JustificatifsEnAttente — ce qui s'affiche", () => {
  it("rien en attente : le bloc n'existe pas du tout", () => {
    // Un encart « 0 justificatif en attente » serait du bruit permanent, pour un cas qui sera le plus
    // fréquent.
    rendre([depense({ driveFileId: "abc" }), depense({ id: "d2", statutJustificatif: "manquant" })]);
    expect(screen.queryByText(/stocké/i)).not.toBeInTheDocument();
  });

  it("annonce le nombre ET le poids — c'est le poids qui explique pourquoi ça compte", () => {
    rendre([depense({ justificatifNom: "a.pdf", justificatifData: DATA_URL })]);
    expect(screen.getByText(/1 justificatif encore stocké dans ce navigateur/i)).toBeInTheDocument();
    expect(screen.getByText(/3,9 Ko/)).toBeInTheDocument();
  });

  it("accorde le pluriel sur le nombre de justificatifs", () => {
    rendre([depense({ id: "a", justificatifData: DATA_URL }), depense({ id: "b", justificatifData: DATA_URL })]);
    expect(screen.getByText(/2 justificatifs encore stockés dans ce navigateur/i)).toBeInTheDocument();
  });

  it("Drive non connecté : pas de bouton d'envoi, mais l'explication de ce qu'il faut faire", () => {
    rendre([depense({ justificatifData: DATA_URL })], false);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/connecte google drive/i)).toBeInTheDocument();
  });
});

describe("JustificatifsEnAttente — l'envoi", () => {
  it("envoi réussi : les dépenses remontées portent le driveFileId et plus de base64", async () => {
    uploader.mockResolvedValue({ driveFileId: "id-1", driveWebViewLink: "https://drive.example/id-1" });
    const onRemplacerDepenses = rendre([depense({ justificatifNom: "a.pdf", justificatifData: DATA_URL })]);

    fireEvent.click(screen.getByRole("button", { name: /envoyer ce justificatif vers google drive/i }));

    await waitFor(() => expect(onRemplacerDepenses).toHaveBeenCalledTimes(1));
    const remontees = onRemplacerDepenses.mock.calls[0][0] as Depense[];
    expect(remontees[0].driveFileId).toBe("id-1");
    expect(remontees[0].justificatifData).toBeUndefined();
    expect(screen.getByText(/1 justificatif envoyé sur Google Drive/i)).toBeInTheDocument();
  });

  it("échec : le compte-rendu NOMME les fichiers restés, et dit que rien n'est perdu", async () => {
    // Un « 1 échec » nu n'aide personne : il faut savoir lequel réessayer.
    uploader.mockRejectedValue(new Error("Failed to fetch"));
    const onRemplacerDepenses = rendre([depense({ justificatifNom: "facture-mars.pdf", justificatifData: DATA_URL })]);

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => expect(screen.getByText(/facture-mars\.pdf/)).toBeInTheDocument());
    expect(screen.getByText(/rien n'est perdu/i)).toBeInTheDocument();
    // Le base64 est conservé dans ce qui est remonté : devoir sacré n°1.
    const remontees = onRemplacerDepenses.mock.calls[0][0] as Depense[];
    expect(remontees[0].justificatifData).toBe(DATA_URL);
    expect(remontees[0].driveFileId).toBeUndefined();
  });

  it("échec partiel : les deux comptes sont annoncés, et l'écriture a bien lieu", async () => {
    // L'écriture DOIT avoir lieu même partiellement : sinon un second essai renverrait sur Drive des
    // fichiers déjà partis, en doublon.
    uploader.mockResolvedValueOnce({ driveFileId: "ok", driveWebViewLink: "l" }).mockRejectedValueOnce(new Error("coupure"));
    const onRemplacerDepenses = rendre([
      depense({ id: "a", justificatifNom: "a.pdf", justificatifData: DATA_URL }),
      depense({ id: "b", justificatifNom: "b.pdf", justificatifData: DATA_URL }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => expect(screen.getByText(/1 justificatif envoyé/i)).toBeInTheDocument());
    expect(screen.getByText(/b\.pdf/)).toBeInTheDocument();
    const remontees = onRemplacerDepenses.mock.calls[0][0] as Depense[];
    expect(remontees.map((d) => Boolean(d.driveFileId))).toEqual([true, false]);
  });

  it("chaque justificatif est envoyé dans le dossier de son année fiscale", async () => {
    uploader.mockResolvedValue({ driveFileId: "id", driveWebViewLink: "l" });
    rendre([depense({ id: "a", anneeFiscale: 2025, justificatifData: DATA_URL }), depense({ id: "b", anneeFiscale: 2026, justificatifData: DATA_URL })]);

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => expect(uploader).toHaveBeenCalledTimes(2));
    expect(uploader.mock.calls.map((c) => c[2])).toEqual([2025, 2026]);
  });
});
