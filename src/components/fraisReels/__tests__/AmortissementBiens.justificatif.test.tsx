// @vitest-environment jsdom
//
// Commit 7 de la phase 6 — le justificatif d'achat d'un bien amorti part sur Supabase Storage.
//
// Ce que ces tests verrouillent, et qui ne se voit pas à la lecture du composant :
//  · `categorie_frais` vaut TOUJOURS 'C7' (décision de Benoît du 05/08/2026) ;
//  · `annee_fiscale` est l'année de la DATE D'ACHAT, jamais l'année d'imposition affichée — un bien
//    acheté en 2024 et encore amorti en 2026 doit se ranger à 2024 dans « Mon dossier » ;
//  · le justificatif reste FACULTATIF : on peut ajouter un bien sans fichier (aucune règle fiscale
//    dans Cadence ne l'exige — ne pas en inventer une).
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AmortissementBiens } from "../AmortissementBiens";
import { franceTravailConfig } from "../../../config/franceTravailConfig";
import type { ClientDocuments, ClientFichiers } from "../../../auth/supabaseClient";

const UTILISATEUR = "u-42";

/** Bien au-dessus du seuil : l'amortissement est obligatoire, donc le formulaire est enregistrable. */
const PRIX_AU_DESSUS_DU_SEUIL = String(franceTravailConfig.fraisReels.amortissements.seuilAmortissementHT + 1500);

function fauxClients(options: { erreurUpload?: string; erreurLigne?: string } = {}) {
  const lignesInserees: Record<string, unknown>[] = [];
  const cheminsDeposes: string[] = [];

  const clientFichiers: ClientFichiers = {
    upload: vi.fn(async (chemin: string) => {
      if (options.erreurUpload) return { data: null, error: { message: options.erreurUpload } };
      cheminsDeposes.push(chemin);
      return { data: { path: chemin }, error: null };
    }),
    remove: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://exemple/signe" }, error: null })),
  };

  const clientDocuments: ClientDocuments = {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: (ligne: Record<string, unknown>) => ({
        select: async () => {
          if (options.erreurLigne) return { data: null, error: { message: options.erreurLigne } };
          lignesInserees.push(ligne);
          return { data: [{ id: "doc-neuf" }], error: null };
        },
      }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  };

  return { clientFichiers, clientDocuments, lignesInserees, cheminsDeposes };
}

function rendre(clients: { clientDocuments: ClientDocuments | null; clientFichiers: ClientFichiers | null }, anneeImposition = 2026) {
  const onAjouter = vi.fn();
  render(
    <AmortissementBiens
      anneeImposition={anneeImposition}
      biens={[]}
      ftConfig={franceTravailConfig}
      onAjouter={onAjouter}
      onSupprimer={vi.fn()}
      utilisateurId={UTILISATEUR}
      clientDocuments={clients.clientDocuments}
      clientFichiers={clients.clientFichiers}
    />,
  );
  // Le formulaire est fermé par défaut.
  fireEvent.click(screen.getByRole("button", { name: /ajouter un bien/i }));
  return onAjouter;
}

/** Remplit le minimum pour que le formulaire soit valide, avec la date d'achat demandée. */
function remplir(dateAchat: string) {
  fireEvent.change(screen.getByLabelText(/nom du bien/i), { target: { value: "Violoncelle" } });
  fireEvent.change(screen.getByLabelText(/date d'achat/i), { target: { value: dateAchat } });
  fireEvent.change(screen.getByLabelText(/prix/i), { target: { value: PRIX_AU_DESSUS_DU_SEUIL } });
  fireEvent.change(screen.getByLabelText(/durée d'amortissement/i), { target: { value: "5" } });
}

function choisirFichier(nom = "facture-violoncelle.pdf") {
  const fichier = new File(["contenu"], nom, { type: "application/pdf" });
  const champ = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(champ, { target: { files: [fichier] } });
  return fichier;
}

describe("AmortissementBiens — justificatif d'achat (commit 7)", () => {
  it("dépose le fichier avec categorie_frais 'C7' et l'ANNÉE D'ACHAT, pas l'année d'imposition", async () => {
    const clients = fauxClients();
    // Année d'imposition 2026, achat en 2024 : c'est 2024 qui doit être écrit.
    rendre(clients, 2026);
    remplir("2024-03-15");
    choisirFichier();

    await waitFor(() => expect(clients.lignesInserees).toHaveLength(1));
    const ligne = clients.lignesInserees[0];
    expect(ligne.type_document).toBe("justificatif_frais");
    expect(ligne.categorie_frais).toBe("C7");
    expect(ligne.annee_fiscale).toBe(2024);
    expect(ligne.date_document).toBe("2024-03-15");
    expect(ligne.user_id).toBe(UTILISATEUR);
  });

  it("range le fichier dans le dossier de l'année d'achat", async () => {
    const clients = fauxClients();
    rendre(clients, 2026);
    remplir("2024-03-15");
    choisirFichier();

    await waitFor(() => expect(clients.cheminsDeposes).toHaveLength(1));
    expect(clients.cheminsDeposes[0]).toContain(`${UTILISATEUR}/2024/justificatif_frais/`);
  });

  it("remonte le documentId au bien enregistré", async () => {
    const clients = fauxClients();
    const onAjouter = rendre(clients);
    remplir("2024-03-15");
    choisirFichier();
    await waitFor(() => expect(clients.lignesInserees).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /ajouter ce bien/i }));
    expect(onAjouter).toHaveBeenCalledWith(expect.objectContaining({ documentId: "doc-neuf", designation: "Violoncelle", dateAchat: "2024-03-15" }));
  });

  it("LE JUSTIFICATIF RESTE FACULTATIF : un bien s'enregistre sans fichier", () => {
    const clients = fauxClients();
    const onAjouter = rendre(clients);
    remplir("2024-03-15");
    fireEvent.click(screen.getByRole("button", { name: /ajouter ce bien/i }));
    expect(onAjouter).toHaveBeenCalledWith(expect.objectContaining({ designation: "Violoncelle", documentId: undefined }));
  });

  it("EXIGE LA DATE D'ACHAT AVANT LE FICHIER — sinon l'année de classement serait devinée", async () => {
    const clients = fauxClients();
    rendre(clients);
    // Tout sauf la date.
    fireEvent.change(screen.getByLabelText(/nom du bien/i), { target: { value: "Violoncelle" } });
    fireEvent.change(screen.getByLabelText(/prix/i), { target: { value: PRIX_AU_DESSUS_DU_SEUIL } });
    choisirFichier();

    expect(await screen.findByRole("alert")).toHaveTextContent(/renseigne d'abord la date d'achat/i);
    expect(clients.lignesInserees).toHaveLength(0);
    expect(clients.clientFichiers.upload).not.toHaveBeenCalled();
  });

  it("refuse un fichier de plus de 5 Mo sans rien envoyer", async () => {
    const clients = fauxClients();
    rendre(clients);
    remplir("2024-03-15");
    const gros = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "gros.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [gros] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/trop volumineux/i);
    expect(clients.clientFichiers.upload).not.toHaveBeenCalled();
  });

  it("dit l'échec d'envoi sans prétendre avoir un justificatif", async () => {
    const clients = fauxClients({ erreurUpload: "network error" });
    const onAjouter = rendre(clients);
    remplir("2024-03-15");
    choisirFichier();

    expect(await screen.findByRole("alert")).toHaveTextContent(/envoi impossible.*network error/i);
    fireEvent.click(screen.getByRole("button", { name: /ajouter ce bien/i }));
    // Le bien reste enregistrable, mais SANS documentId : on n'invente pas une référence.
    expect(onAjouter).toHaveBeenCalledWith(expect.objectContaining({ documentId: undefined }));
  });

  it("un fichier parti mais sans ligne est annoncé comme un ÉCHEC, jamais comme un justificatif utilisable", async () => {
    const clients = fauxClients({ erreurLigne: "violates row-level security policy" });
    rendre(clients);
    remplir("2024-03-15");
    choisirFichier();

    expect(await screen.findByRole("alert")).toHaveTextContent(/envoyé mais n'a pas pu être enregistré/i);
  });

  it("dit que le stockage est indisponible plutôt que d'échouer en silence", async () => {
    rendre({ clientDocuments: null, clientFichiers: null });
    remplir("2024-03-15");
    choisirFichier();
    expect(await screen.findByRole("alert")).toHaveTextContent(/stockage n'est pas disponible/i);
  });
});
