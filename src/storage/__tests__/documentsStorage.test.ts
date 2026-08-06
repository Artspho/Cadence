// Phase 6 — fondation du stockage réel des documents. Client injecté (même patron que
// sourceSupabase.test.ts) : aucun test ici ne touche un vrai serveur, cf. scripts/verifier-documents.mjs
// pour la preuve contre le vrai projet.
import { describe, expect, it, vi } from "vitest";
import {
  chercherDoublon,
  construireCheminStockage,
  corrigerTypeDocument,
  deposerDocument,
  listerDocuments,
  obtenirUrlTelechargement,
  typeDocumentDepuisDetection,
} from "../documentsStorage";
import type { ClientDocuments, ClientFichiers } from "../../auth/supabaseClient";

describe("typeDocumentDepuisDetection", () => {
  it("fait converger aem et bulletin_paie vers aem_bulletin", () => {
    expect(typeDocumentDepuisDetection("aem")).toBe("aem_bulletin");
    expect(typeDocumentDepuisDetection("bulletin_paie")).toBe("aem_bulletin");
  });

  it("traduit les 6 autres types reconnus un par un", () => {
    expect(typeDocumentDepuisDetection("notification_admission")).toBe("notification_are");
    expect(typeDocumentDepuisDetection("releve_situation")).toBe("releve_situation");
    expect(typeDocumentDepuisDetection("declaration_fiscale_annuelle")).toBe("declaration_fiscale");
    expect(typeDocumentDepuisDetection("attestation_cpam")).toBe("attestation_cpam");
    expect(typeDocumentDepuisDetection("justificatif_declaration")).toBe("justificatif_declaration");
    expect(typeDocumentDepuisDetection("attestation_taux_pas")).toBe("attestation_taux_pas");
  });

  it("ne devine JAMAIS pour non_reconnu — rend null, à l'utilisateur de choisir", () => {
    expect(typeDocumentDepuisDetection("non_reconnu")).toBeNull();
  });

  it("rend null pour tout type inconnu, plutôt que de planter", () => {
    expect(typeDocumentDepuisDetection("un_type_qui_n_existe_pas")).toBeNull();
  });
});

describe("construireCheminStockage", () => {
  it("suit la convention <user_id>/<annee>/<type>/<uuid>-<nom>", () => {
    const chemin = construireCheminStockage("u-42", 2026, "aem_bulletin", "bulletin.pdf", () => "uuid-fixe");
    expect(chemin).toBe("u-42/2026/aem_bulletin/uuid-fixe-bulletin.pdf");
  });

  it("nettoie les espaces et les séparateurs de chemin dans le nom de fichier", () => {
    const chemin = construireCheminStockage("u-42", 2026, "justificatif_frais", "mon fichier/étrange\\nom.pdf", () => "uuid-fixe");
    expect(chemin).toBe("u-42/2026/justificatif_frais/uuid-fixe-mon_fichier_etrange_nom.pdf");
  });

  it("retire les caractères accentués — Supabase Storage refuse les clés qui en portent (« Invalid key »)", () => {
    // Cas réel du 06/08/2026 : un relevé de situation nommé ainsi faisait échouer le dépôt en silence
    // côté utilisateur (seul le bandeau d'erreur, texte du message Supabase, le révélait).
    const chemin = construireCheminStockage("u-42", 2026, "releve_situation", "Relevé_de_situation_20251125.pdf", () => "uuid-fixe");
    expect(chemin).toBe("u-42/2026/releve_situation/uuid-fixe-Releve_de_situation_20251125.pdf");
  });

  it("ne vide jamais le nom : un accent devient sa lettre de base, jamais rien", () => {
    const chemin = construireCheminStockage("u-42", 2026, "declaration_fiscale", "Déclaration_2025.pdf", () => "uuid-fixe");
    expect(chemin).toBe("u-42/2026/declaration_fiscale/uuid-fixe-Declaration_2025.pdf");
  });

  it("appelle crypto.randomUUID() par défaut quand aucun générateur n'est injecté", () => {
    const chemin = construireCheminStockage("u-42", 2026, "aem_bulletin", "bulletin.pdf");
    expect(chemin).toMatch(/^u-42\/2026\/aem_bulletin\/[0-9a-f-]{36}-bulletin\.pdf$/);
  });
});

function fauxClientFichiers(reponses: Partial<ClientFichiers> = {}): ClientFichiers {
  return {
    upload: vi.fn(async () => ({ data: { path: "chemin" }, error: null })),
    remove: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://exemple/signee" }, error: null })),
    ...reponses,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FauxAppelable = (...args: any[]) => any;

function fauxClientDocuments(reponses?: { insert?: FauxAppelable; select?: FauxAppelable; update?: FauxAppelable }): ClientDocuments {
  const insert = reponses?.insert ?? vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
  const select =
    reponses?.select ??
    vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));
  const update = reponses?.update ?? vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));

  return {
    from: vi.fn(() => ({ select, insert, update })),
  } as unknown as ClientDocuments;
}

describe("deposerDocument", () => {
  const FICHIER = new File(["contenu"], "bulletin.pdf", { type: "application/pdf" });

  it("dépose avec succès : upload PUIS insertion, dans cet ordre", async () => {
    const ordre: string[] = [];
    const fichiers = fauxClientFichiers({
      upload: vi.fn(async () => {
        ordre.push("upload");
        return { data: { path: "chemin" }, error: null };
      }),
    });
    const insert = vi.fn(() => {
      ordre.push("insert");
      return { select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) };
    });
    const documents = fauxClientDocuments({ insert });

    const resultat = await deposerDocument(fichiers, documents, {
      utilisateurId: "u-42",
      fichier: FICHIER,
      typeDocument: "aem_bulletin",
      anneeFiscale: 2026,
    });

    expect(resultat).toEqual({ statut: "depose", id: "doc-1", cheminStockage: expect.stringContaining("u-42/2026/aem_bulletin/") });
    expect(ordre).toEqual(["upload", "insert"]);
  });

  it("n'insère JAMAIS de ligne si l'upload échoue", async () => {
    const fichiers = fauxClientFichiers({ upload: vi.fn(async () => ({ data: null, error: { message: "quota dépassé" } })) });
    const insert = vi.fn();
    const documents = fauxClientDocuments({ insert });

    const resultat = await deposerDocument(fichiers, documents, { utilisateurId: "u-42", fichier: FICHIER, typeDocument: "aem_bulletin", anneeFiscale: 2026 });

    expect(resultat).toEqual({ statut: "echec", message: "quota dépassé" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("signale l'orphelin (fichier envoyé, ligne échouée) sans jamais dire « échec » — le fichier existe", async () => {
    const fichiers = fauxClientFichiers();
    const documents = fauxClientDocuments({
      insert: vi.fn(() => ({ select: vi.fn(async () => ({ data: null, error: { message: "conflit" } })) })),
    });

    const resultat = await deposerDocument(fichiers, documents, { utilisateurId: "u-42", fichier: FICHIER, typeDocument: "aem_bulletin", anneeFiscale: 2026 });

    expect(resultat.statut).toBe("ficherEnvoyeLigneEchouee");
  });

  it("transmet categorieFrais uniquement quand fourni", async () => {
    const insert = vi.fn(() => ({ select: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const documents = fauxClientDocuments({ insert });
    await deposerDocument(fauxClientFichiers(), documents, {
      utilisateurId: "u-42",
      fichier: FICHIER,
      typeDocument: "justificatif_frais",
      categorieFrais: "A",
      anneeFiscale: 2026,
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ categorie_frais: "A" }));
  });
});

describe("listerDocuments", () => {
  it("traduit les colonnes SQL en champs camelCase", async () => {
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({
          data: [
            {
              id: "doc-1",
              type_document: "aem_bulletin",
              categorie_frais: null,
              annee_fiscale: 2026,
              chemin_stockage: "u-42/2026/aem_bulletin/x-bulletin.pdf",
              nom_fichier: "bulletin.pdf",
              taille_octets: 1234,
              mime: "application/pdf",
              date_document: null,
              notes: null,
              cree_le: "2026-08-05T10:00:00.000Z",
            },
          ],
          error: null,
        })),
      })),
    }));
    const resultat = await listerDocuments(fauxClientDocuments({ select }), "u-42");
    expect(resultat).toEqual({
      documents: [
        {
          id: "doc-1",
          typeDocument: "aem_bulletin",
          categorieFrais: null,
          anneeFiscale: 2026,
          cheminStockage: "u-42/2026/aem_bulletin/x-bulletin.pdf",
          nomFichier: "bulletin.pdf",
          tailleOctets: 1234,
          mime: "application/pdf",
          dateDocument: null,
          notes: null,
          creeLe: "2026-08-05T10:00:00.000Z",
        },
      ],
    });
  });

  it("remonte l'erreur du serveur telle quelle", async () => {
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => ({ data: null, error: { message: "indisponible" } })) })) }));
    const resultat = await listerDocuments(fauxClientDocuments({ select }), "u-42");
    expect(resultat).toEqual({ erreur: "indisponible" });
  });
});

describe("chercherDoublon", () => {
  function selectAvec(documents: Record<string, unknown>[]) {
    return vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => ({ data: documents, error: null })) })) }));
  }

  const DOCUMENT_EXISTANT = {
    id: "doc-1",
    type_document: "aem_bulletin",
    categorie_frais: null,
    annee_fiscale: 2026,
    chemin_stockage: "u-42/2026/aem_bulletin/x-bulletin.pdf",
    nom_fichier: "bulletin.pdf",
    taille_octets: 1234,
    mime: "application/pdf",
    date_document: null,
    notes: null,
    cree_le: "2026-08-05T10:00:00.000Z",
  };

  it("trouve un document du même nom ET de la même taille", async () => {
    const documents = fauxClientDocuments({ select: selectAvec([DOCUMENT_EXISTANT]) });
    const resultat = await chercherDoublon(documents, "u-42", "bulletin.pdf", 1234);
    expect(resultat).toEqual(expect.objectContaining({ id: "doc-1", nomFichier: "bulletin.pdf", tailleOctets: 1234 }));
  });

  it("rend null si le nom diffère, même à taille égale", async () => {
    const documents = fauxClientDocuments({ select: selectAvec([DOCUMENT_EXISTANT]) });
    expect(await chercherDoublon(documents, "u-42", "autre.pdf", 1234)).toBeNull();
  });

  it("rend null si la taille diffère, même à nom égal", async () => {
    const documents = fauxClientDocuments({ select: selectAvec([DOCUMENT_EXISTANT]) });
    expect(await chercherDoublon(documents, "u-42", "bulletin.pdf", 9999)).toBeNull();
  });

  it("rend null quand aucun document n'existe", async () => {
    const documents = fauxClientDocuments({ select: selectAvec([]) });
    expect(await chercherDoublon(documents, "u-42", "bulletin.pdf", 1234)).toBeNull();
  });

  it("ÉCHOUE VERS null (jamais une exception) si la liste est indisponible — un avertissement de doublon ne doit jamais bloquer un dépôt", async () => {
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => ({ data: null, error: { message: "indisponible" } })) })) }));
    const documents = fauxClientDocuments({ select });
    expect(await chercherDoublon(documents, "u-42", "bulletin.pdf", 1234)).toBeNull();
  });
});

describe("corrigerTypeDocument", () => {
  it("met à jour uniquement le type, ne touche pas au chemin de stockage", async () => {
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ id: "doc-1" }], error: null })) }));
    const documents = fauxClientDocuments({ update });
    const resultat = await corrigerTypeDocument(documents, "doc-1", "attestation_cpam");
    expect(resultat).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ type_document: "attestation_cpam" });
  });

  it("remonte l'échec du serveur", async () => {
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: { message: "refusé" } })) }));
    const resultat = await corrigerTypeDocument(fauxClientDocuments({ update }), "doc-1", "attestation_cpam");
    expect(resultat).toEqual({ ok: false, message: "refusé" });
  });
});

describe("obtenirUrlTelechargement", () => {
  it("redemande une URL signée à chaque appel — jamais mise en cache par ce module", async () => {
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://exemple/signee" }, error: null }));
    const fichiers = fauxClientFichiers({ createSignedUrl });
    await obtenirUrlTelechargement(fichiers, "u-42/2026/aem_bulletin/x-bulletin.pdf");
    await obtenirUrlTelechargement(fichiers, "u-42/2026/aem_bulletin/x-bulletin.pdf");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("remonte l'erreur telle quelle", async () => {
    const fichiers = fauxClientFichiers({ createSignedUrl: vi.fn(async () => ({ data: null, error: { message: "chemin introuvable" } })) });
    const resultat = await obtenirUrlTelechargement(fichiers, "chemin");
    expect(resultat).toEqual({ erreur: "chemin introuvable" });
  });
});
