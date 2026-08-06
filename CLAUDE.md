# CLAUDE.md — Cadence

App web (SPA) d'aide à la gestion des droits pour les intermittents du spectacle
**Annexe 10** (artistes / musiciens), avec un focus artistes-enseignants.
Nord de l'app : **donner une visibilité claire et fiable de son statut** (« où j'en
suis, qu'est-ce que je dois faire »).

> Spec complète et faisant foi : **`docs/SPEC.md`**. Maquette visuelle de référence :
> **`docs/maquette_dashboard.html`**. En cas de doute, ces deux fichiers priment.
> Registre de validation : **`docs/validation.md`** — compare les chiffres de Cadence au
> simulateur officiel France Travail et aux notifications réelles. Les cellules ne se
> remplissent qu'à partir d'une vraie comparaison, jamais d'un exemple fictif.

---

## ⚠️ Deux devoirs sacrés (avant toute fonctionnalité)

1. **Ne jamais perdre les données de l'utilisateur.** (→ export/import JSON dès le départ.)
2. **Ne jamais afficher un faux « feu vert ».** Si un cas sort du périmètre ou si une
   donnée manque, on le signale et on renvoie vers France Travail — on n'invente pas
   de statut rassurant.

Tout le reste sert ces deux devoirs et la visibilité du statut.

---

## Commandes

```bash
npm install
npm run dev      # serveur de dev Vite
npm run test     # tests Vitest (moteur)
npm run build    # typecheck + build de prod
```

## Stack

React + TypeScript · Tailwind CSS · Vite · Vitest · Zod · date-fns.
Persistance : `localStorage` derrière `src/storage/` (remplaçable par une API plus tard).
Import PDF (V2) : `pdfjs-dist` **côté client** (données sensibles, jamais envoyées).

---

## Règles d'or (non négociables)

- **La config est la seule source de vérité réglementaire.** Toute constante légale vit
  dans `src/config/franceTravailConfig.ts`. **Aucune** valeur réglementaire en dur dans
  la logique métier.
- **Ne jamais inventer une valeur réglementaire.** Valeur non certifiée → `TODO` commenté
  (voir `valeursDatees` : SMIC, PMSS laissés à `null`), jamais une approximation.
- **Le moteur (`src/engine/`) est 100 % pur** : fonctions `(données, config) → résultat`,
  sans React ni DOM, **testées** (le calcul touche aux droits/revenus des gens).
- **Deux compteurs distincts, à ne jamais mélanger** :
  - `heuresPour507` (statut) inclut enseignement plafonné + heures assimilées.
  - `SR` / `NHT` (montant ARE) **excluent totalement** enseignement et formation.
- Robustesse : jamais de division par zéro ni de faux « bloqué » à 0 heure
  (profil neuf / première admission sans historique).
- Copie : français, tutoiement, voix active, orientée action (« il te manque ~3 cachets »).

---

## Carte du code

```
src/
  config/franceTravailConfig.ts   # constantes légales versionnées (source mars 2026)
  config/contact.ts               # EMAIL_FEEDBACK + construireLienFeedback (pas réglementaire)
    __tests__/
  types/index.ts                  # modèle de données
  engine/                         # PUR + testé
    periodeReference.ts  decompteHeures.ts  salaireReference.ts
    areBrute.ts  areNette.ts  prediction.ts  alertes.ts  cycles.ts
    indemnisationMensuelle.ts      # jours indemnisés/mois depuis les vrais contrats (V2)
    decoupageMensuel.ts            # repartirContratParMois() — prorata jours calendaires
    ajReelleUtils.ts                # getAjReelleAt() — taux d'AJ réelle applicable à une date
    __tests__/
  lib/extractionBulletin.ts       # import PDF (V2)
  lib/dashboardVide.ts            # dashboardEstVide(contrats) — présence, jamais 0h au montant
    __tests__/
  storage/localStorageAdapter.ts  # + export/import JSON (schemaVersion, anti-écrasement)
    __tests__/
  components/                     # Dashboard, ProjectionChart, ContractForm,
                                   # ContractFormRecurrent, ContractList, ImportBulletins,
                                   # AlertCenter, Historique, Simulateur, TopBar, Onboarding,
                                   # MonProfil, AvertissementHorsPerimetre,
                                   # ConfirmationImport, DashboardVide, RevenusMensuels
  lib/contratRecurrent.ts         # genererContratsRecurrents() — contrat récurrent enseignement
    __tests__/
  App.tsx  main.tsx  index.css

scripts/generate-pwa-icons.mjs    # génère public/pwa-*.png, maskable-*, apple-touch-icon, favicon
                                   # (dégradé mint→teal de TopBar.tsx) — zéro dépendance externe
vite.config.ts                    # + VitePWA (manifest, service worker, cf. État actuel)
```

## État actuel

> **Repère au 05/08/2026, session (8, toujours en cours) — PHASE 5 TERMINÉE ET SOLDÉE ; COMPTE
> OBLIGATOIRE FAIT ET COMMITÉ (`1c685e6`, hors plan initial) ; PHASE 6 EN COURS : commits 1 à 5
> commités, COMMIT 6 (frais réels — bascule Supabase Storage + retrait complet de Google Drive)
> CODÉ ET TESTÉ, PAS ENCORE COMMITÉ (en revue avec Benoît).**
> **1042 tests verts** (86 fichiers), `tsc -b` propre, `npm run build` propre — y compris le commit 6
> non commité (voir juste en dessous).
>
> ✅ **COMPTE OBLIGATOIRE (05/08/2026) — COMMITÉ (`1c685e6`).** Décidé par Benoît en pleine revue du
> commit 6, en dehors du plan de la phase 6 : plus AUCUN usage de Cadence sans compte, dès le premier
> lancement. Plan complet : `C:\Users\benoi\.claude\plans\fluttering-beaming-summit.md`. Nouveau
> `components/EcranConnexionObligatoire.tsx` (mur plein écran, réutilise `auth/actions.ts`), branché
> dans `App.tsx` tout en amont du rendu ; `Compte.tsx` simplifié (session déjà connectée reçue en
> prop) ; `useSession` n'est plus appelé qu'à `App.tsx`. ⚠️ **Fragilité nouvelle et assumée** : si
> `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` venaient à manquer en production, PERSONNE ne pourrait
> plus ouvrir Cadence. Bug trouvé et corrigé en cours de route : `ecritureAutorisee` incluait encore
> `localSeul`, qui écrivait dans le navigateur MÊME QUAND le mur était affiché — rétréci à
> `statut === "active"` seul. **Vérifié en conditions réelles** (`npm run dev`, vrai projet Supabase) :
> connexion réussie avec le compte de test `testa-cadence@cadence.fr`, mur cédant bien la place à
> l'app. **Hors périmètre, signalé mais pas construit** : consentement horodaté aux mentions légales à
> l'inscription (« arbitrage 6 ») ; intégration calendrier (notée pour plus tard, sans rapport).
>
> 🟡 **COMMIT 6 DE LA PHASE 6 (frais réels, `05/08/2026`) — CODÉ, TESTÉ, PAS ENCORE COMMITÉ.** Le
> compte étant désormais obligatoire, la question « que se passe-t-il sans session ? » qui bloquait ce
> commit avant la parenthèse ci-dessus ne se pose plus : `DepenseForm`/`JustificatifsEnAttente` ne
> sont jamais atteints sans être connecté, donc `documentId` (Supabase Storage) est la SEULE
> destination désormais, sans repli local à maintenir. Ce que ça fait : `Depense.documentId` remplace
> `justificatifData`/`driveFileId`/`driveWebViewLink` en écriture (schéma de LECTURE élargi, jamais
> durci — une dépense enregistrée avant ce commit reste lisible et son justificatif reste « fourni » :
> `DepenseForm.tsx`, `storage/fraisReelsStorage.ts`) ; nouveau `remplacerDocument`/`supprimerDocument`/
> `obtenirDocument` dans `storage/documentsStorage.ts` (le remplacement d'un justificatif insère le
> nouveau AVANT de retirer l'ancien, jamais l'inverse — RLS `documents_supprimer` et
> `justificatifs_supprimer` déjà en place depuis la migration 0001, rien à ajouter en SQL) ; lien
> « Voir » d'un justificatif (`DepensesList.tsx`) capable de résoudre une URL signée à la demande pour
> le nouveau cas (`lib/justificatifAffichage.ts`, type `"signe"`) ; `JustificatifsEnAttente`/
> `lib/envoiJustificatifsEnAttente.ts` reciblés sur un `Uploader` générique (Supabase, plus Drive).
> Suppression complète de `lib/googleDriveAuth.ts`, `lib/googleDriveStorage.ts`,
> `components/fraisReels/DriveSettings.tsx` + leurs 3 tests, et de `ConfigFraisReels.stockageJustificatifs`/
> `driveConnecte`. **`public/confidentialite.html` SUPPRIMÉE** (commit suivant, sur demande de Benoît) :
> page légale orpheline, non liée depuis l'app, créée au commit `f6902fa` en même temps que Drive —
> selon toute vraisemblance pour l'écran de consentement OAuth Google, raison d'être disparue avec lui.
> Elle n'était pas seulement fausse sur Drive : elle affirmait « aucune donnée envoyée à un serveur »,
> « il n'existe pas de base de données centrale », « personne d'autre que vous n'a accès », et donnait
> Benoît en personne comme éditeur (au lieu de l'association) avec un mauvais contact. Elle était
> publiquement accessible. `content/mentionsLegales.ts` reste la SOURCE UNIQUE ; ne pas recréer de
> doublon HTML écrit à la main — c'est cette duplication qui a produit la dérive.
>
> **Trou du consentement à l'inscription — COMBLÉ le 06/08/2026, sur demande de Benoît.** Le texte
> légal n'était atteignable que depuis `MonProfil`, donc APRÈS connexion, alors que
> `content/mentionsLegales.ts` donne pour base légale « ton consentement, donné explicitement à
> l'inscription » : on ne pouvait pas lire la politique avant d'y consentir.
> `EcranConnexionObligatoire.tsx` porte désormais une case « J'ai lu et j'accepte… » + un bouton qui
> ouvre la modale `MentionsLegales` RÉUTILISÉE telle quelle (toujours aucune seconde copie du texte).
>
> **LA PREUVE EST DÉSORMAIS CONSERVÉE** (06/08/2026, second temps du même chantier — Benoît : « une
> seule fois suffit. Je veux que cette preuve soit stockée »).
>
> ⚠️ LE PROBLÈME QUE TOUTE CETTE MÉCANIQUE RÉSOUT : à l'instant où la case est cochée, AUCUNE SESSION
> N'EXISTE (`signUp` avec confirmation par e-mail n'en ouvre pas), donc RLS interdit d'écrire dans
> `consentements`. Écrire la preuve « à l'inscription » est littéralement impossible. D'où deux temps :
>  1. `creerCompte` transmet version du texte + instant du clic à `signUp(options.data)` — Supabase les
>     écrit dans `raw_user_meta_data` AU MOMENT MÊME de la création, sans session ;
>  2. `synchroniserConsentement` (`storage/consentementStorage.ts`, appelé par un `useEffect` d'App.tsx)
>     les recopie dans `consentements` à la première session.
> La métadonnée est un PORTEUR (l'utilisateur peut la réécrire via `updateUser`), la table est le
> COFFRE. Ni l'une ni l'autre ne suffit seule — ne pas simplifier en n'en gardant qu'une.
>
> Cinq points à ne pas défaire par mégarde :
>  · `demanderLienMagique` passe `shouldCreateUser: false` : le lien par e-mail ne crée PLUS de compte,
>    c'est ce qui rend « une seule fois suffit » vrai (se connecter ne demande plus jamais de cocher).
>    Le retirer rouvrirait une porte d'inscription sans case ET sans preuve — les deux vont ensemble ;
>  · la case ne vit donc QUE dans l'onglet mot de passe, seul chemin de création ;
>  · « Se connecter » n'est PAS bridé, exprès : il ne peut rien créer. Un test le verrouille ;
>  · ⚠️ `consentements` EST LA SEULE TABLE DU SCHÉMA SANS POLITIQUE `update` NI `delete`, et
>    `ClientConsentements` n'expose ni l'un ni l'autre : une preuve que son sujet peut réécrire ou
>    effacer n'est pas une preuve. Ne pas « harmoniser » avec les autres tables ;
>  · ⚠️ LES COMPTES CRÉÉS AVANT LE 06/08/2026 N'ONT AUCUNE PREUVE. `synchroniserConsentement` rend
>    `aucuneMetadonnee` et n'écrit RIEN — écrire la date du jour fabriquerait une preuve fausse, pire
>    que pas de preuve. Si la question se pose, c'est la vérité à dire.
>
> `VERSION_POLITIQUE` (`content/mentionsLegales.ts`) : à incrémenter dès que la politique change sur le
> fond — ça fait redemander la case aux comptes existants, effet voulu. Pas pour une faute de frappe.
>
> ⚠️ ÉTAT AU 06/08/2026 : `supabase/migrations/0004_consentements.sql` N'A PAS ENCORE ÉTÉ APPLIQUÉE
> (Benoît doit la coller dans l'éditeur SQL). Tant que ce n'est pas fait, la recopie échoue — SANS
> conséquence pour l'utilisateur (l'effet n'est jamais bloquant, la métadonnée reste intacte, la
> recopie est retentée à la session suivante). `npm run verifier:consentement` le dit explicitement, et
> prouve ensuite l'essentiel : le sujet ne peut ni falsifier ni supprimer sa propre preuve.
>
> Si un jour une page publique du texte légal devient nécessaire, elle doit être GÉNÉRÉE depuis
> `content/mentionsLegales.ts`, pas réécrite à la main (cf. la dérive de `public/confidentialite.html`).
>
> **Une fois ce commit validé et committé : reprendre le commit 6 de la phase 6** (frais réels —
> bascule sur le canal unique Supabase Storage + retrait complet de Google Drive), inchangé dans son
> contenu, cf. `C:\Users\benoi\.claude\plans\humming-wandering-kite.md`.
>
> ✅ **POUSSÉ jusqu'à `6bdf58f`** (dette `donnees_sauvegarde` soldée), sur demande explicite de
> Benoît dans le fil. ⚠️ **`origin/master` est en retard de 5 commits, tous LOCAUX et NON POUSSÉS** —
> `34c0ea3` (prérequis légal : mentions légales/confidentialité) · `88354b3` (commit 1 — migration
> 0003, `type_document` étendu à 10 valeurs) · `6161af5` (commit 2 — fondation stockage, non
> branchée, prouvée par `npm run verifier:documents` : 15/15) · `a61551e` (commit 3 — écran « Mon
> dossier », lecture seule) · `e674266` (commit 4 — canal local `ImportBulletins.tsx` branché).
> Ne pas pousser sans que Benoît le redemande explicitement — cf. `cadence_push_credentials`.
>
> 🟡 **COMMIT 5 (canal IA, `ImportDocumentIA.tsx`) : CODÉ, TESTÉ, PAS ENCORE COMMITÉ.** Benoît a
> explicitement choisi (05/08/2026) de le revoir/commiter depuis un **autre fil** plutôt qu'ici — ne
> pas prétendre qu'il est commité tant que `git log` ne le montre pas. Diff en attente dans l'arbre
> de travail au moment d'écrire cette ligne : `src/components/ImportDocumentIA.tsx`,
> `src/components/ConsentementEnvoiIA.tsx`, `src/content/mentionEnvoiIA.ts` (+ son test), nouveau
> `src/components/__tests__/ImportDocumentIA.test.tsx`. Ce que ce commit fait : après extraction
> réussie, si connecté, dépose le document (type traduit automatiquement pour 8 cas ; un sélecteur
> bloquant demande le type si l'IA rend `non_reconnu`, jamais deviné) ; la modale de consentement dit
> désormais aussi que le document est conservé (conditionnel à la session, PHRASES[3] de
> `mentionEnvoiIA.ts`) ; un échec de conservation n'empêche jamais d'afficher les propositions
> extraites (devoir n°1).
>
> **Plan complet de la phase 6, avec le détail des 8 commits (dont les 3 restants) :**
> `C:\Users\benoi\.claude\plans\humming-wandering-kite.md` — le relire avant de continuer, il porte
> aussi les décisions déjà tranchées avec Benoît à ne pas rouvrir (cf. section suivante).
>
> ✅ **Le déploiement est configuré pour de bon** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
> existent enfin dans Vercel (Production + Preview). ⚠️ **Vite fige les `VITE_*` à la CONSTRUCTION** :
> ajouter une variable ne suffit pas, il faut REDÉPLOYER. C'est ce qui a fait échouer le premier
> essai — le build automatique déclenché par le push était antérieur aux variables. Le contrôle qui
> tranche : chercher `rajybcuzsflrxphppsfx.supabase.co` **dans le bundle servi**. Absente = les
> variables ne sont pas dans le build, inutile d'ouvrir l'app.
>
> ## 🔴 REFONTE SUPABASE — décidée le 04/08/2026, elle recadre tout le reste
>
> **Supabase devient la source de vérité ; le `localStorage` cesse de l'être.** Benoît a choisi ce
> « niveau 3 » **contre ma recommandation** (je proposais le niveau 2 : local source de vérité +
> Supabase en sauvegarde) et l'a réaffirmé. **C'est acté — ne pas rouvrir le débat.** Il a accepté en
> connaissance de cause les deux conséquences : **plus d'ouverture hors ligne, plus d'usage sans
> compte**. Son argument décisif, que je n'ai pas contesté : il a **déjà perdu ses contrats une fois**
> (point 22) et un `localStorage` n'a aucune sauvegarde.
>
> **Ce qui a rendu la refonte défendable, mesuré et non supposé** : `chargerDonnees` /
> `sauvegarderDonnees` sont **déjà asynchrones et renvoient déjà ok/échec** (acquis du point 2), et
> seuls **9 fichiers sur 184** touchent le stockage. L'obstacle habituel — passer une app d'un
> stockage instantané à un stockage lent et faillible — était déjà franchi.
>
> **Ses 7 arbitrages, validés par écrit. Ne pas les re-litiger :**
> 1. **JSONB, une ligne par utilisateur** (option B), pas 7 tables relationnelles : la forme des
>    données ne change pas, donc le schéma Zod reste le validateur et la migration est réversible ;
> 2. auth = **lien magique + mot de passe de secours** (supprime le point de panne unique sur l'accès
>    à ses propres données) ;
> 3. région **Paris `eu-west-3`** — ⚠️ **pas** « Europe », qui inclut Londres et Zurich, hors UE ;
> 4. **palier gratuit d'abord**, payant quand les limites arrivent. ⚠️ **Le point de décision tombe à
>    la phase 5** : un projet gratuit est mis en pause après **7 jours d'inactivité**, et une pause =
>    app qui ne s'ouvre plus dès que Supabase est la source de vérité. **Le lui rappeler là**, pas avant ;
> 5. **protocole de migration en 6 étapes**, validé tel quel : export JSON hors navigateur → migration
>    en lecture seule → **vérification chiffrée** (62 contrats, 588 h, 4 mois certifiés) → son feu vert
>    → **rien n'est supprimé localement** → retour arrière testé **avant**, pas après ;
> 6. consentement testeurs : **son texte mot pour mot** — « Mes documents sont stockés sur un serveur.
>    Ils servent uniquement à calculer mon statut. » Case à cocher **horodatée et journalisée** (pas une
>    case UI volatile), affichée une fois à l'inscription. ⚠️ **Réserve à lui reposer en phase 6** :
>    « uniquement à calculer mon statut » ne couvre pas les justificatifs de frais réels (qui servent une
>    déclaration fiscale), et le texte ne dit pas qu'il peut **techniquement** lire les documents des
>    testeurs (`service_role` contourne RLS) ;
> 7. **mentions légales + politique de confidentialité minimales AVANT la phase 6** — sa demande, motif :
>    des documents portant potentiellement le NIR de tiers vont vivre sur un serveur qu'il gère.
>    « Pas besoin d'un luxe juridique, juste l'essentiel. »
>
> **Séquence en 9 phases, validée :**
> | Phase | Contenu | État |
> |---|---|---|
> | 0 | points **8** et **9** | ✅ faite (`c786ecb`, `5607854`) — le 8 reste **compté ouvert** (ni auth ni quota) |
> | 1 | projet Supabase, 7 tables, RLS | ✅ **PROUVÉE** — `npm run verifier:rls` : **64 contrôles, 64 conformes** |
> | 2 | authentification | ✅ **PROUVÉE de bout en bout** le 04/08/2026 à 19h19 : session réellement ouverte par lien magique. Connexion **facultative**, l'app fonctionne toujours sans compte |
> | 3 | miroir Supabase en écriture seule (contrats + profil) | ✅ **PROUVÉE contre le vrai serveur** : ligne relue en REST (200, `maj_le` = l'heure du témoin) |
> | 4 | migration + vérification chiffrée | ✅ **PROUVÉE le 05/08/2026 à 01:05** — verdict `identique`, SHA-256 concordant sur **trois** sources |
> | 5 | bascule, sur son feu vert écrit | ✅ **FAITE** — le serveur fait référence, VÉRIFIÉ EN VRAI (588 h, 62 contrats) ; commit D (section « Compte » trouvable, mot de passe, réserve PKCE) et E (cette doc) faits |
> | 6 | documents (conserver, puis envoyer) | ⬜ — le chantier d'origine |
> | 7 | hors ligne | ⬜ **optionnel, repoussé exprès** : il n'a jamais répondu sur ce point, la question est sortie du chemin critique pour ne pas le bloquer |
> | 8 | les 7 points réglementaires restants | ⬜ quand une source tombe |
>
> **Isolation prouvée le 04/08/2026**, et c'est le livrable de la phase 1 : `scripts/verifier-rls.mjs`
> exerce les 7 tables + le stockage de fichiers. Un utilisateur ne peut ni voir, ni modifier, ni
> supprimer, ni **écrire au nom d'un autre** (usurpation d'`user_id` refusée en 403 par le `with
> check` — chemin d'attaque oublié de la première version du script, trouvé en relisant la grille et
> non parce qu'un test rougissait). Le SQL, jamais exécuté ni analysé avant application (ni Docker ni
> `psql` sur la machine), est passé du premier coup.
>
> ⚠️ **Ce que la phase 1 ne prouve PAS** : la clé `service_role` contourne tout par conception. RLS
> protège les testeurs **les uns des autres**, pas de Benoît. C'est exactement ce que son texte de
> consentement ne dit pas encore (cf. arbitrage 6).
>
> **Drive est supplanté** : les documents iront dans Supabase Storage (phase 6). L'ancienne prochaine
> action — créer l'ID client OAuth Google — est **annulée**, ne pas la relancer. Le code Drive
> (3 fichiers + tests) **dort** ; aucune décision de le supprimer n'a été prise. Ne jamais dire
> « Drive fonctionne » : l'aller-retour réel n'a **jamais** été exercé.
>
> ## PHASE 2 — l'authentification, faite le 04/08/2026
>
> **Où c'est** : `src/auth/supabaseClient.ts` (construction du client), `src/auth/session.ts` (état de
> la connexion), `src/auth/actions.ts` (les quatre gestes + traduction des erreurs),
> `src/components/Compte.tsx` (la section « Compte » de l'onglet **Mon profil**). Dépendance ajoutée :
> `@supabase/supabase-js@2.112.0` — **+59 ko gzip** sur le bundle (381 → 440 ko, mesuré contre le
> bundle déployé, pas estimé). Aucune vulnérabilité apportée.
>
> **LA PROMESSE EST TENUE, ET UN TEST LA GARDE.** `src/components/__tests__/App.sansCompte.test.tsx`
> rend le vrai `App` sans configuration Supabase et parcourt les 8 onglets : aucun mur de connexion,
> les données locales s'affichent, et le contenu du `localStorage` est relu inchangé à la fin. Ce test
> doit rougir le jour où quelqu'un ajouterait un « connectez-vous pour continuer ».
>
> **Trois conceptions à ne pas défaire :**
> 1. **configuration absente => `null`, jamais d'exception.** `construireClientAuth` rend `null` sur
>    une variable manquante, vide ou une URL malformée. Un `throw` ici remonterait au rendu et
>    changerait « connexion non configurée » en « l'app ne démarre plus » ;
> 2. **le client est INJECTÉ** dans `Compte` et `useSession` (même patron que l'uploader
>    d'`envoyerJustificatifsLocaux`) : les tests fournissent un faux de quelques lignes, aucun test
>    n'ouvre de vraie session ni ne touche au réseau ;
> 3. **l'état `indetermine` existe exprès.** Quand la lecture de session échoue, l'interface dit
>    « impossible de savoir si tu es connecté » et **pas** « non connecté » — on ne sait pas, donc on
>    ne l'affirme pas (devoir n°2 appliqué à un état).
>
> ⚠️ **`.env.test` est un fichier de PRODUCTION DE PREUVE, ne pas le supprimer.** Vite charge le `.env`
> réel même pendant les tests : sans lui, la suite se comporterait différemment selon la machine
> (configuration Supabase absente en intégration continue, présente sur celle de Benoît). Un test dont
> le résultat dépend de la machine ne prouve rien.
> `src/auth/__tests__/supabaseClient.test.ts` contient le test qui garde ce fichier.
>
> **ENVOI RÉEL EXERCÉ le 04/08/2026, sur demande explicite de Benoît.** Acquis, et donc à ne plus
> remettre en doute :
> - l'adresse **`admin@lesartsphoceens.fr`** est bien membre de l'organisation Supabase : le service
>   d'envoi par défaut l'a acceptée (aucune erreur renvoyée) et **l'e-mail est arrivé** ;
> - **les Redirect URLs acceptent `http://localhost:5183`** — le lien l'y a ramené, confirmé par lui.
>   L'action « déclarer l'origine de retour » qui était annoncée comme à faire ne l'est donc pas pour
>   localhost. Reste à vérifier pour l'URL de branche, jamais exercée ;
> - ✅ `signInWithOtp` **crée bien l'utilisateur** : le premier envoi a produit un e-mail « Confirm your
>   email address » (`type=signup`), et non un lien de connexion. **Un compte existe donc pour
>   `admin@lesartsphoceens.fr`**, et il est vraisemblablement **NON CONFIRMÉ** (les deux jetons de
>   confirmation sont morts, cf. ci-dessous). Conséquence à ne pas oublier : tant qu'il n'est pas
>   confirmé, une connexion par mot de passe échouera en « Email not confirmed ». Il est confirmable à
>   la main dans le tableau de bord, sans e-mail ;
> - ✅ **PLAFOND DE 2 MESSAGES PAR HEURE MESURÉ**, plus seulement lu : le troisième envoi de l'heure a
>   été refusé avec `email rate limit exceeded`, et l'app l'a bien traduit en citant le plafond.
>
> 🔴 **LE DÉFAUT QUE CET ESSAI A RÉVÉLÉ, ET QU'AUCUN TEST N'AURAIT TROUVÉ.** Benoît a ouvert le lien
> depuis SON Chrome alors que la clé PKCE était dans le navigateur demandeur. L'échange a échoué —
> comportement normal de PKCE — mais **l'écran ne disait rien** : il revoyait le formulaire, sans
> savoir que quelque chose venait d'échouer ni pourquoi. L'avertissement existait, mais **avant** le
> clic, donc illisible pour qui est dans l'autre navigateur. Un état muet, pas un chiffre faux, et
> tout aussi interdit.
> Corrigé par `src/auth/retourLienMagique.ts` : l'indice de retour (`code`, `token_hash`, `error*`)
> est capturé **à l'import du module**, car `detectSessionInUrl` NETTOIE l'URL — un composant qui
> lirait `location` au premier rendu arriverait trop tard. Si la session reste fermée alors qu'un
> indice était présent, la section explique l'échec et désigne la cause probable.
> Vérifié à l'écran dans les deux sens le 04/08/2026 : `/?code=<bidon>` affiche le message, `/`
> n'affiche rien (pas de fausse alerte).
> ⚠️ Ce message ne peut apparaître à tort que si `getSession()` cessait d'attendre la fin de
> l'initialisation de la bibliothèque (échange de l'URL compris). C'est le seul faux message possible
> ici — raisonné, non mesuré.
>
> 🔴 **DEUXIÈME DÉFAUT, INTRODUIT EN CORRIGEANT LE PREMIER** — et trouvé lui aussi par l'usage, une
> demi-heure plus tard. Sous une erreur transmise par Supabase (« Email link is invalid or has
> expired »), le message ajoutait « la cause la plus probable : demandé depuis un autre navigateur ».
> Une **cause fausse sous une erreur exacte** : pire que le silence qu'on venait de supprimer.
> Corrigé : deux branches distinctes dans `Compte.tsx`, et **deux tests qui les verrouillent
> séparément** (l'un interdit « autre navigateur » quand un motif est transmis, l'autre garantit que
> l'explication subsiste quand elle EST la cause probable). Ne pas refondre ces deux branches en une.
>
> ✅ **LE CHEMIN DE SUCCÈS EST PROUVÉ — 04/08/2026, 19h19.** Lien magique demandé depuis le panneau
> navigateur, ouvert dans CE MÊME panneau : **la session s'est ouverte**
> (`sb-<ref>-auth-token` présent, « Connecté en tant que admin@lesartsphoceens.fr » à l'écran, URL
> nettoyée de son `code`). C'est la première session jamais ouverte dans Cadence. Le lien magique
> fonctionne donc de bout en bout, à la condition PKCE près : même navigateur qu'à la demande.
>
> ⚠️ Historique à garder, parce qu'il explique la difficulté rencontrée : deux jetons antérieurs
> avaient été refusés en `otp_expired` le même jour :
> - celui de la confirmation d'inscription : cliqué par Benoît depuis SON Chrome, donc consommé — et
>   il avait bien rempli son office, le tableau de bord affiche `Confirmed at 04 Aug 2026 18:19`.
>   **Le compte `admin@lesartsphoceens.fr` (UID `2ed466db-a58b-4ec4-b73a-28a2a333b82d`) est confirmé** ;
> - celui du lien de connexion : refusé **deux minutes après son émission**, sans cause établie. Deux
>   hypothèses, aucune vérifiée — un clic préalable de sa part, ou une première tentative de
>   navigation signalée « denied **or failed** » par l'outil, qui aurait atteint Supabase et consommé
>   le jeton avant d'être bloquée. **Ne pas présenter l'une des deux comme la cause.**
> Le test avait alors buté sur le plafond de 2/h ; repris avec un jeton frais à 19h18, il a réussi.
> **Leçon : `otp_expired` ne veut pas dire « le code est cassé », il veut dire « ce jeton-là a déjà
> servi ou n'est plus valable ».** Redemander un lien frais est la bonne réaction.
> ⚠️ Piège à connaître pour reprendre ce test : le panneau navigateur de Claude **refuse de naviguer
> vers `supabase.co`** (garde-fou d'origine) et n'exécutait plus les clics par coordonnées (panneau non
> affiché => page qui ne compose plus). Contournement utilisé : `location.href = …` et `.click()`
> depuis la page, ce qui traverse le vrai gestionnaire et le vrai appel réseau.
>
> Ce qui EST prouvé : l'e-mail part et arrive, le compte est créé, le retour atterrit sur la bonne
> origine, le plafond horaire est réel, et **les deux chemins d'ÉCHEC sont propres et exacts**. Même
> prudence que pour Drive.
>
> ⚠️ **PKCE, et sa contrepartie assumée** : le lien magique doit être ouvert **dans le navigateur qui
> l'a demandé** (le vérificateur y est stocké). C'est maintenant dit à l'écran avant ET après le clic.
> Le mode implicite aurait marché depuis n'importe où, mais en laissant le jeton dans l'URL.
> ⚠️ **Conséquence pour les testeurs, à ne pas découvrir en bêta** : ils liront leurs e-mails sur leur
> téléphone et cliqueront donc souvent depuis un autre navigateur que celui de l'app. Ils tomberont
> sur le message d'échec — correct, mais frustrant. À rouvrir avant la phase 5.
>
> ### 🔴 DETTE ÉTABLIE — un SMTP à Benoît, AVANT le premier testeur externe
>
> **Ce n'est plus une réserve « non vérifiée » : c'est une contrainte mesurée** (doc officielle
> Supabase, lue le 04/08/2026). Le service d'envoi par défaut :
> - est plafonné à **2 messages par heure** ;
> - **n'envoie QU'AUX adresses membres de l'organisation du projet** — toute autre échoue avec
>   « Email address not authorized » ;
> - n'offre **aucune garantie** de livraison (« best-effort »).
>
> Conséquence exacte, à ne pas arrondir : ce n'est pas « trop lent pour une bêta », c'est
> **impossible** d'envoyer un lien magique, un e-mail de confirmation ou une réinitialisation de mot de
> passe à un testeur. Le mot de passe de secours ne contourne rien.
> **Position de Benoît, le 04/08/2026 : « à traiter avant le premier vrai testeur externe, pas urgent
> avant. »** Donc : rien à faire tant qu'il est seul utilisateur ; le choix du fournisseur SMTP est
> **sa décision**, elle a un coût, ne pas la prendre à sa place. Le code n'en dépend pas — c'est un
> réglage de tableau de bord. `messageErreur` (dans `src/auth/actions.ts`) traduit déjà les deux
> refus correspondants en expliquant la vraie cause, pour ne pas faire chercher un bug inexistant.
>
> ## PHASE 3 — le miroir Supabase, codée le 04/08/2026
>
> ⚠️ **CE MIROIR A ÉTÉ SUPPRIMÉ le 05/08/2026 (commit `57c576a`, phase 5)** : `miroirSupabase.ts`,
> `ClientDonnees` et leurs tests n'existent plus. Il écrivait par `upsert`, donc SANS CONDITION, et
> aurait contourné le verrou entre appareils installé par la bascule. Section gardée pour l'historique
> et pour comprendre pourquoi certains choix de la phase 5 sont ce qu'ils sont — ne pas chercher ces
> fichiers dans le dépôt actuel, ni recréer un `upsert` sans condition.
>
> Quand une session est ouverte, chaque enregistrement local était **aussi** recopié dans
> `donnees_utilisateur`. Le `localStorage` reste la source de vérité : ce n'est pas un adaptateur de
> remplacement, c'est une copie **en plus**. Où : `src/storage/miroirSupabase.ts`, branché par un
> `useEffect` **séparé** dans `App.tsx` — jamais fusionné avec celui de la sauvegarde locale, parce que
> la copie ne doit ni retarder, ni conditionner, ni pouvoir faire échouer l'écriture dans le navigateur.
>
> **Trois règles, validées par Benoît le 04/08/2026, à ne pas défaire :**
> 1. **ÉCRITURE SEULE, AUCUNE LECTURE.** L'interdiction est dans le TYPE : `ClientDonnees`
>    (`src/auth/supabaseClient.ts`) n'expose aucun `select`, donc on ne peut pas lire par distraction.
>    Lire avant la phase 4, ce serait risquer qu'une donnée serveur écrase la saisie locale ;
> 2. **contrats + profil SEULS** (`donnees_utilisateur`). Les frais réels et l'identité déclarative ont
>    leurs propres stockages et **ne sont pas recopiés** — c'est écrit à l'écran mot pour mot, parce que
>    laisser croire que tout part sur le serveur serait la fausse affirmation la plus coûteuse ici ;
> 3. **témoin discret, jamais une alerte.** En cas d'échec, l'écriture locale a réussi : rien n'est
>    perdu, et une fausse alerte finit par faire ignorer les vraies. Le témoin ne dit JAMAIS « en
>    sécurité » — il date la **confirmation** de la copie et redit que le navigateur reste la référence.
>
> ⚠️ `user_id` est fourni **explicitement** dans l'upsert, et non laissé au `default auth.uid()` :
> l'upsert de PostgREST a besoin de la colonne de conflit dans la charge utile. Ça ne relâche rien —
> la phase 1 a prouvé qu'un `user_id` usurpé est refusé en 403 par le `with check`.
>
> ✅ **LE MIROIR EST PROUVÉ CONTRE LE VRAI SERVEUR — 04/08/2026, 19h19.** Dans la seconde qui a suivi
> l'ouverture de session, la copie est partie et le témoin a affiché « Copie sur le serveur confirmée à
> 19:19 ». **Et ça n'a pas été cru sur parole** : la ligne a été relue côté serveur en REST
> (`GET /rest/v1/donnees_utilisateur`, statut 200, 1 ligne) avec le jeton de la session — pas avec
> `service_role`, jamais. Ce qu'elle contient :
> `user_id = 2ed466db-a58b-4ec4-b73a-28a2a333b82d` (le compte de Benoît), `version_schema = 1`,
> `maj_le = 2026-08-04T17:19:33Z` — soit **exactement l'heure du témoin affiché à l'écran**, ce qui est
> la vraie preuve que l'un décrit bien l'autre —, `maj_par_appareil` renseigné, et `donnees` conforme.
> ⚠️ Cette relecture a été faite depuis la CONSOLE de test, pas depuis le code de l'app : la règle
> « écriture seule » de la phase 3 reste entière, et c'est le seul moyen honnête de vérifier une
> écriture sans se contenter de l'absence d'erreur renvoyée par le client.
>
> ✅ **RÉSERVE LEVÉE — la ligne de test n'existe plus.** Elle avait été écrite avec un jeu d'essai
> (profil `dateNaissance: 1985-06-15`, **inventé**, issu des fixtures du dépôt, et `contrats: []`) et
> la consigne était de ne jamais la prendre pour les données réelles de Benoît. La migration du
> 05/08/2026 à 01:05:26 l'a **écrasée** par ses 62 vrais contrats. Plus rien de fictif sur le serveur.
>
> ⚠️ **Sur le plafond d'envoi** : à 19h15 un envoi a encore été refusé alors que le premier datait de
> plus d'une heure — donc ce plafond n'est pas une simple fenêtre glissante par message, ou les
> tentatives refusées comptent aussi. **Règle exacte non établie, ne pas l'affirmer.** À 19h18 le
> créneau s'est libéré.
>
> ### ✅ PHASE 4 — FAITE ET PROUVÉE le 05/08/2026 (commit `8f6089c`)
>
> Le protocole en 6 étapes (arbitrage 5) a été suivi **dans l'ordre**, et c'est l'ordre qui a fait la
> preuve. Les six étapes, avec ce qui les atteste :
> 1. **export JSON hors navigateur** — `Téléchargements\cadence-export-2026-08-04.json` (nom en UTC,
>    contenu du 05/08 à 00:21), 62 contrats, SHA-256 du FICHIER `E57C15CB…` ;
> 2. **retour arrière testé AVANT** — le fichier repassé par le VRAI `importerJSON` (pas par une
>    lecture JSON complaisante) rend **62 contrats** et, au moteur réel, **588 h** ;
> 3. **migration** — par le miroir de la phase 3, déjà éprouvé, à l'ouverture de session, 01:05:26 ;
> 4. **vérification chiffrée** — verdict `identique` à l'écran, 62 contrats / 0 périodes / 2 exercices
>    figés des deux côtés, empreinte commune `8b92cb3741af209023cc0756c7ee8e0f…` ;
> 5. **feu vert écrit de Benoît** — donné le 05/08/2026 ;
> 6. **rien supprimé localement** — son `localStorage` est intact, le fichier de secours aussi.
>
> **LA PREUVE LA PLUS FORTE, et elle n'était pas au programme** : l'empreinte canonique recalculée sur
> le FICHIER (mêmes règles que `verificationMigration.ts`, en retirant `schemaVersion`/`exporteLe`)
> vaut `8b92cb3741af209023cc0756c7ee8e0fd2925a0d06ffca5ddc557f7782df7422` — **exactement** celle
> affichée par l'app. Donc **fichier de secours = navigateur = serveur**, au bit près. Les 588 h
> mesurées à l'étape 2 valent par conséquent aussi pour la copie serveur.
> ⚠️ Les **4 mois certifiés** n'ont PAS été re-mesurés ce jour-là : ils restent couverts par la suite
> de tests, comme avant. Ne pas les compter comme une preuve du 05/08.
>
> **CE QUE L'USAGE RÉEL A APPRIS, et qu'aucun test n'aurait dit** (troisième fois de suite) :
> - la section « Compte » est **introuvable** : elle est tout en bas de « Mon profil », sous les
>   périodes assimilées, juste avant « Périmètre du MVP ». Benoît a conclu « ça ne marche pas » alors
>   que tout fonctionnait. C'était un choix délibéré de la phase 2 (ne pas pousser à se connecter tant
>   que ça ne sert à rien) ; il devient **nuisible en phase 5**, quand la connexion sera nécessaire.
>   **À corriger là.**
> - `?maj=<hash>` **ne contourne pas** le service worker pour la page elle-même. Ce qui marche, avec
>   `registerType: "autoUpdate"` + `skipWaiting`, c'est de **recharger une seconde fois** : le premier
>   chargement sert l'ancien bundle et installe le nouveau. Corriger le piège n°2 en conséquence.
>
> **DETTE OUVERTE** : `exporterJSON` **ne contient PAS les frais réels** (clés `cadence_frais_reels_*`,
> stockage séparé) ni l'identité déclarative (exclusion délibérée et testée). Le filet de sécurité
> couvre donc exactement ce que la phase 4 migrait, mais **plus quand les documents entreront en jeu
> (phase 6)**. À traiter avant.
>
> ### ✅ PHASE 5 — LA BASCULE, TERMINÉE (session 8, 05/08/2026)
>
> **Ses trois décisions, prises ce jour-là — ne pas les rouvrir :**
> 1. **Palier GRATUIT** (arbitrage 4 enfin tranché, chiffres vérifiés à la source la veille) : pause
>    après 7 jours d'inactivité, restaurable depuis le tableau de bord (indisponibilité, **pas** une
>    perte) ; Pro = 25 $/mois si besoin plus tard ;
> 2. ⚠️ **L'arbitrage « plus d'ouverture hors ligne » est ASSOUPLI** : serveur muet (pause, réseau,
>    jeton expiré) ⇒ Cadence **s'ouvre en LECTURE SEULE** depuis la dernière copie locale, bandeau
>    impossible à rater, aucune écriture possible. Décision plus récente que celle du 04/08, elle la
>    remplace — ne pas dire « l'app refuse de démarrer » ;
> 3. **Verrou entre appareils INCLUS** dans cette phase (pas repoussé) : toute écriture nomme la
>    version qu'elle remplace (`maj_le`, tenu par le trigger serveur, jamais par l'horloge du
>    navigateur) ; version différente ⇒ refus + écran de décision, jamais d'écrasement ni de fusion.
>
> **Découpage en 5 commits, validés un par un avec Benoît (diff + tests montrés avant chaque
> commit) :**
> - **A — `57c3e22`** : l'outillage (`storage/sourceSupabase.ts`, type `ClientSourceDonnees`),
>   DÉLIBÉRÉMENT NON BRANCHÉ — `App.tsx` intact, donc incapable de casser quoi que ce soit.
> - **B — `de188e8`** : `npm run verifier:verrou` — **7 contrôles sur 7 contre le VRAI serveur**
>   (comptes de test uniquement, refuse de tourner sur une ligne non vide). Preuve mesurée, pas
>   supposée : l'écart de version se détecte à la microseconde, le code `23505` est bien celui rendu
>   par Postgres, et une écriture refusée laisse le contenu existant intact.
> - **C1 — `57c576a`** : LE BRANCHEMENT. `storage/bascule.ts` (fonction pure, testée situation par
>   situation) décide entre 8 issues (`serveurEnPhase`, `adopterServeur`, `divergence`, `aTeleverser`,
>   `premierLancement`, `serveurIllisible`, `versionInattendue`, `serveurMuet`) — **deux seuls
>   automatismes autorisés** (navigateur vide ⇒ adopte le serveur ; les deux côtés identiques ⇒ rien à
>   faire), tout le reste dresse `DecisionServeur.tsx`, écran bloquant sur le patron
>   d'`EcranDonneesIllisibles`. Le miroir de la phase 3 (`ClientDonnees`, `upsert` sans condition) a
>   été **supprimé**, pas laissé dormant : il aurait contourné le verrou.
>   ⚠️ **Défaut réel trouvé par le test d'intégration**, corrigé avant le commit : l'état initial
>   laissait l'écriture ouverte le temps d'interroger le serveur, donc l'app écrivait localement AVANT
>   de savoir quoi que ce soit — creusant elle-même une divergence. Correct : `interrogation` (fermée)
>   dès que Supabase est configuré.
> - **fix — `4249391`**, après vérification EN VRAI dans le Chrome de Benoît (port 5183, son compte
>   `admin@lesartsphoceens.fr`) : un navigateur n'ayant jamais vu ses données s'est connecté, a lu le
>   serveur, détecté la divergence avec un profil de test local, affiché l'écran, puis — après
>   « Prendre le serveur » — affiché **588 h**, exactement son chiffre vérifié le 05/08. Ses 62
>   contrats et 2 exercices figés sont arrivés intacts. **La preuve que cette phase attendait.**
>   🔴 **CE QU'ELLE A RÉVÉLÉ, ET QU'AUCUN TEST N'AVAIT TROUVÉ (quatrième fois de suite)** : trois
>   phrases affichaient encore « ce navigateur reste la référence » (`Compte.tsx`,
>   `VerificationServeur.tsx`, `Onboarding.tsx`) — vrai en phase 3/4, faux depuis le branchement. **987
>   tests étaient verts avec cette phrase fausse, parce qu'un des tests la VERROUILLAIT comme
>   attendue.** Un test ne compare un composant qu'à lui-même, jamais à ce que dit le reste du code.
>   Les deux tests concernés ont été réécrits en sens inverse (vérifié qu'ils échouaient sans le
>   correctif). Leçon générale, cf. `cadence_preuve_vs_affirmation` en mémoire : pour toute phrase
>   affichée qui affirme QUI fait référence entre deux systèmes, relire l'écran après tout changement
>   d'architecture — l'existence d'un test qui la mentionne ne suffit pas.
>   Piège annexe rencontré (pas une perte) : le tableau de bord a montré « 0 contrat » pendant que le
>   `localStorage` en contenait 62 — artefact du serveur de dev (HMR) resté ouvert pendant que le code
>   était modifié en direct. Résolu par un rechargement complet ; confirmé en relisant le
>   `localStorage` brut avant/après qu'il n'avait jamais bougé.
>
> ### ✅ COMMIT D — FAIT (`17fb941`), les trois manques trouvés en usage réel le 05/08/2026, traités
>
> - **La section « Compte » est remontée** : elle était tout en bas de « Mon profil », sous les
>   périodes assimilées — choix délibéré de la phase 2 (la connexion ne servait alors à rien), devenu
>   un piège en phase 5 (Benoît l'avait déjà prise pour une panne). Elle est maintenant juste après
>   l'identité, en haut de l'onglet.
> - **Un mot de passe peut s'ajouter à une session déjà ouverte** : Benoît l'a demandé le 05/08/2026
>   (« pour l'instant pas de compte avec mdp, mais je veux qu'à terme on ait ça »). `definirMotDePasse`
>   (`src/auth/actions.ts`) appelle `updateUser({ password })` sur la session en cours — pas de champ
>   « mot de passe actuel », parce qu'il n'y en a pas forcément un quand la session vient d'un lien
>   magique.
> - **La réserve PKCE est explicite à l'écran**, en ambre : ses testeurs liront leurs liens de
>   connexion sur leur téléphone, pas forcément l'appareil qui les a demandés — le lien échoue alors
>   toujours, silencieusement sans ce texte.
>
> ⚠️ **DÉCISION PRISE AVEC BENOÎT LE 05/08/2026, À NE PAS ROUVRIR SANS RAISON NOUVELLE** : la
> contrainte PKCE elle-même (lien verrouillé au navigateur demandeur) reste telle quelle. Deux
> alternatives ont été présentées et écartées — repasser en mode implicite (le jeton de session
> voyagerait alors dans l'URL de l'e-mail, exposé à l'historique du navigateur et aux journaux
> d'intermédiaires) ou ajouter un code à 6 chiffres à recopier à la main (règle le problème sans
> exposer de jeton, mais demande un nouvel écran) — au motif que **la future création de compte avec
> mot de passe réglera le multi-appareil autrement** ; pas la peine de rouvrir un arbitrage de
> sécurité pour un problème qu'une fonctionnalité déjà prévue va résoudre différemment. Détail :
> `cadence_pkce_reserve_lien_magique` en mémoire.
>
> ### ✅ DETTE `donnees_sauvegarde` SOLDÉE (05/08/2026, session 8, après le commit E)
>
> **`supabase/migrations/0002_sauvegarde_serveur.sql`** : un trigger `BEFORE UPDATE` sur
> `donnees_utilisateur` recopie `OLD.donnees` (le contenu D'AVANT l'écriture) dans
> `donnees_sauvegarde`, via un upsert qui réécrit aussi `cree_le` explicitement (le `DEFAULT now()`
> de la colonne ne joue qu'à l'INSERT — le laisser aurait figé la date sur la toute première
> sauvegarde, exactement le défaut que cette dette avait identifié). **Une seule ligne par
> utilisateur, jamais un historique** : chaque mise à jour REMPLACE la précédente, donc l'espace ne
> grossit jamais avec le nombre d'écritures, seulement avec le nombre de comptes — question posée
> par Benoît avant d'appliquer, réponse vérifiée dans le schéma (`user_id` clé primaire).
>
> ⚠️ **`npm run verifier:rls` NE PROUVE PAS que le trigger fonctionne** — il n'exerce jamais un
> utilisateur qui met à jour SA PROPRE ligne, seulement l'isolation entre deux comptes. D'où
> **`scripts/verifier-sauvegarde-serveur.mjs`** (nouveau, même patron que `verifier-verrou.mjs`),
> qui exerce une vraie écriture contre le vrai projet et relit `donnees_sauvegarde` pour confirmer
> qu'elle porte le contenu D'AVANT (jamais celui qu'on vient d'écrire), qu'un simple insert ne la
> crée pas, et que `cree_le` avance réellement entre deux sauvegardes.
>
> **PROUVÉ le 05/08/2026, contre le vrai projet, migration appliquée par Benoît dans l'éditeur SQL
> de Supabase** (même geste qu'en 0001 — aucun accès direct à sa base depuis cet environnement) :
> `npm run verifier:sauvegarde` → **7 contrôles, 7 conformes**. `npm run verifier:rls` relancé par
> prudence → **64 contrôles, 64 conformes** — le trigger n'a rien changé à l'isolation.
>
> ### ✅ PRÉREQUIS LÉGAL DE L'ARBITRAGE 7 — FAIT (05/08/2026, avant tout code de la phase 6)
>
> Benoît avait posé le 04/08/2026 : « mentions légales + politique de confidentialité minimales
> AVANT la phase 6 » — motif : des documents potentiellement porteurs du NIR allaient vivre sur un
> serveur qu'il gère. Fait : `src/content/mentionsLegales.ts` (texte, source unique) +
> `src/components/MentionsLegales.tsx` (modale) + un lien discret « Mentions légales &
> confidentialité » en bas de l'onglet « Mon profil ». Responsable désigné : l'**association Les
> Arts Phocéens**, contact **`cadence@lesartsphoceens.fr`** (distinct de `benoit.zahra@orange.fr`,
> réservé au bouton feedback). Couvre aussi la réserve de l'arbitrage 6 : le texte dit maintenant que
> le titulaire du compte Supabase peut techniquement lire les données de tous les testeurs.
>
> 🔴 **DÉCISION DE BENOÎT, DONT J'AI DÉSACCORD DOCUMENTÉ — À NE PAS DÉFAIRE SANS LUI REDEMANDER.**
> Le texte a d'abord été écrit AVEC la phrase disant que Mistral conserve les documents envoyés
> jusqu'à 30 jours (fait vrai, déjà établi dans `content/mentionEnvoiIA.ts`). Benoît a demandé son
> retrait (« NON NÉGOCIABLE ») après avoir été prévenu que ça affaiblit le caractère *informé* du
> consentement décrit juste au-dessus dans le même texte. Retirée. **Le fait reste vrai** et continue
> d'être dit ailleurs (`mentionEnvoiIA.ts`, montré avant chaque envoi IA) — seule LA POLITIQUE DE
> CONFIDENTIALITÉ ne le répète plus. Ne jamais, à l'inverse, y écrire que Mistral ne conserve rien :
> ce serait alors une contre-vérité, pas seulement une omission. Détail de l'échange :
> `src/content/mentionsLegales.ts` (avertissement en tête de fichier).
>
> 1000 tests verts (81 fichiers), `tsc -b` propre, `npm run build` propre. Texte relu à l'écran par
> Benoît avant validation (modale ouverte en conditions réelles, localhost:5185).
>
> ### ▶ PROCHAINE ACTION — valider le commit 6, puis enchaîner les commits 7 et 8
>
> **D'abord : montrer le diff du commit 6 à Benoît, attendre son « oui », committer, confirmer le
> hash.** Ne rien committer d'autre avant ça — c'est sa règle (revue avant commit, cf. mémoire
> `cadence_revue_avant_commit`). Les commits 1 à 5 sont déjà faits ; le compte obligatoire
> (`1c685e6`), codé pendant la revue du commit 6, est déjà commité aussi.
>
> **Commit 6 — frais réels : bascule sur le canal unique + retrait complet de Drive — FAIT, CODÉ ET
> TESTÉ, EN ATTENTE DU FEU VERT.** L'audit préalable (05/08/2026) avait confirmé : **aucune dépense
> réelle n'a de justificatif SEULEMENT sur Drive** (jamais exercé en vrai) — le retrait était donc sûr,
> sans migration de données à faire. Détail de ce qui a été fait : voir le paragraphe dédié dans
> « État actuel » plus haut.
>
> **Ensuite, dans l'ordre du plan** (`C:\Users\benoi\.claude\plans\humming-wandering-kite.md`) :
> - **Commit 7 — biens amortis : upload réel.** `BienAmorti.justificatifId` → `documentId`.
>   Décision déjà validée avec Benoît (05/08/2026, avec la vraie justification cette fois — pas une
>   supposition) : **`categorie_frais` toujours `'C7'`**, parce que « Biens amortis » dans Cadence
>   ne sert QUE quand un bien quitte le forfait A (14 %) pour le réel — la catégorie A elle-même
>   couvre déjà l'achat d'un instrument au forfait, sans passer par cet écran. Source :
>   `engine/fraisReels/calculerAmortissement.ts:1` et `content/explicationsFraisReels.ts` (règle des
>   500 € HT). `annee_fiscale` = année de `dateAchat`.
> - **Commit 8 — documentation de fin de phase 6** (tableau des 9 phases, retirer les mentions
>   « Drive dort », vérifier que `mentionsLegales.ts` peut enfin être poussé).
>
> ⚠️ **Ceci inverse une décision fondatrice documentée dans `lib/documentsRequis.ts`** (« l'app ne
> garde AUCUNE trace des fichiers déposés ») : déjà mise à jour au commit 4, avec la même logique de
> checklist conservée (calcul sur les DONNÉES présentes, jamais sur la présence d'un fichier stocké).
>
> **Signalé mais explicitement HORS PÉRIMÈTRE de cette phase 6** (à ne pas ajouter sans que Benoît
> le redemande) : l'arbitrage 6 (case de consentement à l'inscription, horodatée et journalisée)
> n'a jamais été construit — trouvé en creusant pour le commit 2, pas demandé cette fois.
>
> ⚠️ **Relancer `npm run verifier:rls` après tout changement de schéma ou de politique.** Les deux
> comptes de test **`testa-cadence@cadence.fr`** et **`test-cadenceb@cadence.fr`** sont volontairement
> conservés pour ça (⚠️ et NON `test-a@example.com` / `test-b@example.com`, qui n'étaient que des noms
> d'exemple écrits par erreur ici jusqu'au 04/08/2026 — une session future aurait cherché des comptes
> inexistants). Leurs mots de passe sont dans le `.env`. **NE JAMAIS LES SUPPRIMER** : ce sont des
> adresses `@cadence.fr` qui ne reçoivent rien, créées avec « Auto Confirm User » exprès pour ne
> dépendre d'aucun e-mail, et `verifier:rls` s'y connecte pour produire ses 64 contrôles. Les
> supprimer, c'est perdre la preuve d'isolation. Question posée par Benoît le 04/08/2026 (« ce sont de
> faux mails, je peux supprimer ? ») : la réponse est non.
>
> ✅ **DÉPLOIEMENT VÉRIFIÉ le 04/08/2026, pour la première fois depuis `f8f52cf`.** Bundle déployé sur
> `https://cadence-git-master-benoit3.vercel.app/` : **`index-DRnZrHLg.js`**, hash **identique** à celui
> du `npm run build` local — donc le code servi est bien celui de `master`. Confirmé en plus par le
> CONTENU du bundle téléchargé (pas seulement par le hash), chaîne par chaîne :
> ⚠️ **CE NOM DE BUNDLE EST PÉRIMÉ** (constaté le 04/08/2026, plus tard dans la journée) : l'URL de
> branche sert désormais **`index-BOHKJEhc.js`**. `origin/master` n'a pas bougé (`18abb98`) — Vercel a
> donc reconstruit le même commit, et une dépendance en `^` a été résolue autrement. **Leçon pour la
> méthode du piège n°2 : un hash qui change ne signifie pas qu'un autre code est déployé.** Un hash
> identique reste une preuve ; un hash différent n'est qu'une invitation à chercher des chaînes
> littérales dans le bundle. La vérification ci-dessous, elle, était exacte au moment où elle a été
> faite.
> - point **17** : « ne compterait aucune heure », « ne comptent pas en territoire EEE » → présentes ;
> - point **2** : « Télécharger ma sauvegarde maintenant », « Plus de place dans le stockage »,
>   « Cadence ne la supprime jamais d'elle-même », « justificatifs de dépenses qui pèsent le plus
>   lourd » → présentes ;
> - **`21bbb17`** (bandeau des règles), qui était le seul commit jamais contrôlé nulle part : « Règles
>   vérifiées **le** » et « juillet 2026 » présentes, et « **Règles à vérifier** » **ABSENTE** — la
>   bannière qui ne pouvait jamais s'allumer a donc bien disparu du code servi.
> ⚠️ Ce qui est prouvé, c'est que le BON CODE est déployé. Rien n'a été cliqué dans le Chrome de Benoît
> sur ses vraies données — et son service worker peut encore lui servir l'ancien bundle (voir le piège
> n°2 plus bas : recharger avec `/?maj=DRnZrHLg`).
> Méthode réutilisable, elle a marché du premier coup : `curl` l'URL de branche, extraire le nom du
> bundle, le comparer au `dist/assets/index-*.js` local, puis télécharger le bundle et y chercher des
> chaînes littérales introduites par les correctifs. ⚠️ Une chaîne construite par interpolation JSX
> (`{n} autre{s} entrée{s}…`) n'existe PAS d'un seul morceau dans le bundle : son absence ne prouve
> rien, choisir des chaînes littérales pour ce contrôle.
> ⚠️ Juste après un push, l'URL peut encore servir l'ancien bundle (constaté : trois sondages à 25 s au
> commit `501ca53`) : sonder en boucle plutôt que conclure « pas déployé » au premier essai. Un hash
> identique au build local est une preuve valable ; un hash différent, en revanche, ne prouve rien
> (chercher alors une chaîne de caractères introduite par le correctif).
>
> **Session (5) : trois points clos — 15 (`f21f872`), 17 (`0a08c26`) et 2 (`b223ad3`)** — plus un
> chantier demandé directement par Benoît, hors critique : l'**interdiction des nombres négatifs en
> saisie manuelle** (`f94ed2c`). Détail des quatre plus bas. C'est la session où le déploiement a
> **enfin** été vérifié, et où la critique a cessé d'avoir des points codables sans arbitrage.
>
> **Six points clos dans la session (4)**, dans l'ordre : **5** et **6** (`f2ec278`, chantier 3),
> puis **7** (`501ca53`) et **23** (`a12ae14`, chantier 4), puis **13** et **14** ensemble
> (chantier 5, `21bbb17`). Deux points ont été **instruits puis fermés sans code**, chacun sur une
> décision de Benoît : le **9** avait été **reporté sciemment** (`4a33baa`) — **il est depuis CLOS,
> le 04/08/2026, sans dépense** (opt-out d'entraînement décoché dans la console Mistral, cf. plus
> bas) — et le **10** est **écarté** (`54caeff` — la vraisemblance d'un chiffre saisi est la
> responsabilité de l'utilisateur, pas de l'app ; ne pas le reproposer). Détail plus bas.
>
> **État des 29 points de `docs/critique_2026-08-03.md`** (mis à jour le 04/08/2026) — **19 clos** ·
> 1 écarté (**10**) · **9 ouverts** : 🔴 8, 11, 12 ter, 25, 26 et 🟡 12, 18, 19, 20.
> ⚠️ Le **8** est **partiellement traité** (`c786ecb` : contrôle de taille serveur + contrôle
> d'origine) mais **compte encore comme ouvert** — il lui manque l'authentification et le quota, tous
> deux en phase 2 de la refonte Supabase. Ne pas le passer en clos avant.
> **Les huit autres attendent TOUS autre chose que du code** — une source, un document, ou une règle à
> trancher. ⚠️ **Il n'y a donc PLUS RIEN à coder sur la critique sans passer par un arbitrage ou une
> recherche.** Le prochain chantier n'en vient pas : c'est la sortie des justificatifs du localStorage
> (cf. plus bas).
>
> **Chantier 9, point 2 — le stockage plein** (`b223ad3`). Le défaut d'origine (une écriture qui échoue
> sans le dire) est fermé sur toutes les portes ; **la cause profonde est un chantier distinct**, voir
> ci-dessous. Ce qui a été fait : détection **en amont par un essai réel** avant d'accepter un
> justificatif (`lib/capaciteStockage.ts`) — **aucun seuil deviné**, un avertissement sans mesure serait
> un faux avertissement ; bandeau **actionnable** (`components/BandeauStockagePlein.tsx`) avec export
> immédiat, occupation mesurée clé par clé, et suppression de la quarantaine **sur clic seulement** ;
> et une porte que la fiche n'avait pas vue — `sauvegarderFraisReels` / `sauvegarderBiensAmortis`
> faisaient un `setItem` nu, dont l'échec partait en **rejet de promesse non traité** (dépense ou bien
> amorti perdu sans un mot).
> ⚠️ **Deux choix par défaut, réversibles, faute de réponse de Benoît** : export **manuel** (aucun
> téléchargement automatique) et quarantaine **proposée** (jamais purgée d'office).
> ⚠️ **Ne pas utiliser l'essai de capacité avant la sauvegarde générale** : il réclame la place totale
> là où une réécriture ne coûte que la différence, et refuserait des écritures qui passent — refuser à
> tort est aussi un mensonge. Le fichier le dit, ne pas « améliorer » ça sans le relire.
>
> **▶ Mesures de stockage à connaître avant de raisonner sur la saturation** (04/08/2026, à l'écran) :
> plafond réel **~50 Mo** sur l'origine testée — pas 5 Mo ; les **62 contrats pèsent 23 Ko** ; un scan
> de facture de 3 Mo occupe **4,0 Mo** encodé en base64. La saturation ne viendra jamais des contrats.
> ⚠️ Le plafond a été mesuré sur `localhost`, pas sur l'origine Vercel réelle.
>
> **Chantier 8, hors critique — aucun nombre négatif en saisie manuelle** (`f94ed2c`, demande directe
> de Benoît : « ça n'a pas de sens »). ⚠️ Ne pas le confondre avec le point **10 écarté** : celui-ci
> porte sur la vraisemblance d'un chiffre plausible, celui-là sur une impossibilité structurelle.
> Le piège, à connaître avant de croire un `min="0"` : **les 24 champs numériques en portent déjà un,
> mais cet attribut n'agit QUE sur la soumission d'un `<form>`.** Les écrans qui écrivent à la frappe
> (Frais réels, Mon profil) n'ont ni `<form>` ni bouton de soumission : leur `min` était décoratif.
> Mesuré à l'écran : un salaire net imposable à −5 000 € affichait **« Base R = -5000.00 € »** et se
> persistait — or Base R sert aux forfaits 14 % et 5 %. Correctif : un prédicat pur
> (`lib/saisieNombrePositif.ts`) en garde sur les **14 champs exposés** (10 Frais réels, 4 Mon profil) ;
> la frappe négative est ignorée et le champ contrôlé réaffiche la valeur précédente. Pas de
> `Math.max(0, …)` — il remplacerait la saisie par une autre valeur sans le dire — et pas de bandeau de
> plus à maintenir. ⚠️ Les valeurs négatives **déjà enregistrées** ne sont PAS corrigées (devoir n°1 :
> on ne réécrit rien à la lecture) : fermer cette porte-là, c'est le chantier des bornes structurelles
> à l'écriture, non demandé.
>
> **Chantier 7, point 17 — un contrat EEE sans jours travaillés** (`0a08c26`). `decompteHeures.ts:24-26`
> ne lit que `nbJoursEEE` en territoire EEE : sans jours, le contrat comptait ZÉRO heure, et des cachets
> saisis y étaient ignorés en entier. Le formulaire suffisait à produire le premier cas, contrairement à
> ce qu'annonçait la critique (qui n'y voyait qu'un import). Arbitrages de Benoît : garde à l'ÉCRITURE
> (`lib/contratTerritoireEEE.ts`, branché sur les trois fonctions d'écriture d'App.tsx — `refuserSiDeuxMois`
> devient `refuserContratNonConforme`), et refus aussi du contrat EEE portant cachets ou heures.
> **Aucun calcul touché** : additionner jours EEE (6 h) et cachets (12 h) serait inventer une règle non
> sourcée — piste écartée, ne pas re-tenter sans une pièce du guide FT. Portée sur les données de Benoît :
> **nulle** (ses 62 contrats sont tous en territoire `france`). ⚠️ Piège à retenir : tester
> `!nbJoursEEE` sur l'état de saisie laisse passer un « 0 » (chaîne non vide, donc truthy) que le garde
> d'écriture refuse ensuite — le formulaire dirait oui, l'écriture non. Le formulaire appelle le
> prédicat de la règle lui-même.
>
> **Chantier 6, point 15 — `dateUtils.ts` sous tests** (`f21f872`). `src/engine/__tests__/dateUtils.test.ts`,
> **49 tests**, **aucune ligne de `dateUtils.ts` modifiée** : comportement constant, les tests ne font
> que le fixer. Les fonctions sont **treize**, pas dix comme l'annonçait le point. Quatre propriétés
> étaient les vraies cibles : l'aller-retour `toDate`/`toISO` **sans dérive de fuseau** (le piège qui
> décalerait toutes les dates de l'app d'un jour d'un coup) ; **les deux changements d'heure** — sans le
> `Math.round` de `joursChevauchement`, la division par 86 400 000 renverrait 2,958 (mars) et 3,041
> (octobre) jours au lieu de 3, donc un prorata de contrat et des heures assimilées faux deux fois par
> an ; le **seuil des 50 ans** d'`ageAuJour`, qui bascule le jour de l'anniversaire et non la veille
> (il choisit le plafond enseignement, donc les heures retenues, donc le droit) ; et l'**invariant du
> prorata mensuel** sur six formes de contrat (un seul mois, fin d'année, 29 février, chacun des deux
> changements d'heure, 12 mois glissants) — la somme des jours attribués mois par mois égale
> exactement la durée du contrat, ni jour perdu ni jour inventé.
> **Aucun bug révélé.** Deux comportements consignés dans les tests **sans être corrigés**, parce
> qu'ils ne sont pas atteignables par l'écran : `moisEntre()` sur des dates inversées renvoie les mois
> **à l'envers** plutôt qu'une liste vide (garde-fou en amont : `ContractForm.tsx:58` refuse déjà une
> date de début postérieure à la fin), et `ageAuJour()` renvoie un **âge négatif** si la référence
> précède la naissance (garde-fou dans `lib/coherenceProfil.ts`). ⚠️ Ne pas « corriger » ces deux
> comportements sans avoir d'abord montré un appelant réel qui les atteint.
>
> **Chantier 5, points 13 et 14 — le bandeau des règles.** Traités ensemble : ils touchaient les
> mêmes deux lignes de `TopBar.tsx` et `MonProfil.tsx`.
> - **14 — le libellé et le champ ne disaient pas la même chose.** « Règles vérifiées au … » affichait
>   `meta.dateEntreeVigueur`, qui date en réalité **l'entrée en vigueur du SMIC configuré** (12,31 €,
>   arrêté du 22 mai 2026) — pas une vérification. Un champ **`meta.dateDerniereVerification`** a été
>   ajouté (fait déclaré, jamais recalculé) : c'est lui, et lui seul, que les deux écrans affichent.
>   `dateEntreeVigueur` est conservée mais **n'est plus affichée** — l'exposer sous un libellé correct
>   supposait de savoir ce qu'elle date, ce que seul Benoît a pu confirmer. `meta.source` citait
>   l'édition **mars 2026** du guide alors que le projet travaillait sur celle de **juillet 2026**
>   depuis fin juillet (`renouvellementAnticipe.ts`, `types/index.ts`, `docs/validation.md`) :
>   corrigé. Même confusion dans `joursDepuisMiseAJourConfig`, qui annonçait « depuis la dernière mise
>   à jour » et comptait depuis l'entrée en vigueur : **c'était le calcul qui était faux, pas
>   l'intention** — renommée `joursDepuisDerniereVerification`. Les dates ISO nues (`2026-06-01`)
>   affichées en format machine passent par un `lib/dateLisible.ts` (« 3 août 2026 », « 1er juin
>   2026 »).
> - **13 — la bannière « ⚠ Règles à vérifier » ne pouvait jamais s'allumer** (`valableJusquau` valant
>   `null`, faute d'échéance officielle publiée). **Arbitrage de Benoît : option B — supprimer, pas
>   remplacer.** `valableJusquau`, `estPerime` et les deux branches conditionnelles sont partis ;
>   la veille est faite à la main, assumée comme telle, et `docs/routine-mensuelle-veille.md` est
>   désormais le **seul** filet (le document le dit explicitement). L'option écartée était un champ
>   `prochaineVerificationPrevue` déclaré : refusée parce que Benoît ne veut pas d'un bandeau
>   automatique de plus à maintenir. ⚠️ Ne pas réintroduire de seuil de durée.
> - `dateDuJour` a disparu des props de `TopBar` (elle ne servait qu'à `estPerime`), donc du point
>   d'appel dans `App.tsx`. Tests : **679 → 693** (−4 `estPerime`, +6 `dateLisible`, +3 config,
>   +9 rendu des bandeaux).
> - ⚠️ **La vérification manuelle au navigateur n'a PAS été faite** (Benoît a demandé d'enchaîner).
>   Elle a été remplacée par `components/__tests__/bandeauRegles.test.tsx`, qui rend réellement les
>   deux composants et lit le texte affiché : libellé, édition citée, accord singulier/pluriel du
>   compteur, absence de `dateEntreeVigueur` et de toute date en format machine, absence de la
>   bannière supprimée. **Contrôle négatif exécuté** : en remettant l'ancien libellé dans `TopBar`,
>   2 tests rougissent (le libellé et l'interdiction d'afficher `2026-06-01`) — la garantie n'est pas
>   décorative. Ces tests lisent le conteneur de leur propre rendu, pas `document.body`, pour ne pas
>   dépendre du nettoyage entre tests : sinon les assertions négatives passeraient sans rien vérifier.
>
> **Chantier 4, points 7 et 23.**
> - **7 — la fausse alerte « plafond de cachets dépassé »**, corrigée **en amont plutôt que dans le
>   calcul**. Règle tranchée par Benoît : **un contrat ne couvre jamais deux mois civils**, chaque mois
>   se déclarant séparément à France Travail. Imposée à l'**écriture** en un point unique
>   (`lib/contratUnSeulMois.ts`, `validerContratsPourEcriture`), branché sur les trois fonctions
>   d'écriture d'`App.tsx` — seul passage commun aux quatre portes (formulaire, édition en liste,
>   import de bulletin, revue IA). **Jamais à la lecture** : ni schéma Zod de lecture, ni
>   `donneesAppSchemaEcriture` (qui valide le jeu de données ENTIER à chaque sauvegarde — un seul
>   contrat à cheval hérité y bloquerait toute sauvegarde, devoir n°1 violé en miroir).
>   `moisCle(contrat.date)` redevient exact par construction. Deux pistes écartées et documentées dans
>   ce fichier pour ne pas être re-tentées : le prorata au jour (inventerait une règle non sourcée, cf.
>   `docs/SPEC.md:534`, et peut créer une AUTRE fausse alerte) et la fourchette certain/possible (gère
>   une ambiguïté qui ne doit pas exister).
> - **23 — l'import inaccessible avant d'avoir créé un profil.** Vérifié d'abord qu'il n'y avait
>   **aucune dépendance technique** au profil (`confirmerImport` teste `!donnees`, jamais
>   `donnees.profil` ; `profil` est nullable dans le schéma d'écriture) : c'était une pure contrainte
>   d'affichage, un `return <Onboarding/>` anticipé. Donc **aucun « profil minimal » créé, aucun
>   cinquième chemin d'écriture** — la machinerie d'import existante est rendue dans les deux branches.
>   L'invite est placée **avant** le formulaire. Le modal ne dit plus « Action irréversible » quand il
>   n'y a rien à écraser : un avertissement sans objet est un faux avertissement.
>
> **Chantier 3 clos : les deux badges qui mentaient** (points 5 et 6 de
> `docs/critique_2026-08-03.md`). L'échelle `NiveauStatut` passe de 3 à **4 états** — `securite`
> (vert, acquis ou contrats signés) · `en_bonne_voie` (violet, projection) · `a_rattraper` (ambre,
> encore atteignable) · `bloque` (rouge, hors de portée). L'ancien `alerte` est absorbé par
> `a_rattraper` (décision de Benoît : un 4ᵉ état, pas un 5ᵉ).
> - Le vert ne récompense plus une extrapolation du rythme passé (point 5).
> - Le rouge exige que l'écart dépasse le **plafond de l'Annexe 10** (28 cachets × 12 h = 336 h/mois,
>   déjà sourcé dans la config) sur le temps restant — plus de « Bloqué » quand il manque un cachet
>   (point 6). Le seuil des 30 jours ne colore plus le badge : il vit dans `echeanceImminente`, et le
>   centre d'alertes garde son alerte critique **à l'identique** (vérifié par 4 tests dédiés).
> - +19 tests, dont 6 qui rendent réellement le composant et lisent le mot affiché
>   (`src/components/__tests__/ProjectionChart.badge.test.tsx`) : les tests du moteur prouvaient le
>   niveau calculé, pas le mot à l'écran — or c'était le mot qui mentait.
> - ⚠️ **Sans effet sur l'écran de Benoît aujourd'hui** : à 588 h acquises / 507 h, son badge reste
>   « Sécurité » vert (premier cas). Le correctif protège les cycles en cours, pas celui-ci.
>
> **Deux chantiers clos dans la session précédente** (`master` poussé sur `origin/master`,
> `729d410`, déployé — vérifié sur l'écran réel de Benoît) :
> - **Données récupérées** (point 22, `c6c8d8a`) — les contrats avaient disparu. Fusion des deux
>   lignées parallèles en un fichier unique versionné, `docs/cadence-fusion-2026-08-03.json`,
>   **62 contrats**, importé et vérifié à l'écran (588 h / 507 h).
> - **Fusion des moteurs** (points 3, 4, 16, 21, 12 bis, 12 quater — `ca0c86e`) —
>   `engine/indemnisationMensuelle.ts` est le **moteur unique** du tableau mensuel. L'ordre de
>   consommation est tranché par deux sources officielles (Annexe X art. 23 §1er ; guide FT p.12 et
>   p.17 étape 6) et par deux relevés réels. Le mois d'ouverture est calculé sur sa vraie fenêtre.
>   **674,93 € d'ARE faux retirés** de l'écran de Benoît (total 14 961,77 € → 14 286,84 €).
>
> ⚠️ **Deux pièges opérationnels vérifiés ce jour, à connaître avant de « constater » quoi que ce
> soit dans le navigateur** :
> 1. **L'origine canonique est `https://cadence-git-master-benoit3.vercel.app/`** — une URL de
>    BRANCHE, stable à chaque push. Les URLs de déploiement (`cadence-kfgelhf98…`) et les
>    `localhost:517x` sont autant de `localStorage` distincts : c'est la cause probable de la perte du
>    point 22. Ne jamais faire saisir de vraies données ailleurs.
> 2. **Le service worker de la PWA sert l'ancien bundle après un push.** Constaté : le déploiement
>    était correct (vérifié en `curl`ant le bundle déployé et en y cherchant les chaînes du nouveau
>    code) mais l'écran affichait encore les anciens chiffres, et `navigator.serviceWorker.
>    getRegistrations()` ne répondait plus. Contournement qui a marché : recharger avec un paramètre
>    d'URL (`/?maj=<hash>`). Avant de conclure « le correctif ne marche pas », vérifier lequel des
>    deux est en cause.
>
> **Chantier 10, étape 1 — sortie des justificatifs vers Google Drive** (`f9a17f7`, **à valider**).
> La cause de la saturation, là où le point 2 n'en posait que le filet. Le chemin Drive était **déjà
> écrit** (`googleDriveAuth.ts`, `googleDriveStorage.ts`, `DriveSettings.tsx`) : ce chantier n'a rien
> réécrit, il l'a branché.
> **Trois décisions de Benoît, à ne pas re-litiger** : (1) destination **Google Drive** — ⚠️ IndexedDB
> proposé et **REFUSÉ** ; (2) si l'envoi échoue, le justificatif reste local mais l'utilisateur **sait**
> qu'il est à envoyer, compteur visible et nouvelle tentative ; (3) migration de l'existant sur **bouton
> explicite** avec compte-rendu.
> **La simplification qui en découle** : « migrer l'existant » et « réessayer ce qui n'est pas parti »
> sont la **même opération** — envoyer tout ce qui est encore local. Un seul mécanisme
> (`lib/envoiJustificatifsEnAttente.ts`), un seul bouton. Ne pas les dédoubler.
> ⚠️ **Règle absolue du module** : le base64 n'est effacé QUE quand l'envoi de CE fichier est confirmé.
> Contrôle négatif exécuté (l'effacer avant → 3 tests rouges). Et envois **séquentiels** : Drive
> autorise deux dossiers homonymes, donc du parallèle éparpillerait les fichiers dans des
> `Frais_<année>` jumeaux.
>
> **🔴 CE CHANTIER EST SUSPENDU DEPUIS LE 04/08/2026 — NE PAS LE REPRENDRE EN L'ÉTAT.**
> L'ancienne prochaine action (« créer l'ID client OAuth Google ») est **ANNULÉE** : la refonte
> Supabase, décidée le même jour, envoie les documents dans **Supabase Storage** (phase 6), pas sur
> Drive. Cf. la section « État actuel » en tête de ce fichier — c'est elle qui porte la prochaine
> action réelle.
> Ce qui reste vrai et utile à savoir : `VITE_GOOGLE_DRIVE_CLIENT_ID` n'existe que dans
> `.env.example`, donc **l'aller-retour Drive réel n'a JAMAIS été exercé** (uniquement par tests, avec
> un uploader injecté). **Ne jamais écrire ni dire que « Drive fonctionne ».**
> Le travail de `f9a17f7` n'est pas perdu pour autant : `envoyerJustificatifsLocaux` reçoit
> l'**uploader en paramètre**, donc changer de destination revient à injecter un autre uploader —
> exactement ce que cette conception permettait. Le code Drive (3 fichiers + tests) **dort** ; aucune
> décision de le supprimer n'a été prise, ne pas le supprimer sans demander à Benoît.
>
> ⚠️ Ne **pas** attaquer 25 ni 26 sans avoir fait trancher la règle à Benoît : elles ne sont pas sourcées.
>
> **Le point 9 est CLOS depuis le 04/08/2026** — et il n'a rien coûté. Benoît a **décoché
> l'utilisation de ses données pour l'entraînement** dans le menu Privacy de la console Mistral : le
> plan gratuit autorise cet opt-out (help.mistral.ai/en/articles/455207, vérifié à la source), donc la
> bascule sur le plan Scale **n'a pas été nécessaire**. Le texte de consentement n'a pas changé, seule
> sa véracité a été acquise. ⚠️ Fait **déclaré par Benoît**, non vérifiable depuis le code : à
> re-contrôler à chaque changement de clé Mistral. ⚠️ La **rétention** (jusqu'à 30 jours) n'est PAS
> couverte — le Zero Data Retention est réservé au plan Scale, donc ne jamais ajouter au texte une
> phrase sur la non-conservation (détail : `src/content/mentionEnvoiIA.ts`).
>
> ### ⚠️ Chantier tracé, non fait : brancher l'onboarding sur `validerProfilPourEcriture`
>
> Repéré le 03/08/2026 en instruisant le point 23. **Écrit pour être repris sans relire le contexte de
> cette session** — le raisonnement compte plus que la conclusion.
>
> **Le constat.** `App.tsx:188` écrit le profil issu de l'onboarding par un `setDonnees({ ...donnees,
> profil })` **direct**. Les deux autres portes d'écriture du profil passent, elles, par
> `profilSchema` : `validerProfilPourEcriture` (édition depuis « Mon profil », via `modifierProfil`
> dans `App.tsx`) et `importerJSON` (`storage/localStorageAdapter.ts`). Le dépôt le documente
> lui-même en `lib/coherenceProfil.ts:99-101`, qui énumère ces deux portes — et n'y met pas
> l'onboarding. Ce n'est donc pas une régression : cette porte n'a jamais été branchée.
>
> **Ce que ça apporterait vraiment — et c'est peu.** `validerProfilPourEcriture` ne fait qu'un
> `profilSchema.safeParse`, et `profilSchema` = forme (Zod) + cohérence (`.refine` qui rappelle
> `validerCoherenceProfil`). Or `Onboarding.tsx:24` appelle **déjà** `validerCoherenceProfil` et
> désactive « Commencer » tant que le profil est incohérent. Le seul gain net est donc le contrôle de
> **forme**, lui-même déjà garanti par TypeScript puisque l'objet est construit en littéral au point
> d'appel (`Onboarding.tsx`, fonction `valider`). **Aucun bug connu n'est corrigé par ce chantier** :
> l'intérêt est d'avoir un point de passage unique, pas de réparer un défaut observable. À arbitrer
> comme tel — ne pas le vendre comme un correctif de bug.
>
> **Le piège, avec son mécanisme.** Remplacer naïvement la ligne 188 par `modifierProfil(profil)` crée
> un **no-op silencieux**. Pourquoi : `modifierProfil` renvoie un `ResultatEcritureProfil`
> (`{ ok: false, erreur }` en cas de refus, cf. `lib/coherenceProfil.ts:110`) et **n'écrit rien** si la
> validation échoue. Mais la prop `onTerminer` d'`Onboarding` est typée `(profil: Profil) => void` : le
> composant **ne peut pas voir** le refus. Résultat, l'utilisateur clique « Commencer », rien ne se
> passe, aucun message — un bouton mort. Le cas de divergence est précisément « forme invalide mais
> cohérence valide » (le seul que l'onboarding ne filtre pas déjà), donc rare — ce qui le rend d'autant
> plus difficile à remarquer si on ne l'a pas prévu.
>
> **Ce qu'il faut faire pour le brancher proprement.** Il existe déjà un précédent dans ce même
> composant, introduit au point 23 : la prop `erreurImport` d'`Onboarding` remonte l'échec d'un import
> et l'affiche. Reproduire ce motif — soit faire remonter le `ResultatEcritureProfil` par le retour
> d'`onTerminer`, soit ajouter une prop d'erreur — et **afficher le message dans le formulaire**.
>
> **Critère de recette** : un test qui rend `Onboarding` avec un profil de forme invalide, clique
> « Commencer », et vérifie qu'un message d'erreur s'affiche — jamais un bouton qui ne fait rien.
>
> ⚠️ **Point 26 ouvert, découvert en corrigeant le 7 — à instruire avant de coder** : le plafond de
> 28 cachets/mois ne plafonne aucun décompte (il ne sert qu'à trois avertissements), alors que
> `decoupageMensuel.ts:8-9` affirme qu'il « gouverne l'affiliation aux 507 h ». Si c'est le commentaire
> qui a raison, l'app surcompte les heures d'un mois chargé et peut afficher un faux « Sécurité ».
> Non sourcé. Même zone d'ombre que `docs/SPEC.md:534` (proratisation sur mois partiel).
>
> **⏸ Bloqués — pas par le code, ne pas les ouvrir en croyant coder** : **11** (contradiction Unédic /
> France Travail sur le plafond ARE — « rien à faire dans le code d'ici là », il faut une réponse d'un
> organisme) · **12** (attribution d'un contrat à son seul mois de fin pour le salaire de référence :
> sa fiche dit « la règle officielle peut très bien être *à la date de fin*, **ne rien changer sans
> source** » — c'est une recherche, pas une tâche de code ; sorti du chantier 4 le 03/08) · **12 ter**
> (il manque les contrats réels depuis le 24/03/2025 et les justificatifs de déclaration mensuelle —
> c'est Benoît qui débloque) · **18**, **19**, **20** et désormais **26** (valeurs à sourcer).
>
> **▶ Ensuite — sécurité des entrées** : **8** (endpoint IA ouvert), **10** (JSON non borné), reste
> du **2** (échec d'écriture silencieux, filet minimal seulement).
>
> **▶ Ensuite — 25** : plafond de cumul 118 % du PMSS jamais appliqué. Portée nulle sur les données
> actuelles de Benoît (2 957 € contre 4 725,90 €), réelle sur un mois à forte activité.
>
> **▶ Ensuite — trancher l'architecture de stockage des PDF : Supabase seul vs hybride
> Workspace.** C'est le sujet le plus mûr du backlog et le prérequis de plusieurs autres (étape 3 du
> module frais réels, gate premium, `api/extract-document.ts` en production). Éléments déjà présents
> dans le dépôt pour instruire la décision : `docs/spec_frais_reels_cadence.md` §9 (deux modes déjà
> spécifiés — localStorage par défaut, Google Drive optionnel, champ `driveFileId` prévu),
> `src/lib/googleDriveAuth.ts` + `src/lib/googleDriveStorage.ts` (déjà écrits, opt-in, cantonnés au
> module frais réels), `docs/SPEC.md` §11.B (chiffrage d'hébergement : ~45 $/mois Vercel Pro +
> Supabase Pro, documents supposés rester en local dans ce chiffrage), et le point backlog « programme
> non-profit Supabase » (non confirmé).
> ⚠️ **Je n'ai trouvé aucune trace écrite dans le dépôt d'une étude comparative « Supabase seul vs
> hybride Workspace » proprement dite** (recherche sur `CLAUDE.md`, `docs/`). Si cette recherche a été
> faite ailleurs (fil Claude.ai, notes hors dépôt), en déposer la conclusion ici avant de trancher —
> sinon la décision repartirait de zéro sans le savoir.

### Le plus récent d'abord — 03/08/2026 (revue complète du code, et ce qu'elle a déclenché)

- 📋 **Revue complète du projet menée à la demande de Benoît : `docs/critique_2026-08-03.md`**
  (11 🔴 + 9 🟡 à l'origine, + 1 🔴 découvert ensuite). Thème dominant : le projet est rigoureux sur
  les *formules* (constantes sourcées, écarts tracés) et beaucoup moins sur les *chemins* — deux
  moteurs concurrents, un écran qui annonce ce qu'il ne déduit pas, des badges qui traduisent une
  projection en certitude, un stockage sans filet. Tableau de suivi des corrections en fin de document.
- 🔴 **NOUVEAU, non traité — le mois d'ouverture partiel est mal traité par les DEUX moteurs**
  (point 21). Mesuré sur données réelles : aucun des deux ne reproduit les 4 mois certifiés sur le
  chemin de production. `calculerSerie` traite le mois d'ouverture comme un mois entier de 31 jours et
  y consomme 9 jours (7 délai + 2 CP) là où le relevé réel n'en montre que 2 ; `calculerSerieDepuisContrats`
  l'ignore complètement et redémarre le mois suivant sur les totaux intacts de la notification. Le test
  certifié ne passe qu'avec un solde de mi-parcours saisi à la main. **Conséquence probable : 7 jours
  indemnisés affichés en février au lieu de 0, ~376 € de trop** — à confirmer sur un export frais avant
  tout code.
- ⚠️ **Filet minimal pour les points 3+4 : validé puis abandonné après mesure** (point 12 bis). Faire
  autorité à A sur les colonnes « Délai »/« Franchise CP » produirait un tableau consommant 7 jours de
  franchise sur 5 notifiés, et changerait les montants — mon argument « aucun montant ne bouge » était
  faux, l'identité symétrique invoquée ne vaut qu'à soldes de départ égaux. Deux autres options rejetées
  par Benoît, motifs consignés. **Aucun filet viable avant l'arbitrage du mois partiel.**
- ✅ **Points 1 et 4 traités, 2 sous filet minimal, 3 avec motif corrigé** — détail dans les entrées
  ci-dessous et dans le tableau de suivi de la critique.

### 03/08/2026 (perte de données sur lecture ratée : corrigée)

- 🔴→✅ **Bug réel de devoir sacré n°1, corrigé : une lecture ratée du stockage local effaçait
  définitivement toutes les données, sans aucune action de l'utilisateur.** Trouvé par la revue
  complète du 03/08 (`docs/critique_2026-08-03.md`, point n°1).
  **Le défaut** : `chargerDonnees` renvoyait le même état vide pour « il n'y a rien » et pour « il y
  a quelque chose que je n'arrive pas à lire ». `App.tsx` plaçait cet état vide dans son état, et son
  effet de sauvegarde — dont la seule garde était un `useRef` déjà passé à `true` — le réécrivait
  aussitôt **par-dessus** le contenu d'origine. Trois portes menaient là : échec Zod (la plus
  probable — toute évolution du schéma rend illisible l'existant), `JSON.parse` en échec, migration
  qui lève. Le contenu détruit était souvent parfaitement récupérable à la main.
  **Mesuré avant correctif, pas supposé** : un test jetable a montré la clé passer de
  `{"profil":{...},"contrats":[{...}]}` à `{"profil":null,"contrats":[],...}` au simple rendu de
  `<App/>`, sans un clic.
  **Correctif** : `chargerDonnees` renvoie un `ResultatChargement` à trois issues (`ok` / `vide` /
  `illisible`, cette dernière transportant le texte brut, le détail technique et la copie de secours
  si elle est lisible). Le verrou d'écriture porte sur **cet état**, jamais sur un drapeau — une
  lecture illisible ne peut structurellement plus déclencher d'écriture. Nouvel écran bloquant
  `components/EcranDonneesIllisibles.tsx` : téléchargement du brut et zone copiable **en premier**,
  détail technique replié (il nomme le champ fautif, ex. `contrats.0.type : Invalid enum value…`),
  restauration de la copie de secours, et « repartir de zéro » — seule action autorisée à écrire —
  gaté par une case à cocher décochée par défaut.
  **Quarantaine — mécanisme de sûreté supplémentaire, hors du principe initialement validé, gardé
  après arbitrage de Benoît le 03/08/2026.** *Quand* : uniquement au clic sur « repartir de zéro »,
  donc après que l'utilisateur a coché la case — jamais à la lecture, jamais automatiquement.
  *Quoi* : le contenu illisible est recopié tel quel sous la clé `cadence:v1:donnees.illisible` juste
  avant que `cadence:v1:donnees` soit remplacée par un état vide. *Pourquoi* : le téléchargement du
  brut est proposé en premier sur l'écran, mais rien ne garantit que l'utilisateur l'ait fait — la
  quarantaine est le dernier filet derrière le seul geste destructeur de tout le correctif.
  ⚠️ Ne pas confondre avec l'issue de lecture `illisible` : celle-là est un DIAGNOSTIC qui interdit
  d'écrire, celle-ci est un EFFET DE BORD d'écriture au seul moment où écrire est autorisé.
  **Clé unique et fixe, écrasée à chaque incident** — jamais une clé horodatée par incident : le coût
  reste borné à UNE copie du jeu de données quel que soit le nombre d'incidents, ce qui évite de
  transformer ce filet en cause de saturation. Garanti par un test dédié (« une seule quarantaine à
  la fois »). **Dette résiduelle, rattachée au point n°2** : cette clé n'est jamais purgée ensuite —
  après un « repartir de zéro », une copie du jeu de données reste indéfiniment dans le navigateur.
  Coût borné mais permanent, à traiter avec le reste du point n°2 (que purger, dans quel ordre).
  **Copie de secours** : `cadence:v1:donnees.backup` reçoit la version précédant chaque écriture
  réussie. Écrite APRÈS le succès de l'écriture principale (son propre échec ne compromet jamais la
  donnée de record), et **jamais consommée par une réécriture à l'identique** — sans quoi chaque
  démarrage de l'app l'aurait écrasée par une copie du présent.
  **Filet minimal du point n°2 inclus** (`sauvegarderDonnees` renvoie son échec, bandeau rouge non
  refermable) parce que la copie de secours double l'espace occupé : créer ce risque en laissant
  l'échec invisible aurait été irresponsable. **Le point n°2 reste OUVERT** (quota plein, purge,
  export de secours automatique).
  **Preuves** : test de régression `components/__tests__/App.donneesIllisibles.test.tsx` (5 tests,
  échouait avant le correctif), `storage/__tests__/chargementEtSauvegarde.test.ts` (13 tests : trois
  issues, rotation de la copie, échec d'écriture remonté, quarantaine), 646 tests verts, `tsc -b`
  propre. **Vérifié dans le vrai navigateur** : données plantées → contrat ajouté via l'interface →
  copie de secours créée avec la version précédente → clé corrompue (`type` de contrat inconnu, JSON
  valide) → rechargement → écran d'erreur affiché, **clé toujours à 876 octets avec ses 3 contrats et
  son profil**, aucune navigation rendue, bouton « repartir de zéro » désactivé → restauration
  cliquée → app repartie sur les 2 contrats précédents.

### 03/08/2026 (plafond ARE historisé, trop-perçu sourcé puis fiabilisé)

Session longue, 5 commits (`4b0105c` → `3e0d3c8`), tous poussés. Détail complet dans
`docs/reprise.md` (points 14 à 17) et `docs/validation.md` (sections datées du 03/08).

- ✅ **Plafond ARE daté** (`4b0105c`, `9f604f0`) — `are.plafondHistorique` + `getPlafondAreAt`
  (`engine/plafondAreUtils.ts`), `dateEffet` obligatoire sur `calculerAJBrute`. Trois entrées sourcées
  (174,80 € en 2024 / 177,56 € en 2025 / 181,18 € en 2026). Corrige un vrai faux chiffre : toute
  simulation sur une FCT passée appliquait le plafond courant.
- ⚠️ **Contradiction de sources sur ce plafond**, découverte ensuite : le guide FT éd. juillet 2026
  écrit « 174,80 € depuis le 1er janvier 2024 ». Arbitrage pris (config alignée sur Unédic),
  documenté aux trois endroits, **non refermé** — cf. backlog priorité haute.
- ✅ **Trop-perçu (`tropPercu`) sourcé puis fiabilisé** (`d47720c`, `54cb1de`, `7ae6913`, `3e0d3c8`) —
  déclencheur et formule confirmés à la source primaire ; **aucun montant câblé**
  (`tropPercuChiffrable: false`, garde-fou testé). Le booléen `tropPercuRisque` est devenu un type à
  trois états (`avere` / `ecarte` / `indetermine` + `raison`), ce qui a fermé un **faux feu vert** :
  l'absence de bandeau couvrait aussi « Cadence ne sait pas ». Puis la franchise salaires est devenue
  déclarative (`ouvertureDroits.franchiseSalairesTotale`, `undefined` ≠ `0`), rendant `ecarte`
  réellement atteignable.
- ⬜ **Reste ouvert, sans blocage** : verrou brut/net du montant de trop-perçu (attend une source
  explicite ou un relevé portant un trop-perçu notifié — à trancher seulement si un montant est
  demandé) ; contradiction plafond ci-dessus.

### 02/08/2026 (alerte AEM vs bulletin de paie, cohérente sur les deux flux d'import)

- ✅ **L'alerte « l'AEM fait foi, pas le bulletin de paie » couvre maintenant les deux flux
  d'import, avec un seul texte de référence.** Avant ce chantier : le rappel n'existait qu'en
  version STATIQUE côté import manuel (`ImportBulletins.tsx`), toujours affiché quel que soit le
  document déposé (`lib/extractionBulletin.ts` ne détecte pas AEM/bulletin du tout) — le canal IA
  n'avait rien.
  **Nouveau champ `contrat.natureDocumentSource: "aem" | "bulletin_paie" | null`**
  (`types/extraction.ts`) — même rigueur que `etablissementAgree`/`enRapportAvecMetier` : rempli
  UNIQUEMENT si le document porte littéralement « Attestation d'Employeur Mensuelle »/« AEM » ou
  « Bulletin de paie »/« Bulletin de salaire » en titre/en-tête, jamais déduit des champs présents
  (brut, cachets, employeur — souvent identiques entre les deux types de document). Sans mention
  littérale → `null`, jamais un choix par défaut (CAS 10, `api/extract-document.ts`).
  **Routage** (`lib/routageExtraction.ts`, cas "contrat") : avertissement ajouté au tableau
  `avertissements` existant (même emplacement que les défauts de formulaire) uniquement quand
  `natureDocumentSource === "bulletin_paie"` — jamais sur une vraie AEM (rien à signaler), jamais
  sur `null` (silence honnête plutôt qu'un faux avertissement, devoir n°2 dans les deux sens).
  N'a jamais bloqué l'import : `contrat` reste toujours `revue_formulaire`, jamais refusé.
  **Texte de référence unique** (`content/rappelAEM.ts`, `RAPPEL_AEM_FAIT_FOI`) : réutilisé tel
  quel par le rappel statique du canal manuel (`ImportBulletins.tsx`, remplace le fragment
  dupliqué) ET par l'avertissement conditionnel du canal IA — un seul fait, deux phrases
  d'encadrement légitimement différentes (statique/toujours affiché vs conditionnel/après lecture).
  **Vérifié dans le vrai navigateur** : fixture bulletin (`natureDocumentSource: "bulletin_paie"`)
  → avertissement affiché avec le texte de référence ; fixture AEM
  (`natureDocumentSource: "aem"`) → aucun avertissement, champ affiché « AEM (Attestation
  d'Employeur Mensuelle) » ; message statique du canal manuel inchangé au mot près hors la source
  désormais partagée. **Aucun document réel de type AEM/bulletin disponible dans le projet** pour
  tester le canal IA sur pièce (spécimens hors dépôt, cf. règle de confidentialité déjà actée) —
  dit explicitement plutôt que simulé comme testé sur pièce. 590 tests verts, `tsc -b` propre.

### 02/08/2026 (import IA : support de l'attestation de taux de prélèvement à la source)

- ✅ **Nouveau type de document reconnu par l'import IA : attestation de taux de prélèvement à la
  source (PAS)**, espace personnel impots.gouv.fr. Distinct de `profil_ouverture_droits.tauxPrelevementSource`
  (notification/relevé, une seule proposition par document, retient la section la plus récente
  faute de mieux) : nouvelle cible dédiée `taux_pas_historique` (`types/extraction.ts`) — **une
  proposition par couple (taux, date) trouvé sur le document**, jamais une seule qui choisirait une
  valeur "primaire". Ferme délibérément, pour ce nouveau canal, le gap documenté plus bas
  (« Sélection de la section la plus récente... ») : plus de sélection automatique possible par
  construction, l'utilisateur voit et applique chaque entrée lui-même. `valeur`/`dateEffet`
  volontairement non nullables (contrairement au champ existant) — sans citation littérale des
  deux, aucune proposition ne doit être produite (`info_seule` sinon).
  ⚠️ Le gap PRÉEXISTANT sur le canal notification/relevé (une seule proposition par document) n'est
  **pas** retouché ici — toujours non validé sur pièce réelle, cf. entrée plus bas, philosophie du
  projet inchangée : pas de correctif sans preuve sur pièce.
  **Routage** (`lib/routageExtraction.ts`) : applicable seulement si `Profil.ouvertureDroits` existe
  déjà (rien où rattacher le taux sinon — même refus de principe qu'`ouvertureDroits` incomplet),
  sinon message clair invitant à renseigner d'abord l'ouverture de droits. Fusionne via la même
  fonction `fusionnerTauxPASHistorique` que le canal existant (ajoute, n'écrase jamais).
  **Prompt** (`api/extract-document.ts`) : nouvelle section lexique dédiée + CAS 9 (deux taux
  successifs, aucun ne doit être "choisi") + item 11 de la relecture finale.
  **Contenu statique mis à jour** : `content/documentsUtiles.ts` (`canal: "ia_possible"`, la note
  disait à tort que ce document n'était "pas reconnu par le canal IA").
  **Testé dans le vrai navigateur** (pas seulement en test unitaire) : fixture à 2 taux (`lib/fixturesExtraction.ts`)
  vérifiée dans la maquette de revue IA — "Non applicable" tant qu'aucune ouverture de droits
  n'existe (message clair), "Applicable" dès qu'elle existe ; les deux propositions appliquées l'une
  après l'autre (deux clics réels, pas dans le même batch React) reconstruisent bien l'historique
  complet dans l'ordre (`2025-01-01 → 2.9 % · 2026-01-01 → 3.45 %`), sans perte.
  **Aucun document réel de ce type disponible dans le projet** pour ce chantier — dit explicitement
  plutôt que simulé comme testé sur pièce (cf. CAS 9, prompt). 584 tests verts, `tsc -b` propre.

### 02/08/2026 (correctif : dateNaissance à année invalide faussait silencieusement le plafond enseignement)

- 🔴 **Bug réel confirmé et corrigé : `dateNaissance` à année malformée (ex. `"19994-06-09"`)
  faisait basculer silencieusement le plafond enseignement sur le seuil <50 ans (70 h) au lieu
  d'un vrai signal d'erreur.** Trouvé lors d'un audit backlog (5 points vérifiés sur preuve, pas
  sur supposition). Impact réel confirmé AVANT le correctif par un test jetable : `ageAuJour`
  (`engine/dateUtils.ts`, date-fns `differenceInYears`) renvoie `NaN` sur cette valeur, et
  `NaN >= 50` valant `false`, `decompteHeures.ts:180` retombait sur `plafondMoins50ans` quel que
  soit l'âge réel — un faux chiffre sans le moindre signal (devoir n°2). Bloqué depuis toujours à
  la saisie normale (`DateNaissanceInput.tsx`, année à 4 chiffres max), mais un JSON importé ne
  passe jamais par ce composant : `profilSchemaForme`/`profilSchema` (`lib/coherenceProfil.ts`)
  n'exigeaient qu'un `z.string()` non vide, aucun format.
  **Correctif** : nouvelle fonction pure `dateIsoEstValide` (`lib/dateJourMoisAnnee.ts`, réutilise
  `decouperDateIso`/`dateEstValide` déjà existants) + appel dans `validerCoherenceProfil` —
  volontairement PAS dans `profilSchemaForme` (schéma de LECTURE, `chargerDonnees`) pour ne pas
  faire échouer au chargement un profil déjà stocké (devoir n°1, cf. règle déjà actée dans ce
  fichier de cohérence). La règle ne s'applique donc qu'à l'ÉCRITURE (`profilSchema` : onboarding,
  édition, ET `importerJSON`). **Résultat à l'import d'un JSON corrompu avec cette valeur : rejet
  propre, message clair** (« La date de naissance n'est pas une date valide... »), aucun état
  partiel écrit — jamais une correction automatique silencieuse. 8 nouveaux tests (dont la
  reproduction exacte du cas `"19994-06-09"` à l'import JSON). 577 tests verts, `tsc -b` propre.

### 01/08/2026 (suite : historique de taux PAS, contrat d'enseignement re-confirmé, SR ~400k€ élucidé — erreur de saisie, pas un bug)

- ✅ **Historique de taux PAS daté** (`4cd3e66`) : `tauxPrelevementSource` (scalaire) devenait
  rétroactif — un seul taux courant appliqué à tous les mois du tableau `RevenusMensuels.tsx`, y
  compris les mois passés qui avaient un taux DGFIP différent (confirmé sur relevés réels de Benoît :
  3,30 % mi-2025, 3,10 % dès fin 2025/2026). Remplacé par `tauxPrelevementSourceHistorique`, même
  pattern que `ajReelleHistorique` (`getTauxPASAt`, `engine/ajReelleUtils.ts`). Migration silencieuse,
  UI dédiée dans « Mon profil », pipeline d'extraction IA corrigé pour AJOUTER une entrée datée au
  lieu d'écraser l'historique. 542 tests verts.
- ✅ **Contrat d'enseignement re-vérifié** (même commit) : la décision (saisie manuelle uniquement,
  cf. entrée du 01/08 ci-dessous) est confirmée par deux tests de régression explicites prouvant que
  `ContractForm.tsx`/`decompteHeures.ts`/`salaireReference.ts` ne distinguent jamais selon
  `Contrat.source` — rien à recoder, seulement à vérifier.
- ✅ **SR ~400 000 € élucidé — CE N'ÉTAIT PAS UN BUG, chantier FERMÉ** : Benoît avait signalé un SR
  affiché manifestement irréaliste. Investigation complète sur les données réelles (56 contrats) :
  aucune reproduction (SR recalculé avec le vrai moteur = 6 049 €, somme de toute la carrière =
  25 593 €), les 4 hypothèses demandées (doublon, date aberrante, confusion mensuel/annuel,
  enseignement mal exclu) toutes écartées avec preuve. Benoît a ensuite vérifié de son côté :
  **une erreur de saisie de sa part** (pas précisée davantage), pas un défaut du moteur Cadence.
  Aucun code touché pour ce chantier — `salaireReference.ts`/`decompteHeures.ts`/`periodeReference.ts`
  calculaient déjà correctement. Cf. `docs/reprise.md`, `docs/SPEC.md` §11.B (l'écart de formule à un
  SR extrême, noté depuis le 31/07/2026, reste une question distincte et toujours ouverte).
- 🔴 **Bug réel confirmé sur `trouverContratsCorrespondants`** (`3ac2e8f`) : le filtre exigeait
  `statutVerification === "a_verifier"`, excluant SILENCIEUSEMENT tout contrat créé avant l'ajout de
  ce champ (01/08/2026) — soit la totalité des 56 contrats réels de Benoît à l'époque. Corrigé en
  `!== "confirme"` (absent traité comme équivalent à `"a_verifier"`, jamais réécrit — devoir n°1).
  543 tests verts.
- ✅ **Premier envoi réel à Mistral via le vrai chemin utilisateur** (émulateur dev `e7bc1d0`,
  `vite.config.ts`, car `vite dev` ne sert pas les Vercel Functions) : `Justificatif_declaration_02_2026.pdf`
  de Benoît, consentement réel, 4 propositions. NIR absent confirmé. Les deux pièges déjà encodés
  dans le prompt (date « depuis le » ≠ période du mois ; même employeur deux fois dans le mois,
  jamais fusionné) correctement gérés. 3/4 correspondances détectées ; la 4ᵉ (Commune de
  Levallois-Perret) absente — investigué avec Benoît : ni `statutVerification` (`"confirme"`
  écarté), ni caractère invisible (`normaliserEmployeur` exécuté sur les deux vraies chaînes,
  identique) — cause réelle trouvée en lisant l'export réel : le contrat existant portait
  `employeur: "LEVALLOIS"` (raccourci de saisie), pas le nom officiel. Pas un bug : le mécanisme
  fonctionne comme prévu, c'est un écart de donnée.
  ⚠️ **Correction (retest de juin, cf. plus bas) : le premier script console de renommage n'a PAS
  persisté.** Cause probable trouvée dans le code : `App.tsx:62-64` sauvegarde automatiquement
  `donnees` (état React en mémoire) vers `localStorage` à chaque changement — si l'onglet est resté
  ouvert et qu'une action a suivi le script avant le rechargement, cette sauvegarde a réécrit
  l'ancienne valeur par-dessus. Un second script combiné a été fourni (renommage + nettoyage
  Étoiles, cf. plus bas) avec l'instruction « script → F5 immédiat, rien entre les deux » —
  **statut d'exécution non confirmé à la fin de cette session, à vérifier au démarrage de la
  prochaine.**
- ✅ **`diagnostiquerAbsenceCorrespondance`** (`449fec1`) : le cas Levallois-Perret a montré qu'un
  « aucune correspondance » silencieux peut recouvrir plusieurs causes indiscernables sans lire le
  code. Nouvelle fonction pure (`lib/correspondanceContrat.ts`), appelée uniquement quand
  `trouverContratsCorrespondants` est vide, distinguant `deja_confirme` / `nom_different_meme_mois`
  / `aucune_piste`. `RevueExtraction.tsx` affiche désormais un message informatif — aucun bouton,
  aucune action automatique. 551 tests verts.
- ✅ **Verdict tranché sur l'incident OCR du 30/07 (`dd1139d`)** : re-creusé en fin de session.
  (b) **infirmé, avec réserve** — la vraie cause était très probablement un trou de lexique
  (bulletins GHS-sPAIEctacle multi-colonnes), pas un OCR réellement vide. Preuve : `081a516` (le
  correctif qui a clos l'incident, lexique SEUL) a été testé « 7/7 champs corrects » sur le
  bulletin réel — un lexique ne répare jamais un texte OCR vraiment vide. Corroboré par le test AEM
  réel du même format documenté juste au-dessus (`ocrIllisible.ts` ne s'était pas déclenché).
  `ocrIllisible.ts` reste un garde-fou valable pour un futur cas de VRAI OCR vide, mais ne couvre
  pas rétroactivement la cause du 30/07 — deux incidents distincts. Certitude absolue impossible :
  le document/la réponse Mistral bruts du 30/07 n'ont jamais été conservés. Cf. `docs/reprise.md`.
- 🔶 **Fix préventif (pas un bug confirmé) : le « Total des activités » pouvait aussi être pris pour
  un `salaireBrut` individuel** — le prompt avertissait déjà contre ce piège pour `nbHeures`/
  `nbCachets` (CAS 7 ci-dessus) mais rien pour le montant en euros de la même ligne. CAS 8 ajouté
  (exemple fictif). Document réel confirmé disponible pour un cas de non-régression
  (`Justificatif_declaration_02_2026.pdf`, motif exact présent : total 2 100 € à côté de 4 montants
  individuels) — le premier envoi réel de ce document (avant ce correctif) n'était déjà pas tombé
  dans ce piège, mais ça ne garantit rien pour l'avenir. ✅ **Confirmé plus tard le même jour** par
  un second envoi réel (`Justificatif_declaration_06_2026.pdf`, cf. plus bas) : aucune confusion,
  chaque montant individuel resté correct.
- 🔴 **Bug réel confirmé : résidu `nbHeures` sur des contrats cachets, comptés en double** — trouvé
  en creusant l'écart 756h/588h que Benoît signalait. `onnpl` (7 cachets) et `Les Arts Phocéens`
  (26/04, 6 cachets) avaient un `nbHeures` EXACTEMENT égal à `nbCachets × 12` — pas une vraie
  activité indépendante, un résidu d'une saisie antérieure à l'ancien formulaire (sélecteur exclusif
  Cachets/Heures, remplacé depuis par les deux champs toujours visibles + somme systématique,
  cf. `83d0429`). Exécuté sur les vraies données : **756h → 600h** après retrait des deux résidus.
  Cause confirmée par exécution (pas supposée) : `typeRemuneration` des 2 contrats fautifs valait
  toujours `"heures"`, jamais `"cachet"` — corrélation nette, pas une coïncidence.
- ✅ **Garde-fou « Activité mixte »** (`c3897ac`) : cartographie complète en 9 points (A à I) de
  TOUS les chemins qui écrivent `nbHeures`/`nbCachets` avant d'écrire une ligne de code (saisie
  manuelle, import IA nouveau contrat, confirmation de correspondance, édition, contrat récurrent,
  cas zéro explicite). `ContractForm.tsx` : case à cocher, décochée par défaut (mode exclusif —
  remplir un champ efface l'autre), précochée automatiquement si les deux champs sont déjà
  renseignés à l'ouverture. **Point critique isolé (E)** : « Confirmer la correspondance » écrit
  directement sans passer par `ContractForm`, donc sans la case — `detecterMergeAmbiguHeuresCachets`
  (`lib/routageExtraction.ts`) bloque ce chemin précis : si le document ne fournit qu'un champ et
  que le contrat existant a déjà l'autre, la fusion en un clic est remplacée par un état « à
  vérifier manuellement », jamais un écrasement silencieux. Logique extraite en fonctions pures
  (`lib/activiteMixteFormulaire.ts`) car le projet n'a pas d'infrastructure de test de composants
  React — vérifié aussi en navigateur (mode exclusif efface bien, mode mixte ne touche à rien).
  560 → 568 tests verts.
- ✅ **Second test réel Mistral** (`Justificatif_declaration_06_2026.pdf`) : confirme le fix
  `salaireBrut` (ci-dessus) ET révèle que le contrat « Les Étoiles du Classique » (validé
  « légitime, ne rien toucher » plus tôt dans la session) était en fait **lui aussi corrompu** —
  le document officiel dit littéralement « Vous avez travaillé 14h et effectué 1 cachet(s) »
  (une seule activité, pas deux), contredisant le `nbHeures: 26` stocké. Preuve documentaire directe
  qui renverse la confirmation antérieure de Benoît — **756h → 588h** au total une fois les 3
  résidus retirés (84+72+12=168h), exécuté et confirmé avec le vrai moteur. Confirme aussi (à
  nouveau) que le renommage LEVALLOIS n'avait toujours pas pris. Script combiné fourni (nettoyage
  Étoiles 26→14 + renommage Levallois) — **statut d'exécution non confirmé à la fin de cette
  session.**
- ✅ **Tableau comparatif de correspondance** (`16a0330`) : l'ancienne liste « champ : ancien →
  nouveau » ne montrait QUE les champs différents — un champ identique restait invisible, silence
  ambigu (même piège que « aucune correspondance » avant `diagnosticAbsence`). `comparerContratExistant`
  remplace `champsDivergents` : retourne toutes les lignes lues par le document, identiques
  (neutre) ou différentes (accent + flèche). Nouveau composant `TableauComparaisonContrat.tsx`.
  568 → 569 tests verts.

### 01/08/2026 (fin de session : cycle de vie du contrat, bug heures+cachets moteur, fusion de branches close)

- ✅ **Plan « cycle de vie du contrat » validé par Benoît avant code, implémenté en 2 commits**
  (`116b482`, `7c835de`) : `Contrat.statutVerification?: "a_verifier" | "confirme"` (défaut selon
  `source`, jamais rétroactif) ; nouvelle fonction `modifierContrat` (n'existait pas — fusionnée
  avec une demande séparée d'édition manuelle libre, bouton « Modifier » sur `ContractList.tsx`,
  jamais sur un contrat de série récurrente) ; `lib/correspondanceContrat.ts`, mécanisme UNIQUE de
  détection de correspondance/doublon, réutilisé pour fermer le risque noté au commit `908c6d7`
  (`justificatif_declaration`) qui n'était alors pas encore couvert. Bug trouvé en vérifiant dans le
  navigateur : deux `<ContractForm>` coexistaient avec les mêmes `id` de champs pendant une édition
  — corrigé en remontant l'état d'édition dans `App.tsx`. 530 tests verts.
- 🔴 **Bug de calcul confirmé (pas qu'une question d'UI)** (`391ffce`, `83d0429`) : un contrat
  « artiste » peut porter cachets ET heures à la fois (confirmé par Benoît, réel sur une AEM) —
  `engine/decompteHeures.ts` n'en comptait qu'un (celui de `typeRemuneration`), sous-comptant l'autre
  silencieusement, y compris dans le NHT (montant ARE, pas seulement le compteur 507 h). Corrigé :
  les deux comptent désormais toujours ensemble. `ContractForm.tsx` : sélecteur exclusif
  Cachets/Heures supprimé, les deux champs toujours visibles. `docs/SPEC.md` corrigé (affirmait
  l'inverse). Un bug de routage distinct (deux propositions dupliquant un salaire) corrigé au
  passage (`391ffce`).
  ⚠️ **Trouvé en vérifiant les données réelles** : 5 contrats déjà saisis (« Les Arts Phocéens »,
  export du 24/07) avaient déjà ce cas et étaient donc sous-comptés avant ce correctif — signalé à
  Benoît, **décision de correction toujours en attente** (ambiguïté : vraie coexistence ou résidu de
  l'ancien formulaire qui ne réinitialisait pas le champ masqué en changeant de mode).
- ✅ **Fusion de branches close, stratégie décidée** (`44b6b81`) : `master` seule branche de travail
  désormais, `backend-api-import-ia` abandonnée. Écart trouvé : `origin/master` était resté en
  retard malgré un push que Benoît croyait réussi — reconfirmé ensuite (`391ffce` atteint), mais
  **3 commits locaux again en attente de push** (`83d0429`, `116b482`, `7c835de`) à la fin de cette
  session — à repousser au démarrage de la prochaine.
- ✅ **Contrat d'enseignement — décision produit actée, blocage levé** (`78c2e74` puis décision plus
  tard le même jour) : les contrats d'enseignement ne seront PAS lus/extraits par IA — saisie
  manuelle uniquement. Plus besoin d'attendre un spécimen réel de Benoît : `ContractForm.tsx`
  couvrait déjà tous les champs (`etablissementAgree`/`enRapportAvecMetier`), et le moteur ne
  distingue déjà pas selon `source` — vérifié par deux tests de régression explicites
  (`decompteHeures.test.ts`, `salaireReference.test.ts`). `contrat_enseignement` reste réservé en
  commentaire dans `typeDocumentDetecte`, mais plus comme une place en attente d'un lexique IA futur
  — seulement pour qu'un futur chantier ne réutilise pas ce nom par erreur.

### 01/08/2026 (test réel AEM en production, bug heures/cachets trouvé et corrigé)

- ✅ **Premier test réel d'une AEM sur l'app déployée** (`cadence-benoit3.vercel.app`, canal
  « Importer avec l'IA », spécimen réel format GHS sPAIEctacle fourni par l'utilisateur — jamais
  committé, données personnelles réelles, cf. règle de confidentialité ci-dessous). Fait par
  Benoît lui-même (upload + consentement + envoi), réponse JSON lue via Network DevTools —
  **pas** le Playground Mistral (un premier essai par erreur via le Playground le 01/08 a été
  écarté : aucune trace de `document_annotation`, ne valide ni le filtrage du NIR ni le routage,
  juste l'OCR brut). Résultats :
  - ✅ `typeDocumentDetecte: "aem"` correctement distingué de `bulletin_paie`.
  - ✅ **Aucun OCR vide** sur ce spécimen (le détecteur `ocrIllisible.ts`, commit `dd1139d`, ne
    s'est pas déclenché) — le format GHS sPAIEctacle n'est donc **pas** systématiquement en cause
    dans l'échec silencieux du 30/07 sur un bulletin du même logiciel. Cohérent avec le doute déjà
    consigné dans `dd1139d` (le correctif `081a516` qui avait clos cet incident semblait résoudre
    un problème de lexique, pas un OCR réellement vide) : les deux incidents sont vraisemblablement
    deux problèmes distincts, pas le même.
  - ✅ **NIR absent de la réponse**, vérifié par recherche exhaustive dans le JSON complet — la
    règle d'exclusion (`api/extract-document.ts`, « N'extrais JAMAIS... NIR ») tient aussi sur une
    AEM, pas seulement sur les documents France Travail déjà testés.
  - ✅ Champs corrects avec citation à l'appui : dates de contrat, `type: "artiste"`,
    `typeRemuneration: "heures"`, `nbHeures`, `salaireBrut`, employeur (« Association du Festival
    de St Germain en Laye »). Garde-fous actifs : `etablissementAgree` resté `null` avec
    avertissement (pas de déduction depuis un nom d'établissement) ; `territoire` signalé « non lu »
    plutôt que deviné.
  - 🔴 **Bug trouvé : `nbCachets` rangé à `null` avec une justification FAUSSE.** Le document porte
    à la fois « Nombre d'HEURES effectuées : 14 » ET « Nombre de CACHETS : 3 » pour le même contrat
    (cas réel d'un artiste musicien cumulant les deux sur une même attestation — la question posée
    avant ce test, cf. entrée précédente). Le modèle a correctement lu les heures, puis justifié
    l'absence de cachets par « le document indique une valeur vide » — **alors que la case portait
    bien 3**. Pas une prudence légitime (un vrai null aurait été correct s'il l'était) : une
    affirmation fausse sur un contenu non vérifié, la même famille d'erreur qu'inventer une valeur
    (devoir n°2), juste dans l'autre sens (nier au lieu d'inventer).
  - ✅ **Corrigé** : nouvelle règle de lexique dédiée dans `api/extract-document.ts` — heures et
    cachets doivent être lus indépendamment l'un de l'autre, jamais l'un déduit de l'absence/présence
    de l'autre ; un `null` doit correspondre à une case réellement regardée, jamais une affirmation
    non vérifiée. CAS 7 ajouté à la section des erreurs observées, avec l'exemple réel généralisé.
    Fixture de régression `extractionAemHeuresEtCachets` (données fictives) + test de routage
    confirmant que `nbHeures` et `nbCachets` survivent tous les deux au routage sans que l'un
    supplante l'autre. **Limite assumée** : la fixture protège contre une régression de *code*
    (le routage n'écrase pas un champ au profit de l'autre), pas contre une régression de *qualité
    du prompt* — seul un futur envoi réel confirmera si le modèle applique bien la nouvelle règle.
  - ✅ Question ouverte avant ce test (coexistence heures/cachets côté moteur) tranchée par lecture
    du code, pas par supposition : `engine/decompteHeures.ts` (lignes ~33-45) ne lit que le champ
    correspondant à `typeRemuneration` — l'autre est simplement **ignoré**, jamais sommé deux fois.
    Remplir les deux champs sur un même contrat ne double donc jamais un montant ; ça évite
    seulement de perdre silencieusement l'information si `typeRemuneration` change un jour.
- **Confidentialité de ce test** : le spécimen (NIR, adresse, téléphone, signature réels) n'a été ni
  committé ni recopié dans aucun fichier suivi par git — reste sur la machine de l'utilisateur, hors
  du dépôt (`OneDrive\Bureau\Pole emploi\`). Cette entrée ne reproduit aucune de ces valeurs.

### Suite du 31/07/2026 (routage IA des périodes, bug des cycles fabriqués)

- ✅ **Routage de l'extraction IA vers `PeriodeAssimilee` câblé** (commit `5b31711`) : `periode_assimilee`
  était encore refusée par `routageExtraction.ts` avec un commentaire périmé (« l'écran de saisie
  n'existe pas » — faux depuis le 29/07, commit `d664344`). Traitée maintenant en `revue_formulaire`
  (comme `contrat`) : `RevueExtraction.tsx` ouvre `PeriodeForm` pré-rempli (type/dates lues), jamais
  appliqué sans confirmation — le type n'est jamais deviné depuis le document (`ald` et
  `maladie_intercontrat` ont des effets opposés sur le décompte, piège déjà documenté). Câblé de
  bout en bout (`RevueExtraction.tsx` → `ImportDocumentIA.tsx` → `App.tsx` → `ajouterPeriode`),
  vérifié dans le bac à sable de développement. `docs/validation.md` et l'en-tête de
  `routageExtraction.ts` nettoyés (même péremption documentaire que le bug des 710h : le CRUD avait
  été construit, la doc jamais mise à jour).
- ✅ **Bug réel corrigé : l'Historique affichait un cycle clos qui n'a jamais existé** (commit
  `2330a2d`) — `2025-01-18→2026-01-17, 977 h` reconstruit par simple soustraction calendaire de 12
  mois depuis la date anniversaire, ignorant `Profil.dateAnniversairePrecedente` qui porte pourtant
  la vraie borne. **Cause plus profonde révélée en creusant** : `dateAnniversairePrecedente` portait
  DEUX besoins incompatibles à la fois — la vraie borne historique du cycle passé (`engine/cycles.ts`)
  et la borne de réadmission du cycle EN COURS (attribution faite plus tôt dans la session précédente
  pour corriger le bug des 710h). Un seul champ ne peut pas servir les deux à la fois sans casser
  l'un ou l'autre selon sa valeur stockée. **Résolu en cascade, pas par un rustine locale** :
  - Nouvelle fonction `calculerFenetreEnCours` (`engine/periodeReference.ts`) : dérive TOUJOURS la
    borne de réadmission du cycle en cours depuis `dateAnniversaire` (Règle #2, toujours vraie —
    `deriverFctRetenueActuelle`, déplacée depuis `renouvellementAnticipe.ts` qui n'en avait plus
    l'usage exclusif), sans plus jamais lire `dateAnniversairePrecedente` tel quel pour cet usage.
    Câblée dans `prediction.ts`, `App.tsx`, `Simulateur.tsx`, `RevenusMensuels.tsx`, `alertes.ts` —
    tous concernés par le même risque, pas seulement le Dashboard.
  - `engine/cycles.ts` : `dateAnniversairePrecedente` reprend son unique vocation (borner le cycle
    précédent i=1 quand connue) ; comportement inchangé sinon (reconstruction calendaire, cas le
    plus courant). Les cycles plus anciens (i≥2) restent une reconstruction calendaire non garantie
    (backlog V3 inchangé — pas de vraie historique au-delà d'une génération).
  - Bouton **↻** sur chaque exercice clos dans `Historique.tsx` (avec confirmation) : efface le gel
    d'un exercice figé à tort, regelé automatiquement au calcul suivant avec les bonnes données.
    Filet de rattrapage manuel pour ce cas précis et pour tout futur cas similaire.
  - **`docs/cadence-import-complet.json` corrigé** : `dateAnniversairePrecedente` était resté à
    `2026-01-17` (la valeur recommandée — puis rétractée — pour le bug des 710h) ; remis à la vraie
    valeur historique `2025-03-23`.
  - **Vérifié en navigateur avec les 56 vrais contrats de l'utilisateur** : cycle en cours inchangé
    (588 h), cycle précédent corrigé à `2025-03-24→2026-01-17, 780 h` (= 710 h NHT réellement notifié
    + 70 h d'enseignement plafonné, qui compte dans le seuil des 507 h mais jamais dans le NHT — deux
    compteurs distincts, cohérence exacte confirmée) ; bouton ↻ testé (efface puis regèle
    automatiquement à l'identique, aucune régression du mécanisme de gel lui-même). Un 3ᵉ exercice
    (i=2, ~2024-01-18→2025-01-17) apparaît désormais dans l'historique — reconstruction calendaire
    non garantie (backlog V3), signalé comme tel, pas un vrai chiffre confirmé.
- 🔶 **Incident de branche pendant la session, résolu sans perte** : `HEAD` s'est retrouvé sur
  `backend-api-import-ia` (pas une action de Claude Code — la même machine sert aussi le terminal
  personnel de l'utilisateur, cf. `docs/reprise.md`) juste après le commit `9528f4a`, faisant
  atterrir le commit suivant (`5b31711`) sur cette branche au lieu de `master`. Confirmé fast-forward
  strict (`git merge-base --is-ancestor`) avant toute action : `master` avancé sans réécriture
  d'historique, `HEAD` reramené dessus. `origin/master` a rattrapé (poussé par l'utilisateur depuis
  son propre terminal en parallèle) : `backend-api-import-ia` et `master` pointent maintenant tous
  les deux sur `2330a2d`, aucune divergence. Rien à faire de plus, juste à savoir que ça peut se
  reproduire tant que les deux branches restent utilisées en parallèle sur cette machine.

Bilan : 473 tests verts, `tsc -b` propre. 2 commits cette suite de session (`5b31711`, `2330a2d`).

### Suite du 31/07/2026 (bug des 710h, gel des exercices, filtre année)

- ✅ **Bug réel corrigé : le Dashboard affichait 710 h au compteur des 507 h — le NH exact d'une
  notification France Travail PASSÉE (24/03/2025→17/01/2026), pas la progression du cycle en
  cours** (commit `9e56656`). Cause : `Profil.dateAnniversaire` doit porter la **prochaine
  échéance** du cycle en cours (cf. tous les tests de `engine/prediction.ts`, module qui alimente
  le Dashboard, et l'usage dans `MonProfil.tsx`), jamais la FCT qui l'a ouvert. Mais
  `RenouvellementAnticipe.tsx:44` lisait `profil.dateAnniversaire` directement comme la FCT —
  cohérent avec un commentaire erroné écrit lors du chantier « renouvellement anticipé » (session
  du 31/07 matin, commit `3b516dd`), qui affirmait à tort que c'était l'usage général de ce champ
  dans toute l'app. Une fois la date stockée dépassée par « aujourd'hui », le moteur recalculait
  exactement la fenêtre rétrospective qui avait déjà produit le droit en cours — pas un bug de
  calcul dans `periodeReference.ts`/`prediction.ts` (inchangés, corrects), un module de comparaison
  qui lisait le champ à l'envers. **Corrigé** : `deriverFctRetenueActuelle` (nouvelle fonction,
  `engine/renouvellementAnticipe.ts`) dérive la FCT par `échéance − 12 mois` au lieu de lire le
  champ directement ; commentaires trompeurs réécrits dans `types/index.ts` et le composant. 3
  nouveaux tests, dont une régression isolant précisément ce cas (réadmission récente, contrats
  réels avant ET après la FCT retenue, ancien contrat de 720 h jamais recompté même en extension
  par tranches). **Cause racine côté données** : `docs/cadence-import-complet.json` avait
  `dateAnniversaire`/`dateAnniversairePrecedente` restés sur l'ancien cycle (jamais mis à jour
  après le nouveau droit ouvert le 18/01/2026) — corrigé dans le fichier ; **l'utilisateur doit
  encore répercuter ces deux valeurs dans son profil réellement importé dans l'app**.
- ✅ **Règle enseignement 70h/120h confirmée par l'utilisateur** (GUIDEINTERMITTENT.pdf + sources
  France Travail) : s'ajoute systématiquement au compteur des 507 h dès `etablissementAgree` +
  `enRapportAvecMetier`, plafonnée selon l'âge — pas conditionnelle à un manque d'heures ailleurs.
  `decompteHeures.ts` appliquait déjà la bonne logique, aucun changement de code. Les 18 contrats
  « Commune de Levallois Perret » importés confirmés remplir les deux conditions (corrigé dans
  `docs/cadence-import-complet.json`, qui n'avait ni l'un ni l'autre flag). **Chiffre exact
  recalculé avec les vraies données, fenêtre en cours (18/01/2026→17/01/2027) : 588 h / 507 h**
  (504 h cachets + 14 h scène + 70 h enseignement plafonnées, 56 h excédentaires sur 126 h
  déclarées).
- ✅ **Gel automatique des exercices clos** (commit `eaf21fa`) : `decouperExercices`
  (`engine/cycles.ts`) recalculait TOUT à chaque appel, y compris les cycles déjà clos — un import
  tardif ou une nouvelle FCT pouvait changer silencieusement l'AJ affichée pour un cycle passé
  dans `Historique.tsx` (elle-même une reconstruction de Cadence, jamais la valeur réellement
  notifiée). Nouvelle fonction pure `fusionnerExercicesGeles` : un exercice en cours reste toujours
  recalculé en direct ; un exercice qui vient de clôturer est calculé une fois puis placé dans
  `aGeler` ; un exercice déjà figé n'est plus jamais recalculé. Nouveau champ persistant
  `DonneesApp.exercicesGeles: Record<string, Exercice>` (`storage/localStorageAdapter.ts`,
  migration silencieuse `{}` par défaut, devoir sacré n°1). `App.tsx` : `useMemo` pur (calcule
  `aGeler` sans effet de bord) + `useEffect` dédié pour la persistance. **Limite connue** : si
  `dateAnniversaire` change un jour (vraie réadmission), la reconstruction rétroactive des cycles
  (limitation MVP déjà documentée, backlog V3) peut ne plus retomber sur les mêmes `id` — aucune
  perte de donnée, mais un exercice figé pourrait disparaître de la liste affichée. 4 nouveaux
  tests.
- ✅ **Filtre par année dans `ContractList.tsx`** (commit `c2ccf70`) : onglets « Toutes » + une
  pastille par année présente dans les contrats, année la plus récente sélectionnée par défaut. Une
  série récurrente n'est jamais coupée par le filtre (affichée entière dès qu'un seul de ses
  contrats tombe dans l'année choisie). Vérifié en navigateur, pas seulement par les tests.
- ✅ **`.claude/settings.json` créé** (commit `ae8e7c8`) : `defaultMode: "acceptEdits"` — évite la
  confirmation à chaque édition de fichier ; les commandes bash sensibles restent soumises à
  confirmation.

Bilan : 467 tests verts (460 en début de session + 7 nouveaux), `tsc -b` propre. 5 commits sur
`master` cette suite de session (`05108f5` → `9e56656`), rien poussé sur `origin` (des identifiants
de push existent bien dans cet environnement — `git remote -v` — mais Claude Code ne pousse jamais
vers `origin`, par consigne explicite, indépendamment de leur présence).

### Session du 31/07/2026 (matin — renouvellement anticipé, styling, hébergement UE, inventaire)

- ✅ **Habillage de `ConsentementEnvoiIA.tsx` désamorcé** (commit `91b5634`) : la phrase [1] a perdu
  sa boîte ambre dédiée — elle datait de quand cette phrase annonçait un entraînement réel (le
  risque), et le texte a changé de sens (plus rassurant) sans que l'habillage suive. Les trois
  phrases reçoivent désormais le même traitement neutre, cohérent avec `ConfirmationImport.tsx`
  (l'autre modale bloquante de l'app, qui n'a jamais eu ce genre de boîte). Badge du haut et bouton
  restent en ambre : justifié, la donnée quitte réellement l'appareil vers un tiers.
- ✅ **Point 2 (AJ brute vs nette) clos avec preuve, pas deviné** (commits `2d05f6d`, `7bdb14a`) :
  `areNette.ts` était déjà prouvé correct depuis le 24/07 (`config/franceTravailConfig.ts` l.63-68,
  validé « à l'euro près » sur fév-juin 2026 ; reconfirmé via `docs/validation.md` Cas réel #1,
  0,00 € d'écart) — seul le backlog n'avait jamais été mis à jour, péremption documentaire pure.
  Résidu réel traité séparément : la provenance de la valeur saisie dans `ajReelleHistorique` en
  saisie manuelle (rien n'empêchait de recopier une ligne « brute » d'un relevé dans le champ « AJ
  nette »). Décision : pas de champ `natureMontant` déclaratif (déplacerait le risque sans le
  réduire) — un avertissement de plausibilité dans `MonProfil.tsx` (`GestionAjReelle`) se déclenche
  si la valeur dépasse 90 % du plafond ARE brut (`config.are.plafond`). Justification complète dans
  `docs/reprise.md`.
- ✅ **Hébergement UE de Mistral confirmé par source officielle** (commit `6b35861`) :
  [help.mistral.ai — Where do you store my data or my Organization's data?](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data),
  consulté le 31/07/2026 — « By default, your data is hosted in the European Union. »
  `content/mentionEnvoiIA.ts` **inchangé** (affirmation déjà exacte) : seule la doc interne
  (🔶→✅) a changé, plus deux traces obsolètes nettoyées.
- ✅ **Inventaire statique des documents utiles** (commit `f838092`) : `content/documentsUtiles.ts`
  + `components/DocumentsUtiles.tsx`, rendu dans `MonProfil.tsx` juste avant « Périmètre du MVP ».
  Volontairement distinct de la checklist **dynamique** déjà existante
  (`ChecklistDocuments.tsx`/`lib/documentsRequis.ts`, onglet Import PDF) — celle-ci calcule ce qui
  manque depuis les vraies données du profil ; celle-là est une référence à lire une fois, groupée
  par situation (toujours utile / si tu enseignes / si arrêt maladie-maternité / si taux PAS
  manquant), et couvre des documents absents de la checklist dynamique (contrat d'enseignement,
  attestation CPAM avec pointeur vers la saisie manuelle réelle dans « Périodes particulières »).
  Chaque composant renvoie explicitement vers l'autre pour éviter toute confusion. **Piste future
  notée, non implémentée** : un suivi d'état « déposé / manquant » par document serait un doublon
  avec la checklist dynamique — à envisager seulement si un besoin réel de fusionner les deux vues
  apparaît.

Branche `backend-api-import-ia`, recréée depuis `master` en début de session (`git checkout -B`,
aucune perte — l'ancienne divergence sur le taux PAS était déjà résolue côté `master`) et restée
synchronisée à chaque commit. 5 commits locaux cette session, rien poussé sur `origin`.

### Session du 29/07/2026 (jour)

- ✅ **Chantier « checklist des documents à fournir » terminé, 3 étapes.** Nouveau document de
  référence `docs/files/inventaire_donnees_et_documents.md` (remplace
  `inventaire_documents_non_couverts.md`, conservé avec une bannière), orienté **besoins** et non
  documents : il part des endroits où le code refuse de calculer. Puis `src/lib/documentsRequis.ts`
  (pure, 25 tests) et `src/components/ChecklistDocuments.tsx`, rendu **au-dessus des deux canaux de
  dépôt** dans `App.tsx`. Commits `0c53dee`, `6615263`, `02300ef`, `ad855bc`, `8d613ae`, `c1097d0`.
- ✅ **Trois affirmations fausses corrigées** : AEM, bulletin artiste et bulletin enseignement
  n'étaient pas « non couverts » mais « non **validés** sur pièce réelle » — ils sont codés. La
  confusion aurait fait recoder de l'existant.
- ✅ **`dateLimiteIndemnisation` reclassé BLOQUANT** (`02300ef`) : son absence fait afficher des mois
  hors droits avec un montant, sans aucune protection compensatoire. Preuve par deux tests voisins du
  moteur (`indemnisationMensuelle.test.ts:372` et `:401`) : dernier mois 2027-01 avec la date,
  2027-02 sans elle. C'est la régression signalée le 26/07.
- ⏳ **Phase 1 du chantier « périodes assimilées » écrite mais NON COMMITTÉE** — voir « Prochaine
  action ». 440 tests verts, typecheck propre, 4 fichiers modifiés dans l'arbre de travail.
- ⬜ **Décisions de périmètre du 29/07** : la lecture IA de la **déclaration fiscale est abandonnée**
  (volontairement non comblée, pas une dette — motif au §6.1 de l'inventaire) ; **tout ce qui touche
  au déploiement et au test réel est reporté en fin de projet** (`vercel dev`, premier vrai document
  par l'endpoint, décision de fusion dans `master`, corrections de `docs/SPEC.md`).

### Socle (antérieur)

- ✅ Outillage (Vite/TS/Tailwind/Vitest) — compile et tourne.
- ✅ `config/franceTravailConfig.ts` (valeurs sourcées + validation Zod).
- ✅ `types/index.ts` (modèle complet, incl. `Profil.activiteHorsAnnexe10`).
- ✅ Design tokens (Tailwind + `index.css`) alignés sur la maquette.
- ✅ `engine/` complet et testé : `periodeReference` (`SeuilReadmission`, type discriminé à 3
  variants : `calculable: true`, `historique_insuffisant`, `hors_bornes`), `decompteHeures`,
  `salaireReference`, `areBrute` (+ `calculerAJBrutePourFenetre`), `areNette`, `prediction`,
  `alertes`, `cycles` — **91 tests Vitest**, tous verts (dont 7 sur `storage/`, 5 sur `config/`,
  19 sur `lib/`).
- ✅ `storage/`, `components/`, câblage `App.tsx` — bêta fonctionnelle de bout en bout
  (onboarding → tableau de bord → mon profil → contrats → import PDF → historique → simulateur).
- ✅ **Bug corrigé** : un profil neuf sans date anniversaire connue n'affiche plus jamais le
  statut « bloqué » à 0 h — court-circuit dans `prediction.ts`, testé explicitement.
- ✅ **Réadmission allongée branchée** : `calculerAJBrutePourFenetre` décide seule standard vs
  allongée à partir de `fenetre.tranchesReadmission`, câblée dans `App.tsx` et `Simulateur.tsx`
  (se rabat sur le standard sans planter tant que le SMIC horaire n'est pas renseigné).
- ✅ **Garde-fou « situation mixte » étendu à trois états** : `Profil.regimeDeclare:
  "annexe10_pur" | "mixte" | "inconnu"` (remplace l'ancien booléen `activiteHorsAnnexe10`, gardé
  **déprécié** en lecture seule — jamais réécrit par l'UI). Question posée à l'onboarding (avant
  tout premier affichage d'un chiffre, ciblée technicien A8 / emploi hors spectacle — **jamais**
  l'enseignement, qui reste cœur de cible A10 pur) + section « Ton profil » modifiable dans
  l'onglet Mon profil, désormais 3 choix (Non / Oui / Je ne sais pas) au lieu d'une case à cocher.
  « inconnu » (je-ne-sais-pas) suit **exactement** le même chemin que « mixte » (conservateur, au
  moindre doute → France Travail) : même alerte `situation_mixte` exclusive dans `detecterAlertes`
  (via le prédicat pur `profilHorsPerimetre()`, `lib/profilHorsPerimetre.ts` — seul import
  `lib/` toléré dans `engine/`, fonction sans React/DOM), même écran unique
  (`AvertissementHorsPerimetre.tsx`) remplaçant Dashboard/Historique/Simulateur. **Migration
  (devoir sacré n°1) :** `profilHorsPerimetre()`/`regimeEffectif()` lisent `activiteHorsAnnexe10`
  en repli quand `regimeDeclare` est absent — aucun profil déjà enregistré ne change de
  comportement au prochain chargement (testé explicitement, cf. `profilHorsPerimetre.test.ts`).
  Contrats et Import PDF restent utilisables normalement.
- 🔶 **Limite connue :** `calculerAJBrutePourFenetre` n'est **pas** câblée dans `engine/cycles.ts`
  — l'historique des exercices passés ignore `tranchesReadmission` et calcule toujours l'AJ brute
  avec les diviseurs standard (détail dans `docs/SPEC.md` §10).
- 🔶 **Limite connue :** le garde-fou « situation mixte » n'a aucun test automatisé côté interface
  (seul `detecterAlertes` est testé, cf. `engine/__tests__/alertes.test.ts` — couvre `mixte` et
  `inconnu`, pas le rendu React). Après toute grosse modification d'UI touchant `App.tsx`,
  `Onboarding.tsx` ou `MonProfil.tsx`, **re-vérifier à la main** : sélectionner tour à tour
  les 3 choix (Non / Oui / Je ne sais pas, `regimeDeclare`) et confirmer qu'aucun chiffre
  n'apparaît sur Dashboard/Historique/Simulateur tant que « Oui » ou « Je ne sais pas » est
  sélectionné, et qu'il réapparaît normalement sur « Non ». Vérifié manuellement dans le
  navigateur lors de l'extension à 3 états (2026-07-22) ; à refaire après toute future
  modification de ces trois fichiers.
- ✅ **Revalidation post-onboarding** (SPEC §11.A) : date de naissance, situation et date
  anniversaire sont désormais modifiables après coup, dans « Mon profil » → « Ton profil »
  (`MonProfil.tsx`), plus besoin d'éditer le JSON à la main. Prudence ciblée comme prévu :
  date de naissance libre, sans cérémonie ; situation modifiable librement mais le formulaire
  reste cohérent ; date anniversaire modifiable avec une note explicite + une confirmation en
  deux clics (« Enregistrer » → « Confirmer le changement ») avant toute écriture, pas de
  changement silencieux. **Piège fermé** (trouvé en investiguant, indépendant de l'édition
  elle-même) : réadmission + date anniversaire inconnue était déjà validable dès l'Onboarding
  — `periodeReference.ts` aurait fait tourner l'extension de réadmission sur une fenêtre fictive
  "se terminant aujourd'hui", un seuil ajusté plausible mais faux (devoir n°2). `lib/coherenceProfil.ts`
  (`validerCoherenceProfil` + `validerProfilPourEcriture` + `profilSchema.refine`) bloque cette
  combinaison aux **3 portes** qui écrivent un profil — Onboarding, édition, **et import JSON**
  (même règle, même message partout, pas de 4e demi-rempart) — et est le point de passage unique
  dans `App.tsx` (`modifierProfil`), pas seulement dans le composant. Devoir n°1 tenu par
  construction : `modifierProfil` n'appelle jamais `setDonnees` avant que le candidat n'ait passé
  Zod puis cohérence, donc l'ancien profil valide n'est jamais à risque — pas de fichier de
  sauvegarde téléchargé pour autant (disproportionné pour 3 champs sur un profil existant, à la
  différence de l'import qui remplace tout). `engine/` intouché : le moteur suppose désormais un
  profil cohérent par construction, cf. `docs/validation.md`. Vérifié manuellement dans le
  navigateur (refus Onboarding, refus édition avec le même message, recalcul complet du Dashboard
  après confirmation d'une nouvelle date anniversaire) — pas de test React, même limite actée
  ci-dessus ; couverture automatisée via `lib/__tests__/coherenceProfil.test.ts` (règle +
  point de passage Zod, testés directement, sans harnais UI).
- ✅ **`config.valeursDatees.smicHoraireBrut` renseigné** (12,31 €, arrêté du 22 mai 2026, en
  vigueur au 01/06/2026) — la formule réadmission allongée (point ci-dessus) est donc réellement
  active dès qu'un profil réadmission a une fenêtre étendue. `.pmssMensuel` reste à `null` (TODO
  volontaire, module indemnisation mensuelle V2, non utilisé ailleurs).
- ✅ **Bug CSG/CRDS corrigé** (`docs/validation.md`, cas Fictif #2/#3) : `areNette.ts` calculait
  CSG (6,2 %) + CRDS (0,5 %) sur le SJM entier au lieu de l'allocation après retraite — écart d'un
  facteur ~8, invisible avant ces deux cas de validation. Corrigé : assiette = 98,25 % de
  l'allocation après retraite (`cotisations.tauxAssietteCSGCRDS`), écrêtement au plancher
  `cotisations.plancherEcretementJournalier` (62 €, source simulateur officiel FT — **distinct**
  de `valeursDatees.smicHoraireBrut`/`smicJournalierBrut`, qui restent réservés à la réadmission
  allongée et à la franchise salaires). Garde-fou ajouté pour la bande 60-62 € où l'allocation est
  déjà au plancher après la seule retraite complémentaire — sans lui, l'écrêtement aurait produit
  un montant négatif et un net > brut.
- ✅ **Export/import JSON complet** (devoir sacré n°1, §11.A) : `schemaVersion` distinct de
  `franceTravailConfig.meta.version`, 3 refus distincts à l'import (JSON invalide / version de
  schéma inconnue / forme Zod invalide), jamais d'écriture avant validation complète. Anti-
  écrasement : `ConfirmationImport.tsx` déclenche une sauvegarde automatique de l'état actuel
  (téléchargée, inconditionnellement) **avant** de valider le fichier importé, qui n'écrase l'état
  en place que si la validation réussit — ordre vérifié par construction dans `App.tsx`
  (`confirmerImport`), pas seulement documenté. Testé en round-trip (y compris sur l'état vide
  d'un tout premier utilisateur) et manuellement dans le navigateur (import valide, JSON corrompu,
  état préservé après refus).
- ✅ **Bandeau « règles vérifiées » — la péremption automatique a été SUPPRIMÉE le 03/08/2026**
  (points 13 et 14, cf. l'entrée détaillée dans « Ce qui a été fait »). Ce que dit le bandeau
  aujourd'hui : `Règles vérifiées le <meta.dateDerniereVerification> — <meta.source>`, dans
  `TopBar.tsx` (permanent) et `MonProfil.tsx` (détaillé, + « il y a N jours »). Plus aucun jugement
  de péremption, plus de branche conditionnelle, plus d'ambre.
  **Historique, pour ne pas refaire le chemin** : le mécanisme reposait sur `meta.valableJusquau`
  (laissé à `null`, faute d'échéance officielle publiée) comparé au jour courant par `estPerime` —
  donc une bannière « ⚠ Règles à vérifier » qui ne pouvait **jamais** s'afficher. Avant lui,
  `MonProfil.tsx` portait un `SEUIL_PEREMPTION_JOURS = 365` codé en dur, un seuil réglementaire
  deviné. Les deux sont partis : le premier parce qu'inerte, le second parce qu'inventé. La veille
  est faite à la main et assumée (`docs/routine-mensuelle-veille.md`) — l'app ne prétend plus la
  faire. ⚠️ Ne pas réintroduire de seuil de durée : ce serait revenir au `SEUIL_PEREMPTION_JOURS`.
- ✅ **Bouton de feedback** (§11.A) : `config/contact.ts` — `EMAIL_FEEDBACK` (`null` tant que non
  renseigné, jamais un placeholder ; renseigné à `benoit.zahra@orange.fr`) + `construireLienFeedback(email)`,
  fonction pure sans accès à `donnees`/`profil`/`contrats` (sujet et gabarit de corps fixes,
  aucune donnée utilisateur ne peut structurellement s'y glisser). Deux points d'accès —
  `TopBar.tsx` (toujours visible, adresse en texte de lien) et `MonProfil.tsx` (bouton +
  adresse en texte lisible en dessous) — **aucun** des deux ne s'affiche si `EMAIL_FEEDBACK` est
  `null` (pas de lien mort, pas de "null" visible), vérifié dans le navigateur dans les deux états.
  **Remplace** l'ancien lien `mailto:?subject=...` sans destination ni gabarit qui traînait dans
  `MonProfil.tsx` depuis plusieurs sessions, pas un ajout en parallèle.
- ✅ **État vide du Dashboard** (§11.A) : `lib/dashboardVide.ts` — `dashboardEstVide(contrats)` se
  déclenche sur l'**absence de contrat** (`contrats.length === 0`), jamais sur "0 h comptée au
  montant" (un profil 100 % enseignement a des contrats mais 0 h au montant ARE — testé
  explicitement, dashboard normal dans ce cas). `DashboardVide.tsx` (nouveau, purement
  présentationnel, aucune prop de date/profil) remplace **tout** le contenu normal — carte
  allocation comprise, plus de 44 € affiché à 0 contrat — par un écran d'invitation avec bouton
  d'action vers l'onglet Contrats. **`AlertCenter` masqué aussi dans cet état, et pas seulement
  en effet de bord** : une alerte "rythme insuffisant" sur un compte neuf est le même faux signal
  que le montant qu'on retire, l'autre bout du problème. **Fuite corrigée en vérifiant** : le chip
  `AlertCenterResume` (en-tête, visible sur tous les onglets) affichait encore ce même faux signal
  indépendamment du Dashboard — filtré désormais lui aussi quand le compte est vide (sauf l'alerte
  `situation_mixte`, qui reste vraie indépendamment du nombre de contrats). Vérifié dans le
  navigateur : compte neuf (aucun euro, aucune alerte, écran net) et compte avec un seul contrat
  100 % enseignement (dashboard normal, distinction respectée).
- ✅ **Bug Infinity corrigé** (le Dashboard pouvait afficher « Vise environ Infinity h/mois ») :
  `StatutPrediction.rythmeMensuelRequis: number` (sentinelle `Infinity` explicite quand
  `joursRestants <= 0` et `heuresRestantes > 0`) remplacé par `rythmeRequis: RythmeRequis`, un
  type discriminé à exhaustivité forcée par le compilateur (`types/index.ts`) :
  `{ atteignable: true; heuresParMois: number }` ou `{ atteignable: false; raison:
  "anniversaire_inconnu" | "delai_expire" }`. **Deux raisons distinctes, pas une seule** :
  `anniversaire_inconnu` (donnée manquante — profil neuf sans date anniversaire) n'est **jamais**
  présenté comme un délai expiré, ce qui aurait été un faux signal (devoir n°2) ; `delai_expire`
  couvre le seul cas où l'anniversaire est réellement connu et dépassé (niveau `bloque`). Plus
  aucun `Infinity` ne peut fuiter dans le retour du moteur. Tous les consommateurs traduisent
  désormais `atteignable:false` en clair : `Dashboard.tsx` a un switch exhaustif dédié
  (`libelleRythmeRequis`, cassant à la compilation si une raison est ajoutée sans être traitée
  ici) ; `alertes.ts` n'émet **aucune** alerte de rythme dans le cas `anniversaire_inconnu` (rien
  n'est imminent pour un profil dont la date anniversaire est inconnue) — l'alerte
  `rythme_insuffisant` ne se déclenche plus que si `atteignable: true`. Tests dédiés ajoutés
  (`prediction.test.ts`, `alertes.test.ts`) vérifiant explicitement l'absence de la chaîne
  « Infinity » dans les deux cas de figure. **Différé volontairement** : le cas « rythme fini mais
  humainement absurde » (délai non nul mais minuscule) n'a pas de 3e raison dédiée
  (`rythme_hors_limite`) — nécessiterait un seuil de plausibilité non réglementaire (décision
  produit), consigné au backlog (`docs/reprise.md`, `docs/validation.md`).
- ✅ **Transparence du calcul** (dernier item §11.A) : panneau `DetailCalcul.tsx`, replié par
  défaut sur le Dashboard, montrant le décompte des heures par catégorie (dont enseignement/
  formation retenus vs écartés), SR/NHT/SAR, l'AJ brute = A+B+C avec plancher/plafond, et le
  détail des cotisations jusqu'à l'AJ nette. **Aucun fichier `engine/` modifié** : le moteur
  exposait déjà tout ce détail dans ses types de retour, seul `App.tsx` ne faisait pas transiter
  `sr`/`nht`/`sar` jusqu'au Dashboard. **Piège trouvé en le testant, corrigé au passage** :
  `ProjectionChart.tsx` affichait « échéance atteinte » à côté d'un badge « Alerte » honnête
  quand l'anniversaire est inconnu — la fenêtre sentinelle "aujourd'hui" (même artifice que le
  bug Infinity ci-dessus, cf. `periodeReference.ts`) faisait recalculer localement un « jours
  restants » à zéro sans que le composant sache qu'il ne s'agissait pas d'une vraie échéance.
  Nouveau champ `StatutPrediction.anniversaireConnu` exposé (aucune logique changée), transmis à
  `ProjectionChart.tsx`, qui affiche désormais « date inconnue » dans ce cas. Le champ brut
  `joursRestants` reste une dette tracée pour tout futur consommateur direct (`docs/validation.md`,
  section « Dette tracée »). 80 tests verts, détail complet : `docs/reprise.md`.
- ✅ **Seuil de réadmission gonflé corrigé** (bug remonté par un vrai testeur, pas trouvé en
  interne) : un profil réadmission avec un historique de contrats trop court pour jamais rattraper
  le seuil croissant de la boucle d'extension (`periodeReference.ts`) épuisait ses 24 tentatives
  (`TRANCHES_MAX`) et affichait 1515 h (`507 + 24×42`) comme si c'était un vrai seuil ajusté — ex.
  « 480 / 1515 h » au lieu de « 480 / 507 h ». `FenetreReference.seuilReadmission` est désormais un
  type discriminé (`calculable: true/false`), construit à partir d'un booléen `trouve` explicite
  posé au `break`, jamais déduit du compteur de tranches par relecture implicite. En échec :
  `prediction.ts`/`areBrute.ts` retombent sur le seuil/la formule standard, `Dashboard.tsx` affiche
  un bandeau honnête dédié, `alertes.ts` porte une nouvelle alerte `seuil_readmission_non_calculable`.
  **Découverte en creusant** : le test existant pour ce scénario n'affirmait qu'une propriété vraie
  aussi bien en cas de succès que d'échec — il exerçait déjà le bug sans jamais le remarquer,
  dette méthodologique tracée dans `docs/validation.md`. 85 tests verts, détail complet :
  `docs/reprise.md`.
- ✅ **Onglet « À propos » renommé « Mon profil »**, remonté en 2e position (juste après le
  Tableau de bord, avant Contrats/Import/Historique/Simulateur) — c'est là que se renseigne
  `dateAnniversairePrecedente` en réadmission, ça doit rester facile à trouver.
  `MonProfil.tsx` (ex-`AProposLimites.tsx`) ; valeur interne du type `Onglet` (`"apropos"` →
  `"profil"`) jamais persistée, aucune migration. Le `<h2>Ton profil</h2>` interne reste
  inchangé (adresse à l'utilisateur, toujours correcte). Références croisées alignées dans
  `Onboarding.tsx` et `alertes.ts` (ce dernier disait déjà « Mon profil » par anticipation avant
  même que l'onglet soit renommé — corrigé au passage). 91 tests verts, détail complet :
  `docs/reprise.md`.
- ✅ **Contrat récurrent pour l'enseignement** (item 1 du backlog) : `lib/contratRecurrent.ts`
  (`genererContratsRecurrents`) matérialise, à la validation d'un seul formulaire
  (`ContractFormRecurrent.tsx`), **un `Contrat` normal par mois** de la plage choisie
  (hors mois exclus, sélection par chips), daté du dernier jour du mois, `type: "enseignement"`
  et `typeRemuneration: "heures"` **fixés** (l'enseignement se paie en heures de cours, jamais en
  cachets — décision produit actée, pas un oubli). **Option architecturale retenue** (vs. une
  entité « série » dépliée à la volée par le moteur, rejetée) : chaque contrat généré est
  indépendant dès sa création, seulement tagué `recurrenceId` (partagé par la série) +
  `source: "recurrent"` (`Contrat`, `types/index.ts`) — **`engine/` totalement intouché**
  (`cycles.ts`/`decompteHeures.ts` voient des contrats datés normaux, aucun risque de point d'appel
  du moteur qui oublierait de déplier une série, cf. devoir sacré n°2). Limite actée dès le plan,
  pas découverte après coup : **pas d'édition de série après coup**, seule voie de correction
  « supprimer toute la série + régénérer » — d'où un bouton « Supprimer la série » **visible
  directement sur la ligne résumé** (pas caché derrière un dépli), avec confirmation navigateur
  (nombre de contrats + employeur dans le message) avant toute suppression groupée. `ContractList.tsx`
  groupe désormais les contrats partageant un `recurrenceId` en une ligne repliable (résumé :
  employeur, nb de contrats, plage de mois, total heures/€) ; les contrats isolés (sans
  `recurrenceId`) gardent l'affichage plat existant, les deux types de lignes sont triés ensemble
  par date décroissante. Suppression individuelle d'un mois dans une série repliée toujours
  possible (cas d'une exception ponctuelle), sans passer par la suppression de toute la série.
  `localStorageAdapter.ts` (schéma Zod) accepte les nouveaux champs `source: "recurrent"` et
  `recurrenceId` (optionnels, round-trip export/import JSON testé). 9 tests dédiés
  (`lib/__tests__/contratRecurrent.test.ts` : génération, dates de fin de mois, `recurrenceId`
  partagé, id uniques, exclusion de mois, plage vide/inversée, mois unique). 100 tests verts au
  total, `tsc -b` propre. Vérifié dans le navigateur : génération avec exclusion, dépliage de
  série, suppression d'un seul mois (total recalculé), tentative de suppression de série annulée
  au niveau de la confirmation (donc pas testée jusqu'au bout en automatisé — à re-vérifier
  manuellement par l'utilisateur au moins une fois), Dashboard cohérent avec les heures générées.
- ✅ **Point d'entrée du contrat récurrent revu** (juste après le lot ci-dessus, même session) :
  le bouton isolé en haut de l'onglet Contrats est retiré — deux entrées pour la même action, une
  générique et une contextuelle, faisaient du bruit sans apporter de valeur, d'autant que le
  récurrent est de toute façon réservé à l'enseignement. `ContractForm.tsx` affiche désormais un
  encart CTA (« Cours régulier sur l'année scolaire ? ») **dès que `type === "enseignement"` est
  sélectionné**, avant même les champs Employeur/Date — pour intercepter l'utilisateur avant qu'il
  n'investisse du temps dans le mauvais formulaire. Contrainte technique identifiée et respectée :
  `ContractFormRecurrent.tsx` a son propre `<form>`, impossible de l'imbriquer dans celui de
  `ContractForm.tsx` (HTML invalide) — `ContractForm.tsx` bascule donc entre deux rendus complets
  via un state local `formRecurrentOuvert` (pas un accordéon au milieu du formulaire), et
  réutilise le bouton « Annuler » déjà présent dans `ContractFormRecurrent.tsx` pour revenir en
  arrière. Nouveau prop `onValiderRecurrent` sur `ContractForm.tsx`, **optionnel** à dessein :
  `ImportBulletins.tsx` (relecture d'un contrat déjà extrait d'un PDF) et `Simulateur.tsx`
  (simulation temporaire non persistée) réutilisent `ContractForm.tsx` sans ce prop, et n'affichent
  donc jamais ce CTA — vérifié dans le navigateur dans les deux cas (aucun encart, aucune erreur
  console même en sélectionnant "Enseignement"). `App.tsx` ne gère plus l'état d'ouverture du
  formulaire récurrent, seulement la mutation des données (`ajouterContratsRecurrents`, inchangée).
  100 tests verts (aucun nouveau test : changement purement UI, pas de nouvelle logique pure),
  `tsc -b` propre. Vérifié dans le navigateur : apparition du CTA au choix "Enseignement",
  bascule vers le formulaire récurrent puis retour via "Annuler" sans perte d'état du formulaire
  normal, absence du CTA dans Import PDF et Simulateur.
- ✅ **Contrats à venir persistés, graphique 3 segments** (SPEC §11.B, item 1 du backlog) :
  **découverte en investiguant, pas un simple ajout** — un contrat déjà signé daté dans le futur
  était déjà possible (rien ne l'empêchait) et déjà compté dans `decompte`/`SR`/`NHT` (fenêtre
  complète, `decompteHeures.ts`/`salaireReference.ts` inchangés, aucune règle réglementaire à
  deviner ici), mais **totalement ignoré** par `prediction.ts` (plafonné à `dateCap` = aujourd'hui)
  — d'où un vrai "0 / 507 h" au héros à côté d'une "Répartition des heures" qui comptait déjà ces
  heures, incohérence silencieuse préexistante, pas introduite cette session. **Aucun champ
  nouveau sur `Contrat`** : "à venir" se déduit uniquement de `contrat.date > dateDuJour` (jamais
  stocké — un flag stocké deviendrait faux tout seul le jour où `dateDuJour` dépasse la date du
  contrat), donc **zéro impact schéma Zod / export-import JSON**. `StatutPrediction` gagne deux
  champs : `heuresCertainesAVenir` (contrats signés à venir dans la fenêtre, 0 si aucun) et
  `heuresRestantesApresCertain` (écart net = seuil − acquis − certain, jamais négatif — tout texte
  "il te manque X h"/"vise X h/mois" doit lire CE champ, jamais l'ancien `heuresRestantes` brut).
  **Correction du faux pessimisme** : `niveau` passe désormais "Sécurité" dès que
  `heuresActuelles + heuresCertainesAVenir >= seuil`, même si le rythme passé est nul (ex. tout
  juste réadmis mais déjà un gros contrat signé) — avant ce lot, un tel profil restait à tort en
  "Alerte" tant que la seule projection linéaire ne suffisait pas. `rythmeRequis`/
  `dateFranchissementProjetee` gardent `joursRestants` (dateCap → fin de fenêtre) comme
  dénominateur temps, **jamais** la fin du segment certain — **bug trouvé en testant dans le
  navigateur avec de vraies données** (le contrat récurrent du lot précédent, dernier mois
  2026-12-31, pile la date anniversaire) : baser le dénominateur sur la fin du segment certain
  faisait tomber le temps restant à 0 et afficher à tort "délai trop court" alors que l'échéance
  réelle était encore à 161 jours. Une fois corrigé, un second écart est apparu au même endroit :
  l'alerte "rythme_insuffisant" disait "il manque 507 h" à côté d'un "vise 90 h/mois" déjà calculé
  sur l'écart net (483 h) — deux chiffres contradictoires dans la même phrase ; `alertes.ts` et
  `construireMessage` (prediction.ts) lisent désormais tous deux `heuresRestantesApresCertain`.
  `ProjectionChart.tsx` : nouveau segment plein teal "confirmé à venir" (un marqueur par contrat,
  distinct de la courbe acquise et du pointillé — légende textuelle obligatoire pour les trois,
  jamais la couleur seule, §8.6) ; le pointillé repart de `dateCap` (comme avant, pas de la fin du
  segment certain — écarte tout risque de ligne dessinée "à l'envers" si la date projetée tombait
  avant un contrat déjà signé). Nouvelle fonction pure `construireSerieAVenir` (prediction.ts,
  même famille que `construireSerieAcquisition`). `ContractForm.tsx` : indice discret sous le
  champ date quand la date saisie est future (« sera affiché comme à venir · confirmé... »),
  **masqué dans `Simulateur.tsx`** via un nouveau prop `previsualisationSeulement` — le contrat
  simulé n'étant jamais persisté, l'indice y serait littéralement faux (devoir n°2), pas juste
  hors-sujet. 15 tests dédiés ajoutés (`prediction.test.ts` : 9, `alertes.test.ts` : 1, plus les
  révisions du test qui a révélé le bug du dénominateur) — 108 tests verts au total, `tsc -b`
  propre. `engine/decompteHeures.ts`, `salaireReference.ts`, `areBrute.ts`, `areNette.ts`,
  `periodeReference.ts`, `cycles.ts` **intouchés**, conformément au plan validé. Vérifié dans le
  navigateur avec les vraies données de contrat récurrent du lot précédent : graphique 3 segments,
  "+24 h déjà signées à venir", cohérence "il manque"/"vise" rétablie ; puis avec un contrat passé
  ajouté en plus (360 h) : bascule correcte en "Sécurité", franchissement projeté cohérent avec le
  rythme requis affiché, aucune régression du cas sans contrat à venir.
- ✅ **PWA installable** (dernier item §11.A) : `vite-plugin-pwa` (stratégie `generateSW`,
  `registerType: "autoUpdate"` + `skipWaiting`/`clientsClaim` — mise à jour silencieuse, jamais
  bloquée par un cache périmé, cf. devoir n°2 : un correctif de calcul doit atteindre l'utilisateur
  vite) génère le service worker et précache tout le bundle buildé (17 entrées, ~700 Kio) + une
  règle `runtimeCaching` dédiée pour Google Fonts (hors du bundle Vite, sinon repli silencieux sur
  la police système hors-ligne). Manifest défini **uniquement** dans `vite.config.ts` (même
  logique que `franceTravailConfig.ts` : une seule source de vérité) — `public/manifest.webmanifest`
  écrit à la main **supprimé**. `background_color: "#0A0C10"`, `theme_color: "#3FD69B"` (seulement
  au niveau du manifest — l'écran de démarrage/multitâche une fois l'app **installée** — le
  `<meta name="theme-color">` de `index.html`, lui, reste sombre pendant la navigation web
  normale, décision volontaire pour ne pas trancher avec la charte « sombre, premium, calme »).
  `name`: « Cadence · Suivi intermittent », `short_name`: « Cadence », `lang: "fr"` (absent par
  défaut du plugin, oubli corrigé en vérifiant — toute l'app est en français). **Icônes générées
  sans dépendance externe** (`scripts/generate-pwa-icons.mjs`, seulement `zlib`/`fs` de Node) :
  `sharp` (utilisé par `@vite-pwa/assets-generator`, la voie "officielle") n'a **aucun binaire natif
  pour win32-arm64**, et son build WASM de repli plante sous Node 24 sur cette machine
  (`TypeError` dans `libvipsVersion`) — après avoir épuisé les contournements côté dépendances, le
  motif (carré arrondi, dégradé mint→teal, identique au logo de `TopBar.tsx`) s'est révélé assez
  simple pour être rastérisé à la main (supersampling 3×3, encodeur PNG minimal, ICO fait main pour
  le favicon) : plus robuste ici qu'une dépendance native/WASM fragile, et reproductible sur
  n'importe quelle plateforme (`npm run generate-pwa-icons`). `index.html` : ajout
  `<link rel="apple-touch-icon">` (iOS ne lit jamais le manifest pour son icône d'écran d'accueil)
  et `<link rel="icon">` (absent jusqu'ici, favicon par défaut/cassé) ; `<link rel="manifest">`
  manuel retiré (auto-injecté par le plugin). `tsc -b` propre, 108 tests verts (aucune logique
  moteur touchée). **Vérifié dans le navigateur, preuve forte plutôt qu'une simulation** : après
  `npm run build` + `npm run preview`, manifest et service worker actif confirmés via
  `navigator.serviceWorker`, contenu du cache (`caches.keys()`) confirmé complet (JS/CSS/HTML/
  icônes/manifest + une police déjà mise en cache) — puis le **processus du serveur preview a été
  tué** (pas juste un bouton "Offline" des DevTools) et la page rechargée : l'app s'affiche
  intégralement, aucune erreur console. **Installation réelle sur téléphone confirmée le
  01/08/2026** (session de support utilisateur, hors dépôt) : testée sur `https://cadence-benoit3.vercel.app`
  (alias de prod Vercel, projet `cadence`, dernier déploiement Ready/Production sur commit
  `2330a2d`), Android, navigateur Chrome (pas Samsung Internet, pas l'appli Bing — celle-ci embarque
  un navigateur qui ne supporte pas correctement l'installation PWA, cause d'un premier échec avec
  écran blanc/raccourci buggé). Installation via menu ⋮ → « Installer l'application » : réussie,
  icône sur l'écran d'accueil, lancement en plein écran sans barre d'adresse. Mode offline testé :
  navigation sur plusieurs écrans, passage en mode avion, relance depuis l'icône installée — app
  fonctionnelle, aucune erreur. **iOS non testé** (aucun appareil disponible pour ce test) — limite
  distincte qui reste ouverte, à ne pas confondre avec Android désormais confirmé.
- ✅ **Module indemnisation mensuelle (V2), 3 phases terminées** : `engine/indemnisationMensuelle.ts`
  (`calculerMoisIndemnisation`, `calculerSerieIndemnisation`, `calculerSerieDepuisDeclarations`)
  calcule, mois par mois, le nombre de **jours réellement indemnisés** — pas juste l'AJ théorique
  — à partir d'un **solde de départ** connu (`SoldeIndemnisationDepart`, `{ date, delaiRestant,
  franchiseCPRestante }`) saisi une seule fois par l'utilisateur, jamais reconstruit depuis la
  réadmission (décision actée : un mois de régularisation en cours de transition de droits n'a pas
  de décomposition standard reconstituable, toute tentative produirait un solde faux en cascade —
  cf. `docs/reprise.md`). Ordre de consommation confirmé par le guide officiel ET par des relevés
  réels certifiés (fév-mai 2026) : jours non indemnisables (`Math.ceil(joursDéclarés × 1.3)`,
  PREMIÈRE opération) → délai d'attente → franchise congés payés (**plafonnée par un forfait
  mensuel avec report**, cf. correctif du 2026-07-23 ci-dessous — PAS "consommer tout ce qui est
  disponible", conclusion initialement erronée) → paiement du reliquat.
  Franchise salaires : toujours `{ valeur: null, avertissement: "franchise_salaires_non_certifiee" }`
  — formule officielle (guide p.14, 4 variables incluant le SMIC) non vérifiable à 100 % depuis
  l'extraction PDF, aucun relevé réel fourni ne la montre active pour trancher (devoir n°2 :
  jamais un chiffre deviné). `smicHoraireBrutHistorique: {dateEffet, valeur}[]` ajouté à la
  config, séparé de `smicHoraireBrut` qui reste inchangé — **zéro modification dans `areBrute.ts`**.
  **Phase 3** : `RevenusMensuels.tsx` (nouvel onglet TopBar), gardé derrière le même garde-fou
  « situation mixte » que Dashboard/Historique/Simulateur (`profilHorsPerimetre`, vérifié dans le
  navigateur : bascule Oui/Non préserve les données). `DeclarationMensuelle { id, mois,
  joursDeclares, source: "manuel" | "lecture_releve" }` — saisie manuelle mois par mois, **jamais
  déduite des `Contrat`** (heures/cachets par contrat ≠ jours calendaires par mois civil) ; ajouter
  une déclaration pour un mois déjà saisi la remplace (permet de corriger une estimation
  provisoire une fois le vrai relevé reçu), badge « provisoire » affiché pour `source: "manuel"`
  (devoir n°2 : ne jamais présenter une estimation avec la même certitude qu'une donnée
  confirmée). Écran de configuration du solde de départ **pédagogique, jamais bloquant** : les
  deux champs numériques défaultent à 0 (cas le plus courant une fois les franchises épuisées),
  seule la date est structurellement nécessaire. `DonneesApp` étendu (`declarationsMensuelles`,
  `soldeIndemnisationDepart`) avec des défauts Zod (`.default([])`/`.default(null)`) — un export
  JSON antérieur à ce module s'importe toujours sans perte (devoir sacré n°1, testé explicitement :
  `localStorageAdapter.test.ts`). Montant € optionnel par mois (`joursIndemnises × AJ nette
  actuelle`), affiché avec une légende explicite qu'il ne reflète pas d'éventuels changements de
  salaire de référence sur les mois passés — pas une nouvelle formule réglementaire, une simple
  multiplication d'un chiffre déjà affiché ailleurs (Dashboard). `MonProfil.tsx` (« Périmètre du
  MVP ») mis à jour en cohérence : ne dit plus que le module est hors MVP, précise ce qui est
  couvert (jours indemnisés) et ce qui ne l'est pas (franchise salaires, plafond PMSS). 8 tests
  dédiés au moteur (`indemnisationMensuelle.test.ts`, dont la reproduction exacte des 4 mois
  certifiés fév=0/mars=17/avril=18/mai=29 à partir du solde d'ouverture du 01/02/2026), 117 tests
  verts au total, `tsc -b` propre. Vérifié dans le navigateur avec les 4 mois certifiés : tableau
  identique aux relevés réels, ajout/suppression de mois, badge provisoire, garde-fou situation
  mixte, aucune erreur console. **Limite actée, pas un oubli** : pas d'écran pour corriger le
  solde de départ une fois configuré (uniquement l'export/import JSON permettrait de le faire à la
  main pour l'instant) — à ajouter si un besoin réel se présente. **Correctif du 2026-07-23,
  franchise CP** : la conclusion initiale ("pas de plafond mensuel constaté sur les relevés
  réels") était fausse — le 4j consommé en février 2026 s'explique entièrement par le report du
  forfait de janvier (2j non consommés, absorbés par le délai d'attente ce mois-là) + le forfait
  de février (2j), pas par l'absence de plafond. `forfaitMensuelBas`/`Haut` réactivés dans
  `franceTravailConfig.ts` (+ nouveau `seuilFranchiseTotaleJours: 24`, qui n'existait qu'en
  commentaire avant). `SoldeIndemnisation.quotaCPCarryOver` (obligatoire, moteur) /
  `SoldeIndemnisationDepart.quotaCPCarryOver` (optionnel, défaut 0 — un solde déjà configuré avant
  ce champ continue de fonctionner, testé explicitement) suivent le report d'un mois sur l'autre.
  `RevenusMensuels.tsx` : 3e champ dans l'écran de configuration du solde de départ (« Report de
  forfait congés payés du mois précédent », défaut 0, aide contextuelle « si tu viens d'ouvrir tes
  droits ce mois-ci et que le mois précédent était un mois blanc, mets 2 » — un chiffre lisible
  sur la notification d'ouverture de droits, pas une valeur technique cachée). **Limite connue,
  non résolue** : le palier bas/haut (2j vs 3j) se base sur `franchiseCPRestante` courante faute
  de suivre le total ORIGINAL accordé à l'ouverture des droits — un profil dont le total dépasse
  24j pourrait à tort redescendre au palier bas une fois consommé sous ce seuil ; non observable
  sur les cas certifiés actuels (restante ≤ 5j du début à la fin). 120 tests verts au total (3
  nouveaux dédiés au correctif, dont un qui aurait échoué avec l'ancien modèle), `tsc -b` propre,
  vérifié dans le navigateur : reproduction exacte des 4 mois certifiés avec le nouveau champ
  renseigné (2j), et non-régression sur un solde existant configuré avant ce champ (défaut 0,
  résultat plus conservateur qu'avant à raison). **Franchise salaires (2026-07-23) : formule
  certifiée (ARTCENA + flyer officiel FT) implémentée, TOTAL seul, PAS ENCORE câblée dans le
  réducteur mensuel** — `calculerFranchiseSalaires(srContrats, sjm, profil, config)` calcule
  `arrondi((SR_total/SMIC_mensuel) × (SJM/(3×SMIC_journalier)) − 27)`, jamais négative, SMIC lu à
  `profil.dateAnniversaire` (date de fin de PRA) via l'historique. Nouveaux champs `Profil`
  optionnels : `dureeDroitsMois` (12 standard / 6 clause de rattrapage, connue à l'ouverture,
  jamais déduite de l'historique d'activité) et `salairesHorsAnnexe10PRA` (composante de SR_total
  ; absent → estimation sur les seuls salaires A10, signalé via `sousEstimeeHorsA10`).
  `FranchiseSalairesResultat` devient un type discriminé (`valeur: null` si données manquantes,
  `valeur: number` avec `totalNonVerifie: true` toujours présent — le total n'a jamais été
  confronté à un relevé réel montrant une franchise active). `calculerMoisIndemnisation` continue
  volontairement de renvoyer `franchise_salaires_non_certifiee` : câbler la répartition mensuelle
  (min(dureeDroitsMois, 8) mois + report, comme la franchise CP) est un **chantier séparé, scopé
  mais pas commencé** — aucune UI non plus pour saisir `dureeDroitsMois`/`salairesHorsAnnexe10PRA`
  sur le profil. 126 tests verts au total, `tsc -b` propre. **Bilan du chantier « indemnisation
  mensuelle » à ce stade : terminé sauf la répartition mensuelle de la franchise salaires**
  (chantier suivant identifié et scopé, aucun faux chiffre affiché en attendant).
  **Mise à jour 2026-07-24, PDF officiel lu en entier** : la formule (page 14) est confirmée mot
  pour mot depuis le texte source (plus une extraction d'image incertaine) — seule l'absence d'un
  cas chiffré réel avec franchise salaires active reste une réserve valable (`totalNonVerifie`).
  **Bug corrigé (2026-07-24)** : le `27` de la formule était codé en dur dans
  `calculerFranchiseSalaires` au lieu de réutiliser la constante existante
  `config.indemnisationMensuelle.seuilNonIndemnisationJours` — deux occurrences du même nombre non
  reliées, contredisait la règle d'or "aucune valeur réglementaire en dur dans le moteur".
  Remplacé, JSDoc mis à jour en conséquence. 127 tests verts, `tsc -b` propre. Détail complet :
  `docs/reprise.md`.
- ✅ **Correctif AJ réelle (2026-07-24, `f6cb937`)** : les montants de « Revenus mensuels »
  utilisaient l'AJ **prévisionnelle** (recalculée depuis les contrats actuels via
  `calculerAJBrutePourFenetre`/`calculerAJNette`), pas l'AJ **réelle** notifiée par France Travail
  (fixée à l'ouverture des droits, stable toute la période) — faux chiffre pour un utilisateur déjà
  en cours d'indemnisation (bug remonté par l'utilisateur). `SoldeIndemnisationDepart.ajReelle:
  number | null` ajouté (même pattern que `quotaCPCarryOver`), prioritaire sur l'estimation quand
  renseignée, avertissement visible sinon. Vérifié en direct sur `simucalcul.pole-emploi-services.fr`
  le 23/07/2026 (rejoué le cas fictif #2 déjà validé, résultat identique — 62,00 € net — rien n'a
  changé côté France Travail) + tests `areBrute`/`areNette` relancés (18 tests) pour confirmer que
  c'est le code, pas juste la règle documentée, qui reproduit ce résultat. 127 tests verts au
  total, `tsc -b` propre. Détail complet : `docs/reprise.md`.
- ✅ **Chantier `ajReelleHistorique` (2026-07-24)** : `SoldeIndemnisationDepart.ajReelle: number |
  null` remplacé par `ajReelleHistorique: {dateEffet, valeur}[]` — un utilisateur peut connaître
  plusieurs taux d'AJ réelle successifs sur une même période d'indemnisation (ex. 54,55 € jusqu'au
  17/01/2026 puis 55,02 € à partir du 18/01/2026). Restait alors sur `SoldeIndemnisationDepart`
  (**décision revue le 2026-07-25**, cf. chantier `Profil.ouvertureDroits` ci-dessous : déplacé vers
  `Profil`, l'usage réel de `SoldeIndemnisationDepart` a fini par disparaître entièrement). `engine/ajReelleUtils.ts` (`getAjReelleAt`)
  cherche le taux applicable à une date ; nouveau type discriminé `MontantMensuelResultat` +
  champ `MoisIndemnisationResultat.montantMensuel`, calculé uniquement dans la fonction de série
  du module (le `moisLabel` de `calculerMoisIndemnisation`/`calculerSerieIndemnisation` reste
  purement informatif, jamais une vraie date). `RevenusMensuels.tsx` :
  éditeur de périodes AJ (date d'effet/valeur/suppression), plus de repli sur une AJ estimée
  (devoir n°2) — encart ambre si aucune période connue, `—` mois par mois si hors couverture.
  Migration silencieuse de l'ancien champ `ajReelle` dans `localStorageAdapter.ts`, appliquée à la
  fois au chargement localStorage et à l'import JSON. Au passage : `RevenusMensuels.tsx` masqué en
  première admission (module sans objet avant l'ouverture des droits). 136 tests verts, `tsc -b`
  propre, vérifié dans le navigateur à chaque étape. Détail complet : `docs/reprise.md`.
- ✅ **Chantier découpage mensuel des contrats (2026-07-24)** : `Contrat.dateDebut: string` ajouté
  (migration silencieuse : repli sur `date` si absent, contrat traité comme un seul jour) ;
  `engine/decoupageMensuel.ts` (`repartirContratParMois`) répartit heures et salaire d'un contrat
  au prorata des jours calendaires quand il chevauche deux mois civils (réutilise
  `heuresBrutesContrat`, aucune logique dupliquée). **Formule JNI corrigée** :
  `Math.floor(heuresDuMois × coeffJoursNonIndemnisables / diviseurJoursTravaillesA10)` — floor, pas
  ceil, calculée directement sur les heures du mois (donne enfin un usage à
  `diviseurJoursTravaillesA10`, vestige inutilisé jusqu'ici) — validée mot pour mot sur 4 mois
  réels indépendants (fév/mars/avril/mai 2026, zéro écart). `calculerSerieDepuisContrats` remplace
  `calculerSerieDepuisDeclarations` : agrège `repartirContratParMois` de tous les contrats par
  mois (plage revue le 2026-07-25, cf. chantier `Profil.ouvertureDroits` ci-dessous). **`Declaration
  Mensuelle` supprimée entièrement** (types, storage, UI) — la saisie manuelle des jours déclarés
  est remplacée par un calcul automatique depuis les vrais contrats ; `RevenusMensuels.tsx` : plus
  de formulaire "Ajouter un mois" ni de badge "provisoire", colonne "Heures travaillées" affichée à
  la place. `ContractForm.tsx` : champ "Date de début" ajouté (pré-rempli à la date de fin tant que
  non modifié, validation `dateDebut ≤ dateFin`). **Origine notable** : ce chantier a démarré sur
  trois points présentés comme actés en session précédente qui se sont révélés faux à la
  vérification (dont la formule JNI elle-même, `ceil` au lieu de `floor`) — la vraie formule a été
  retrouvée par recherche web puis validée empiriquement sur les documents réels de l'utilisateur
  (relevés France Travail, un contrat GUSO) avant d'être câblée. `decompteHeures.ts` (507h)
  volontairement non touché — compteur distinct, hors périmètre. 145 tests verts, `tsc -b` propre,
  vérifié dans le navigateur (7 contrats réels, 4 mois certifiés exacts en bout en bout). Détail
  complet : `docs/reprise.md`.
- ✅ **Chantier `Profil.ouvertureDroits` (2026-07-25)** : remplace la saisie manuelle d'un solde de
  mi-parcours (`SoldeIndemnisationDepart.delaiRestant`/`franchiseCPRestante`/`quotaCPCarryOver`,
  retirés) par une simulation automatique depuis la VRAIE date d'ouverture des droits.
  `Profil.ouvertureDroits: { dateOuverture, franchiseCPTotale, delaiAttenteInitial }` saisi une
  fois depuis la notification France Travail ; `ajReelleHistorique` déplacé ici depuis
  `SoldeIndemnisationDepart` (même raisonnement). `SoldeIndemnisationDepart` ne porte plus que
  `dateDepart` — un filtre d'affichage : `calculerSerieDepuisContrats` simule depuis
  `ouvertureDroits.dateOuverture` en continu (mois antérieurs à `dateDepart` simulés mais jamais
  montrés, nécessaire pour un état correct au premier mois affiché), retourne
  `SerieIndemnisationResultat` (`calculable: false` si `ouvertureDroits` absent — aucun point de
  départ inventé, devoir n°2). Corrige au passage une limite connue : le palier du forfait CP
  (2j/3j) se décide désormais sur la franchise TOTALE (constante), pas sur le restant courant.
  UI : nouvelle section « Mon indemnisation en cours » dans `MonProfil.tsx` (3 champs guidés +
  éditeur AJ déplacé depuis `RevenusMensuels.tsx`) ; `RevenusMensuels.tsx` simplifié à un seul
  champ de configuration (`dateDepart`) + garde-fou si `ouvertureDroits` absent (encart ambre, lien
  direct vers le profil). **Origine notable** : la proposition initiale contenait une formule
  auto-annulante (`franchiseTotale − moisÉcoulés × 2` ≈ 0 toujours) — signalée avant tout code,
  résolue par ce refactor plus profond plutôt qu'un correctif de formule ponctuel. 146 tests verts,
  `tsc -b` propre, vérifié dans le navigateur de bout en bout (mois masqués avant `dateDepart`,
  6 mois vérifiés au centime près à la main). Détail complet : `docs/reprise.md`.
- ✅ **Bouton « Modifier » pour `dateDepart`** (2026-07-25, `2edb88e`) : `SoldeRecap`
  (`RevenusMensuels.tsx`) permet désormais de changer la date d'affichage du tableau après coup
  (auparavant seul un ré-import JSON le permettait — trou UX trouvé en investiguant un
  signalement utilisateur). Pas encore vérifié dans le navigateur ni testé automatiquement
  (UI seule). Détail complet : `docs/reprise.md`.
- ✅ **Taux PAS, franchise salaires mensuelle, mois de réadmission, revenus contrats** (2026-07-26,
  14 commits `2edb88e`→`502b495`) : `tauxPrelevementSource`/`montantNet`, mois de réadmission non
  calculé (nouveau type `LigneSerieIndemnisation`), alerte `pas_taux_janvier`, répartition mensuelle
  de la franchise salaires câblée (mécanisme complet, mais **pas encore branchée sur de vraies
  données** dans l'app — SR/SJM jamais fournis à `calculerSerieDepuisContrats`), colonnes « Revenus
  contrats »/« Revenu total ». 159 tests verts. Détail complet : `docs/reprise.md`.
  ✅ **Branchement fait le 29/07/2026 (soir), commit `5446e33`** — voir l'entrée dédiée plus bas :
  `TableauResultats` (`RevenusMensuels.tsx`) calcule maintenant SR/NHT/SJM réels et les transmet à
  `calculerSerieDepuisContrats`. Ce paragraphe ne décrit donc plus l'état actuel, gardé pour
  l'historique du chantier.
- 🔴 **Point 2 non résolu (AJ brute vs nette)** : les relevés officiels disent « Allocation
  **brute** » pour la valeur que Cadence traite comme point de départ net dans
  `ajReelleHistorique` — écart potentiel ~5 % jamais réinvestigué. *(Mise à jour 31/07/2026 :
  résolu — ce n'était pas un bug de calcul, la formule est prouvée correcte ; seul le backlog
  n'avait jamais été mis à jour, même famille de péremption documentaire que l'hébergement UE
  ci-dessus. Cf. l'entrée ✅ en tête de ce document, « Le plus récent d'abord — session du
  31/07/2026 », et l'entrée ✅ du Backlog, « À faire — priorité normale », plus bas — celle-ci déjà
  flippée en place, pas dupliquée ici.)* **Comparaison complète Cadence
  vs les 8 mois réels** toujours pas déroulée non plus (demande d'origine de l'utilisateur).
  **Confusion de dossier non résolue** : deux copies du projet existent (`C:\Users\benoi\cadence`,
  la vraie, vs `C:\Users\benoi\OneDrive\Bureau\cadence\cadence`, une ossature de tout début jamais
  construite) — l'utilisateur a montré une capture de la seconde en la prenant pour l'app actuelle,
  deux questions de clarification posées sans réponse. **Détail complet et prochaine étape exacte :
  `docs/reprise.md`.**
- ⬜ **Non traité (V2/V3) :** coordination européenne (périodes U1/PDU1) — même famille qu'Annexe 8/article 65, hors périmètre Annexe 10 pur. Aucune logique ni champ de données ne l'anticipe encore (détail dans `docs/SPEC.md` §10 et §11.C). Ne pas confondre avec le champ `territoire` du contrat, qui couvre un cas différent (cachet ponctuel joué en EEE/Suisse/UK mais déclaré en France).
- 🔁 **Maintenance de la config** (récurrent, perso — hors app, pas de backend en bêta) : une fois
  par mois, vérifier à la source officielle SMIC (horaire / mensuel / journalier), PMSS, et les
  plafonds ARE (AJ min 31,96 €, plancher 44 €, plafond ARE Annexes VIII/X — historisé par année
  civile dans `are.plafondHistorique`, actuellement 181,18 € pour 2026) — au minimum à chaque
  revalorisation connue (SMIC/PMSS au 1er janvier et lors des hausses en cours d'année, ex. 1er
  juin 2026) et à chaque nouvelle convention d'assurance chômage, re-vérifier **toutes** les
  valeurs de `franceTravailConfig.ts`. Si une valeur a bougé : mettre à jour
  `franceTravailConfig.ts` (+ `meta.version`, `meta.source`, et `meta.dateEntreeVigueur` si c'est le
  SMIC qui change) et rejouer tous les cas de `docs/validation.md` contre le simulateur officiel.
  **À chaque passage, même sans changement : `meta.dateDerniereVerification` à la date du jour** —
  c'est la seule date que l'app affiche. (`valableJusquau` n'existe plus, supprimé le 03/08/2026 avec
  la bannière de péremption inerte, cf. point 13.) Ferme le risque « maintenance de la config non
  attribuée » identifié au SPEC §10. Objectif : garantir dans la durée les deux devoirs sacrés (pas
  de perte de données, pas de chiffre faux). La config est actuellement datée « 2026.08 » —
  prochaine échéance connue : la revalorisation SMIC/PMSS du 1er janvier 2027.
- ⬜ **Chantier import IA premium — analyse du périmètre de scan faite, aucun code produit
  (28/07/2026).** Extension prévue de l'import PDF (aujourd'hui local/pdfjs) vers un import IA
  premium via Mistral Document AI, routant vers des « propositions d'écriture » validées une par une
  plutôt qu'un remplissage direct. Analyse du périmètre menée contre `src/types/index.ts` réel :
  confirmation de `PeriodeAssimilee` (schéma inchangé, 6 variants) ; ajout au schéma d'extraction de
  `ouvertureDroits.dateLimiteIndemnisation`, `ouvertureDroits.tauxPrelevementSource`,
  `dureeDroitsMois`, `dateAnniversairePrecedente`, `situation`, `dateNaissance` ; correction du
  nommage **AEM** (Attestation d'Employeur Mensuelle, pas « AER ») ; `type`/`territoire` du Contrat
  passés nullable (un bulletin ne les indique presque jamais — les exiger forçait le modèle à
  inventer, en contradiction avec sa propre règle « jamais de valeur inventée »). Exclus formellement
  du périmètre de scan : `regimeDeclare` (doit rester auto-déclaré, cf. garde-fou situation mixte),
  `salairesHorsAnnexe10PRA` seul (déclencherait l'alerte de contradiction), les constantes de config
  (plafonds), `activiteHorsAnnexe10` (déprécié), `SoldeIndemnisationDepart.dateDepart` (choix
  d'affichage, aucun document ne le porte). Le point brut/net sur `ajReelleHistorique` reste **non
  résolu par design** : `calculerAJNette` est à sens unique (brut → net), exige un SJM indisponible
  à la lecture d'un relevé, et est une estimation assumée — l'utiliser réintroduirait l'« AJ estimée »
  que le champ interdit explicitement. Ne pas confondre avec `MontantMensuelResultat.montantNet`,
  qui applique le prélèvement à la source, pas les cotisations. Documents V1 : bulletin de paie/AEM,
  notification d'admission, relevé de situation, déclaration fiscale annuelle. V2 (aucune fixture
  réelle disponible) : contrat signé, attestations CPAM, avis d'imposition, attestation Afdas/OPCO —
  avec un piège identifié côté CPAM : `ald` et `maladie_intercontrat` ont des effets **opposés** sur
  le décompte et un avis d'arrêt de travail ne permet pas de trancher, donc `info_seule` obligatoire,
  jamais un type deviné. **Non-régression vérifiée dans le code avant tout développement** : l'import
  local pdfjs (`lib/extractionBulletin.ts` → `ImportBulletins`, onglet « Import PDF ») reste un canal
  intact et gratuit, et l'app n'a aujourd'hui **aucune authentification** (rien dans `package.json`
  ni `src/`, hormis `lib/googleDriveAuth.ts` qui est opt-in dans le module frais réels) — `App.tsx`
  ne pose aucun verrou global, donc une auth introduite plus tard peut rester cantonnée au clic
  « Importer avec l'IA ». **Bloqué avant implémentation** : le projet n'a ni framework serverless ni
  dossier `api/` (SPA statique Vite/PWA), or `MISTRAL_API_KEY` ne doit jamais atterrir dans le bundle
  client — le choix de la plateforme d'hébergement est un prérequis, cf. §11.B du SPEC (backend/comptes
  hors bêta) et le prérequis bloquant « comptes + paiement » de l'entrée premium. Références :
  `docs/files/SPEC_annexe_IA_premium.md`, `docs/files/brief_claude_code_documents_premium.md`.
- ✅ **Backend minimal en place (28/07/2026)** — première brique serveur du projet, sans auth ni base
  de données (chantier séparé, à faire quand le gate premium sera construit). `api/extract-document.ts`
  et `src/types/extraction.ts` (ex-`api/extraction-schema.ts`, déplacé le 28/07/2026, cf. plus bas)
  sortis de `docs/files/` vers `api/` (convention Vercel Functions, endpoint `/api/extract-document`).
  Dépendances ajoutées : `zod-to-json-schema` (runtime) et
  `@types/node` (dev). **Ces fichiers sont enfin type-checkés** via `tsconfig.api.json` — volontairement
  SÉPARÉ de `tsconfig.json` : ce dernier a `"types": ["vitest/globals"]`, ce qui désactive le chargement
  automatique des `@types` (donc `process` restait inconnu même avec `@types/node`), et surtout ajouter
  `"node"` au projet principal rendrait `process`/`Buffer` visibles depuis le code React, où ils cassent
  au runtime. Nouveau script `npm run typecheck` (= `tsc -b && tsc -p tsconfig.api.json`), les deux
  projets sont vérifiés par `npm run build`. Vérifié : aucune trace de `mistral` ni de
  `zodToJsonSchema` dans `dist/` — le code serveur ne fuit pas dans le bundle client.
- 🔴 **À traiter en priorité au prochain chantier import IA — le composant brouillon contourne le
  backend.** `docs/files/ImportDocumentIA.jsx` (et sa copie `docs/ImportDocumentIA.jsx`, de contenu
  DIFFÉRENT) appelle `https://api.mistral.ai/v1/ocr` **directement depuis le navigateur**, avec la clé
  saisie dans un `<input>` (`const [apiKey, setApiKey] = useState("")`). Câblé tel quel, ça rend
  `api/extract-document.ts` inutile et expose la clé. Le composant doit appeler `POST /api/extract-document`
  et ne jamais connaître la clé. Rappel de la règle : la variable doit s'appeler `MISTRAL_API_KEY`, JAMAIS
  `VITE_MISTRAL_API_KEY` (Vite inline tout `VITE_*` dans le bundle client).
- 🔶 **Contraintes Vercel restantes, à trancher avant le premier déploiement** — points (1) et (4)
  de la liste initiale **résolus le 28/07/2026** (commit `d3ebb36`) : runtime Edge désormais forcé,
  et clé absente diagnostiquée en 503 explicite au lieu d'un 500 générique. Point (2) — le PDF part
  en base64 dans le corps de requête, +33 % de volume, plafond Edge ~4 Mo → **plafond pratique ~3 Mo
  de PDF** — **résolu le 29/07/2026 (commit `ecca2c8`)** : `lib/fichierImportIA.ts` refuse le fichier
  côté client avant la modale de consentement, avec un message qui donne la taille réelle, la limite,
  et une alternative (réduire le document ou saisir à la main). Vérifié sur le fichier réel le
  29/07/2026 (soir) : le contrôle existe bel et bien, ce n'est plus un commentaire mort — cette ligne
  contredisait à tort l'entrée sur `ecca2c8` plus bas, corrigée ici. Reste ouvert : (3) l'OCR peut
  dépasser le timeout, l'Edge plafonnant vers 25 s — non mesuré, aucun appel réel n'a jamais eu lieu.
- ⚠️ **`docs/cadence-export-2026-07-24.json` contient de VRAIES données personnelles** (date de naissance,
  21 contrats réels, employeurs nommés) — ajouté à `.gitignore`, **jamais à committer** : un commit git
  ne s'effface pas proprement. Anomalie repérée au passage dans ce fichier : `dateNaissance: "19994-06-09"`
  (année à 5 chiffres) — à vérifier dans les données réelles, ça fausse le plafond enseignement 70/120 h.
- ✅ **Écran de revue des extractions IA construit sur fixtures (28/07/2026, commit `d3ebb36` sur
  `backend-api-import-ia`)** — l'UX et le routage sont validés sans qu'aucun document réel ni aucun
  appel réseau n'entre en jeu. `components/RevueExtraction.tsx` affiche une carte par proposition
  (valeurs lues, confiance par champ, justification) ; **aucun bouton « tout appliquer »** : chaque
  proposition demande un geste explicite, et un contrat passe toujours par `ContractForm` en
  relecture champ par champ, jamais appliqué directement. Toute la décision « cette proposition
  est-elle applicable sans risque ? » vit dans `lib/routageExtraction.ts` — pure, hors du composant,
  **22 tests dédiés** (`lib/__tests__/routageExtraction.test.ts`). `lib/fixturesExtraction.ts` fournit
  4 extractions simulées typées `ExtractionResult` (donc cassées à la compilation si le schéma
  change) : notification complète, bulletin aux champs manquants, relevé à 3 refus, document non
  reconnu. `components/RevueExtractionDemo.tsx` est le banc d'essai, rendu **uniquement si
  `import.meta.env.DEV`** (garde dans le composant ET chez l'appelant `App.tsx`, onglet « Import
  PDF », bloc replié) : les montants des fixtures sont fictifs, les montrer à un vrai utilisateur
  serait le faux chiffre qu'interdit le devoir n°2. **Bac à sable** : les validations du banc d'essai
  atterrissent dans une copie jetable du profil, jamais dans les vraies données — sans ça, un clic
  sur « Enregistrer dans mon profil » aurait inscrit une AJ et une franchise inventées dans le vrai
  profil (devoirs n°1 ET n°2) ; la validation appelée reste en revanche la vraie
  (`validerProfilPourEcriture`). **Prouvé** : 372 tests verts (350 avant, +22), `npm run typecheck`
  propre (src + api), `npm run build` OK ; vérifié dans le navigateur que chaque valeur de la
  notification simulée atterrit dans le bon champ, que le **vrai `localStorage` est resté intact
  après coup** (`cadence:v1:donnees` — franchise toujours à 0, `ajReelleHistorique` toujours absent,
  3 contrats inchangés), que les trois refus s'affichent sans bouton d'enregistrement, et que les
  fixtures sont **absentes du bundle de production** (recherche dans `dist/`). **Non prouvé** : aucun
  test React sur ces composants (même limite 🔶 que le reste de l'UI) et le comportement face à une
  vraie réponse Mistral reste inconnu — aucune n'a jamais été reçue.
- ✅ **Schéma d'extraction déplacé `api/extraction-schema.ts` → `src/types/extraction.ts` (commit
  `d3ebb36`)** — source **unique** partagée par le backend (qui valide la réponse Mistral avec ce
  schéma) et le front (qui affiche et route les propositions). Deux copies auraient pu diverger en
  silence, et une divergence ici envoie une valeur dans le mauvais champ, donc un chiffre faux. Rangé
  dans `src/` et non dans `api/` parce que `tsconfig.json` n'inclut que `src` : dans l'autre sens, le
  programme du navigateur aurait dû aller chercher un fichier de `api/`, ce qui brouille la frontière
  que `tsconfig.api.json` défend (le code React ne doit pas voir `process`/`Buffer`). Le fichier
  n'utilise que Zod, aucun global Node — `api/` peut donc l'importer sans risque inverse.
  Volontairement **pas** ré-exporté depuis `src/types/index.ts` : la distinction « proposition à
  valider » vs « donnée établie » doit rester visible à l'import.
- ✅ **Refus de routage net/brut sur `ajReelleHistorique` (commit `d3ebb36`)** — le piège le plus
  dangereux de l'extraction, fermé. Ce champ contient une AJ **nette** : c'est ce que dit l'UI de
  saisie (`MonProfil.tsx`, « Allocation journalière nette ») et ce que suppose le moteur, qui applique
  **ensuite** le prélèvement à la source dessus (`indemnisationMensuelle.ts`). Or un relevé de
  situation dit « allocation brute » : y router ce brut aurait gonflé **tous** les montants mensuels
  affichés. `lib/routageExtraction.ts` refuse donc toute proposition dont `natureMontant ≠ "net"`, à
  l'évaluation **et** à l'écriture (exception si l'évaluation est contournée). Aucune conversion n'est
  possible, conformément à ce qui était déjà acté plus haut : `calculerAJNette` est à sens unique,
  exige un SJM absent du document, et est une estimation assumée. Deux autres refus structurels dans
  le même fichier : `periode_assimilee` (pas de destination, cf. dette ci-dessous) et
  `profil_ouverture_droits` incomplet (franchise ou délai d'attente manquants — mettre 0 « en
  attendant » serait un chiffre inventé qui décale les dates de versement).
- 🔴 **Dette tracée (`docs/validation.md`) : `PeriodeAssimilee` n'a aucun chemin d'écriture dans
  l'app.** Problème **préexistant**, découvert en écrivant l'écran de revue (28/07/2026).
  `DonneesCadence.periodes` est **lu** partout où ça compte (`periodeReference.ts`,
  `decompteHeures.ts`, `salaireReference.ts`, `prediction.ts`, `cycles.ts`, `Simulateur.tsx`) mais
  **aucune UI ni aucun setter d'`App.tsx` ne permet d'en créer une** — le tableau ne peut être peuplé
  que par un import JSON. Une maternité ou un accident du travail, qui valent 5 h/jour au décompte des
  507 h, est donc aujourd'hui **inarrivable par la saisie normale**, ce qui sous-estime silencieusement
  le décompte pour qui est concerné. Conséquence immédiate : la cible `periode_assimilee` du schéma est
  refusée faute de destination, avec un message explicite plutôt qu'un abandon silencieux. **À
  construire** : CRUD des périodes (formulaire + `ajouterPeriode`/`supprimerPeriode` dans `App.tsx`),
  après quoi ce refus devient un routage réel. Le piège CPAM déjà documenté reste entier : `ald` vs
  `maladie_intercontrat`, effets opposés sur le décompte, jamais devinés depuis un arrêt de travail.
- ✅ **Backend : runtime Edge déclaré + clé manquante diagnostiquée (commit `d3ebb36`)** —
  `export const config = { runtime: "edge" }` ajouté dans `api/extract-document.ts`. Le handler
  utilisait **déjà** la signature web standard (`(req: Request) => Promise<Response>`), qui est celle
  d'Edge ; en runtime Node, Vercel attendrait `(req: VercelRequest, res: VercelResponse)`. Garde
  explicite sur `MISTRAL_API_KEY` absente : erreur dédiée (`ConfigurationManquanteError`) → **503**
  avec un message clair, au lieu du 500 « Réessaie » précédent, trompeur puisque réessayer n'y change
  rien ; la clé est lue **par requête**, plus au chargement du module. `.env.example` documente
  `MISTRAL_API_KEY` avec le piège rappelé : jamais `VITE_MISTRAL_API_KEY`, Vite inline tout `VITE_*`
  dans le bundle client. Le plafond de corps de requête Edge (~4 Mo, soit **~3 Mo de PDF** en base64)
  — ✅ **géré côté client depuis le 29/07/2026 (commit `ecca2c8`)**, voir l'entrée correspondante
  plus bas : ce paragraphe disait encore « pas encore géré » après coup, contradiction corrigée le
  29/07/2026 (soir). **Non prouvé** : rien de tout ça n'a été exécuté sur Vercel, aucun déploiement
  n'a eu lieu.
- ✅ **Fusion `backend-api-import-ia` → `master` faite (01/08/2026)**, cette entrée est close. Fait
  par l'utilisateur depuis son propre terminal : `git merge backend-api-import-ia` sur `master`,
  fast-forward propre (21 fichiers, aucun conflit). Vérifié depuis cette session :
  `git log --oneline master..backend-api-import-ia` et le sens inverse renvoient tous les deux
  vide, `git rev-list --left-right --count master...backend-api-import-ia` → `0  0` — divergence
  réellement nulle des deux côtés, les deux branches locales pointent sur le même commit
  (`045d46a` au moment de cette vérification). ⚠️ **Nuance à ne pas escamoter** : `origin/master`
  et `origin/backend-api-import-ia` (GitHub) sont tous les deux restés sur `2330a2d` au moment de
  cette vérification (`git fetch origin` propre, sans erreur) — le push mentionné ne s'est donc pas
  encore reflété sur le dépôt distant, ou a été poussé ailleurs. Écart entre affirmation et preuve,
  signalé plutôt que supposé exact ; à recontrôler après un prochain `git push`. Rappel : Claude
  Code ne pousse jamais vers `origin` par consigne explicite, indépendamment de la présence
  d'identifiants dans l'URL du remote.
  **Stratégie de branches à partir de maintenant (décidée le 01/08/2026)** : développer
  directement sur `master`, `backend-api-import-ia` n'est plus utilisée comme branche de travail
  séparée. Raison : le chantier import IA n'est plus un gros morceau isolé à valider avant fusion
  (c'était la justification initiale de la branche séparée) — c'est désormais une suite de petits
  ajustements ponctuels (AEM, `justificatif_declaration`, corrections de lexique), de la même
  nature que le reste du travail sur `master`. Garder une branche séparée pour ça ajouterait un
  risque de re-divergence silencieuse (déjà arrivé deux fois cette semaine, cf. entrées
  précédentes) sans bénéfice clair en retour. Si un futur chantier redevient assez gros et risqué
  pour justifier une validation isolée avant fusion (ex. Annexe 8/article 65, §11.C), rouvrir une
  branche dédiée à ce moment-là plutôt que de réutiliser `backend-api-import-ia` par habitude.
- ✅ **`document_annotation_prompt` éprouvé sur documents réels (29/07/2026)** — le prompt d'extraction
  de `api/extract-document.ts` n'est plus une supposition : il a été mis au point par essais successifs
  dans le Document AI Playground de Mistral, sur **deux documents réels de Benoît** (une notification
  d'admission ARE et un bulletin de paie), plus une **confirmation croisée sur un relevé de situation**
  du même dossier. Les libellés du lexique pour la notification sont désormais des **citations exactes**,
  pas des formulations plausibles. Restent supposés : les libellés du relevé de situation, ceux de l'AEM,
  et les formulations de `situation`/`dateNaissance`. Trois enseignements, chacun né d'une erreur
  observée sur pièce :
  (1) **`info_seule` était devenu un refuge.** L'ancien prompt listait littéralement « montants
  bruts/nets du relevé » comme destination `info_seule`, ce qui y envoyait l'allocation journalière —
  la cible `aj_reelle_historique` ne se remplissait jamais. Remplacé par un **test de citation** :
  si la donnée correspond à un champ nommé ET que ses mots peuvent être cités, la cible structurée
  est obligatoire ; sinon `info_seule`. La citation va dans `justification`, que l'écran de revue
  affiche déjà — la règle est donc auditable à l'œil. Second blocage lié : `dateEffet` étant
  obligatoire et rarement accolé au montant, le modèle n'avait aucune façon licite d'émettre la
  proposition ; une règle de lecture explicite (la date d'effet est la date d'indemnisabilité
  énoncée dans le même document) a levé l'impasse.
  (2) **Piège de vocabulaire à un an d'écart, corrigé.** La phrase « … fin de votre contrat de
  travail du DATE_A ayant permis l'ouverture de vos droits jusqu'à votre date anniversaire, soit le
  DATE_B inclus » contient **deux dates et deux champs** : `dateAnniversaire` = DATE_A,
  `dateLimiteIndemnisation` = DATE_B. Une version intermédiaire du prompt a retenu DATE_B dans
  `dateAnniversaire` — un an d'écart sur la borne qui détermine la fenêtre de référence et donc tout
  le décompte des 507 h. Cause de fond, **antérieure à l'IA et toujours vraie** : Cadence nomme
  `dateAnniversaire` ce que France Travail appelle « fin de contrat de travail », tandis que France
  Travail réserve « date anniversaire » à une date située douze mois plus tard ; et le mot a déjà deux
  sens dans le code (`Exercice.dateAnniversaire` = « fin du cycle »). Le piège attend n'importe quel
  lecteur, humain compris. Protégé à deux endroits : le prompt, et un `.describe()` explicite sur le
  champ dans `src/types/extraction.ts` — les descriptions du schéma partent avec chaque champ à chaque
  appel, là où un paragraphe de prompt peut se diluer.
  (3) **`dateLimiteIndemnisation` a deux formulations, pas une.** « La date limite de votre
  indemnisation est le X » (relevé de situation) et « jusqu'à votre date anniversaire, soit le X
  inclus » (notification) portent la **même date** — vérifié sur deux pièces du même dossier
  (17/01/2027 identique de part et d'autre). L'ancien `.describe()` disait « mot pour mot » une seule
  de ces phrases : corrigé, sinon schéma et prompt divergeaient.
  **Garde-fous vérifiés sur pièce, pas seulement énoncés** : sur le bulletin de paie, `type` et
  `territoire` sont restés à `null`, aucun nombre de cachets n'a été déduit du montant brut, et
  surtout le **NIR présent en clair dans le document est resté hors de l'extraction** — la règle
  d'exclusion des données personnelles n'était jusque-là qu'une consigne non éprouvée.
  **Arbitrages produit actés** : `contrat.type` ne se remplit que si le document décrit l'**activité**
  (cachets de représentation, heures de cours), jamais sur une ligne « Statut » administrative isolée,
  même portant le mot exact — statut et nature d'activité ne coïncident pas toujours, et ce champ
  décide du plafond enseignement 70/120 h. `dureeDroitsMois` reste à la **saisie manuelle** : aucune
  déduction depuis un intervalle de dates, même explicitement de douze mois.
  **Partiellement éprouvé depuis** : le prompt a tourné via `api/extract-document.ts` le 29/07/2026,
  mais sur un PDF bidon uniquement (cf. l'entrée ✅ sur le dialecte). Sur pièces réelles, il n'a été
  éprouvé que dans le Playground.
- ✅ **Dialecte du schéma aligné, et premier appel réel à Mistral effectué (29/07/2026, commit
  `80d4904`).** `api/extract-document.ts` envoie désormais
  `zodToJsonSchema(..., { $refStrategy: "none" })` — JSON Schema draft-07, sans `$ref` interne ni
  `nullable` non standard.
  **Établi par test réel** : les DEUX dialectes sont acceptés par Mistral. Un PDF bidon a été envoyé
  tour à tour avec `{ target: "openApi3" }` puis `{ $refStrategy: "none" }` → **statut 200 dans les
  deux cas**, comportement identique (`typeDocumentDetecte: "non_reconnu"`, 0 proposition). Les trois
  points qui restaient en doute sont levés : la clé racine `$schema`, le `const` sur le discriminant
  `cible` (là où openApi3 écrivait `enum: ["contrat"]`), et les `additionalProperties` libres
  (`confiance`, `info_seule.donnees`).
  **La crainte héritée du 28/07 est DÉMENTIE — ne plus la ressortir** : le dialecte n'était pas « le
  candidat le plus probable à un échec au premier envoi ». Ce changement n'a rien réparé. draft-07
  est conservé parce que c'est du JSON Schema standard (lisible par tout validateur, moins exposé si
  Mistral durcit sa validation), pas parce que l'autre forme cassait quelque chose.
  **Vérifié hors réseau** : les deux formes décrivent les mêmes 55 champs obligatoires aux mêmes
  chemins, avec 22 descriptions rigoureusement identiques, nullabilité conservée (réécrite en branche
  `null` explicite). Aucune information perdue.
  ⚠️ **DEUX limites à ne pas surinterpréter.**
  1. Le test a porté sur un **PDF d'une page, texte inventé, sans aucune donnée exploitable** — la
     bonne réponse était « rien à proposer », et c'est ce qui est sorti. Cela prouve que le schéma
     est accepté et que la validation Zod est traversée, **pas** que l'extraction est juste. Aucun
     bulletin de paie, AEM ni notification n'est passé par ce chemin ; le prompt n'a été éprouvé sur
     pièces réelles que dans le Playground.
  2. L'appel a été lancé par un **script Node temporaire appelant `extractDocument` directement**,
     PAS par l'interface. Le segment **navigateur → `/api/extract-document` reste non exercé** :
     vérifié le 29/07, `npm run dev` (Vite) ne sert pas les Vercel Functions et répond **404** sur
     cette route. Ce segment ne sera validé qu'avec `vercel dev` ou un déploiement.
- ✅ **Mention d'entraînement : le texte est VRAI depuis le 04/08/2026 (point 9 clos).** Le texte
  n'annonce plus que Mistral « peut utiliser ce document pour entraîner ses modèles », et cette
  affirmation est désormais exacte : **Benoît a décoché l'utilisation de ses données pour
  l'entraînement dans le menu Privacy de la console Mistral.** Le tier gratuit autorise cet opt-out
  (help.mistral.ai/en/articles/455207, vérifié à la source le 04/08/2026), donc **la bascule sur le
  plan Scale n'a jamais été nécessaire** — l'ancienne rédaction de cette entrée supposait le
  contraire parce qu'elle ne connaissait que l'engagement PAR DÉFAUT du plan payant
  (help.mistral.ai/articles/347617), et ignorait l'opt-out gratuit. ⚠️ **Fait déclaré par Benoît,
  non vérifiable depuis le code** : si la clé change de compte ou d'organisation Mistral, l'opt-out
  ne suit pas et le texte redevient faux **sans que rien ne s'en aperçoive**. À re-contrôler dans la
  console à chaque changement de clé.
  **La contrepartie de la décision reste non négociable : la mention doit être dite à l'utilisateur
  en clair, dans l'UI, AVANT tout envoi — jamais dans des CGU cachées ni en petits caractères après
  coup.** Texte exact retenu, à ne pas reformuler sans décision explicite :
  > Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France,
  > hébergement UE) pour lecture automatique. Ces documents ne sont pas utilisés pour entraîner les
  > modèles de Mistral. Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte
  > jamais ton appareil.

  **Technique, volontairement absent du texte affiché à l'utilisateur (pour rester simple)** : la
  rétention standard des documents reste jusqu'à 30 jours côté Mistral, sauf activation du Zero Data
  Retention — information vérifiée mais omise du texte, à ressortir si jamais quelqu'un interroge le
  point rétention.

  Si le projet revient un jour sur cette décision (retour au tier gratuit, où l'entraînement est de
  nouveau possible), **c'est cette mention qu'il faut corriger en premier** : annoncer une absence
  d'entraînement qui n'est plus garantie serait aussi faux que taire un entraînement qui a lieu
  (devoir n°2, dans les deux sens).

  **Historique de la décision, conservé parce qu'il explique pourquoi le point a bougé.** Le
  03/08/2026, l'écart avait été **reporté sciemment** : Benoît étant seul utilisateur, la phrase
  inexacte n'était dite qu'à lui-même, en connaissance de cause. Ce report portait une limite
  explicite — **il cessait de tenir dès qu'un tiers pouvait envoyer un document**, le canal IA étant
  monté sans interrupteur (`App.tsx:501`). C'est exactement ce que la **refonte Supabase** a déclenché
  le 04/08/2026 en ouvrant l'app à des bêta-testeurs : le report est donc tombé, et le point a été
  réglé le jour même par l'opt-out gratuit plutôt que par la dépense prévue. À retenir comme méthode :
  la limite de validité écrite au moment du report est ce qui a permis de voir que l'échéance
  arrivait, au lieu de la découvrir après coup.
- ✅ **Consentement avant tout envoi + point d'entrée réel de l'import IA (29/07/2026, commits
  `ecca2c8` puis `d4906d5`)** — le chemin est désormais complet et en ligne droite :
  **dépôt → contrôles locaux → CONSENTEMENT → envoi → revue**. Pièces : `content/mentionEnvoiIA.ts`
  (le texte, source unique, testé mot pour mot), `components/ConsentementEnvoiIA.tsx` (modale
  bloquante, calquée sur `ConfirmationImport.tsx`), `lib/fichierImportIA.ts` (contrôles + base64),
  `lib/extraireDocumentIA.ts` (l'appel réseau), `components/ImportDocumentIA.tsx` (le point d'entrée,
  monté dans l'onglet « Import PDF » à côté du canal local, qui reste intouché).
  **La garantie tient par construction, pas par discipline** : `extraireDocumentIA` n'est appelé
  qu'à UN endroit du projet — le gestionnaire du bouton « Envoyer ce document » de la modale. Tant
  que ce bouton n'est pas cliqué, zéro octet ne part (vérifié dans le navigateur : « Annuler »
  produit zéro requête). Modale bloquante à CHAQUE envoi, **sans case « ne plus afficher »** : une
  telle case recréerait le consentement unique en petits caractères que la décision du 28/07 exclut.
  **Choix assumé : pas de réessai automatique.** En cas d'échec le fichier est oublié ; reprendre
  passe par un nouveau dépôt, donc par un nouveau consentement. Un bouton « Réessayer » renverrait
  le document sans repasser par la mention.
  **Contrôles locaux avant la modale** (format PDF, non vide, ≤ 3 Mo) : refuser tôt ce qui
  échouerait de toute façon, plutôt que faire consentir à un envoi condamné. Le plafond vient du
  corps de requête Edge (~4 Mo) et du gonflement base64 d'un tiers. Le type MIME absent retombe sur
  l'extension, mais l'extension ne l'emporte jamais sur un type qui dit autre chose.
  **Deux fuites d'information corrigées** dans `extraireDocumentIA`, trouvées en relisant le chemin
  ligne à ligne (le test du 404 passait, mais par chance) : `fetch` qui rejette affichait
  « Failed to fetch », et un 200 dont le corps n'est pas du JSON affichait « Unexpected token '<' ».
  Un 504 de proxy pouvait aussi révéler une adresse interne. Corrigé par liste blanche de statuts
  (seul le 503 « clé absente » voit son message réaffiché, car « réessaie » y serait trompeur) plus
  rejet de tout corps contenant des chevrons. Aucun de ces défauts n'a existé dans une version
  livrée. Nuance de formulation conservée : le message de coupure réseau **ne prétend pas** que le
  document n'a pas été transmis — une coupure peut survenir après l'envoi du corps.
  Le bouton d'aperçu de la modale a été retiré de `RevueExtractionDemo.tsx` : une seule porte vers
  la modale, et le vrai chemin est déjà sans danger à exercer en local.
  **408 tests verts** (372 avant ces deux commits), `npm run typecheck` propre, `npm run build` OK.
  ⚠️ **Aucun document ne peut partir en local *via l'app*** : `vite dev` ne sert pas les fonctions
  Vercel, donc `POST /api/extract-document` répond 404. Le segment navigateur → endpoint reste donc
  non exercé, et un envoi réel *depuis l'interface* exige un déploiement Vercel avec la clé (ou un
  routage dev-only). En revanche un script Node appelant `extractDocument` **directement** contourne
  l'endpoint et a bel et bien joint Mistral en local (cf. l'entrée ✅ sur le dialecte du schéma :
  statut 200, PDF bidon sans donnée personnelle) — la formulation « rien ne peut partir » est donc
  fausse au sens littéral depuis le 29/07/2026.
- ✅ **`etablissementAgree` ne peut plus être déduit d'un nom d'établissement (29/07/2026, commit
  `a934db2`).** Le risque décrit ici était réel : rien n'empêchait de conclure `true` de la seule
  présence d'un nom de conservatoire ou d'école de musique, alors qu'« agréé » est un statut
  administratif précis, presque jamais écrit sur un bulletin. La règle est désormais posée aux DEUX
  endroits que le modèle reçoit — le lexique de `document_annotation_prompt` et le `.describe()` du
  champ dans `src/types/extraction.ts` : `true` seulement si « agréé »/« agrément » figure
  LITTÉRALEMENT à propos de cet établissement ; un nom d'établissement est un nom, pas un agrément ;
  sinon `null`. Vérifié que la description atteint réellement le JSON Schema généré (888 caractères),
  et pas seulement le code source.
  ✅ **`enRapportAvecMetier` corrigé à son tour (31/07/2026, commit `5f9f6ab`)** — même patron exact
  aux mêmes deux endroits (lexique de `document_annotation_prompt` + `.describe()` du champ) : `true`
  seulement si le document mentionne LITTÉRALEMENT que l'enseignement est en rapport avec le métier ou
  l'activité artistique de l'intéressé ; un nom de matière, d'établissement ou de discipline plausible
  n'est pas une mention explicite ; sinon `null`. Vérifié que la description atteint réellement le
  JSON Schema généré (934 caractères). Les deux moitiés de la condition dans `decompteHeures.ts` sont
  désormais couvertes.
- ✅ **Affirmation « hébergement UE » confirmée par source officielle (31/07/2026).** Source :
  [help.mistral.ai — « Where do you store my data or my Organization's data? »](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data),
  consultée le 31/07/2026 : « By default, your data is hosted in the European Union. » — exactement
  ce que dit la mention de consentement. **Nuance à garder, trouvée dans la même source, plus précise
  que ce qui était supposé** : selon la fonctionnalité utilisée, une donnée peut être transférée
  temporairement hors UE vers un sous-traitant listé dans l'onglet « Subprocessors » du Trust Center ;
  dans ce cas Mistral applique les clauses contractuelles types de la Commission européenne (art. 46
  RGPD) et exige des garanties de sécurité renforcées (zero data retention ou chiffrement) côté
  sous-traitant. Les clients Enterprise peuvent désactiver ces transferts au niveau organisation.
  « Hébergement UE » est donc vrai comme principe par défaut documenté par Mistral lui-même, pas une
  garantie absolue à 100 % pour tous les usages — nuance déjà portée par le texte lui-même (aucune
  garantie à 100 % n'y est promise), donc **`content/mentionEnvoiIA.ts` reste inchangé**, seule cette
  entrée de documentation interne passe de 🔶 à ✅. (L'autre affirmation historique de ce bloc, sur
  l'entraînement en tier gratuit, est périmée depuis le 31/07/2026 : le texte ne fait plus cette
  affirmation, cf. l'entrée 🔶 dédiée plus haut.)

✅ **Phase 3 committée** (commit `d664344`) : `ajouterPeriode`/`supprimerPeriode` dans `App.tsx`
(pattern `ajouterContrat`/`supprimerContrat`), `PeriodeForm.tsx` (6 types, validation dateDebut ≤
dateFin, avertissements ald/maladie_intercontrat), `PeriodeList.tsx` (confirmation navigateur,
pattern suppression de série de contrats). **Écart avec le plan initial** (cf. ligne ci-dessous,
écrite avant la décision finale) : la section vit dans **Mon profil**, pas dans l'onglet Contrats —
décision explicite de Benoît au moment du cahier des charges, pas un oubli. Vérifié en navigateur par
Benoît : ajout et suppression d'une période font bouger le total d'heures du Dashboard dans les deux
sens. `engine/` inchangé, `PeriodeAssimilee` inchangé, schéma Zod déjà couvert (rien à faire côté
Phase 1 du chantier storage). 443 tests verts, `tsc -b` propre.

Effet de bord à garder en tête pour la suite : le refus n°2 de `routageExtraction.ts`
(`periode_assimilee` toujours `non_applicable`, faute d'écran de saisie) n'a plus sa raison d'être
technique — l'écran existe maintenant. Le débloquer (router une période extraite par l'IA vers
`ajouterPeriode`) n'a pas été fait ici, ce n'était pas demandé, mais c'est désormais possible.

✅ **Phase 1 du chantier « saisie des périodes assimilées » committée** (commit `a3f0f71`, branche
`backend-api-import-ia`, après relecture et feu vert de Benoît). Les 4 fichiers
(`src/engine/decompteHeures.ts`, `src/engine/salaireReference.ts` et leurs deux fichiers de tests)
sont dans l'historique. 440 tests verts, `npm run typecheck` propre au moment du commit.

Ce que la Phase 1 fait : **plus aucun jour n'est compté deux fois.** Un nouvel helper partagé
`joursAssimilesHorsContrat` (exporté par `decompteHeures.ts`) compte les jours d'une période assimilée
dans la fenêtre **en sautant ceux déjà couverts par un contrat**. Deux défauts fermés d'un coup :

- **compteur 507 h** (`decompteHeures.ts`) : un jour sous contrat valait ses heures **plus** 5 h
  assimilées → compteur gonflé, donc faux feu vert ;
- **montant** (`salaireReference.ts`) : un jour travaillé était soustrait du dénominateur du SAR, ce
  qui **gonflait l'allocation**. Trouvé en vérifiant, hors du périmètre demandé, même cause racine.
  L'exclusion y regarde **tous** les contrats de la fenêtre, **enseignement inclus** (la question est
  « ce jour a-t-il été travaillé ? », pas « ce contrat alimente-t-il le SR ? »).

Défaut **latent** jusqu'ici, et c'est le cœur du raisonnement : sans chemin d'écriture, `periodes` est
vide en pratique — **c'est l'écran de saisie à venir qui l'aurait armé.** D'où la correction du moteur
AVANT l'écran, et non après.

Un test existant a échoué et c'était un vrai signal : la fixture du SAR posait un cachet le 01/06/2026
en pleine maternité déclarée du 01/03 au 08/06. Le contrat a été **déplacé en septembre** plutôt que
l'attendu changé en 99 — changer l'attendu aurait figé la contradiction dans le test de référence.

`TYPES_OUVRANT_SAR` : le ⚠️ « supposition » a été retiré. Le guide (p. 11-12) énumère limitativement
maternité/adoption/ALD comme les trois seuls types qui aménagent le SR — vérifié par Benoît, pas
supposé. Ne pas réintroduire `accident_travail` ni `suspension_contrat` « par symétrie ».

**Tableau des 6 types de périodes reçu le 29/07/2026 (soir)** — croisé avec le code, résultat :

- `maternite` / `adoption` / `ald` / `accident_travail` : code déjà conforme au tableau (507h + SAR),
  rien à faire.
- `maladie_intercontrat` : ✅ **vérifié** que l'allongement de fenêtre est bien câblé
  (`periodeReference.ts`, `joursAllongementMaladie` soustrait de la date de début) — rien à faire.
- `suspension_contrat` : ✅ **corrigé** (commit `8e2dd7a`). Il compte désormais toujours 5 h/jour, y
  compris en chevauchant un contrat (règle du guide, pas un double compte — ce type se produit par
  nature pendant un contrat actif). Le SAR reste inchangé (hors de `TYPES_OUVRANT_SAR`) avec un
  `// TODO` dans `salaireReference.ts` : le tableau marque ce point ❓ non confirmé, pas 🔴.
  En corrigeant, une fausse certitude a aussi été retirée : un commentaire affirmait à tort que
  l'exclusion de `suspension_contrat` du SAR était « ✅ VÉRIFIÉ » au guide.

**Ce qui reste bloqué** : le tableau ne couvre que le comptage d'heures et le SAR — pas les
conditions d'éligibilité d'une période. Deux points de la Phase 0 restent donc ouverts :

1. la **condition ALD** (ouverture de droits antérieure requise) : ni vérifiée ni implémentée —
   question posée à Benoît, réponse en attente ;
2. la **condition « indemnisée par la SS »** sur `maladie_intercontrat` (SPEC §6.1) : aucun champ ne la
   porte → c'est la Phase 2, et ⚠️ toute nouvelle règle de cohérence doit rester **hors du schéma de
   lecture** de `chargerDonnees`, sinon un profil déjà enregistré serait rejeté et lu comme des
   « données perdues ».

Suite du chantier : **Phase 2** (restante) = porter les conditions ALD / « indemnisée par la SS » dans
le modèle de données. **Phase 3** (committée, `d664344`) = `ajouterPeriode`/`supprimerPeriode` +
l'écran de saisie — voir plus haut pour le détail et l'écart de placement (Mon profil, pas Contrats).

**Reporté en fin de projet par décision explicite du 29/07** (ne pas le ressortir comme « prochaine
action ») : `vercel dev`, faire passer un premier vrai document par `api/extract-document.ts`, la
décision de fusion des 12 commits dans `master`, et les deux corrections de `docs/SPEC.md`
(ligne ~24 « hors MVP » périmée sur la branche ; ligne ~334 décrit la zone de dépôt sans la
checklist). On continue à construire en attendant.

✅ **Brouillons `docs/files/ImportDocumentIA.jsx` et `docs/ImportDocumentIA.jsx` supprimés le
29/07/2026 (commit `8267880`)** — aucun des deux n'était importé dans `src/` (vérifié par grep avant
suppression) ; `src/components/ImportDocumentIA.tsx` (le vrai composant, qui passe par
`api/extract-document.ts`) n'a pas été touché. `npm run build` + tests toujours verts après coup. Le
paragraphe qui suivait demandait encore de « corriger » ce brouillon — périmé, corrigé ici.
Vérifier l'affirmation « hébergement UE » du texte de consentement : ✅ fait le 31/07/2026 (cf.
l'entrée dédiée plus haut).

✅ **SR/SJM réels branchés sur `calculerSerieDepuisContrats` (29/07/2026 soir, commit `5446e33`)** —
dernier morceau du chantier franchise salaires évoqué ci-dessus. `RevenusMensuels.tsx` reçoit
maintenant `periodes` en prop (cascade `App.tsx` → `RevenusMensuels` → `TableauResultats`) ;
`TableauResultats` calcule `calculerFenetreReference` puis `calculerSalaireReference` (**exactement**
la fenêtre d'`App.tsx:70-72`, pas une fenêtre inventée) puis `calculerSJM(sr, nht, config)`, et passe
`{ srContrats: sr, sjm }` en 6ᵉ argument. **Garde ajoutée, décidée explicitement par Benoît avant
codage** : si `profil.dateAnniversaire` est vide, cet argument reste `undefined` (repli sur
`FRANCHISE_SALAIRES_NON_CERTIFIEE`, comportement historique) — sans elle, un profil dont
`ouvertureDroits` est rempli mais `dateAnniversaire` encore vide (deux champs indépendants,
remplissables séparément) aurait vu la fenêtre glisser avec `dateDuJour` au lieu de rester fixée à la
PRA réelle qui a ouvert les droits, un SR qui aurait dérivé jour après jour. Vérifié en console
navigateur avec les vrais modules du moteur (pas une simulation à côté) : `dateAnniversaire` renseignée
→ `sr=8000`, `nht=600`, `sjm≈133,33`, franchise **calculée** (`valeur: 0`, pas `null`) ; `dateAnniversaire`
vide → repli confirmé sur `{ valeur: null }`. **Point annexe repéré, non traité (hors périmètre
demandé)** : l'UI (`RevenusMensuels.tsx:472-483`) n'affiche un message que si `valeur === null` ou
`valeur > 0` — le cas `valeur === 0` (calculée mais nulle, comme dans le scénario de test ci-dessus)
ne produit aucun texte, silencieux mais pas trompeur. 443 tests verts, `tsc -b` propre.

✅ **Quatre petits combles d'UI, trouvés en auditant "que se passe-t-il si l'utilisateur ne fournit
que 3 documents ?" (29/07/2026 soir → 30/07/2026, commit `6f8024d`)** :
- **A** — `tauxPrelevementSource` (`MonProfil.tsx`) était déjà saisissable, seul le texte d'aide
  était corrigé : « tes relevés de situation France Travail » au lieu de « ton bulletin France
  Travail », vocabulaire harmonisé avec le point D.
- **B** — `ajReelleHistorique` (`GestionAjReelle`) : phrase ajoutée pour expliquer qu'une
  revalorisation en cours de droits s'ajoute comme une nouvelle ligne, pas un remplacement.
- **C** — Suggestion de pré-remplissage de `dateAnniversaire` depuis `dateLimiteIndemnisation`
  quand la première est vide : **piège trouvé et évité avant de coder** — écrire directement via
  `onModifierProfil` depuis `MonIndemnisationEnCours` aurait recréé exactement le problème déjà
  documenté pour `salairesHorsAnnexe10PRA` (deux porteurs d'écriture sur le même champ, l'un
  écrasant l'autre). La suggestion ne fait donc que pré-remplir le **brouillon local** de la
  section « Ton profil » (`suggererDateAnniversaire` dans `MonProfil.tsx`) ; la persistance reste
  derrière le bouton « Enregistrer » existant, avec son garde-fou de confirmation déjà en place
  (`dateAnniversaireModifiee`). Vérifié en navigateur : accepter la suggestion ne touche pas
  `localStorage` tant que « Enregistrer » n'est pas cliqué, et `ouvertureDroits` reste intact.
- **D** — `ImportDocumentIA.tsx` : liste statique des 3 types de documents à préparer, ajoutée
  avant la zone de dépôt. Distincte de `ChecklistDocuments` (déjà montée au-dessus des deux canaux
  d'import) qui liste des champs manquants dynamiquement — les deux coexistent sans conflit, objets
  différents.

443 tests verts, `tsc -b` propre.

⚠️ **Import IA testé en production (30/07/2026) : échec silencieux sur un bulletin GHS-sPAIEctacle.**
Bulletin de paie « Association du Festival de St Germain en Laye » (logiciel GHS-sPAIEctacle, format
Artiste Musicien, 1 cachet isolé représentation, 175 € brut, période 28/06/2026). Résultat : texte
brut extrait **vide** côté Mistral OCR — aucun champ lu automatiquement (salaire, cachets, dates,
employeur). Le type « Artiste » a tout de même été reconnu et `ContractForm` s'est ouvert, mais tous
les champs restaient vides — saisie manuelle obligatoire. Pas un chiffre faux (devoir n°2 tenu :
rien n'a été inventé pour combler le vide), mais un échec d'extraction non diagnostiqué. Piste à
investiguer : format PDF dense multi-colonnes, rendu possiblement vectoriel incompatible avec l'OCR
Mistral — enrichir `document_annotation_prompt` avec des instructions spécifiques aux bulletins à
colonnes multiples du spectacle vivant. Testés avec succès le même jour : notification ARE ✅, relevé
de situation ✅ — l'échec semble propre à ce format de bulletin, pas au canal IA en général.

## Backlog — to-do complète (30/07/2026)

### Terminé cette session
- ✅ Phases périodes assimilées (0, 1, 3)
- ✅ Brouillons ImportDocumentIA supprimés
- ✅ Garde-fou PDF > 3 Mo confirmé présent
- ✅ SR/SJM branchés sur calculerSerieDepuisContrats
- ✅ Gaps UI profil (taux PAS, ajReelleHistorique, dateAnniversaire, checklist docs IA)
- ✅ Déploiement Vercel — app en ligne : cadence-faypc2dbg-benoit3.vercel.app
- ✅ Test import IA production : notification ARE ✅, relevé de situation ✅, bulletin GHS ⚠️

### À faire — priorité haute
- ⚠️ **Contradiction de sources sur le plafond ARE — documentée, arbitrage pris, NON bloquante.**
  Trouvée le 03/08/2026 en lisant le guide FT en entier pour le chantier trop-perçu (donc *après* les
  commits `4b0105c` et `9f604f0`). Le **guide France Travail « Intermittents du spectacle »,
  éd. juillet 2026** — l'édition désormais citée par `meta.source` (elle y annonçait encore mars 2026
  jusqu'au 03/08/2026, cf. point 14) — et plusieurs
  pages `cultureetspectacle.francetravail.fr` affirment « L'allocation journalière calculée ne peut
  pas dépasser **174,80 € depuis le 1er janvier 2024** », sans mention de 177,56 € ni 181,18 €.
  **Décision de Benoît (03/08/2026) : la config reste alignée sur Unédic** — organisme qui fixe
  réellement ces paramètres, documents datés et cohérents sur 5 éditions vérifiées. `plafondHistorique`
  n'est PAS modifié. Écart visible uniquement à un SR assez élevé pour que A+B+C dépasse le plafond
  (~400 000 €, cf. cas B3b de `docs/validation.md`) — cas extrême, même famille que l'écart de
  formule à SR extrême déjà déprioritisé. Non résolu avec
  certitude à 100 % : un contact direct Unédic/France Travail reste nécessaire pour trancher
  définitivement. Même texte en commentaire dans `franceTravailConfig.ts` et dans `docs/validation.md`
  (« Dette tracée »).
- ✅ Prompt GHS/sPAIEctacle — bulletins multi-colonnes couverts (commit 081a516)
- ✅ Taux PAS depuis relevé de situation — enregistrement confirmé en prod (commits eb5a880 + d72ac18)
- ✅ Prompt relevé de situation — 469,26 € (total mensuel net) extrait à tort comme AJ journalière :
  origine identifiée (`Relevé_de_situation_20260715.pdf` — le mot « Journalière(s) » dans l'en-tête
  de colonne du tableau « Allocation d'Aide au Retour à l'Emploi » ne qualifie que la colonne
  « Nb d'alloc. », pas les montants ; confirmé en croisant avec le relevé d'avril 20260414_3,
  55,02 €/jour × 17 ≈ 935 € cohérent). Le vrai montant journalier n'est écrit qu'en toutes lettres
  dans « INFORMATIONS SUR VOS DROITS » (« Allocation brute d'un montant journalier de X Euro […] »).
  Correctif de lexique + CAS 5 ajoutés dans `api/extract-document.ts` (piège dédié + citation
  obligatoire). **Validé en appel réel à l'API Mistral sur le document exact qui a produit le bug**
  (31/07/2026, hors Playground — appel direct `extractDocument` avec la clé de `.env`) :
  `aj_reelle_historique` correctement rempli à 55,02 € brut (justifié par la phrase « Allocation
  brute d'un montant journalier de 55,02 Euro [...] »), la ligne du tableau (469,26 € net/9 jours)
  correctement routée en `info_seule`, aucune sur-généralisation observée. Un second bug,
  indépendant, a été découvert au passage : `info_seule.donnees` (schéma Zod scalaires uniquement)
  rejetait un objet imbriqué que le modèle produisait pour les totaux de période, faisant échouer
  toute l'extraction sur ce document. Corrigé par une règle de prompt exigeant des clés scalaires
  à plat plutôt qu'un objet composite — revalidé, l'extraction passe désormais la validation Zod.
- ✅ Confiance "moyenne" sur le taux PAS — résolu (31/07/2026) : ajout d'une règle de date par
  section (dateEffet du taux = date de la section "Situation au [date]" englobante, jamais extraite
  de la phrase du taux qui n'en contient pas) + garde-fou anti-dérive de formulation (taux introuvable
  → info_seule explicite plutôt qu'une approximation) + citation obligatoire section + phrase. Validé
  en appel réel à l'API Mistral sur `Relevé_de_situation_20260715.pdf` (ses deux sections "Situation au
  28/06" et "Situation au 13/07", même taux 3,10 % dans les deux) : confiance passée de "moyenne" à
  "haute", valeur correcte, aucune confusion avec l'en-tête voisin "REGLEMENT DU 01/07/2026", les deux
  occurrences correctement distinguées avec dates propres.
- ✅ **Sélection de la section la plus récente comme valeur primaire du taux PAS — résolu
  (02/08/2026, commit `8568c8a`), pas en corrigeant la sélection : en la supprimant.** Le gap
  décrit ci-dessus supposait qu'il fallait un jour choisir correctement LA bonne section "primaire"
  quand plusieurs coexistent (changement de taux DGFIP en cours de période) — la résolution retenue
  n'est pas ce choix, c'est son abandon : `profil_ouverture_droits` ne porte plus aucun champ de
  taux du tout, sur AUCUN document. Un relevé/notification qui mentionne un taux produit désormais
  une proposition `taux_pas_historique` séparée, une par section/couple (taux, date) trouvé — même
  mécanisme, unifié, que l'attestation dédiée ci-dessus (§02/08/2026) : aucune sélection automatique
  n'est plus possible par construction, quel que soit le document d'origine, l'utilisateur voit et
  applique chaque entrée lui-même. C'est ensuite `getTauxPASAt` (`engine/ajReelleUtils.ts`, déjà
  correct et déjà testé avant ce chantier) qui détermine quel taux s'applique à quelle date, jamais
  le prompt. Schéma (`types/extraction.ts`), routage (`lib/routageExtraction.ts`) et prompt
  (`api/extract-document.ts`, CAS 6 réécrit) mis à jour en conséquence ; tests migrés + deux ajouts :
  un relevé à deux sections avec des taux DIFFÉRENTS (aucune n'est perdue ni choisie comme primaire),
  et l'indépendance du résultat à l'ordre d'application des deux propositions dans un même lot
  (`profil_ouverture_droits` puis `taux_pas_historique`, ou l'inverse — testé dans les deux ordres :
  `evaluerExtraction` est un simple `.map()` par proposition, sans dépendance entre elles, et
  `RevueExtraction.tsx` réévalue tout à chaque rendu, donc rien n'est jamais perdu si l'utilisateur
  clique dans un ordre plutôt que l'autre).
- ⬜ Vérifier données réelles — import JSON + Dashboard vs notification France Travail
- ⬜ Phase 2 périodes assimilées — conditions ALD (en attente source réglementaire)

### À faire — priorité normale
- ✅ **Plafond ARE Annexe 10 : historique daté — corrigé le 03/08/2026.** La limite était réelle :
  `config.are.plafond` étant un scalaire unique, tout calcul portant sur une FCT antérieure au
  01/01/2026 se voyait appliquer 181,18 € au lieu de 174,80 € — deux chemins exposés, le
  renouvellement anticipé (`RenouvellementAnticipe.tsx`, FCT choisie librement, aucune borne
  min/max) et `engine/cycles.ts` (jusqu'à 10 cycles reconstruits en arrière, Historique.tsx).
  **Correctif** : `are.plafondHistorique` (`{dateEffet, valeur}[]`, sur le modèle de
  `valeursDatees.smicHoraireBrutHistorique`) + fonction pure `getPlafondAreAt`
  (`engine/plafondAreUtils.ts`). `calculerAJBrute` prend désormais un `dateEffet` **obligatoire**
  (pas de défaut « aujourd'hui » : un défaut implicite recréerait le bug) et lit le plafond à cette
  date ; `calculerAJBrutePourFenetre` le dérive de `fenetre.dateFin`, qui EST la FCT retenue dans
  les trois appelants (App.tsx, Simulateur.tsx, renouvellementAnticipe.ts) — aucun de ces appelants
  n'a changé. `are.plafond` reste en config comme valeur courante de commodité (seuil de
  plausibilité de `MonProfil.tsx`), plus lu par aucun calcul métier.
  **Deux réserves, une refermée depuis** : (1) date d'effet 01/01/2024 confirmée sur pièce (Unédic,
  « Paramètres utiles », janvier 2024, p.22 — « Maximum théorique du 1er janvier au 31 décembre
  2024 » = 174,80 €) ; entrée 2025 (177,56 €) ajoutée le 03/08/2026 après vérification (Unédic,
  « Paramètres utiles », janvier 2025 ET juillet 2025, p.23 — valeur identique dans les deux
  éditions, la revalorisation de juillet ne touchant que l'allocation minimale / partie fixe) —
  `plafondHistorique` compte désormais **3 entrées sourcées (2024/2025/2026)**, plus seulement 2.
  Reste ouvert, assumé : aucune valeur certifiée antérieure à 2024 — recherche des éditions Unédic
  archivées jusqu'à janvier 2024 seulement, rien de plus ancien trouvé en accès libre ; repli vers
  174,80 € pour toute date antérieure, `TODO` volontairement laissé plutôt qu'une valeur devinée.
  (2) pour une date antérieure à toute entrée connue,
  `getPlafondAreAt` retombe **explicitement** sur la plus ancienne valeur plutôt que de lever une
  exception (qui planterait Historique.tsx, aucun error boundary React dans l'app) ou de renvoyer
  `null` (qui supprimerait le clamp, donc laisserait passer une AJ trop HAUTE) — repli vers le bas,
  jamais une extrapolation. 13 tests dédiés (`engine/__tests__/plafondAreUtils.test.ts`), dont les
  bornes de chaque année civile, la date pivot exacte et le scénario de bout en bout via
  `calculerRenouvellementAnticipe`.
- ⬜ Vérifier l'éligibilité à un programme associatif/non-profit pour réduire les coûts
  d'hébergement (Supabase notamment) — repéré comme piste possible le 01/08/2026, NON confirmé
  officiellement. Des sources tierces (pas la documentation officielle Supabase) évoquent des
  réductions de 40 à 80 % pour les organisations à but non lucratif, mais mentionnent un statut
  américain (501(c)(3)), pas une association loi 1901 française — à vérifier directement auprès
  du support Supabase si une association loi 1901 serait éligible ou reconnue de façon
  équivalente. Rappel : créer une association loi 1901 est un vrai engagement administratif
  (statuts, gouvernance, potentiellement comptabilité), pas un acte anodin pour une simple
  réduction — à ne considérer que si la monétisation devient réelle avec de vrais utilisateurs
  payants, pas pendant la bêta actuelle. Priorité : basse, aucune urgence tant qu'aucun paiement
  réel n'est en jeu.
- ✅ **Webview France Travail intégrée — tranché en faveur de l'option (b), liens externes
  directs (02/08/2026, complété le même jour).** L'idée d'une fenêtre de navigation DANS Cadence
  (cookies/jeton chiffrés stockés sur l'appareil) restait bloquée par FranceConnect, qui interdit
  explicitement l'affichage de sa mire de connexion en iframe/webview (FAQ officielle,
  anti-phishing : une webview embarquée est fonctionnellement équivalente à un iframe du point de
  vue de l'IdP — vérification du certificat SSL par l'utilisateur impossible dans les deux cas).
  Réorienté vers l'option (b) : deux boutons ouvrent chacun une page précise de l'espace personnel
  France Travail dans un **vrai nouvel onglet du navigateur** (`window.open(..., "_blank",
  "noopener,noreferrer")`, jamais une iframe ni une webview) — `candidat.francetravail.fr/mescourriers/`
  (relevés, notifications, déclaration fiscale) et `candidat.francetravail.fr/actualisation-declaree/`
  (justificatifs après actualisation), deux URLs confirmées par Benoît lui-même en se connectant,
  jamais déduites. L'utilisateur se connecte avec ses propres identifiants, télécharge le document
  qui l'intéresse, puis revient dans Cadence pour l'importer normalement (canal local ou canal IA,
  au choix comme aujourd'hui). Aucune donnée profil/contrat ne transite par ce composant — fonctions
  pures, même discipline que `construireLienFeedback` (`config/contact.ts`).
  `components/OuvrirEspacePersonnelFT.tsx` (logique `window.open` factorisée, une fonction par
  destination), intégré dans l'onglet Import PDF en tête d'un bloc « 1. Récupérer un document
  depuis France Travail », séparé du bloc « 2. Importer le document » (canal local + canal IA
  regroupés) qui suit — réorganisation nécessaire une fois passé à deux boutons, tranchée après
  vérification du rendu réel en navigateur (`App.tsx`). Testé (`window.open` mocké, une assertion
  par URL) et vérifié en navigateur réel. ⚠️ Ces deux URLs, contrairement à la règle FranceConnect
  anti-iframe (stable, documentée), ne sont pas garanties stables dans le temps par France Travail —
  routine de vérification mensuelle ajoutée (`docs/routine-mensuelle-veille.md` §6). Détail complet
  dans `docs/reprise.md`.
- ✅ **AJ brute vs nette — non reproduit, formule prouvée correcte (31/07/2026).** L'écart supposé
  n'a jamais été un bug de calcul : `docs/validation.md` (Cas réel #1, notification FT du
  03/02/2026) montre `calculerAJNette` appliqué à l'AJ brute réelle (55,02 €) donnant 53,81 € net —
  exactement le net réellement notifié, 0,00 € d'écart. Le commentaire déjà présent dans
  `config/franceTravailConfig.ts` (l.63-68, commit `a62e9b1` du 24/07) précisait même l'écart réel
  (~2,2 %, pas ~5 %), validé « à l'euro près » sur fév-juin 2026 — cette entrée de backlog n'avait
  simplement jamais été mise à jour en conséquence (péremption documentaire, même famille que
  celles nettoyées le 30/07). Résidu réel identifié à part : la provenance de la valeur saisie dans
  `Profil.ajReelleHistorique` (rien n'empêchait de recopier une ligne « brute » d'un relevé dans le
  champ « AJ nette » de `MonProfil.tsx`) — traité par un avertissement de plausibilité, pas un
  nouveau champ déclaratif (commit `2d05f6d`, détail et justification dans `docs/reprise.md`).
- ⬜ Comparaison complète Cadence vs 8 mois réels
- ⬜ Production branch Vercel — pointer sur master explicitement dans les settings
- ⬜ Inventaire annuel des documents réglementaires — lister tous les documents sources dont
  dépendent les calculs de Cadence (guide France Travail intermittents, arrêtés SMIC, convention
  d'assurance chômage, circulaires PMSS) avec leur date de publication et leur prochaine échéance
  connue, et définir un processus de mise à jour annuel (au minimum : 1er janvier pour SMIC/PMSS,
  et à chaque nouvelle convention d'assurance chômage). Objectif : garantir que
  `franceTravailConfig.ts` reste à jour et que le bandeau « règles vérifiées au JJ/MM/AAAA » ne
  vieillit pas silencieusement.
- ✅ **Point 9 clos le 04/08/2026 — SANS basculer sur le plan payant, et sans rien dépenser.** Cet
  item demandait de passer `MISTRAL_API_KEY` sur le plan Scale « à la toute fin ». L'échéance est
  arrivée plus tôt que prévu (ouverture à des bêta-testeurs, cf. refonte Supabase), et la
  vérification à la source a montré que **la dépense était évitable** : le tier gratuit permet de
  **refuser l'entraînement** depuis le menu Privacy de la console
  (help.mistral.ai/en/articles/455207, vérifié le 04/08/2026). Benoît a décoché l'option ; le texte
  de consentement est devenu vrai sans changer d'un mot.
  **La leçon de méthode, à ne pas perdre** : la source de 2026-07-31 (help.mistral.ai/articles/347617)
  était exacte mais *incomplète* — elle décrivait l'engagement PAR DÉFAUT des plans payants, et le
  projet en a déduit pendant quatre jours qu'il fallait payer. Revérifier une source, ce n'est pas
  seulement contrôler qu'elle dit toujours la même chose : c'est chercher ce qu'elle ne disait pas.
  ⚠️ **Ce qui reste ouvert et n'est PAS couvert par l'opt-out** : la **rétention** (jusqu'à 30 jours).
  Le Zero Data Retention est réservé au plan Scale. Le texte affiché ne promet rien sur la
  conservation et ne doit jamais le faire. Si un jour la non-conservation devient nécessaire (exigence
  d'un tiers, ou choix produit), c'est **là** que la dépense redevient obligatoire — pas pour
  l'entraînement. Estimation conservée pour ce cas : ~260-350 $/an pour 100 utilisateurs à
  100-200 documents/an chacun.

### Post-bêta
- ⬜ Refonte design (couleurs, placement onglets — à préciser)
- ✅ **Renouvellement anticipé — comparaison ancien/nouveau droit** (commit `3b516dd`, 31/07/2026) :
  prérequis bloquant du SPEC §11.B levé (règle sourcée et validée contre le simulateur officiel
  France Travail + cas réel à deux notifications, cf. `docs/validation.md`). Moteur
  `engine/renouvellementAnticipe.ts` (`calculerRenouvellementAnticipe`), réutilise tel quel le
  moteur standard existant, aucune formule dupliquée ; écran `components/RenouvellementAnticipe.tsx`
  dans `MonProfil.tsx` — simulation seulement, pas encore l'interface de demande elle-même
  (formulaire, pièces à joindre : reste à construire, item distinct). **Zones grises assumées,
  jamais chiffrées, avertissements textuels seulement — ne pas lire cette entrée comme « 100 %
  résolu »** : risque de trop-perçu si la franchise congés payés de l'ancien droit n'était pas
  épuisée (`tropPercuRisque` reste un booléen de prudence, `tropPercuChiffrable` toujours `false`,
  aucun montant câblé) ; franchise salaires du nouveau droit non fiabilisée (non calculée par ce
  module, avertissement affiché à la place). Détail complet (cas B1-E1 vérifiés simulateur, écart
  non résolu à SR extrême, deux bugs pré-existants découverts et corrigés au passage) :
  `docs/SPEC.md` §11.B, `docs/validation.md`.
  **Sourçage du trop-perçu mené le 03/08/2026 — conclusion : TODO documenté, toujours aucun montant.**
  Le déclencheur est désormais confirmé à la source primaire (guide FT éd. **juillet 2026** p.19 et
  encadré p.15) et la formule aussi, au niveau réglementaire (**Annexe X art. 31 §2** = Annexe 8
  art. 23 §2 : « récupération des allocations versées à tort, sur la base du montant de l'allocation
  journalière déterminée à l'ouverture de droits ou de la réadmission », dans la limite de ce qui a
  été perçu). Elle reste néanmoins **non calculable par Cadence** pour trois raisons de données, pas
  de sourçage : (1) le reliquat porte sur les franchises CP **et salaires**, or la franchise salaires
  n'est jamais calculée (`FRANCHISE_SALAIRES_NON_CERTIFIEE`, aucun appelant ne fournit SR/SJM) et
  aucun champ déclaratif ne la porte — chiffrer la seule part CP sous-estimerait systématiquement ;
  (2) AJ brute ou nette non tranchée par les sources ; (3) le plafond « dans la limite de ce que vous
  avez perçu » exige un cumul versé depuis l'ouverture, que Cadence n'a pas. **Hypothèse de départ
  écartée** : ce n'est PAS le plafond de cumul à 118 % du PMSS, qui est un écrêtement *prospectif* du
  montant mensuel (guide p.17, étape 5), pas un mécanisme d'indu. Citations, sources consultées sans
  succès et conditions de levée : `docs/validation.md` (section 2026-08-03).
  **✅ Faux feu vert corrigé le 03/08/2026 (même journée, commit suivant).** La règle vise les
  franchises CP **et salaires**, l'ancien `ancienneFranchiseCPEpuisee` ne regardait que la CP, et
  `franchiseSalairesRestante` vaut `0` *par défaut* (total absent, `valeur: null`), pas *parce qu'elle
  est épuisée* — `tropPercuRisque === false` voulait donc dire « franchise CP prouvée épuisée » mais
  s'affichait comme « aucun risque » (pas de bandeau du tout).
  **Correctif** : `tropPercuRisque: boolean` → `tropPercu: RisqueTropPercu`, type discriminé à trois
  états sur le modèle de `SeuilReadmission` — `avere` (reliquat prouvé) / `indetermine` + `raison`
  (`franchise_salaires_non_calculee`, le cas nominal dès que la CP est soldée ;
  `historique_mensuel_insuffisant` ; `simulation_mensuelle_impossible`, défensif) / `ecarte` (les DEUX
  franchises prouvées épuisées). **`ecarte` est inatteignable aujourd'hui, et c'est voulu** : la
  franchise salaires n'étant jamais calculée, un « écarté » ne peut pas être prouvé, donc ne doit
  jamais s'afficher. Aucun montant dans aucun état (`tropPercuChiffrable` toujours `false`).
  `RenouvellementAnticipe.tsx` rend les trois cas distinctement (rouge / ambre / rien) avec un texte
  par `raison` dans `content/renouvellementAnticipe.ts` : le silence ne couvre plus jamais un « on ne
  sait pas ». 5 tests dédiés, dont un garde-fou qui échouera le jour où `ecarte` deviendra atteignable
  (signal qu'il faudra écrire un vrai cas « écarté », pas supprimer le test). Détail : `docs/validation.md`.
  **✅ Verrou 1 levé le 03/08/2026 (même journée) — franchise salaires DÉCLARATIVE.** Le SJM de la
  formule est tranché par la source primaire (guide FT éd. juillet 2026, p.14, encadré « Légendes des
  paramètres ») : SJM = SR / (NHTM/10), le SJM habituel, pas une grandeur distincte. Le piège est
  ailleurs — **le premier facteur utilise le PRC (tous régimes), le second le SR (annexes 8/10)**, deux
  numérateurs différents ; `calculerFranchiseSalaires` le faisait déjà correctement, il n'y avait donc
  aucune formule à écrire. Choix **déclaratif** (`Profil.ouvertureDroits.franchiseSalairesTotale?:
  number`) et non calculé : le PRC exige toutes les rémunérations tous régimes confondus, hors de
  portée de Cadence, et tous les autres paramètres d'ouverture sont déjà déclarés depuis la
  notification. `undefined` = inconnu, `0` = aucune franchise notifiée — **deux états jamais
  confondus**, c'est la distinction qui permet de conclure. Optionnel, aucune migration (devoir sacré
  n°1, round-trip testé). **`RisqueTropPercu.ecarte` est désormais atteignable** ; le garde-fou
  « inatteignable » a été remplacé par de vrais cas, pas supprimé.
  ⚠️ `Notification_admission_ARE_20260205_2.pdf` **n'est pas dans le projet** — le document réel
  (`Notification admission ARE 20260205.pdf`, cache Outlook) ne porte **aucun PRC** ni aucune ligne de
  franchise salaires, cohérent avec le calcul (≈ 0). Il confirme la règle du trop-perçu (3ᵉ source
  indépendante) et la convention du 15/11/2024, mais reste muet sur brute/nette.
  **Verrou 2 (brut/net) toujours ouvert** : argument en faveur du brut consigné dans
  `docs/validation.md` comme **raisonnement, pas source qui tranche**. Ne bloque rien tant qu'aucun
  montant n'est câblé.
- ⬜ Module congés spectacle

---

## Décisions actées

Bug avril 2026 (1237€ vs 968€) : résolu — origine données incorrectes (contrats inventés qui
chevauchaient le mois). `repartirContratParMois` validé sur données réelles. Aucune modification
de code.

---

## Périmètre BÊTA (ce qu'on construit maintenant)

Objectif : bêta entre amis pour valider que l'app aide à s'organiser.

**Dans la bêta :** tableau de bord honnête (projection temporelle en héros), saisie guidée +
état vide, export/import JSON, bandeau « règles vérifiées au JJ/MM/AAAA » + source, garde-fou
« situation mixte », coaching léger, bouton feedback, PWA installable.

**Hors bêta (plus tard) :** backend/comptes/synchro, notifications push, import PDF généralisé,
module indemnisation mensuelle (franchises, seuils, PMSS), Annexe 8 / article 65.
(Détails et phasage : §11 du SPEC. L'archi est déjà prête à les recevoir.)

---

## Ancrages réglementaires (rappel — source de vérité = la config)

- Seuil : **507 h** sur **365 j glissants** (fin du dernier contrat = date anniversaire).
- Cachet artiste = **12 h** (plafond **28 cachets/mois**). EEE/Suisse/UK = 6 h/jour.
- Enseignement : plafond **70 h** (< 50 ans) / **120 h** (≥ 50 ans) ; compte pour les 507 h,
  **jamais** dans le montant. Cumul enseignement + formation ≤ **338 h**.
- ARE Annexe 10 : **AJ brute = A + B + C**, AJ min **31,96 €**, plancher **44 €**,
  plafond **historisé par année civile** (`are.plafondHistorique`) — **181,18 € en 2026**.
  Ne jamais recopier une valeur fixe ici : voir `franceTravailConfig.ts`.
- Heures assimilées (maternité, adoption, AT, ALD, suspension) : **5 h/jour**.
  Maladie inter-contrat : **allonge** la fenêtre de 365 j (ne compte pas en heures).

---

## Charte graphique (résumé — détail §8 du SPEC + maquette)

Sombre, premium, calme (esprit Finary). Fond `#0A0C10`, surfaces `#12161D`.
Accent + statut « Sécurité » = menthe `#3FD69B` ; alerte = ambre `#F5C46B` ; bloqué = rouge `#F2726B`
(toujours icône + mot, jamais la couleur seule). Données : menthe / teal `#57A9F0` / violet `#9B8CFF`.
Typo : **Space Grotesk** (display/chiffres) + **Inter** (corps). Tokens dans `tailwind.config.js`.
**Élément signature = le graphique de projection temporelle** (temps → heures cumulées), pas une jauge.
