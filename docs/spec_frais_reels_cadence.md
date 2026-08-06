# Spec — Module Frais Réels Cadence
Source de vérité réglementaire : document SNAM-CGT "Frais professionnels" (mars 2026)

---

## 1. Objectif du module

Permettre à chaque intermittent de saisir ses dépenses professionnelles au fil de l'année,
d'uploader ses justificatifs, et de voir en temps réel si les frais réels sont plus avantageux
que l'abattement forfaitaire de 10 % — avec, en sortie, un texte prêt à copier-coller
dans la déclaration impots.gouv.fr.

---

## 2. Qui peut utiliser les forfaits 14 % et 5 % ? (SNAM §2)

Trois profils, comportements distincts dans l'app :

| Profil | Forfait 14 % | Forfait 5 % |
|--------|-------------|-------------|
| Artiste musicien (revenus exclusivement artistiques) | ✅ | ✅ |
| Artiste/enseignant (artistique NON accessoire) | ✅ sur revenus artistiques + enseignement | ✅ sur revenus artistiques + enseignement |
| Artiste/enseignant (artistique accessoire) | ✅ sur revenus artistiques SEULEMENT | ✅ sur revenus artistiques SEULEMENT |
| Enseignant pur (aucune activité artistique) | ❌ | ❌ |

→ Champ `profilFiscal` dans le profil Cadence (à ajouter) :
  `"artiste_exclusif" | "artiste_enseignant_majoritaire" | "artiste_enseignant_accessoire" | "enseignant_pur"`

---

## 3. Base de calcul R (SNAM §3)

R = somme des éléments suivants, plafonnée à 145 550 € (2025) :
- Salaire net imposable de l'activité artistique
- Indemnités ARE (allocation chômage France Travail)
- Remboursements et allocations pour frais professionnels (hors défraiements exclus — cf. §C4)
- Indemnités Congés Spectacles
- Indemnités journalières de maladie ou de maternité

→ Champs à saisir dans le module (section "Mon revenu imposable artistique") :
  `salaireNetImposable`, `allocationsAre`, `congesSpectacles`, `indemnitesJournalieres`

Cadence peut pré-remplir `allocationsAre` depuis le total ARE calculé dans l'onglet indemnisation.

---

## 4. Structure des dépenses — catégories SNAM

### A — Forfait 14 % (pas de justificatif requis si qualité d'artiste incontestable)
Pour artistes musiciens instrumentistes :
- Achat, entretien, protection des instruments (cordes, archets, primes d'assurance instrument)
- Matériels techniques à usage pro (platines, disques, casques, micros...)
- Second instrument (ex. piano)
- NB : intérêts d'emprunt pour acquisition d'instrument NON compris dans le forfait → C7

Pour artistes chorégraphiques et lyriques :
- Frais de formation (cours de danse, chant, piano, solfège, pianiste répétiteur, langues)
- Frais médicaux restant à charge (kiné, ostéo, acupuncture, soins dentaires prothèse, cordes vocales)
- Instruments et frais accessoires

Mode de calcul : `montantA = 0.14 × R`
Option : si frais réels A > forfait 14 %, l'utilisateur peut basculer en montant réel justifié.

### B — Forfait 5 % (pas de justificatif requis si qualité d'artiste incontestable)
Pour toutes les professions artistiques :
- Frais vestimentaires et de coiffure
- Frais de représentation
- Communications téléphoniques professionnelles
- Fournitures diverses (partitions, métronome, pupitre...)
- Frais de formation
- Frais médicaux spécifiques (autres que ceux du 14 % pour chorégraphiques/lyriques)

Mode de calcul : `montantB = 0.05 × R`
Option : basculable en montant réel si frais réels B > forfait 5 %.

### C1 — Transport domicile ↔ travail (montant réel, justificatifs requis)
- Distance ≤ 40 km : barème kilométrique OU frais réels, justificatif utilisation véhicule + trajets
- Distance > 40 km : déductible en totalité SI éloignement non dû à un choix personnel (sinon plafonné à 40 km)
- Transports en commun : déduire remboursement employeur (50 % légal minimum)
- Véhicule à crédit : intérêts déductibles au prorata usage pro

### C2 — Autres transports pro (montant réel, justificatifs requis)
- Déplacements pour contrats avec employeurs occasionnels
- Frais de garage, parking, péage autoroute ajoutables sur justificatifs

### C3 — Repas supplémentaires sur lieu de travail (montant réel ou forfait)
- Condition : repas impossible à domicile pour raison d'horaires ou d'éloignement
- Non déductible si cantine/restaurant d'entreprise (sauf nécessité médicale)
- Calcul : dépense réelle − 5,45 € (valeur repas domicile 2025) − participation employeur (titres-restaurant)
- Sans justificatifs suffisamment précis : forfait de 5,45 €/repas
- Champ à saisir : nombre de repas concernés dans l'année

### C4 — Repas et hébergement en déplacement (montant réel, justificatifs requis)
- Dépenses hors lieu de travail habituel
- Déduire : remboursements employeur intégrés aux salaires
- NE PAS intégrer aux salaires (et donc ne pas déduire) :
  - Allocation de saison (casinos, théâtres municipaux)
  - Remboursements frais déplacement pendant la saison (musiciens, chefs d'orchestre)
  - Allocations tournées orchestres en France/étranger et festivals
  - Indemnités journalières de défraiement (tournées théâtrales — artistes dramatiques, lyriques, chorégraphiques, régisseurs)

### C5 — Formation et documentation (montant réel, justificatifs requis)
- Ouvrages professionnels, abonnements à publications pro (Lettre du musicien...)
- Cours de chant, danse (si non déjà dans 14 %) pour perfectionnement, répertoire, entretien
- Cours/sessions pour concours renommés

### C6 — Local professionnel à domicile (montant réel, justificatifs requis)
Conditions SNAM :
- Instrument(s) au domicile dédiés aux répétitions, OU aménagements spécifiques (insonorisation)
- Logement > 1 pièce : 1 pièce entière admise
- Studio : max 50 % de la surface
- Surface supérieure : doit être justifiée

Calcul : pourcentage surface pro/surface totale × chaque poste de charge :
- Loyer (locataires) ou intérêts emprunt résidence principale (propriétaires)
- Charges de copropriété, entretien, réparation, amélioration
- Impôts locaux (taxe foncière, taxe d'habitation, TEOM...)
- Chauffage, éclairage, assurance, nettoyage, gardiennage

Champs à saisir : `surfaceTotale` (m²), `surfacePro` (m²), puis les postes de charges annuelles.

### C7 — Matériel, mobilier, fournitures (hors A et B) (montant réel, justificatifs requis)
- Fournitures, imprimés, frais de communication (téléphone, fax)
- Mobilier, matériel, outillage pro
- Usage mixte : réduire en proportion de l'usage privé
- Amortissement si valeur > 500 € HT : annuité linéaire (durée à définir avec services fiscaux)
- Déduction en une fois si valeur ≤ 500 € HT

NB : intérêts d'emprunt pour acquisition instrument déductibles ici (pas dans 14 %)

### C8 — Cotisations professionnelles (montant réel, justificatifs requis)
- Cotisations syndicales : montant réel, sans limitation
- Assurance professionnelle : déductible si obligatoire (convention collective, accord). 
  SNAM considère légitime la déduction même si non obligatoire (sans confirmation administrative).

### C9 — Autres frais pro (montant réel, justificatifs requis)
- Frais de mandats de représentation du personnel (délégués syndicaux, délégués du personnel), net remboursements
- Frais de déménagement pour nouvel emploi ou nouvelle affectation
- Tout autre frais professionnel non listé

### D — Frais spécifiques intermittents (montant réel, justificatifs requis)
- Frais de recherche d'emplois successifs :
  - Déplacements pour auditions/castings
  - Communications téléphoniques liées à la recherche
  - Photographies pro
  - Confection et envoi de CV
  - Inscription à des annuaires professionnels
- Frais d'entretien et développement des connaissances/pratique professionnelle

---

## 5. Règles transverses

### Justificatifs
- Non requis pour A (14 %) et B (5 %) tant que la qualité d'artiste est incontestable
- Requis pour tous les C et D
- À conserver jusqu'au 31/12 de la 3ème année suivant la déclaration (ex: revenus 2025 → jusqu'au 31/12/2028)
- Ne pas joindre à la déclaration — à tenir à disposition de l'inspection

### Remboursements employeur
- Toujours soustraire avant de déclarer
- 50 % Navigo est le minimum légal — certains employeurs remboursent plus
- Remboursements de frais de mission réduisent la base déductible

### Forfaits indépendants et cumulables (SNAM §1)
- 14 % et 5 % sont indépendants l'un de l'autre
- Chaque forfait peut être : appliqué tel quel, ou abandonné au profit du montant réel
- Décision par rubrique, pas globale

---

## 6. Modèle de données TypeScript

```typescript
export type CategorieFrais = 'A' | 'B' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'D';
export type StatutJustificatif = 'fourni' | 'manquant' | 'non_requis';
export type ModeForfait = 'forfait' | 'reel'; // par rubrique A et B

export interface Depense {
  id: string;
  anneeFiscale: number;           // 2025, 2026...
  date: string;                   // ISO — date du ticket/facture (date voyage pour SNCF)
  categorie: CategorieFrais;
  description: string;            // libellé libre
  montantTotal: number;           // TTC payé
  remboursementEmployeur: number; // à déduire (défaut 0)
  partPro: number;                // % usage pro (défaut 1.0 = 100%)
  montantDeductible: number;      // calculé : (montantTotal - remboursementEmployeur) × partPro
  statutJustificatif: StatutJustificatif;
  justificatifNom?: string;       // nom du fichier uploadé
  // Stockage localStorage (mode défaut) :
  justificatifData?: string;      // base64
  // Stockage Google Drive (mode optionnel) — exclusif de justificatifData :
  driveFileId?: string;           // ID Google Drive
  driveWebViewLink?: string;      // URL d'aperçu Drive
  notes?: string;
}

export interface RevenuImposableArtistique {
  anneeFiscale: number;
  salaireNetImposable: number;    // salaires nets imposables activité artistique
  allocationsAre: number;         // ARE (peut être pré-rempli depuis onglet indemnisation)
  congesSpectacles: number;
  indemnitesJournalieres: number; // maladie / maternité
  // R calculé = min(somme, 145_550)
}

export type ProfilFiscalFraisReels =
  | 'artiste_exclusif'                  // 14%+5% sur tout
  | 'artiste_enseignant_majoritaire'    // 14%+5% sur artistique + enseignement
  | 'artiste_enseignant_accessoire'     // 14%+5% sur artistique seulement
  | 'enseignant_pur';                   // pas de forfaits, C seulement

export interface ConfigFraisReels {
  anneeFiscale: number;
  profilFiscal: ProfilFiscalFraisReels;
  revenu: RevenuImposableArtistique;
  modeA: ModeForfait;   // 'forfait' = 14%, 'reel' = somme dépenses A réelles
  modeB: ModeForfait;   // 'forfait' = 5%, 'reel' = somme dépenses B réelles
  // C6 : champs spécifiques local pro
  localPro?: {
    surfaceTotalM2: number;
    surfaceProM2: number;
  };
  // C3 : repas domicile
  nombreRepasC3?: number;  // si pas de justificatifs, calcul forfaitaire 5,45€/repas
}
```

---

## 7. Moteur de calcul (`engine/fraisReels.ts`) — fonctions pures

### Constantes à ajouter dans `franceTravailConfig.ts`
```typescript
fraisReels: {
  plafondBaseR2025: 145_550,        // € — plafond de R pour les forfaits
  tauxForfaitA: 0.14,               // 14%
  tauxForfaitB: 0.05,               // 5%
  tauxForfait10: 0.10,              // abattement forfaitaire standard tous salariés
  plancher10Pct2025: 495,           // € minimum de l'abattement 10%
  plafond10Pct2025: 14_171,         // € maximum de l'abattement 10%
  valeurRepasPersonnel2025: 5.45,   // € — valeur forfaitaire d'un repas au domicile (C3)
}
```

### Fonctions
```typescript
// Calcule R (base pour forfaits A et B)
calculerBaseR(revenu: RevenuImposableArtistique, profil: ProfilFiscalFraisReels): number

// Calcule le total frais réels déclarables
calculerFraisReels(depenses: Depense[], config: ConfigFraisReels): {
  montantA: number;          // 14%×R ou somme dépenses A selon modeA
  montantB: number;          // 5%×R ou somme dépenses B selon modeB
  montantC: Record<string, number>;  // C1..D par sous-catégorie
  totalFraisReels: number;
  forfait10Pct: number;      // 10% × R (borné plancher/plafond)
  avantage: number;          // totalFraisReels - forfait10Pct (positif = frais réels gagnant)
  recommandation: 'frais_reels' | 'forfait_10' | 'identique';
}

// Génère le texte pour impots.gouv.fr (contraintes de caractères strictes)
genererTexteDeclaration(result: ResultatFraisReels, config: ConfigFraisReels): string
```

---

## 8. Interface utilisateur

### Onglet "Frais pro" (nouvel onglet dans la navigation Cadence)

**Section 1 — Mon revenu imposable** (saisie annuelle, pré-remplissage ARE possible)
Champs : salaire net imposable, ARE (pré-rempli), congés spectacles, indemnités journalières.
Affichage : "Base R = X € (plafonnée à 145 550 €)"

**Section 2 — Mes dépenses** (liste chronologique + formulaire d'ajout)
- Bouton "+ Ajouter une dépense" → formulaire modal :
  - Date, catégorie (dropdown avec libellé SNAM), description, montant total TTC
  - Remboursement employeur (défaut 0), part pro % (défaut 100)
  - Upload justificatif (PDF, JPG, PNG) — stocké base64 en localStorage
  - Statut justificatif : fourni / manquant / non requis
- Liste triable par date ou catégorie
- Montant déductible calculé en temps réel
- Badge rouge sur les dépenses catégorie C/D sans justificatif

**Section 3 — Réglages forfaits**
- Mode rubrique A : "Forfait 14 % (X €)" vs "Montant réel (Y €)" — radio avec mise en avant du plus avantageux
- Mode rubrique B : idem 5 %
- Champs C6 si l'utilisateur a coché "J'ai un local pro à domicile" : surface totale, surface pro

**Section 4 — Graphiques comparatifs (deux vues, onglets ou scroll)**

**Vue 1 — Comparaison annuelle (barres horizontales empilées)**
```
Forfait 10 %       [████████████████████████] 2 847 €
Frais réels        [██████████████████████████████████████] 4 312 €
                   dont A (14%)  [████████████] 1 820 €
                   dont B (5%)   [████] 650 €
                   dont C total  [██████████] 1 842 €
Avantage           +1 465 €  → Frais réels recommandés ✓
```
Deux états possibles :
- "Frais réels recommandés" (avantage > 0) — badge vert
- "Forfait 10 % suffisant" (avantage ≤ 0, rare pour artistes qualifiés) — badge ambre

**Vue 2 — Courbe temporelle "au fil de l'année" (ligne sur axe mensuel)**

Axe X = mois de l'année fiscale (jan → déc).
Trois courbes :
- Ligne horizontale pointillée = forfait 10 % (fixe, calculé sur R final estimé)
- Courbe montante = cumul des dépenses C réelles saisies (croît à chaque dépense ajoutée)
- Courbe montante pointillée = cumul C projeté (extrapolation du rythme actuel jusqu'en déc)

Point d'intersection = le mois où le cumul C dépasse la valeur seuil.

Seuil affiché = "Il te manque X € de dépenses C pour dépasser le forfait 10 %"
(NB : pour artistes qualifiés, 14 %+5 % = 19 % > 10 % donc le seuil C est négatif →
afficher "Les forfaits A+B seuls dépassent déjà le forfait 10 %. Chaque euro de frais C est un bonus.")

Marqueur "Aujourd'hui" sur l'axe X, cohérent avec le graphique de projection ARE.

**Section 5 — Sortie déclaration**
Bouton "Générer le texte de déclaration" → textarea avec texte formaté pour impots.gouv.fr.
Bouton "Copier" (clipboard).

Contraintes de format impots.gouv.fr à respecter :
- Caractères autorisés : a-z A-Z 0-9 _ espace é è ç à ù â ê î ô û ä ë ï ö ü . @ : = + * ( ) , ; ' [ ] { } # | ! ? $ % ² " \ / - €
- Caractères INTERDITS : → × ✅ emojis tirets longs guillemets courbes
- Séparateur de dépenses dans une rubrique : ;
- Pas de retours à la ligne multiples

Format du texte généré :
```
A - Frais instruments et materiel 14% : X € (forfait 14% de R)

B - Frais vestimentaires, communications, fournitures 5% : X € (forfait 5% de R)

C1 - Transport domicile-travail : [liste depenses separees par ;] ; Total C1 : X €

C2 - Autres transports : [liste] ; Total C2 : X €

C3 - Repas supplementaires travail : X repas x 5,45 € = X € (ou liste justifies)

...

D - Recherche emploi intermittent : [liste] ; Total D : X €

TOTAL FRAIS REELS : X €
(forfait 10% aurait donne : X €  - avantage frais reels : +X €)
```

---

## 9. Stockage des justificatifs — Google Drive (optionnel)

> ⚠️ **SECTION HISTORIQUE, RETIRÉE AU COMMIT 6 DE LA PHASE 6 (05/08/2026).** Ni le mode A
> (localStorage) ni le mode B (Google Drive) décrits ci-dessous ne correspondent plus au code : tout
> justificatif de frais réels passe désormais par Supabase Storage (même bucket `justificatifs` que
> les autres documents de l'app, cf. `storage/documentsStorage.ts`), et le module Google Drive a été
> supprimé (`lib/googleDriveAuth.ts`, `lib/googleDriveStorage.ts`,
> `components/fraisReels/DriveSettings.tsx` n'existent plus). Conservé tel quel pour la trace du
> raisonnement d'origine, pas comme documentation du comportement actuel.

Deux modes de stockage, choix de l'utilisateur dans les réglages :

### Mode A — localStorage (défaut, zéro config)
- Fichier converti en base64 et stocké dans localStorage
- Limite : ~5 MB par fichier, ~50 MB total localStorage selon navigateur
- Avertissement affiché si stockage localStorage > 80 % de capacité estimée
- Aucune dépendance externe

### Mode B — Google Drive (optionnel, badge "Premium" ou simple option avancée)
- L'utilisateur connecte son Google Drive depuis les réglages Cadence
- À l'upload d'un justificatif : fichier déposé dans un dossier `Cadence/Frais_XXXX/` sur le Drive de l'utilisateur
- Cadence ne stocke en localStorage que : `{ justificatifNom, driveFileId, driveWebViewLink }`
- Avantages : pas de limite de taille, accessible multi-appareils, fichiers consultables directement dans Drive
- Le bouton "Voir le justificatif" dans Cadence ouvre `driveWebViewLink` dans un nouvel onglet

**Interface de connexion Drive :**
- Bouton "Connecter Google Drive" dans Réglages → Frais professionnels
- Une fois connecté, afficher : "Justificatifs stockés dans Google Drive · Dossier : Cadence/Frais_2025/"
- Bouton "Déconnecter" (ne supprime pas les fichiers Drive, retire seulement la liaison)
- Si Drive déconnecté mais des dépenses ont un `driveFileId` : afficher badge "Justificatif sur Drive (non accessible)" — pas de perte de données

**Gestion d'erreur :**
- Upload Drive échoué → fallback proposé en localStorage avec message clair
- Ne jamais bloquer la saisie d'une dépense si Drive indisponible : la dépense est enregistrée sans justificatif, statut = 'manquant'

---

## 10. Règles d'architecture Cadence

- Toutes les constantes (14 %, 5 %, 10 %, 145 550 €, 5,45 €, plancher/plafond 10 %) dans `franceTravailConfig.ts`
- Moteur `engine/fraisReels.ts` : pur, zéro React, 100 % testé
- Justificatifs : localStorage (défaut) ou Google Drive (optionnel) — voir §9
- Aucune valeur réglementaire inventée — tout sourcé SNAM-CGT mars 2026 + BOFIP référencé
- Badge disclaimer sur toute sortie : "Indicatif — les règles fiscales peuvent évoluer. Source : SNAM-CGT mars 2026."

---

## 10. Tests obligatoires (`engine/__tests__/fraisReels.test.ts`)

- Artiste exclusif, R = 10 000 € : A = 1 400, B = 500, forfait 10 % = 1 000, avantage = +900 → recommandation frais_reels
- Artiste exclusif, R = 200 000 € : R plafonné à 145 550, A = 14 000 € (arrondi), B = 7 277,50 €
- Enseignant pur, R = 10 000, 0 dépenses C : forfait 10 % = 1 000, frais réels = 0, avantage = -1 000 → forfait_10
- Enseignant pur, R = 10 000, dépenses C = 1 500 : avantage = +500 → frais_reels
- Dépense C6 : calcul pro-rata surface correct (30 m² pro / 90 m² total = 33,3 %)
- Dépense C3 sans justificatif : 52 repas × 5,45 = 283,40 €
- Dépense avec remboursement employeur : montantTotal 200 € − remb 60 € × 80 % pro = 112 €
- Pré-remplissage ARE : allocationsAre inclus dans R
- genererTexteDeclaration : aucun caractère interdit dans la sortie
- modeA = 'reel' avec dépenses A réelles > 14 % : montant réel retenu à la place du forfait
- Dépense avec driveFileId : statutJustificatif = 'fourni', justificatifData absent
- Drive déconnecté + dépenses avec driveFileId existant : données préservées, badge 'non accessible'

---

## 11. Ce qui n'est PAS dans cette version (à noter en TODO)

- Amortissement instrument sur plusieurs années (calcul complexe, cas par cas selon services fiscaux)
- Barème kilométrique (nécessite puissance fiscale + km parcourus — champ futur)
- Vérification du caractère "non choix personnel" pour distance > 40 km
- Gestion multi-années pour l'amortissement
- Export PDF du dossier justificatifs
