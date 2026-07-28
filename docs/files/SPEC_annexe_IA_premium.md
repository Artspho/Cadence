# Annexe SPEC — Import IA & Version Premium (v1)

> À intégrer en annexe de `SPEC.md`. Ne remplace rien de l'existant : le MVP local
> (pdfjs, gratuit, 100 % offline) reste le socle. Ce document décrit ce qui s'ajoute
> **en parallèle**, sans jamais dégrader la confiance dans le gratuit.

---

## 0. Principe non négociable n°3 (s'ajoute aux deux devoirs sacrés)

**Le gratuit reste digne de confiance.** Le moteur de calcul, le dashboard, la
projection et la saisie manuelle restent 100 % gratuits et illimités, pour
toujours. Le premium vend du **confort** (moins de saisie, recalage officiel,
synchro), jamais la fiabilité du diagnostic. Un public d'intermittents aux
revenus précaires ne doit jamais avoir l'impression qu'on lui fait payer la
sécurité de ses droits.

**Non-régression explicite (garde-fous d'implémentation) :**
- **L'import PDF local (pdfjs) reste disponible et gratuit, sans changement.**
  L'import IA est un **canal supplémentaire**, jamais un remplacement — les
  deux coexistent, l'utilisateur choisit.
- **Aucun compte n'est requis pour utiliser une fonctionnalité gratuite.**
  L'app reste utilisable anonymement/en local comme aujourd'hui. Un compte
  (fournisseur d'auth à décider plus tard, cf. §1) n'est demandé que si
  l'utilisateur clique sur "Importer avec l'IA" — jamais comme mur d'entrée
  global.
- Les propositions IA passent par les **mêmes setters** que la saisie
  manuelle (`ajouterContrat`, `updateProfil`, `ajouterAjReelleHistorique`,
  `ajouterPeriodeAssimilee`) — pas de logique d'écriture parallèle qui
  pourrait diverger entre saisie manuelle et import IA.

RGPD : tout envoi de document à l'IA distante est une action **explicite et
opt-in** (case non pré-cochée), avec mention claire du fournisseur réellement
utilisé (Mistral AI, cf. §4bis) et du fait que le traitement est transitoire.

---

## 1. Ce qui change dans l'architecture

> **Décision du 28/07/2026 : sortie de bêta.** Le MVP était une SPA 100 %
> locale, sans backend (confirmé par Claude Code : zéro dossier `api/`,
> zéro dépendance serveur dans `package.json`). Le §11.B plaçait backend et
> comptes hors bêta — décision inversée, mais **le besoin immédiat est
> minimal** : juste un backend qui existe, portable, déployable sur Vercel
> (ou ailleurs). L'auth, la base de données et le paiement sont des besoins
> **séparés**, à décider quand on construira réellement le gate premium —
> pas une condition pour faire fonctionner l'extraction elle-même.

**Ce qu'il faut maintenant, rien de plus :**

| Besoin | Choix | Pourquoi |
|---|---|---|
| Backend pour cacher `MISTRAL_API_KEY` | Une fonction serveur, peu importe l'hébergeur exact | La clé ne peut pas vivre côté client — c'est la seule contrainte dure |
| Portabilité Vercel/ailleurs | Signature Web standard (`handler(req: Request): Promise<Response>`) plutôt qu'une API propriétaire à un hébergeur | `extract-document.ts` est déjà écrit comme ça — fonctionne sur Vercel (Edge ou Node), et se porte sans réécriture vers Cloudflare Workers, Netlify, ou un Node standard |
| Emplacement du fichier | `api/extract-document.ts` à la racine du projet | Convention Vercel Functions ; la plupart des hébergeurs reconnaissent aussi ce dossier |

**Ce qui n'est PAS décidé maintenant, et n'a pas besoin de l'être :**
- Auth (Better Auth, Clerk, Supabase Auth, autre) — nécessaire seulement
  quand on construit vraiment le gate premium/abonnement.
- Base de données (Drizzle+Neon, Supabase, autre) — même remarque : sert à
  stocker le statut d'abonnement, pas à faire fonctionner l'extraction.
- Stripe — même chantier que l'auth, plus tard.

Repousser ces trois décisions ne bloque rien : l'extraction IA peut
fonctionner et être testée (avec la clé Mistral gratuite) avant même qu'un
seul utilisateur ait un compte.

Dossier minimal, à la racine :

```
api/
  extract-document.ts   # POST : PDF (base64) -> JSON structuré (voir §2)
```

**Dette technique à corriger en même temps** (relevée par Claude Code) :
- `zod-to-json-schema` est importé par `extract-document.ts` mais absent de
  `package.json` — à ajouter.
- Les fichiers vivaient dans `docs/files/` (hors `src/`, hors tsconfig) —
  jamais type-checkés malgré une apparence de compilation propre. À déplacer
  dans l'arborescence réelle du projet.

### Contraintes Vercel confirmées (29/07/2026, après premier déploiement test)

- **🔴 Piège nommage** : la variable d'env doit s'appeler `MISTRAL_API_KEY`,
  **jamais** `VITE_MISTRAL_API_KEY` — Vite inline toute variable préfixée
  `VITE_` dans le bundle client, ce qui rendrait la clé publique. À déclarer
  dans les env vars du projet Vercel (Production + Preview), jamais dans un
  fichier commité.
- **Runtime retenu : Edge** (`export const config = { runtime: 'edge' }`) —
  la signature `(req: Request): Promise<Response>` est déjà l'API Web
  standard, donc nativement celle de l'Edge Runtime. Plus portable si
  changement d'hébergeur plus tard.
- **Limite de taille de requête ≈ 3 Mo de PDF** (le base64 gonfle la taille
  d'environ 33 %, plafond Vercel ~4,5 Mo/requête). Les documents France
  Travail (texte natif, quelques pages) passent large. Si un jour ça
  coince : upload direct vers un stockage + envoi d'une URL à Mistral
  (`document_url` accepte déjà une URL publique) — pas la peine avant
  d'en avoir besoin.
- **Timeout Edge ≈ 25s** pour la première réponse. À surveiller au premier
  test réel sur un document multi-pages ; bascule vers Node + `maxDuration`
  si jamais dépassé.
- Aucun `vercel.json` nécessaire pour ce cas simple : `api/extract-document.ts`
  à la racine devient automatiquement `/api/extract-document`.

---

## 2. Extraction IA — deux familles de documents

### 2.1 Bulletins de paie (contrats employeurs)
Reprend le `BulletinExtrait` déjà modélisé dans `types/index.ts` → alimente un
`Contrat`. **L'import pdfjs local existant n'est pas touché** — c'est un
**second canal**, réservé au premium : l'utilisateur choisit d'utiliser
l'import IA (serveur, via Mistral) en plus de l'import local déjà en place,
jamais à sa place. Format variable d'un employeur à l'autre → confiance par
champ toujours affichée.

### 2.2 NOUVEAU — Documents France Travail (relevé de situation, notification d'admission)

Format **standardisé** (contrairement aux bulletins) → extraction beaucoup
plus fiable. Et surtout : ces documents contiennent des **chiffres officiels**
directement comparables à la prédiction interne du moteur. C'est le levier de
confiance identifié au §11.A du SPEC (« Validation du moteur contre la
réalité »), maintenant automatisé.

Champs confirmés à partir des documents réels du dossier de test :
- **Notification d'admission** : AJ nette journalière, date de début
  d'indemnisation, date de fin de contrat retenue, **date anniversaire**,
  salaire de référence, nombre d'heures travaillées, délai d'attente,
  franchise congés payés.
- **Relevé de situation** : période, nombre d'allocations journalières
  versées, montant brut/net, jours non indemnisés (motif + nombre), et le
  bloc « INFORMATIONS SUR VOS DROITS » qui donne l'AJ brute officielle et le
  salaire journalier de référence officiel — exactement ce qu'il faut pour
  recaler le moteur.

```ts
// types/documentFranceTravail.ts

export type TypeDocumentFT = "notification_admission" | "releve_situation";

export interface DocumentFranceTravailExtrait {
  typeDocument: TypeDocumentFT;
  dateDocument: string;                 // ISO
  identifiant: string;                  // numéro identifiant FT (ex: 6282784N)

  ouvertureDroits?: {                   // présent sur une Notification d'admission
    dateDebutIndemnisation: string;
    dateFinContratRetenue: string;
    dateAnniversaire: string;           // date anniversaire officielle
    ajNetteJournaliere: number;         // € — à comparer à la prédiction interne
    salaireReference: number;           // SR officiel
    nombreHeuresTravaillees: number;    // NHT officiel
    delaiAttenteJours?: number;
    franchiseCongesPayesJours?: number;
  };

  situationCourante?: {                 // présent sur un Relevé de situation
    periodeDebut: string;
    periodeFin: string;
    nbAllocationsJournalieres: number;
    montantBrut: number;
    montantNet: number;
    joursNonIndemnises?: { motif: string; nombre: number }[];
    indemnisationDepuisLe?: string;
    dateLimiteIndemnisation?: string;   // = date anniversaire
    ajBrutJournalier?: number;
    salaireJournalierReference?: number;
  };

  confiance: Record<string, "haute" | "moyenne" | "faible">;
  avertissements: string[];
  texteBrut: string;                    // toujours conservé pour vérif manuelle
}
```

### 2.3 Le recalage — la fonctionnalité premium la plus forte

Nouvelle fonction pure, testable comme le reste du moteur :

```ts
// engine/recalage.ts
function comparerAvecOfficiel(
  predictionInterne: StatutPrediction,
  documentFT: DocumentFranceTravailExtrait
): EcartRecalage {
  // Compare AJ, SR, NHT, date anniversaire internes vs officiels.
  // Signale un écart au-delà d'un seuil (ex: >5%) : repère une erreur de
  // saisie (heures oubliées, mauvais SR) AVANT que ça devienne un problème.
}
```

C'est l'argument de vente naturel : *« L'app qui vérifie ses propres calculs
contre tes vrais relevés officiels. »* — c'est aussi ce qui protège le mieux
contre le risque n°1 identifié dans l'audit (« faux feu vert »).

---

## 3. Modèle Premium — abonnement mensuel

**Reste gratuit pour toujours :** moteur de calcul, dashboard, projection,
saisie manuelle illimitée, export/import JSON, PWA offline.

**Devient payant (abonnement mensuel) :**
- Import IA (bulletins de paie **et** documents France Travail)
- Recalage automatique vs relevés officiels
- Plus tard, même logique d'abonnement : synchro multi-appareils,
  notifications proactives, module indemnisation mensuelle détaillée (11.B)

**Prix suggéré :** ~2,99 €/mois (ou ~24,99 €/an), avec un premier import
offert pour prouver la valeur avant de payer — public aux revenus précaires,
mieux vaut convaincre par l'usage que par la promesse.

**Parcours utilisateur :**
1. Clic « Importer avec l'IA »
2. Écran de consentement RGPD explicite (case non pré-cochée)
3. Non-premium → Stripe Checkout ; Premium → upload direct
4. Extraction → écran de revue (même principe que le MVP : rien n'est
   enregistré avant validation manuelle)

---

## 4. Plan en phases (simplifié — backend minimal d'abord)

1. **Spec** (ce document) — schémas JSON validés avec Claude Code contre le
   vrai `src/types/index.ts`. ✅ Fait.
2. **Backend minimal** : créer `api/extract-document.ts` à la racine
   (convention Vercel Functions), corriger la dette technique
   (`zod-to-json-schema` dans `package.json`, sortir les fichiers de
   `docs/files/`). **Pas d'auth, pas de base de données à ce stade.**
3. **Déployer sur Vercel** (ou l'hébergeur choisi), tester l'extraction sur
   les vrais documents déjà disponibles avec la clé Mistral gratuite.
4. **UI de consentement + écran de revue** pour tous les types de documents
   (réutilise le pattern de `ImportBulletins.tsx`), routée par cible comme
   décrit en §4bis. Fonctionne déjà à ce stade, sans compte utilisateur.
5. **Gate premium** (auth + base de données + Stripe) : chantier séparé,
   à mener une fois l'extraction elle-même validée. Choix du fournisseur
   d'auth/DB à faire à ce moment-là, pas maintenant.
6. **Recalage** (`recalage.ts`) + affichage de l'écart dans le dashboard.

---

## 4bis. v2 — Bascule vers Mistral + routage complet vers le modèle réel

Suite à la demande d'extraction exhaustive (« tous les chiffres dont Cadence a besoin »),
deux changements par rapport à la v1 de cette annexe (cette section a d'abord été écrite
pour Gemini, puis corrigée : le choix finalement retenu est **Mistral**, pour trois raisons
cumulées — voir comparatif complet échangé en conversation) :

1. **Fournisseur IA : Mistral Document AI (endpoint OCR + `document_annotation_format`)
   au lieu de Claude.** Trois raisons : (a) **RGPD** — entreprise française, hébergement UE,
   l'UE est la juridiction d'origine et non un ajout contractuel ; (b) **prix** — OCR 4 à
   5 $/1000 pages en extraction structurée, de l'ordre du centime par document ; (c) **outil
   dédié** — `document_annotation_format` est un JSON Schema natif conçu spécifiquement pour
   l'extraction structurée de documents, pas un usage détourné d'un modèle de chat généraliste.
   Modèle retenu : **`mistral-ocr-latest`**, alias officiel qui pointe toujours vers l'OCR le
   plus récent (actuellement OCR 4) — pas de numéro de version à coder en dur.

   **Décision tests/prod (28/07/2026) :** tier gratuit **"Experiment"** de La Plateforme
   pendant toute la phase de développement/tests (aucune carte bancaire nécessaire, OCR
   inclus, ~1 milliard de tokens/mois, fortement rate-limité mais largement suffisant pour une
   bêta entre amis). Bascule vers une clé payante **avant** tout document réel d'un vrai
   utilisateur — voir le risque dédié plus bas, la garantie RGPD du tier gratuit n'étant pas
   confirmée avec certitude.

2. **Sortie routée, pas un sac de champs plat.** L'extraction produit des *propositions
   d'écriture*, chacune ciblant un endroit précis du **modèle réel** de Cadence — **confirmé
   par Claude Code contre `src/types/index.ts`** le 28/07/2026 (cette table a été corrigée en
   conséquence : nommage AEM au lieu d'« AER », deux champs manquants ajoutés, une cible
   ajoutée) :

   | Document | Cible(s) | Champs |
   |---|---|---|
   | Bulletin de paie / **AEM** (Attestation d'Employeur Mensuelle — la pièce qui fait foi) | `contrat` | `Contrat` (type et territoire **nullable** — presque jamais indiqués sur un bulletin, ne jamais deviner) |
   | Notification d'admission | `profil_ouverture_droits` | `dateOuverture`, `franchiseCPTotale` (jours), `delaiAttenteInitial` (jours), `dateLimiteIndemnisation`, `tauxPrelevementSource` |
   | Notification d'admission | `profil_infos` | `dateAnniversaire`, `dateNaissance`, `dateAnniversairePrecedente`, `situation`, `dureeDroitsMois` |
   | Notification d'admission | `aj_reelle_historique` | AJ **nette** notifiée, datée |
   | Attestation CPAM (maternité, adoption, accident du travail, suspension) | `periode_assimilee` | `type`, `dateDebut`, `dateFin` — **jamais** pour un arrêt maladie non qualifié (voir piège ci-dessous) |
   | Relevé de situation | `aj_reelle_historique` | AJ **brute** officielle, datée — voir point ouvert ci-dessous |
   | Relevé de situation / Déclaration fiscale / arrêt maladie ambigu | `info_seule` | SR, NHT, jours non indemnisés, taux d'imposition, montants — pour un futur recalage, jamais auto-appliqué |

   Chaque proposition est validée **individuellement** par l'utilisateur dans l'écran de
   revue avant d'être dispatchée vers le bon setter de l'app (`ajouterContrat`,
   `updateProfil`, `ajouterAjReelleHistorique`, `ajouterPeriodeAssimilee`…). Rien ne s'écrit
   automatiquement — même principe que le MVP local.

### Piège confirmé — `PeriodeAssimilee.type` ambigu sur les arrêts maladie

`ald` et `maladie_intercontrat` ont des effets **opposés** sur le décompte des 507h (la
première ajoute 5h/jour, la seconde neutralise/allonge la fenêtre sans donner d'heures). Un
simple avis d'arrêt de travail CPAM ne permet pas de trancher entre les deux. Dans ce cas,
l'extraction produit une proposition `info_seule` (jamais un type deviné) et laisse le choix
à l'utilisateur en saisie manuelle.

### Champs et catégories explicitement exclus du périmètre d'extraction (confirmé)

- `regimeDeclare` : signalé par l'utilisateur, jamais déduit d'un scan (décision déjà
  documentée, SPEC §10/§11.C).
- `Profil.salairesHorsAnnexe10PRA` : le proposer seul (sans `regimeDeclare`, lui-même exclu)
  déclenche l'alerte de contradiction si `regimeDeclare = "annexe10_pur"` (commit 4c9cfff) —
  pas de proposition isolée tant que l'UI ne gère pas les deux ensemble.
- Les plafonds enseignement (70/120h selon l'âge) et formation (338h) : ce sont des
  **constantes de config** (`config.enseignement.*`, `config.formation.plafond`), jamais des
  données à extraire d'un document utilisateur.
- `Profil.activiteHorsAnnexe10` : déprécié.
- `SoldeIndemnisationDepart.dateDepart` : choix d'affichage de l'utilisateur, aucun document
  ne le contient.

### Point ouvert — brut/net : confirmé qu'aucune conversion sûre n'existe côté moteur

Claude Code a vérifié `engine/areNette.ts` : `calculerAJNette()` existe mais (a) ne va que
brut → net, aucune fonction inverse, (b) nécessite un SJM (donc SR/NHT recalculés depuis les
contrats) indisponible à la lecture d'un relevé, et (c) est documentée comme une **estimation**
(d'autres prélèvements peuvent encore minorer le montant réel). Or `ajReelleHistorique` est
documenté comme interdisant tout fallback estimé (devoir n°2). **Conclusion : le point reste
non résolu par design, pas par manque de code.** Le champ `natureMontant` (`net`/`brut`/
`indeterminé`) et l'avertissement à la revue restent la seule réponse correcte.

Note annexe : `montantNet` existe déjà dans `MontantMensuelResultat`, calculé comme
`montant × (1 − tauxPrelevementSource/100)` — c'est le **prélèvement à la source**, pas les
cotisations. Ne pas confondre avec la question brut/net de `ajReelleHistorique`.

### ⚠️ Limites restantes

Claude Code n'a pas ouvert ce document ni `ImportDocumentIA.jsx` — son analyse porte sur le
modèle de données réel et sur `extraction-schema.ts`/`extract-document.ts`. Il ne peut pas non
plus vérifier le contenu réel des documents officiels (AEM, formulaires CPAM, attestations
Afdas/OPCO) : les colonnes "quel document contient quoi" restent des hypothèses de travail, pas
des faits vérifiés — aucune fixture réelle pour ces documents-là (contrairement aux 4 déjà
spécifiés).

---

## 5. Risques à surveiller

- **🔴 CRITIQUE — Mistral free tier vs payant.** L'engagement contractuel de Mistral de ne
  jamais utiliser les données pour l'entraînement est documenté pour les **abonnements
  payants** (API payante, La Plateforme, Le Chat Pro/Enterprise). Pour le tier gratuit
  "Experiment", ce point est **ambigu dans les sources trouvées** — l'annonce d'origine de
  Mistral mentionne une "option zero-retention" même gratuite, mais ça n'a pas été confirmé de
  façon certaine. **Ne pas utiliser le tier gratuit sur de vrais documents d'un vrai
  utilisateur** tant que ce n'est pas vérifié directement dans la console Mistral
  (section confidentialité/rétention). Vu le prix dérisoire du tier payant (~1 centime par
  document), la bascule ne coûte quasiment rien une fois sorti de la phase de tests purs.
- **Coût API** par extraction → prévoir un quota par utilisateur pour éviter
  l'abus (même un abonné premium ne doit pas pouvoir spammer l'endpoint).
- **RGPD** : ces documents contiennent des données très sensibles (identifiant
  FT, IBAN partiel, montants d'allocation) → jamais loggés côté serveur,
  traitement strictement stateless.
- **Jamais d'écriture automatique** dans le dashboard sans revue manuelle —
  même principe que le MVP local.
