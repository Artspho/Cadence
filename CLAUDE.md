# CLAUDE.md — Cadence

App web (SPA) d'aide à la gestion des droits pour les intermittents du spectacle
**Annexe 10** (artistes / musiciens), avec un focus artistes-enseignants.
Nord de l'app : **donner une visibilité claire et fiable de son statut** (« où j'en
suis, qu'est-ce que je dois faire »).

> Spec complète et faisant foi : **`docs/SPEC.md`**. Maquette visuelle de référence :
> **`docs/maquette_dashboard.html`**. En cas de doute, ces deux fichiers priment.
> Registre de validation : **`docs/validation.md`** — compare les chiffres de Cadence au
> simulateur officiel France Travail et aux notifications réelles. Les cellules ne se
> remplissent qu'à partir d'une vraie comparaison, jamais d'un exemple fictif.

---

## ⚠️ Deux devoirs sacrés (avant toute fonctionnalité)

1. **Ne jamais perdre les données de l'utilisateur.** (→ export/import JSON dès le départ.)
2. **Ne jamais afficher un faux « feu vert ».** Si un cas sort du périmètre ou si une
   donnée manque, on le signale et on renvoie vers France Travail — on n'invente pas
   de statut rassurant.

Tout le reste sert ces deux devoirs et la visibilité du statut.

---

## Commandes

```bash
npm install
npm run dev      # serveur de dev Vite
npm run test     # tests Vitest (moteur)
npm run build    # typecheck + build de prod
```

## Stack

React + TypeScript · Tailwind CSS · Vite · Vitest · Zod · date-fns.
Persistance : `localStorage` derrière `src/storage/` (remplaçable par une API plus tard).
Import PDF (V2) : `pdfjs-dist` **côté client** (données sensibles, jamais envoyées).

---

## Règles d'or (non négociables)

- **La config est la seule source de vérité réglementaire.** Toute constante légale vit
  dans `src/config/franceTravailConfig.ts`. **Aucune** valeur réglementaire en dur dans
  la logique métier.
- **Ne jamais inventer une valeur réglementaire.** Valeur non certifiée → `TODO` commenté
  (voir `valeursDatees` : SMIC, PMSS laissés à `null`), jamais une approximation.
- **Le moteur (`src/engine/`) est 100 % pur** : fonctions `(données, config) → résultat`,
  sans React ni DOM, **testées** (le calcul touche aux droits/revenus des gens).
- **Deux compteurs distincts, à ne jamais mélanger** :
  - `heuresPour507` (statut) inclut enseignement plafonné + heures assimilées.
  - `SR` / `NHT` (montant ARE) **excluent totalement** enseignement et formation.
- Robustesse : jamais de division par zéro ni de faux « bloqué » à 0 heure
  (profil neuf / première admission sans historique).
- Copie : français, tutoiement, voix active, orientée action (« il te manque ~3 cachets »).

---

## Carte du code

```
src/
  config/franceTravailConfig.ts   # constantes légales versionnées (source mars 2026)
  types/index.ts                  # modèle de données
  engine/                         # PUR + testé
    periodeReference.ts  decompteHeures.ts  salaireReference.ts
    areBrute.ts  areNette.ts  prediction.ts  alertes.ts  cycles.ts
    __tests__/
  lib/extractionBulletin.ts       # import PDF (V2)
  storage/localStorageAdapter.ts  # + export/import JSON (schemaVersion, anti-écrasement)
    __tests__/
  components/                     # Dashboard, ProjectionChart, ContractForm,
                                   # ContractList, ImportBulletins, AlertCenter,
                                   # Historique, Simulateur, TopBar, Onboarding,
                                   # AProposLimites, AvertissementHorsPerimetre,
                                   # ConfirmationImport
  App.tsx  main.tsx  index.css
```

## État actuel

- ✅ Outillage (Vite/TS/Tailwind/Vitest) — compile et tourne.
- ✅ `config/franceTravailConfig.ts` (valeurs sourcées + validation Zod).
- ✅ `types/index.ts` (modèle complet, incl. `Profil.activiteHorsAnnexe10`).
- ✅ Design tokens (Tailwind + `index.css`) alignés sur la maquette.
- ✅ `engine/` complet et testé : `periodeReference`, `decompteHeures`, `salaireReference`,
  `areBrute` (+ `calculerAJBrutePourFenetre`), `areNette`, `prediction`, `alertes`, `cycles`
  — **52 tests Vitest**, tous verts (dont 7 sur `storage/`).
- ✅ `storage/`, `components/`, câblage `App.tsx` — bêta fonctionnelle de bout en bout
  (onboarding → tableau de bord → contrats → import PDF → historique → simulateur → à propos).
- ✅ **Bug corrigé** : un profil neuf sans date anniversaire connue n'affiche plus jamais le
  statut « bloqué » à 0 h — court-circuit dans `prediction.ts`, testé explicitement.
- ✅ **Réadmission allongée branchée** : `calculerAJBrutePourFenetre` décide seule standard vs
  allongée à partir de `fenetre.tranchesReadmission`, câblée dans `App.tsx` et `Simulateur.tsx`
  (se rabat sur le standard sans planter tant que le SMIC horaire n'est pas renseigné).
- ✅ **Garde-fou « situation mixte » implémenté** : question posée à l'onboarding (avant tout
  premier affichage d'un chiffre) + section « Ton profil » modifiable dans l'onglet À propos ;
  alerte `situation_mixte` exclusive dans `detecterAlertes` ; écran d'avertissement unique
  (`AvertissementHorsPerimetre.tsx`) remplaçant Dashboard/Historique/Simulateur tant que le
  profil est signalé hors Annexe 10 pur. Contrats et Import PDF restent utilisables normalement.
- 🔶 **Limite connue :** `calculerAJBrutePourFenetre` n'est **pas** câblée dans `engine/cycles.ts`
  — l'historique des exercices passés ignore `tranchesReadmission` et calcule toujours l'AJ brute
  avec les diviseurs standard (détail dans `docs/SPEC.md` §10).
- 🔶 **Limite connue :** le garde-fou « situation mixte » n'a aucun test automatisé côté interface
  (seul `detecterAlertes` est testé, cf. `engine/__tests__/alertes.test.ts`). Après toute grosse
  modification d'UI touchant `App.tsx`, `Onboarding.tsx` ou `AProposLimites.tsx`, **re-vérifier à
  la main** : cocher/décocher `activiteHorsAnnexe10` et confirmer qu'aucun chiffre n'apparaît sur
  Dashboard/Historique/Simulateur tant que la case est cochée.
- ✅ **`config.valeursDatees.smicHoraireBrut` renseigné** (12,31 €, arrêté du 22 mai 2026, en
  vigueur au 01/06/2026) — la formule réadmission allongée (point ci-dessus) est donc réellement
  active dès qu'un profil réadmission a une fenêtre étendue. `.pmssMensuel` reste à `null` (TODO
  volontaire, module indemnisation mensuelle V2, non utilisé ailleurs).
- ✅ **Bug CSG/CRDS corrigé** (`docs/validation.md`, cas Fictif #2/#3) : `areNette.ts` calculait
  CSG (6,2 %) + CRDS (0,5 %) sur le SJM entier au lieu de l'allocation après retraite — écart d'un
  facteur ~8, invisible avant ces deux cas de validation. Corrigé : assiette = 98,25 % de
  l'allocation après retraite (`cotisations.tauxAssietteCSGCRDS`), écrêtement au plancher
  `cotisations.plancherEcretementJournalier` (62 €, source simulateur officiel FT — **distinct**
  de `valeursDatees.smicHoraireBrut`/`smicJournalierBrut`, qui restent réservés à la réadmission
  allongée et à la franchise salaires). Garde-fou ajouté pour la bande 60-62 € où l'allocation est
  déjà au plancher après la seule retraite complémentaire — sans lui, l'écrêtement aurait produit
  un montant négatif et un net > brut.
- ✅ **Export/import JSON complet** (devoir sacré n°1, §11.A) : `schemaVersion` distinct de
  `franceTravailConfig.meta.version`, 3 refus distincts à l'import (JSON invalide / version de
  schéma inconnue / forme Zod invalide), jamais d'écriture avant validation complète. Anti-
  écrasement : `ConfirmationImport.tsx` déclenche une sauvegarde automatique de l'état actuel
  (téléchargée, inconditionnellement) **avant** de valider le fichier importé, qui n'écrase l'état
  en place que si la validation réussit — ordre vérifié par construction dans `App.tsx`
  (`confirmerImport`), pas seulement documenté. Testé en round-trip (y compris sur l'état vide
  d'un tout premier utilisateur) et manuellement dans le navigateur (import valide, JSON corrompu,
  état préservé après refus).
- ⬜ **Non traité (V2/V3) :** coordination européenne (périodes U1/PDU1) — même famille qu'Annexe 8/article 65, hors périmètre Annexe 10 pur. Aucune logique ni champ de données ne l'anticipe encore (détail dans `docs/SPEC.md` §10 et §11.C). Ne pas confondre avec le champ `territoire` du contrat, qui couvre un cas différent (cachet ponctuel joué en EEE/Suisse/UK mais déclaré en France).
- 🔁 **Maintenance de la config** (récurrent, perso — hors app, pas de backend en bêta) : une fois
  par mois, vérifier à la source officielle SMIC (horaire / mensuel / journalier), PMSS, et les
  plafonds ARE (AJ min 31,96 €, plancher 44 €, plafond 174,80 €) — au minimum à chaque
  revalorisation connue (SMIC/PMSS au 1er janvier et lors des hausses en cours d'année, ex. 1er
  juin 2026) et à chaque nouvelle convention d'assurance chômage, re-vérifier **toutes** les
  valeurs de `franceTravailConfig.ts`. Si une valeur a bougé : mettre à jour
  `franceTravailConfig.ts` (+ `meta.version`, `dateEntreeVigueur`, et `valableJusquau` du bandeau)
  et rejouer tous les cas de `docs/validation.md` contre le simulateur officiel. Ferme le risque
  « maintenance de la config non attribuée » identifié au SPEC §10. Objectif : garantir dans la
  durée les deux devoirs sacrés (pas de perte de données, pas de chiffre faux). La config est
  actuellement datée « 2026.06 » (alignée sur la revalorisation SMIC du 1er juin 2026) — prochaine
  échéance connue : la revalorisation SMIC/PMSS du 1er janvier suivant.

**Prochaines pistes** (au choix, pas d'ordre imposé) : les deux limites connues ci-dessus, ou les
autres items du §11.A du SPEC encore ouverts (PWA réellement installable, alignement visuel fin
sur `docs/maquette_dashboard.html`, transparence du calcul).

---

## Périmètre BÊTA (ce qu'on construit maintenant)

Objectif : bêta entre amis pour valider que l'app aide à s'organiser.

**Dans la bêta :** tableau de bord honnête (projection temporelle en héros), saisie guidée +
état vide, export/import JSON, bandeau « règles vérifiées au JJ/MM/AAAA » + source, garde-fou
« situation mixte », coaching léger, bouton feedback, PWA installable.

**Hors bêta (plus tard) :** backend/comptes/synchro, notifications push, import PDF généralisé,
module indemnisation mensuelle (franchises, seuils, PMSS), Annexe 8 / article 65.
(Détails et phasage : §11 du SPEC. L'archi est déjà prête à les recevoir.)

---

## Ancrages réglementaires (rappel — source de vérité = la config)

- Seuil : **507 h** sur **365 j glissants** (fin du dernier contrat = date anniversaire).
- Cachet artiste = **12 h** (plafond **28 cachets/mois**). EEE/Suisse/UK = 6 h/jour.
- Enseignement : plafond **70 h** (< 50 ans) / **120 h** (≥ 50 ans) ; compte pour les 507 h,
  **jamais** dans le montant. Cumul enseignement + formation ≤ **338 h**.
- ARE Annexe 10 : **AJ brute = A + B + C**, AJ min **31,96 €**, plancher **44 €**,
  plafond **174,80 €**. (Coefficients dans la config.)
- Heures assimilées (maternité, adoption, AT, ALD, suspension) : **5 h/jour**.
  Maladie inter-contrat : **allonge** la fenêtre de 365 j (ne compte pas en heures).

---

## Charte graphique (résumé — détail §8 du SPEC + maquette)

Sombre, premium, calme (esprit Finary). Fond `#0A0C10`, surfaces `#12161D`.
Accent + statut « Sécurité » = menthe `#3FD69B` ; alerte = ambre `#F5C46B` ; bloqué = rouge `#F2726B`
(toujours icône + mot, jamais la couleur seule). Données : menthe / teal `#57A9F0` / violet `#9B8CFF`.
Typo : **Space Grotesk** (display/chiffres) + **Inter** (corps). Tokens dans `tailwind.config.js`.
**Élément signature = le graphique de projection temporelle** (temps → heures cumulées), pas une jauge.
