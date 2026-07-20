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
  storage/localStorageAdapter.ts
  components/                      # Dashboard, ProjectionChart, ContractForm,
                                   # ContractList, ImportBulletins, AlertCenter,
                                   # Historique, Simulateur
  App.tsx  main.tsx  index.css
```

## État actuel

- ✅ Outillage (Vite/TS/Tailwind/Vitest) — compile et tourne.
- ✅ `config/franceTravailConfig.ts` (valeurs sourcées + validation Zod).
- ✅ `types/index.ts` (modèle complet, incl. `Profil.activiteHorsAnnexe10`).
- ✅ Design tokens (Tailwind + `index.css`) alignés sur la maquette.
- ✅ `engine/` complet et testé : `periodeReference`, `decompteHeures`, `salaireReference`,
  `areBrute` (+ `calculerAJBrutePourFenetre`), `areNette`, `prediction`, `alertes`, `cycles`
  — **41 tests Vitest**, tous verts.
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
- 🔶 **Limite connue :** `config.valeursDatees.smicHoraireBrut` et `.pmssMensuel` sont à `null`
  (TODO volontaire, cf. `franceTravailConfig.ts`) — à renseigner depuis la source officielle avant
  toute mise en production. Tant que `smicHoraireBrut` est `null`, la formule réadmission allongée
  (point ci-dessus) reste inactive et se rabat silencieusement sur le calcul standard.
- ❌ **Bug confirmé par validation (`docs/validation.md`, cas Fictif #2) :** `areNette.ts` applique
  CSG (6,2 %) + CRDS (0,5 %) sur le SJM entier, sans la règle d'écrêtement qui limite le
  prélèvement pour ne pas faire passer l'allocation sous un plancher lié au SMIC. Écart confirmé
  de 12,08 €/jour face au simulateur officiel dès que l'AJ brute dépasse 60 €. Formule du SPEC
  §6.5 incomplète. Directement lié au TODO `smicHoraireBrut` ci-dessus : à corriger UNIQUEMENT une
  fois la règle d'écrêtement sourcée ET cette valeur renseignée. Ne pas deviner.
- ⬜ **Non traité (V2/V3) :** coordination européenne (périodes U1/PDU1) — même famille qu'Annexe 8/article 65, hors périmètre Annexe 10 pur. Aucune logique ni champ de données ne l'anticipe encore (détail dans `docs/SPEC.md` §10 et §11.C). Ne pas confondre avec le champ `territoire` du contrat, qui couvre un cas différent (cachet ponctuel joué en EEE/Suisse/UK mais déclaré en France).
- 🔁 **Vérifications régulières de viabilité :** au minimum à chaque revalorisation connue
  (SMIC/PMSS au 1er janvier et lors des hausses en cours d'année, ex. 1er juin 2026) et à chaque
  nouvelle convention d'assurance chômage, re-vérifier **toutes** les valeurs de
  `franceTravailConfig.ts` contre la source officielle **ET** rejouer les cas de
  `docs/validation.md` contre le simulateur officiel. Objectif : garantir dans la durée les deux
  devoirs sacrés (pas de perte de données, pas de chiffre faux). Rappel : la config est
  actuellement datée « 2026.03 », donc **antérieure** à la revalorisation SMIC du 1er juin 2026.

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
