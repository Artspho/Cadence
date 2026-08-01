# Inventaire des données nécessaires et des documents à déposer — Cadence

Rédigé le 29/07/2026. **Remplace** `inventaire_documents_non_couverts.md`, dont il conserve les
fiches de recherche encore valables (§8) et corrige trois affirmations fausses (§9).

En attente de deux relectures avant intégration à `docs/` : Benoît (cohérence avec les vraies
pièces France Travail) et une revue de code (exactitude des renvois au code).

---

## 1. Le sens de lecture, et pourquoi il change

Le document précédent partait des **documents** (« voici une AEM, quels champs peut-on en tirer ? »).
Celui-ci part des **points où l'app refuse de calculer** (« voici ce qui bloque, quel document le
débloque ? »).

Ce n'est pas une préférence de présentation. Partir des documents oblige à deviner quels champs
comptent, et fait passer à côté de l'essentiel : le document le plus décisif de tout le dossier — la
notification d'admission — était classé « déjà couvert, rien à faire », alors qu'il porte à lui seul
**9 des 13 données dont l'app a besoin**. Partir des blocages réels du code met les priorités dans le
bon ordre et donne directement la liste que l'utilisateur doit voir à l'écran.

**Méthode** : chaque ligne du §3 vient d'un endroit du code qui refuse explicitement de produire un
chiffre faute de donnée. Aucune n'est déduite d'un document. Les renvois de fichier/ligne sont
vérifiables et ont été lus, pas supposés.

---

## 2. Ce qui est vérifié dans ce document, et ce qui ne l'est pas

Distinction à tenir, sous peine de refaire l'erreur du document précédent.

| Affirmation | Statut |
|---|---|
| Les blocages du §3 et leurs renvois au code | ✅ **Vérifié** — code lu ligne à ligne le 29/07/2026 |
| La couverture IA du §5 (énumération, lexique, routage) | ✅ **Vérifié** — `api/extract-document.ts` et `src/types/extraction.ts` lus |
| L'absence de suivi des fichiers déposés (§4) | ✅ **Vérifié** — `DonneesApp = { profil, contrats, periodes, soldeIndemnisationDepart }` |
| Les libellés cités pour la notification et le relevé | ✅ **Vérifié sur pièces réelles** (travail du 29/07, cf. CLAUDE.md) |
| Les libellés de l'AEM, du contrat d'enseignement, du bulletin d'enseignement | ⚠️ **NON VÉRIFIÉ** — aucun spécimen réel n'est passé par ce chemin |
| Les fiches du §8 (rôle légal, pièges) | ⚠️ **Documentation officielle uniquement**, pas de spécimen |

⚠️ **Règle** : aucune règle d'extraction ne doit être écrite pour un document dont la ligne est
« NON VÉRIFIÉ » ci-dessus. Coder une reconnaissance de motifs contre une mise en page supposée, c'est
se préparer à tout refaire — et, en attendant, à afficher des chiffres tirés d'une lecture fausse.

---

## 3. Le tableau des besoins — le cœur de ce document

Colonne « couverture IA » : voir §5 pour le détail par type de document.

| Donnée | Sans elle, l'app fait quoi ? | Document qui la porte | Couverture IA |
|---|---|---|---|
| `ouvertureDroits.dateOuverture` | **Onglet Revenus entièrement bloqué** — écran neutre, aucun montant (`RevenusMensuels.tsx:30`) | Notification d'admission | ✅ |
| `ouvertureDroits.franchiseCPTotale` (jours) | Idem — **requis**, et le routage refuse d'écrire 0 « en attendant » (`routageExtraction.ts:26`) | Notification d'admission | ✅ |
| `ouvertureDroits.delaiAttenteInitial` (jours) | Idem — **requis** (presque toujours 7, mais jamais supposé) | Notification d'admission | ✅ |
| `ajReelleHistorique` (AJ **nette** + date d'effet) | **Aucun montant mensuel** — aucun repli sur une estimation (`RevenusMensuels.tsx:299`) | Notification d'admission **uniquement** — cf. §7 | ✅ si le document dit « nette » ; refusé sinon |
| `ouvertureDroits.tauxPrelevementSource` | Montants **bruts seulement**, pas de net (`RevenusMensuels.tsx:317`) | Notification, relevé, ou attestation de taux | ✅ |
| `ouvertureDroits.dateLimiteIndemnisation` | Série mensuelle **non bornée** : des mois affichés au-delà de droits qui n'existent plus | Notification **ou** relevé de situation | ✅ |
| Contrats : `dateDebut`, `date`, `typeRemuneration`, `nbCachets`/`nbHeures`, `salaireBrut`, `employeur` | Compteur 507 h vide ou faux — **le cœur de l'app** | Bulletins de paie **ou** AEM, un par mois et par employeur | 🔶 codé, non validé |
| Contrat : `type` (artiste/enseignement/…) | Mauvaises règles de décompte et de plafond | Bulletin (activité décrite, pas la ligne « Statut ») | 🔶 codé, non validé |
| `etablissementAgree` + `enRapportAvecMetier` | Heures d'enseignement **non comptées** (prudence voulue, pas un bug) | Contrat d'enseignement + bulletin | 🔴 jamais lu automatiquement |
| `profil.dateNaissance` | Mauvais plafond enseignement (70 h vs 120 h) | Notification d'admission | ✅ |
| `profil.dateAnniversaire` | **Toute la fenêtre de référence est fausse** — donc tout le décompte | Notification d'admission | ✅ (piège des deux dates, cf. §5) |
| `profil.situation` (admission/réadmission) | Mauvaise règle de seuil | Notification d'admission | ✅ |
| `profil.dateAnniversairePrecedente` | Alerte `seuil_readmission_non_calculable` en réadmission | Notification **précédente** | ✅ |
| `profil.dureeDroitsMois` | Franchise salaires mal répartie | Notification (si le nombre de mois est écrit en clair) | ✅ |
| `profil.salairesHorsAnnexe10PRA` | Franchise salaires **sous-estimée** (signalé à l'écran, non bloquant) | Bulletins hors Annexe 10 | 🔴 **exclu à dessein** — indissociable de `regimeDeclare`, lui-même jamais déduit d'un scan |
| `periodes` (maternité, adoption, AT, ALD, suspension, maladie intercontrat) | Heures assimilées non comptées ; fenêtre de 365 j non allongée | Attestation CPAM, attestation maternité | 🔴 **aucune case d'arrivée** — cf. §6.2 |

### Ce que ce tableau apprend

1. **La notification d'admission porte 9 des 16 lignes.** C'est, et de loin, le document à réclamer
   en premier. Sans elle, l'onglet Revenus est un écran vide.
2. **Les bulletins/AEM sont le seul carburant du compteur 507 h**, et il en faut *tous les mois de la
   période de référence* — un seul manquant, et le compteur est sous-évalué sans que rien ne le dise.
3. **Deux données n'ont aucune source automatique** et resteront manuelles : les salaires hors
   Annexe 10 (par décision, §3) et les périodes assimilées (par manque de case d'arrivée, §6.2).

---

## 4. Ce que l'espace dépôt doit montrer — et la contrainte qui décide de tout

### La contrainte : l'app ne garde aucune trace des fichiers déposés

Ce qui est stocké, c'est `{ profil, contrats, periodes, soldeIndemnisationDepart }` — **les chiffres,
jamais les documents**. Aucun champ n'existe pour « une notification a été déposée le … ».

Conséquence directe : un badge « ✅ fourni » adossé à « tu as déposé un fichier » **mentirait** dès
qu'une extraction est refusée par le routage, ou abandonnée à l'écran de revue. Le document serait
bien passé, la donnée absente, et l'utilisateur lirait un feu vert qu'il n'a pas. C'est le devoir
sacré n°2, au mot près.

**Le statut doit donc se calculer depuis les données présentes, jamais depuis un historique de
fichiers.** Bénéfice gratuit : une saisie manuelle éteint le badge exactement comme un import, ce qui
est le comportement juste.

### Les trois états et leur vocabulaire (tranché le 29/07/2026)

Les trois états sont dérivables des données seules, par groupe de champs :

| Champs bloquants du groupe | État affiché | Lecture utilisateur |
|---|---|---|
| Aucun présent | **rien de renseigné** | « Ce document, je ne l'ai pas encore traité » |
| Certains présents, au moins un manquant | **incomplète (N informations manquent)** | « Il est passé, mais il n'a pas tout donné » |
| Tous présents | **complète** | « Rien à faire ici » |

⚠️ **Le mot « fournie » est volontairement écarté.** Rien n'étant tracé côté fichiers, l'app ne peut
pas savoir *qu'un document a été fourni* — seulement que ses données sont là, qu'elles viennent d'un
import ou du clavier. Écrire « Notification — fournie » serait une affirmation qu'elle n'est pas en
mesure de faire : même mécanisme que les faux feux verts, en plus discret. Le vocabulaire ne nomme
donc que ce qui est observable. Décision de Benoît, 29/07/2026.

### Deux poids de manque : bloquant vs précision

Sans cette distinction, l'état « complète » serait **inatteignable à vie** — le taux PAS peut
légitimement ne pas figurer sur une notification, et la notification *précédente*, l'utilisateur ne
l'a pas forcément gardée. Un badge qui ne passe jamais au vert, on apprend à l'ignorer, et il cesse
alors de signaler les vrais manques.

**La frontière n'est pas une question de confort. C'est un test contre le devoir sacré n°2 :**

| Poids | Critère | Effet |
|---|---|---|
| **bloquant** | l'app **affiche un chiffre faux** ou ne calcule rien | compte dans « N informations manquent » ; empêche « complète » |
| **précision** | l'app **dit qu'elle ne sait pas** — dégradation honnête | listé au dépliage seulement ; n'empêche pas « complète » |

⚠️ Classer en « précision » exige la **preuve** que l'app se protège (mention, troncature,
avertissement). Sans cette preuve, c'est bloquant. Cf. le cas `dateLimiteIndemnisation` ci-dessous,
initialement mal classé.

**Répartition complète — 6 bloquants, 2 précisions, 7 champs jamais réclamés.**

| # | Manque bloquant | Champs | Sans lui |
|---|---|---|---|
| 1 | Paramètres d'ouverture de droits | `dateOuverture` + `franchiseCPTotale` + `delaiAttenteInitial` | Onglet Revenus vide |
| 2 | Allocation journalière **nette** | `ajReelleHistorique` | Aucun montant mensuel |
| 3 | Date de naissance | `dateNaissance` | Mauvais plafond enseignement (70/120 h) |
| 4 | Date anniversaire (**réadmission seulement**) | `dateAnniversaire` | Fenêtre de référence fausse → tout le décompte |
| 5 | **Date limite d'indemnisation** | `dateLimiteIndemnisation` | **Des mois hors droits s'affichent avec un montant** |
| 6 | Au moins un contrat | ligne bulletins/AEM | Compteur 507 h à zéro |

Les trois champs du n°1 ne peuvent pas manquer séparément : `Profil.ouvertureDroits` les exige tous
les trois et le routage refuse d'en écrire un partiel. Un seul manque, donc, qui les nomme tous —
trois cases basculant toujours ensemble donneraient l'illusion de trois vérifications indépendantes.

| # | Précision | Preuve que la dégradation est honnête |
|---|---|---|
| 7 | Taux de prélèvement à la source | En-tête renommé « ≈ Montant (AJ relevé) » au lieu de « Montant net avant PAS » (`RevenusMensuels.tsx:364`) + avertissement ambre (`:446`) |
| 8 | Date anniversaire précédente (réadmission) | Alerte `seuil_readmission_non_calculable` affichée |

Champs **jamais réclamés**, chacun pour une raison vérifiée : `dureeDroitsMois` (retombe sur 12, et la
franchise salaires qui le consomme n'est jamais active), `salairesHorsAnnexe10PRA` (indissociable de
`regimeDeclare`, inutile en périmètre `annexe10_pur`), `situation` (garanti par le type — un manque
qui ne peut jamais se déclencher est du code mort), `etablissementAgree`/`enRapportAvecMetier` (cf.
ci-dessous), `contrat.type`/`territoire` (données du contrat, pas des cases séparées), `periodes`
(aucune case d'arrivée, §6.2), `soldeIndemnisationDepart` (choix d'affichage).

🔶 **`etablissementAgree` — hors checklist pour cette première version (décision du 29/07/2026).**
C'est le seul cas limite : son absence fait **sous-compter** les heures d'enseignement, donc
l'utilisateur peut se croire en retard alors qu'il ne l'est pas. Direction prudente — jamais un faux
feu vert — donc pas urgent au sens du devoir n°2. Et ça se règle au niveau du **contrat individuel**,
pas du dossier global : la bonne place serait une mention dans `DetailCalcul.tsx` un jour, pas une
ligne de checklist. Amélioration future, pas une dette rouge.

### Le cas `dateLimiteIndemnisation` — pourquoi il est bloquant

Classé « précision » dans une première version de ce document, **à tort**. Vérification du
29/07/2026 : son absence produit de vrais mois erronés à l'écran, sans aucune protection.

- La borne dure de `calculerSerieDepuisContrats` est purement **sautée** quand le champ est absent
  (`indemnisationMensuelle.ts:254`) ; la fin de série retombe alors sur `dateDuJour` (`:246`).
- `RevenusMensuels.tsx` ne mentionne ce champ **nulle part** — ni troncature, ni avertissement.
- Deux tests voisins du moteur le prouvent sur le **même profil**
  (`indemnisationMensuelle.test.ts:372` et `:401`) : dernier mois simulé **2027-01** avec la date,
  **2027-02** sans elle. Ce mois hors droits porte un montant calculé comme les autres, et l'écart
  grossit avec le temps puisque la borne haute est la date du jour.
- C'est la **régression signalée par Benoît le 26/07/2026**. Sans le champ, elle est intégralement de
  retour.

Classement tenable sans créer de badge rouge à vie : la donnée est toujours atteignable — le lexique,
validé sur pièces réelles, la trouve sur la notification **et** sur le relevé, sous deux formulations
équivalentes.

### Les cinq lignes — dont deux seulement ont un statut calculable

Ligne repliée par défaut ; le détail par donnée n'apparaît qu'en dépliant.

| Ligne (document) | Statut calculable ? | Contenu au dépliage |
|---|---|---|
| **Notification d'admission ARE** | ✅ **oui, les trois états** | manques n°1 à 5 selon le cas |
| **Bulletins de paie ou AEM** | 🔶 **partiel** — jamais « complète » | « N contrats renseignés » + la limite assumée |
| **Relevé de situation** | ❌ non | Source alternative, et l'avertissement sur le montant BRUT |
| **Attestation CPAM / maternité** | ❌ non | « Cadence ne sait pas encore enregistrer ces périodes » |
| **Attestation de taux (PAS)** | ❌ non — **ligne affichée seulement si le taux manque** | Où le trouver |

**Pourquoi trois lignes n'ont pas de statut** : elles ne portent **aucune donnée qui leur soit
propre**. Tout ce qu'elles contiennent figure ailleurs (le relevé duplique la notification ; le taux
est déjà réclamé au n°7 ; l'app ne peut pas savoir si quelqu'un a eu un arrêt de travail). Leur
donner un badge aurait été inventer un statut. Leur rôle est d'être des **sources alternatives**, pas
des cases à cocher.

⚠️ **Trois honnêtetés à afficher telles quelles.** Ce ne sont pas des manques à combler : les taire
serait pire que les dire. Chacune est verrouillée par un test, pour qu'une reformulation ne les fasse
pas disparaître sans bruit.

1. **La ligne « bulletins » ne peut JAMAIS être « complète ».** L'app ne connaît pas la liste des mois
   travaillés : elle est structurellement incapable de distinguer « je n'ai pas travaillé en mars » de
   « j'ai oublié mars ». Afficher « complet » ici serait un faux feu vert **sur le compteur 507 h
   lui-même** — le plus grave possible. Elle affiche « N **contrats** renseignés » et non « N mois » :
   un contrat peut couvrir plusieurs mois (une année scolaire d'enseignement en couvre dix), et
   recompter les mois ici dupliquerait `engine/decoupageMensuel.ts` au risque d'en diverger en
   silence. On n'affiche que ce que l'app sait sans calcul.
2. **La ligne CPAM ne promet rien.** Tant que §6.2 n'est pas fait, déposer cette attestation ne
   produit rien d'applicable, et la ligne le dit.
3. **Le manque d'AJ nette renvoie vers la notification**, en avertissant qu'un relevé donne le plus
   souvent le montant **BRUT**, inutilisable ici. Signalétique uniquement — aucune conversion, cf. §7.

### Implémentation

`src/lib/documentsRequis.ts` (commits `6615263` puis `02300ef`), fonction **pure et testée** : elle
porte la vérité, l'affichage ne fait que la rendre. 25 tests dédiés.

---

## 5. Couverture de la lecture IA — audit type par type

Trois choses distinctes, à ne pas confondre : le type est-il **détecté** ? Le prompt dit-il **quoi en
tirer** ? L'app a-t-elle une **case d'arrivée** ?

| Type de document | Détecté | Lexique | Case d'arrivée | Verdict |
|---|---|---|---|---|
| Notification d'admission | ✅ | ✅ validé sur pièce réelle | ✅ | ✅ **couvert** |
| Relevé de situation | ✅ | ✅ (section partagée) | ✅ sauf AJ brute → refusée | 🔶 couvert, cf. §7 |
| Bulletin de paie (artiste **et** enseignement) | ✅ | ✅ détaillé | ✅ | 🔶 **codé, jamais validé sur pièce** |
| AEM | ✅ | 🔶 section « BULLETIN DE PAIE / AEM », **aucun libellé propre à l'AEM** | ✅ | 🔶 déclaré, aucun signal spécifique |
| Déclaration fiscale annuelle | ✅ | 🔴 **aucune section** | — | 🔴 **trou n°1** (§6.1) |
| Attestation CPAM | ✅ | 🔴 aucune section, seulement une règle de refus | 🔴 **aucune** | 🔴 **trou n°2, double** (§6.2) |
| Contrat d'enseignement | 🔴 absent de l'énumération | 🔴 | — | 🔴 tombera en `non_reconnu` |
| Attestation de taux (PAS) | 🔴 absent de l'énumération | 🔶 le taux est lisible sur notification/relevé | ✅ le champ existe | 🔶 champ couvert, document non |

**Le piège le mieux traité, à ne pas dégrader** : sur une notification, la phrase « … fin de votre
contrat de travail du DATE_A ayant permis l'ouverture de vos droits jusqu'à votre date anniversaire,
soit le DATE_B inclus » contient deux dates à un an d'écart, qui vont dans **deux champs différents**
(DATE_A → `dateAnniversaire`, DATE_B → `dateLimiteIndemnisation`). L'erreur a été réellement observée
en test, et coûtait un an sur la borne qui commande tout le décompte des 507 h. Le prompt la traite
trois fois (lexique, cas d'erreur, relecture finale). Ne jamais alléger ce passage.

---

## 6. Les deux trous — chantiers découplés, à ne pas mélanger

### 6.1 Déclaration fiscale annuelle — ⬜ VOLONTAIREMENT NON COMBLÉ (décision du 29/07/2026)

**Ce n'est pas une dette, c'est un abandon assumé.** Ne pas le rouvrir sans raison nouvelle.

Le constat technique reste vrai : le type est annoncé au modèle et présent dans l'énumération, mais
aucun libellé ne lui dit quoi en tirer. Ce qui a changé, c'est l'évaluation de ce que le combler
rapporterait.

- **Le seul champ atteignable est `tauxPrelevementSource`** — une **précision** (§4), pas un
  bloquant, et qui a déjà **deux sources couvertes et validées sur pièces réelles** : la notification
  et le relevé de situation. On écrirait donc une section de lexique pour offrir une *troisième*
  source à un champ facultatif qui en a déjà deux qui fonctionnent.
- Tout le reste d'une déclaration fiscale (revenus déclarés, impôt) n'a **aucune** case d'arrivée dans
  Cadence, et ne doit pas en recevoir une pour l'occasion.
- Le travail resterait contenu — mais *contenu* ne veut pas dire *utile*. Il exigerait quand même un
  spécimen réel (§2) pour un gain quasi nul.

Le type reste dans l'énumération : sa détection est inoffensive, et `info_seule` est la destination
résiduelle prévue pour ce qu'on ne sait pas exploiter.

### 6.2 Attestation CPAM — chantier à part entière, touche `engine/`

Trou double, et le second est le vrai obstacle :

1. Aucune section de lexique (seulement une règle de refus : un arrêt de travail qui ne permet pas de
   trancher entre `ald` et `maladie_intercontrat` ne doit **pas** produire de proposition, les deux
   ayant des effets **opposés** sur le décompte).
2. **Aucune case d'arrivée.** `periodes` est lu partout — fenêtre de référence, décompte des 507 h —
   mais **aucune fonction ne permet d'en créer une** : ni setter dans `App.tsx`, ni UI. Une extraction
   parfaite serait affichée sans pouvoir être appliquée.

**Découpage acté le 29/07/2026 — ce sont DEUX chantiers, et le plus important n'a rien à voir avec
l'IA :**

- **(a) L'app ne sait pas enregistrer une période assimilée. Du tout, par aucun moyen.** Pas seulement
  depuis une extraction : ni setter, ni écran de saisie. Quelqu'un qui a eu un congé maternité, une
  ALD ou un accident du travail **ne peut pas le déclarer à la main non plus**, alors que ces périodes
  valent 5 h/jour dans les 507 h ou allongent la fenêtre de 365 j. C'est un manque **fonctionnel** de
  l'app, indépendant de tout l'import IA, et il sous-compte silencieusement les heures de qui est
  concerné. **Ne demande aucun spécimen**, se teste entièrement. → **prochaine étape du projet.**
- **(b) L'IA ne sait pas lire une attestation CPAM** : aucune section de lexique, et le piège
  `ald` / `maladie_intercontrat` (effets **opposés**) que l'extraction refuse déjà de deviner. Dépend
  d'un spécimen réel, et sans objet tant que (a) n'existe pas. → **en attente, rien à faire.**

⚠️ **(a) n'est PAS un simple formulaire.** Le moteur consomme déjà les périodes à trois endroits
(`decompteHeures.ts` : 5 h/jour ; `periodeReference.ts` : allongement de la fenêtre ;
`salaireReference.ts` : SAR, donc **le montant** de l'ARE), et il le fait **sans vérifier aucune
condition**. Construire l'écran de saisie, c'est armer cette permissivité. Détail et ordre de travail
dans le plan dédié — à traiter type par type contre le guide officiel, jamais par un setter générique.

- **À ne pas faire** : glisser (a) ou (b) dans la même étape que 6.1. Une ligne de prompt et une
  écriture dans le moteur du 507 h ne se relisent pas avec la même exigence.
- **Conséquence en attendant** : déposer une attestation CPAM ne sert à rien. À dire à l'écran (§4).

---

## 7. Le cas brut/nette — rattaché au Point 2, ce n'est PAS un trou neuf

⚠️ **À lire avant toute intervention sur `ajReelleHistorique`.** Une même ambiguïté de fond
(les documents France Travail parlent tantôt de brut, tantôt de net) produit **trois** situations
distinctes, dont une seule est ouverte. Les confondre mènerait à corriger deux fois avec deux
solutions différentes.

| Situation | Statut | Où c'est tracé |
|---|---|---|
| Le canal IA pourrait écrire un brut dans un champ net | ✅ **Fermé** — `routageExtraction.ts` refuse toute proposition dont `natureMontant ≠ "net"`, à l'évaluation **et** à l'écriture | CLAUDE.md, commit `d3ebb36` |
| La valeur **déjà stockée** dans le profil est peut-être un brut traité comme net (**écart ~5 % sur tous les montants mensuels**) | 🔴 **OUVERT** | CLAUDE.md, « Point 2 non résolu » |
| Un utilisateur ne déposant que des relevés n'obtient jamais de montant, sans savoir pourquoi | 🟡 Conséquence UX du refus, **pas un défaut** | Ce document, §4 |

**Ce que la checklist peut faire** : de la signalétique, et rien d'autre — indiquer que l'AJ nette se
lit sur la **notification**, pas sur le relevé. Aucun calcul, aucune conversion, aucune écriture.
Cela ne préempte aucune des solutions possibles au Point 2.

**Ce que la checklist ne doit pas faire** : convertir un brut en net. Aucune conversion fiable
n'existe — `calculerAJNette` est à sens unique, exige un SJM absent du document, et est elle-même
documentée comme une estimation, alors que `ajReelleHistorique` interdit tout repli estimé.

**Piste nouvelle pour le Point 2, à confirmer.** Le travail de lexique du 29/07, validé sur une
vraie notification, a établi qu'une notification réelle porte une ligne **« allocation journalière
nette »** explicite. La bonne source existe donc et est identifiée — le Point 2 est *rétréci*, pas
résolu. Ce qui reste inconnu : **lequel des deux chiffres est aujourd'hui dans le profil de Benoît**.
C'est vérifiable en regardant la valeur enregistrée et en la comparant aux deux pièces. Tant que ce
n'est pas fait, ceci reste une piste — ⚠️ **pas** une résolution du Point 2.

---

## 8. Conservé de l'inventaire précédent — fiches de recherche

⚠️ Tout ce paragraphe repose sur la **documentation officielle uniquement** (France Travail
Spectacle, `GUIDEINTERMITTENT.pdf`, circulaires Unédic). Aucun spécimen réel. Utile pour savoir quoi
chercher sur une vraie pièce, **insuffisant pour coder** (cf. §2).

### 8.1 AEM — Attestation Employeur Mensuelle

- **Émetteur** : l'employeur, une AEM par salarié, par mois, **par production**. Transmise à France
  Travail Spectacle en EDI, pas via la DSN.
- **Rôle légal** : **c'est la pièce qui fait foi** pour l'ouverture et le maintien des droits — pas
  le bulletin de paie. Un salarié peut avoir un bulletin correct et des droits faux si l'employeur n'a
  pas transmis l'AEM, ou l'a transmise en retard (échéance : le 15 du mois suivant).
- **Signaux de détection supposés** : « Attestation Employeur Mensuelle », « AEM », « France Travail
  Spectacle », « CNCS », « IDCC ».
- **Piège** : une AEM concerne **une production**. Plusieurs productions le même mois chez le même
  employeur = plusieurs AEM distinctes, à ne **pas** fusionner en un seul contrat.
- **Priorité pour obtenir un spécimen** : la plus facile à obtenir (copie reçue de chaque employeur,
  dont Les Arts Phocéens) et la seule dont le rôle légal justifie une alerte dédiée (§8.5).

### 8.2 Contrat d'enseignement

**Statut au 01/08/2026 : préparation seulement, aucun code d'extraction — pas de spécimen réel.**
Même règle que pour l'AEM avant d'en obtenir un exemplaire (§8.1) : ne pas coder de lexique contre
une mise en page supposée. Un lexique écrit sans pièce réelle a déjà causé des reprises ailleurs
dans ce projet (formulations plausibles au lieu de citations exactes, corrigées après coup sur le
lexique notification/relevé de situation le 29/07/2026) — ne pas répéter l'erreur ici alors qu'elle
est déjà identifiée.

- **Rôle** : seule source possible pour `etablissementAgree` et `enRapportAvecMetier`, aujourd'hui
  saisis à la main et jamais lus automatiquement.
- **Champs probables, TOUS « à confirmer sur pièce »** (déduits du domaine — `types/index.ts`,
  `GUIDEINTERMITTENT.pdf` — pas d'un contrat réel lu) :
  - Nom de l'établissement (conservatoire, école, association…) — **à confirmer** : présenté seul,
    ou accompagné d'un statut/numéro d'agrément explicite ?
  - Nature de l'enseignement (matière, niveau, public) — **à confirmer** : ce champ n'a pas de case
    d'arrivée dans `Contrat` au-delà de `type: "enseignement"` lui-même ; probablement `info_seule`.
  - Base horaire (volume prévu, hebdomadaire ou annuel) — **à confirmer** : un contrat d'enseignement
    couvre souvent une année scolaire complète, pas un mois comme un bulletin — la conversion vers
    des dates de contrat exploitables par Cadence reste à définir sur pièce, pas à deviner ici.
  - Rémunération (taux horaire, ou montant total annuel) — **à confirmer** : selon le document, ça
    peut être un taux horaire à multiplier, ou un montant global déjà calculé — aucune des deux formes
    n'est supposée avant d'en avoir vu une.
  - Dates (début/fin de contrat, souvent une année scolaire) — **à confirmer**.
- **Piège, déjà acté en règle, à rappeler avant tout futur ajout de code** : un contrat
  d'enseignement ne prouve **JAMAIS** `etablissementAgree` par le seul nom de l'établissement cité.
  L'agrément est un statut administratif fixé par arrêté, quasi jamais écrit noir sur blanc sur un
  contrat de travail — même un conservatoire réputé ne suffit pas à mettre `true`. Règle identique à
  celle du bulletin (commit `a934db2`) : ne jamais déduire `true` d'un nom d'établissement seul. Un
  `true` inventé ferait entrer des heures dans les 507 h et afficherait un feu vert non mérité.
  **Ce champ restera très probablement `null` la majorité du temps, même avec un vrai document** —
  c'est le comportement attendu et prudent, pas un signe d'échec du prompt le jour où il sera écrit.
- **Préparation de l'énumération, PAS activée** : `contrat_enseignement` n'est **pas** ajouté à
  `typeDocumentDetecte` dans `src/types/extraction.ts` (l'ajouter en dur créerait un type accepté
  sans aucun lexique pour le remplir, une case morte). Un commentaire réservant le nom marque la
  place prévue — à activer seulement une fois un spécimen réel obtenu et lu, dans le même mouvement
  que l'écriture du lexique correspondant, jamais avant.
- **Ce qu'il faudrait recevoir en premier** : idéalement un contrat d'enseignement représentatif de
  la situation réelle de l'utilisateur (conservatoire ou école dans laquelle il enseigne
  effectivement), plutôt qu'un contrat type générique — un vrai document, même caviardé des données
  personnelles non nécessaires (nom, adresse), reste la seule base fiable pour écrire un lexique qui
  cite plutôt que suppose. Si sa situation réelle ne correspond pas à un contrat annuel classique
  (ex. interventions ponctuelles, plusieurs établissements), le signaler avant l'envoi : la forme du
  document oriente directement la forme du lexique à écrire.

### 8.3 Bulletin de paie — enseignement

- `typeRemuneration: "heures"` **toujours** (jamais de cachet en enseignement).
- **Piège** : un même bulletin peut mélanger heures de cours et heures de réunion/préparation non
  comptabilisables. À vérifier sur pièce avant toute règle — ne pas deviner la mise en page.

### 8.4 Bulletin de paie — artiste (cachet)

- `typeRemuneration: "cachet"`, 12 h/cachet (ou 6 h/jour EEE-Suisse-UK), plafond 28 cachets/mois.
- **Piège déjà documenté dans le SPEC** — le net imposable n'est pas toujours sur une ligne dédiée.
  Trois cas, **dans cet ordre** :
  1. ligne « net imposable » présente → la lire ;
  2. sinon, reconstituer `net imposable = net à payer + retenue à la source` ;
  3. taux PAS à 0 % → la ligne « retenue à la source » peut être **absente**, c'est normal
     (`retenue = 0`) : ne jamais traiter cette absence comme un échec d'extraction.

### 8.5 Alerte proposée « AEM ≠ bulletin de salaire »

Le SPEC (§7.4) porte la phrase sans l'avoir jamais rendue actionnable. Proposition conservée :

- **Déclencheur** : import d'un document détecté comme bulletin (pas AEM, pas notification, pas
  relevé), **à chaque import** — chacun réactive la question « l'employeur a-t-il bien transmis
  l'AEM ? ».
- **Niveau** : `info`. Ce n'est pas un problème de droits, c'est une précision sur la nature de la
  pièce.
- **Où** : `BulletinExtrait.avertissements`, **pas** `AlertCenter` — rappel contextuel à l'import, pas
  un problème persistant à surveiller. Dans `AlertCenter`, ça deviendrait du bruit répété chaque mois.

### 8.6 Attestation de taux (PAS)

- **Origine repérée dans les relevés réels** : le relevé mentionne le taux personnalisé (ex. « taux
  personnalisé de 3,10 % transmis par la DGFIP ») et renvoie vers une attestation de l'espace
  personnel, rubrique « Mes attestations ». C'est cette pièce-là, pas un document fiscal distinct.
- **Piège** : un changement de taux en cours d'année doit être **daté**, sinon un relevé postérieur
  paraîtra incohérent avec un calcul fait sur un taux périmé. Voir aussi l'alerte existante
  `pas_taux_janvier` (mise à jour DGFIP au 1er janvier).
- **Priorité basse** : donnée d'appoint ; le taux est déjà lisible sur la notification et le relevé.

---

## 9. Corrections apportées à l'inventaire précédent

| Ce que disait `inventaire_documents_non_couverts.md` | Réalité vérifiée dans le code |
|---|---|
| AEM « ❌ non couvert » | `aem` **est** dans l'énumération des types détectés, et le lexique a une section « BULLETIN DE PAIE / AEM ». Non **validé** sur pièce, ce qui est autre chose. |
| Bulletin artiste « ❌ non couvert » | Couvert. Ce n'est pas un type de document séparé : c'est le bulletin générique avec `type: "artiste"`. |
| Bulletin enseignement « ❌ non couvert » | Idem, avec `type: "enseignement"` — et les règles `etablissementAgree` y sont écrites en détail. |
| Déclaration fiscale « ✅ couvert (validé) » | **Faux dans le canal IA** : type détecté, **aucune** section de lexique. Le « ✅ » vaut peut-être pour un autre chemin de l'app — non vérifié, à ne pas propager tel quel. |
| Priorité n°1 = obtenir une AEM | La notification d'admission est plus décisive (9 des 16 lignes du §3). L'AEM reste le premier **spécimen** à obtenir pour valider l'extraction, ce qui est un autre objectif. |

**Cause de l'écart** : l'inventaire précédent a été rédigé depuis un cadrage de reprise de session,
sans relecture du code. La confusion **« non couvert » (il faut coder) vs « non validé » (il faut un
document)** en découle directement — et elle est coûteuse : elle aurait fait recoder de l'existant.

---

## 10. Dettes et prochaines étapes

### Dettes assumées, en clair

- 🔴 **Aucun bulletin, AEM, contrat d'enseignement ni attestation CPAM réel n'a été lu.** Les règles
  d'extraction de ces pièces sont écrites contre des mises en page supposées.
- 🔴 **Point 2 (brut/nette) ouvert** — cf. §7. Écart potentiel ~5 % sur tous les montants mensuels.
- 🔴 **Pas de case d'arrivée pour `periodes`** — cf. §6.2.
- 🟡 **Le segment navigateur → `/api/extract-document` n'a jamais été exercé.** `vite dev` ne sert
  pas les fonctions Vercel et répond 404. Le seul appel réel à Mistral est passé par un script Node
  appelant `extractDocument` directement, sur un PDF bidon sans donnée personnelle.

### Étapes, dans l'ordre

1. ✅ **Ce document** — inventaire orienté besoins, zéro code (commit `0c53dee`).
2. ✅ **`lib/documentsRequis.ts`** — fonction pure et testée, 25 tests (commits `6615263`, `02300ef`).
3. ✅ **La checklist dans l'espace dépôt** — rendue au-dessus des deux canaux dans `App.tsx` (et non
   dans le bloc IA : l'information est neutre au canal), lignes repliées, détail au dépliage, les
   trois honnêtetés du §4 (commit `8d613ae`).
4. ⏳ **Saisie des périodes assimilées** — le (a) du §6.2. Prochaine étape du projet. Vérification par
   type contre le guide officiel **avant** tout écran de saisie : le moteur les consomme déjà sans
   condition, l'écran est ce qui armerait le risque.
5. ⬜ **Déclaration fiscale (§6.1) — abandonnée**, pas en attente. Motif au §6.1.
6. ⬜ **Lecture IA de la CPAM** — le (b) du §6.2, en attente d'un spécimen réel.
7. ⬜ **Reporté en fin de projet par décision du 29/07/2026** : tout ce qui touche au déploiement et au
   test réel — `vercel dev`, premier vrai document par l'endpoint, décision de fusion dans `master`,
   corrections de `docs/SPEC.md`. On continue à construire en attendant.

**Ne pas faire dans ces étapes** : toucher à la conversion brut/nette (§7), déduire
`etablissementAgree` d'un nom (commit `a934db2`), ou créer un champ pour des données fiscales qui
n'ont pas de case d'arrivée (§6.1).
