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

### Renouvellement anticipé — cas B1/B2/B3/E1 (simulateur officiel, section « franchises » activée, 31/07/2026)

Construits pour sourcer/valider la règle de comparaison ancien/nouveau droit avant tout code (prérequis bloquant SPEC.md §11.B, désormais levé). Chaque ligne : entrées saisies dans le simulateur (heures, salaire de référence, jours travaillés, salaire de la période) → sortie simulateur vs sortie `calculerRenouvellementAnticipe` (`engine/renouvellementAnticipe.ts`).

| Cas | Entrées (heures / SR / jours travaillés / salaire période) | Simulateur officiel | Moteur Cadence | Écart | Verdict |
|-----|---|---|---|---|---|
| B1 — baisse | 520 h / 6 000 € / 48 j / 6 000 € | AJ init. 44,70 € · retraite 1,07 € · net 43,63 € · franchise CP 5 j | ajBrute.brut 44,70 € · ajNette.net 43,63 € · franchiseCPTotale 5 j | 0,00 € | ✅ concordant |
| B2 — quasi identique | 684 h / 9 130 € / 152 j / 9 130 € | AJ init. 54,59 € · retraite 1,24 € · net 53,35 € · franchise CP 15 j | ajBrute.brut 54,59 € · ajNette.net 53,35 € · franchiseCPTotale 15 j | 0,00 € | ✅ concordant — hausse de 0,04 € vs l'ancien droit (53,31 €), pas de "baisse" à tort |
| B3a — plancher | 510 h / 500 € / 13 j / 500 € | AJ init. 44,00 € · retraite 0,09 € · net 43,91 € · franchise CP 1 j | ajBrute.brut 44,00 € (plancherApplique) · ajNette.net 43,91 € · franchiseCPTotale 1 j | 0,00 € | ✅ concordant |
| B3b — plafond | 700 h / 400 000 € (SR volontairement irréaliste) | AJ init. **155,77 €** (avant clamp) | AJ init. (A+B+C avant clamp) **188,72 €** → clampée à 174,80 € (plafondApplique) | **32,95 €** sur l'AJ init. avant clamp | ⚠️ écart significatif à un SR extrême, jamais rencontré à un SR réaliste (Fictif #3 concorde à 50 000 €) — le CLAMP interne de Cadence fonctionne (174,80 € garanti quel que soit le SR d'entrée), mais la formule A+B+C elle-même diverge du simulateur à cette échelle. Hors périmètre de ce chantier (pré-existant à `areBrute.ts`), à creuser si un cas réel le confirme un jour — PAS de correctif spéculatif appliqué (devoir sacré n°2). |
| E1 — SAR (ALD hors contrat) | 975 h / SAR 8 658,76 € (salaire de référence saisi = SAR, le simulateur n'a qu'un seul champ) / 62 j / 6 500 € | AJ init. 55,04 € · retraite 0,83 € · net 54,21 € | ajBrute.brut 55,04 € · ajNette.net 54,21 € (arrondi ±0,01 €, SAR saisi à 2 décimales) | 0,01 € (arrondi) | ✅ concordant — a aussi révélé et confirmé le correctif SJM du 31/07/2026 (cf. note ci-dessous) |

**Cas C1 (franchise CP non épuisée / risque de trop-perçu) et D1/D2 (délai d'attente, réapplication à 12 mois)** : non vérifiables numériquement sur CE simulateur — son formulaire ne prend que des totaux plats (jours travaillés, salaire de la période), pas une simulation mensuelle depuis une date d'ouverture de droits. Deux choses les valident à la place : (1) le texte de sortie du simulateur confirme littéralement la règle des 12 mois — *« un délai d'attente de 7 jours peut s'appliquer [...] dès lors que ce délai d'attente ne vous a pas été appliqué dans les 12 derniers mois »* — et le principe du trop-perçu en cas de franchise non épuisée lors d'une *« demande de réadmission avant votre date anniversaire »* ; (2) `engine/renouvellementAnticipe.test.ts` teste directement `delaiSeReapplique` (D1/D2) et `tropPercuRisque` (C1 + son complémentaire), ce dernier en réutilisant `calculerSerieDepuisContrats` déjà testé par ailleurs — pas une formule inventée pour l'occasion. Le simulateur ne donne jamais de montant de trop-perçu tenant compte des inputs (texte générique) : `tropPercuChiffrable` reste `false`, aucun montant n'est câblé (devoir sacré n°2).

**Correctifs pré-existants découverts par ce chantier (hors périmètre initial, corrigés au passage)** :
- `periodeReference.ts` : la fenêtre de référence n'était bornée par `dateAnniversairePrecedente` que pendant sa phase d'EXTENSION, jamais sur sa fenêtre de BASE — un seuil déjà atteint sans extension (le cas de tout renouvellement anticipé) ignorait donc la borne, gonflant SR/NHT avec des contrats déjà comptés pour le droit précédent. Révélé par le cas Réel #1 lui-même (fenêtre réelle 299 j, pas 365 j) et confirmé par le texte officiel du simulateur (*« dans la limite de la dernière fin de contrat ayant servi à ouvrir un droit »*).
- `areNette.ts`/appelants (`App.tsx`, `Simulateur.tsx`, `cycles.ts`, `RevenusMensuels.tsx`) : le SJM (base de la retraite complémentaire et de la CSG/CRDS) était calculé sur le SR brut (`sr`) au lieu du salaire réellement retenu (`sar ?? sr`) — sous-évaluant la retraite complémentaire, donc surévaluant l'AJ nette, dès qu'un SAR s'applique (période assimilée). Révélé et confirmé par le cas E1 (écart de 0,21 € avant correctif, 0,01 € après — un vrai arrondi cette fois).

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

#### 2026-08-03 — Trop-perçu (`tropPercuRisque`) : déclencheur sourcé, formule sourcée mais NON CALCULABLE

Objectif de la session : sortir `tropPercuRisque` de son statut de « booléen de prudence sans règle
derrière ». Résultat : le déclencheur ET la formule sont désormais sourcés à la source primaire, mais
la formule reste inapplicable par Cadence — **aucun montant n'est câblé, et ce n'est plus un manque de
sourçage, c'est un manque de données**.

**Hypothèse de départ écartée.** Le chantier partait de l'idée que le risque de trop-perçu venait du
plafond de cumul à 118 % du PMSS (`indemnisationMensuelle.plafondCumulCoeffPMSS`). C'est faux : le
guide (éd. juillet 2026, p.17, étape 5 « Vérification du plafond mensuel de cumul de l'ARE à verser
avec des rémunérations ») en fait un **écrêtement prospectif** du montant mensuel *avant* versement —
« Si le cumul est supérieur au plafond : le montant mensuel de l'ARE à verser est recalculé = Montant
du plafond – rémunérations brutes mensuelles. » Il ne produit un indu que par déclaration erronée.
Mécanisme distinct, sans rapport avec `tropPercuRisque`, qui porte bien sur les franchises.

**Déclencheur — confirmé (source primaire).**
Guide France Travail « Intermittents du spectacle », éd. **juillet 2026** (mention de pied de page
« France Travail services - Juillet 2026 »), p.19 :
> « La réadmission expresse ou à date anniversaire peuvent entraîner : • Un montant d'allocation
> inférieur, • L'application de nouvelles franchises, • Un trop-perçu si les franchises précédentes
> n'ont pas été intégralement prélevées. »

Même guide, encadré « Attention » p.15 (repris mot pour mot sur
`cultureetspectacle.francetravail.fr/je-me-fais-accompagner/jour-de-carence-et-franchise`) :
> « Lorsque les franchises congés payés et salaires totales n'ont pu être intégralement déduites au
> terme de votre période d'indemnisation (atteinte de votre date anniversaire ou demande de
> réadmission avant votre date anniversaire), un trop-perçu équivalent au reliquat de franchises vous
> sera notifié (dans la limite de ce que vous avez perçu). »

→ Ce que `tropPercuRisque` signale correspond bien à la règle officielle. Le booléen n'était pas un
faux signal sur le principe.

**Formule — sourcée au niveau réglementaire.**
Annexe X au règlement général annexé à la convention d'assurance chômage, **article 31 §2** (texte
identique à l'**article 23 §2** de l'Annexe 8, convention du 15/11/2024) :
> « Lorsque les franchises déterminées conformément aux modalités de l'article 29 § 1er n'ont pu être
> intégralement appliquées au terme de la période d'indemnisation, il est procédé à une récupération
> des allocations versées à tort, sur la base du montant de l'allocation journalière déterminée à
> l'ouverture de droits ou de la réadmission. »

Soit : **reliquat de franchises (en jours) × AJ de l'ouverture/réadmission**, borné par les allocations
réellement versées.

**Pourquoi rien n'est chiffré malgré ça — trois verrous, aucun levable par du code seul :**

| # | Verrou | Ce qui manque exactement |
|---|---|---|
| 1 | **Assiette incomplète** | Le reliquat porte sur les franchises CP **et salaires** (art. 29 §1er). Cadence ne calcule pas la franchise salaires — `calculerSerieDepuisContrats` retombe sur `FRANCHISE_SALAIRES_NON_CERTIFIEE` faute de SR/SJM (`srSjmPourFranchiseSalaires` n'est fourni par aucun appelant), et `Profil.ouvertureDroits` n'a pas de champ déclaratif pour son total. Chiffrer la seule part CP donnerait un montant **systématiquement sous-estimé présenté comme complet** — faux signal rassurant, devoir n°2. |
| 2 | **AJ brute ou nette ?** | Le règlement dit « allocation journalière déterminée à l'ouverture de droits » mais récupère des « allocations versées à tort » (donc nettes). Aucune des sources consultées ne tranche. Cadence ne stocke que l'AJ **nette** déclarée (`ajReelleHistorique`). Écart ~2,2 % : sur un reliquat de 30 j, ce n'est pas un arrondi. |
| 3 | **Plafond indisponible** | « dans la limite de ce que vous avez perçu » exige le cumul réellement versé depuis l'ouverture du droit. La série mensuelle de Cadence démarre d'un **solde déclaré** à une date choisie par l'utilisateur, pas de l'ouverture. |

**Sources consultées sans succès** pour lever le verrou 2 : guide FT éd. juillet 2026 (lu en entier,
extraction texte complète), Annexe 8 et Annexe X du règlement général (unedic.org), dossier de
synthèse Unédic « L'indemnisation des intermittents du spectacle », circulaire Unédic n° 2025-03 du
1er avril 2025. Aucun ne précise brute/nette ni ne donne d'exemple chiffré de trop-perçu.

**Ce qu'il faudrait pour trancher** : (1) câbler la franchise salaires (le SR et le SJM existent déjà
côté compteur « montant ARE », il « suffit » de les passer à `calculerSerieDepuisContrats`) **ou**
ajouter un champ déclaratif `franchiseSalairesTotale` à `ouvertureDroits` ; (2) **un relevé réel
portant un trop-perçu notifié** — c'est la seule pièce qui montrerait à la fois la base retenue et
l'AJ utilisée. Aucun relevé de ce type n'a jamais été fourni au projet.

**Écart découvert au passage — ✅ CORRIGÉ le 03/08/2026, dans la foulée.** La règle vise les
franchises CP **et salaires** ; l'ancien `ancienneFranchiseCPEpuisee` ne regardait que la CP, et
`franchiseSalairesRestante` vaut `0` **par défaut** (total absent, `valeur: null`) et non parce
qu'elle serait prouvée épuisée. `tropPercuRisque === false` signifiait donc « franchise CP prouvée
épuisée » mais s'affichait comme « aucun risque » (absence de bandeau) — faux feu vert au sens du
devoir n°2.

**Correctif** : `tropPercuRisque: boolean` → `tropPercu: RisqueTropPercu`, type discriminé à trois
états, même pattern que `SeuilReadmission`.

| État | Condition | Atteignable aujourd'hui ? |
|---|---|---|
| `avere` | un reliquat est PROUVÉ : franchise CP non soldée, ou franchise salaires connue et non soldée | oui |
| `indetermine` + `raison` | Cadence ne peut pas conclure — `franchise_salaires_non_calculee` (cas nominal dès que la CP est soldée), `historique_mensuel_insuffisant`, `simulation_mensuelle_impossible` (défensif) | oui |
| `ecarte` | les **deux** franchises prouvées épuisées | **non, et c'est voulu** : inatteignable tant que le verrou 1 tient |

Aucun montant dans aucun état (`tropPercuChiffrable` reste `false`). L'écran rend les trois cas
distinctement — rouge / ambre / rien — avec un message dédié par `raison` : le silence ne couvre plus
jamais un « on ne sait pas ». Portée réelle du faux feu vert corrigé : probablement étroite (la
formule de la franchise salaires retranche 27 jours, elle tombe à 0 pour un SR ordinaire, cf.
`calculerFranchiseSalaires`), mais non nulle à SR élevé. 5 tests dans `renouvellementAnticipe.test.ts`,
dont un garde-fou qui échouera le jour où `ecarte` deviendra atteignable — signal qu'il faudra alors
écrire un vrai cas « écarté », pas supprimer le test.

#### 2026-08-03 (suite) — Verrou 1 levé : franchise salaires déclarative ; verrou 2 documenté, non résolu

**Verrou 1 — définition du SJM : tranchée par la source primaire, aucune ambiguïté.**
Le guide FT éd. juillet 2026 définit les trois paramètres de la formule dans un encadré
« Légendes des paramètres » accolé à la formule elle-même (p.14) :

> « **Salaires de la période de référence** : total de vos rémunérations brutes non plafonnées sur la
> période quel que soit le régime de l'activité. »
> « **SMIC mensuel et SMIC journalier** : Valeurs à la date de fin de la période de référence. »
> « **Salaire journalier moyen (SJM)** : SJM (annexe 8) = SR / (NHTM/8) · SJM (annexe 10) = SR / (NHTM/10) »
> (note de bas de page : « NHTM = heures travaillées plafonnées au titre des annexes 8 et 10 en France
> et d'un PTP, heures assimilées au titre de l'affection de longue durée (ALD), ainsi que celles
> assimilées au titre du congé maternité et du congé d'adoption hors contrat de travail. »)

Réponse à la question posée : le SJM de cette formule n'est **pas** une grandeur distincte — c'est le
SJM habituel, bâti sur le **SR** (annexes 8/10 uniquement), identique à celui déjà utilisé pour les
cotisations (`calculerSJM`, `config.cotisations.diviseurSJM_Annexe10`). Le point à ne pas manquer est
ailleurs : **dans une même formule, le premier facteur utilise le PRC (tous régimes) et le second le
SR (annexes 8/10 seulement)**. Deux numérateurs différents. La formule ARTCENA citée dans le prompt
correspond mot pour mot à celle du guide, et `calculerFranchiseSalaires` l'implémente déjà
correctement depuis le 2026-07-24 (`srContrats + salairesHorsAnnexe10PRA` pour le PRC, `sjm` séparé).
**Il n'y avait donc aucune formule à écrire — seulement un total à obtenir.**

**Notification réelle du 05/02/2026 — ce qu'elle contient, ce qu'elle ne contient pas.**
⚠️ Le fichier `Notification_admission_ARE_20260205_2.pdf` n'existe pas dans le projet (recherche sur
le dépôt, le dossier OneDrive et le profil utilisateur entier). Le document réellement disponible est
`Notification admission ARE 20260205.pdf`, dans le cache de pièces jointes Outlook — même document
selon toute vraisemblance, nom légèrement différent.

- **Aucun PRC n'y figure**, ni sous ce nom ni sous un équivalent. La notification ne publie que :
  SR 9 229,35 €, 710 heures, 7 j de délai d'attente, **5 j de franchise congés payés**.
- **Aucune ligne de franchise salaires.** Cohérent avec le calcul : SJM = 9 229,35 / (710/10) ≈ 130 €,
  (9 229,35 / 1 823,03) × (130 / (3 × 84,14)) − 27 ≈ −24 → **0**. Premier point de confrontation de
  `calculerFranchiseSalaires` à un cas réel : la formule ne fabrique pas de franchise là où France
  Travail n'en notifie aucune.
- Elle confirme en revanche la règle du trop-perçu, **troisième source indépendante** et cette fois
  nominative : « Si au terme de l'indemnisation les franchises n'ont pu être intégralement
  appliquées, vous nous devrez la somme équivalente aux jours de franchises restants sur la base de
  votre allocation journalière déterminée à l'ouverture de droits, dans la limite de ce que vous avez
  perçu. » Elle référence la **convention du 15 novembre 2024** (articles 9 §1er et 11 à 20 des
  annexes VIII et X), ce qui confirme la convention applicable. Toujours **aucune mention brute/nette**.

**Décision : déclaratif, pas calculé.** Quatre raisons, dans l'ordre de poids :
1. Le PRC exige « toutes les rémunérations quel que soit le régime » ; Cadence ne suit que l'Annexe 10,
   et `salairesHorsAnnexe10PRA` est un complément optionnel explicitement admis comme non fiable
   (`sousEstimeeHorsA10`). Un total recalculé pourrait diverger de la notification.
2. Tous les autres paramètres d'ouverture (franchise CP, délai d'attente, date limite) sont déjà
   déclarés depuis la notification, jamais recalculés — cohérence de doctrine.
3. Pour le trop-perçu, c'est la franchise de l'**ancien** droit qui compte : la recalculer supposerait
   de reconstituer une fenêtre de référence passée, exactement la reconstruction bannie ailleurs
   (`engine/cycles.ts`).
4. La notification est la pièce qui fait foi.

**Implémentation** : `Profil.ouvertureDroits.franchiseSalairesTotale?: number` (optionnel, aucune
migration — devoir sacré n°1, deux tests de round-trip). `undefined` = inconnu, `0` = notification
consultée, aucune franchise notifiée : **deux états jamais confondus**, c'est ce qui permet de conclure.
`calculerSerieDepuisContrats` donne la priorité au total déclaré sur tout calcul, via une troisième
variante de `FranchiseSalairesResultat` (`declaree: true`, `totalNonVerifie: false`). Saisie dans
« Mon indemnisation en cours » avec une consigne explicite : *beaucoup de notifications n'en
mentionnent aucune, dans ce cas saisir 0*.

**Conséquence sur `RisqueTropPercu`** : `ecarte` devient **atteignable** — c'était l'objectif. 6 tests
supplémentaires (`ecarte` réel avec 0 déclaré, `avere` maintenu quand la CP reste due, `avere` avec
40 j de franchise salaires déclarés, pas d'`ecarte` prématuré sans mois complet observable, profil
sans le champ inchangé). Le garde-fou « `ecarte` inatteignable » a été **remplacé, pas supprimé**,
comme annoncé quand il avait été écrit.

**Verrou 2 — brut/net : raisonnement, PAS une source qui tranche. Toujours ouvert.**
Aucune des sources consultées (guide FT éd. juillet 2026, Annexes 8 et X du règlement, dossier de
synthèse Unédic, circulaire 2025-03, et désormais une notification réelle) ne dit si « l'allocation
journalière déterminée à l'ouverture de droits » s'entend brute ou nette. Argument en faveur du
**brut**, à considérer comme une hypothèse de travail :
- le SR est explicitement défini comme un total de salaires **bruts** (source : taux-intermittent.net) ;
- l'AJ **brute** est la valeur réellement déterminée et figée à l'ouverture de droits, tandis que l'AJ
  nette est recalculée à chaque versement selon des taux de cotisation qui peuvent varier en cours de
  droit — elle n'est donc pas « déterminée à l'ouverture » au même sens.

Ce raisonnement **ne vaut pas source**. Aucun montant ne doit être codé sur cette base tant qu'une
source explicite ou un relevé réel portant un trop-perçu notifié ne l'a pas confirmé. **Ce verrou ne
bloque rien aujourd'hui** : `RisqueTropPercu` ne porte aucun montant (`tropPercuChiffrable: false`),
et le garde-fou correspondant échoue si quelqu'un en câble un. Il faudra trancher le jour où un
montant sera demandé — pas avant.

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

- **Plafond ARE — contradiction de sources non résolue (03/08/2026).** Le Guide France Travail
  (éd. juillet 2026) et plusieurs pages cultureetspectacle.francetravail.fr affirment 174,80 € comme
  plafond inchangé depuis 01/01/2024 — contradiction non résolue avec les valeurs Unédic retenues en
  config (`are.plafondHistorique` : 174,80 € en 2024, 177,56 € en 2025, 181,18 € en 2026). Config
  alignée sur Unédic (organisme gestionnaire des paramètres, documents datés et cohérents sur
  5 éditions vérifiées), écart visible uniquement à un SR assez élevé pour que A+B+C dépasse le
  plafond (~400 000 €, cf. cas B3b plus haut) — cas extrême, même famille que l'écart de formule à SR
  extrême déjà déprioritisé. Non résolu avec certitude à 100 %, contact direct Unédic/France Travail
  nécessaire pour trancher définitivement.
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

- **`Profil.ajReelleHistorique` ne dit pas si le montant est net ou brut** (relevé le 2026-07-28, en
  écrivant l'écran de revue des extractions IA). Le type est `{ dateEffet, valeur }` : la nature du
  montant est une **convention implicite**, tenue à deux endroits séparés qui doivent rester
  d'accord — l'UI de saisie (`MonProfil.tsx`, libellé « Allocation journalière nette ») et le moteur
  (`indemnisationMensuelle.ts`, qui applique le prélèvement à la source **sur** cette valeur, donc la
  traite comme nette). Rien dans le type n'empêche d'y écrire un brut, et un brut y produirait des
  montants mensuels gonflés sur toute la série (faux montant, devoir n°2). C'est précisément le piège
  qu'ouvre l'extraction automatique : un relevé de situation dit « allocation brute », une
  notification dit « allocation journalière nette ». **Protégé à cet endroit** :
  `lib/routageExtraction.ts` refuse de router toute proposition dont `natureMontant ≠ "net"` (refus
  côté évaluation ET exception côté écriture, 4 tests dédiés dans `routageExtraction.test.ts`).
  **Reste vrai pour tout futur écrivain de ce champ.** Solution systémique en backlog, à ne faire que
  si un autre appelant apparaît : porter la nature dans le type (`natureMontant: "net"`) avec
  migration silencieuse des entrées existantes en `"net"` — la convention actuelle. Pas urgent tant
  que les deux seuls écrivains sont la saisie manuelle et cet écran de revue.

- ✅ **`PeriodeAssimilee` a un chemin d'écriture complet dans l'app** (relevé absent le 2026-07-28,
  **construit le 2026-07-29**, commit `d664344` — cette note n'avait jamais été mise à jour depuis,
  péremption documentaire pure). `PeriodeForm.tsx` + `PeriodeList.tsx`, câblés dans `MonProfil.tsx`
  (section « Périodes particulières ») via `ajouterPeriode`/`supprimerPeriode` (`App.tsx`), persistés
  par `storage/localStorageAdapter.ts`. Une maternité ou un accident du travail — qui valent 5 h/jour
  au décompte des 507 h — sont donc bien saisissables normalement, en plus de l'import JSON.
  **Routage de l'extraction IA câblé le 2026-07-31** : la cible `periode_assimilee` du schéma
  d'extraction (`src/types/extraction.ts`) n'est plus refusée par `routageExtraction.ts` — traitée
  en `revue_formulaire` (comme `contrat`), elle pré-remplit `PeriodeForm` sans jamais s'appliquer
  directement. ⚠️ Le piège déjà documenté reste entier et reste protégé : `ald` et
  `maladie_intercontrat` ont des effets **opposés** sur le décompte et un simple avis d'arrêt de
  travail CPAM ne permet pas de les distinguer — le schéma d'extraction impose à l'IA de produire
  `info_seule` plutôt que de deviner ce champ, et la revue en formulaire garde une confirmation
  humaine systématique même quand l'IA propose un type avec confiance haute (cf. commentaire dans
  `src/types/extraction.ts` et `routageExtraction.ts`).
