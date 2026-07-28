# Brief pour Claude Code — Documents à scanner (import IA premium)

> ✅ **Statut (28/07/2026) : analyse reçue de Claude Code et intégrée** dans
> `extraction-schema.ts`, `extract-document.ts` et `SPEC_annexe_IA_premium.md`.
> Ce document garde la liste de travail d'origine à titre de référence, mise
> à jour avec les corrections reçues. Résumé des corrections principales :
> - Nommage : **AEM** (Attestation d'Employeur Mensuelle), pas "AER".
> - `PeriodeAssimilee` existe bien — nouvelle cible `periode_assimilee`
>   ajoutée, avec un piège identifié (voir section dédiée).
> - 6 champs manquants ajoutés : `dateLimiteIndemnisation`,
>   `tauxPrelevementSource`, `dureeDroitsMois`, `dateAnniversairePrecedente`,
>   `situation`, `dateNaissance`.
> - Défaut de conception corrigé : `type` et `territoire` du Contrat sont
>   maintenant nullable (un bulletin de paie ne les indique presque jamais).
> - Brut/net (`ajReelleHistorique`) : confirmé qu'aucune conversion sûre
>   n'existe côté moteur — le point reste non résolu par design, pas par
>   manque de code. Détails dans `SPEC_annexe_IA_premium.md`.
> - Champs à exclure formellement, jamais à proposer : `regimeDeclare`,
>   `salairesHorsAnnexe10PRA` (seul), les constantes de config (plafonds),
>   `activiteHorsAnnexe10` (déprécié), `SoldeIndemnisationDepart.dateDepart`.

---

## Prompt d'origine envoyé à Claude Code (pour référence)

> Je veux étendre l'import IA de Cadence pour qu'un utilisateur premium
> puisse alimenter **toutes** les fonctionnalités de l'app par scan de
> documents, sans jamais avoir à saisir un champ à la main (sauf validation
> ou correction d'un champ proposé par l'IA).
>
> **Étape actuelle : analyse et documentation uniquement — pas de code.**
> On valide le schéma et les noms de champs ensemble avant d'implémenter quoi
> que ce soit.
>
> Peux-tu :
> 1. Lister exhaustivement, à partir de `src/types/index.ts` et des modules
>    `engine/` réels, tous les champs dont Cadence a besoin pour fonctionner
>    pleinement (Contrat, Profil, PeriodeAssimilee si ce type existe encore,
>    ajReelleHistorique, config, SoldeIndemnisationDepart, etc.) ?
> 2. Pour chaque champ, dire s'il existe un document officiel français
>    (bulletin de paie, attestation employeur France Travail, notification
>    France Travail, CPAM, avis d'imposition, attestation Afdas/OPCO...) qui
>    le contient, et lequel précisément ?
> 3. Comparer à la liste de documents que j'ai déjà identifiée ci-dessous
>    (section "Liste de travail") : dire ce qui manque, ce qui est en trop,
>    et corriger les noms de champs/types si besoin ?
> 4. Confirmer si `PeriodeAssimilee[]` existe encore tel quel dans le modèle
>    actuel (vu seulement dans une ancienne version du SPEC, pas confirmé
>    dans le changelog récent), et si oui son schéma exact.
> 5. Confirmer si un champ "plafond formation" et "plafond heures
>    enseignement" existent réellement dans le moteur, et sous quel nom —
>    je ne connais pas les seuils exacts et je ne veux pas les inventer.
> 6. Dire si une conversion brut ↔ net existe déjà quelque part dans
>    `engine/` (utilisée pour un autre calcul) — si oui, le point "brut vs
>    net non résolu" sur `ajReelleHistorique` pourrait se résoudre avec du
>    code déjà existant plutôt que rester un avertissement permanent.
>
> Une fois cette analyse validée avec moi, mets à jour le changelog de
> CLAUDE.md pour tracer ce chantier — comme pour les précédents.

---

## Liste de travail (hypothèse à corriger)

### 1. Contrats de travail → `Contrat[]`
| Document | Statut | Champs visés |
|---|---|---|
| Bulletin de paie (employeur direct ou GUSO) | ✅ déjà spécifié | type et territoire **nullable** (presque jamais indiqués), cachets/heures, salaire brut, employeur |
| **AEM** (Attestation d'Employeur Mensuelle) | ✅ confirmé — c'est la pièce qui fait foi (SPEC §10/§11.C), à prioriser sur le bulletin quand les deux existent | mêmes champs que le bulletin, généralement plus fiable |
| Contrat de travail signé | ❓ toujours à valider (pas de fixture) | utile pour trancher enseignement/formation/PTP et `etablissementAgree`/`enRapportAvecMetier` |

### 2. Ouverture / évolution des droits → `Profil.ouvertureDroits`, `profil_infos`, `ajReelleHistorique`
| Document | Statut | Champs visés |
|---|---|---|
| Notification d'admission ARE | ✅ confirmé, complété | dateOuverture, franchiseCPTotale, delaiAttenteInitial, **dateLimiteIndemnisation**, **tauxPrelevementSource**, dateAnniversaire, **dateNaissance**, **dateAnniversairePrecedente**, **situation**, **dureeDroitsMois**, AJ nette |
| Notification de rejet de droits | ❓ toujours à valider | utile pour un futur écran "pas de droits ouverts" plutôt qu'un état incohérent |
| Notification de changement de situation / réexamen | ❓ toujours à valider | recalcul suite à un événement (nouvel emploi, reprise…) |

### 3. Suivi mensuel → `ajReelleHistorique` (avec prudence brut/net), `info_seule`
| Document | Statut | Champs visés |
|---|---|---|
| Relevé de situation mensuel | ✅ déjà spécifié | AJ officielle (brut — point non résolu), jours non indemnisés, montants |

### 4. Périodes assimilées → `PeriodeAssimilee[]` (✅ confirmé existant)
```ts
export type TypePeriode =
  | "maternite" | "adoption" | "accident_travail" | "ald"
  | "suspension_contrat"      // 5h/jour, comptent pour les 507h
  | "maladie_intercontrat";   // neutralise/allonge la fenêtre de 365j, sans donner d'heures
export interface PeriodeAssimilee { id: string; type: TypePeriode; dateDebut: string; dateFin: string }
```

⚠️ **Piège confirmé** : `ald` et `maladie_intercontrat` ont des effets opposés, et un simple
avis d'arrêt de travail CPAM ne permet pas de trancher lequel s'applique. Dans ce cas précis,
l'extraction doit produire une proposition `info_seule` (jamais un type deviné) et laisser le
choix à l'utilisateur en saisie manuelle.

| Document | Statut | Champs visés |
|---|---|---|
| Attestation congé maternité/paternité/adoption (CPAM) | ❓ à valider (pas de fixture), mais cible claire | `periode_assimilee` — type non ambigu |
| Notification de reconnaissance AT/MP | ❓ à valider (pas de fixture) | `periode_assimilee` (accident_travail) |
| Avis d'arrêt de travail simple (CPAM) | ❓ à valider — **jamais un type deviné** | `info_seule` uniquement (ald vs maladie_intercontrat indiscernable) |
| Attestation de versement IJ (CPAM) | ❓ à valider | `info_seule` (montants, pas le type de période) |

### 5. Formation (plafonds confirmés — constantes de config, pas des champs à extraire)
```
config.enseignement.plafondMoins50ans                 = 70
config.enseignement.plafond50ansEtPlus                = 120
config.enseignement.plafondCumulEnseignementFormation = 338  // 2/3 de 507
config.formation.plafond                              = 338
```
Ces seuils sont des paramètres de l'app, **jamais extraits d'un document**. Une attestation
Afdas/OPCO ne fournit que des heures de formation, qui deviennent un simple `Contrat` de type
`formation` — pas de nouvelle cible nécessaire.

| Document | Statut | Champs visés |
|---|---|---|
| Attestation de fin de formation (Afdas/OPCO) | ❓ à valider (pas de fixture) | `contrat` (type = formation, nbHeures) |

### 6. Fiscalité → `info_seule` (recalage) ou `profil_ouverture_droits`/`profil_infos`
| Document | Statut | Champs visés |
|---|---|---|
| Déclaration fiscale annuelle (France Travail) | ✅ déjà spécifié | récapitulatif annuel, `info_seule` |
| Avis d'imposition | ❓ à valider (pas de fixture) | `Profil.alsaceMoselle` (champ réel, distinct de `regimeDeclare` qui reste exclu — voir §7), `tauxPrelevementSource` (déjà routé vers `profil_ouverture_droits`) |

### 7. Explicitement exclus du scan IA (confirmé + complété)
- RIB / coordonnées bancaires, pièce d'identité, justificatif de domicile,
  **numéro de sécurité sociale (NIR)** — jamais extraits même s'ils
  apparaissent dans un document.
- `regimeDeclare`, `salairesHorsAnnexe10PRA` (seul), les constantes de config
  (plafonds), `activiteHorsAnnexe10` (déprécié), `SoldeIndemnisationDepart.dateDepart`
  — voir le détail des raisons dans `SPEC_annexe_IA_premium.md` §4bis.

### Limite à connaître : pas d'exemple réel pour les documents "à valider"

Contrairement aux 4 documents déjà spécifiés (bulletin, notification, relevé,
déclaration fiscale), pour lesquels on a de vrais exemples dans le projet,
on n'a **aucune fixture réelle** pour l'AER, l'avis d'imposition, les
documents CPAM ou les attestations Afdas/OPCO. L'extraction sur ces
documents sera donc moins fiable tant qu'on n'a pas au moins un exemple de
chacun à tester — à signaler comme limite connue, pas à résoudre en
inventant une structure.

### Priorisation (confirmée, avec une nuance)

**Implémenter d'abord les 4 documents déjà spécifiés et validés** (bulletin/AEM,
notification d'admission, relevé de situation, déclaration fiscale annuelle) —
confirmé par Claude Code. **Nuance** : `dateLimiteIndemnisation` et
`tauxPrelevementSource` sont sur la Notification d'admission, donc à inclure
dès cette V1, pas en V2 (déjà fait dans `extraction-schema.ts`).

Le reste (formation, avis d'imposition, CPAM, contrat signé) reste une **V2** :
utile pour la vision à long terme, mais pas bloquant pour lancer l'import IA
en premium, et risque de faire perdre du temps sur des documents rares avant
d'avoir validé les plus fréquents.

---

## RGPD — un point pas encore traité

- **Les documents "périodes assimilées" (arrêt maladie, maternité, accident
  du travail) révèlent des données de santé** — catégorie spéciale au sens
  de l'article 9 du RGPD, un cran au-dessus d'une donnée personnelle
  classique. Le consentement générique déjà conçu pour l'import IA ne suffit
  pas pour ce type de document précis : il faut un **consentement
  spécifique**, affiché seulement quand ce type de document est scanné, qui
  nomme explicitement qu'il s'agit d'une donnée de santé.
- **Minimisation réelle, pas seulement apparente.** Dire "on n'extrait pas le
  RIB" ne veut pas dire que Mistral ne *voit* pas le RIB — le PDF entier
  transite quand même, même si le champ n'est pas repris dans la sortie
  structurée. L'écran de consentement doit le dire clairement, plutôt que
  laisser croire à une protection totale.
- **DPA (accord de traitement des données) avec Mistral** : à vérifier ou
  signer réellement dans la console Mistral, pas seulement s'appuyer sur les
  CGU générales du site — avant tout usage sur des documents réels.

## Note d'implémentation — Mistral gratuit pour les tests

Décision prise : utiliser le tier **"Experiment"** gratuit de Mistral La
Plateforme (OCR/Document AI inclus, ~1 milliard de tokens/mois, très
rate-limité) pendant toute la phase de développement/tests.

**Règle à faire respecter par Claude Code :** une seule variable
(`MISTRAL_API_KEY`) désigne la clé utilisée — gratuite en dev, payante dès
qu'un vrai document d'un vrai utilisateur (même Benoît en test réel) passe
dans le pipeline. Le garde-fou RGPD (tier payant = pas d'entraînement,
gratuit = à vérifier dans la console Mistral) doit être documenté en
commentaire à côté de cette variable, pas juste dans ce brief.

---

## Non-régression — ✅ confirmée par Claude Code le 28/07/2026

Les deux points tiennent, avec une nuance à garder en tête pour le texte de
l'UI : le worker pdfjs est chargé depuis un CDN (jsdelivr) — le PDF ne
quitte jamais le navigateur, mais "100 % local" n'est pas exact au sens
réseau. Ne pas dire "100% local" sans cette nuance dans l'interface.

## Entrée CLAUDE.md — ✅ écrite par Claude Code le 28/07/2026

Claude Code a écrit l'entrée lui-même (avec 4 ajustements par rapport à mon
brouillon : chemins réels `docs/files/…`, statut ⬜ "analysé pas construit",
ajout du piège CPAM ald/maladie_intercontrat, ajout de la distinction entre
les deux "net" du projet — `MontantMensuelResultat.montantNet` est le
prélèvement à la source, pas les cotisations). Rien à refaire ici.

## 🔴 Blocage identifié — pas de backend dans Cadence (résolu : sortie de bêta décidée)

Claude Code a arrêté l'implémentation avant de coder : Cadence est une SPA
statique Vite/PWA, **zéro backend** (confirmé : aucun dossier `api/`, aucune
dépendance serveur dans `package.json`). Trois conséquences qu'il a
soulevées, toutes justes :
- `MISTRAL_API_KEY` ne peut pas vivre côté client (finirait dans le bundle,
  donc public) — un composant serveur est obligatoire, pas un raccourci.
- Le choix de plateforme (Vercel/Netlify/Cloudflare/Supabase) appartient à
  Benoît — ça détermine hébergement, secrets, et où transitent les documents.
- Ça contredisait le SPEC §11.B, qui plaçait backend + comptes hors bêta.

**Décision de Benoît (28/07/2026) : sortir de la bêta, mais le besoin
immédiat est minimal.** Pas besoin de poser toute l'infra auth/base de
données/paiement maintenant — juste **un backend qui existe, portable,
déployable sur Vercel (ou ailleurs)**. `extract-document.ts` est déjà écrit
avec une signature Web standard (`handler(req: Request): Promise<Response>`)
qui fonctionne sur Vercel et se porte sans réécriture vers d'autres
hébergeurs. Auth/DB/Stripe sont un chantier séparé, à mener plus tard quand
le gate premium sera construit — pas une condition pour que l'extraction
fonctionne. Voir détail dans `SPEC_annexe_IA_premium.md` §1.

---

## Prompt de finalisation — à donner à Claude Code maintenant

> Trois décisions sur les points que tu as soulevés :
> 1. **Runtime Edge**, pas Node — ajoute `export const config = { runtime: 'edge' };`
>    dans `api/extract-document.ts`.
> 2. **Ajoute la garde explicite** sur `MISTRAL_API_KEY` manquante — un
>    message d'erreur clair au lieu du 500 générique actuel si la clé n'est
>    pas définie.
> 3. **Ajoute `MISTRAL_API_KEY=` à `.env.example`**, avec un commentaire
>    rappelant le piège : jamais `VITE_MISTRAL_API_KEY` (Vite inline les
>    variables préfixées `VITE_` dans le bundle client, la clé deviendrait
>    publique).
>
> Une fois ces trois points faits, on passe à l'écran de revue avec des
> extractions **simulées** (une fixture `ExtractionResult` en dur, pas
> d'appel réel à Mistral) : ça valide l'UX et le routage vers
> `ajouterContrat`/`modifierProfil` sans dépendre de l'infra ni faire
> transiter le moindre document tant que le DPA Mistral n'est pas réglé.
> Tu peux démarrer cette partie directement après les trois points ci-dessus.
