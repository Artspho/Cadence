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
                                   # ConfirmationImport, DashboardVide
  lib/contratRecurrent.ts         # genererContratsRecurrents() — contrat récurrent enseignement
    __tests__/
  App.tsx  main.tsx  index.css
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

**Prochaines pistes** : plus aucun ❌ confirmé dans la liste, la cohérence de profil est tenue
par construction, et tous les items §11.A sont désormais traités (transparence du calcul comprise).
Aucune priorité imposée pour la suite — à choisir dans le backlog selon ce qui semble le plus utile.
Sinon, sans urgence : les deux limites connues 🔶 ci-dessus, le `rythme_hors_limite` différé
(backlog `docs/reprise.md`/`docs/validation.md`), PWA réellement installable, alignement visuel
fin sur `docs/maquette_dashboard.html`.

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
