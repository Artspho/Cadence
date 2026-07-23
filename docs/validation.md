# Registre de validation — Cadence

> Mémoire durable des vérifications du calcul contre une SOURCE EXTERNE
> (simulateur officiel France Travail + notifications réelles). À relire en
> début de session, au même titre que SPEC.md.

## État en un coup d'œil — à jour au 20/07/2026

**Distinction clé :** « règle vérifiée » (le calcul attendu colle à la source
externe) ≠ « code conforme » (Cadence produit ce chiffre). Les deux ne
coïncident pas encore.

### ✅ Validé — code Cadence = source externe
- **Cas réel #1** (notif FT 03/02/2026) : A10, réadmission, 710 h, SR 9 229,35 € →
  net 53,81 €. Écart 0,00 €. Couvre A+B+C, SJM, retraite compl. seule (AJ ≤ 60 €).
- **CSG/CRDS** : **règle ET code désormais conformes** au simulateur officiel, depuis le
  commit `f0d18ae` (test permanent au vert sur #2 et #3 — plus de repli manuel).
  - Cas #2 (SR 14 579 €, écrêté) : CSG/CRDS 1,68 €, net 62,00 € — teste le plancher.
  - Cas #3 (SR 50 000 €, non écrêté) : CSG/CRDS 4,63 €, net 65,73 € — teste assiette + taux nus.
  - Règle : assiette = 98,25 % de l'AJ brute APRÈS retraite ; écrêtement au plancher
    `cotisations.plancherEcretementJournalier` (62 €, valeur observée — cf. « À valider »).

### ⬜ Tourne en prod, PAS encore validé en externe
- **Réadmission allongée** (fenêtre > 365 j) : activée depuis le SMIC renseigné
  (commit fda6b8e). Le simulateur officiel ne modélise pas l'allongement (vérifié le
  20/07/2026) — seule une vraie notification FT peut la valider. Statut : code conforme
  à la règle comprise, règle non prouvée contre source externe → à valider avant toute
  bêta incluant ces profils.

### ✅ Invariant garanti par construction (pas une validation externe)
- **Profil cohérent (réadmission ⇒ date anniversaire connue).** `engine/periodeReference.ts`
  suppose cette cohérence sans jamais la vérifier lui-même — ni « règle prouvée » ni
  « code conforme » : aucune source externe à confronter, c'est une garantie structurelle
  interne, pas un calcul réglementaire. Piège fermé : une réadmission sans date anniversaire
  connue faisait tourner l'extension de réadmission sur une fenêtre fictive "se terminant
  aujourd'hui", produisant un seuil ajusté plausible mais faux. `lib/coherenceProfil.ts`
  (`validerCoherenceProfil` + `profilSchema.refine`) bloque cette combinaison aux **3 portes**
  qui écrivent un profil : Onboarding, édition post-onboarding (À propos, nouveau), et **import
  JSON** (le tien ou celui d'un ami en retour d'usage, cf. SPEC §11.A) — les trois délèguent à la
  même règle, un seul message. Détail : `CLAUDE.md` « État actuel », `docs/SPEC.md` §10.

## Prochaine action
Collecter une notification FT réelle d'un profil en réadmission allongée (le simulateur
officiel ne peut pas servir de source pour cette branche, cf. « À valider ») ; réconcilier
l'écart de 0,45 €/j sur le plancher d'écrêtement CSG/CRDS (cf. « À valider »).

---

## Historique détaillé des cas

Objet : prouver que le calcul colle à la réalité, en comparant les sorties de
Cadence à une source qui fait autorité. C'est la vérification qui compte le plus,
bien au-delà des tests unitaires.

### Source de vérité (par ordre de confiance)

1. Notification officielle France Travail — le plus fort : teste aussi les heures
   RÉELLEMENT retenues par FT (un contrat non déclaré, une heure requalifiée…).
2. Simulateur officiel France Travail (simucalcul.pole-emploi-services.fr) —
   suffisant pour valider la formule de calcul.

On ne compare JAMAIS Cadence à une estimation personnelle : deux estimations qui
s'accordent ne prouvent rien (elles peuvent se tromper de la même façon).

### Règles de comparaison

- Brut à brut : le simulateur rend une AJ brute → ne pas comparer au net.
- Zone centrale obligatoire : SR ni très bas ni très haut. Tant que
  `smicHoraireBrut` et `pmssMensuel` sont à `null`, tout cas plancher/plafond
  donnera un écart NORMAL (repli config), PAS un bug.
- Mêmes entrées, même définition : SR = brut AVANT abattement.
- Tolérance : écart ≤ 0,50 €/jour = arrondi, OK. Au-delà → enquête.
- Preuve : capture d'écran datée du simulateur (l'outil peut évoluer).
- Règle absolue : un faux « vert » ou un faux « Bloqué » → on arrête tout.

### Cas testés

| Cas | Entrées (annexe / situation / période / heures / SR brut) | FT : AJ brute + durée | Cadence : AJ brute + durée | Écart | Verdict |
|-----|-----------------------------------------------------------|-----------------------|----------------------------|-------|---------|
| Réel #1 — notification FT du 03/02/2026 | A10 / réadmission / période 24/03/2025→17/01/2026 (~299 j, pas d'allongement) / 710 h / SR 9229,35 € brut avant abattement | 53,81 € net (durée non communiquée) | 55,02 € brut → 53,81 € net (durée non exercée dans ce test) | 0,00 € | ✅ concordant |
| Fictif #2 — simulateur officiel | A10 / 710 h / SR 14 579 € brut avant abattement (pas d'enseignement/formation, pas Alsace-Moselle) — cas écrêté (AJ brute proche du SMIC journalier) | A+B+C = 65,59 € · retraite compl. = 1,91 € · CSG/CRDS = 1,68 € · **net = 62,00 €** | Code actuel (`areNette.ts`, corrigé — commit `f0d18ae`) : A+B+C = 65,59 € ✅ · retraite compl. = 1,91 € ✅ · CSG/CRDS écrêtées = 1,68 € ✅ · **net = 62,00 €** ✅ | 0,00 € | ✅ règle prouvée ET code conforme (commit f0d18ae) |
| Fictif #3 — simulateur officiel | A10 / 710 h / SR 50 000 € brut avant abattement (pas d'enseignement/formation, pas Alsace-Moselle) — cas non écrêté (AJ brute nettement > SMIC journalier) | A+B+C = 76,91 € · retraite compl. = 6,55 € · CSG/CRDS = 4,63 € · **net = 65,73 €** | Code actuel (`areNette.ts`, corrigé — commit `f0d18ae`) : A+B+C = 76,91 € ✅ · retraite compl. = 6,55 € ✅ · CSG/CRDS = 4,63 € ✅ · **net = 65,73 €** ✅ | 0,00 € | ✅ règle prouvée ET code conforme (commit f0d18ae) |
| B — 500 h     | A10 / … / … / 500 h / … (statut seul, FT ne rend rien <507 h) | | | | |
| B — 520 h     | A10 / … / … / 520 h / … | | | | |
| C — cachets   | A10 / … / … / majorité de cachets / … | | | | |

Verdict : ✅ concordant · ⚠️ écart à expliquer · ❌ bug à corriger

**Note sur le cas Réel #1** : chemin de calcul exercé = A + B + C (formule standard, pas de
période allongée) → SJM → palier retraite complémentaire seule (31,96 € < AJ brute ≤ 60 €,
donc pas de CSG/CRDS sur ce cas). Cohérence croisée vérifiée sur le régime Alsace-Moselle : le
calcul sans cotisation locale tombe pile sur le net réel (53,81 €), celui avec cotisation locale
donne 51,86 € — confirme que ce profil n'est pas Alsace-Moselle. La branche CSG/CRDS (AJ brute
> 60 €) reste à éprouver sur un futur cas réel, tout comme la formule réadmission allongée.

**Note sur le cas Fictif #2 — Bug détecté par validation** : `areNette.ts` applique CSG (6,2 %)
+ CRDS (0,5 %) sur le SJM entier, sans la règle d'écrêtement qui limite le prélèvement pour ne
pas faire passer l'allocation sous un plancher lié au SMIC. Formule du SPEC §6.5 incomplète.
À corriger UNIQUEMENT une fois la règle sourcée ET `smicHoraireBrut` renseigné en config. Ne pas
deviner. → **Corrigé dans le commit `f0d18ae`** (voir la règle établie ci-dessous et le tableau
ci-dessus, désormais ✅ conforme).

**Note sur le cas Fictif #3** : second point de calibration, volontairement choisi non écrêté
(SR élevé, AJ brute 76,91 € bien au-dessus du SMIC journalier ≈ 62 €) pour isoler l'assiette et
les taux nus, sans que l'écrêtement ne masque une éventuelle erreur. Le corrigé du simulateur
officiel a été comparé au calcul de la RÈGLE établie ci-dessous (calcul manuel), pas à la sortie
du code Cadence actuel — `areNette.ts` n'a pas été exécuté sur ce cas, il produirait un résultat
tout aussi faux que sur #2 (même bug d'assiette sur le SJM). Concordance au centime sur les 4
postes (A+B+C, retraite, CSG/CRDS, net) : confirme la règle une seconde fois, sur un cas de nature
différente du #2. → **Corrigé dans le commit `f0d18ae`** : `areNette.ts` produit désormais ce
résultat directement, cas #2 et #3 transformés en tests permanents (`areNette.test.ts`).

#### 2026-07-20 — Règle CSG/CRDS établie (implémentée le 2026-07-20, commit `f0d18ae`)

- **Assiette** : 98,25 % de l'AJ brute (abattement de 1,75 %), pas le SJM.
- **Taux** : CSG 6,2 % ou 3,8 % + CRDS 0,5 % — déjà en config (`cotisations.tauxCSG`, `cotisations.tauxCRDS`), rien à ajouter côté taux.
- **Exonération** : aucune CSG/CRDS si l'AJ brute ≤ SMIC journalier.
- **Écrêtement** : le prélèvement CSG/CRDS ne peut jamais faire passer l'AJ nette sous le SMIC journalier (= SMIC horaire × 35/7, arrondi).
- **Bugs identifiés** (les deux à corriger ensemble) :
  (a) l'assiette actuelle est le SJM au lieu de l'AJ brute → facteur d'erreur ~8 sur ce cas ;
  (b) l'écrêtement est totalement absent du code actuel.
- **Valeur sourcée** : SMIC horaire brut = **12,31 €** au 01/06/2026 (source officielle
  info.gouv.fr / travail-emploi.gouv.fr) → SMIC journalier ≈ 12,31 × 35/7 = 61,55 €, arrondi à
  **62 €**.
- **Réconciliation vérifiée au centime sur le cas Fictif #2** : retraite complémentaire (1,91 €)
  + CSG/CRDS écrêtée (1,68 €) = 3,59 € de prélèvements → net = 65,59 − 3,59 = **62,00 €**, exactement
  l'attendu du simulateur officiel — le plancher d'écrêtement explique très précisément pourquoi
  le net tombe pile sur ce montant. Le rapprochement entre 62,00 € et le calcul « SMIC horaire ×
  35/7 » ci-dessus (61,55 €) reste toutefois à éclaircir, cf. « À valider ».

### Hors périmètre de validation externe (décision produit en attente)

- **Rythme mensuel requis fini mais humainement absurde** (`prediction.ts`, ex. délai non nul
  mais minuscule → des milliers de h/mois) : **pas un sujet de « règle prouvée » vs « code
  conforme »** — aucun formule officielle n'existe à confronter, c'est un seuil de plausibilité
  à choisir (décision produit, jamais une valeur réglementaire). Volontairement différé lors de
  la correction du bug Infinity de `rythmeRequis` (cf. SPEC §6.6, `CLAUDE.md` « État actuel ») :
  seules deux raisons existent aujourd'hui dans le type discriminé (`anniversaire_inconnu`,
  `delai_expire`), pas de 3e raison `rythme_hors_limite`. À reprendre : `docs/reprise.md`.

### Dette tracée

- **`StatutPrediction.joursRestants` (champ brut) reste fragile** — il peut valoir `0` sans que
  ça signifie une vraie échéance atteinte : quand l'anniversaire est inconnu, `periodeReference.ts`
  referme la fenêtre sur une date sentinelle ("aujourd'hui", faute de mieux), et `joursRestants`
  hérite de cet artifice de calcul plutôt que de refléter un vrai délai. `prediction.ts` s'en
  protège déjà en interne (`niveau`, `message` passent tous par `anniversaireConnu`), mais le champ
  numérique lui-même n'est pas sûr par construction — trouvé via `ProjectionChart.tsx`, qui
  recalculait sa propre version de "jours restants" à partir de `fenetreFin`/`dateCap` sans jamais
  recevoir cette distinction, affichant à tort « échéance atteinte » à côté d'un badge « Alerte »
  honnête. **Corrigé à cet endroit précis** (booléen `StatutPrediction.anniversaireConnu` exposé,
  transmis à `ProjectionChart.tsx`, texte « date inconnue » quand il est faux — cf. `CLAUDE.md`
  « État actuel », test dédié dans `prediction.test.ts`). **Reste vrai pour tout futur
  consommateur** : quiconque lit `joursRestants` directement doit d'abord vérifier
  `anniversaireConnu`, sous peine de retomber dans le même piège. Solution systémique en
  backlog si un autre endroit du code y retombe un jour : transformer `joursRestants` en type
  discriminé, sur le modèle de `RythmeRequis` (cf. `docs/reprise.md`) — pas urgent tant qu'aucun
  autre cas ne s'est présenté.

- **Un test vert ne garantit pas qu'on teste la bonne chose** — leçon tirée en corrigeant le bug du
  seuil de réadmission gonflé (signalé par un testeur : réadmission + un seul contrat récent →
  Cadence affichait « 480 / 1515 h » au lieu de « 480 / 507 h », `1515 = 507 + 24×42` étant le
  plafond de sécurité de terminaison de `periodeReference.ts`, pas un vrai seuil). Le test
  `periodeReference.test.ts` (« réadmission : étend la fenêtre... », avant correctif) utilisait un
  scénario à un seul contrat isolé — **exactement le scénario du bug** — mais ne vérifiait que
  `tranchesReadmission > 0`, une assertion vraie aussi bien pour une vraie réussite que pour un
  épuisement des 24 tentatives sans solution. Le test passait donc au vert depuis le début, sans
  jamais remarquer qu'il exerçait déjà le cas d'échec plutôt qu'un cas de succès. **Corrigé** :
  `FenetreReference.seuilReadmission` est désormais un type discriminé
  (`{ calculable: true; ... } | { calculable: false; raison: "historique_insuffisant"; ... }`),
  et ce test a été réécrit pour affirmer explicitement `calculable: false` sur ce scénario, avec un
  test séparé et vérifié indépendamment (calcul à la main, cf. commit) pour un vrai succès
  d'extension (`tranchesReadmission: 2`). **Rappel méthodologique à garder** : pour un algorithme
  borné par un plafond de tentatives (garde-fou de terminaison), toujours vérifier explicitement
  *pourquoi* la boucle s'est arrêtée (succès vs épuisement), jamais seulement *que* la boucle s'est
  arrêtée avec un résultat qui a l'air plausible.

### À valider

- **Réadmission allongée (fenêtre > 365 j)** — tourne dans le code depuis le commit `fda6b8e`
  (diviseurs modifiés A = NH × SMIC horaire, B = NH), appliqués conformément à la règle telle que
  comprise. **Non prouvable contre le simulateur officiel** : vérification faite le 20/07/2026 sur
  simucalcul.pole-emploi-services.fr (version V20241009) — ses seuls champs d'entrée sont régime,
  date de fin de contrat, heures travaillées, heures d'enseignement/formation/assimilées, salaire
  de référence, Alsace-Moselle ; aucune entrée d'allongement de réadmission n'existe, et il calcule
  toujours en fenêtre 365 j standard avec les diviseurs 5000/507. Le confronter validerait donc
  contre le mauvais calcul. **Source requise** : une vraie notification FT d'un intermittent en
  réadmission allongée, à collecter auprès d'un testeur de la bêta. **Statut : code conforme à la
  règle comprise, règle non prouvée contre source externe.** Rappel : cette branche affichait
  auparavant le calcul standard (montant potentiellement surévalué = faux feu vert) ; le nouveau
  calcul est plus juste mais reste, pour l'instant, non vérifiable autrement que par une notification réelle.

- **Écart non expliqué sur le plancher d'écrêtement CSG/CRDS** — `cotisations.plancherEcretementJournalier`
  est encodé à **62,00 €**, valeur observée du simulateur officiel FT (cas #2). Or la formule
  SMIC horaire × 35/7 donne 12,31 × 5 = **61,55 €** → écart de **0,45 €** non expliqué entre les
  deux. La valeur encodée (62,00 €) est défendable puisqu'elle reproduit exactement le simulateur
  sur #2 et #3, mais reste une **valeur observée**, pas dérivée d'une formule ou d'une source
  réglementaire directe. À réconciler : soit la formule d'arrondi du SMIC journalier diffère de
  « × 35/7 arrondi », soit une autre règle (proratisation, arrondi différent) s'applique. Ne pas
  remplacer 62,00 € par 61,55 € sans avoir d'abord compris l'écart — ce serait échanger une valeur
  qui colle aux deux cas validés contre une valeur qui n'a encore été confrontée à aucun cas.
