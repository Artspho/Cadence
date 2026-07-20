# Cadence

Application web d'aide à la gestion des droits pour les intermittents du spectacle
(Annexe 10). Suivi des 507 heures, estimation de l'allocation, alertes et projection.

> Estimation indicative — ne se substitue pas à une notification officielle de France Travail.

## Démarrer

```bash
npm install
npm run dev
```

## Développer avec Claude Code

Ce dépôt est prêt pour Claude Code. Le fichier **`CLAUDE.md`** (chargé automatiquement)
contient les règles, l'architecture et les garde-fous. La spec complète et faisant foi
est dans **`docs/SPEC.md`** ; la maquette visuelle de référence dans
**`docs/maquette_dashboard.html`**.

Deux devoirs sacrés : ne jamais perdre les données, ne jamais afficher un faux « feu vert ».

## Scripts

- `npm run dev` — serveur de développement
- `npm run test` — tests du moteur de calcul (Vitest)
- `npm run build` — typecheck + build de production

## État

Ossature + config réglementaire + types + design tokens en place.
Moteur de calcul et interface à construire (voir `CLAUDE.md` › « État actuel »).
