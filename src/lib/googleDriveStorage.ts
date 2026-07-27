// Étape 3 (Google Drive, optionnel) — upload/suppression des justificatifs via l'API REST Drive
// v3 (scope drive.file, cf. googleDriveAuth.ts). Le token est reçu en paramètre (jamais relu ici
// depuis localStorage) : ce module ne dépend que de `fetch`/`FormData`/`Blob`, ce qui le rend
// testable en isolation (mock de fetch) sans mocker `window`.
const API_FILES = "https://www.googleapis.com/drive/v3/files";
const API_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const MIME_DOSSIER = "application/vnd.google-apps.folder";

async function appelDrive(accessToken: string, url: string, options: RequestInit = {}): Promise<Response> {
  const reponse = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`Erreur Google Drive (${reponse.status})${detail ? ` : ${detail}` : ""}`);
  }
  return reponse;
}

async function trouverOuCreerDossier(accessToken: string, nom: string, parentId?: string): Promise<string> {
  const contrainteParent = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const q = encodeURIComponent(`name='${nom}' and mimeType='${MIME_DOSSIER}' and trashed=false and ${contrainteParent}`);
  const recherche = await appelDrive(accessToken, `${API_FILES}?q=${q}&fields=files(id)`);
  const resultat = (await recherche.json()) as { files: { id: string }[] };
  if (resultat.files.length > 0) return resultat.files[0].id;

  const creation = await appelDrive(accessToken, `${API_FILES}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nom, mimeType: MIME_DOSSIER, parents: parentId ? [parentId] : undefined }),
  });
  const cree = (await creation.json()) as { id: string };
  return cree.id;
}

// Crée "Cadence/Frais_<anneeFiscale>/" si absent, puis y dépose le fichier.
export async function uploaderJustificatif(accessToken: string, fichier: File, anneeFiscale: number): Promise<{ driveFileId: string; driveWebViewLink: string }> {
  const dossierCadence = await trouverOuCreerDossier(accessToken, "Cadence");
  const dossierAnnee = await trouverOuCreerDossier(accessToken, `Frais_${anneeFiscale}`, dossierCadence);

  const metadata = { name: fichier.name, parents: [dossierAnnee] };
  const corps = new FormData();
  corps.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  corps.append("file", fichier);

  const reponse = await appelDrive(accessToken, `${API_UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    body: corps,
  });
  const resultat = (await reponse.json()) as { id: string; webViewLink: string };
  return { driveFileId: resultat.id, driveWebViewLink: resultat.webViewLink };
}

export async function supprimerJustificatif(accessToken: string, driveFileId: string): Promise<void> {
  await appelDrive(accessToken, `${API_FILES}/${driveFileId}`, { method: "DELETE" });
}
