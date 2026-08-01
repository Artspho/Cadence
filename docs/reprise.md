# CONTEXTE — Projet Cadence (reprise de session)

App web indépendante Cadence : suivi des droits intermittents Annexe 10, focus artistes-enseignants. But : visibilité claire et fiable du statut. Je ne lis pas le code, je pilote via Claude Code en exigeant de la rigueur, explications en français simple.

Setup Windows, projet dans `C:\Users\benoi\cadence`. Stack : React + TS + Tailwind + Vite + Vitest + Zod + date-fns, localStorage.

Mémoire durable à consulter au démarrage : `CLAUDE.md`, `docs/SPEC.md`, `docs/validation.md`.

Deux devoirs sacrés : (1) ne jamais perdre les données ; (2) ne jamais afficher un chiffre faux (ni faux « feu vert » rassurant, ni faux « Bloqué », ni faux montant, ni fausse alerte, ni valeur sentinelle brute).

État (mis à jour le 31/07/2026, fin de session) : les deux devoirs sacrés sont tenus, la bêta a
son socle. 467 tests verts, `tsc -b` propre. Dernier commit sur `master` : `9e56656` (fix
`dateAnniversaire`, cf. « Fait » ci-dessous). `master` est 5 commits en avance sur `origin/master`
— non poussés (Claude Code ne pousse jamais, par consigne explicite, quelle que soit la
configuration des identifiants). Tous les items §11.A du SPEC sont désormais traités.

**Point de vigilance immédiat pour la prochaine session** : le bug des 710h (cf. « Fait » ci-dessous)
est corrigé côté code, mais l'utilisateur doit encore mettre à jour lui-même, dans « Ton profil »,
`dateAnniversaire` (→ la prochaine échéance réelle) et `dateAnniversairePrecedente` (→ la FCT du
droit en cours) — sans quoi le Dashboard réel continuera d'afficher l'ancien chiffre malgré le
correctif. Vérifier au démarrage de la prochaine session si c'est fait.

**⚠️ Point d'attention avant tout nouveau chantier — confusion de dossier non résolue** : il existe
**deux copies** du projet sur cette machine : `C:\Users\benoi\cadence` (le vrai dépôt git, celui de
toute cette session et de tout le travail décrit ci-dessous) et
`C:\Users\benoi\OneDrive\Bureau\cadence\cadence` (une ossature de tout début de projet, sans git,
sans `storage/`, sans Onboarding, rien de construit — son propre `CLAUDE.md` dit encore
« ⬜ storage/, components/, câblage App.tsx »). L'utilisateur a montré une capture d'écran de cette
**seconde** copie (« Ossature prête. ») en pensant que c'était l'app actuelle, bloquée sans action
possible. Deux questions de clarification posées (quel dossier corriger, quelle hypothèse) ont
toutes les deux été **rejetées sans réponse** par l'utilisateur — **rien n'a été fait sur ce point,
à reprendre en premier** : soit c'est un vieux dossier oublié (l'app réelle tourne déjà très bien
depuis `C:\Users\benoi\cadence`, rien à coder), soit c'est un second projet volontairement distinct
à faire avancer en parallèle (auquel cas il faut construire l'import/export et l'onglet Profil
avant que les deux boutons demandés aient un sens). Ne pas relancer une demande de clarification
au démarrage sans que le contexte l'indique — attendre que l'utilisateur revienne dessus.

## Fait dans les sessions récentes

- areNette.ts corrigé (bug CSG/CRDS calculée sur SJM au lieu de l'allocation, facteur ~8) : assiette = 98,25 % de l'allocation après retraite + écrêtement au plancher. Champ dédié `cotisations.plancherEcretementJournalier` = 62,00 (PAS dans `smicJournalierBrut`, réservé franchise salaires). Cas #2 et #3 → « ✅ code conforme » dans validation.md.
- Export/import JSON (devoir n°1) : ordre sauvegarde de secours → validation Zod → écriture ; 3 messages d'erreur distincts ; import remplace (pas fusion) avec sauvegarde auto avant.
- Bandeau règles datées + péremption honnête : `meta.valableJusquau` (null tant que pas de date sourcée), fonction pure `estPerime(date, valableJusquau)`. Supprimé un `SEUIL_PEREMPTION_JOURS = 365` inventé. Un seul juge de péremption désormais.
- Bouton feedback : `mailto:` vers benoit.zahra@orange.fr, corps neutre sans aucune donnée utilisateur, `config/contact.ts`. Adresse null → rien affiché.
- État vide du Dashboard : déclencheur `contrats.length === 0` (PAS `decompte.total === 0` — un profil enseignement-seul garde un dashboard normal). Masque carte allocation (fini le faux 44 €), graphe, AlertCenter + chip résumé (finie la fausse alerte « 507 h » sur compte neuf). Composant `DashboardVide`, prédicat `dashboardEstVide()` dans `lib/`.

## Fait (bug Infinity corrigé)

`StatutPrediction.rythmeMensuelRequis: number` (pouvait valoir `Infinity`) remplacé par
`rythmeRequis: RythmeRequis`, type discriminé à exhaustivité forcée par le compilateur :
`{ atteignable: true; heuresParMois: number }` ou `{ atteignable: false; raison:
"anniversaire_inconnu" | "delai_expire" }`. Distinction volontaire des deux raisons (devoir
n°2) : `anniversaire_inconnu` = donnée manquante (profil neuf), jamais présentée comme un délai
expiré ; `delai_expire` = anniversaire connu et réellement dépassé. `alertes.ts` n'émet plus
aucune alerte de rythme quand `anniversaire_inconnu` (rien n'est imminent). `Dashboard.tsx` a un
switch exhaustif (`libelleRythmeRequis`) qui casse à la compilation si une raison est ajoutée
sans être traitée. Tests dédiés ajoutés (prediction.test.ts, alertes.test.ts) vérifiant
explicitement l'absence de la chaîne « Infinity ». 62 tests verts, détail : SPEC §6.6,
`CLAUDE.md` « État actuel », `validation.md` (section « Hors périmètre de validation externe »).

## Fait (garde-fou situation mixte étendu à 3 états)

`Profil.regimeDeclare: "annexe10_pur" | "mixte" | "inconnu"` remplace l'ancien booléen
`activiteHorsAnnexe10` (gardé déprécié, lecture seule) comme source du garde-fou hors périmètre.
Onboarding et « À propos » offrent désormais 3 choix (Non / Oui / Je ne sais pas) au lieu d'une
case à cocher — la question ciblait déjà correctement technicien (A8) / emploi hors spectacle,
jamais l'enseignement, aucun changement de copie nécessaire là-dessus. « inconnu » suit
EXACTEMENT le même chemin que « mixte » (même alerte `situation_mixte`, même écran
`AvertissementHorsPerimetre`) — vérifié par test ET manuellement dans le navigateur. Migration
(devoir n°1) : `lib/profilHorsPerimetre.ts` (`profilHorsPerimetre()`/`regimeEffectif()`) lit
`activiteHorsAnnexe10` en repli quand `regimeDeclare` est absent — aucun profil déjà enregistré
ne change de comportement au prochain chargement (testé explicitement, non-régression
obligatoire). 71 tests verts, détail : `CLAUDE.md` « État actuel », `docs/SPEC.md` §10.

## Fait (revalidation post-onboarding, 3 portes fermées)

Date de naissance, situation et date anniversaire sont désormais modifiables après coup dans
« À propos » → « Ton profil » (`AProposLimites.tsx`) — plus besoin d'éditer le JSON à la main.
Prudence ciblée : naissance libre sans cérémonie ; situation modifiable mais formulaire cohérent ;
date anniversaire modifiable avec note + confirmation en deux clics avant toute écriture, jamais
silencieuse. **Piège trouvé en investiguant, indépendant de l'édition** : une réadmission sans date
anniversaire connue était déjà validable dès l'Onboarding (pas seulement à l'édition) —
`periodeReference.ts` aurait tourné sur une fenêtre fictive "se terminant aujourd'hui", un seuil
ajusté plausible mais faux. `lib/coherenceProfil.ts` (`validerCoherenceProfil` +
`validerProfilPourEcriture` + `profilSchema.refine`) ferme les **3 portes** qui écrivent un profil —
Onboarding, édition, et **import JSON** (même règle, même message, pas de 4e demi-rempart) — au
point de passage unique `App.tsx` (`modifierProfil`), jamais seulement dans le composant. Devoir
n°1 tenu par construction (jamais de `setDonnees` avant Zod + cohérence), sans fichier de
sauvegarde téléchargé (disproportionné pour 3 champs, à la différence de l'import qui remplace
tout). `engine/` intouché — le moteur suppose désormais un profil cohérent par construction.
Vérifié manuellement dans le navigateur (refus Onboarding, refus édition même message, recalcul
complet du Dashboard après confirmation d'une date anniversaire). 79 tests verts, détail :
`CLAUDE.md` « État actuel », `docs/SPEC.md` §10, `docs/validation.md`.

## Fait dans la session précédente

- Panneau de transparence du calcul (`DetailCalcul.tsx`) — détail A+B+C, heures comptées vs écartées.
- Correctif "date inconnue" vs "échéance atteinte" (anniversaire non renseigné).
- Bug critique corrigé : seuil de réadmission à 1515h (plafond technique qui fuitait à l'écran). Type discriminé `SeuilReadmission` ajouté, repli honnête sur `historique_insuffisant` + alerte dédiée + bandeau Dashboard.
- Champ `dateAnniversairePrecedente?: string` ajouté au modèle `Profil` (optionnel, ISO, visible uniquement si `situation === "readmission"`).
- `SeuilReadmission` étendu avec un 3e variant `hors_bornes` — distinct de `historique_insuffisant` (cause différente, message différent, action suggérée différente incluant la mention clause de rattrapage 338–506h).
- `periodeReference.ts` : borne réelle utilisée quand le champ est renseigné ; `TRANCHES_MAX` reste garde-fou absolu uniquement ; TODO inclusif/exclusif laissé en commentaire.
- Bug TypeScript trouvé et corrigé en cours de route : narrowing sur union `calculable: false` à plusieurs variantes — les assertions d'exhaustivité testent désormais la valeur entière, pas `.raison` isolée.
- 91/91 tests verts — 6 nouveaux tests ajoutés.
- Vérifié bout en bout dans le navigateur : champ apparaît/disparaît selon la situation, saisie dans "Mon profil" → sauvegarde → Dashboard bascule immédiatement de `historique_insuffisant` à `hors_bornes` avec le bon message.

Commits : `505473a`, `4fba5b5`, `4d22218`.

## Fait (renommage « À propos » → « Mon profil »)

Item backlog traité. `TopBar.tsx` : libellé et valeur interne du type `Onglet` (`"apropos"` →
`"profil"`, jamais persisté — aucune migration de données) renommés, remonté en 2e position (juste
après le Tableau de bord, avant Contrats/Import/Historique/Simulateur) — c'est là que se renseigne
`dateAnniversairePrecedente` en réadmission, ça doit rester facile à trouver. `AProposLimites.tsx`
renommé en `MonProfil.tsx` (composant, interface, id DOM internes `apropos-*` → `profil-*`) ; le
`<h2>Ton profil</h2>` interne, lui, reste inchangé (adresse à l'utilisateur, toujours correcte).
Deux références croisées alignées : `Onboarding.tsx` (indice regimeDeclare mixte) et `alertes.ts`
(message `historique_insuffisant`, qui disait déjà « Mon profil » par anticipation avant même que
l'onglet soit renommé — corrigé au passage, plus une incohérence). **Petit accroc en committant** :
un `git add` sur un chemin invalide a fait échouer la commande sans le signaler assez tôt, le
premier commit (`3da9ff6`) n'a capturé que le renommage de fichier sans le contenu — corrigé
immédiatement par un second commit (`841d9a1`) avec le vrai contenu, signalé tel quel plutôt que
masqué. 91 tests verts (aucun test ne référençait l'ancien libellé), tsc propre. Vérifié dans le
navigateur : ordre et libellé corrects, contenu de l'écran inchangé, alerte et indice Onboarding
disent bien « Mon profil ».

## Fait (contrat récurrent pour l'enseignement)

Item 1 du backlog traité. 4 décisions tranchées par l'utilisateur avant de coder : (1) payé en
heures, jamais en cachets — fixé dans le formulaire, pas de choix laissé ; (2) bouton séparé
(`ContractFormRecurrent.tsx`) plutôt qu'un toggle dans `ContractForm.tsx` déjà ramifié par
type/territoire ; (3) `ContractList.tsx` groupe par série (repliable) plutôt qu'une liste plate —
40 lignes identiques aurait été inutilisable ; (4) option architecturale confirmée : contrats
matérialisés à la création (normaux, tagués `recurrenceId` + `source: "recurrent"`) plutôt qu'une
entité « série » dépliée à la volée par le moteur — zéro risque de point d'appel oublié dans
`engine/`, zéro migration. `lib/contratRecurrent.ts` (`genererContratsRecurrents`) génère un
contrat « enseignement »/« heures » par mois de la plage hors mois exclus (chips de sélection),
daté fin de mois. **Limite actée dès le plan, pas une découverte a posteriori** : pas d'édition de
série après coup, seule la suppression complète + régénération permet de corriger une série mal
saisie — remarque de l'utilisateur prise en compte : le bouton « Supprimer la série » est visible
directement sur la ligne résumé (pas caché derrière un dépli), avec confirmation navigateur
(nombre de contrats + employeur) avant toute suppression groupée. `engine/` intouché. 9 tests
dédiés ajoutés, 100 tests verts au total, `tsc -b` propre. Vérifié dans le navigateur : génération
avec exclusion d'un mois, dépliage de la série, suppression d'un seul mois (total recalculé),
Dashboard cohérent (répartition « Enseignement · 24 h » après suppression d'un mois sur 3).
Tentative de suppression de série annulée par le navigateur automatisé au niveau de la boîte de
confirmation — le garde-fou marche (rien supprimé tant que non confirmé), mais le chemin
« confirmé » n'a pas pu être vérifié bout en bout en automatisé, **à tester manuellement au moins
une fois**. Détail complet : `CLAUDE.md` « État actuel ».

## Fait (point d'entrée du contrat récurrent revu, même session)

Amélioration UI demandée juste après le lot ci-dessus : le bouton isolé en haut de l'onglet
Contrats (« + Contrat récurrent (enseignement) ») était trop discret et déconnecté du formulaire
de contrat normal. Décision 2 du lot précédent (formulaire séparé, `ContractFormRecurrent.tsx`)
reste valable — ce qui change, c'est seulement **où** on déclenche son ouverture : retiré de
`App.tsx` (bouton du haut, state `formRecurrentOuvert`), déplacé dans `ContractForm.tsx` sous
forme d'un encart CTA affiché dès que `type === "enseignement"` est sélectionné, avant les champs
Employeur/Date — pour intercepter l'utilisateur avant qu'il ne remplisse le mauvais formulaire.
Bouton du haut purement retiré (pas gardé en complément) : deux entrées pour la même action,
dont une seule a du sens contextuellement, c'était du bruit. Contrainte technique respectée :
`ContractFormRecurrent.tsx` garde son propre `<form>` (ne peut pas s'imbriquer dans celui de
`ContractForm.tsx`, HTML invalide) — bascule entre deux rendus complets via un state local
`formRecurrentOuvert` dans `ContractForm.tsx`, pas un accordéon. Nouveau prop
`onValiderRecurrent` sur `ContractForm.tsx`, **optionnel** : `ImportBulletins.tsx` et
`Simulateur.tsx` réutilisent `ContractForm.tsx` sans ce prop (relecture d'un import PDF déjà
extrait / simulation temporaire non persistée — le récurrent n'a de sens dans aucun des deux),
donc n'affichent jamais ce CTA — vérifié dans le navigateur dans les deux cas. 100 tests verts
(inchangé, aucune nouvelle logique pure), `tsc -b` propre. Vérifié dans le navigateur : CTA visible
au choix "Enseignement", bascule + retour via "Annuler" sans perte d'état, absence du CTA dans
Import PDF et Simulateur. Détail complet : `CLAUDE.md` « État actuel ».

## Fait (contrats à venir persistés, graphique 3 segments)

Item 1 du backlog (SPEC §11.B) traité. Investigation d'abord (pas de code avant validation du
plan) : un contrat déjà signé daté dans le futur était déjà possible et déjà compté dans
`decompte`/`SR`/`NHT` (fenêtre complète), mais totalement ignoré par `prediction.ts` — d'où un
« 0 / 507 h » au héros à côté d'une répartition qui comptait déjà ces heures, incohérence
préexistante découverte en creusant, pas introduite cette session. 2 décisions tranchées par
l'utilisateur avant de coder : (1) le niveau Sécurité/Alerte/Bloqué doit intégrer les heures
certaines à venir, pas seulement le rythme passé ; (2) indice visuel léger dans `ContractForm.tsx`
quand la date saisie est future. Aucun champ nouveau sur `Contrat` : « à venir » se déduit
uniquement de `contrat.date > dateDuJour`, jamais stocké — zéro impact export/import JSON.
`StatutPrediction` gagne `heuresCertainesAVenir` et `heuresRestantesApresCertain`.

**Deux bugs trouvés en vérifiant dans le navigateur avec de vraies données** (le contrat récurrent
enseignement du lot précédent, dernier mois pile sur la date anniversaire) : (1) faire reposer le
dénominateur temps de `rythmeRequis`/`dateFranchissementProjetee` sur la fin du segment certain
plutôt que sur le vrai calendrier restant (`joursRestants`) faisait tomber à tort en « délai trop
court » alors que l'échéance réelle était encore à 161 jours — corrigé en gardant `joursRestants`
comme dénominateur, seul le numérateur (heures) tient compte du certain. (2) une fois corrigé,
l'alerte « rythme_insuffisant » disait encore « il manque 507 h » à côté d'un « vise 90 h/mois »
déjà basé sur l'écart net (483 h) — deux chiffres contradictoires dans la même phrase ;
`alertes.ts` et `construireMessage` lisent désormais `heuresRestantesApresCertain` de façon
cohérente. `ProjectionChart.tsx` : segment teal « confirmé à venir » (marqueurs par contrat,
légende textuelle obligatoire), pointillé qui repart de `dateCap` comme avant (jamais de la fin du
segment certain, pour ne jamais risquer une ligne dessinée à l'envers). `ContractForm.tsx` :
indice sous le champ date si future, masqué dans `Simulateur.tsx` (contrat jamais persisté,
l'indice y serait littéralement faux). 15 tests ajoutés, 108 tests verts au total, `tsc -b`
propre. `engine/decompteHeures.ts`, `salaireReference.ts`, `areBrute.ts`, `areNette.ts`,
`periodeReference.ts`, `cycles.ts` intouchés. Vérifié dans le navigateur : graphique 3 segments
avec les vraies données de contrat récurrent, cohérence des messages rétablie, contrat passé
ajouté en plus → bascule correcte en Sécurité, aucune régression du cas sans contrat à venir.
Détail complet : `CLAUDE.md` « État actuel ».

## Fait (dette mineure : commentaires "À propos" → "Mon profil")

Les deux derniers commentaires de code (pas de texte utilisateur) qui mentionnaient encore
« À propos » — `src/config/contact.ts:5` et `src/lib/profilHorsPerimetre.ts:6` — sont corrigés.
`tsc -b` propre, aucun fichier `engine/` touché, aucun test nécessaire (changement de commentaire
uniquement). Commit dédié séparé du lot PWA qui suit, comme demandé.

## Fait (PWA installable)

Dernier item §11.A du SPEC traité. Investigation d'abord (rien touché avant validation du plan) :
un `public/manifest.webmanifest` existait déjà (lié dans `index.html`, `background_color`/
`display`/`start_url` déjà corrects) mais avec `icons: []` vide (bloquant pour l'installabilité) et
`theme_color` pas encore corrigé ; aucun service worker ; aucune icône ni favicon nulle part.
3 décisions tranchées par l'utilisateur avant de coder : (1) mise à jour du service worker
automatique (`registerType: "autoUpdate"` + `skipWaiting`/`clientsClaim`), pas de bandeau de
confirmation — pertinent ici : un correctif de calcul doit atteindre l'utilisateur vite, pas
rester bloqué derrière un cache périmé (devoir n°2) ; (2) `name: "Cadence · Suivi intermittent"`,
`short_name: "Cadence"` ; (3) `<meta name="theme-color">` de `index.html` reste sombre (#0A0C10),
seul le `theme_color` du **manifest** passe au mint (#3FD69B) — les deux valeurs ont un rôle
différent (navigation web normale vs écran de démarrage une fois l'app installée), volontairement
découplées.

**Obstacle d'environnement rencontré et contourné proprement** : la voie recommandée
(`@vite-pwa/assets-generator`, qui dépend de `sharp`) est inutilisable sur cette machine — `sharp`
n'a aucun binaire natif pour win32-arm64, et son repli WASM plante sous Node 24
(`TypeError` dans `libvipsVersion`, y compris après plusieurs tentatives de réinstallation ciblée).
Plutôt que de s'acharner sur une dépendance native/WASM fragile, `scripts/generate-pwa-icons.mjs`
rastérise le motif à la main (carré arrondi + dégradé mint→teal, identique au logo de `TopBar.tsx`)
avec seulement `zlib`/`fs` de Node — zéro dépendance externe, reproductible sur n'importe quelle
plateforme (`npm run generate-pwa-icons`). `@vite-pwa/assets-generator` et son `sharp` cassé ont
été désinstallés après usage ; seul `vite-plugin-pwa` (aucune dépendance native) reste en
devDependency permanente. `public/manifest.webmanifest` écrit à la main supprimé : le manifest vit
désormais uniquement dans `vite.config.ts` (même logique que `franceTravailConfig.ts`, une seule
source de vérité). Bug mineur trouvé en vérifiant : le plugin met `lang: "en"` par défaut,
corrigé en `"fr"` (toute l'app est en français). `tsc -b` propre, 108 tests verts (aucune logique
moteur touchée). **Vérifié dans le navigateur avec une preuve forte, pas une simulation** : après
`npm run build` + `npm run preview`, manifest et service worker actif confirmés, contenu du cache
confirmé complet — puis le **processus du serveur a été tué** (pas juste "Offline" dans les
DevTools) et la page rechargée : l'app s'affiche intégralement, aucune erreur console. **Limite
actée** : l'installation sur un vrai téléphone n'a pas pu être testée depuis cet environnement —
dépend du déploiement bêta (backlog, toujours en attente). Détail complet : `CLAUDE.md`
« État actuel ».

## Fait (module indemnisation mensuelle, V2 — 3 phases terminées, jours indemnisés)

Phase 1 (config, `ead0c4f`), Phase 2 (moteur + tests, `engine/indemnisationMensuelle.ts`), Phase 3
(composant `RevenusMensuels.tsx`, nouvel onglet) — terminées pour le périmètre "jours réellement
indemnisés mois par mois". Détail complet dans « État actuel » de `CLAUDE.md`. L'investigation
ci-dessous est conservée comme historique (trouvailles, sources, décisions prises).

**Bilan à ce stade (2026-07-23, fin de session)** : chantier « indemnisation mensuelle » terminé
sauf un point précis — la répartition mensuelle de la franchise salaires (formule du TOTAL déjà
implémentée et certifiée, cf. section dédiée plus bas, mais **pas câblée** dans
`calculerMoisIndemnisation`, qui continue de renvoyer honnêtement `franchise_salaires_non_certifiee`
— aucun faux chiffre affiché en attendant). Plafond de cumul PMSS : pas encore abordé, hors
périmètre de cette session. **Prochaine session : reprendre directement le câblage mensuel de la
franchise salaires** (cf. "Chantier suivant, pas commencé" en fin de section dédiée ci-dessous),
pas repartir de zéro.

## Fait (2026-07-23 : SMIC mensuel/journalier certifiés, franchise CP corrigée)

**SMIC** : `smicMensuelBrut`/`smicMensuelBrutHistorique` renseignés (✅, arrêté du 22 mai 2026 —
1823,03 € au 01/01/2026 → 1867,02 € au 01/06/2026, mêmes sources que `smicHoraireBrut`).
`smicJournalierBrut`/`smicJournalierBrutHistorique` dérivés de `smicHoraireBrut × 7` mais marqués
🔶 **non certifiés** (à confirmer depuis une source officielle) — distincts de
`cotisations.plancherEcretementJournalier` (62 €, déjà validé pour le CSG/CRDS, cf.
`docs/validation.md`), les deux "SMIC journalier" ont potentiellement des usages différents.

**Franchise CP, bug trouvé et corrigé** : la conclusion de Phase 1 ("pas de plafond mensuel
constaté sur les relevés réels", `forfaitMensuelBas`/`Haut` commentés) était **fausse**. En
creusant plus loin sur la répartition officielle (flyer France Travail confirmé), le 4j consommé
en février 2026 s'explique entièrement par le report du forfait de janvier (2j non consommés,
absorbés par le délai d'attente ce mois-là) + le forfait de février (2j) = 4j — pas par l'absence
de plafond. `forfaitMensuelBas`/`Haut` réactivés + nouveau `seuilFranchiseTotaleJours: 24` (le
seuil de palier n'existait qu'en commentaire avant, jamais en valeur de config exploitable).
`SoldeIndemnisation.quotaCPCarryOver` (obligatoire, moteur) / `SoldeIndemnisationDepart.quotaCPCarryOver`
(optionnel, défaut 0) modélisent le report d'un mois sur l'autre. Les 4 mois certifiés
(fév=0/mars=17/avril=18/mai=29) restent identiques avec `quotaCPCarryOver: 2` en entrée — seul le
mécanisme interne change, pas le résultat sur ce cas précis (vérifié aussi en navigateur sur un
solde existant configuré AVANT ce champ : défaut à 0, résultat plus conservateur qu'avant, à
raison). `RevenusMensuels.tsx` : 3e champ ajouté à l'écran de configuration du solde de départ,
avec aide contextuelle pédagogique (« si le mois précédent était un mois blanc, mets 2 »).
**Limite connue, non résolue** : le palier bas/haut (2j vs 3j) se base sur `franchiseCPRestante`
courante faute de suivre le total ORIGINAL accordé à l'ouverture des droits — un profil dont le
total dépasse 24j pourrait à tort redescendre au palier bas une fois consommé sous ce seuil ; non
observable sur les cas certifiés actuels (restante ≤ 5j du début à la fin). 120 tests verts,
`tsc -b` propre.

## Fait (2026-07-23 : franchise salaires — formule certifiée implémentée, TOTAL seul)

Formule certifiée par l'utilisateur (sources ARTCENA + flyer officiel France Travail) :
`arrondi( (SR_total / SMIC_mensuel) × (SJM / (3 × SMIC_journalier)) − 27 )`, jamais négative (0 si
résultat ≤ 0). `engine/indemnisationMensuelle.ts` : `calculerFranchiseSalaires(srContrats, sjm,
profil, config)`.

**Règles appliquées** :
- SMIC (mensuel + journalier) lu à la date de fin de PRA = `profil.dateAnniversaire`, via
  `smicMensuelBrutHistorique`/`smicJournalierBrutHistorique` (recherche de la valeur historique la
  plus récente ≤ la date cible) — jamais la valeur courante.
- SR_total = SR des contrats Annexe 10 (`sr`, déjà calculé ailleurs dans le moteur) +
  `Profil.salairesHorsAnnexe10PRA` (nouveau champ optionnel, `number | null`). Absent → SR_total =
  A10 seul, `FranchiseSalairesResultat.sousEstimeeHorsA10 = true` (avertissement non bloquant, pas
  un chiffre deviné).
- `Profil.dureeDroitsMois?: 12 | 6` ajouté (12 = standard, 6 = clause de rattrapage) — connue à
  l'ouverture des droits, **lue depuis le profil**, jamais déduite de l'historique d'activité.
  Servira à la répartition mensuelle (`min(dureeDroitsMois, repartitionMoisMax)` mois), **pas
  encore utilisée** dans le calcul du TOTAL lui-même (qui n'en a pas besoin).
- TODO explicite dans le code (Option A actée par l'utilisateur) : *"SR_total devrait inclure tous
  salaires PRA non plafonnés y compris hors A10 — champ `salairesHorsAnnexe10PRA` prévu mais
  optionnel en bêta. Vérifier sur un relevé réel avec franchise salaires > 0 avant de retirer cet
  avertissement."* `FranchiseSalairesResultat.totalNonVerifie` est **toujours `true`** pour
  l'instant : le TOTAL n'a jamais été confronté à un relevé réel montrant une franchise salaires
  active (seule la répartition mensuelle officielle a des exemples chiffrés dans le flyer, pas le
  calcul du total lui-même).

6 tests dédiés (`indemnisationMensuelle.test.ts`), 126 tests verts au total, `tsc -b` propre.

**Chantier suivant, pas commencé — reprendre directement à la prochaine session** :
1. **Câbler la répartition mensuelle** dans `calculerMoisIndemnisation`/`calculerSerieIndemnisation` :
   `forfait mensuel = ceil(total / min(dureeDroitsMois, repartitionMoisMax))`, non-consommé
   reporté au mois suivant — même mécanique que `quotaCPCarryOver`/`forfaitMensuelCP` pour la
   franchise CP (report + plafond mensuel), mais avec un total ET un dénominateur de répartition
   différents. Implique très probablement un nouveau couple d'état dans `SoldeIndemnisation`/
   `SoldeIndemnisationDepart` (ex. `franchiseSalairesRestante` + `quotaSalairesCarryOver`), sur le
   modèle de `franchiseCPRestante`/`quotaCPCarryOver`.
2. **Décider comment le solde de départ de franchise salaires est saisi** : valeur déjà connue
   (lue sur le relevé, comme `franchiseCPRestante`) plutôt que recalculée depuis SR_total à chaque
   fois ? Ou le TOTAL calculé une fois par `calculerFranchiseSalaires` sert-il de point de départ
   la première fois, puis le restant est suivi comme un solde classique ensuite ? Pas tranché.
3. **UI à ajouter** : aucun écran ne permet encore de saisir `Profil.dureeDroitsMois` ni
   `Profil.salairesHorsAnnexe10PRA` (probablement dans `MonProfil.tsx`, à côté des autres champs de
   profil) — ces deux champs sont pour l'instant uniquement accessibles via import JSON manuel.
4. Une fois câblé : rejouer les 4 mois certifiés (aucune franchise salaires active dans ces
   données, donc pas de régression attendue) + chercher un cas réel avec franchise salaires > 0
   pour lever le TODO `totalNonVerifie`.

## Fait (2026-07-24 : correctif AJ réelle committé, vérification PE en direct, PDF officiel lu en entier)

**Correctif AJ réelle (`f6cb937`, committé)** : bug remonté par l'utilisateur — les montants de
« Revenus mensuels » utilisaient l'AJ **prévisionnelle** (recalculée en direct depuis
`calculerAJBrutePourFenetre`/`calculerAJNette` sur les contrats actuels), pas l'AJ **réelle**
notifiée par France Travail (fixée à l'ouverture des droits, stable toute la période). Faux
chiffre pour un utilisateur déjà en cours d'indemnisation. `SoldeIndemnisationDepart.ajReelle:
number | null` ajouté (même pattern que `quotaCPCarryOver` — un champ, une valeur lue sur le
document officiel, saisie une fois, défaut `null` rétro-compatible). Prioritaire sur l'AJ estimée
quand renseignée ; avertissement visible sinon. Libellés (colonne « AJ relevé », légendes)
corrigés en cours de route : l'AJ du relevé est **déjà nette** (après retraite complémentaire),
pas brute — j'avais mal qualifié ça au premier jet, corrigé avant de committer. 127 tests verts.

**Vérification en direct sur `simucalcul.pole-emploi-services.fr` (23/07/2026)** : rejoué le cas
fictif #2 déjà validé (A10, 710 h, SR 14 579 €, pas Alsace-Moselle) — le simulateur donne
aujourd'hui exactement les mêmes chiffres que `docs/validation.md` (A+B+C 65,59 €, retraite compl.
1,91 €, CSG/CRDS 1,68 €, **net 62,00 €**). Rien n'a changé côté France Travail. Tests
`areBrute.test.ts`/`areNette.test.ts` relancés en même temps (18 tests verts) pour confirmer que
c'est bien le code de Cadence, pas juste la règle documentée, qui reproduit ce résultat aujourd'hui.

**PDF officiel `GUIDE-INTERMITTENT.pdf` lu en entier (28 pages, fourni par l'utilisateur le
2026-07-24)** — remplace l'ancienne extraction image (non fiable à 100 %) par le texte réel :
- **Page 14 confirme mot pour mot** la formule franchise salaires déjà implémentée :
  `[Salaires de la période de référence / SMIC mensuel] × [SJM / (3 × SMIC journalier)] − 27 jours`,
  et confirme texto « SMIC mensuel et SMIC journalier : valeurs à la date de fin de la période de
  référence » (= `profil.dateAnniversaire`, déjà notre mécanisme) et « Salaires de la période de
  référence : total de vos rémunérations brutes non plafonnées sur la période visée, **quel que
  soit le régime de l'activité** » (confirme `salairesHorsAnnexe10PRA`). La réserve
  `totalNonVerifie` du code peut donc être reformulée : la **formule** est maintenant confirmée à
  100 % depuis le texte source (plus une histoire d'extraction d'image incertaine) — seule
  l'absence d'un **cas chiffré réel** avec franchise salaires active reste la réserve valable.
- **Page 16-17 (« Quelle indemnisation mensuelle ? »)** décrit exactement le mécanisme déjà codé
  dans `calculerMoisIndemnisation` (seuil de non-indemnisation 27j pour l'A10, jours de travail ×
  1,3, ordre de déduction délai → franchise CP → franchise salaires). Vérifié à la main que le
  « seuil de non-indemnisation » (27j, table page 16) est **mathématiquement impliqué** par la
  formule `jours_travail × 1,3` déjà codée (27×1,3=35,1, toujours > à un mois de 28-31j) — pas
  besoin d'un garde-fou séparé, confirmé, pas juste supposé.
- **Un `27` en dur trouvé dans le code** : `calculerFranchiseSalaires` soustrait `27` codé en dur
  dans la formule, alors que cette même valeur existe déjà comme constante nommée
  (`config.indemnisationMensuelle.seuilNonIndemnisationJours`). Contredit la règle d'or "aucune
  valeur réglementaire en dur dans le moteur" — deux occurrences du même nombre non reliées, risque
  de divergence silencieuse si l'une change sans l'autre un jour.

**Correctif appliqué (2026-07-24), validé par l'utilisateur avant d'agir** :
1. `27` en dur dans `calculerFranchiseSalaires` remplacé par
   `config.indemnisationMensuelle.seuilNonIndemnisationJours` (`engine/indemnisationMensuelle.ts`).
2. Commentaire JSDoc de la fonction et TODO associé réécrits : la formule est confirmée mot pour
   mot depuis le texte du PDF officiel (page 14, plus "à confirmer depuis une source officielle"),
   seule l'absence de cas chiffré réel reste la réserve (`totalNonVerifie`).

127 tests verts (inchangé, aucune logique modifiée — seule la source de la constante change),
`tsc -b` propre. Committé (`16cd13b`).

## Fait (2026-07-24 : chantier ajReelleHistorique — plusieurs taux d'AJ réelle successifs)

Chantier demandé juste après le correctif ci-dessus, en 7 étapes ordonnées, chacune testée
(`npm run test` + `tsc -b`) et committée séparément.

**Étape 0 (`1f28ce1`)** : libellés du champ AJ réelle dans `RevenusMensuels.tsx` — en-tête de
colonne et légende du tableau étaient déjà corrects mot pour mot ; seul le tooltip du champ de
saisie manquait le mot « nette » et contenait une phrase résiduelle avec une valeur personnelle
codée en dur (« Pour toi : 55,02 € depuis le 18/01/2026 ») — retirée.

**Étape 1 (`a015849` + correctif `60fbaa7`)** : `RevenusMensuels.tsx` affiche désormais un encart
neutre (« La simulation mensuelle sera disponible une fois tes droits ouverts... ») à la place du
tableau quand `profil.situation === "premiere_admission"` — ce module n'a aucun sens avant
l'ouverture des droits. Premier jet référençait un « onglet Projection » qui n'existe pas
(corrigé en « onglet Tableau de bord », les tabs sont Tableau de bord/Mon profil/Contrats/Import
PDF/Historique/Simulateur/Revenus mensuels).

**Étape 2 (A à E, `ecd8406`/`e3e43cc`/`6047fc6`/`8203d85`/`e97ef39`)** : `SoldeIndemnisationDepart.
ajReelle: number | null` remplacé par `ajReelleHistorique: {dateEffet, valeur}[]` — un utilisateur
peut connaître plusieurs taux successifs sur une même période d'indemnisation (ex. 54,55 €
jusqu'au 17/01/2026 puis 55,02 € à partir du 18/01/2026). **Décision actée avec l'utilisateur** :
le champ reste sur `SoldeIndemnisationDepart` (pas déplacé vers `Profil`, malgré le pseudo-code
initial qui écrivait `profil.ajReelleHistorique`) — `SoldeIndemnisationDepart` est déjà le point de
configuration de la simulation mensuelle, l'AJ réelle en est une entrée comme les autres ; un
déplacement vers `Profil` aurait fait passer ce champ par les 3 portes de cohérence
(`lib/coherenceProfil.ts`) sans bénéfice fonctionnel, risque de régression pour la bêta.
- **A** : type mis à jour, JSDoc explicite sur le fait que c'est indépendant de la date du solde de
  départ.
- **B** : `engine/ajReelleUtils.ts` (`getAjReelleAt`) — recherche la valeur dont la `dateEffet` est
  la plus récente ≤ la date cible, `null` si aucune ou tableau vide/absent. 5 tests dédiés.
- **C** : nouveau type discriminé `MontantMensuelResultat` (même famille que
  `FranchiseSalairesResultat`) + champ `MoisIndemnisationResultat.montantMensuel`. Calculé
  uniquement dans `calculerSerieDepuisDeclarations` (pas dans `calculerMoisIndemnisation`/
  `calculerSerieIndemnisation`, dont le `moisLabel` reste **purement informatif**, jamais une vraie
  date, cf. commentaire existant sur `MoisIndemnisationEntree` — les préserver inchangés évite de
  casser cette invariante). 4 tests dédiés.
- **D** : `RevenusMensuels.tsx` — nouveau bloc « Allocation journalière réelle » (éditeur de
  périodes : date d'effet/AJ nette/suppression/tri/placeholder), réutilise `onConfigurerSolde`
  existant (déjà générique). `TableauResultats` : tableau des montants mensuels remplacé par un
  encart ambre si `ajReelleHistorique` est vide (plus de repli sur une AJ estimée — devoir n°2,
  Cadence ne peut pas recalculer l'AJ réelle d'une réadmission déjà ouverte) ; par mois,
  `montantMensuel.calculable === false` affiche `—` plutôt qu'un chiffre deviné. Prop
  `ajNetteParJour` retirée (plus utilisée nulle part).
- **E** : Zod (`localStorageAdapter.ts`) — `ajReelleHistorique: [...].default([])` +
  `migrerAjReelleHistorique()`, migration silencieuse appliquée aux deux chemins de lecture
  (`chargerDonnees` ET `importerJSON`, via un helper `parserDonnees` partagé) : un ancien champ
  `ajReelle` (nombre) devient une entrée unique à une date arbitrairement ancienne (2000-01-01),
  `ajReelle: null` ne produit aucune entrée. 3 tests dédiés.

136 tests verts au total, `tsc -b` propre à chaque commit. **Vérifié dans le navigateur** à
plusieurs étapes : ajout/suppression d'une période AJ, bascule encart ambre ↔ tableau, montant
exact sur le cas certifié mars 2026 (935,34 € = 17 j × 55,02 €), migration silencieuse d'un solde
seedé avec l'ancien champ `ajReelle` confirmée après rechargement.

**Incident signalé en cours de vérification (sans conséquence sur les vraies données)** : perte
accidentelle des données de test du navigateur de prévisualisation — une variable JS tenant la
sauvegarde (`window.__cadenceBackup`) a été détruite par un `navigate()` intermédiaire avant d'être
utilisée pour restaurer, écrivant la chaîne littérale `"undefined"` dans le `localStorage` de ce
navigateur de dev isolé. Signalé immédiatement à l'utilisateur plutôt que corrigé silencieusement ;
jeu de données de test reconstitué à partir des cas certifiés de ce document (situation
réadmission, solde de départ, déclarations fév-mai 2026) + contrats inventés minimaux.

**Demande initiale** : ajouter un module `engine/indemnisationMensuelle.ts` (montant ARE réellement
versé mois par mois, pas juste l'AJ théorique) + composant `RevenusMensuels.tsx`. L'utilisateur a
fourni des valeurs SMIC/PMSS « certifiées sur relevés réels » et une formule de franchise salaires,
avec un plan complet en 4 phases (config → moteur+tests → composant), et demandé de résoudre un
écart avant de coder : un cas de test (mars 2026) donnait 13 AJ calculées contre 17 AJ sur le vrai
relevé.

**Investigation faite (réponses aux 2 questions posées)** :
1. `engine/indemnisationMensuelle.ts` n'existe pas encore. Fichiers actuels : `alertes.ts`,
   `areBrute.ts`, `areNette.ts`, `cycles.ts`, `dateUtils.ts`, `decompteHeures.ts`,
   `periodeReference.ts`, `prediction.ts`, `salaireReference.ts`.
2. `valeursDatees.smicHoraireBrut` déjà renseigné (12,31, un seul nombre) ; `smicMensuelBrut`,
   `smicJournalierBrut`, `pmssMensuel` toujours `null`.

**Trouvailles importantes, toutes à revalider au démarrage de la prochaine conversation** :

- **Conflit structurel Phase 1** : `areBrute.ts:68` lit `config.valeursDatees.smicHoraireBrut`
  comme un **nombre simple** (réadmission allongée, `params.nh * params.smicHoraireBrut`, déjà
  testé dans `areBrute.test.ts`). Le remplacer par un tableau daté `{dateEffet, valeur}[]` (proposé
  en Phase 1) casserait ce calcul silencieusement (`NaN`) — incompatible avec la contrainte
  « zéro modification dans `areBrute.ts` ». **Réconciliation proposée, pas encore validée par
  l'utilisateur** : garder `smicHoraireBrut: number | null` inchangé (valeur courante, ce
  qu'`areBrute.ts` attend) + ajouter un champ séparé `smicHoraireBrutHistorique:
  {dateEffet, valeur}[]` réservé au nouveau module.
- **Valeurs SMIC/PMSS vérifiées par recherche web, confirmées exactes** (Légifrance, info.gouv.fr) :
  SMIC horaire 12,02 €(01/01/2026)→12,31 €(01/06/2026), mensuel 1823,03 €→1867,02 €, PMSS 4005 €
  (arrêté 22/12/2025). Ces trois-là peuvent passer ✅ sans réserve.
- **Guide officiel France Travail retrouvé et lu directement** (`GUIDE-INTERMITTENT.pdf`,
  francetravail.fr — même source déjà citée dans `franceTravailConfig.ts`), pages 12 à 17. Confirme
  mot pour mot l'ordre de consommation (jours non indemnisables → délai d'attente → franchise CP →
  franchise salaires, chacune seulement sur le reliquat des précédentes, avec report du forfait non
  utilisé au mois suivant) — l'algorithme de la Fonction 3 proposée est donc **validé par la
  source**, pas à réinventer.
- **Cas Mars très probablement résolu** : avec 10 jours travaillés (pas 13, vraisemblablement une
  erreur de transcription/calcul heures÷10), l'algorithme confirmé donne exactement 17 AJ
  (`31 − ceil(10×1.3) − 1 franchise CP = 31 − 13 − 1 = 17`) — collision parfaite avec le relevé.
- **Nouvel écart trouvé, PAS résolu** : la transition février→mars du profil donné (franchise CP
  4j→1j en un seul mois) est mathématiquement impossible avec le forfait confirmé de 2j/mois
  (total ≤ 24j) — une chute de 3j en un mois demanderait un forfait de 3j/mois, donc un total
  initial > 24j, différent des 5j annoncés. Il manque soit les chiffres réels de janvier (mois
  d'avant, jamais donné), soit une correction des valeurs de résiduel de fév/mars.
  → **Résolu (2026-07-23), voir section ci-dessous** : il n'y a pas de forfait mensuel plafonné,
  la franchise CP se consomme intégralement selon la place disponible chaque mois.
- **Alerte sérieuse sur la formule franchise salaires** : le guide (p.14) montre une formule à
  **4 variables** — `arrondi( (SR / SMIC_mensuel) × (SJM / (3 × SMIC_journalier)) − 27 )` — alors
  que la formule proposée par l'utilisateur (`floor(SR / (3 × SJM) − 27)`) n'utilise que SR et SJM,
  sans aucun terme SMIC. L'exemple « certifié par élimination » donné (résultat 0) ne permet PAS de
  distinguer les deux formules : les deux donnent 0 sur ce cas (résultat très négatif dans les deux
  cas). Recommandation : utiliser la formule du guide, mais l'extraction du PDF (texte depuis une
  image de formule) n'est pas fiable à 100 % pour l'agencement exact des deux fractions — à
  relire directement sur le PDF avant de la coder comme ✅.
  → **Résolu (2026-07-23)** : pas de formule implémentée pour l'instant, voir ci-dessous.

**Réponses reçues de l'utilisateur (2026-07-23), à partir de relevés France Travail réels
« certifiés »** :

1. **Convention de saisie confirmée** : l'utilisateur saisit les **jours déclarés bruts** ; le
   moteur calcule seul `joursNonIndemnisables = ceil(joursDéclarés × 1.3)` — colonne "non indem.
   travail" du relevé. Confirmé sur 3 mois indépendants : mars (10j déclarés → ceil(13)=13 ✓),
   avril (9j → ceil(11.7)=12 ✓), mai (1j → ceil(1.3)=2 ✓).
2. **Cas de test février corrigé** : les jours déclarés réels sont **14** (pas 19 — 19 est la
   valeur déjà calculée `ceil(14×1.3)=19`, une confusion valeur-brute / valeur-calculée dans le
   lot de données précédent, pas un vrai écart).
3. **Franchise CP : pas de plafond mensuel forfaitaire.** Contrairement à la lecture initiale du
   guide (`forfaitMensuelBas: 2` / `forfaitMensuelHaut: 3` dans `franceTravailConfig.ts`, qui
   suggérait un quota consommé par mois), les relevés réels montrent une consommation **sans
   plafond mensuel** : `franchiseCPConsommée = min(franchiseCPRestante, joursDisponiblesAprèsDifféré)`
   — on consomme tout ce qui reste de franchise CP tant qu'il y a de la place dans le mois après
   jours non indemnisables + délai d'attente. Confirmé : février consomme 4j (tout ce qu'il
   restait), mars consomme 1j (le reste, franchise épuisée ensuite). **Résout l'écart précédent**
   sans qu'il manque de données : le "forfait mensuel" du config ne gouverne pas le rythme de
   consommation constaté sur ces relevés — `franceTravailConfig.ts` (`forfaitMensuelBas/Haut`) est
   probablement soit un plafond différent (pas encore identifié), soit à ignorer pour cette
   fonction — **à trancher explicitement dans le plan**, pas à coder tel quel sans vérifier son
   usage réel.
4. **Franchise salaires : pas de calcul pour l'instant.** Aucun relevé fourni ne montre de
   franchise salaires active. Décision : retourner systématiquement
   `{ valeur: null, avertissement: "franchise_salaires_non_certifiee" }` plutôt que d'implémenter
   une formule non vérifiée à 100 % sur la source (devoir n°2 : jamais un chiffre faux). Referme
   la question de la page 14 sans qu'il soit nécessaire de trancher l'agencement exact des deux
   fractions maintenant — **à rouvrir explicitement le jour où un relevé réel montre une franchise
   salaires active**.
5. **`smicHoraireBrut` : réconciliation validée** — champ courant `smicHoraireBrut: 12.31`
   inchangé, nouveau champ séparé `smicHoraireBrutHistorique` à côté. **Zéro modification dans
   `areBrute.ts`.**

**Cas de tests fournis (jours déclarés bruts, valeurs certifiées sur relevés réels)** :

| Mois | Jours mois | Jours déclarés | Non indem. (`ceil(×1.3)`) | Différé | Franchise CP consommée | AJ payées |
|------|-----------|----------------|---------------------------|---------|-------------------------|-----------|
| Février 2026 | 28 | 14 | 19 | 5 | 4 (tout le restant) | 0 |
| Mars 2026 | 31 | 10 | 13 | 0 | 1 (le reste, franchise épuisée) | 17 |
| Avril 2026 | 30 | 9 | 12 | 0 | 0 (franchise épuisée) | 18 |
| Mai 2026 | 31 | 1 | 2 | 0 | 0 (franchise épuisée) | 29 |

Vérification arithmétique faite (mois − non indem − différé − CP = AJ) : les 4 lignes bouclent
exactement. ✅

**Donnée contextuelle fournie, PAS un cas de test standard** : réadmission le 18/01/2026 (AJ passe
de 54,55 €/SJR 133,53 € à 55,02 €/SJR 129,99 €). Janvier 2026 (31j, 18j non indem. « régularisé »,
0 franchise, 0 différé → 13 AJ) est explicitement qualifié de **régularisé** par l'utilisateur —
pas un mois qui suit l'algorithme standard (transition de droits en cours de mois), donc **à ne
pas utiliser comme cas de test de l'algorithme normal**.

**Point resté ouvert, pas encore posé à l'utilisateur avant cette session** : le tableau ci-dessus
donne « différé 5j » pour février mais 0 pour janvier, alors que le délai d'attente réglementaire
est de 7j (une fois par période de 12 mois). Si le délai se consomme progressivement comme la
franchise CP (report du reliquat au mois suivant, cf. guide p.12-17), il manque 2j quelque part
entre le 18/01 et le début février — probablement absorbés dans la « régularisation » de janvier,
cohérent avec le fait que janvier n'est justement pas un mois standard. **Conséquence pour le
plan** : le module doit-il (a) reconstruire tout l'historique depuis la réadmission pour calculer
lui-même les soldes de délai/franchise CP à une date donnée, ou (b) partir d'un solde d'ouverture
donné (délai restant, franchise CP restante) à une date de départ choisie, sans chercher à
reconstruire les mois antérieurs irréguliers ? Le jeu de données fourni (Fév-Mai) suggère (b) —
février démarre déjà avec délai=5 restant, pas 7 — **à confirmer avec l'utilisateur avant d'écrire
le plan final**, cette décision change l'architecture du module.

**Sources consultées cette session** (à recréer si besoin) :
- SMIC : https://www.info.gouv.fr/actualite/le-smic-revalorise-le-1er-juin-2026
- PMSS : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143451
- Guide officiel complet : https://www.francetravail.fr/files/live/sites/PE/files/fichiers-en-telechargement/fichiers-en-telechargement---dem/GUIDE-INTERMITTENT.pdf

## Fait (2026-07-24 : chantier découpage mensuel des contrats — JNI depuis les vrais contrats)

**Origine à retenir, pas anodine** : ce chantier a démarré sur *trois points présentés comme
« actés en session précédente »* (découpage des contrats par mois civil, formule JNI
`ceil(heuresDuMois × 1,3 / 10)`, suppression de `joursDeclares`). Vérification faite avant tout
code : **aucun des trois ne correspondait au code réel**, et deux contredisaient directement des
décisions déjà prises et documentées ici (la convention « jours déclarés bruts » avait été validée
contre 3 relevés France Travail réels indépendants). Signalé explicitement plutôt que codé en
confiance — la suite a confirmé que la prudence était justifiée : la formule proposée
(`ceil`, en repassant par un `joursDeclares` recalculé) était fausse, mais l'idée sous-jacente
(calculer automatiquement depuis les contrats) était juste une fois la vraie formule retrouvée.

**Recherche de la vraie règle** : recherche web (voir sources ci-dessous) — pour l'Annexe 10, JNI
se calcule **directement depuis les heures du mois**, pas depuis un décompte de jours intermédiaire :
`floor(heures_du_mois × 1,3 / 10)` (floor, pas ceil — exemple du guide : « 60h → 7,8 → arrondi à 7 »).

**Validation empirique décisive, sur les vrais documents de l'utilisateur** (relevés de situation
France Travail + déclarations mensuelles d'activité fév/avril/mai 2026, un contrat GUSO réel) :
- Le contrat GUSO isolé (20-26/04, 7 jours travaillés déclarés, 6 cachets = 72h) a d'abord servi à
  falsifier la première formule testée (`ceil(heures/10)` en intermédiaire) : `ceil(72/10)=8 ≠ 7`
  jours réels — écart déjà présent sur un seul contrat, avant même le mois complet.
- La vraie formule (`floor(heures_totales_du_mois × 1,3 / 10)`), appliquée directement aux heures
  agrégées de chaque mois (déclarations mensuelles d'activité, cachet confirmé = 12h), matche
  **exactement** les 4 mois réels : fév 153h→19 JNI, mars 105h→13 JNI (confirmé par l'utilisateur
  après coup), avril 93h→12 JNI, mai 21h→2 JNI — zéro écart sur les 4 mois indépendants.

**Décision actée avant de coder** : le champ `dateDebut`/répartition par mois reste scopé au module
indemnisation mensuelle uniquement — `decompteHeures.ts` (décompte 507h, `docs/validation.md`) n'est
**pas** touché, ce chantier ne le nécessite pas et il s'agit d'un compteur volontairement distinct
(règle d'or « deux compteurs, jamais mélangés »). Le mois d'un contrat n'est plus assigné en bloc à
son mois de fin : `dateDebut` (nouveau champ obligatoire sur `Contrat`) permet de répartir heures et
salaire au prorata des jours calendaires quand un contrat chevauche deux mois civils.

**6 étapes, un commit par étape, diff montré avant chaque commit** :
- **A** (`edd1690`) — `Contrat.dateDebut: string` ajouté ; migration silencieuse à la lecture
  (`migrerContratsDateDebut`, repli sur `date` = contrat d'un seul jour) ; sites de construction mis
  à jour (`testUtils.ts`, `lib/contratRecurrent.ts`).
- **B** (`06aac77`) — `engine/decoupageMensuel.ts` (`repartirContratParMois`) : répartit heures et
  salaire au prorata des jours, réutilise `heuresBrutesContrat` (aucune logique dupliquée), dernier
  mois = reliquat exact (jamais de perte par arrondi). Pas de plafond mensuel appliqué (28
  cachets/mois = 336h) : aucun des 4 mois certifiés (max 153h) ne l'approche, rien ne confirme qu'il
  s'applique au calcul JNI — omission délibérée, documentée dans le code. 5 tests dédiés.
- **C** (`7b08069`) — `MoisIndemnisationEntree.joursDeclares` → `heuresDuMois` ; formule JNI
  corrigée (`floor`, pas `ceil`) ; `calculerSerieDepuisDeclarations` remplacée par
  `calculerSerieDepuisContrats` (agrège `repartirContratParMois` de tous les contrats par mois,
  plage = [mois du solde de départ .. dernier mois avec contrat OU aujourd'hui, le plus tardif] —
  un mois sans contrat obtient 0h, jamais une absence silencieuse). 20 tests, rejouent les 4 mois
  certifiés avec les vraies heures.
- **D** (`c842406`) — `DeclarationMensuelle` supprimée entièrement (types, storage, `App.tsx`,
  `RevenusMensuels.tsx`) : formulaire "Ajouter un mois" et badge "provisoire" retirés (n'ont plus de
  sens, la liste des mois est automatique) ; colonne "Jours déclarés" → "Heures travaillées"
  (nouveau champ passe-plat `MoisIndemnisationResultat.heuresDuMois`) ; un ancien export JSON avec
  `declarationsMensuelles` continue de s'importer sans erreur (Zod ignore les clés inconnues).
- **E** (`987152b`) — `ContractForm.tsx` : champ "Date de début" ajouté avant "Date de fin"
  (renommée), pré-rempli à la même date tant que non modifié explicitement, validation
  `dateDebut ≤ dateFin` (bouton désactivé + message sinon).
- **F** (`b315842`) — commentaire de la formule JNI complété avec les 4 mois validés (mars obtenu
  après coup) et la vraie source (vérification empirique, pas juste une règle citée).

145 tests verts au total, `tsc -b` propre à chaque étape. **Vérifié dans le navigateur** à l'étape D
avec 7 contrats réels (fév-mai 2026) : les 4 mois certifiés matchent exactement en bout en bout
(UI comprise, pas seulement les tests unitaires), extension automatique aux mois sans contrat
(juin/juillet, 0h, franchise épuisée) confirmée. Étape E vérifiée aussi : pré-remplissage,
divergence après édition, blocage de soumission sur date de début postérieure à la date de fin.

**Sources consultées pour la règle JNI** :
- https://www.fichou-avocat.fr/post/intermittent-du-spectacle-nombre-dheures
- https://www.francetravail.fr/files/live/sites/PE/files/fichiers-en-telechargement/fichiers-en-telechargement---dem/GUIDE-INTERMITTENT.pdf
- https://www.unedic.org/storage/uploads/2023/07/24/Dossier20de20synthC3A8se20Intermittents20du20spectacle_uid_64be8b31b1a34.pdf
- https://www.etreintermittent.com/comprendre-et-calculer-le-taux-dindemnisation-dun-intermittent-du-spectacle/

## Fait (2026-07-25 : chantier Profil.ouvertureDroits — simulation automatique depuis l'ouverture des droits)

**Point de départ, à retenir** : la proposition initiale de ce chantier (Question 2 d'un flux
simplifié « nouvelle indemnisation / déjà en cours ») contenait une formule auto-annulante
(`franchiseTotale = floor(moisÉcoulés × 2)` puis `restante = franchiseTotale − moisÉcoulés × 2`
≈ 0 toujours). Signalé avant tout code ; la vraie solution retenue est plus profonde qu'un correctif
de formule : au lieu d'estimer un solde à une date de relevé de mi-parcours, le moteur simule
désormais la consommation délai/franchise CP depuis la VRAIE date d'ouverture des droits.

**Modèle** : `Profil.ouvertureDroits: { dateOuverture, franchiseCPTotale, delaiAttenteInitial }` —
saisi une fois depuis la notification France Travail, jamais reconstruit. `ajReelleHistorique`
déplacé de `SoldeIndemnisationDepart` vers `Profil` (même raisonnement que `ouvertureDroits` : c'est
une caractéristique de l'ouverture de droits, pas du point de départ d'affichage).
`SoldeIndemnisationDepart` ne porte plus que `dateDepart` — un simple filtre d'affichage, l'état
interne (délai, franchise CP) est simulé automatiquement par `calculerSerieDepuisContrats` depuis
`ouvertureDroits.dateOuverture`, y compris pour les mois antérieurs à `dateDepart` (simulés mais
jamais montrés — nécessaire pour un état correct au premier mois affiché).

**Corrige au passage une limite connue** (cf. section « SMIC mensuel/journalier certifiés » plus
haut) : le palier du forfait mensuel de franchise CP (2j/3j) se décide désormais sur la franchise
TOTALE (`ouvertureDroits.franchiseCPTotale`, constante), pas sur le restant courant — évite qu'un
profil dont le total dépasse 24j ne redescende à tort au palier bas une fois consommé sous ce seuil.

**6 commits** :
- **A** (`101aacc`) — types : `Profil.ouvertureDroits` + `ajReelleHistorique` ajoutés ;
  `SoldeIndemnisationDepart` réduit à `{ dateDepart }`. `profilSchema` (lib/coherenceProfil.ts) mis
  à jour (seule définition partagée import/édition).
- **B** (`79bc714`) — moteur : `calculerSerieDepuisContrats` simule depuis `dateOuverture`,
  retourne `SerieIndemnisationResultat` (`calculable: false` si `ouvertureDroits` absent — aucun
  point de départ inventé). `calculerMoisIndemnisation`/`calculerSerieIndemnisation` gagnent un 4e
  paramètre optionnel `franchiseCPTotale` (défaut = comportement historique, préserve les tests bas
  niveau existants inchangés, décision actée avec l'utilisateur). `describe("calculerSerieDepuisContrats")`
  réécrit avec des données synthétiques (pas les vraies données, indisponibles depuis mars 2025).
- **C** (`d98664c`) — UI : section « Mon indemnisation en cours » dans `MonProfil.tsx` (3 champs
  guidés + éditeur de périodes AJ déplacé depuis `RevenusMensuels.tsx`).
- **D-storage** (`431d42f`) — Zod + 2 nouvelles migrations silencieuses (`ajReelleHistorique`
  solde→profil, solde trimmé vers `{ dateDepart }` — aucune reconstruction d'`ouvertureDroits`
  possible depuis les anciennes valeurs, devoir n°2).
- **D+E** (`867b895`) — `RevenusMensuels.tsx` : formulaire de configuration réduit à un seul champ
  (`dateDepart`) ; garde-fou `ouvertureDroits` absent (encart ambre + lien direct vers « Mon
  profil »).

146 tests verts, `tsc -b` propre à chaque étape. **Vérifié dans le navigateur de bout en bout** :
gate `ouvertureDroits` absent + navigation vers le profil, saisie complète, tableau résultant —
mois antérieur à `dateDepart` simulé mais masqué, 6 mois suivants vérifiés au centime près à la
main (délai, franchise CP, montants).

## Fait (2026-07-25 : bouton « Modifier » pour `dateDepart`, Revenus mensuels)

Bug UX trouvé en creusant un signalement utilisateur (« il ne lit pas les contrats », voir
investigation ci-dessous) : une fois `SoldeIndemnisationDepart.dateDepart` saisi une première fois,
**rien dans l'UI ne permettait de le changer** — seul un nouvel export/import JSON manuel l'aurait
permis. `SoldeRecap` (`RevenusMensuels.tsx`) devient stateful (`modification: boolean`) : mode
lecture (date affichée + lien « Modifier ») bascule vers un mode édition inline (champ date +
« Enregistrer »/« Annuler », même style que les autres micro-formulaires du fichier). Aucun nouveau
champ ni migration — pure UI sur une valeur déjà lue/écrite via `onConfigurer` existant. Committé
(`2edb88e`), pas encore vérifié dans le navigateur à cette étape ni ajouté aux tests (changement UI
seul, pas de nouvelle logique pure) — **à faire au démarrage de la prochaine session** avant de
considérer ce lot clos au même niveau que les autres.

## Investigation (2026-07-25 : bug avril signalé — erreurs de saisie réelles, pas un bug moteur)

**Signalement initial de l'utilisateur** : « Cadence affiche 1237,63 € (≈23j indemnisés) pour avril
2026 alors que les heures réelles sont 93h → JNI attendu 12 → 18j → 968,58 € — Cadence semble ne
voir qu'environ 54h en avril, vérifie le prorata des contrats à cheval mars/avril ». Consigne stricte
reçue : *« montre-moi les heures attribuées mois par mois pour chaque contrat, sans rien modifier »*.

**Méthode** : exécution directe de `repartirContratParMois` (le vrai code, pas une réécriture) sur
les contrats réels de l'export JSON de l'utilisateur (`cadence-export-2026-07-24.json`, hors dépôt),
via un fichier de test Vitest temporaire supprimé après usage — pas de modification du moteur.

**Conclusion : pas de bug moteur, deux erreurs de saisie dans les données réelles de l'utilisateur** :
1. Un contrat d'avril avait `nbHeures: 60` saisi à la main au lieu de `nbCachets: 6` (= 72h réelles
   selon le cachet = 12h confirmé cette session) — écart de saisie, pas de calcul.
2. Le mois de mars comptait **3 contrats** « Les Arts Phocéens » avec des plages de dates qui se
   chevauchaient/dupliquaient (72h + 48h + 84h = 204h), très supérieur aux 105h officielles du
   relevé France Travail de mars (10j déclarés × 12h ≈ 105h, cf. cas certifié section précédente).

**Correction appliquée directement dans le fichier réel de l'utilisateur, sur instruction explicite**
(« ajuste les heures sur les heures de PE, les dates c'est pas grave ») : dans
`C:\Users\benoi\Downloads\cadence-export-2026-07-24.json` (hors dépôt git), 2 des 3 contrats de mars
supprimés (gardé 1 contrat à `nbHeures: 84, nbCachets: 7`), avril corrigé à `nbHeures: 72,
nbCachets: 6`. **Ce fichier a un format `soldeIndemnisationDepart` antérieur au chantier
`ouvertureDroits`** (pas encore de `profil.ouvertureDroits`) — sera migré silencieusement au
prochain import dans l'app (`migrerSoldeVersDateDepart`), mais les vraies valeurs
`franchiseCPTotale`/`delaiAttenteInitial`/`dateOuverture` restent à saisir dans « Mon profil » après
import.

**⚠️ À reconsidérer d'urgence avant de faire confiance à cette correction — voir le point dédié
dans la section « Comparaison avec les vrais documents » ci-dessous** : une donnée réelle trouvée
*après* cette correction (le relevé de juin 2026) suggère que le schéma « 3 contrats à la même
période chez le même employeur » n'est peut-être PAS une erreur de saisie mais la façon normale dont
l'utilisateur représente plusieurs cachets distincts dans la même semaine. Si c'est le cas, la
suppression de 2 contrats de mars a détruit des données réelles au lieu de corriger une erreur.
**Ne pas re-modifier ce fichier sans en avoir discuté avec l'utilisateur.**

**Signalement suivant, même session** : « il ne lit pas les contrats » (capture d'écran : le tableau
de Revenus mensuels ne montrait que juillet et après). Root cause trouvée : `dateDepart` avait été
réimporté avec l'ancienne valeur `"2026-07-23"` (format antérieur au chantier `ouvertureDroits`) et
**aucune UI ne permettait de la changer** — pas un bug de lecture des contrats, un vrai trou UX
(corrigé ci-dessus, bouton « Modifier »).

## Résolu (2026-07-26) — comparaison avec les vrais documents France Travail, points 1 et 3

**Point 1 (mars/juin, contrats « Les Arts Phocéens ») — RÉSOLU par les vraies pièces, pas par un
choix arbitraire.** Les 6 « Justificatif de déclaration de situation mensuelle » officiels
(janvier à juin 2026, fournis par l'utilisateur) ont tranché : ni l'hypothèse « garder les 3
contrats » ni « n'en garder qu'1 » n'étaient correctes pour mars. Le vrai mars 2026 déclaré ne
comporte **aucun** contrat « Les Arts Phocéens » — seulement Levallois Perret (21h) + 7 cachets
sous l'employeur **« onpl »** (731,16 €), total 105h, collant exactement au 13 JNI déjà certifié.
Juin, lui, a bien 2 (pas 3) lignes « Les Arts Phocéens » (6 puis 4 cachets) + un 3e employeur
« Les Étoiles du Classique » (14h+1 cachet), total 167h. Fichier réel de l'utilisateur
(`cadence-export-2026-07-24.json`, hors dépôt) corrigé en conséquence pour les 6 mois, avec
confirmation arithmétique exacte (heures ET euros) contre les 6 documents sur chacun. Nouveau
fichier : `cadence-export-2026-07-24-corrige.json` (Downloads, hors dépôt) — à réimporter par
l'utilisateur, pas encore fait à la connaissance de Cadence.

**Point 3 (franchise CP totale) — confirmé** : les mêmes documents et le mécanisme déjà câblé
(`Profil.ouvertureDroits.franchiseCPTotale`) donnent la valeur réelle par construction dès que
l'utilisateur la saisit depuis sa notification — plus un recoupement indirect nécessaire. **Reste
à vérifier que l'utilisateur l'a effectivement saisie dans son vrai profil** (pas fait pendant
cette session, aucune donnée réelle modifiée côté profil).

## Pas résolu — à reprendre

- **Point 2 (AJ brute vs nette, tension jamais rouverte)** : les relevés officiels disent texto
  « Allocation **brute** d'un montant journalier de 55,02 € » (retraite complémentaire retenue en
  plus), alors que Cadence stocke 55,02 dans `Profil.ajReelleHistorique` comme si c'était déjà net.
  Cette session a ajouté `tauxPrelevementSource`/`montantNet` (retenue à la source, une déduction
  **différente**, en aval) mais n'a **jamais rouvert** la question d'origine : le 55,02 € que
  Cadence traite comme « point de départ net » est peut-être en réalité le brut FT (avant retraite
  complémentaire + CSG/CRDS), ce qui rendrait tous les montants de `RevenusMensuels.tsx`
  légèrement surestimés (~5 %). À investiguer avant de faire confiance à la colonne « Montant net
  avant PAS » sur des vraies données.
- **La comparaison complète Cadence vs les 8 mois réels** (demande d'origine de l'utilisateur,
  tableau déjà réuni ci-dessus dans les versions précédentes de ce document) **n'a toujours pas été
  déroulée** — la session est partie sur une longue série de chantiers fonctionnels (PAS, franchise
  salaires, mois de réadmission, revenus contrats) au lieu d'y revenir. À reprendre une fois le
  fichier corrigé réimporté et le point 2 tranché.
- **Confusion de dossier OneDrive** (cf. tout en haut de ce document) — non résolue, l'utilisateur
  n'a répondu à aucune des deux questions posées.

## Note de péremption (2026-07-28) — première admission : « Revenus mensuels » et « Mon indemnisation en cours » sont désormais accessibles

Deux passages datés du **2026-07-24** de ce document sont **périmés** depuis ce chantier. Ils ne sont
pas réécrits (ce document est un journal daté, on n'y refait pas l'histoire) : cette note fait
autorité à leur place.

**l.326-328 — « aucun écran ne permet encore de saisir `Profil.dureeDroitsMois` ni
`Profil.salairesHorsAnnexe10PRA` […] uniquement accessibles via import JSON manuel »** : faux. Les
deux champs se saisissent dans `MonProfil.tsx`. `salairesHorsAnnexe10PRA` a même quitté la section
« Mon indemnisation en cours » le 2026-07-28 pour la carte du régime déclaré (commit `4c9cfff`), afin
d'être atteignable en première admission — il ne l'était pas, et un profil en première admission ne
pouvait donc créer la contradiction « A10 pur + salaires hors A10 » (ni en être averti) que par
import JSON.

**l.396-401 — « `RevenusMensuels.tsx` affiche un encart neutre […] quand
`profil.situation === "premiere_admission"` — ce module n'a aucun sens avant l'ouverture des
droits »** : le gate a été retiré. L'intention (« avant l'ouverture des droits ») était juste, mais
`situation` en était un mauvais proxy : **un premier admis qui vient d'ouvrir ses PREMIERS droits est
indemnisé, notification en main** — et se voyait pourtant refuser tout l'onglet. Le vrai prérequis est
`Profil.ouvertureDroits` (les paramètres de la notification France Travail), déjà vérifié juste après
par les gardes réelles du module (`!ouvertureDroits`, `!soldeDepart`, `ajReelleHistorique` vide) :
aucune ne dépend de `situation`, et `calculerSerieDepuisContrats` ne l'a jamais lu. Aucun chiffre non
fondé ne peut donc apparaître du fait de ce retrait. Les deux encarts d'attente ont été fusionnés en
un message vrai dans les deux cas (droits ouverts mais notification non saisie / droits pas encore
ouverts), Cadence ne pouvant pas distinguer ces deux situations.

**Conséquences du même chantier :**
- `MonIndemnisationEnCours` n'est plus conditionnée à `situation === "readmission"` : section toujours
  rendue, dans un `<details>` replié tant qu'aucune notification n'est saisie, déplié sinon. Le gating
  ne pouvait pas porter sur `ouvertureDroits` lui-même — c'est la donnée que ce formulaire crée, il ne
  se serait jamais affiché (poule-œuf).
- `MoisReadmissionNonCalcule` / `type: "readmission"` renommés `MoisOuverturePartielleNonCalcule` /
  `type: "ouverture_partielle"` : le déclencheur est purement calendaire (`dateOuverture` pas le 1er du
  mois), il vaut donc aussi en première admission, à qui on affirmait à tort un « partage entre deux
  droits ». Le libellé dépend maintenant de `situation` — seul endroit où ce champ dit vraiment quelque
  chose ici — et vit dans `content/moisOuverturePartielle.ts`. Le texte du cas réadmission est
  inchangé au caractère près (vérifié par un test à chaîne littérale). Au passage : `messageTooltip`
  était produit par le moteur mais **jamais lu**, l'UI ayant son propre texte codé en dur et différent
  ; l'UI le consomme désormais, une seule source.

**Piège de test à retenir** (deuxième occurrence en deux chantiers) : le test intitulé « mois de
réadmission » ne fixait pas `situation` et tournait donc sur le défaut de la fabrique `profil()`
(`premiere_admission`) — le concept qu'il annonçait n'a jamais été couvert. Même piège que sur
`profilHorsPerimetre.test.ts`. **Toujours écrire `situation` explicitement** dans un test qui prétend
dépendre d'elle.

## Fait (2026-07-26 : PAS, franchise salaires mensuelle, mois de réadmission, revenus contrats)

Longue session, 14 commits, tous sur `C:\Users\benoi\cadence` (`2edb88e`→`502b495`), 159 tests
verts, `tsc -b` propre à chaque étape. Détail complet dans l'historique git ; résumé par thème :

- **Correctif bug avril + clôture** (`b91d0ed`) : confirmé data-only (contrats inventés qui
  chevauchaient le mois), `repartirContratParMois` validé sain — note dans `CLAUDE.md`
  « Décisions actées ».
- **Taux de prélèvement à la source (PAS)** : `Profil.ouvertureDroits.tauxPrelevementSource?: number`
  + `MontantMensuelResultat.montantNet` (`montant × (1 − taux/100)`, arrondi). Champ formulaire
  « Mon profil ». **Bug trouvé en vérifiant dans le navigateur** : `profilSchema`
  (`lib/coherenceProfil.ts`) écartait silencieusement `tauxPrelevementSource` (Zod sans erreur) —
  corrigé en commit `fix:` séparé, avec test de non-régression dédié (`c2a5729`, `11ba1c0`).
  Colonne « Montant net avant PAS » / « ≈ Net reçu » dans `RevenusMensuels.tsx`.
- **Mois de réadmission (mois chevauchant deux droits)** : décision actée — jamais calculé,
  `LigneSerieIndemnisation` (nouveau type discriminé, `types/index.ts`) ajoute
  `MoisReadmissionNonCalcule` à côté de `MoisIndemnisationResultat`. Ligne grisée + tooltip dans le
  tableau, exclue des totaux. Alerte `pas_taux_janvier` ajoutée (`alertes.ts`, nouveau 6e paramètre
  optionnel `soldeDepart` sur `detecterAlertes`, rétro-compatible) : signale un janvier « en cours
  d'indemnisation » (pas le mois d'ouverture) si le taux PAS est renseigné, une fois par série.
- **Franchise salaires — répartition mensuelle câblée** (`aaee824`) : `SoldeIndemnisation` gagne
  `franchiseSalairesRestante`/`quotaSalairesCarryOver`, même mécanique exacte que la franchise CP
  (quota mensuel = `ceil(total / min(dureeDroitsMois, repartitionMoisMax))`, carry-over, épuisement
  jamais négatif). **Limite actée explicitement** : `calculerSerieDepuisContrats` accepte un
  paramètre optionnel `srSjmPourFranchiseSalaires` mais **personne ne le fournit encore** (ni
  `RevenusMensuels.tsx` ni `alertes.ts`) — le SR/SJM réels (compteur « montant ARE », pas celui-ci)
  ne sont pas câblés dans l'app, donc la franchise salaires reste `franchise_salaires_non_certifiee`
  en pratique malgré le mécanisme fonctionnel et testé. Champs profil `dureeDroitsMois`/
  `salairesHorsAnnexe10PRA` ajoutés au formulaire (`988330a`) ; `formule: null` vestige retiré de
  `franceTravailConfig.ts` (`e69e99b`, y compris du schéma Zod qui le validait aussi).
- **Revenus contrats + revenu total par mois** (`502b495`) : `MoisIndemnisationResultat` gagne
  `salairesContratsBruts` (somme des `salaireBrut` prorata via `repartirContratParMois`, déjà
  disponible, aucune nouvelle logique de répartition). Deux colonnes dans `RevenusMensuels.tsx` +
  ligne « Total » en pied de tableau (ARE fusionné sur une seule cellule quand le PAS est renseigné,
  pas de total « avant PAS » redondant non demandé).

**Vérifié dans le navigateur à chaque étape** (jeu de données de test seedé, restauré après chaque
vérification) : champ PAS persistant, ligne de réadmission grisée avec tooltip exact, colonnes
Revenus contrats/Revenu total avec total recalculé à la main (7403,50 € + 2100,00 € = 9503,50 €).

## Fait (2026-07-31 : point 2 clos — AJ brute vs nette, garde-fou de plausibilité ajouté)

**Formule confirmée correcte, écart non reproduit.** Le point 2 (« les relevés officiels disent
« Allocation brute » pour la valeur que Cadence traite comme point de départ net dans
`ajReelleHistorique` ») a été rouvert avec preuve plutôt que deviné. Deux éléments déjà présents
dans le dépôt répondent exactement à la question posée, mais n'avaient jamais été reliés au
backlog CLAUDE.md :
- `docs/validation.md`, Cas réel #1 (notification FT du 03/02/2026) : `calculerAJNette` appliqué à
  l'AJ brute réelle (55,02 €) donne 53,81 € net — exactement le net réellement notifié. Écart
  0,00 €, marqué ✅ concordant.
- `src/config/franceTravailConfig.ts` l.63-68 (commit `a62e9b1`, 2026-07-24) : commentaire déjà
  écrit précisant que l'écart Allocation brute → Montant net social est de ~2,2 % (pas ~5 %),
  validé « à l'euro près » sur fév-juin 2026 (plusieurs mois, pas un seul cas).

**Conclusion : ce n'était plus un bug depuis le 24/07, seul le backlog CLAUDE.md n'avait pas été
mis à jour** — même type de péremption documentaire que celles déjà nettoyées cette session-là (cf.
note du 28/07 ci-dessus sur `RevenusMensuels.tsx`/`Mon indemnisation en cours`). Aucune modification
d'`engine/areNette.ts` : le code n'est pas en cause, la formule est prouvée, l'observation
d'origine (~5 %) était simplement imprécise.

**Résidu traité séparément, sans nouveau champ déclaratif.** La vraie question qui restait ouverte
n'est pas la formule mais la provenance de la valeur saisie dans `ajReelleHistorique` : rien
n'empêche structurellement un utilisateur de recopier la ligne « allocation brute » d'un relevé de
situation dans le champ « AJ nette » de `MonProfil.tsx` (`GestionAjReelle`), qui n'a qu'un libellé
pour s'en prémunir. Option envisagée et écartée : ajouter un champ `natureMontant` déclaratif sur
`Profil.ajReelleHistorique` (comme sur les propositions IA de `routageExtraction.ts`) — écartée
parce qu'elle **déplace le risque sans le réduire** : rien n'empêcherait l'utilisateur de déclarer
« net » un montant qui est en réalité un brut mal recopié, la nouvelle donnée serait aussi peu
fiable que l'ancienne, avec une fausse impression de garantie en plus.

**Choix retenu : avertissement de plausibilité, pas un blocage.** `GestionAjReelle` compare la
valeur saisie à `SEUIL_PLAUSIBILITE_AJ_NETTE = franceTravailConfig.are.plafond * 0.9` (157,32 €) —
au-delà de 60 €/j de brut, la CSG/CRDS s'ajoute toujours à la retraite complémentaire
(`engine/areNette.ts`), donc un net réel reste structurellement sous le plafond de l'AJ **brute**
(174,80 €) avec une marge confortable ; s'en approcher à 90 % est un signal fort de confusion,
pas une zone grise légitime. Le seuil est dérivé de la config existante (`config.are.plafond`),
aucune nouvelle valeur réglementaire inventée. Rendu en ambre (`bg-amber/10 text-amber`), même
traitement que l'avertissement « historique vide » déjà présent dans le même composant — cohérent
avec SPEC §8.1/§8.6 (alerte = ambre, jamais la couleur seule). Volontairement un avertissement, pas
un refus d'enregistrement : contrairement au canal IA (où `lib/routageExtraction.ts` peut se fier à
un champ structuré `natureMontant`), la saisie manuelle n'a aucune vérité externe à opposer à
l'utilisateur — seul lui sait ce que dit son document, Cadence ne peut que l'inviter à revérifier.
Complète (ne remplace pas) le garde-fou déjà en place côté IA (`natureMontant ≠ "net"` refusé à
l'écriture, commit `d3ebb36`), qui ne couvrait que ce canal.

## Fait (2026-07-31, suite de session — bug des 710h corrigé, gel des exercices clos, filtre par année)

**Bug réel signalé par l'utilisateur : le Dashboard affichait 710 h au compteur des 507 h — le NH exact d'une notification France Travail PASSÉE, pas la progression réelle du cycle en cours.** Diagnostic confirmé en rejouant le calcul avec les vraies données importées (`docs/cadence-import-complet.json`, 56 contrats) : `Profil.dateAnniversaire` doit porter la **prochaine échéance** du cycle en cours (cf. tous les tests de `prediction.ts`, le module qui alimente le Dashboard, et l'UI de `MonProfil.tsx`), jamais la FCT qui l'a ouvert. Mais `RenouvellementAnticipe.tsx:44` lisait `profil.dateAnniversaire` directement comme la FCT — cohérent avec un commentaire erroné écrit lors du chantier « renouvellement anticipé » (session précédente, 31/07 matin), qui affirmait à tort que c'était l'usage général du champ dans toute l'app. Résultat : une fois la date stockée dépassée par « aujourd'hui », `calculerFenetreReference`/`calculerStatutPrediction` recalculaient exactement la fenêtre rétrospective qui avait déjà produit le droit en cours (24/03/2025→17/01/2026), au lieu de la fenêtre prospective (18/01/2026→17/01/2027).

**Correctif** : `RenouvellementAnticipe.tsx` dérive maintenant la FCT du droit en cours par `échéance − 12 mois` (nouvelle fonction `deriverFctRetenueActuelle`, `engine/renouvellementAnticipe.ts`) au lieu de lire `profil.dateAnniversaire` directement. Commentaires trompeurs réécrits dans `types/index.ts` et le composant. Aucun changement dans `periodeReference.ts`/`prediction.ts` — ces modules étaient corrects, seul le nouveau module de comparaison lisait le champ à l'envers. 3 nouveaux tests, dont une régression qui isole précisément le cas signalé (réadmission récente, contrats réels avant ET après la FCT retenue, l'ancien contrat de 720 h n'est jamais recompté même quand l'extension par tranches est tentée).

**Cause racine côté données** : `docs/cadence-import-complet.json` avait été généré avec `dateAnniversaire = 2026-01-17` (la FCT) et `dateAnniversairePrecedente = 2025-03-23` (la borne de l'ANCIEN cycle, déjà résolu) — les deux valeurs étaient restées sur l'ancien cycle après avoir servi à valider le renouvellement anticipé, jamais mises à jour pour le nouveau cycle démarré le 18/01/2026. Corrigées dans le fichier : `dateAnniversaire = 2027-01-17`, `dateAnniversairePrecedente = 2026-01-17`. **L'utilisateur doit encore répercuter ces deux valeurs dans son profil réellement importé dans l'app (« Ton profil »)** — ce fichier JSON n'est qu'une source de référence, pas exécutée automatiquement.

**Confirmé par l'utilisateur (vérification GUIDEINTERMITTENT.pdf + sources France Travail) : la règle des 70h/120h d'enseignement n'est pas conditionnelle, elle s'ajoute systématiquement au compteur des 507h dès `etablissementAgree` + `enRapportAvecMetier`, plafonnée selon l'âge.** Le moteur (`decompteHeures.ts`) appliquait déjà la bonne logique, aucun changement de code. Les 18 contrats « Commune de Levallois Perret » importés n'avaient ni l'un ni l'autre flag renseigné (0 h retenue jusque-là) — l'utilisateur a confirmé que les deux conditions sont remplies ; corrigé dans `docs/cadence-import-complet.json`. **Chiffre exact recalculé avec les vraies données, fenêtre en cours (18/01/2026→17/01/2027) : 588 h / 507 h** (504 h de cachets + 14 h de scène + 70 h d'enseignement plafonnées, 56 h excédentaires sur les 126 h déclarées sur la fenêtre).

**Question tranchée avant tout code : les exercices clos (`Exercice.cloture: true`) n'étaient PAS protégés d'un recalcul silencieux.** `decouperExercices` (`engine/cycles.ts`) recalculait TOUT à chaque appel — y compris les cycles déjà clos — depuis les contrats/profil courants, sans aucun mécanisme de gel. Un import tardif ajoutant un contrat dans une période déjà close, ou une nouvelle FCT (réadmission), aurait changé silencieusement l'AJ affichée pour un cycle passé dans `Historique.tsx` — l'AJ affichée n'était d'ailleurs qu'une reconstruction de Cadence, jamais la valeur réellement notifiée (`ajReelleHistorique`). **Choix retenu (version hybride demandée par l'utilisateur, ni gel manuel ni nouveau schéma de stockage séparé)** : nouvelle fonction pure `fusionnerExercicesGeles` (`engine/cycles.ts`) — un exercice en cours reste toujours recalculé en direct ; un exercice qui vient de clôturer est calculé une fois puis placé dans `aGeler` ; un exercice déjà figé en storage n'est plus jamais recalculé, même si le recalcul frais donnerait un chiffre différent. Nouveau champ persistant `DonneesApp.exercicesGeles: Record<string, Exercice>` (`storage/localStorageAdapter.ts`, migration silencieuse `{}` par défaut pour un ancien export — devoir sacré n°1). `App.tsx` : le `useMemo` reste pur (calcule `aGeler` sans effet de bord), un `useEffect` dédié persiste les nouveaux gels. **Limite connue, signalée mais non résolue** : si `Profil.dateAnniversaire` change un jour suite à une vraie réadmission, la reconstruction rétroactive des cycles (déjà une limitation MVP documentée, backlog V3, cf. `cycles.ts`) peut ne plus retomber sur les mêmes `id` — les exercices déjà figés resteraient en storage (aucune perte, devoir n°1) mais pourraient ne plus apparaître dans la liste affichée. 4 nouveaux tests.

**Nouvelle fonctionnalité : filtre par année dans `ContractList.tsx`.** Onglets « Toutes » + une pastille par année présente dans les contrats (année la plus récente sélectionnée par défaut, calculée une seule fois au montage pour ne pas faire sauter le filtre sous les pieds de l'utilisateur en cours de saisie). Une série récurrente n'est jamais coupée par le filtre : si un seul de ses contrats tombe dans l'année choisie, la série entière s'affiche. Vérifié en navigateur (dev server local, `npm run dev`), pas seulement par les tests.

**Bilan tests** : 467 tests verts (460 en début de session + 7 nouveaux : 3 pour le bug dateAnniversaire, 4 pour le gel des exercices), `tsc -b` propre.

**5 commits cette session** (`05108f5` → `9e56656`, + `ae8e7c8` pour `.claude/settings.json`), tous sur `master`, **rien poussé sur `origin`** (`git remote -v` montre un jeton dans l'URL — des identifiants de push existent bien dans cet environnement, contrairement à ce qu'affirmait une note antérieure de ce document ; Claude Code ne pousse quand même jamais vers `origin`, par consigne explicite de l'utilisateur, indépendamment de la présence d'identifiants).

## Ensuite (backlog)

- **Rythme mensuel requis fini mais absurde** (délai non nul mais minuscule → des milliers de
  h/mois) : différé volontairement lors du correctif Infinity. Nécessite un seuil de
  plausibilité non réglementaire (décision produit, pas une donnée sourcée) avant d'ajouter une
  3e raison `rythme_hors_limite` au type discriminé `RythmeRequis` (guidé par le compilateur).
  Consigné aussi dans `validation.md`.
- **`StatutPrediction.joursRestants` (champ brut) fragile pour un futur consommateur direct** —
  peut valoir 0 sans vraie échéance (fenêtre sentinelle anniversaire inconnu). Protégé partout où
  il est déjà consommé aujourd'hui (`prediction.ts` en interne, `ProjectionChart.tsx` depuis ce
  lot) via `anniversaireConnu`, mais rien n'empêche structurellement un futur endroit du code de
  l'ignorer. Solution systémique (type discriminé façon `RythmeRequis`) en backlog si ça se
  reproduit ailleurs, consigné dans `validation.md` (« Dette tracée »).
- Réadmission allongée jamais confrontée à source externe (le simulateur officiel ne modélise pas l'allongement → attendre une vraie notif de testeur, consigné validation.md).
- Barème CSG figé à « normal » en dur dans l'onboarding (sous-estime le net pour barème réduit, non bloquant).
- Maintenance config mensuelle (déjà notée CLAUDE.md).
- **Déploiement bêta** : l'app ne tourne qu'en `npm run dev` — rien à partager tant qu'elle n'est
  pas déployée. C'est une SPA statique (Vite + localStorage, pas de backend) → `build` dist/ +
  hébergeur statique gratuit (Netlify / Vercel / Cloudflare Pages) → URL partageable. Lot à cadrer.
  **Devient aussi le prérequis pour tester l'installation PWA sur un vrai téléphone** (PWA
  techniquement prête, cf. section « Fait » ci-dessus — la confirmation finale attend ce
  déploiement).
- **Note testeurs (devoir n°1)** : données en `localStorage`, propres à chaque navigateur/appareil ;
  vidage de cache = perte. Dire aux testeurs d'exporter leur JSON régulièrement (= leur sauvegarde
  ET le retour d'usage qui te revient). Prévoir aussi, avant d'élargir au-delà du cercle d'amis, une
  courte page « à propos » (ce que l'app fait / ne fait pas / données restent chez l'utilisateur) —
  mentions légales absentes, limite déjà notée au SPEC §10 (« Cadre légal léger »).
- Programmer le rappel mensuel de veille réglementaire (SNAM / impôts / France
  Travail-Unédic) — routine détaillée dans `docs/routine-mensuelle-veille.md`.
  Reste à faire : choisir le jour du mois, créer l'événement récurrent
  (Google Calendar et/ou Todoist) avec la checklist en description.

### Idées consignées le 2026-07-23 (à cadrer plus tard, pas de plan pour l'instant)

Items « date de précédente ouverture de droits », « renommer À propos en Mon profil », « contrat
récurrent pour l'enseignement » et « contrats à venir persistés » retirés de cette liste : faits
(cf. sections « Fait » ci-dessus). Reste, inchangé :

1. **V2+ : analyse IA du contrat** (vérifier automatiquement CDD vs CDI déguisé, conformité du
   contrat). **Tension déjà documentée à rappeler explicitement le jour où cet item est repris** :
   le principe « 100 % local, aucune donnée envoyée » (SPEC, import PDF) serait rompu par
   construction — nécessiterait un service externe (LLM ou autre), donc un consentement RGPD
   explicite à obtenir, pas un simple ajout technique. Change la nature de l'app sur ce point précis,
   à ne pas sous-estimer.
2. **V3+ : légalité des contrats** (minimums légaux, contrats limites/border) — reliée à l'item 1
   (analyse IA). Même tension vie privée à rappeler : toute analyse automatisée de ce type
   soulève la même question de service externe + consentement RGPD explicite.

**Idée non traitée, restée hors du lot « contrats à venir »** : afficher une **fourchette**
(optimiste/pessimiste) plutôt qu'une seule ligne de projection pointillée — mentionné au SPEC
§11.B, explicitement mis de côté lors du cadrage de ce lot pour ne pas élargir le périmètre (pas de
méthode sourcée pour calculer les bornes d'une fourchette, décision produit à trancher séparément).

## Méthode à conserver

Un module à la fois ; faire expliquer le plan avant de coder, je valide, puis il code ; après chaque étape, TOUS les tests (total, zéro rouge) ; git status avant chaque commit ; commit dédié par étape ; maj « État actuel » de CLAUDE.md.

Règle de cohérence : réparer et signaler toute incohérence qu'une retouche crée ailleurs dans un doc, sans élargir le périmètre de soi-même — mais tracer une cause connue (en étiquetant le niveau de certitude) est bienvenu.

Ne jamais toucher `engine/` sans validation.

Distinguer « règle prouvée » (source externe) de « code conforme » dans validation.md.
