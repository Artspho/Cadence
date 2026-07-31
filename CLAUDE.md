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
  config/contact.ts               # EMAIL_FEEDBACK + construireLienFeedback (pas réglementaire)
    __tests__/
  types/index.ts                  # modèle de données
  engine/                         # PUR + testé
    periodeReference.ts  decompteHeures.ts  salaireReference.ts
    areBrute.ts  areNette.ts  prediction.ts  alertes.ts  cycles.ts
    indemnisationMensuelle.ts      # jours indemnisés/mois depuis les vrais contrats (V2)
    decoupageMensuel.ts            # repartirContratParMois() — prorata jours calendaires
    ajReelleUtils.ts                # getAjReelleAt() — taux d'AJ réelle applicable à une date
    __tests__/
  lib/extractionBulletin.ts       # import PDF (V2)
  lib/dashboardVide.ts            # dashboardEstVide(contrats) — présence, jamais 0h au montant
    __tests__/
  storage/localStorageAdapter.ts  # + export/import JSON (schemaVersion, anti-écrasement)
    __tests__/
  components/                     # Dashboard, ProjectionChart, ContractForm,
                                   # ContractFormRecurrent, ContractList, ImportBulletins,
                                   # AlertCenter, Historique, Simulateur, TopBar, Onboarding,
                                   # MonProfil, AvertissementHorsPerimetre,
                                   # ConfirmationImport, DashboardVide, RevenusMensuels
  lib/contratRecurrent.ts         # genererContratsRecurrents() — contrat récurrent enseignement
    __tests__/
  App.tsx  main.tsx  index.css

scripts/generate-pwa-icons.mjs    # génère public/pwa-*.png, maskable-*, apple-touch-icon, favicon
                                   # (dégradé mint→teal de TopBar.tsx) — zéro dépendance externe
vite.config.ts                    # + VitePWA (manifest, service worker, cf. État actuel)
```

## État actuel

### Le plus récent d'abord — session du 31/07/2026

- ✅ **Habillage de `ConsentementEnvoiIA.tsx` désamorcé** (commit `91b5634`) : la phrase [1] a perdu
  sa boîte ambre dédiée — elle datait de quand cette phrase annonçait un entraînement réel (le
  risque), et le texte a changé de sens (plus rassurant) sans que l'habillage suive. Les trois
  phrases reçoivent désormais le même traitement neutre, cohérent avec `ConfirmationImport.tsx`
  (l'autre modale bloquante de l'app, qui n'a jamais eu ce genre de boîte). Badge du haut et bouton
  restent en ambre : justifié, la donnée quitte réellement l'appareil vers un tiers.
- ✅ **Point 2 (AJ brute vs nette) clos avec preuve, pas deviné** (commits `2d05f6d`, `7bdb14a`) :
  `areNette.ts` était déjà prouvé correct depuis le 24/07 (`config/franceTravailConfig.ts` l.63-68,
  validé « à l'euro près » sur fév-juin 2026 ; reconfirmé via `docs/validation.md` Cas réel #1,
  0,00 € d'écart) — seul le backlog n'avait jamais été mis à jour, péremption documentaire pure.
  Résidu réel traité séparément : la provenance de la valeur saisie dans `ajReelleHistorique` en
  saisie manuelle (rien n'empêchait de recopier une ligne « brute » d'un relevé dans le champ « AJ
  nette »). Décision : pas de champ `natureMontant` déclaratif (déplacerait le risque sans le
  réduire) — un avertissement de plausibilité dans `MonProfil.tsx` (`GestionAjReelle`) se déclenche
  si la valeur dépasse 90 % du plafond ARE brut (`config.are.plafond`). Justification complète dans
  `docs/reprise.md`.
- ✅ **Hébergement UE de Mistral confirmé par source officielle** (commit `6b35861`) :
  [help.mistral.ai — Where do you store my data or my Organization's data?](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data),
  consulté le 31/07/2026 — « By default, your data is hosted in the European Union. »
  `content/mentionEnvoiIA.ts` **inchangé** (affirmation déjà exacte) : seule la doc interne
  (🔶→✅) a changé, plus deux traces obsolètes nettoyées.
- ✅ **Inventaire statique des documents utiles** (commit `f838092`) : `content/documentsUtiles.ts`
  + `components/DocumentsUtiles.tsx`, rendu dans `MonProfil.tsx` juste avant « Périmètre du MVP ».
  Volontairement distinct de la checklist **dynamique** déjà existante
  (`ChecklistDocuments.tsx`/`lib/documentsRequis.ts`, onglet Import PDF) — celle-ci calcule ce qui
  manque depuis les vraies données du profil ; celle-là est une référence à lire une fois, groupée
  par situation (toujours utile / si tu enseignes / si arrêt maladie-maternité / si taux PAS
  manquant), et couvre des documents absents de la checklist dynamique (contrat d'enseignement,
  attestation CPAM avec pointeur vers la saisie manuelle réelle dans « Périodes particulières »).
  Chaque composant renvoie explicitement vers l'autre pour éviter toute confusion. **Piste future
  notée, non implémentée** : un suivi d'état « déposé / manquant » par document serait un doublon
  avec la checklist dynamique — à envisager seulement si un besoin réel de fusionner les deux vues
  apparaît.

Branche `backend-api-import-ia`, recréée depuis `master` en début de session (`git checkout -B`,
aucune perte — l'ancienne divergence sur le taux PAS était déjà résolue côté `master`) et restée
synchronisée à chaque commit. 5 commits locaux cette session, rien poussé sur `origin`.

### Session du 29/07/2026 (jour)

- ✅ **Chantier « checklist des documents à fournir » terminé, 3 étapes.** Nouveau document de
  référence `docs/files/inventaire_donnees_et_documents.md` (remplace
  `inventaire_documents_non_couverts.md`, conservé avec une bannière), orienté **besoins** et non
  documents : il part des endroits où le code refuse de calculer. Puis `src/lib/documentsRequis.ts`
  (pure, 25 tests) et `src/components/ChecklistDocuments.tsx`, rendu **au-dessus des deux canaux de
  dépôt** dans `App.tsx`. Commits `0c53dee`, `6615263`, `02300ef`, `ad855bc`, `8d613ae`, `c1097d0`.
- ✅ **Trois affirmations fausses corrigées** : AEM, bulletin artiste et bulletin enseignement
  n'étaient pas « non couverts » mais « non **validés** sur pièce réelle » — ils sont codés. La
  confusion aurait fait recoder de l'existant.
- ✅ **`dateLimiteIndemnisation` reclassé BLOQUANT** (`02300ef`) : son absence fait afficher des mois
  hors droits avec un montant, sans aucune protection compensatoire. Preuve par deux tests voisins du
  moteur (`indemnisationMensuelle.test.ts:372` et `:401`) : dernier mois 2027-01 avec la date,
  2027-02 sans elle. C'est la régression signalée le 26/07.
- ⏳ **Phase 1 du chantier « périodes assimilées » écrite mais NON COMMITTÉE** — voir « Prochaine
  action ». 440 tests verts, typecheck propre, 4 fichiers modifiés dans l'arbre de travail.
- ⬜ **Décisions de périmètre du 29/07** : la lecture IA de la **déclaration fiscale est abandonnée**
  (volontairement non comblée, pas une dette — motif au §6.1 de l'inventaire) ; **tout ce qui touche
  au déploiement et au test réel est reporté en fin de projet** (`vercel dev`, premier vrai document
  par l'endpoint, décision de fusion dans `master`, corrections de `docs/SPEC.md`).

### Socle (antérieur)

- ✅ Outillage (Vite/TS/Tailwind/Vitest) — compile et tourne.
- ✅ `config/franceTravailConfig.ts` (valeurs sourcées + validation Zod).
- ✅ `types/index.ts` (modèle complet, incl. `Profil.activiteHorsAnnexe10`).
- ✅ Design tokens (Tailwind + `index.css`) alignés sur la maquette.
- ✅ `engine/` complet et testé : `periodeReference` (`SeuilReadmission`, type discriminé à 3
  variants : `calculable: true`, `historique_insuffisant`, `hors_bornes`), `decompteHeures`,
  `salaireReference`, `areBrute` (+ `calculerAJBrutePourFenetre`), `areNette`, `prediction`,
  `alertes`, `cycles` — **91 tests Vitest**, tous verts (dont 7 sur `storage/`, 5 sur `config/`,
  19 sur `lib/`).
- ✅ `storage/`, `components/`, câblage `App.tsx` — bêta fonctionnelle de bout en bout
  (onboarding → tableau de bord → mon profil → contrats → import PDF → historique → simulateur).
- ✅ **Bug corrigé** : un profil neuf sans date anniversaire connue n'affiche plus jamais le
  statut « bloqué » à 0 h — court-circuit dans `prediction.ts`, testé explicitement.
- ✅ **Réadmission allongée branchée** : `calculerAJBrutePourFenetre` décide seule standard vs
  allongée à partir de `fenetre.tranchesReadmission`, câblée dans `App.tsx` et `Simulateur.tsx`
  (se rabat sur le standard sans planter tant que le SMIC horaire n'est pas renseigné).
- ✅ **Garde-fou « situation mixte » étendu à trois états** : `Profil.regimeDeclare:
  "annexe10_pur" | "mixte" | "inconnu"` (remplace l'ancien booléen `activiteHorsAnnexe10`, gardé
  **déprécié** en lecture seule — jamais réécrit par l'UI). Question posée à l'onboarding (avant
  tout premier affichage d'un chiffre, ciblée technicien A8 / emploi hors spectacle — **jamais**
  l'enseignement, qui reste cœur de cible A10 pur) + section « Ton profil » modifiable dans
  l'onglet Mon profil, désormais 3 choix (Non / Oui / Je ne sais pas) au lieu d'une case à cocher.
  « inconnu » (je-ne-sais-pas) suit **exactement** le même chemin que « mixte » (conservateur, au
  moindre doute → France Travail) : même alerte `situation_mixte` exclusive dans `detecterAlertes`
  (via le prédicat pur `profilHorsPerimetre()`, `lib/profilHorsPerimetre.ts` — seul import
  `lib/` toléré dans `engine/`, fonction sans React/DOM), même écran unique
  (`AvertissementHorsPerimetre.tsx`) remplaçant Dashboard/Historique/Simulateur. **Migration
  (devoir sacré n°1) :** `profilHorsPerimetre()`/`regimeEffectif()` lisent `activiteHorsAnnexe10`
  en repli quand `regimeDeclare` est absent — aucun profil déjà enregistré ne change de
  comportement au prochain chargement (testé explicitement, cf. `profilHorsPerimetre.test.ts`).
  Contrats et Import PDF restent utilisables normalement.
- 🔶 **Limite connue :** `calculerAJBrutePourFenetre` n'est **pas** câblée dans `engine/cycles.ts`
  — l'historique des exercices passés ignore `tranchesReadmission` et calcule toujours l'AJ brute
  avec les diviseurs standard (détail dans `docs/SPEC.md` §10).
- 🔶 **Limite connue :** le garde-fou « situation mixte » n'a aucun test automatisé côté interface
  (seul `detecterAlertes` est testé, cf. `engine/__tests__/alertes.test.ts` — couvre `mixte` et
  `inconnu`, pas le rendu React). Après toute grosse modification d'UI touchant `App.tsx`,
  `Onboarding.tsx` ou `MonProfil.tsx`, **re-vérifier à la main** : sélectionner tour à tour
  les 3 choix (Non / Oui / Je ne sais pas, `regimeDeclare`) et confirmer qu'aucun chiffre
  n'apparaît sur Dashboard/Historique/Simulateur tant que « Oui » ou « Je ne sais pas » est
  sélectionné, et qu'il réapparaît normalement sur « Non ». Vérifié manuellement dans le
  navigateur lors de l'extension à 3 états (2026-07-22) ; à refaire après toute future
  modification de ces trois fichiers.
- ✅ **Revalidation post-onboarding** (SPEC §11.A) : date de naissance, situation et date
  anniversaire sont désormais modifiables après coup, dans « Mon profil » → « Ton profil »
  (`MonProfil.tsx`), plus besoin d'éditer le JSON à la main. Prudence ciblée comme prévu :
  date de naissance libre, sans cérémonie ; situation modifiable librement mais le formulaire
  reste cohérent ; date anniversaire modifiable avec une note explicite + une confirmation en
  deux clics (« Enregistrer » → « Confirmer le changement ») avant toute écriture, pas de
  changement silencieux. **Piège fermé** (trouvé en investiguant, indépendant de l'édition
  elle-même) : réadmission + date anniversaire inconnue était déjà validable dès l'Onboarding
  — `periodeReference.ts` aurait fait tourner l'extension de réadmission sur une fenêtre fictive
  "se terminant aujourd'hui", un seuil ajusté plausible mais faux (devoir n°2). `lib/coherenceProfil.ts`
  (`validerCoherenceProfil` + `validerProfilPourEcriture` + `profilSchema.refine`) bloque cette
  combinaison aux **3 portes** qui écrivent un profil — Onboarding, édition, **et import JSON**
  (même règle, même message partout, pas de 4e demi-rempart) — et est le point de passage unique
  dans `App.tsx` (`modifierProfil`), pas seulement dans le composant. Devoir n°1 tenu par
  construction : `modifierProfil` n'appelle jamais `setDonnees` avant que le candidat n'ait passé
  Zod puis cohérence, donc l'ancien profil valide n'est jamais à risque — pas de fichier de
  sauvegarde téléchargé pour autant (disproportionné pour 3 champs sur un profil existant, à la
  différence de l'import qui remplace tout). `engine/` intouché : le moteur suppose désormais un
  profil cohérent par construction, cf. `docs/validation.md`. Vérifié manuellement dans le
  navigateur (refus Onboarding, refus édition avec le même message, recalcul complet du Dashboard
  après confirmation d'une nouvelle date anniversaire) — pas de test React, même limite actée
  ci-dessus ; couverture automatisée via `lib/__tests__/coherenceProfil.test.ts` (règle +
  point de passage Zod, testés directement, sans harnais UI).
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
- ✅ **Bandeau « règles vérifiées » + péremption** (§11.A) : `franceTravailConfig.meta.valableJusquau`
  (date ISO nullable, laissée à `null` — aucune échéance officielle connue à ce jour, même
  discipline que `valeursDatees`) comparée à la date du jour par la fonction pure `estPerime`
  (date injectée, jamais `new Date()` interne). `TopBar.tsx` (visible en permanence) et
  `MonProfil.tsx` (détaillé) lisent tous les deux `estPerime` — une seule source de vérité,
  icône + mot quand périmé (jamais la couleur seule, §8.6). **Corrigé au passage** : `MonProfil.tsx`
  contenait depuis plusieurs sessions un seuil `SEUIL_PEREMPTION_JOURS = 365` codé en dur — un
  seuil réglementaire deviné, jamais corrigé jusqu'ici. Supprimé, remplacé par `estPerime`.
- ✅ **Bouton de feedback** (§11.A) : `config/contact.ts` — `EMAIL_FEEDBACK` (`null` tant que non
  renseigné, jamais un placeholder ; renseigné à `benoit.zahra@orange.fr`) + `construireLienFeedback(email)`,
  fonction pure sans accès à `donnees`/`profil`/`contrats` (sujet et gabarit de corps fixes,
  aucune donnée utilisateur ne peut structurellement s'y glisser). Deux points d'accès —
  `TopBar.tsx` (toujours visible, adresse en texte de lien) et `MonProfil.tsx` (bouton +
  adresse en texte lisible en dessous) — **aucun** des deux ne s'affiche si `EMAIL_FEEDBACK` est
  `null` (pas de lien mort, pas de "null" visible), vérifié dans le navigateur dans les deux états.
  **Remplace** l'ancien lien `mailto:?subject=...` sans destination ni gabarit qui traînait dans
  `MonProfil.tsx` depuis plusieurs sessions, pas un ajout en parallèle.
- ✅ **État vide du Dashboard** (§11.A) : `lib/dashboardVide.ts` — `dashboardEstVide(contrats)` se
  déclenche sur l'**absence de contrat** (`contrats.length === 0`), jamais sur "0 h comptée au
  montant" (un profil 100 % enseignement a des contrats mais 0 h au montant ARE — testé
  explicitement, dashboard normal dans ce cas). `DashboardVide.tsx` (nouveau, purement
  présentationnel, aucune prop de date/profil) remplace **tout** le contenu normal — carte
  allocation comprise, plus de 44 € affiché à 0 contrat — par un écran d'invitation avec bouton
  d'action vers l'onglet Contrats. **`AlertCenter` masqué aussi dans cet état, et pas seulement
  en effet de bord** : une alerte "rythme insuffisant" sur un compte neuf est le même faux signal
  que le montant qu'on retire, l'autre bout du problème. **Fuite corrigée en vérifiant** : le chip
  `AlertCenterResume` (en-tête, visible sur tous les onglets) affichait encore ce même faux signal
  indépendamment du Dashboard — filtré désormais lui aussi quand le compte est vide (sauf l'alerte
  `situation_mixte`, qui reste vraie indépendamment du nombre de contrats). Vérifié dans le
  navigateur : compte neuf (aucun euro, aucune alerte, écran net) et compte avec un seul contrat
  100 % enseignement (dashboard normal, distinction respectée).
- ✅ **Bug Infinity corrigé** (le Dashboard pouvait afficher « Vise environ Infinity h/mois ») :
  `StatutPrediction.rythmeMensuelRequis: number` (sentinelle `Infinity` explicite quand
  `joursRestants <= 0` et `heuresRestantes > 0`) remplacé par `rythmeRequis: RythmeRequis`, un
  type discriminé à exhaustivité forcée par le compilateur (`types/index.ts`) :
  `{ atteignable: true; heuresParMois: number }` ou `{ atteignable: false; raison:
  "anniversaire_inconnu" | "delai_expire" }`. **Deux raisons distinctes, pas une seule** :
  `anniversaire_inconnu` (donnée manquante — profil neuf sans date anniversaire) n'est **jamais**
  présenté comme un délai expiré, ce qui aurait été un faux signal (devoir n°2) ; `delai_expire`
  couvre le seul cas où l'anniversaire est réellement connu et dépassé (niveau `bloque`). Plus
  aucun `Infinity` ne peut fuiter dans le retour du moteur. Tous les consommateurs traduisent
  désormais `atteignable:false` en clair : `Dashboard.tsx` a un switch exhaustif dédié
  (`libelleRythmeRequis`, cassant à la compilation si une raison est ajoutée sans être traitée
  ici) ; `alertes.ts` n'émet **aucune** alerte de rythme dans le cas `anniversaire_inconnu` (rien
  n'est imminent pour un profil dont la date anniversaire est inconnue) — l'alerte
  `rythme_insuffisant` ne se déclenche plus que si `atteignable: true`. Tests dédiés ajoutés
  (`prediction.test.ts`, `alertes.test.ts`) vérifiant explicitement l'absence de la chaîne
  « Infinity » dans les deux cas de figure. **Différé volontairement** : le cas « rythme fini mais
  humainement absurde » (délai non nul mais minuscule) n'a pas de 3e raison dédiée
  (`rythme_hors_limite`) — nécessiterait un seuil de plausibilité non réglementaire (décision
  produit), consigné au backlog (`docs/reprise.md`, `docs/validation.md`).
- ✅ **Transparence du calcul** (dernier item §11.A) : panneau `DetailCalcul.tsx`, replié par
  défaut sur le Dashboard, montrant le décompte des heures par catégorie (dont enseignement/
  formation retenus vs écartés), SR/NHT/SAR, l'AJ brute = A+B+C avec plancher/plafond, et le
  détail des cotisations jusqu'à l'AJ nette. **Aucun fichier `engine/` modifié** : le moteur
  exposait déjà tout ce détail dans ses types de retour, seul `App.tsx` ne faisait pas transiter
  `sr`/`nht`/`sar` jusqu'au Dashboard. **Piège trouvé en le testant, corrigé au passage** :
  `ProjectionChart.tsx` affichait « échéance atteinte » à côté d'un badge « Alerte » honnête
  quand l'anniversaire est inconnu — la fenêtre sentinelle "aujourd'hui" (même artifice que le
  bug Infinity ci-dessus, cf. `periodeReference.ts`) faisait recalculer localement un « jours
  restants » à zéro sans que le composant sache qu'il ne s'agissait pas d'une vraie échéance.
  Nouveau champ `StatutPrediction.anniversaireConnu` exposé (aucune logique changée), transmis à
  `ProjectionChart.tsx`, qui affiche désormais « date inconnue » dans ce cas. Le champ brut
  `joursRestants` reste une dette tracée pour tout futur consommateur direct (`docs/validation.md`,
  section « Dette tracée »). 80 tests verts, détail complet : `docs/reprise.md`.
- ✅ **Seuil de réadmission gonflé corrigé** (bug remonté par un vrai testeur, pas trouvé en
  interne) : un profil réadmission avec un historique de contrats trop court pour jamais rattraper
  le seuil croissant de la boucle d'extension (`periodeReference.ts`) épuisait ses 24 tentatives
  (`TRANCHES_MAX`) et affichait 1515 h (`507 + 24×42`) comme si c'était un vrai seuil ajusté — ex.
  « 480 / 1515 h » au lieu de « 480 / 507 h ». `FenetreReference.seuilReadmission` est désormais un
  type discriminé (`calculable: true/false`), construit à partir d'un booléen `trouve` explicite
  posé au `break`, jamais déduit du compteur de tranches par relecture implicite. En échec :
  `prediction.ts`/`areBrute.ts` retombent sur le seuil/la formule standard, `Dashboard.tsx` affiche
  un bandeau honnête dédié, `alertes.ts` porte une nouvelle alerte `seuil_readmission_non_calculable`.
  **Découverte en creusant** : le test existant pour ce scénario n'affirmait qu'une propriété vraie
  aussi bien en cas de succès que d'échec — il exerçait déjà le bug sans jamais le remarquer,
  dette méthodologique tracée dans `docs/validation.md`. 85 tests verts, détail complet :
  `docs/reprise.md`.
- ✅ **Onglet « À propos » renommé « Mon profil »**, remonté en 2e position (juste après le
  Tableau de bord, avant Contrats/Import/Historique/Simulateur) — c'est là que se renseigne
  `dateAnniversairePrecedente` en réadmission, ça doit rester facile à trouver.
  `MonProfil.tsx` (ex-`AProposLimites.tsx`) ; valeur interne du type `Onglet` (`"apropos"` →
  `"profil"`) jamais persistée, aucune migration. Le `<h2>Ton profil</h2>` interne reste
  inchangé (adresse à l'utilisateur, toujours correcte). Références croisées alignées dans
  `Onboarding.tsx` et `alertes.ts` (ce dernier disait déjà « Mon profil » par anticipation avant
  même que l'onglet soit renommé — corrigé au passage). 91 tests verts, détail complet :
  `docs/reprise.md`.
- ✅ **Contrat récurrent pour l'enseignement** (item 1 du backlog) : `lib/contratRecurrent.ts`
  (`genererContratsRecurrents`) matérialise, à la validation d'un seul formulaire
  (`ContractFormRecurrent.tsx`), **un `Contrat` normal par mois** de la plage choisie
  (hors mois exclus, sélection par chips), daté du dernier jour du mois, `type: "enseignement"`
  et `typeRemuneration: "heures"` **fixés** (l'enseignement se paie en heures de cours, jamais en
  cachets — décision produit actée, pas un oubli). **Option architecturale retenue** (vs. une
  entité « série » dépliée à la volée par le moteur, rejetée) : chaque contrat généré est
  indépendant dès sa création, seulement tagué `recurrenceId` (partagé par la série) +
  `source: "recurrent"` (`Contrat`, `types/index.ts`) — **`engine/` totalement intouché**
  (`cycles.ts`/`decompteHeures.ts` voient des contrats datés normaux, aucun risque de point d'appel
  du moteur qui oublierait de déplier une série, cf. devoir sacré n°2). Limite actée dès le plan,
  pas découverte après coup : **pas d'édition de série après coup**, seule voie de correction
  « supprimer toute la série + régénérer » — d'où un bouton « Supprimer la série » **visible
  directement sur la ligne résumé** (pas caché derrière un dépli), avec confirmation navigateur
  (nombre de contrats + employeur dans le message) avant toute suppression groupée. `ContractList.tsx`
  groupe désormais les contrats partageant un `recurrenceId` en une ligne repliable (résumé :
  employeur, nb de contrats, plage de mois, total heures/€) ; les contrats isolés (sans
  `recurrenceId`) gardent l'affichage plat existant, les deux types de lignes sont triés ensemble
  par date décroissante. Suppression individuelle d'un mois dans une série repliée toujours
  possible (cas d'une exception ponctuelle), sans passer par la suppression de toute la série.
  `localStorageAdapter.ts` (schéma Zod) accepte les nouveaux champs `source: "recurrent"` et
  `recurrenceId` (optionnels, round-trip export/import JSON testé). 9 tests dédiés
  (`lib/__tests__/contratRecurrent.test.ts` : génération, dates de fin de mois, `recurrenceId`
  partagé, id uniques, exclusion de mois, plage vide/inversée, mois unique). 100 tests verts au
  total, `tsc -b` propre. Vérifié dans le navigateur : génération avec exclusion, dépliage de
  série, suppression d'un seul mois (total recalculé), tentative de suppression de série annulée
  au niveau de la confirmation (donc pas testée jusqu'au bout en automatisé — à re-vérifier
  manuellement par l'utilisateur au moins une fois), Dashboard cohérent avec les heures générées.
- ✅ **Point d'entrée du contrat récurrent revu** (juste après le lot ci-dessus, même session) :
  le bouton isolé en haut de l'onglet Contrats est retiré — deux entrées pour la même action, une
  générique et une contextuelle, faisaient du bruit sans apporter de valeur, d'autant que le
  récurrent est de toute façon réservé à l'enseignement. `ContractForm.tsx` affiche désormais un
  encart CTA (« Cours régulier sur l'année scolaire ? ») **dès que `type === "enseignement"` est
  sélectionné**, avant même les champs Employeur/Date — pour intercepter l'utilisateur avant qu'il
  n'investisse du temps dans le mauvais formulaire. Contrainte technique identifiée et respectée :
  `ContractFormRecurrent.tsx` a son propre `<form>`, impossible de l'imbriquer dans celui de
  `ContractForm.tsx` (HTML invalide) — `ContractForm.tsx` bascule donc entre deux rendus complets
  via un state local `formRecurrentOuvert` (pas un accordéon au milieu du formulaire), et
  réutilise le bouton « Annuler » déjà présent dans `ContractFormRecurrent.tsx` pour revenir en
  arrière. Nouveau prop `onValiderRecurrent` sur `ContractForm.tsx`, **optionnel** à dessein :
  `ImportBulletins.tsx` (relecture d'un contrat déjà extrait d'un PDF) et `Simulateur.tsx`
  (simulation temporaire non persistée) réutilisent `ContractForm.tsx` sans ce prop, et n'affichent
  donc jamais ce CTA — vérifié dans le navigateur dans les deux cas (aucun encart, aucune erreur
  console même en sélectionnant "Enseignement"). `App.tsx` ne gère plus l'état d'ouverture du
  formulaire récurrent, seulement la mutation des données (`ajouterContratsRecurrents`, inchangée).
  100 tests verts (aucun nouveau test : changement purement UI, pas de nouvelle logique pure),
  `tsc -b` propre. Vérifié dans le navigateur : apparition du CTA au choix "Enseignement",
  bascule vers le formulaire récurrent puis retour via "Annuler" sans perte d'état du formulaire
  normal, absence du CTA dans Import PDF et Simulateur.
- ✅ **Contrats à venir persistés, graphique 3 segments** (SPEC §11.B, item 1 du backlog) :
  **découverte en investiguant, pas un simple ajout** — un contrat déjà signé daté dans le futur
  était déjà possible (rien ne l'empêchait) et déjà compté dans `decompte`/`SR`/`NHT` (fenêtre
  complète, `decompteHeures.ts`/`salaireReference.ts` inchangés, aucune règle réglementaire à
  deviner ici), mais **totalement ignoré** par `prediction.ts` (plafonné à `dateCap` = aujourd'hui)
  — d'où un vrai "0 / 507 h" au héros à côté d'une "Répartition des heures" qui comptait déjà ces
  heures, incohérence silencieuse préexistante, pas introduite cette session. **Aucun champ
  nouveau sur `Contrat`** : "à venir" se déduit uniquement de `contrat.date > dateDuJour` (jamais
  stocké — un flag stocké deviendrait faux tout seul le jour où `dateDuJour` dépasse la date du
  contrat), donc **zéro impact schéma Zod / export-import JSON**. `StatutPrediction` gagne deux
  champs : `heuresCertainesAVenir` (contrats signés à venir dans la fenêtre, 0 si aucun) et
  `heuresRestantesApresCertain` (écart net = seuil − acquis − certain, jamais négatif — tout texte
  "il te manque X h"/"vise X h/mois" doit lire CE champ, jamais l'ancien `heuresRestantes` brut).
  **Correction du faux pessimisme** : `niveau` passe désormais "Sécurité" dès que
  `heuresActuelles + heuresCertainesAVenir >= seuil`, même si le rythme passé est nul (ex. tout
  juste réadmis mais déjà un gros contrat signé) — avant ce lot, un tel profil restait à tort en
  "Alerte" tant que la seule projection linéaire ne suffisait pas. `rythmeRequis`/
  `dateFranchissementProjetee` gardent `joursRestants` (dateCap → fin de fenêtre) comme
  dénominateur temps, **jamais** la fin du segment certain — **bug trouvé en testant dans le
  navigateur avec de vraies données** (le contrat récurrent du lot précédent, dernier mois
  2026-12-31, pile la date anniversaire) : baser le dénominateur sur la fin du segment certain
  faisait tomber le temps restant à 0 et afficher à tort "délai trop court" alors que l'échéance
  réelle était encore à 161 jours. Une fois corrigé, un second écart est apparu au même endroit :
  l'alerte "rythme_insuffisant" disait "il manque 507 h" à côté d'un "vise 90 h/mois" déjà calculé
  sur l'écart net (483 h) — deux chiffres contradictoires dans la même phrase ; `alertes.ts` et
  `construireMessage` (prediction.ts) lisent désormais tous deux `heuresRestantesApresCertain`.
  `ProjectionChart.tsx` : nouveau segment plein teal "confirmé à venir" (un marqueur par contrat,
  distinct de la courbe acquise et du pointillé — légende textuelle obligatoire pour les trois,
  jamais la couleur seule, §8.6) ; le pointillé repart de `dateCap` (comme avant, pas de la fin du
  segment certain — écarte tout risque de ligne dessinée "à l'envers" si la date projetée tombait
  avant un contrat déjà signé). Nouvelle fonction pure `construireSerieAVenir` (prediction.ts,
  même famille que `construireSerieAcquisition`). `ContractForm.tsx` : indice discret sous le
  champ date quand la date saisie est future (« sera affiché comme à venir · confirmé... »),
  **masqué dans `Simulateur.tsx`** via un nouveau prop `previsualisationSeulement` — le contrat
  simulé n'étant jamais persisté, l'indice y serait littéralement faux (devoir n°2), pas juste
  hors-sujet. 15 tests dédiés ajoutés (`prediction.test.ts` : 9, `alertes.test.ts` : 1, plus les
  révisions du test qui a révélé le bug du dénominateur) — 108 tests verts au total, `tsc -b`
  propre. `engine/decompteHeures.ts`, `salaireReference.ts`, `areBrute.ts`, `areNette.ts`,
  `periodeReference.ts`, `cycles.ts` **intouchés**, conformément au plan validé. Vérifié dans le
  navigateur avec les vraies données de contrat récurrent du lot précédent : graphique 3 segments,
  "+24 h déjà signées à venir", cohérence "il manque"/"vise" rétablie ; puis avec un contrat passé
  ajouté en plus (360 h) : bascule correcte en "Sécurité", franchissement projeté cohérent avec le
  rythme requis affiché, aucune régression du cas sans contrat à venir.
- ✅ **PWA installable** (dernier item §11.A) : `vite-plugin-pwa` (stratégie `generateSW`,
  `registerType: "autoUpdate"` + `skipWaiting`/`clientsClaim` — mise à jour silencieuse, jamais
  bloquée par un cache périmé, cf. devoir n°2 : un correctif de calcul doit atteindre l'utilisateur
  vite) génère le service worker et précache tout le bundle buildé (17 entrées, ~700 Kio) + une
  règle `runtimeCaching` dédiée pour Google Fonts (hors du bundle Vite, sinon repli silencieux sur
  la police système hors-ligne). Manifest défini **uniquement** dans `vite.config.ts` (même
  logique que `franceTravailConfig.ts` : une seule source de vérité) — `public/manifest.webmanifest`
  écrit à la main **supprimé**. `background_color: "#0A0C10"`, `theme_color: "#3FD69B"` (seulement
  au niveau du manifest — l'écran de démarrage/multitâche une fois l'app **installée** — le
  `<meta name="theme-color">` de `index.html`, lui, reste sombre pendant la navigation web
  normale, décision volontaire pour ne pas trancher avec la charte « sombre, premium, calme »).
  `name`: « Cadence · Suivi intermittent », `short_name`: « Cadence », `lang: "fr"` (absent par
  défaut du plugin, oubli corrigé en vérifiant — toute l'app est en français). **Icônes générées
  sans dépendance externe** (`scripts/generate-pwa-icons.mjs`, seulement `zlib`/`fs` de Node) :
  `sharp` (utilisé par `@vite-pwa/assets-generator`, la voie "officielle") n'a **aucun binaire natif
  pour win32-arm64**, et son build WASM de repli plante sous Node 24 sur cette machine
  (`TypeError` dans `libvipsVersion`) — après avoir épuisé les contournements côté dépendances, le
  motif (carré arrondi, dégradé mint→teal, identique au logo de `TopBar.tsx`) s'est révélé assez
  simple pour être rastérisé à la main (supersampling 3×3, encodeur PNG minimal, ICO fait main pour
  le favicon) : plus robuste ici qu'une dépendance native/WASM fragile, et reproductible sur
  n'importe quelle plateforme (`npm run generate-pwa-icons`). `index.html` : ajout
  `<link rel="apple-touch-icon">` (iOS ne lit jamais le manifest pour son icône d'écran d'accueil)
  et `<link rel="icon">` (absent jusqu'ici, favicon par défaut/cassé) ; `<link rel="manifest">`
  manuel retiré (auto-injecté par le plugin). `tsc -b` propre, 108 tests verts (aucune logique
  moteur touchée). **Vérifié dans le navigateur, preuve forte plutôt qu'une simulation** : après
  `npm run build` + `npm run preview`, manifest et service worker actif confirmés via
  `navigator.serviceWorker`, contenu du cache (`caches.keys()`) confirmé complet (JS/CSS/HTML/
  icônes/manifest + une police déjà mise en cache) — puis le **processus du serveur preview a été
  tué** (pas juste un bouton "Offline" des DevTools) et la page rechargée : l'app s'affiche
  intégralement, aucune erreur console. **Limite actée** : l'installation réelle sur un téléphone
  (Android/iOS) n'a pas pu être testée depuis cet environnement — dépend du déploiement bêta
  (backlog), toujours en attente ; ce lot rend l'app installable selon les critères
  Lighthouse/Chrome, la confirmation finale sur un vrai appareil reste à faire une fois déployée.
- ✅ **Module indemnisation mensuelle (V2), 3 phases terminées** : `engine/indemnisationMensuelle.ts`
  (`calculerMoisIndemnisation`, `calculerSerieIndemnisation`, `calculerSerieDepuisDeclarations`)
  calcule, mois par mois, le nombre de **jours réellement indemnisés** — pas juste l'AJ théorique
  — à partir d'un **solde de départ** connu (`SoldeIndemnisationDepart`, `{ date, delaiRestant,
  franchiseCPRestante }`) saisi une seule fois par l'utilisateur, jamais reconstruit depuis la
  réadmission (décision actée : un mois de régularisation en cours de transition de droits n'a pas
  de décomposition standard reconstituable, toute tentative produirait un solde faux en cascade —
  cf. `docs/reprise.md`). Ordre de consommation confirmé par le guide officiel ET par des relevés
  réels certifiés (fév-mai 2026) : jours non indemnisables (`Math.ceil(joursDéclarés × 1.3)`,
  PREMIÈRE opération) → délai d'attente → franchise congés payés (**plafonnée par un forfait
  mensuel avec report**, cf. correctif du 2026-07-23 ci-dessous — PAS "consommer tout ce qui est
  disponible", conclusion initialement erronée) → paiement du reliquat.
  Franchise salaires : toujours `{ valeur: null, avertissement: "franchise_salaires_non_certifiee" }`
  — formule officielle (guide p.14, 4 variables incluant le SMIC) non vérifiable à 100 % depuis
  l'extraction PDF, aucun relevé réel fourni ne la montre active pour trancher (devoir n°2 :
  jamais un chiffre deviné). `smicHoraireBrutHistorique: {dateEffet, valeur}[]` ajouté à la
  config, séparé de `smicHoraireBrut` qui reste inchangé — **zéro modification dans `areBrute.ts`**.
  **Phase 3** : `RevenusMensuels.tsx` (nouvel onglet TopBar), gardé derrière le même garde-fou
  « situation mixte » que Dashboard/Historique/Simulateur (`profilHorsPerimetre`, vérifié dans le
  navigateur : bascule Oui/Non préserve les données). `DeclarationMensuelle { id, mois,
  joursDeclares, source: "manuel" | "lecture_releve" }` — saisie manuelle mois par mois, **jamais
  déduite des `Contrat`** (heures/cachets par contrat ≠ jours calendaires par mois civil) ; ajouter
  une déclaration pour un mois déjà saisi la remplace (permet de corriger une estimation
  provisoire une fois le vrai relevé reçu), badge « provisoire » affiché pour `source: "manuel"`
  (devoir n°2 : ne jamais présenter une estimation avec la même certitude qu'une donnée
  confirmée). Écran de configuration du solde de départ **pédagogique, jamais bloquant** : les
  deux champs numériques défaultent à 0 (cas le plus courant une fois les franchises épuisées),
  seule la date est structurellement nécessaire. `DonneesApp` étendu (`declarationsMensuelles`,
  `soldeIndemnisationDepart`) avec des défauts Zod (`.default([])`/`.default(null)`) — un export
  JSON antérieur à ce module s'importe toujours sans perte (devoir sacré n°1, testé explicitement :
  `localStorageAdapter.test.ts`). Montant € optionnel par mois (`joursIndemnises × AJ nette
  actuelle`), affiché avec une légende explicite qu'il ne reflète pas d'éventuels changements de
  salaire de référence sur les mois passés — pas une nouvelle formule réglementaire, une simple
  multiplication d'un chiffre déjà affiché ailleurs (Dashboard). `MonProfil.tsx` (« Périmètre du
  MVP ») mis à jour en cohérence : ne dit plus que le module est hors MVP, précise ce qui est
  couvert (jours indemnisés) et ce qui ne l'est pas (franchise salaires, plafond PMSS). 8 tests
  dédiés au moteur (`indemnisationMensuelle.test.ts`, dont la reproduction exacte des 4 mois
  certifiés fév=0/mars=17/avril=18/mai=29 à partir du solde d'ouverture du 01/02/2026), 117 tests
  verts au total, `tsc -b` propre. Vérifié dans le navigateur avec les 4 mois certifiés : tableau
  identique aux relevés réels, ajout/suppression de mois, badge provisoire, garde-fou situation
  mixte, aucune erreur console. **Limite actée, pas un oubli** : pas d'écran pour corriger le
  solde de départ une fois configuré (uniquement l'export/import JSON permettrait de le faire à la
  main pour l'instant) — à ajouter si un besoin réel se présente. **Correctif du 2026-07-23,
  franchise CP** : la conclusion initiale ("pas de plafond mensuel constaté sur les relevés
  réels") était fausse — le 4j consommé en février 2026 s'explique entièrement par le report du
  forfait de janvier (2j non consommés, absorbés par le délai d'attente ce mois-là) + le forfait
  de février (2j), pas par l'absence de plafond. `forfaitMensuelBas`/`Haut` réactivés dans
  `franceTravailConfig.ts` (+ nouveau `seuilFranchiseTotaleJours: 24`, qui n'existait qu'en
  commentaire avant). `SoldeIndemnisation.quotaCPCarryOver` (obligatoire, moteur) /
  `SoldeIndemnisationDepart.quotaCPCarryOver` (optionnel, défaut 0 — un solde déjà configuré avant
  ce champ continue de fonctionner, testé explicitement) suivent le report d'un mois sur l'autre.
  `RevenusMensuels.tsx` : 3e champ dans l'écran de configuration du solde de départ (« Report de
  forfait congés payés du mois précédent », défaut 0, aide contextuelle « si tu viens d'ouvrir tes
  droits ce mois-ci et que le mois précédent était un mois blanc, mets 2 » — un chiffre lisible
  sur la notification d'ouverture de droits, pas une valeur technique cachée). **Limite connue,
  non résolue** : le palier bas/haut (2j vs 3j) se base sur `franchiseCPRestante` courante faute
  de suivre le total ORIGINAL accordé à l'ouverture des droits — un profil dont le total dépasse
  24j pourrait à tort redescendre au palier bas une fois consommé sous ce seuil ; non observable
  sur les cas certifiés actuels (restante ≤ 5j du début à la fin). 120 tests verts au total (3
  nouveaux dédiés au correctif, dont un qui aurait échoué avec l'ancien modèle), `tsc -b` propre,
  vérifié dans le navigateur : reproduction exacte des 4 mois certifiés avec le nouveau champ
  renseigné (2j), et non-régression sur un solde existant configuré avant ce champ (défaut 0,
  résultat plus conservateur qu'avant à raison). **Franchise salaires (2026-07-23) : formule
  certifiée (ARTCENA + flyer officiel FT) implémentée, TOTAL seul, PAS ENCORE câblée dans le
  réducteur mensuel** — `calculerFranchiseSalaires(srContrats, sjm, profil, config)` calcule
  `arrondi((SR_total/SMIC_mensuel) × (SJM/(3×SMIC_journalier)) − 27)`, jamais négative, SMIC lu à
  `profil.dateAnniversaire` (date de fin de PRA) via l'historique. Nouveaux champs `Profil`
  optionnels : `dureeDroitsMois` (12 standard / 6 clause de rattrapage, connue à l'ouverture,
  jamais déduite de l'historique d'activité) et `salairesHorsAnnexe10PRA` (composante de SR_total
  ; absent → estimation sur les seuls salaires A10, signalé via `sousEstimeeHorsA10`).
  `FranchiseSalairesResultat` devient un type discriminé (`valeur: null` si données manquantes,
  `valeur: number` avec `totalNonVerifie: true` toujours présent — le total n'a jamais été
  confronté à un relevé réel montrant une franchise active). `calculerMoisIndemnisation` continue
  volontairement de renvoyer `franchise_salaires_non_certifiee` : câbler la répartition mensuelle
  (min(dureeDroitsMois, 8) mois + report, comme la franchise CP) est un **chantier séparé, scopé
  mais pas commencé** — aucune UI non plus pour saisir `dureeDroitsMois`/`salairesHorsAnnexe10PRA`
  sur le profil. 126 tests verts au total, `tsc -b` propre. **Bilan du chantier « indemnisation
  mensuelle » à ce stade : terminé sauf la répartition mensuelle de la franchise salaires**
  (chantier suivant identifié et scopé, aucun faux chiffre affiché en attendant).
  **Mise à jour 2026-07-24, PDF officiel lu en entier** : la formule (page 14) est confirmée mot
  pour mot depuis le texte source (plus une extraction d'image incertaine) — seule l'absence d'un
  cas chiffré réel avec franchise salaires active reste une réserve valable (`totalNonVerifie`).
  **Bug corrigé (2026-07-24)** : le `27` de la formule était codé en dur dans
  `calculerFranchiseSalaires` au lieu de réutiliser la constante existante
  `config.indemnisationMensuelle.seuilNonIndemnisationJours` — deux occurrences du même nombre non
  reliées, contredisait la règle d'or "aucune valeur réglementaire en dur dans le moteur".
  Remplacé, JSDoc mis à jour en conséquence. 127 tests verts, `tsc -b` propre. Détail complet :
  `docs/reprise.md`.
- ✅ **Correctif AJ réelle (2026-07-24, `f6cb937`)** : les montants de « Revenus mensuels »
  utilisaient l'AJ **prévisionnelle** (recalculée depuis les contrats actuels via
  `calculerAJBrutePourFenetre`/`calculerAJNette`), pas l'AJ **réelle** notifiée par France Travail
  (fixée à l'ouverture des droits, stable toute la période) — faux chiffre pour un utilisateur déjà
  en cours d'indemnisation (bug remonté par l'utilisateur). `SoldeIndemnisationDepart.ajReelle:
  number | null` ajouté (même pattern que `quotaCPCarryOver`), prioritaire sur l'estimation quand
  renseignée, avertissement visible sinon. Vérifié en direct sur `simucalcul.pole-emploi-services.fr`
  le 23/07/2026 (rejoué le cas fictif #2 déjà validé, résultat identique — 62,00 € net — rien n'a
  changé côté France Travail) + tests `areBrute`/`areNette` relancés (18 tests) pour confirmer que
  c'est le code, pas juste la règle documentée, qui reproduit ce résultat. 127 tests verts au
  total, `tsc -b` propre. Détail complet : `docs/reprise.md`.
- ✅ **Chantier `ajReelleHistorique` (2026-07-24)** : `SoldeIndemnisationDepart.ajReelle: number |
  null` remplacé par `ajReelleHistorique: {dateEffet, valeur}[]` — un utilisateur peut connaître
  plusieurs taux d'AJ réelle successifs sur une même période d'indemnisation (ex. 54,55 € jusqu'au
  17/01/2026 puis 55,02 € à partir du 18/01/2026). Restait alors sur `SoldeIndemnisationDepart`
  (**décision revue le 2026-07-25**, cf. chantier `Profil.ouvertureDroits` ci-dessous : déplacé vers
  `Profil`, l'usage réel de `SoldeIndemnisationDepart` a fini par disparaître entièrement). `engine/ajReelleUtils.ts` (`getAjReelleAt`)
  cherche le taux applicable à une date ; nouveau type discriminé `MontantMensuelResultat` +
  champ `MoisIndemnisationResultat.montantMensuel`, calculé uniquement dans la fonction de série
  du module (le `moisLabel` de `calculerMoisIndemnisation`/`calculerSerieIndemnisation` reste
  purement informatif, jamais une vraie date). `RevenusMensuels.tsx` :
  éditeur de périodes AJ (date d'effet/valeur/suppression), plus de repli sur une AJ estimée
  (devoir n°2) — encart ambre si aucune période connue, `—` mois par mois si hors couverture.
  Migration silencieuse de l'ancien champ `ajReelle` dans `localStorageAdapter.ts`, appliquée à la
  fois au chargement localStorage et à l'import JSON. Au passage : `RevenusMensuels.tsx` masqué en
  première admission (module sans objet avant l'ouverture des droits). 136 tests verts, `tsc -b`
  propre, vérifié dans le navigateur à chaque étape. Détail complet : `docs/reprise.md`.
- ✅ **Chantier découpage mensuel des contrats (2026-07-24)** : `Contrat.dateDebut: string` ajouté
  (migration silencieuse : repli sur `date` si absent, contrat traité comme un seul jour) ;
  `engine/decoupageMensuel.ts` (`repartirContratParMois`) répartit heures et salaire d'un contrat
  au prorata des jours calendaires quand il chevauche deux mois civils (réutilise
  `heuresBrutesContrat`, aucune logique dupliquée). **Formule JNI corrigée** :
  `Math.floor(heuresDuMois × coeffJoursNonIndemnisables / diviseurJoursTravaillesA10)` — floor, pas
  ceil, calculée directement sur les heures du mois (donne enfin un usage à
  `diviseurJoursTravaillesA10`, vestige inutilisé jusqu'ici) — validée mot pour mot sur 4 mois
  réels indépendants (fév/mars/avril/mai 2026, zéro écart). `calculerSerieDepuisContrats` remplace
  `calculerSerieDepuisDeclarations` : agrège `repartirContratParMois` de tous les contrats par
  mois (plage revue le 2026-07-25, cf. chantier `Profil.ouvertureDroits` ci-dessous). **`Declaration
  Mensuelle` supprimée entièrement** (types, storage, UI) — la saisie manuelle des jours déclarés
  est remplacée par un calcul automatique depuis les vrais contrats ; `RevenusMensuels.tsx` : plus
  de formulaire "Ajouter un mois" ni de badge "provisoire", colonne "Heures travaillées" affichée à
  la place. `ContractForm.tsx` : champ "Date de début" ajouté (pré-rempli à la date de fin tant que
  non modifié, validation `dateDebut ≤ dateFin`). **Origine notable** : ce chantier a démarré sur
  trois points présentés comme actés en session précédente qui se sont révélés faux à la
  vérification (dont la formule JNI elle-même, `ceil` au lieu de `floor`) — la vraie formule a été
  retrouvée par recherche web puis validée empiriquement sur les documents réels de l'utilisateur
  (relevés France Travail, un contrat GUSO) avant d'être câblée. `decompteHeures.ts` (507h)
  volontairement non touché — compteur distinct, hors périmètre. 145 tests verts, `tsc -b` propre,
  vérifié dans le navigateur (7 contrats réels, 4 mois certifiés exacts en bout en bout). Détail
  complet : `docs/reprise.md`.
- ✅ **Chantier `Profil.ouvertureDroits` (2026-07-25)** : remplace la saisie manuelle d'un solde de
  mi-parcours (`SoldeIndemnisationDepart.delaiRestant`/`franchiseCPRestante`/`quotaCPCarryOver`,
  retirés) par une simulation automatique depuis la VRAIE date d'ouverture des droits.
  `Profil.ouvertureDroits: { dateOuverture, franchiseCPTotale, delaiAttenteInitial }` saisi une
  fois depuis la notification France Travail ; `ajReelleHistorique` déplacé ici depuis
  `SoldeIndemnisationDepart` (même raisonnement). `SoldeIndemnisationDepart` ne porte plus que
  `dateDepart` — un filtre d'affichage : `calculerSerieDepuisContrats` simule depuis
  `ouvertureDroits.dateOuverture` en continu (mois antérieurs à `dateDepart` simulés mais jamais
  montrés, nécessaire pour un état correct au premier mois affiché), retourne
  `SerieIndemnisationResultat` (`calculable: false` si `ouvertureDroits` absent — aucun point de
  départ inventé, devoir n°2). Corrige au passage une limite connue : le palier du forfait CP
  (2j/3j) se décide désormais sur la franchise TOTALE (constante), pas sur le restant courant.
  UI : nouvelle section « Mon indemnisation en cours » dans `MonProfil.tsx` (3 champs guidés +
  éditeur AJ déplacé depuis `RevenusMensuels.tsx`) ; `RevenusMensuels.tsx` simplifié à un seul
  champ de configuration (`dateDepart`) + garde-fou si `ouvertureDroits` absent (encart ambre, lien
  direct vers le profil). **Origine notable** : la proposition initiale contenait une formule
  auto-annulante (`franchiseTotale − moisÉcoulés × 2` ≈ 0 toujours) — signalée avant tout code,
  résolue par ce refactor plus profond plutôt qu'un correctif de formule ponctuel. 146 tests verts,
  `tsc -b` propre, vérifié dans le navigateur de bout en bout (mois masqués avant `dateDepart`,
  6 mois vérifiés au centime près à la main). Détail complet : `docs/reprise.md`.
- ✅ **Bouton « Modifier » pour `dateDepart`** (2026-07-25, `2edb88e`) : `SoldeRecap`
  (`RevenusMensuels.tsx`) permet désormais de changer la date d'affichage du tableau après coup
  (auparavant seul un ré-import JSON le permettait — trou UX trouvé en investiguant un
  signalement utilisateur). Pas encore vérifié dans le navigateur ni testé automatiquement
  (UI seule). Détail complet : `docs/reprise.md`.
- ✅ **Taux PAS, franchise salaires mensuelle, mois de réadmission, revenus contrats** (2026-07-26,
  14 commits `2edb88e`→`502b495`) : `tauxPrelevementSource`/`montantNet`, mois de réadmission non
  calculé (nouveau type `LigneSerieIndemnisation`), alerte `pas_taux_janvier`, répartition mensuelle
  de la franchise salaires câblée (mécanisme complet, mais **pas encore branchée sur de vraies
  données** dans l'app — SR/SJM jamais fournis à `calculerSerieDepuisContrats`), colonnes « Revenus
  contrats »/« Revenu total ». 159 tests verts. Détail complet : `docs/reprise.md`.
  ✅ **Branchement fait le 29/07/2026 (soir), commit `5446e33`** — voir l'entrée dédiée plus bas :
  `TableauResultats` (`RevenusMensuels.tsx`) calcule maintenant SR/NHT/SJM réels et les transmet à
  `calculerSerieDepuisContrats`. Ce paragraphe ne décrit donc plus l'état actuel, gardé pour
  l'historique du chantier.
- 🔴 **Point 2 non résolu (AJ brute vs nette)** : les relevés officiels disent « Allocation
  **brute** » pour la valeur que Cadence traite comme point de départ net dans
  `ajReelleHistorique` — écart potentiel ~5 % jamais réinvestigué. **Comparaison complète Cadence
  vs les 8 mois réels** toujours pas déroulée non plus (demande d'origine de l'utilisateur).
  **Confusion de dossier non résolue** : deux copies du projet existent (`C:\Users\benoi\cadence`,
  la vraie, vs `C:\Users\benoi\OneDrive\Bureau\cadence\cadence`, une ossature de tout début jamais
  construite) — l'utilisateur a montré une capture de la seconde en la prenant pour l'app actuelle,
  deux questions de clarification posées sans réponse. **Détail complet et prochaine étape exacte :
  `docs/reprise.md`.**
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
- ⬜ **Chantier import IA premium — analyse du périmètre de scan faite, aucun code produit
  (28/07/2026).** Extension prévue de l'import PDF (aujourd'hui local/pdfjs) vers un import IA
  premium via Mistral Document AI, routant vers des « propositions d'écriture » validées une par une
  plutôt qu'un remplissage direct. Analyse du périmètre menée contre `src/types/index.ts` réel :
  confirmation de `PeriodeAssimilee` (schéma inchangé, 6 variants) ; ajout au schéma d'extraction de
  `ouvertureDroits.dateLimiteIndemnisation`, `ouvertureDroits.tauxPrelevementSource`,
  `dureeDroitsMois`, `dateAnniversairePrecedente`, `situation`, `dateNaissance` ; correction du
  nommage **AEM** (Attestation d'Employeur Mensuelle, pas « AER ») ; `type`/`territoire` du Contrat
  passés nullable (un bulletin ne les indique presque jamais — les exiger forçait le modèle à
  inventer, en contradiction avec sa propre règle « jamais de valeur inventée »). Exclus formellement
  du périmètre de scan : `regimeDeclare` (doit rester auto-déclaré, cf. garde-fou situation mixte),
  `salairesHorsAnnexe10PRA` seul (déclencherait l'alerte de contradiction), les constantes de config
  (plafonds), `activiteHorsAnnexe10` (déprécié), `SoldeIndemnisationDepart.dateDepart` (choix
  d'affichage, aucun document ne le porte). Le point brut/net sur `ajReelleHistorique` reste **non
  résolu par design** : `calculerAJNette` est à sens unique (brut → net), exige un SJM indisponible
  à la lecture d'un relevé, et est une estimation assumée — l'utiliser réintroduirait l'« AJ estimée »
  que le champ interdit explicitement. Ne pas confondre avec `MontantMensuelResultat.montantNet`,
  qui applique le prélèvement à la source, pas les cotisations. Documents V1 : bulletin de paie/AEM,
  notification d'admission, relevé de situation, déclaration fiscale annuelle. V2 (aucune fixture
  réelle disponible) : contrat signé, attestations CPAM, avis d'imposition, attestation Afdas/OPCO —
  avec un piège identifié côté CPAM : `ald` et `maladie_intercontrat` ont des effets **opposés** sur
  le décompte et un avis d'arrêt de travail ne permet pas de trancher, donc `info_seule` obligatoire,
  jamais un type deviné. **Non-régression vérifiée dans le code avant tout développement** : l'import
  local pdfjs (`lib/extractionBulletin.ts` → `ImportBulletins`, onglet « Import PDF ») reste un canal
  intact et gratuit, et l'app n'a aujourd'hui **aucune authentification** (rien dans `package.json`
  ni `src/`, hormis `lib/googleDriveAuth.ts` qui est opt-in dans le module frais réels) — `App.tsx`
  ne pose aucun verrou global, donc une auth introduite plus tard peut rester cantonnée au clic
  « Importer avec l'IA ». **Bloqué avant implémentation** : le projet n'a ni framework serverless ni
  dossier `api/` (SPA statique Vite/PWA), or `MISTRAL_API_KEY` ne doit jamais atterrir dans le bundle
  client — le choix de la plateforme d'hébergement est un prérequis, cf. §11.B du SPEC (backend/comptes
  hors bêta) et le prérequis bloquant « comptes + paiement » de l'entrée premium. Références :
  `docs/files/SPEC_annexe_IA_premium.md`, `docs/files/brief_claude_code_documents_premium.md`.
- ✅ **Backend minimal en place (28/07/2026)** — première brique serveur du projet, sans auth ni base
  de données (chantier séparé, à faire quand le gate premium sera construit). `api/extract-document.ts`
  et `src/types/extraction.ts` (ex-`api/extraction-schema.ts`, déplacé le 28/07/2026, cf. plus bas)
  sortis de `docs/files/` vers `api/` (convention Vercel Functions, endpoint `/api/extract-document`).
  Dépendances ajoutées : `zod-to-json-schema` (runtime) et
  `@types/node` (dev). **Ces fichiers sont enfin type-checkés** via `tsconfig.api.json` — volontairement
  SÉPARÉ de `tsconfig.json` : ce dernier a `"types": ["vitest/globals"]`, ce qui désactive le chargement
  automatique des `@types` (donc `process` restait inconnu même avec `@types/node`), et surtout ajouter
  `"node"` au projet principal rendrait `process`/`Buffer` visibles depuis le code React, où ils cassent
  au runtime. Nouveau script `npm run typecheck` (= `tsc -b && tsc -p tsconfig.api.json`), les deux
  projets sont vérifiés par `npm run build`. Vérifié : aucune trace de `mistral` ni de
  `zodToJsonSchema` dans `dist/` — le code serveur ne fuit pas dans le bundle client.
- 🔴 **À traiter en priorité au prochain chantier import IA — le composant brouillon contourne le
  backend.** `docs/files/ImportDocumentIA.jsx` (et sa copie `docs/ImportDocumentIA.jsx`, de contenu
  DIFFÉRENT) appelle `https://api.mistral.ai/v1/ocr` **directement depuis le navigateur**, avec la clé
  saisie dans un `<input>` (`const [apiKey, setApiKey] = useState("")`). Câblé tel quel, ça rend
  `api/extract-document.ts` inutile et expose la clé. Le composant doit appeler `POST /api/extract-document`
  et ne jamais connaître la clé. Rappel de la règle : la variable doit s'appeler `MISTRAL_API_KEY`, JAMAIS
  `VITE_MISTRAL_API_KEY` (Vite inline tout `VITE_*` dans le bundle client).
- 🔶 **Contraintes Vercel restantes, à trancher avant le premier déploiement** — points (1) et (4)
  de la liste initiale **résolus le 28/07/2026** (commit `d3ebb36`) : runtime Edge désormais forcé,
  et clé absente diagnostiquée en 503 explicite au lieu d'un 500 générique. Point (2) — le PDF part
  en base64 dans le corps de requête, +33 % de volume, plafond Edge ~4 Mo → **plafond pratique ~3 Mo
  de PDF** — **résolu le 29/07/2026 (commit `ecca2c8`)** : `lib/fichierImportIA.ts` refuse le fichier
  côté client avant la modale de consentement, avec un message qui donne la taille réelle, la limite,
  et une alternative (réduire le document ou saisir à la main). Vérifié sur le fichier réel le
  29/07/2026 (soir) : le contrôle existe bel et bien, ce n'est plus un commentaire mort — cette ligne
  contredisait à tort l'entrée sur `ecca2c8` plus bas, corrigée ici. Reste ouvert : (3) l'OCR peut
  dépasser le timeout, l'Edge plafonnant vers 25 s — non mesuré, aucun appel réel n'a jamais eu lieu.
- ⚠️ **`docs/cadence-export-2026-07-24.json` contient de VRAIES données personnelles** (date de naissance,
  21 contrats réels, employeurs nommés) — ajouté à `.gitignore`, **jamais à committer** : un commit git
  ne s'effface pas proprement. Anomalie repérée au passage dans ce fichier : `dateNaissance: "19994-06-09"`
  (année à 5 chiffres) — à vérifier dans les données réelles, ça fausse le plafond enseignement 70/120 h.
- ✅ **Écran de revue des extractions IA construit sur fixtures (28/07/2026, commit `d3ebb36` sur
  `backend-api-import-ia`)** — l'UX et le routage sont validés sans qu'aucun document réel ni aucun
  appel réseau n'entre en jeu. `components/RevueExtraction.tsx` affiche une carte par proposition
  (valeurs lues, confiance par champ, justification) ; **aucun bouton « tout appliquer »** : chaque
  proposition demande un geste explicite, et un contrat passe toujours par `ContractForm` en
  relecture champ par champ, jamais appliqué directement. Toute la décision « cette proposition
  est-elle applicable sans risque ? » vit dans `lib/routageExtraction.ts` — pure, hors du composant,
  **22 tests dédiés** (`lib/__tests__/routageExtraction.test.ts`). `lib/fixturesExtraction.ts` fournit
  4 extractions simulées typées `ExtractionResult` (donc cassées à la compilation si le schéma
  change) : notification complète, bulletin aux champs manquants, relevé à 3 refus, document non
  reconnu. `components/RevueExtractionDemo.tsx` est le banc d'essai, rendu **uniquement si
  `import.meta.env.DEV`** (garde dans le composant ET chez l'appelant `App.tsx`, onglet « Import
  PDF », bloc replié) : les montants des fixtures sont fictifs, les montrer à un vrai utilisateur
  serait le faux chiffre qu'interdit le devoir n°2. **Bac à sable** : les validations du banc d'essai
  atterrissent dans une copie jetable du profil, jamais dans les vraies données — sans ça, un clic
  sur « Enregistrer dans mon profil » aurait inscrit une AJ et une franchise inventées dans le vrai
  profil (devoirs n°1 ET n°2) ; la validation appelée reste en revanche la vraie
  (`validerProfilPourEcriture`). **Prouvé** : 372 tests verts (350 avant, +22), `npm run typecheck`
  propre (src + api), `npm run build` OK ; vérifié dans le navigateur que chaque valeur de la
  notification simulée atterrit dans le bon champ, que le **vrai `localStorage` est resté intact
  après coup** (`cadence:v1:donnees` — franchise toujours à 0, `ajReelleHistorique` toujours absent,
  3 contrats inchangés), que les trois refus s'affichent sans bouton d'enregistrement, et que les
  fixtures sont **absentes du bundle de production** (recherche dans `dist/`). **Non prouvé** : aucun
  test React sur ces composants (même limite 🔶 que le reste de l'UI) et le comportement face à une
  vraie réponse Mistral reste inconnu — aucune n'a jamais été reçue.
- ✅ **Schéma d'extraction déplacé `api/extraction-schema.ts` → `src/types/extraction.ts` (commit
  `d3ebb36`)** — source **unique** partagée par le backend (qui valide la réponse Mistral avec ce
  schéma) et le front (qui affiche et route les propositions). Deux copies auraient pu diverger en
  silence, et une divergence ici envoie une valeur dans le mauvais champ, donc un chiffre faux. Rangé
  dans `src/` et non dans `api/` parce que `tsconfig.json` n'inclut que `src` : dans l'autre sens, le
  programme du navigateur aurait dû aller chercher un fichier de `api/`, ce qui brouille la frontière
  que `tsconfig.api.json` défend (le code React ne doit pas voir `process`/`Buffer`). Le fichier
  n'utilise que Zod, aucun global Node — `api/` peut donc l'importer sans risque inverse.
  Volontairement **pas** ré-exporté depuis `src/types/index.ts` : la distinction « proposition à
  valider » vs « donnée établie » doit rester visible à l'import.
- ✅ **Refus de routage net/brut sur `ajReelleHistorique` (commit `d3ebb36`)** — le piège le plus
  dangereux de l'extraction, fermé. Ce champ contient une AJ **nette** : c'est ce que dit l'UI de
  saisie (`MonProfil.tsx`, « Allocation journalière nette ») et ce que suppose le moteur, qui applique
  **ensuite** le prélèvement à la source dessus (`indemnisationMensuelle.ts`). Or un relevé de
  situation dit « allocation brute » : y router ce brut aurait gonflé **tous** les montants mensuels
  affichés. `lib/routageExtraction.ts` refuse donc toute proposition dont `natureMontant ≠ "net"`, à
  l'évaluation **et** à l'écriture (exception si l'évaluation est contournée). Aucune conversion n'est
  possible, conformément à ce qui était déjà acté plus haut : `calculerAJNette` est à sens unique,
  exige un SJM absent du document, et est une estimation assumée. Deux autres refus structurels dans
  le même fichier : `periode_assimilee` (pas de destination, cf. dette ci-dessous) et
  `profil_ouverture_droits` incomplet (franchise ou délai d'attente manquants — mettre 0 « en
  attendant » serait un chiffre inventé qui décale les dates de versement).
- 🔴 **Dette tracée (`docs/validation.md`) : `PeriodeAssimilee` n'a aucun chemin d'écriture dans
  l'app.** Problème **préexistant**, découvert en écrivant l'écran de revue (28/07/2026).
  `DonneesCadence.periodes` est **lu** partout où ça compte (`periodeReference.ts`,
  `decompteHeures.ts`, `salaireReference.ts`, `prediction.ts`, `cycles.ts`, `Simulateur.tsx`) mais
  **aucune UI ni aucun setter d'`App.tsx` ne permet d'en créer une** — le tableau ne peut être peuplé
  que par un import JSON. Une maternité ou un accident du travail, qui valent 5 h/jour au décompte des
  507 h, est donc aujourd'hui **inarrivable par la saisie normale**, ce qui sous-estime silencieusement
  le décompte pour qui est concerné. Conséquence immédiate : la cible `periode_assimilee` du schéma est
  refusée faute de destination, avec un message explicite plutôt qu'un abandon silencieux. **À
  construire** : CRUD des périodes (formulaire + `ajouterPeriode`/`supprimerPeriode` dans `App.tsx`),
  après quoi ce refus devient un routage réel. Le piège CPAM déjà documenté reste entier : `ald` vs
  `maladie_intercontrat`, effets opposés sur le décompte, jamais devinés depuis un arrêt de travail.
- ✅ **Backend : runtime Edge déclaré + clé manquante diagnostiquée (commit `d3ebb36`)** —
  `export const config = { runtime: "edge" }` ajouté dans `api/extract-document.ts`. Le handler
  utilisait **déjà** la signature web standard (`(req: Request) => Promise<Response>`), qui est celle
  d'Edge ; en runtime Node, Vercel attendrait `(req: VercelRequest, res: VercelResponse)`. Garde
  explicite sur `MISTRAL_API_KEY` absente : erreur dédiée (`ConfigurationManquanteError`) → **503**
  avec un message clair, au lieu du 500 « Réessaie » précédent, trompeur puisque réessayer n'y change
  rien ; la clé est lue **par requête**, plus au chargement du module. `.env.example` documente
  `MISTRAL_API_KEY` avec le piège rappelé : jamais `VITE_MISTRAL_API_KEY`, Vite inline tout `VITE_*`
  dans le bundle client. Le plafond de corps de requête Edge (~4 Mo, soit **~3 Mo de PDF** en base64)
  — ✅ **géré côté client depuis le 29/07/2026 (commit `ecca2c8`)**, voir l'entrée correspondante
  plus bas : ce paragraphe disait encore « pas encore géré » après coup, contradiction corrigée le
  29/07/2026 (soir). **Non prouvé** : rien de tout ça n'a été exécuté sur Vercel, aucun déploiement
  n'a eu lieu.
- 🔶 **RIEN du chantier import IA n'est fusionné dans `master`** — `master` est resté sur `2721778`.
  Tout vit sur la branche `backend-api-import-ia`, dans cet ordre — **11 commits** : `59d129f`
  (backend minimal), `d3ebb36` (écran de revue sur fixtures), `45a54e1` + `362bbfd` (doc),
  `ecca2c8` (consentement), `d4906d5` (point d'entrée réel), `4c6cebb` (prompt éprouvé +
  descriptions de schéma), `58d6525` (doc), `a934db2` (`etablissementAgree` non déductible),
  `80d4904` (schéma en draft-07), `e05d604` (doc).
  Fusion à décider explicitement, pas encore faite. Liste à revérifier avec
  `git log --oneline master..backend-api-import-ia` avant de s'y fier.
- ✅ **`document_annotation_prompt` éprouvé sur documents réels (29/07/2026)** — le prompt d'extraction
  de `api/extract-document.ts` n'est plus une supposition : il a été mis au point par essais successifs
  dans le Document AI Playground de Mistral, sur **deux documents réels de Benoît** (une notification
  d'admission ARE et un bulletin de paie), plus une **confirmation croisée sur un relevé de situation**
  du même dossier. Les libellés du lexique pour la notification sont désormais des **citations exactes**,
  pas des formulations plausibles. Restent supposés : les libellés du relevé de situation, ceux de l'AEM,
  et les formulations de `situation`/`dateNaissance`. Trois enseignements, chacun né d'une erreur
  observée sur pièce :
  (1) **`info_seule` était devenu un refuge.** L'ancien prompt listait littéralement « montants
  bruts/nets du relevé » comme destination `info_seule`, ce qui y envoyait l'allocation journalière —
  la cible `aj_reelle_historique` ne se remplissait jamais. Remplacé par un **test de citation** :
  si la donnée correspond à un champ nommé ET que ses mots peuvent être cités, la cible structurée
  est obligatoire ; sinon `info_seule`. La citation va dans `justification`, que l'écran de revue
  affiche déjà — la règle est donc auditable à l'œil. Second blocage lié : `dateEffet` étant
  obligatoire et rarement accolé au montant, le modèle n'avait aucune façon licite d'émettre la
  proposition ; une règle de lecture explicite (la date d'effet est la date d'indemnisabilité
  énoncée dans le même document) a levé l'impasse.
  (2) **Piège de vocabulaire à un an d'écart, corrigé.** La phrase « … fin de votre contrat de
  travail du DATE_A ayant permis l'ouverture de vos droits jusqu'à votre date anniversaire, soit le
  DATE_B inclus » contient **deux dates et deux champs** : `dateAnniversaire` = DATE_A,
  `dateLimiteIndemnisation` = DATE_B. Une version intermédiaire du prompt a retenu DATE_B dans
  `dateAnniversaire` — un an d'écart sur la borne qui détermine la fenêtre de référence et donc tout
  le décompte des 507 h. Cause de fond, **antérieure à l'IA et toujours vraie** : Cadence nomme
  `dateAnniversaire` ce que France Travail appelle « fin de contrat de travail », tandis que France
  Travail réserve « date anniversaire » à une date située douze mois plus tard ; et le mot a déjà deux
  sens dans le code (`Exercice.dateAnniversaire` = « fin du cycle »). Le piège attend n'importe quel
  lecteur, humain compris. Protégé à deux endroits : le prompt, et un `.describe()` explicite sur le
  champ dans `src/types/extraction.ts` — les descriptions du schéma partent avec chaque champ à chaque
  appel, là où un paragraphe de prompt peut se diluer.
  (3) **`dateLimiteIndemnisation` a deux formulations, pas une.** « La date limite de votre
  indemnisation est le X » (relevé de situation) et « jusqu'à votre date anniversaire, soit le X
  inclus » (notification) portent la **même date** — vérifié sur deux pièces du même dossier
  (17/01/2027 identique de part et d'autre). L'ancien `.describe()` disait « mot pour mot » une seule
  de ces phrases : corrigé, sinon schéma et prompt divergeaient.
  **Garde-fous vérifiés sur pièce, pas seulement énoncés** : sur le bulletin de paie, `type` et
  `territoire` sont restés à `null`, aucun nombre de cachets n'a été déduit du montant brut, et
  surtout le **NIR présent en clair dans le document est resté hors de l'extraction** — la règle
  d'exclusion des données personnelles n'était jusque-là qu'une consigne non éprouvée.
  **Arbitrages produit actés** : `contrat.type` ne se remplit que si le document décrit l'**activité**
  (cachets de représentation, heures de cours), jamais sur une ligne « Statut » administrative isolée,
  même portant le mot exact — statut et nature d'activité ne coïncident pas toujours, et ce champ
  décide du plafond enseignement 70/120 h. `dureeDroitsMois` reste à la **saisie manuelle** : aucune
  déduction depuis un intervalle de dates, même explicitement de douze mois.
  **Partiellement éprouvé depuis** : le prompt a tourné via `api/extract-document.ts` le 29/07/2026,
  mais sur un PDF bidon uniquement (cf. l'entrée ✅ sur le dialecte). Sur pièces réelles, il n'a été
  éprouvé que dans le Playground.
- ✅ **Dialecte du schéma aligné, et premier appel réel à Mistral effectué (29/07/2026, commit
  `80d4904`).** `api/extract-document.ts` envoie désormais
  `zodToJsonSchema(..., { $refStrategy: "none" })` — JSON Schema draft-07, sans `$ref` interne ni
  `nullable` non standard.
  **Établi par test réel** : les DEUX dialectes sont acceptés par Mistral. Un PDF bidon a été envoyé
  tour à tour avec `{ target: "openApi3" }` puis `{ $refStrategy: "none" }` → **statut 200 dans les
  deux cas**, comportement identique (`typeDocumentDetecte: "non_reconnu"`, 0 proposition). Les trois
  points qui restaient en doute sont levés : la clé racine `$schema`, le `const` sur le discriminant
  `cible` (là où openApi3 écrivait `enum: ["contrat"]`), et les `additionalProperties` libres
  (`confiance`, `info_seule.donnees`).
  **La crainte héritée du 28/07 est DÉMENTIE — ne plus la ressortir** : le dialecte n'était pas « le
  candidat le plus probable à un échec au premier envoi ». Ce changement n'a rien réparé. draft-07
  est conservé parce que c'est du JSON Schema standard (lisible par tout validateur, moins exposé si
  Mistral durcit sa validation), pas parce que l'autre forme cassait quelque chose.
  **Vérifié hors réseau** : les deux formes décrivent les mêmes 55 champs obligatoires aux mêmes
  chemins, avec 22 descriptions rigoureusement identiques, nullabilité conservée (réécrite en branche
  `null` explicite). Aucune information perdue.
  ⚠️ **DEUX limites à ne pas surinterpréter.**
  1. Le test a porté sur un **PDF d'une page, texte inventé, sans aucune donnée exploitable** — la
     bonne réponse était « rien à proposer », et c'est ce qui est sorti. Cela prouve que le schéma
     est accepté et que la validation Zod est traversée, **pas** que l'extraction est juste. Aucun
     bulletin de paie, AEM ni notification n'est passé par ce chemin ; le prompt n'a été éprouvé sur
     pièces réelles que dans le Playground.
  2. L'appel a été lancé par un **script Node temporaire appelant `extractDocument` directement**,
     PAS par l'interface. Le segment **navigateur → `/api/extract-document` reste non exercé** :
     vérifié le 29/07, `npm run dev` (Vite) ne sert pas les Vercel Functions et répond **404** sur
     cette route. Ce segment ne sera validé qu'avec `vercel dev` ou un déploiement.
- 🔶 **Mention d'entraînement retirée du texte de consentement (31/07/2026) — clé pas encore
  basculée.** Le texte n'annonce plus que Mistral « peut utiliser ce document pour entraîner ses
  modèles » : nous prévoyons de passer sur une clé API Mistral payante (plan Scale), qui exclut
  l'entraînement par défaut selon le centre d'aide officiel Mistral
  (help.mistral.ai/articles/347617). **Mais `MISTRAL_API_KEY` n'est PAS ENCORE basculée sur ce plan
  au moment de ce commit** — le texte annonce donc un fait qui n'est pas encore vrai en pratique. Ne
  PAS repasser cette entrée en ✅ tant que la clé réellement utilisée n'a pas été confirmée comme
  étant sur le plan Scale (cf. le ⬜ correspondant en toute fin de la liste priorité normale).
  **La contrepartie de la décision reste non négociable : la mention doit être dite à l'utilisateur
  en clair, dans l'UI, AVANT tout envoi — jamais dans des CGU cachées ni en petits caractères après
  coup.** Texte exact retenu, à ne pas reformuler sans décision explicite :
  > Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France,
  > hébergement UE) pour lecture automatique. Ces documents ne sont pas utilisés pour entraîner les
  > modèles de Mistral. Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte
  > jamais ton appareil.

  **Technique, volontairement absent du texte affiché à l'utilisateur (pour rester simple)** : la
  rétention standard des documents reste jusqu'à 30 jours côté Mistral, sauf activation du Zero Data
  Retention — information vérifiée mais omise du texte, à ressortir si jamais quelqu'un interroge le
  point rétention.

  Si le projet revient un jour sur cette décision (retour au tier gratuit, où l'entraînement est de
  nouveau possible), **c'est cette mention qu'il faut corriger en premier** : annoncer une absence
  d'entraînement qui n'est plus garantie serait aussi faux que taire un entraînement qui a lieu
  (devoir n°2, dans les deux sens).
- ✅ **Consentement avant tout envoi + point d'entrée réel de l'import IA (29/07/2026, commits
  `ecca2c8` puis `d4906d5`)** — le chemin est désormais complet et en ligne droite :
  **dépôt → contrôles locaux → CONSENTEMENT → envoi → revue**. Pièces : `content/mentionEnvoiIA.ts`
  (le texte, source unique, testé mot pour mot), `components/ConsentementEnvoiIA.tsx` (modale
  bloquante, calquée sur `ConfirmationImport.tsx`), `lib/fichierImportIA.ts` (contrôles + base64),
  `lib/extraireDocumentIA.ts` (l'appel réseau), `components/ImportDocumentIA.tsx` (le point d'entrée,
  monté dans l'onglet « Import PDF » à côté du canal local, qui reste intouché).
  **La garantie tient par construction, pas par discipline** : `extraireDocumentIA` n'est appelé
  qu'à UN endroit du projet — le gestionnaire du bouton « Envoyer ce document » de la modale. Tant
  que ce bouton n'est pas cliqué, zéro octet ne part (vérifié dans le navigateur : « Annuler »
  produit zéro requête). Modale bloquante à CHAQUE envoi, **sans case « ne plus afficher »** : une
  telle case recréerait le consentement unique en petits caractères que la décision du 28/07 exclut.
  **Choix assumé : pas de réessai automatique.** En cas d'échec le fichier est oublié ; reprendre
  passe par un nouveau dépôt, donc par un nouveau consentement. Un bouton « Réessayer » renverrait
  le document sans repasser par la mention.
  **Contrôles locaux avant la modale** (format PDF, non vide, ≤ 3 Mo) : refuser tôt ce qui
  échouerait de toute façon, plutôt que faire consentir à un envoi condamné. Le plafond vient du
  corps de requête Edge (~4 Mo) et du gonflement base64 d'un tiers. Le type MIME absent retombe sur
  l'extension, mais l'extension ne l'emporte jamais sur un type qui dit autre chose.
  **Deux fuites d'information corrigées** dans `extraireDocumentIA`, trouvées en relisant le chemin
  ligne à ligne (le test du 404 passait, mais par chance) : `fetch` qui rejette affichait
  « Failed to fetch », et un 200 dont le corps n'est pas du JSON affichait « Unexpected token '<' ».
  Un 504 de proxy pouvait aussi révéler une adresse interne. Corrigé par liste blanche de statuts
  (seul le 503 « clé absente » voit son message réaffiché, car « réessaie » y serait trompeur) plus
  rejet de tout corps contenant des chevrons. Aucun de ces défauts n'a existé dans une version
  livrée. Nuance de formulation conservée : le message de coupure réseau **ne prétend pas** que le
  document n'a pas été transmis — une coupure peut survenir après l'envoi du corps.
  Le bouton d'aperçu de la modale a été retiré de `RevueExtractionDemo.tsx` : une seule porte vers
  la modale, et le vrai chemin est déjà sans danger à exercer en local.
  **408 tests verts** (372 avant ces deux commits), `npm run typecheck` propre, `npm run build` OK.
  ⚠️ **Aucun document ne peut partir en local *via l'app*** : `vite dev` ne sert pas les fonctions
  Vercel, donc `POST /api/extract-document` répond 404. Le segment navigateur → endpoint reste donc
  non exercé, et un envoi réel *depuis l'interface* exige un déploiement Vercel avec la clé (ou un
  routage dev-only). En revanche un script Node appelant `extractDocument` **directement** contourne
  l'endpoint et a bel et bien joint Mistral en local (cf. l'entrée ✅ sur le dialecte du schéma :
  statut 200, PDF bidon sans donnée personnelle) — la formulation « rien ne peut partir » est donc
  fausse au sens littéral depuis le 29/07/2026.
- ✅ **`etablissementAgree` ne peut plus être déduit d'un nom d'établissement (29/07/2026, commit
  `a934db2`).** Le risque décrit ici était réel : rien n'empêchait de conclure `true` de la seule
  présence d'un nom de conservatoire ou d'école de musique, alors qu'« agréé » est un statut
  administratif précis, presque jamais écrit sur un bulletin. La règle est désormais posée aux DEUX
  endroits que le modèle reçoit — le lexique de `document_annotation_prompt` et le `.describe()` du
  champ dans `src/types/extraction.ts` : `true` seulement si « agréé »/« agrément » figure
  LITTÉRALEMENT à propos de cet établissement ; un nom d'établissement est un nom, pas un agrément ;
  sinon `null`. Vérifié que la description atteint réellement le JSON Schema généré (888 caractères),
  et pas seulement le code source.
  ✅ **`enRapportAvecMetier` corrigé à son tour (31/07/2026, commit `5f9f6ab`)** — même patron exact
  aux mêmes deux endroits (lexique de `document_annotation_prompt` + `.describe()` du champ) : `true`
  seulement si le document mentionne LITTÉRALEMENT que l'enseignement est en rapport avec le métier ou
  l'activité artistique de l'intéressé ; un nom de matière, d'établissement ou de discipline plausible
  n'est pas une mention explicite ; sinon `null`. Vérifié que la description atteint réellement le
  JSON Schema généré (934 caractères). Les deux moitiés de la condition dans `decompteHeures.ts` sont
  désormais couvertes.
- ✅ **Affirmation « hébergement UE » confirmée par source officielle (31/07/2026).** Source :
  [help.mistral.ai — « Where do you store my data or my Organization's data? »](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data),
  consultée le 31/07/2026 : « By default, your data is hosted in the European Union. » — exactement
  ce que dit la mention de consentement. **Nuance à garder, trouvée dans la même source, plus précise
  que ce qui était supposé** : selon la fonctionnalité utilisée, une donnée peut être transférée
  temporairement hors UE vers un sous-traitant listé dans l'onglet « Subprocessors » du Trust Center ;
  dans ce cas Mistral applique les clauses contractuelles types de la Commission européenne (art. 46
  RGPD) et exige des garanties de sécurité renforcées (zero data retention ou chiffrement) côté
  sous-traitant. Les clients Enterprise peuvent désactiver ces transferts au niveau organisation.
  « Hébergement UE » est donc vrai comme principe par défaut documenté par Mistral lui-même, pas une
  garantie absolue à 100 % pour tous les usages — nuance déjà portée par le texte lui-même (aucune
  garantie à 100 % n'y est promise), donc **`content/mentionEnvoiIA.ts` reste inchangé**, seule cette
  entrée de documentation interne passe de 🔶 à ✅. (L'autre affirmation historique de ce bloc, sur
  l'entraînement en tier gratuit, est périmée depuis le 31/07/2026 : le texte ne fait plus cette
  affirmation, cf. l'entrée 🔶 dédiée plus haut.)

✅ **Phase 3 committée** (commit `d664344`) : `ajouterPeriode`/`supprimerPeriode` dans `App.tsx`
(pattern `ajouterContrat`/`supprimerContrat`), `PeriodeForm.tsx` (6 types, validation dateDebut ≤
dateFin, avertissements ald/maladie_intercontrat), `PeriodeList.tsx` (confirmation navigateur,
pattern suppression de série de contrats). **Écart avec le plan initial** (cf. ligne ci-dessous,
écrite avant la décision finale) : la section vit dans **Mon profil**, pas dans l'onglet Contrats —
décision explicite de Benoît au moment du cahier des charges, pas un oubli. Vérifié en navigateur par
Benoît : ajout et suppression d'une période font bouger le total d'heures du Dashboard dans les deux
sens. `engine/` inchangé, `PeriodeAssimilee` inchangé, schéma Zod déjà couvert (rien à faire côté
Phase 1 du chantier storage). 443 tests verts, `tsc -b` propre.

Effet de bord à garder en tête pour la suite : le refus n°2 de `routageExtraction.ts`
(`periode_assimilee` toujours `non_applicable`, faute d'écran de saisie) n'a plus sa raison d'être
technique — l'écran existe maintenant. Le débloquer (router une période extraite par l'IA vers
`ajouterPeriode`) n'a pas été fait ici, ce n'était pas demandé, mais c'est désormais possible.

✅ **Phase 1 du chantier « saisie des périodes assimilées » committée** (commit `a3f0f71`, branche
`backend-api-import-ia`, après relecture et feu vert de Benoît). Les 4 fichiers
(`src/engine/decompteHeures.ts`, `src/engine/salaireReference.ts` et leurs deux fichiers de tests)
sont dans l'historique. 440 tests verts, `npm run typecheck` propre au moment du commit.

Ce que la Phase 1 fait : **plus aucun jour n'est compté deux fois.** Un nouvel helper partagé
`joursAssimilesHorsContrat` (exporté par `decompteHeures.ts`) compte les jours d'une période assimilée
dans la fenêtre **en sautant ceux déjà couverts par un contrat**. Deux défauts fermés d'un coup :

- **compteur 507 h** (`decompteHeures.ts`) : un jour sous contrat valait ses heures **plus** 5 h
  assimilées → compteur gonflé, donc faux feu vert ;
- **montant** (`salaireReference.ts`) : un jour travaillé était soustrait du dénominateur du SAR, ce
  qui **gonflait l'allocation**. Trouvé en vérifiant, hors du périmètre demandé, même cause racine.
  L'exclusion y regarde **tous** les contrats de la fenêtre, **enseignement inclus** (la question est
  « ce jour a-t-il été travaillé ? », pas « ce contrat alimente-t-il le SR ? »).

Défaut **latent** jusqu'ici, et c'est le cœur du raisonnement : sans chemin d'écriture, `periodes` est
vide en pratique — **c'est l'écran de saisie à venir qui l'aurait armé.** D'où la correction du moteur
AVANT l'écran, et non après.

Un test existant a échoué et c'était un vrai signal : la fixture du SAR posait un cachet le 01/06/2026
en pleine maternité déclarée du 01/03 au 08/06. Le contrat a été **déplacé en septembre** plutôt que
l'attendu changé en 99 — changer l'attendu aurait figé la contradiction dans le test de référence.

`TYPES_OUVRANT_SAR` : le ⚠️ « supposition » a été retiré. Le guide (p. 11-12) énumère limitativement
maternité/adoption/ALD comme les trois seuls types qui aménagent le SR — vérifié par Benoît, pas
supposé. Ne pas réintroduire `accident_travail` ni `suspension_contrat` « par symétrie ».

**Tableau des 6 types de périodes reçu le 29/07/2026 (soir)** — croisé avec le code, résultat :

- `maternite` / `adoption` / `ald` / `accident_travail` : code déjà conforme au tableau (507h + SAR),
  rien à faire.
- `maladie_intercontrat` : ✅ **vérifié** que l'allongement de fenêtre est bien câblé
  (`periodeReference.ts`, `joursAllongementMaladie` soustrait de la date de début) — rien à faire.
- `suspension_contrat` : ✅ **corrigé** (commit `8e2dd7a`). Il compte désormais toujours 5 h/jour, y
  compris en chevauchant un contrat (règle du guide, pas un double compte — ce type se produit par
  nature pendant un contrat actif). Le SAR reste inchangé (hors de `TYPES_OUVRANT_SAR`) avec un
  `// TODO` dans `salaireReference.ts` : le tableau marque ce point ❓ non confirmé, pas 🔴.
  En corrigeant, une fausse certitude a aussi été retirée : un commentaire affirmait à tort que
  l'exclusion de `suspension_contrat` du SAR était « ✅ VÉRIFIÉ » au guide.

**Ce qui reste bloqué** : le tableau ne couvre que le comptage d'heures et le SAR — pas les
conditions d'éligibilité d'une période. Deux points de la Phase 0 restent donc ouverts :

1. la **condition ALD** (ouverture de droits antérieure requise) : ni vérifiée ni implémentée —
   question posée à Benoît, réponse en attente ;
2. la **condition « indemnisée par la SS »** sur `maladie_intercontrat` (SPEC §6.1) : aucun champ ne la
   porte → c'est la Phase 2, et ⚠️ toute nouvelle règle de cohérence doit rester **hors du schéma de
   lecture** de `chargerDonnees`, sinon un profil déjà enregistré serait rejeté et lu comme des
   « données perdues ».

Suite du chantier : **Phase 2** (restante) = porter les conditions ALD / « indemnisée par la SS » dans
le modèle de données. **Phase 3** (committée, `d664344`) = `ajouterPeriode`/`supprimerPeriode` +
l'écran de saisie — voir plus haut pour le détail et l'écart de placement (Mon profil, pas Contrats).

**Reporté en fin de projet par décision explicite du 29/07** (ne pas le ressortir comme « prochaine
action ») : `vercel dev`, faire passer un premier vrai document par `api/extract-document.ts`, la
décision de fusion des 12 commits dans `master`, et les deux corrections de `docs/SPEC.md`
(ligne ~24 « hors MVP » périmée sur la branche ; ligne ~334 décrit la zone de dépôt sans la
checklist). On continue à construire en attendant.

✅ **Brouillons `docs/files/ImportDocumentIA.jsx` et `docs/ImportDocumentIA.jsx` supprimés le
29/07/2026 (commit `8267880`)** — aucun des deux n'était importé dans `src/` (vérifié par grep avant
suppression) ; `src/components/ImportDocumentIA.tsx` (le vrai composant, qui passe par
`api/extract-document.ts`) n'a pas été touché. `npm run build` + tests toujours verts après coup. Le
paragraphe qui suivait demandait encore de « corriger » ce brouillon — périmé, corrigé ici.
Vérifier l'affirmation « hébergement UE » du texte de consentement : ✅ fait le 31/07/2026 (cf.
l'entrée dédiée plus haut).

✅ **SR/SJM réels branchés sur `calculerSerieDepuisContrats` (29/07/2026 soir, commit `5446e33`)** —
dernier morceau du chantier franchise salaires évoqué ci-dessus. `RevenusMensuels.tsx` reçoit
maintenant `periodes` en prop (cascade `App.tsx` → `RevenusMensuels` → `TableauResultats`) ;
`TableauResultats` calcule `calculerFenetreReference` puis `calculerSalaireReference` (**exactement**
la fenêtre d'`App.tsx:70-72`, pas une fenêtre inventée) puis `calculerSJM(sr, nht, config)`, et passe
`{ srContrats: sr, sjm }` en 6ᵉ argument. **Garde ajoutée, décidée explicitement par Benoît avant
codage** : si `profil.dateAnniversaire` est vide, cet argument reste `undefined` (repli sur
`FRANCHISE_SALAIRES_NON_CERTIFIEE`, comportement historique) — sans elle, un profil dont
`ouvertureDroits` est rempli mais `dateAnniversaire` encore vide (deux champs indépendants,
remplissables séparément) aurait vu la fenêtre glisser avec `dateDuJour` au lieu de rester fixée à la
PRA réelle qui a ouvert les droits, un SR qui aurait dérivé jour après jour. Vérifié en console
navigateur avec les vrais modules du moteur (pas une simulation à côté) : `dateAnniversaire` renseignée
→ `sr=8000`, `nht=600`, `sjm≈133,33`, franchise **calculée** (`valeur: 0`, pas `null`) ; `dateAnniversaire`
vide → repli confirmé sur `{ valeur: null }`. **Point annexe repéré, non traité (hors périmètre
demandé)** : l'UI (`RevenusMensuels.tsx:472-483`) n'affiche un message que si `valeur === null` ou
`valeur > 0` — le cas `valeur === 0` (calculée mais nulle, comme dans le scénario de test ci-dessus)
ne produit aucun texte, silencieux mais pas trompeur. 443 tests verts, `tsc -b` propre.

✅ **Quatre petits combles d'UI, trouvés en auditant "que se passe-t-il si l'utilisateur ne fournit
que 3 documents ?" (29/07/2026 soir → 30/07/2026, commit `6f8024d`)** :
- **A** — `tauxPrelevementSource` (`MonProfil.tsx`) était déjà saisissable, seul le texte d'aide
  était corrigé : « tes relevés de situation France Travail » au lieu de « ton bulletin France
  Travail », vocabulaire harmonisé avec le point D.
- **B** — `ajReelleHistorique` (`GestionAjReelle`) : phrase ajoutée pour expliquer qu'une
  revalorisation en cours de droits s'ajoute comme une nouvelle ligne, pas un remplacement.
- **C** — Suggestion de pré-remplissage de `dateAnniversaire` depuis `dateLimiteIndemnisation`
  quand la première est vide : **piège trouvé et évité avant de coder** — écrire directement via
  `onModifierProfil` depuis `MonIndemnisationEnCours` aurait recréé exactement le problème déjà
  documenté pour `salairesHorsAnnexe10PRA` (deux porteurs d'écriture sur le même champ, l'un
  écrasant l'autre). La suggestion ne fait donc que pré-remplir le **brouillon local** de la
  section « Ton profil » (`suggererDateAnniversaire` dans `MonProfil.tsx`) ; la persistance reste
  derrière le bouton « Enregistrer » existant, avec son garde-fou de confirmation déjà en place
  (`dateAnniversaireModifiee`). Vérifié en navigateur : accepter la suggestion ne touche pas
  `localStorage` tant que « Enregistrer » n'est pas cliqué, et `ouvertureDroits` reste intact.
- **D** — `ImportDocumentIA.tsx` : liste statique des 3 types de documents à préparer, ajoutée
  avant la zone de dépôt. Distincte de `ChecklistDocuments` (déjà montée au-dessus des deux canaux
  d'import) qui liste des champs manquants dynamiquement — les deux coexistent sans conflit, objets
  différents.

443 tests verts, `tsc -b` propre.

⚠️ **Import IA testé en production (30/07/2026) : échec silencieux sur un bulletin GHS-sPAIEctacle.**
Bulletin de paie « Association du Festival de St Germain en Laye » (logiciel GHS-sPAIEctacle, format
Artiste Musicien, 1 cachet isolé représentation, 175 € brut, période 28/06/2026). Résultat : texte
brut extrait **vide** côté Mistral OCR — aucun champ lu automatiquement (salaire, cachets, dates,
employeur). Le type « Artiste » a tout de même été reconnu et `ContractForm` s'est ouvert, mais tous
les champs restaient vides — saisie manuelle obligatoire. Pas un chiffre faux (devoir n°2 tenu :
rien n'a été inventé pour combler le vide), mais un échec d'extraction non diagnostiqué. Piste à
investiguer : format PDF dense multi-colonnes, rendu possiblement vectoriel incompatible avec l'OCR
Mistral — enrichir `document_annotation_prompt` avec des instructions spécifiques aux bulletins à
colonnes multiples du spectacle vivant. Testés avec succès le même jour : notification ARE ✅, relevé
de situation ✅ — l'échec semble propre à ce format de bulletin, pas au canal IA en général.

## Backlog — to-do complète (30/07/2026)

### Terminé cette session
- ✅ Phases périodes assimilées (0, 1, 3)
- ✅ Brouillons ImportDocumentIA supprimés
- ✅ Garde-fou PDF > 3 Mo confirmé présent
- ✅ SR/SJM branchés sur calculerSerieDepuisContrats
- ✅ Gaps UI profil (taux PAS, ajReelleHistorique, dateAnniversaire, checklist docs IA)
- ✅ Déploiement Vercel — app en ligne : cadence-faypc2dbg-benoit3.vercel.app
- ✅ Test import IA production : notification ARE ✅, relevé de situation ✅, bulletin GHS ⚠️

### À faire — priorité haute
- ✅ Prompt GHS/sPAIEctacle — bulletins multi-colonnes couverts (commit 081a516)
- ✅ Taux PAS depuis relevé de situation — enregistrement confirmé en prod (commits eb5a880 + d72ac18)
- ✅ Prompt relevé de situation — 469,26 € (total mensuel net) extrait à tort comme AJ journalière :
  origine identifiée (`Relevé_de_situation_20260715.pdf` — le mot « Journalière(s) » dans l'en-tête
  de colonne du tableau « Allocation d'Aide au Retour à l'Emploi » ne qualifie que la colonne
  « Nb d'alloc. », pas les montants ; confirmé en croisant avec le relevé d'avril 20260414_3,
  55,02 €/jour × 17 ≈ 935 € cohérent). Le vrai montant journalier n'est écrit qu'en toutes lettres
  dans « INFORMATIONS SUR VOS DROITS » (« Allocation brute d'un montant journalier de X Euro […] »).
  Correctif de lexique + CAS 5 ajoutés dans `api/extract-document.ts` (piège dédié + citation
  obligatoire). **Validé en appel réel à l'API Mistral sur le document exact qui a produit le bug**
  (31/07/2026, hors Playground — appel direct `extractDocument` avec la clé de `.env`) :
  `aj_reelle_historique` correctement rempli à 55,02 € brut (justifié par la phrase « Allocation
  brute d'un montant journalier de 55,02 Euro [...] »), la ligne du tableau (469,26 € net/9 jours)
  correctement routée en `info_seule`, aucune sur-généralisation observée. Un second bug,
  indépendant, a été découvert au passage : `info_seule.donnees` (schéma Zod scalaires uniquement)
  rejetait un objet imbriqué que le modèle produisait pour les totaux de période, faisant échouer
  toute l'extraction sur ce document. Corrigé par une règle de prompt exigeant des clés scalaires
  à plat plutôt qu'un objet composite — revalidé, l'extraction passe désormais la validation Zod.
- ✅ Confiance "moyenne" sur le taux PAS — résolu (31/07/2026) : ajout d'une règle de date par
  section (dateEffet du taux = date de la section "Situation au [date]" englobante, jamais extraite
  de la phrase du taux qui n'en contient pas) + garde-fou anti-dérive de formulation (taux introuvable
  → info_seule explicite plutôt qu'une approximation) + citation obligatoire section + phrase. Validé
  en appel réel à l'API Mistral sur `Relevé_de_situation_20260715.pdf` (ses deux sections "Situation au
  28/06" et "Situation au 13/07", même taux 3,10 % dans les deux) : confiance passée de "moyenne" à
  "haute", valeur correcte, aucune confusion avec l'en-tête voisin "REGLEMENT DU 01/07/2026", les deux
  occurrences correctement distinguées avec dates propres.
- 🔶 Sélection de la section la plus récente comme valeur primaire du taux PAS — gap résiduel
  documenté, non couvert par le fix ci-dessus : le prompt ne garantit pas de choisir systématiquement
  la section la plus récente comme valeur "primaire" quand plusieurs sections coexistent — sur le
  document testé, les deux sections portent le même taux donc le gap ne s'est jamais traduit par un
  chiffre faux, mais un document où le taux change réellement entre deux sections (changement de taux
  personnalisé DGFIP en cours de mois) pourrait révéler un choix de section incorrect comme valeur par
  défaut. Aucun document réel ne montre encore ce cas — pas de correctif tant qu'on n'a pas de preuve
  sur pièce.
- ⬜ Vérifier données réelles — import JSON + Dashboard vs notification France Travail
- ⬜ PWA sur téléphone — installer et vérifier sur appareil réel
- ⬜ Phase 2 périodes assimilées — conditions ALD (en attente source réglementaire)

### À faire — priorité normale
- 🔴 Webview France Travail intégrée (idée révisée le 31/07/2026) — plutôt qu'une API introuvable
  ou du scraping distant, l'idée était d'ouvrir une fenêtre de navigation DANS Cadence pour que
  l'utilisateur se connecte lui-même à son espace France Travail (cookies/jeton chiffrés stockés
  uniquement sur l'appareil). Point bloquant : FranceConnect interdit explicitement l'affichage de
  sa mire de connexion en iframe/webview (FAQ officielle, anti-phishing) — une webview embarquée est
  fonctionnellement équivalente à un iframe du point de vue de l'IdP, donc probablement inapplicable
  pour les utilisateurs passant par FranceConnect (la voie recommandée par France Travail). Options
  restantes : (a) connexion directe identifiant/mot de passe France Travail hors FranceConnect —
  zone grise CGU, utilisateur seul garant de ses identifiants ; (b) navigateur système EXTERNE (pas
  une webview intégrée) pour la connexion/téléchargement, retour dans Cadence pour déposer le
  fichier — perd le "tout intégré" mais reste compatible FranceConnect et évite le terrain iframe.
  À trancher : réorienter vers (b), ou abandonner si (a) est jugé trop fragile juridiquement/UX.
- ✅ **AJ brute vs nette — non reproduit, formule prouvée correcte (31/07/2026).** L'écart supposé
  n'a jamais été un bug de calcul : `docs/validation.md` (Cas réel #1, notification FT du
  03/02/2026) montre `calculerAJNette` appliqué à l'AJ brute réelle (55,02 €) donnant 53,81 € net —
  exactement le net réellement notifié, 0,00 € d'écart. Le commentaire déjà présent dans
  `config/franceTravailConfig.ts` (l.63-68, commit `a62e9b1` du 24/07) précisait même l'écart réel
  (~2,2 %, pas ~5 %), validé « à l'euro près » sur fév-juin 2026 — cette entrée de backlog n'avait
  simplement jamais été mise à jour en conséquence (péremption documentaire, même famille que
  celles nettoyées le 30/07). Résidu réel identifié à part : la provenance de la valeur saisie dans
  `Profil.ajReelleHistorique` (rien n'empêchait de recopier une ligne « brute » d'un relevé dans le
  champ « AJ nette » de `MonProfil.tsx`) — traité par un avertissement de plausibilité, pas un
  nouveau champ déclaratif (commit `2d05f6d`, détail et justification dans `docs/reprise.md`).
- ⬜ Comparaison complète Cadence vs 8 mois réels
- ⬜ Production branch Vercel — pointer sur master explicitement dans les settings
- ⬜ Inventaire annuel des documents réglementaires — lister tous les documents sources dont
  dépendent les calculs de Cadence (guide France Travail intermittents, arrêtés SMIC, convention
  d'assurance chômage, circulaires PMSS) avec leur date de publication et leur prochaine échéance
  connue, et définir un processus de mise à jour annuel (au minimum : 1er janvier pour SMIC/PMSS,
  et à chaque nouvelle convention d'assurance chômage). Objectif : garantir que
  `franceTravailConfig.ts` reste à jour et que le bandeau « règles vérifiées au JJ/MM/AAAA » ne
  vieillit pas silencieusement.
- ⬜ Basculer MISTRAL_API_KEY sur le plan payant Mistral (Scale) — une fois fait, repasser l'entrée
  ci-dessus de 🔶 à ✅ et vérifier que le texte de consentement (déjà corrigé, sans mention
  d'entraînement) est enfin exact en pratique, pas seulement en intention. Coût estimé : ~260-350 $/an
  pour 100 utilisateurs à 100-200 documents/an chacun (voir calcul de session).

### Post-bêta
- ⬜ Refonte design (couleurs, placement onglets — à préciser)
- ⬜ Renouvellement anticipé (détail et prérequis dans docs/SPEC.md)
- ⬜ Module congés spectacle

---

## Décisions actées

Bug avril 2026 (1237€ vs 968€) : résolu — origine données incorrectes (contrats inventés qui
chevauchaient le mois). `repartirContratParMois` validé sur données réelles. Aucune modification
de code.

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
