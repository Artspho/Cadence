# CONTEXTE — Projet Cadence (reprise de session)

App web indépendante Cadence : suivi des droits intermittents Annexe 10, focus artistes-enseignants. But : visibilité claire et fiable du statut. Je ne lis pas le code, je pilote via Claude Code en exigeant de la rigueur, explications en français simple.

Setup Windows, projet dans `C:\Users\benoi\cadence`. Stack : React + TS + Tailwind + Vite + Vitest + Zod + date-fns, localStorage.

Mémoire durable à consulter au démarrage : `CLAUDE.md`, `docs/SPEC.md`, `docs/validation.md`.

Deux devoirs sacrés : (1) ne jamais perdre les données ; (2) ne jamais afficher un chiffre faux (ni faux « feu vert » rassurant, ni faux « Bloqué », ni faux montant, ni fausse alerte, ni valeur sentinelle brute).

État : les deux devoirs sacrés sont tenus, la bêta a son socle. 80 tests verts, tsc propre, git à jour (dernier lot : panneau de transparence du calcul + correctif « date inconnue » sur ProjectionChart, commit `505473a`).

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

## Fait (transparence du calcul + correctif « date inconnue »)

Dernier item §11.A ouvert, traité en deux temps.

**Panneau de transparence** (`components/DetailCalcul.tsx`) : accessible depuis le Dashboard via
un `<details>` natif (**replié par défaut**, ouvert seulement au clic — jamais affiché en
permanence). Montre le décompte des heures par catégorie (dont enseignement/formation retenus vs
écartés au-delà du plafond), SR/NHT/SAR, l'AJ brute = A+B+C avec plancher/plafond appliqué ou non,
et le détail des cotisations jusqu'à l'AJ nette. **Zéro fichier `engine/` touché** : investigation
préalable a confirmé que `decompteHeures.ts`, `areBrute.ts`, `salaireReference.ts` et `areNette.ts`
exposaient déjà tout ce détail dans leurs types de retour — `App.tsx` calculait déjà `sr`/`nht`/`sar`
mais ne les faisait pas transiter jusqu'au Dashboard. Contenu vérifié manuellement contre le premier
cas de `areBrute.test.ts` (SR 20 000 €, NHT 1000 h → A+B+C = 68,78 €) : concordance exacte.

**Piège trouvé en testant le panneau sur un profil anniversaire inconnu, indépendant du panneau
lui-même** : `ProjectionChart.tsx` affichait « échéance atteinte » à côté d'un badge « Alerte »
honnête. Cause : le composant recalculait son propre « jours restants » à partir de
`fenetreFin`/`dateCap` sans savoir que `periodeReference.ts` referme la fenêtre sur une date
sentinelle (« aujourd'hui ») quand l'anniversaire est inconnu — un artifice de calcul déjà nommé
ailleurs (bug Infinity ci-dessus), mais qui n'avait pas été audité dans ce composant précis.
`niveau`/`message`/`rythmeRequis` restaient corrects (protégés par `anniversaireConnu` en
interne à `prediction.ts`) : bug d'affichage confiné à cette seule phrase, pas une confusion dans
le calcul du statut. **Corrigé (Option A, ciblée)** : nouveau champ `StatutPrediction.anniversaireConnu`
exposé (aucune logique changée dans `prediction.ts`), transmis à `ProjectionChart.tsx`, qui affiche
désormais « date inconnue » dans ce cas. Test dédié ajouté (`prediction.test.ts`). **Dette tracée**
dans `docs/validation.md` (nouvelle section « Dette tracée ») : le champ brut
`StatutPrediction.joursRestants` reste fragile pour tout futur consommateur qui le lirait
directement sans vérifier `anniversaireConnu` — Option B (type discriminé façon `RythmeRequis`)
en backlog si un autre endroit y retombe un jour, pas urgent aujourd'hui.

80 tests verts, tsc propre. Vérifié manuellement dans le navigateur sur 3 profils (anniversaire
connu futur, inconnu, réellement dépassé) : les trois textes désormais cohérents avec leur badge.
Commit `505473a`.

## PROCHAINE ACTION

Plus rien en urgence côté garde-fous, cohérence de profil, ni transparence du calcul — les items
§11.A sont tous traités. Aucune priorité imposée pour la suite : à choisir parmi le backlog
ci-dessous selon ce qui te semble le plus utile (candidats les moins coûteux : barème CSG figé,
PWA ; le plus structurant côté partage : déploiement bêta). Détail complet : « Ensuite (backlog) ».

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
- PWA.
- Maintenance config mensuelle (déjà notée CLAUDE.md).
- **Déploiement bêta** : l'app ne tourne qu'en `npm run dev` — rien à partager tant qu'elle n'est
  pas déployée. C'est une SPA statique (Vite + localStorage, pas de backend) → `build` dist/ +
  hébergeur statique gratuit (Netlify / Vercel / Cloudflare Pages) → URL partageable. Lot à cadrer.
- **Note testeurs (devoir n°1)** : données en `localStorage`, propres à chaque navigateur/appareil ;
  vidage de cache = perte. Dire aux testeurs d'exporter leur JSON régulièrement (= leur sauvegarde
  ET le retour d'usage qui te revient). Prévoir aussi, avant d'élargir au-delà du cercle d'amis, une
  courte page « à propos » (ce que l'app fait / ne fait pas / données restent chez l'utilisateur) —
  mentions légales absentes, limite déjà notée au SPEC §10 (« Cadre légal léger »).

## Méthode à conserver

Un module à la fois ; faire expliquer le plan avant de coder, je valide, puis il code ; après chaque étape, TOUS les tests (total, zéro rouge) ; git status avant chaque commit ; commit dédié par étape ; maj « État actuel » de CLAUDE.md.

Règle de cohérence : réparer et signaler toute incohérence qu'une retouche crée ailleurs dans un doc, sans élargir le périmètre de soi-même — mais tracer une cause connue (en étiquetant le niveau de certitude) est bienvenu.

Ne jamais toucher `engine/` sans validation.

Distinguer « règle prouvée » (source externe) de « code conforme » dans validation.md.
