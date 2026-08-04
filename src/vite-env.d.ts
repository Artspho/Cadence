/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client OAuth2 Google Cloud (type "Application Web") pour l'étape 3 (Google Drive, optionnel)
  // du module Frais réels — voir .env.example. Absent = le bouton "Connecter Google Drive" échoue
  // proprement avec un message d'erreur, le mode localStorage reste utilisable normalement.
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;

  // Refonte Supabase, phase 2 (authentification) — voir .env.example. Absentes = la section
  // « Compte » de l'onglet Mon profil affiche « connexion non configurée », et TOUT le reste de
  // Cadence fonctionne normalement sur le localStorage. Les deux sont publiques par conception :
  // ce n'est pas la clé anon qui protège les données, c'est le Row Level Security (phase 1).
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
