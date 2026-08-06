/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ⚠️ `VITE_GOOGLE_DRIVE_CLIENT_ID` a disparu au commit 6 de la phase 6 (05/08/2026) avec tout le
  // module Google Drive — voir CLAUDE.md.

  // Refonte Supabase, phase 2 (authentification) — voir .env.example. ⚠️ Depuis la connexion
  // obligatoire (05/08/2026), leur absence bloque désormais TOUTE l'application (mur bloquant,
  // cf. components/EcranConnexionObligatoire.tsx) — ce n'est plus un mode dégradé. Les deux sont
  // publiques par conception : ce n'est pas la clé anon qui protège les données, c'est le Row Level
  // Security (phase 1).
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
