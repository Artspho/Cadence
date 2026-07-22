# Prompt affiné — MVP « Gestion des droits intermittents » (Annexe 10)

> Version consolidée après audit d'exhaustivité. Constantes réglementaires sourcées du **Guide France Travail « Intermittents du spectacle », édition mars 2026**. Périmètre validé : **Annexe 10 uniquement**, **première admission + réadmission**, **estimateur ARE complet (A+B+C), brut ET net**.
>
> **Principe d'exhaustivité :** l'architecture doit *anticiper* toutes les spécificités du régime (modèle de données, emplacements datés en config, backlog documenté au §11). Le MVP en *implémente* le sous-ensemble qui influe sur les trois calculs cœur (décompte 507 h, plafond enseignement, montant ARE). Rien n'est oublié, rien n'est inventé.

---

## 1. Rôle et objectif

Agis en tant qu'architecte logiciel et développeur full-stack expert. Génère le code source complet du MVP d'une **Single Page Application** d'aide à la gestion des droits pour les **artistes du spectacle relevant de l'Annexe 10** (musiciens classiques et assimilés), avec une attention particulière aux artistes-enseignants.

**Règle d'or non négociable :** aucune valeur réglementaire n'est écrite en dur dans la logique métier. Toutes les constantes vivent dans un fichier de configuration **daté, versionné et sourcé**. Toute valeur non certifiée depuis le guide officiel est laissée en `TODO` commenté — jamais devinée.

---

## 2. Stack technique

- **Frontend :** React (TypeScript) + Tailwind CSS.
- **État :** hooks React (`useState`, `useMemo`, `useReducer`).
- **Persistance :** `localStorage` encapsulé derrière une couche `storage/` (fonctions async) remplaçable par une API Node.js/Express sans toucher aux composants.
- **Dates :** `date-fns` (périodes glissantes, anniversaire, allongements → nombreux pièges).
- **Validation :** `zod` sur la config et les entrées utilisateur.
- **Import PDF :** `pdfjs-dist` pour l'extraction **côté client** du texte des bulletins (les données sensibles ne quittent pas l'appareil). OCR optionnel (`tesseract.js`) en repli pour les bulletins scannés. Toute extraction par IA distante serait un choix explicite soumis à consentement (RGPD) — hors MVP.
- **Tests :** Vitest sur le moteur de calcul.

---

## 3. Architecture des dossiers

Séparation stricte moteur pur / UI / stockage :

```
src/
  config/
    franceTravailConfig.ts     # TOUTES les constantes légales, versionnées
  types/
    index.ts                   # Types & modèle JSON
  engine/                      # Fonctions PURES : (données, config) -> résultat
    decompteHeures.ts          # 507 h : cachets, enseignement, assimilées, formation, PTP, EEE
    periodeReference.ts        # Fenêtre 365 j glissante + allongements (maladie, réadmission)
    salaireReference.ts        # SR, SAR aménagé, NHT, NHTM
    areBrute.ts                # AJ brute = A + B + C
    areNette.ts                # Cotisations -> AJ nette estimée
    prediction.ts             # Statut feu vert / feu rouge + clause de rattrapage
    alertes.ts                 # Détection des problèmes à venir (pure)
    cycles.ts                  # Découpage en exercices (historique, ancienneté 5 ans)
    __tests__/                 # Cas de référence tirés du guide officiel
  lib/
    extractionBulletin.ts      # Extraction PDF côté client (pdfjs) -> contrat pré-rempli
  storage/
    localStorageAdapter.ts
  components/
    Dashboard.tsx
    ProjectionChart.tsx        # Graphique signature (héros)
    ContractForm.tsx
    ContractList.tsx
    ImportBulletins.tsx        # Zone de dépôt PDF + revue avant validation
    AlertCenter.tsx            # Bandeau / centre d'alertes
    Historique.tsx             # Frise des exercices précédents
    Simulateur.tsx             # « Et si je signe ce contrat ? »
  App.tsx
```

---

## 4. `franceTravailConfig.ts` — toutes les constantes du régime

Objet typé (`as const`) et validé Zod, avec métadonnées de version. Les valeurs marquées ✅ sont certifiées par le guide mars 2026 ; celles marquées 🔶 `TODO` sont volatiles (revalorisées régulièrement) et doivent être renseignées depuis la source officielle avant mise en production.

```ts
export const franceTravailConfig = {
  meta: {
    version: "2026.03",
    dateEntreeVigueur: "2026-03-01",
    source: "Guide France Travail — Intermittents du spectacle, éd. mars 2026",
    avertissement:
      "Estimation indicative. Ne se substitue pas à une notification officielle de France Travail.",
  },

  // ── Conditions d'affiliation ──────────────────────────────────
  seuilHeures: 507,                 // ✅
  periodeReferenceJours: 365,       // ✅ 12 mois glissants (dernière FCT)
  ageLimiteIndemnisation: 67,       // ✅
  heuresApresDemission: 455,        // ✅ admission possible malgré démission

  // ── Décompte des heures ───────────────────────────────────────
  heuresParCachet: 12,              // ✅
  plafondCachetsParMois: 28,        // ✅ (Annexe 10)
  heuresParJourEEE: 6,              // ✅ EEE/Suisse/UK, artistes
  heuresAssimileesParJour: 5,       // ✅ maternité, adoption, AT, ALD, suspension

  // ── Heures d'enseignement (comptent pour 507 h, PAS pour le montant) ──
  enseignement: {
    plafondMoins50ans: 70,          // ✅
    plafond50ansEtPlus: 120,        // ✅
    plafondCumulEnseignementFormation: 338, // ✅ 2/3 de 507
  },
  formation: {
    plafond: 338,                   // ✅ formation non rémunérée, limite 2/3
    // Cumul enseignement + formation également plafonné à 338 h.
  },

  // ── Formule de l'AJ brute (Annexe 10) : AJ = A + B + C ────────
  are: {
    ajMinimale: 31.96,              // ✅ depuis 01/07/2023
    plancherAnnexe10: 44,           // ✅ AJ brute minimale
    plafond: 174.80,                // ✅ depuis 01/01/2024
    partieA: { seuilSR: 13700, coeffSousSeuil: 0.36, coeffAuDelaSeuil: 0.05, diviseur: 5000 }, // ✅
    partieB: { seuilNHT: 690,   coeffSousSeuil: 0.26, coeffAuDelaSeuil: 0.08, diviseur: 507 },  // ✅
    partieC: { coeff: 0.70 },       // ✅ AJ minimale × 0,70 (Annexe 10)
  },

  // ── Cotisations sur l'AJ (pour l'AJ nette) ────────────────────
  cotisations: {
    seuilExoneration: 31.96,        // ✅ AJ brute < ce seuil : aucune cotisation
    seuilRetraiteCompl: 60,         // ✅ 31,96 < AJ ≤ 60 : retraite compl. seule
    tauxRetraiteComplementaire: 0.0093, // ✅ 0,93 % du SJM
    tauxCSG: { normal: 0.062, reduit: 0.0380 }, // ✅ selon barème d'imposition
    tauxCRDS: 0.005,                // ✅
    tauxAlsaceMoselle: 0.015,       // ✅ régime local
    diviseurSJM_Annexe10: 10,       // ✅ SJM = SR / (NHTM / 10)
  },

  // ── Réadmission & clause de rattrapage ────────────────────────
  readmission: {
    affiliationMajoreeParPeriode: 42, // ✅ h suppl. par tranche…
    tranchePeriodeJours: 30,          // ✅ …de 30 j au-delà du 365e
    // En période allongée : diviseur A = NH × SMIC horaire ; diviseur B = NH.
    clauseRattrapage: {
      dureeMois: 6,                   // ✅
      seuilBas: 338, seuilHaut: 506,  // ✅ éligibilité entre 338 et 506 h
      ancienneteAnnees: 5,            // ✅
      ancienneteHeures: 2535,         // ✅ 5 × 507 h
      affiliation12mois: 338,         // ✅ 338 h dans les 12 mois précédents
      delaiDemandeJours: 30,          // ✅
    },
  },

  // ── Différés & franchises (module « indemnisation mensuelle », V2) ──
  differesEtFranchises: {
    delaiAttenteJours: 7,             // ✅ une fois par période de 12 mois
    differeSpecifiquePlafondJours: 75,// ✅ (rarement applicable aux CDDU)
    franchiseCongesPayes: {
      tauxAcquisition: 2.5, base: 24, // ✅ (jours travaillés × 2,5) / 24
      plafondJours: 30,               // ✅
      forfaitMensuelBas: 2,           // ✅ si franchise totale ≤ 24 j
      forfaitMensuelHaut: 3,          // ✅ si franchise totale > 24 j
    },
    franchiseSalaires: {
      repartitionMoisMax: 8,          // ✅ répartie sur 8 mois max
      // 🔶 TODO : transcrire la formule EXACTE de la franchise salaires
      //     depuis le guide (implique salaires de la période, SMIC journalier).
      formule: null,
    },
  },

  // ── Indemnisation mensuelle & cumul (module V2) ───────────────
  indemnisationMensuelle: {
    seuilNonIndemnisationJours: 27,   // ✅ (Annexe 10)
    coeffJoursNonIndemnisables: 1.3,  // ✅ jours travaillés × 1,3
    diviseurJoursTravaillesA10: 10,   // ✅ heures mensuelles / 10
    plafondCumulCoeffPMSS: 1.18,      // ✅ ARE + salaires ≤ 118 % du PMSS
  },

  // ── Valeurs volatiles à renseigner (revalorisées régulièrement) ──
  valeursDatees: {
    smicHoraireBrut: null,   // 🔶 TODO (réadmission allongée + heures non quantifiées)
    smicMensuelBrut: null,   // 🔶 TODO (franchise salaires)
    smicJournalierBrut: null,// 🔶 TODO (franchise salaires)
    pmssMensuel: null,       // 🔶 TODO (plafond de cumul)
  },
} as const;
```

---

## 5. Types TypeScript & modèle JSON

```ts
export type TypeContrat =
  | "artiste"          // représentation, enregistrement, répétition, résidence
  | "enseignement"     // compte pour 507 h, exclu du montant
  | "formation"        // non rémunérée, limite 2/3
  | "ptp";             // projet de transition pro : 1 h = 1 h

export type TypeRemuneration = "cachet" | "heures";
export type Territoire = "france" | "eee_suisse_uk"; // EEE : 6 h/jour (artistes)

export interface Contrat {
  id: string;
  date: string;                 // ISO (date de fin de contrat)
  type: TypeContrat;
  typeRemuneration: TypeRemuneration;
  territoire: Territoire;
  nbCachets?: number;
  nbHeures?: number;
  nbJoursEEE?: number;          // si territoire === "eee_suisse_uk"
  salaireBrut: number;          // € bruts AVANT abattement frais pro
  employeur: string;
  etablissementAgree?: boolean; // enseignement : condition de prise en compte
  enRapportAvecMetier?: boolean;// enseignement : condition de prise en compte
  source?: "manuel" | "import_pdf"; // provenance ; un import PDF est revu avant validation
}

// Périodes assimilées (5 h/jour) & événements affectant la période de référence
export type TypePeriode =
  | "maternite" | "adoption" | "accident_travail" | "ald"
  | "suspension_contrat"        // 5 h/jour, comptent pour 507 h
  | "maladie_intercontrat";     // NEUTRALISÉE : allonge la fenêtre de 365 j

export interface PeriodeAssimilee {
  id: string;
  type: TypePeriode;
  dateDebut: string;            // ISO
  dateFin: string;              // ISO
}

export interface Profil {
  dateNaissance: string;        // ISO — plafond enseignement 70/120 h
  dateAnniversaire: string;     // ISO — fin du dernier contrat ouvrant les droits
  situation: "premiere_admission" | "readmission";
  alsaceMoselle?: boolean;      // cotisation locale (AJ nette)
  baremeCSG?: "normal" | "reduit"; // taux CSG applicable
}

// ── Historique : un exercice = un cycle de 12 mois entre deux dates anniversaire ──
export interface Exercice {
  id: string;
  dateDebut: string;            // ISO
  dateAnniversaire: string;     // ISO — fin du cycle
  heuresAtteintes: number;
  objectifAtteint: boolean;     // 507 h atteintes ?
  ajBrute?: number;             // allocation obtenue sur le cycle
  ajNette?: number;
  cloture: boolean;             // exercice passé (true) vs en cours (false)
}

// ── Alertes : problèmes détectés par le moteur ──
export type NiveauAlerte = "info" | "attention" | "critique";
export type CodeAlerte =
  | "rythme_insuffisant"        // projection < 507 avant l'anniversaire
  | "anniversaire_imminent"     // échéance proche + heures manquantes
  | "plafond_enseignement"      // heures d'enseignement qui ne compteront plus
  | "cumul_ens_formation"       // approche des 338 h
  | "plafond_cachets_mois"      // > 28 cachets sur un mois civil
  | "eligible_rattrapage";      // 338–506 h : clause de rattrapage possible

export interface Alerte {
  code: CodeAlerte;
  niveau: NiveauAlerte;
  titre: string;
  message: string;              // formulé côté utilisateur, avec l'action à mener
  actionSuggeree?: string;
}

// ── Import PDF : résultat d'extraction, TOUJOURS revu avant enregistrement ──
export interface BulletinExtrait {
  champs: Partial<Contrat>;     // ce que l'extraction a pu lire
  confiance: Record<string, "haute" | "moyenne" | "faible">; // par champ
  texteBrut: string;            // pour vérification manuelle
  avertissements: string[];     // ex. « montant illisible », « date ambiguë »
}
```

> **Modélisation à respecter :** un artiste au cachet saisit des **cachets** (jamais des heures). Toute conversion (1 cachet = 12 h) est faite par le moteur via la config.

---

## 6. Moteur de calcul (`engine/`) — règles exactes

### 6.1 Période de référence (`periodeReference.ts`)
- Fenêtre de **365 j glissants** se terminant à la date d'anniversaire / dernière FCT.
- Une **`maladie_intercontrat`** indemnisée par la SS **neutralise** ses jours et **allonge d'autant** la fenêtre.
- En **réadmission**, la fenêtre peut être allongée de **42 h par tranche de 30 j** au-delà du 365e jour (borné à la dernière FCT ayant ouvert le droit précédent).

### 6.2 Deux compteurs distincts (à ne jamais mélanger)
- **`heuresPour507`** (module prédictif) : heures + cachets×12 + jours EEE×6 + assimilées×5 + PTP + enseignement **plafonné** (70/120 h selon l'âge à l'anniversaire) + formation (cumul enseignement+formation ≤ 338 h).
- **`SR` / `NHT`** (montant ARE) : **excluent totalement** heures et salaires d'enseignement ET de formation. `SR` = salaires bruts **avant abattement**, hors enseignement. `NHT` = heures travaillées (cachets convertis, EEE, PTP, assimilées) hors enseignement/formation.

### 6.3 Salaire de référence aménagé — `SAR` (`salaireReference.ts`)
Si des périodes maternité / adoption / ALD hors contrat sont retenues dans les 507 h :
```
SAR = [SR / (jours de la période de référence − jours de ces périodes)] × jours de la période de référence
```
Le SAR remplace alors le SR dans la Partie A.

### 6.4 AJ brute (`areBrute.ts`) — Annexe 10
```
A = ajMin × (0,36 × min(SR, 13700) + 0,05 × max(0, SR − 13700)) / 5000
B = ajMin × (0,26 × min(NHT, 690) + 0,08 × max(0, NHT − 690)) / 507
C = ajMin × 0,70
AJ_brute = clamp(A + B + C, plancher = 44, plafond = 174,80)
```
**Réadmission allongée :** diviseur de A = `NH × SMIC horaire`, diviseur de B = `NH` (NH > 507).

### 6.5 AJ nette estimée (`areNette.ts`)
```
SJM (Annexe 10) = SR / (NHTM / 10)
- AJ brute < 31,96 €            -> nette = brute (aucune cotisation)
- 31,96 € < AJ ≤ 60 €          -> − 0,93 % du SJM (retraite complémentaire)
- AJ > 60 €                     -> − 0,93 % SJM − CSG (6,2 % ou 3,80 %) − CRDS (0,5 %)
- Alsace-Moselle                -> − 1,50 % supplémentaire
```
Afficher clairement « net estimé » avec avertissement (l'AJ réelle peut être minorée par d'autres prélèvements).

### 6.6 Module prédictif (`prediction.ts`)
Fonction pure `(profil, contrats, periodes, dateDuJour, config) → StatutPrediction` :
- Cumule `heuresPour507`, calcule le temps restant jusqu'à l'anniversaire, projette le rythme actuel.
- Renvoie : **`securite`** / **`alerte`** (+ heures manquantes par mois) / **`bloque`** (+ signale l'éligibilité potentielle à la **clause de rattrapage** si 338–506 h).
- Le rythme mensuel requis (`rythmeRequis`) est un type discriminé, jamais un `number` brut pouvant
  valoir `Infinity` : `{ atteignable: true; heuresParMois: number }` ou `{ atteignable: false;
  raison: "anniversaire_inconnu" | "delai_expire" }`. Distinction volontaire entre les deux raisons
  (devoir sacré n°2) : `anniversaire_inconnu` = donnée manquante (profil neuf), jamais présentée
  comme une échéance dépassée ; `delai_expire` = anniversaire connu et réellement dépassé (niveau
  `bloque`). Le cas « rythme fini mais humainement absurde » (délai non nul mais minuscule) n'a
  volontairement pas de 3e raison dédiée — nécessiterait un seuil non réglementaire (décision
  produit), différé au backlog (`reprise.md`).

---

## 7. Modules fonctionnels du MVP

1. **Tableau de bord prédictif** (`Dashboard.tsx`) : jauge vert/orange/rouge, AJ brute **et nette** estimées, résumé des heures (dont part enseignement plafonnée et heures assimilées).
2. **Simulateur de plafond d'enseignement** : dans `ContractForm.tsx`, alerte visuelle si la saisie dépasse 70/120 h (ou le cumul 338 h avec la formation) → heures excédentaires non comptées ; contrôle « établissement agréé » et « en rapport avec le métier ».
3. **Estimateur ARE / Simulation** : ajout d'un contrat **virtuel** montrant instantanément l'impact (+/- X €) sur l'AJ estimée. Rappel visuel : l'enseignement n'augmente jamais ce montant.
4. **Import de bulletins PDF** (`ImportBulletins.tsx`) — cf. 7.4.
5. **Centre d'alertes** (`AlertCenter.tsx`) — cf. 7.5.
6. **Historique des exercices** (`Historique.tsx`) — cf. 7.6.
7. **Simulateur de prochain contrat** (`Simulateur.tsx`) — cf. 7.7.

### 7.4 Import de bulletins de paie en PDF

Zone de dépôt (glisser-déposer) où l'utilisateur ajoute un ou plusieurs bulletins PDF ; l'app en pré-remplit des contrats.

- **Extraction côté client** (`lib/extractionBulletin.ts` via `pdfjs-dist`) : lecture du texte, repérage des rubriques du bulletin de paie simplifié (employeur, période/date, brut, nature — cachets vs heures). Repli OCR (`tesseract.js`) si le PDF est une image.
- **Import assisté, jamais aveugle :** l'extraction produit un `BulletinExtrait` affiché dans un **écran de revue** (champs pré-remplis + niveau de confiance + texte brut). L'utilisateur corrige, **puis** valide. Rien n'est enregistré ni ne met à jour le tableau de bord avant validation. Les contrats créés portent `source: "import_pdf"`.
- **Vie privée :** traitement 100 % local, aucun envoi réseau. Afficher une mention claire.
- **Rappel métier :** préciser que la pièce faisant foi auprès de France Travail est l'**AEM**, pas le bulletin ; l'import sert au suivi personnel.
- **Robustesse :** aucune mise en page standard entre logiciels de paie → prévoir les échecs (champ illisible → `avertissements`, saisie manuelle possible). **Phase recommandée : V2** ; le MVP peut se limiter au pré-remplissage du formulaire de contrat.

### 7.5 Centre d'alertes

Fonction pure `detecterAlertes(profil, contrats, periodes, cfg, dateDuJour) → Alerte[]`, dérivée des mêmes données que la prédiction. Alertes calculées à l'ouverture et affichées en tête de tableau de bord (badge par niveau). Cas couverts : `rythme_insuffisant`, `anniversaire_imminent`, `plafond_enseignement` (heures qui ne compteront plus), `cumul_ens_formation` (approche des 338 h), `plafond_cachets_mois` (> 28 cachets sur un mois civil), `eligible_rattrapage`. Chaque alerte porte un niveau, un message orienté action et une action suggérée. *Note : les notifications push / e-mail supposent le futur backend ; en SPA locale, les alertes sont calculées à l'affichage.*

### 7.6 Historique des exercices précédents

`engine/cycles.ts` découpe la carrière en **exercices** (cycles de 12 mois entre deux dates anniversaire) à partir des contrats et des dates anniversaire. `Historique.tsx` affiche une frise : par exercice, heures atteintes, objectif 507 h atteint ou non, AJ obtenue. L'historique alimente aussi le **suivi de l'ancienneté 5 ans** (2535 h ou 5 ouvertures sur 10 ans) utile à la clause de rattrapage.

### 7.7 Simulateur de prochain contrat

`Simulateur.tsx` : l'utilisateur saisit les données d'un **contrat à venir** (type, cachets/heures, salaire brut, date). Le moteur rejoue `calculerHeures`, `areBrute` et `areNette` avec ce contrat ajouté **sans le persister**, et affiche côte à côte : impact sur le statut prédictif (heures, date de franchissement), et **variation du taux journalier** (AJ actuelle → AJ projetée, +/- X € brut et net). Réutilise intégralement les fonctions pures du moteur — aucune logique dupliquée.

---

## 8. Charte graphique & direction visuelle

**Nom de travail :** *Cadence* (le rythme, la régularité — modifiable, tout passe par les tokens).

**Direction :** sombre, premium, calme, très lisible — dans l'esprit de **Finary** et de la propreté des artefacts. Registre émotionnel visé : **réassurance et sentiment de contrôle**, pas le tableau de bord d'alarme. On dépense l'audace à un seul endroit (le graphique de projection) ; tout le reste est discipliné et silencieux.

### 8.1 Tokens de couleur (à mettre dans `tailwind.config`)

```
bg           #0A0C10   fond, near-black légèrement bleuté
surface      #12161D   cartes
surface-2    #161C24   éléments internes (pistes, puces)
line         rgba(255,255,255,.06)   bordures
line-strong  rgba(255,255,255,.10)
ink          #E8EDF4   texte principal
muted        #8B96A6   texte secondaire
faint        #657084   ticks, légendes fines

— Accent & statuts (toujours doublés d'une icône + d'un mot, jamais la couleur seule) —
mint         #3FD69B   accent signature + statut « Sécurité »
amber        #F5C46B   statut « Alerte »
red          #F2726B   statut « Bloqué »

— Couleurs de données (répartition des heures) —
mint    #3FD69B  cachets
teal    #57A9F0  heures scène
violet  #9B8CFF  enseignement
```

Fond global : `--bg` + un halo radial menthe très léger en haut à droite (`radial-gradient(1200px 600px at 78% -8%, rgba(63,214,155,.06), transparent 60%)`).

### 8.2 Typographie

- **Display & chiffres :** `Space Grotesk` (500–700), letter-spacing serré (`-.02em` à `-.03em`) sur les grands nombres. Chiffres tabulaires pour les données.
- **Corps & libellés :** `Inter` (400–600). Labels de cartes en majuscules discrètes (`text-transform:uppercase`, 12 px, `letter-spacing:.03em`, couleur `muted`).

### 8.3 Layout & style

- Conteneur centré, `max-width ~1040px`, respiration généreuse.
- Cartes : `surface`, bordure `line`, `border-radius 18px` (24px pour le héros), padding 20–28px.
- Barre supérieure : logo (carré menthe dégradé), wordmark *Cadence*, pilule « Période 2025–2026 », avatar initiales.
- Bandeau d'avertissement permanent en pied : « Estimation indicative — ne se substitue pas à une notification officielle de France Travail. »

### 8.4 Élément signature : le graphique de projection (le héros)

Ce n'est **pas** une jauge : c'est un graphique **temps → heures cumulées** qui répond à « à mon rythme, est-ce que j'atteins 507 h avant ma date anniversaire ? ». Il contient :

- Axe X = temps, du début de la période de référence à la date anniversaire (ticks mois discrets).
- **Courbe pleine** menthe = heures réellement acquises jusqu'à aujourd'hui, avec aire dégradée menthe en dessous.
- **Prolongement pointillé** menthe = projection au rythme actuel jusqu'à l'anniversaire.
- **Ligne horizontale pointillée** = objectif 507 h (label « Objectif · 507 h »).
- **Marqueur vertical « Aujourd'hui »** + point sur la courbe avec le total d'heures.
- **Point de franchissement** des 507 h avec bulle datée (« 507 h · ~12 oct »).
- Le cadre du héros affiche aussi la **pastille de statut** (Sécurité / Alerte / Bloqué), une phrase courte en clair, et le KPI `361 / 507 h` + « X jours restants ».

### 8.5 Cartes de synthèse (sous le héros, 3 colonnes → 1 sur mobile)

1. **Allocation journalière estimée** — grand chiffre brut (Space Grotesk) + « ≈ X € net / jour » + mention « estimation indicative ».
2. **Répartition des heures** — barre horizontale segmentée (menthe / teal / violet) + légende chiffrée (dont « enseignement 30 h · plafond 70 h »).
3. **Rythme mensuel** — « X h/mois actuel », piste de progression vs « requis Y h/mois », et ligne de statut positive/neutre.

### 8.6 Accessibilité & mouvement

- Jamais la couleur seule pour un statut : toujours icône + libellé. Palette de statut lisible en cas de daltonisme.
- Focus clavier visible, contrastes suffisants, responsive jusqu'au mobile.
- Mouvement **discret** : légère apparition `translateY` des cartes, tracé progressif de la courbe. `prefers-reduced-motion` respecté (aucune animation).

### 8.7 Ton de la copie (voix de l'interface)

Phrases courtes, voix active, du point de vue de l'utilisateur. Exemples : « Tu es sur la bonne trajectoire. », « À ton rythme actuel, tu atteins 507 h autour du 12 octobre. », « Rythme suffisant pour renouveler tes droits ». Les erreurs et états vides guident vers l'action, sans dramatiser.

### 8.8 Composants (rappel)

- `Dashboard.tsx` — héros-projection, cartes de synthèse, bandeau d'avertissement.
- `ContractForm.tsx` — saisie cachet / heures / enseignement / formation / PTP / EEE, validations et alertes temps réel.
- `ContractList.tsx` — récapitulatif trié, distinction visuelle par type, part comptabilisée vs excédentaire.
- `Gauge.tsx` / `ProjectionChart.tsx` — le graphique signature, isolé et réutilisable.

> Une maquette HTML de référence du tableau de bord (état « Sécurité ») accompagne ce prompt : elle fait foi pour le rendu.

---

## 9. Tests unitaires (obligatoires)

- **507 h** : 600 h + 70 h d'enseignement = 670 h → ouvert ; 90 h d'enseignement plafonnées à 70 h (< 50 ans) ; à 50 ans, plafond 120 h.
- **Exclusion enseignement/formation du montant** : deux profils identiques sauf enseignement en plus → **même** AJ.
- **Assimilées** : 100 jours de maternité → +500 h dans le décompte 507 h et SAR appliqué au montant.
- **Maladie inter-contrat** : allonge la fenêtre de 365 j.
- **AJ brute** : cas complet A+B+C + bornes plancher (44 €) / plafond (174,80 €).
- **AJ nette** : chaque palier de cotisation (< 31,96 ; ≤ 60 ; > 60 ; Alsace-Moselle).
- **Réadmission** : allongement + diviseurs modifiés.
- **Alertes** : plafond enseignement dépassé, > 28 cachets sur un mois, rythme insuffisant, éligibilité rattrapage (338–506 h) → codes d'alerte attendus.
- **Cycles** : découpage correct des exercices entre deux dates anniversaire.
- **Simulateur** : ajouter un contrat hypothétique modifie l'AJ du montant attendu, sans muter l'état persistant.

---

## 10. Limites connues

À afficher, selon le cas, dans un « À propos » ou directement dans l'interface.

**Simplifications de périmètre assumées :**
- **Annexe 10 uniquement.** Pas d'arbitrage Annexe 8 ni Régime général (article 65).
- **Coordination européenne (U1/PDU1) non gérée.** La bêta ne calcule pas les dossiers impliquant des périodes d'emploi sous régime étranger (UE/EEE/Suisse/UK) attestées par un formulaire U1 (ex-E301/PDU1). Subtilité à retenir si ce cas est traité un jour : ces périodes comptent pour la durée d'affiliation (totalisation), mais le montant de l'ARE reste calculé sur les seules rémunérations françaises — ce n'est donc pas une simple extension du modèle actuel, mais un mécanisme de calcul distinct. À bien distinguer du cachet ponctuel joué à l'étranger mais déclaré en France : ce cas-là reste couvert normalement par le champ `territoire` du contrat (`"eee_suisse_uk"`), qui n'a rien à voir avec un U1.
- **Estimation, pas décision.** Les montants sont indicatifs ; France Travail seul fait foi.
- Le module « indemnisation mensuelle / cumul » (franchises, seuils, plafond PMSS) n'est pas dans le MVP.
- **Import PDF assisté, pas magique** : extraction locale, revue avant enregistrement, non garantie exacte (pas de gabarit standard). V2.

**Limites structurelles à garder en tête (elles orientent le backlog §11) :**
- **Durabilité des données = maillon faible.** Tout est en `localStorage` : cache vidé, changement d'appareil ou de navigateur → perte de la saisie, sans sauvegarde ni chiffrement de données sensibles. Risque n°1.
- **La saisie manuelle est un frein d'adoption.** La valeur suppose que l'utilisateur entre chaque cachet ; en pratique il décroche. L'import PDF atténue mais reste faillible, et vise le bulletin alors que la pièce qui fait foi est l'**AEM**.
- **Projection linéaire trompeuse.** Extrapoler une pente moyenne ignore la saisonnalité (festivals l'été, creux ensuite) → peut rassurer à tort.
- **Risque de faux « feu vert ».** Heures oubliées ou cas hors périmètre → statut « Sécurité » sur lequel l'utilisateur se fie alors qu'il perd ses droits. Le disclaimer ne suffit pas.
- **Profils mixtes (A10 + A8 + RG) : détection par auto-déclaration, pas automatique.** Le garde-fou (`regimeDeclare` sur `Profil`, §11.A) neutralise le risque pour qui répond honnêtement à l'onboarding/« À propos » (« mixte » et « inconnu »/je-ne-sais-pas suivent le même chemin, conservateur) ; rien n'est déduit des contrats eux-mêmes, donc un profil qui répond « non » à tort resterait un faux « sans le savoir ». Détection automatique = hors périmètre (§11.C).
- **Alertes passives.** En SPA locale, elles se calculent à l'ouverture ; une vraie alerte devrait arriver avant l'échéance, app fermée (→ backend).
- **Onboarding / état vide non spécifiés**, alors que c'est le premier écran vu.
- **Config sans péremption.** Rien ne signale que les règles ont vieilli ; la formule de franchise salaires reste en `TODO` (non transcrite de façon fiable).
- **Amorçage du profil : résolu pour la cohérence situation/date, la revalidation post-onboarding reste V-suivante.** L'onboarding gère « je ne sais pas » et le moteur ne produit jamais de division par zéro ni de faux « bloqué » à 0 heure (déjà vrai). Piège additionnel identifié et fermé : une réadmission SANS date anniversaire connue faisait tourner l'extension de réadmission (`periodeReference.ts`) sur une fenêtre fictive "se terminant aujourd'hui", produisant un seuil ajusté plausible mais faux. `lib/coherenceProfil.ts` (`validerCoherenceProfil`/`validerProfilPourEcriture`) bloque désormais cette combinaison aux 3 portes qui écrivent un profil : Onboarding, édition post-onboarding (À propos, nouveau), et import JSON (via `profilSchema.refine`). Le moteur peut donc supposer un profil cohérent sans jamais avoir à le vérifier lui-même (cf. `docs/validation.md`).
- **Maintenance de la config non attribuée.** Personne n'est désigné pour la mettre à jour à chaque revalorisation / nouvelle convention → risque de dérive silencieuse.
- **Cadre légal léger.** Pas encore de mentions légales / CGU, ni de trajectoire RGPD explicite (dès qu'un backend stockera des bulletins, l'app devient responsable de traitement de données très sensibles, dont le NIR).
- **Historique (`cycles.ts`) sans formule réadmission allongée.** `calculerAJBrutePourFenetre` applique correctement la formule allongée (diviseurs NH×SMIC / NH) pour le calcul courant affiché au tableau de bord et au simulateur, mais `engine/cycles.ts` reconstruit les exercices passés par simple soustraction calendaire (12 mois glissants), sans jamais appeler `periodeReference.ts` ni suivre de `tranchesReadmission` par exercice. L'AJ brute affichée dans `Historique.tsx` pour un exercice passé en réadmission allongée est donc toujours calculée avec les diviseurs standard — à corriger si l'historique doit un jour refléter fidèlement ces cycles-là.

---

## 11. Ajouts priorisés (par phase)

Priorisés autour du but de la bêta : **donner une visibilité claire et fiable de son statut, sans jamais induire en erreur.**

### 11.A — Indispensable AVANT la bêta (peu coûteux, protège la confiance)
- **Export / import JSON** : filet anti-perte de données (le `localStorage` ne suffit pas), et double usage — un ami peut t'envoyer son fichier comme retour d'usage. Priorité absolue.
- **Onboarding + état vide** pédagogiques : saisie guidée de la date anniversaire, de naissance, de la situation ; premier écran clair pour un compte vierge.
- **Bandeau « règles vérifiées au JJ/MM/AAAA »** + lien vers la source, et péremption qui prévient quand la config a vieilli.
- **Garde-fou « situation mixte »** : détecter un profil hors périmètre A10 pur et renvoyer vers France Travail plutôt que d'afficher un chiffre faux.
- **Coaching léger** : ne pas dire « alerte » mais l'action concrète (« il te manque ~3 cachets d'ici fin octobre »). Sert directement l'objectif « aider à s'organiser » ; peu coûteux car le moteur pur fournit tout.
- **Bouton de feedback** (mailto pré-rempli ou lien formulaire) — la bêta doit collecter de l'avis, pas de la télémétrie cachée.
- **PWA installable / offline** : ~80 % de la valeur perçue d'une app native pour une fraction du coût ; cohérent avec le local-first.
- **Validation du moteur contre la réalité** : comparer les sorties ARE au **simulateur officiel France Travail** et à quelques **vraies notifications** des testeurs. Meilleur gage de confiance, coût quasi nul.
- **Transparence du calcul** : un détail « comment on arrive à ce chiffre » (A+B+C, heures comptées vs écartées) — sert la visibilité et aide l'utilisateur à repérer ses erreurs de saisie.

### 11.B — Après validation de la bêta (V2)
- **Backend léger : comptes + sauvegarde chiffrée + synchro multi-appareils** — lève le risque n°1 (perte de données).
- **Notifications e-mail / push** : alertes enfin proactives (avant l'échéance, app fermée).
- **Import PDF assisté** (pdfjs + revue) généralisé.
- **Projection honnête** : baser le futur sur les **contrats déjà signés à venir** (le simulateur devient planificateur) et afficher une **fourchette** plutôt qu'une fausse précision.
- **Module indemnisation mensuelle** : seuil de non-indemnisation (27 j), jours non indemnisables (× 1,3), montant mensuel = AJ × jours indemnisables, plafond de cumul (118 % du PMSS).
- **Différés & franchises** : délai d'attente (7 j / 12 mois), franchise congés payés, franchise salaires (formule à transcrire), différé spécifique, ordre d'application.
- **Suggestion de renouvellement anticipé** : quand l'utilisateur a déjà atteint 507 h avant sa date anniversaire, signaler qu'un réexamen anticipé des droits est POSSIBLE, avec l'action à mener. ⚠️ Prérequis bloquant : la règle de comparaison ancien droit / nouveau droit doit être sourcée et validée (simulateur officiel + cas réels) AVANT toute implémentation — un réexamen anticipé peut baisser l'allocation ; suggérer sans vérifier serait un faux feu vert (devoir sacré n°2).

### 11.C — Fiabilité maximale (V3)
- **Ingestion de l'AEM** (pièce qui fait foi) en plus des bulletins ; suivre une éventuelle **API France Travail**.
- **Annexe 8 + article 65** : profils mixtes réels, arbitrage RG vs annexe, droit d'option.
- **Prise en charge des périodes U1/PDU1** (coordination européenne UE/EEE/Suisse/UK) : même famille qu'Annexe 8/article 65 ci-dessus — des profils qui sortent de l'Annexe 10 pure et demandent un mode de calcul distinct (totalisation des périodes pour la durée d'affiliation, montant sur les seules rémunérations françaises).
- Cas de bord réglementaires : démission (455 h, IPR), maintien à 64 ans, allocations de solidarité (APS/AFD, clause de sauvegarde), proratisation du plafond de cachets sur mois partiel, rappels d'obligations (actualisation, 72 h, absence > 7 j).

> L'architecture (moteur pur + config centralisée) est déjà conçue pour recevoir tout ceci sans réécriture de la logique métier.

### Hors périmètre — pistes à réévaluer (pas dans la trajectoire actuelle)

- **Module frais réels / impôts** : dépôt de factures + calcul automatique des frais réels pour la déclaration de revenus. Relève de la fiscalité, pas de l'assurance chômage → hors du nord de l'app (suivi des droits A10). Dilue le périmètre, engage une responsabilité fiscale, et suppose lecture/stockage de pièces sensibles (chantier type import PDF, V3). À considérer comme un produit distinct, pas comme une extension de Cadence.

---

## 12. Contraintes de code

- Code **propre, modulaire, entièrement commenté en français**, prêt à exécuter.
- Aucune constante légale hors de `franceTravailConfig.ts`.
- Fonctions du moteur **pures et testables**, sans dépendance React ni DOM.
- Cas limites (données manquantes, dates incohérentes) gérés explicitement.
- Aucune valeur réglementaire inventée : `TODO` commenté plutôt qu'une approximation.

---

## 13. Stratégie de lancement — bêta restreinte

**But de la bêta** (auprès d'un cercle d'amis intermittents) : valider une seule hypothèse — *voir clairement son statut aide-t-il vraiment à s'organiser ?* On ne cherche pas la complétude fonctionnelle, mais un signal d'usage.

**Nord de l'app :** la **visibilité du statut**. Chaque écran doit répondre en un coup d'œil à « où j'en suis, et qu'est-ce que je dois faire ». Tout ce qui ne sert pas cette clarté attend.

**Périmètre bêta = MVP (§6–§8) + les items 11.A.** Concrètement : le tableau de bord honnête, la saisie guidée, l'export/import JSON, le bandeau de règles datées, le garde-fou situation mixte, le coaching léger, le bouton de feedback, et idéalement la PWA. **Explicitement hors bêta :** backend, comptes, notifications push, import PDF généralisé, module indemnisation mensuelle (→ 11.B/11.C).

**Priorité n°1 avant de partager l'app :** que personne ne perde ses données et que personne ne reçoive un faux « feu vert ». Ces deux garde-fous priment sur toute nouvelle fonctionnalité.

**Boucle de feedback :** l'export JSON sert aussi à recueillir les cas réels des testeurs (avec leur accord) ; prévoir 2–3 questions simples (« l'app t'a-t-elle aidé à anticiper ? », « as-tu fait confiance au chiffre ? »). Le retour qualitatif prime sur toute métrique — mais surveiller aussi le **signal de rétention** (reviennent-ils ressaisir des données ?), qui dit mieux que tout si l'app aide réellement à s'organiser.
