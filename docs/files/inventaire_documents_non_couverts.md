# Inventaire des documents non couverts — Projet Cadence

> ⚠️ **DOCUMENT REMPLACÉ le 29/07/2026 par `inventaire_donnees_et_documents.md`.**
> Conservé pour mémoire, **à ne plus utiliser comme référence** : trois lignes de son tableau §1
> sont fausses (AEM, bulletin artiste, bulletin enseignement y sont dits « non couverts » alors
> qu'ils sont codés — ils sont « non **validés** sur pièce réelle », ce qui appelle un document et
> non du code). Le remplaçant part des points de blocage réels du code plutôt que des documents,
> corrige ces lignes (§9) et conserve les fiches de recherche du §2 ci-dessous (§8).

Rédigé le 29/07/2026, en attente de relecture par Benoît avant intégration à `docs/`.

**Point de départ honnête** : aucune des pièces du projet ne contient un vrai AEM, un vrai
contrat d'enseignement, un vrai bulletin de paie (enseignement ou artiste), ni une vraie
attestation de taux de prélèvement à la source. Tout ce qui suit s'appuie sur la
documentation officielle (France Travail Spectacle, `GUIDEINTERMITTENT.pdf`, circulaires
Unédic) — **pas** sur un spécimen réel. C'est une différence importante avec le travail déjà
fait sur les relevés de situation / notifications, qui lui a été validé sur tes vraies pièces.
Avant de coder l'extraction, il faut un exemplaire réel (anonymisé si besoin) d'au moins
l'AEM et un bulletin de paie — cf. section « Dette assumée » en bas.

---

## 1. Ce qui est déjà couvert vs pas couvert

| Document | Statut aujourd'hui |
|---|---|
| Relevé de situation France Travail | ✅ couvert (validé sur relevés réels) |
| Notification d'admission ARE | ✅ couvert (validé sur notification réelle) |
| Déclaration fiscale annuelle | ✅ couvert (validé) |
| Justificatif de déclaration mensuelle (actualisation) | ✅ couvert (validé) |
| Bulletin de paie générique (cachet, non typé) | 🔶 partiellement — `extractionBulletin.ts` vise un « bulletin de paie simplifié » générique |
| **Contrat d'enseignement** | ❌ non couvert |
| **Bulletin de paie — enseignement** | ❌ non couvert |
| **Attestation de taux d'imposition (PAS)** | ❌ non couvert |
| **AEM (Attestation Employeur Mensuelle)** | ❌ non couvert |
| **Bulletin de paie — artiste (cachet)** | ❌ non couvert |

---

## 2. Fiches par document

### 2.1 AEM — Attestation Employeur Mensuelle

- **Émetteur** : l'employeur (ou son logiciel de paie), une AEM par salarié, par mois, **par
  production**. Transmise à France Travail Spectacle (dématérialisé, EDI), pas via la DSN.
- **Rôle légal** : **c'est la pièce qui fait foi** pour l'ouverture/le maintien des droits —
  pas le bulletin de paie. Un salarié peut avoir un bulletin correct et des droits faux si
  l'employeur n'a pas transmis l'AEM (ou en retard : échéance le 15 du mois suivant).
- **Champs utiles pour Cadence** (mappage vers `Contrat`) :
  - Employeur (raison sociale, SIRET) → `employeur`
  - Période d'emploi (date début/fin) → `dateDebut`/`dateFin`
  - Nature : cachets ou heures → `typeRemuneration`
  - Nombre de cachets ou d'heures → `nbCachets`/`nbHeures`
  - Rémunération brute → `salaireBrut`
  - Depuis la V5 : IDCC de l'entreprise (remplace le code NAF pour l'annexe 8) — utile
    seulement si Cadence doit un jour distinguer annexe 8/10 depuis le document plutôt que
    depuis la saisie utilisateur (hors périmètre actuel).
- **Signaux de détection** (mots-clés à chercher dans le texte extrait) : « Attestation
  Employeur Mensuelle », « AEM », « France Travail Spectacle », « CNCS », « IDCC ».
- **Piège identifié** : une AEM concerne **une production**. Un même mois avec plusieurs
  productions chez le même employeur = plusieurs AEM distinctes à ne pas fusionner en un
  seul contrat.
- **Recommandation** : V2, seulement après avoir obtenu un vrai spécimen.

### 2.2 Contrat d'enseignement

- **Émetteur** : l'établissement (conservatoire, école agréée, association...).
- **Rôle** : justificatif de départ pour `etablissementAgree` et `enRapportAvecMetier` — les
  deux conditions déjà posées dans le schéma (cf. commit `a934db2`) mais aujourd'hui saisies
  à la main, jamais lues automatiquement.
- **Champs utiles** : établissement (nom + statut si mentionné), volume horaire prévu, taux
  horaire, dates de début/fin (souvent une année scolaire complète, pas un mois).
- **Piège identifié** : un contrat d'enseignement ne prouve **pas à lui seul**
  `etablissementAgree` — la liste des établissements agréés est fixée par arrêté (cf.
  `GUIDEINTERMITTENT.pdf` p.14), un contrat peut mentionner un établissement qui n'y figure
  pas. Ne jamais déduire `etablissementAgree: true` du seul nom de l'établissement lu dans le
  contrat — règle déjà actée pour l'extraction de bulletin, à répliquer ici à l'identique.
- **Recommandation** : V2.

### 2.3 Bulletin de paie — enseignement

- **Différence avec un bulletin artiste** : `typeRemuneration: "heures"` **fixé** (jamais de
  cachet en enseignement, décision produit déjà actée pour les contrats récurrents), et les
  deux conditions `etablissementAgree`/`enRapportAvecMetier` à vérifier avant de compter les
  heures dans les 507 h.
- **Champs utiles** : employeur/établissement, période, nombre d'heures, salaire brut.
- **Piège** : un même bulletin peut mélanger heures de cours et heures de réunion/préparation
  non comptabilisables — à vérifier avec un vrai spécimen avant de coder une règle
  d'extraction (ne pas deviner la mise en page).
- **Recommandation** : V2.

### 2.4 Bulletin de paie — artiste (cachet)

- **Différence avec l'enseignement** : `typeRemuneration: "cachet"`, 12h/cachet (ou 6h/jour
  EEE-Suisse-UK), plafond 28 cachets/mois.
- **Champs utiles** : employeur, date(s) de représentation, nombre de cachets, salaire brut.
- **Piège identifié dans le SPEC** (déjà documenté, à ne pas re-découvrir) : le **net
  imposable** n'est pas toujours affiché en ligne séparée — 3 cas à gérer dans cet ordre :
  1. ligne « net imposable » présente → la lire directement ;
  2. sinon, reconstituer `net imposable = net à payer + retenue à la source` ;
  3. taux PAS à 0 % → la ligne « retenue à la source » peut être **absente** du bulletin,
     c'est normal (`retenue = 0`), ne jamais traiter cette absence comme un échec
     d'extraction.
- **Recommandation** : V2.

### 2.5 Attestation de taux d'imposition (PAS)

- **Origine réelle repérée dans tes relevés de situation** : chaque relevé mentionne déjà le
  taux personnalisé appliqué (ex. *« taux personnalisé de 3,10 % transmis par la DGFIP »*) et
  renvoie vers *« une attestation spécifique accessible depuis votre espace personnel...
  rubrique Mes attestations »* — c'est cette attestation-là qui est visée ici, pas une pièce
  fiscale distincte.
- **Rôle pour Cadence** : donnée d'appoint, pas un chiffre France Travail — sert
  potentiellement à vérifier la cohérence du taux utilisé sur plusieurs relevés successifs,
  ou à alimenter un futur module de reconstitution du net imposable (§11.B du SPEC).
- **Champs utiles** : taux personnalisé (%), date d'effet, éventuellement historique de
  taux si plusieurs figurent sur le document.
- **Piège** : un changement de taux en cours d'année (ex. 3,10 % → autre valeur) doit être
  daté précisément — sinon un relevé de situation postérieur semblera incohérent avec le
  calcul si Cadence compare à un taux périmé.
- **Recommandation** : V2, priorité basse (donnée d'appoint, pas bloquante pour les deux
  devoirs sacrés).

---

## 3. Alerte proposée : « AEM ≠ bulletin de salaire »

Le SPEC (§7.4) porte déjà la phrase clé, jamais transformée en alerte concrète : *« préciser
que la pièce faisant foi auprès de France Travail est l'AEM, pas le bulletin ; l'import sert
au suivi personnel »*. Proposition pour la rendre actionnable :

```ts
// Nouveau code d'alerte, à ajouter à CodeAlerte dans types/index.ts
| "document_non_probant"  // bulletin importé alors que l'AEM est la seule pièce qui fait foi
```

- **Niveau** : `info` (jamais `attention`/`critique` — ce n'est pas un problème de droits,
  juste une précision sur la nature du document).
- **Déclencheur** : à l'import d'un document dont le type détecté est `bulletin_enseignement`
  ou `bulletin_artiste` (pas un `relevé_de_situation`, une `notification`, ni une `AEM`),
  **à chaque import**, pas seulement une fois — un import réactive le doute (l'employeur a-t-il
  bien transmis l'AEM correspondante ?).
- **Message (orienté action, cf. règle de copie du CLAUDE.md)** : quelque chose comme *« Ce
  document est ton bulletin de paie, pas l'AEM. C'est l'AEM transmise par {employeur} à
  France Travail qui compte pour tes droits — vérifie qu'elle a bien été envoyée avant le 15
  du mois suivant. »*
- **`actionSuggeree`** : *« Vérifier sur ton espace France Travail Spectacle que l'AEM
  correspondante a bien été reçue. »*
- **Où l'insérer techniquement** : dans le pipeline d'extraction (`lib/extractionBulletin.ts`
  ou son successeur), **avant** l'écran de revue — la détection de type de document doit
  précéder le pré-remplissage du formulaire, pas seulement le remplissage des champs.
  `BulletinExtrait.avertissements` est déjà le bon endroit pour porter ce message si on
  préfère ne pas en faire une `Alerte` globale du tableau de bord — à trancher : alerte
  ponctuelle liée à l'import (plus proche du contexte) vs alerte pérenne dans
  `AlertCenter` (plus visible mais peut devenir du bruit répété à chaque mois importé).
  Ma recommandation : `avertissements` de `BulletinExtrait`, pas `AlertCenter` — c'est un
  rappel contextuel à l'import, pas un problème persistant à surveiller.

### Distinction technique proposée pour identifier le type de document importé

| Type détecté | Signaux dans le texte extrait |
|---|---|
| AEM | « Attestation Employeur Mensuelle », « France Travail Spectacle », « CNCS », « IDCC » |
| Bulletin de paie (générique) | « Bulletin de paie », « Net à payer », « Cotisations salariales »/« patronales » en lignes séparées, « Cumuls » |
| Contrat d'enseignement | « Contrat de travail », établissement scolaire/conservatoire nommé, volume horaire annuel |

Cette table reste **une hypothèse de conception**, pas une spec validée — à confronter à de
vrais documents avant de l'implémenter, cohérent avec le devoir sacré n°2 (jamais un chiffre
ou une catégorisation inventée).

---

## 4. Dette assumée

🔴 **Aucun de ces 5 designs n'est validé sur une vraie pièce.** Contrairement au travail déjà
fait sur relevés/notifications/déclarations (validé sur tes documents réels), tout ce
document repose sur la documentation officielle générale. Avant d'écrire une seule ligne
d'extraction pour l'un de ces 5 types, il faut au moins un exemplaire réel (le tien ou celui
d'un ami, anonymisé si besoin) — sinon le risque est de coder une reconnaissance de motifs
qui ne matche aucune vraie mise en page, et de devoir tout refaire.

**Priorité suggérée si tu dois en obtenir un en premier** : l'AEM — c'est la seule des 5 dont
le rôle légal (pièce qui fait foi) justifie une alerte dédiée, et la plus simple à obtenir
(tu en reçois normalement une copie de chaque employeur, dont Les Arts Phocéens).

## 5. Prochaine étape suggérée

1. Rassembler un exemplaire réel de chaque document listé (au moins l'AEM en premier).
2. Confronter la table de signaux de détection (§3) à ces vrais documents — corriger avant
   de coder.
3. Ensuite seulement : coder la détection de type + l'alerte `document_non_probant` dans
   `extractionBulletin.ts`.
