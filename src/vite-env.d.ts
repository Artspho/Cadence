/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client OAuth2 Google Cloud (type "Application Web") pour l'étape 3 (Google Drive, optionnel)
  // du module Frais réels — voir .env.example. Absent = le bouton "Connecter Google Drive" échoue
  // proprement avec un message d'erreur, le mode localStorage reste utilisable normalement.
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
