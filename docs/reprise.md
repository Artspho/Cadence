# CONTEXTE — Projet Cadence (reprise de session)

App web indépendante Cadence : suivi des droits intermittents Annexe 10, focus artistes-enseignants. But : visibilité claire et fiable du statut. Je ne lis pas le code, je pilote via Claude Code en exigeant de la rigueur, explications en français simple.

Setup Windows, projet dans `C:\Users\benoi\cadence`. Stack : React + TS + Tailwind + Vite + Vitest + Zod + date-fns, localStorage.

Mémoire durable à consulter au démarrage : `CLAUDE.md`, `docs/SPEC.md`, `docs/validation.md`.

Deux devoirs sacrés : (1) ne jamais perdre les données ; (2) ne jamais afficher un chiffre faux (ni faux « feu vert » rassurant, ni faux « Bloqué », ni faux montant, ni fausse alerte, ni valeur sentinelle brute).

État : les deux devoirs sacrés sont tenus, la bêta a son socle. 127 tests verts, tsc propre. Dernier lot committé : correctif AJ réelle (`f6cb937` — montants de « Revenus mensuels » calculés sur l'AJ prévisionnelle au lieu de l'AJ réelle notifiée, un faux chiffre pour un utilisateur déjà en cours d'indemnisation). Tous les items §11.A du SPEC sont désormais traités.

État : les deux devoirs sacrés sont tenus. Dernier correctif committé : cf. section dédiée
« Fait (2026-07-24 : correctif AJ réelle committé, vérification PE en direct, PDF officiel lu en
entier) » plus bas, complétée par le correctif du `27` en dur (même date, voir juste après cette
section pour le détail).

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
`tsc -b` propre. Pas de vérification navigateur nécessaire : `calculerFranchiseSalaires` n'est
toujours pas câblée dans `calculerMoisIndemnisation` (rien de nouveau visible à l'écran, cf.
« Chantier suivant » plus haut). Pas encore committé — à committer séparément du reste (changement
isolé, un seul fichier moteur touché).

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
