// Étape 3 (Google Drive, optionnel) — authentification OAuth2 côté client, sans backend, via
// Google Identity Services (GIS). Scope `drive.file` uniquement : l'app ne voit et ne peut créer
// que les fichiers qu'elle a elle-même déposés, jamais l'ensemble du Drive de l'utilisateur.
// Le token est gardé en localStorage (clé 'cadence_drive_token'), jamais envoyé ailleurs qu'à
// l'API Google Drive (cf. googleDriveStorage.ts, qui le reçoit en paramètre plutôt que de le
// relire lui-même — permet de tester l'upload/suppression sans dépendre de `window`).
const SCOPE_DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
const CLE_TOKEN = "cadence_drive_token";
const SRC_SCRIPT_GSI = "https://accounts.google.com/gsi/client";

export interface TokenStocke {
  accessToken: string;
  expiresAt: number; // epoch ms
}

interface ReponseTokenGoogle {
  access_token: string;
  expires_in: number;
  error?: string;
}

interface ClientTokenGoogle {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (reponse: ReponseTokenGoogle) => void;
            error_callback?: (erreur: { message?: string }) => void;
          }) => ClientTokenGoogle;
          revoke: (token: string) => void;
        };
      };
    };
  }
}

let promesseScriptGsi: Promise<void> | null = null;

function chargerScriptGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (promesseScriptGsi) return promesseScriptGsi;
  promesseScriptGsi = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC_SCRIPT_GSI;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger le script d'authentification Google."));
    document.head.appendChild(script);
  });
  return promesseScriptGsi;
}

function lireToken(): TokenStocke | null {
  try {
    const brut = window.localStorage.getItem(CLE_TOKEN);
    if (!brut) return null;
    const donnees = JSON.parse(brut) as Partial<TokenStocke>;
    if (typeof donnees.accessToken !== "string" || typeof donnees.expiresAt !== "number") return null;
    return { accessToken: donnees.accessToken, expiresAt: donnees.expiresAt };
  } catch {
    return null;
  }
}

function ecrireToken(token: TokenStocke): void {
  window.localStorage.setItem(CLE_TOKEN, JSON.stringify(token));
}

// Extraite pure pour être testable sans `window` — la marge de 60s évite qu'un token considéré
// valide expire réellement pendant l'appel réseau qui suit juste après.
export function tokenEstValide(token: TokenStocke | null, maintenant: number): boolean {
  return token !== null && token.expiresAt - 60_000 > maintenant;
}

export function estConnecte(): boolean {
  return tokenEstValide(lireToken(), Date.now());
}

export function getToken(): string | null {
  const token = lireToken();
  return tokenEstValide(token, Date.now()) ? token!.accessToken : null;
}

export async function connecterDrive(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google Drive non configuré (VITE_GOOGLE_DRIVE_CLIENT_ID manquant — voir .env.example).");
  }
  await chargerScriptGsi();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE_DRIVE_FILE,
      callback: (reponse) => {
        if (reponse.error || !reponse.access_token) {
          reject(new Error(`Connexion Google Drive refusée (${reponse.error ?? "erreur inconnue"}).`));
          return;
        }
        ecrireToken({ accessToken: reponse.access_token, expiresAt: Date.now() + reponse.expires_in * 1000 });
        resolve();
      },
      error_callback: (erreur) => reject(new Error(erreur.message || "Connexion Google Drive annulée.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// Ne supprime jamais les fichiers déjà déposés sur Drive — uniquement la connexion de l'app.
export function deconnecterDrive(): void {
  const token = lireToken();
  window.localStorage.removeItem(CLE_TOKEN);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.accessToken);
  }
}
