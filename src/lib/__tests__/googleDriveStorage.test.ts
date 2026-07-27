import { afterEach, describe, expect, it, vi } from "vitest";
import { supprimerJustificatif, uploaderJustificatif } from "../googleDriveStorage";

function reponse(corps: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => corps,
    text: async () => JSON.stringify(corps),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploaderJustificatif", () => {
  it("crée les dossiers Cadence/Frais_<annee> puis dépose le fichier, quand ils n'existent pas encore", async () => {
    const fetchMock = vi
      .fn()
      // recherche dossier "Cadence" — absent
      .mockResolvedValueOnce(reponse({ files: [] }))
      // création dossier "Cadence"
      .mockResolvedValueOnce(reponse({ id: "folder-cadence" }))
      // recherche dossier "Frais_2026" — absent
      .mockResolvedValueOnce(reponse({ files: [] }))
      // création dossier "Frais_2026"
      .mockResolvedValueOnce(reponse({ id: "folder-annee" }))
      // upload multipart du fichier
      .mockResolvedValueOnce(reponse({ id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" }));
    vi.stubGlobal("fetch", fetchMock);

    const fichier = new File(["contenu"], "facture.pdf", { type: "application/pdf" });
    const resultat = await uploaderJustificatif("token-abc", fichier, 2026);

    expect(resultat).toEqual({ driveFileId: "file-1", driveWebViewLink: "https://drive.google.com/file/d/file-1/view" });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Chaque appel porte bien le token en Authorization
    for (const appel of fetchMock.mock.calls) {
      const options = appel[1] as RequestInit;
      expect((options.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
    }

    // Dernier appel = upload, sur l'endpoint upload avec le dossier année en parent
    const [urlUpload, optionsUpload] = fetchMock.mock.calls[4];
    expect(String(urlUpload)).toContain("/upload/drive/v3/files");
    expect(optionsUpload.method).toBe("POST");
  });

  it("réutilise les dossiers déjà existants sans les recréer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reponse({ files: [{ id: "folder-cadence" }] }))
      .mockResolvedValueOnce(reponse({ files: [{ id: "folder-annee" }] }))
      .mockResolvedValueOnce(reponse({ id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" }));
    vi.stubGlobal("fetch", fetchMock);

    const fichier = new File(["contenu"], "facture.pdf", { type: "application/pdf" });
    const resultat = await uploaderJustificatif("token-abc", fichier, 2026);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(resultat.driveFileId).toBe("file-1");
  });

  it("propage l'erreur si l'API Drive répond en échec (fallback localStorage géré côté DepenseForm)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reponse({ error: "forbidden" }, false, 403));
    vi.stubGlobal("fetch", fetchMock);

    const fichier = new File(["contenu"], "facture.pdf", { type: "application/pdf" });
    await expect(uploaderJustificatif("token-abc", fichier, 2026)).rejects.toThrow(/403/);
  });
});

describe("supprimerJustificatif", () => {
  it("appelle DELETE sur l'endpoint du fichier avec le token en Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await supprimerJustificatif("token-abc", "file-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://www.googleapis.com/drive/v3/files/file-1");
    expect(options.method).toBe("DELETE");
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
  });
});
