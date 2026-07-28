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
  et clé absente diagnostiquée en 503 explicite au lieu d'un 500 générique. Restent ouverts :
  (2) le PDF part en base64 dans le corps de requête, +33 % de volume, plafond Edge ~4 Mo →
  **plafond pratique ~3 Mo de PDF** (un bulletin passe, une notification scannée multi-pages peut
  coincer) — documenté en commentaire, **pas encore géré côté client**. (3) L'OCR peut dépasser le
  timeout, l'Edge plafonnant vers 25 s — non mesuré, aucun appel réel n'a jamais eu lieu.
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
  dans le bundle client. **Reste à faire côté client** : le plafond de corps de requête Edge (~4 Mo,
  soit **~3 Mo de PDF** en base64) n'est pour l'instant que documenté en commentaire — un PDF plus
  gros sera rejeté par la plateforme avant d'atteindre le code, sans message compréhensible pour
  l'utilisateur. **Non prouvé** : rien de tout ça n'a été exécuté sur Vercel, aucun déploiement n'a eu
  lieu.
- 🔶 **`d3ebb36` n'est PAS fusionné dans `master`** — `master` est resté sur `2721778`. Tout le
  chantier import IA (backend `59d129f` + écran de revue `d3ebb36`) vit sur la branche
  `backend-api-import-ia`. Fusion à décider explicitement, pas encore faite.
- 🔴 **Bloquant inchangé : aucun document réel tant que le DPA Mistral n'est pas vérifié/signé.** Tout
  ce qui précède tourne sur des fixtures en dur, par construction. Le non-entraînement sur les données
  du tier gratuit « Experiment » n'est **pas** confirmé (l'engagement contractuel trouvé est rattaché
  aux abonnements payants) — à vérifier dans la console Mistral, sinon passer sur une clé payante
  (~1 centime/document) avant le moindre document, y compris un test personnel.

**Prochaine action (chantier import IA)** : brancher `POST /api/extract-document` derrière l'écran de
revue, qui est prêt et éprouvé sur fixtures (cf. `d3ebb36`). Deux prérequis **avant** tout document
réel, même un test personnel : (1) DPA Mistral vérifié/signé et non-entraînement du tier gratuit
« Experiment » confirmé dans la console, sinon clé payante ; (2) corriger le brouillon
`docs/files/ImportDocumentIA.jsx`, qui appelle Mistral directement depuis le navigateur avec la clé
dans un `<input>` (cf. le 🔴 plus haut) — il doit appeler l'endpoint et ne jamais connaître la clé.
Chantier indépendant utile en attendant : le CRUD des périodes assimilées (cf. la dette 🔴 ci-dessus),
qui débloquerait la cible `periode_assimilee` de l'extraction.

**Prochaines pistes** : voir les deux points 🔴 juste au-dessus (dette `PeriodeAssimilee` sans chemin
d'écriture, bloquant DPA Mistral) et `docs/reprise.md` pour le détail. Chantier ouvert restant sur la franchise
salaires : fournir de vrais SR/SJM à `calculerSerieDepuisContrats` (via
`srSjmPourFranchiseSalaires`) quelque part dans l'app — le mécanisme de répartition mensuelle est
déjà câblé et testé, seule la donnée réelle manque. Plus aucun ❌ confirmé par ailleurs dans la
liste, la cohérence de profil est tenue par construction, et tous les items §11.A sont désormais traités
(transparence du calcul comprise). Sinon, sans urgence : les deux limites connues 🔶 ci-dessus, le
`rythme_hors_limite` différé (backlog `docs/reprise.md`/`docs/validation.md`), l'installation
réelle sur un vrai téléphone (PWA techniquement prête, dépend du déploiement bêta), alignement
visuel fin sur `docs/maquette_dashboard.html`.

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
