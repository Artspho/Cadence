/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
        // Aucune API : tout est en localStorage. Précacher le bundle buildé suffit à rendre
        // l'app 100 % fonctionnelle hors-ligne dès la première visite.
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
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
