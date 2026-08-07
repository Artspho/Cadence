/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Dev-only : émule `/api/extract-document` (Vercel Edge Function) en local, car `vite dev` ne sert
 * pas les Vercel Functions (vérifié le 29/07/2026, 404 sur cette route — cf. CLAUDE.md). Appelle le
 * VRAI handler exporté par `api/extract-document.ts`, sans aucune modification de sa logique : ce
 * plugin ne fait que traduire Node http.IncomingMessage/ServerResponse <-> Request/Response Web
 * standard, exactement l'interface que Vercel Edge fournirait en production. Retiré du bundle de
 * build (`apply: "serve"`) — n'existe jamais en production, où Vercel sert la vraie fonction.
 *
 * Ajouté le 01/08/2026 pour un premier test réel de bout en bout (navigateur → consentement →
 * réseau → extraction) sur un vrai document, jamais exercé jusqu'ici que par script direct ou en
 * Playground (cf. docs/reprise.md).
 */
function emulateurApiDevPlugin(): Plugin {
  return {
    name: "emulateur-api-extract-document-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/extract-document", async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule("/api/extract-document.ts");
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = Buffer.concat(chunks);
          const webRequest = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
          });
          const webResponse: Response = await handler(webRequest);
          res.statusCode = webResponse.status;
          webResponse.headers.forEach((value, key) => res.setHeader(key, value));
          const buf = Buffer.from(await webResponse.arrayBuffer());
          res.end(buf);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Émulateur dev : ${err instanceof Error ? err.message : String(err)}` }));
        }
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // `.env` non préfixé `VITE_` n'est jamais exposé à `import.meta.env` côté client (comportement Vite
  // normal, cf. api/extract-document.ts) — mais le process Node du serveur dev, lui, doit porter
  // `MISTRAL_API_KEY` dans `process.env` pour que le handler importé ci-dessus (qui lit
  // `process.env.MISTRAL_API_KEY`, code de production inchangé) la trouve, exactement comme Vercel
  // l'injecterait en production depuis ses variables d'environnement de projet.
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "");
    if (env.MISTRAL_API_KEY) process.env.MISTRAL_API_KEY = env.MISTRAL_API_KEY;
  }

  return {
  plugins: [
    react(),
    emulateurApiDevPlugin(),
    VitePWA({
      // Mise à jour automatique, sans bandeau de confirmation : un correctif de calcul (ex. le
      // bug CSG/CRDS déjà corrigé cette session) doit atteindre l'utilisateur vite, pas rester
      // bloqué derrière un service worker périmé (devoir sacré n°2).
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        lang: "fr",
        name: "Cadence · Suivi intermittent",
        short_name: "Cadence",
        description: "Estimation indicative des droits Annexe 10 (507 h, ARE brute et nette).",
        start_url: "/",
        display: "standalone",
        background_color: "#0A0C10",
        theme_color: "#3FD69B",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // ⚠️ CORRECTION DU 06/08/2026 — CE COMMENTAIRE AFFIRMAIT UNE CHOSE FAUSSE. Il disait
        // « Aucune API : tout est en localStorage. Précacher le bundle buildé suffit à rendre l'app
        // 100 % fonctionnelle hors-ligne dès la première visite. » C'était vrai avant la refonte
        // Supabase ; ça ne l'est plus depuis la phase 5 (le serveur est la source de vérité) et la
        // connexion obligatoire (commit `1c685e6`).
        //
        // CE QUE LE PRÉCACHE FAIT VRAIMENT : il rend la COQUILLE de l'app disponible hors ligne
        // (bundle, styles, icônes). Ce qu'il ne fait pas : ouvrir Cadence sans serveur. Hors ligne,
        // deux cas — session en cache encore valide => l'app s'ouvre en LECTURE SEULE sur la copie
        // locale (arbitrage de la phase 5, cf. storage/bascule.ts, issue `serveurMuet`) ; jeton
        // expiré (1 h par défaut côté Supabase) => le rafraîchissement échoue, `useSession` rend
        // `indetermine`, et le mur de EcranConnexionObligatoire.tsx rend Cadence INUTILISABLE alors
        // que les données sont là, dans le navigateur. C'est le trou connu de la « phase 7 » — non
        // corrigé, non arbitré avec Benoît. Ne pas écrire ici que le hors-ligne fonctionne.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // Google Fonts n'est pas dans le bundle Vite (lien externe dans index.html) : sans ça,
        // l'app resterait utilisable hors-ligne mais retomberait sur la police système.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // `pdfjs-dist` (ImportBulletins) et `jspdf`/`html2canvas` (FraisReels) sont sortis du chunk
    // principal le 07/08/2026 (`React.lazy`, cf. App.tsx) — ils ne pèsent plus que sur les deux
    // écrans qui en ont vraiment besoin. Le chunk principal restant (~950 kB avant minification,
    // ~275 kB gzip) porte React, Supabase et l'ensemble des écrans toujours visibles : c'est le poids
    // normal de l'app, pas un oubli. Seuil relevé pour ne plus faire remonter l'avertissement Vite à
    // chaque build (cf. logs Vercel) sur un chiffre qui ne bougera plus sans un chantier de
    // découpage par onglet nettement plus lourd.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    // "node" reste le défaut : la quasi-totalité des tests sont des fonctions pures du moteur, sans
    // DOM. Les rares tests de composant (jsdom) déclarent leur propre environnement via le pragma
    // `// @vitest-environment jsdom` en tête de fichier, cf. components/__tests__/RevenusMensuels.test.tsx.
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  };
});
