// @vitest-environment jsdom
//
// Phase 6, commit 6 — le justificatif d'une dépense passe désormais TOUJOURS par Supabase Storage
// (retrait complet de Google Drive et du repli localStorage, décision de Benoît du 04-05/08/2026,
// devenue possible grâce au compte obligatoire : ce formulaire n'est plus jamais atteint sans session).
//
// Remplace `DepenseForm.stockagePlein.test.tsx`, dont la prémisse (un repli base64 dans le
// localStorage) n'existe plus dans ce fichier : il n'y a plus qu'une seule destination, le serveur.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DepenseForm } from "../DepenseForm";
import type { ClientDocuments, ClientFichiers } from "../../../auth/supabaseClient";
import type { Depense } from "../../../types/fraisReels";

const UTILISATEUR = "u-42";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FauxAppelable = (...args: any[]) => any;

function fauxClientDocuments(insert: FauxAppelable = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }))): ClientDocuments {
  return { from: vi.fn(() => ({ select: vi.fn(), insert, update: vi.fn(), delete: vi.fn() })) } as unknown as ClientDocuments;
}

function fauxClientFichiers(upload: FauxAppelable = vi.fn(async () => ({ data: { path: "x" }, error: null }))): ClientFichiers {
  return { upload, remove: vi.fn(async () => ({ data: null, error: null })), createSignedUrl: vi.fn() } as unknown as ClientFichiers;
}

function rendre(props: { valeurInitiale?: Depense; clientDocuments?: ClientDocuments | null; clientFichiers?: ClientFichiers | null } = {}) {
  const onValider = vi.fn();
  render(
    <DepenseForm
      anneeFiscale={2026}
      valeurInitiale={props.valeurInitiale}
      ratioLocalPro={null}
      nombreRepasC3Actif={false}
      utilisateurId={UTILISATEUR}
      clientDocuments={props.clientDocuments ?? fauxClientDocuments()}
      clientFichiers={props.clientFichiers ?? fauxClientFichiers()}
      onValider={onValider}
      onAnnuler={vi.fn()}
    />,
  );
  return onValider;
}

const champFichier = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const deposer = (nom: string, contenu = "contenu") => fireEvent.change(champFichier(), { target: { files: [new File([contenu], nom, { type: "application/pdf" })] } });

describe("DepenseForm — justificatif : dépôt sur Supabase Storage", () => {
  it("un dépôt réussi affiche le nom du fichier et bascule le badge sur « fourni »", async () => {
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    rendre({ clientDocuments: fauxClientDocuments(insert) });
    deposer("facture.pdf");

    await waitFor(() => expect(screen.getByText("facture.pdf")).toBeInTheDocument());
    expect(screen.getByText(/justificatif fourni/i)).toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ type_document: "justificatif_frais", categorie_frais: "C1" }));
  });

  it("un échec d'upload affiche l'erreur et n'attache rien", async () => {
    const upload = vi.fn(async () => ({ data: null, error: { message: "quota dépassé" } }));
    rendre({ clientFichiers: fauxClientFichiers(upload) });
    deposer("facture.pdf");

    await waitFor(() => expect(screen.getByText(/envoi impossible/i)).toBeInTheDocument());
    expect(screen.queryByText("facture.pdf")).not.toBeInTheDocument();
    expect(screen.getByText(/choisir un fichier/i)).toBeInTheDocument();
  });

  it("le fichier envoyé mais dont la ligne échoue est dit comme un échec, pas comme un succès partiel", async () => {
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: null, error: { message: "contrainte violée" } })) }));
    rendre({ clientDocuments: fauxClientDocuments(insert) });
    deposer("facture.pdf");

    await waitFor(() => expect(screen.getByText(/n'a pas pu être enregistré/i)).toBeInTheDocument());
    expect(screen.queryByText("facture.pdf")).not.toBeInTheDocument();
  });

  it("la limite de 5 Mo par fichier reste vérifiée AVANT tout envoi réseau", async () => {
    const upload = vi.fn();
    rendre({ clientFichiers: fauxClientFichiers(upload) });
    const trop = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "enorme.pdf", { type: "application/pdf" });
    fireEvent.change(champFichier(), { target: { files: [trop] } });

    expect(await screen.findByText(/fichier trop volumineux \(max 5 mo\)/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("remplacer un justificatif déjà déposé retire l'ANCIEN après que le nouveau a réussi", async () => {
    const remove = vi.fn(async () => ({ data: null, error: null }));
    const deleteEq = vi.fn(async () => ({ error: null }));
    const clientDocuments = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => ({ data: [{ id: "doc-ancien", type_document: "justificatif_frais", categorie_frais: "C1", annee_fiscale: 2026, chemin_stockage: "u-42/2026/justificatif_frais/ancien.pdf", nom_fichier: "ancien.pdf", taille_octets: 1, mime: "application/pdf", date_document: null, notes: null, cree_le: "2026-08-01" }], error: null })) })) })),
        insert: vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-nouveau" }], error: null })) })),
        update: vi.fn(),
        delete: vi.fn(() => ({ eq: deleteEq })),
      })),
    } as unknown as ClientDocuments;
    const clientFichiers = fauxClientFichiers();
    (clientFichiers.remove as unknown as typeof remove) = remove;

    const initiale: Depense = {
      id: "d1",
      anneeFiscale: 2026,
      date: "2026-03-01",
      categorie: "C1",
      description: "Ancienne dépense",
      montantTotal: 10,
      remboursementEmployeur: 0,
      partPro: 1,
      montantDeductible: 10,
      statutJustificatif: "fourni",
      justificatifNom: "ancien.pdf",
      documentId: "doc-ancien",
    };
    rendre({ valeurInitiale: initiale, clientDocuments, clientFichiers });
    deposer("nouveau.pdf");

    await waitFor(() => expect(screen.getByText("nouveau.pdf")).toBeInTheDocument());
    expect(deleteEq).toHaveBeenCalledWith("id", "doc-ancien");
    expect(remove).toHaveBeenCalledWith(["u-42/2026/justificatif_frais/ancien.pdf"]);
  });
});
