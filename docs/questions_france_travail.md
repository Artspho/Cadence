# Questions à poser à France Travail — courrier prêt à envoyer

**Rédigé le 06/08/2026, élargi le même jour à la demande de Benoît** (« TOUTES les incertitudes, pour
en finir avec les zones grises »). La première version ne posait que 6 questions ; le ratissage complet
du dépôt en a fait remonter **16**.

Chacune correspond à un endroit où Cadence, aujourd'hui, soit applique un **choix par défaut assumé**,
soit **renonce à calculer** et le dit à l'écran. Aucune valeur n'est inventée — mais un choix par
défaut n'est pas une réponse, et c'est précisément ce que ce courrier vient chercher.

## ⚠️ Avant d'envoyer, trois choses à savoir

**1. Le courrier est long.** Seize questions dans un seul e-mail, c'est beaucoup pour un conseiller.
Deux stratégies possibles :
- **En rendez-vous** : imprime-le et déroule-le point par point, c'est le plus efficace ;
- **Par écrit, en deux fois** : envoie d'abord les sections **A** et **C** (montants et carences — ce
  sont celles qui changent des chiffres affichés), puis les autres.

**2. Deux questions NE SONT PAS pour France Travail** — je les ai exclues exprès :
- la **durée d'amortissement d'un instrument de musique** (`franceTravailConfig.ts:220`, 5 ans
  actuellement) : le BOFIP donne des durées pour l'informatique et le mobilier, pas pour l'instrument.
  → service des impôts ou expert-comptable ;
- l'**ordre de consommation** (différé → délai d'attente → franchise CP → franchise salaires) : déjà
  confirmé par **deux** sources concordantes (Annexe X au règlement du 15/11/2024 art. 23 §1er, et
  guide FT p.12). Ne pas le redemander : ça userait la bonne volonté du conseiller sur un point acquis.

**3. Une réponse orale n'est pas une source citable.** Chaque valeur réglementaire du projet porte sa
source en commentaire (`✅ arrêté du 22 mai 2026`, `✅ Unédic « Paramètres utiles » avril 2026 p.3`).
Demande un écrit, ou note explicitement qu'il s'agit d'un propos rapporté et non d'une référence.

## Où chaque réponse atterrira

| # | Question | Fichier concerné |
|---|---|---|
| 1 | Plafond de l'allocation journalière | `src/config/franceTravailConfig.ts:82` et `:102` |
| 2 | Plafonds antérieurs au 01/01/2024 | `src/config/franceTravailConfig.ts:98` |
| 3 | Plancher d'écrêtement CSG/CRDS | `src/config/franceTravailConfig.ts:132` |
| 4 | SMIC journalier de la franchise | `src/config/franceTravailConfig.ts:272` et `:289` |
| 5 | Cachets au-delà de 28 par mois | `src/engine/decompteHeures.ts`, `src/engine/decoupageMensuel.ts` |
| 6 | Contrat à cheval sur deux mois | `src/engine/salaireReference.ts:34`, `src/engine/decompteHeures.ts:140` |
| 7 | Bornes de la période de référence | `src/engine/periodeReference.ts:95` |
| 8 | Délai d'attente au renouvellement | `src/engine/renouvellementAnticipe.ts:232` |
| 9 | Reliquats de franchises à la réadmission | `src/engine/renouvellementAnticipe.ts:237` |
| 10 | Franchise salaires d'un nouveau droit | `src/content/renouvellementAnticipe.ts:25` |
| 11 | Report du forfait mensuel de franchise CP | `src/engine/indemnisationMensuelle.ts:106` |
| 12 | Différé d'indemnisation spécifique | `src/engine/indemnisationMensuelle.ts:20` |
| 13 | Salaires hors Annexe 10 dans le SR | `src/engine/indemnisationMensuelle.ts:409` |
| 14 | Périodes assimilées et SAR | `src/engine/salaireReference.ts:19` |
| 15 | Réadmission allongée (fenêtre > 365 j) | `docs/validation.md:24` |
| 16 | Montant d'un trop-perçu | `src/engine/renouvellementAnticipe.ts:12` |

---

## Courrier

> **Objet : Demande de précisions sur le calcul des droits en Annexe 10 (artiste du spectacle)**
>
> Madame, Monsieur,
>
> Je suis artiste intermittent du spectacle, indemnisé au titre de l'Annexe 10. Afin de suivre
> précisément mes droits et de vérifier mes propres calculs, j'ai réuni ci-dessous l'ensemble des
> points sur lesquels la documentation que j'ai consultée reste ambiguë, muette, ou sur lesquels deux
> sources officielles ne concordent pas.
>
> La liste est longue, et je vous prie de m'en excuser. Elle est le fruit d'un travail de plusieurs
> mois, et je préfère vous la soumettre d'un bloc plutôt que de vous solliciter à répétition. Si cela
> vous convient mieux, je suis à votre disposition pour un rendez-vous afin de les reprendre ensemble,
> ou pour vous les adresser en plusieurs fois. À défaut de réponse détaillée, l'indication du texte de
> référence qui tranche chaque point me serait déjà d'une grande aide.
>
> ### A. Montants et plafonds
>
> **1. Plafond de l'allocation journalière — deux montants différents selon la source.**
> Le guide France Travail que j'ai consulté indique que l'allocation journalière ne peut pas dépasser
> **174,80 €** depuis le 1er janvier 2024. La publication « Paramètres utiles » de l'Unédic (édition
> avril 2026) indique **181,18 €**, après deux revalorisations successives (174,80 € puis 177,56 € puis
> 181,18 €). Quel est le montant applicable aujourd'hui, et à quelle date chaque valeur a-t-elle pris
> effet ? Le montant du guide correspond-il à une valeur non actualisée ?
>
> **2. Valeurs de ce plafond antérieures au 1er janvier 2024.**
> Existe-t-il un historique publié de ce plafond avant cette date ? J'en ai besoin pour vérifier des
> périodes anciennes.
>
> **3. Plancher d'écrêtement des cotisations CSG/CRDS.**
> Le simulateur officiel fait apparaître un plancher d'écrêtement de **62,00 €** par jour. Si je le
> recalcule à partir du SMIC horaire brut (12,31 € × 35 / 7), j'obtiens **61,55 €** — un écart de
> 0,45 € que je n'explique pas. Quelle est la formule ou la valeur officielle exacte de ce plancher, et
> comment est-il arrondi ?
>
> **4. « SMIC journalier » utilisé pour la franchise salaires.**
> Le calcul de la franchise fait intervenir un « SMIC journalier ». Comment se détermine-t-il
> exactement ? S'obtient-il en multipliant le SMIC horaire brut par 7 heures, ou une autre convention
> s'applique-t-elle (base différente, arrondi particulier, montant publié directement) ?
>
> ### B. Décompte des heures et affiliation aux 507 heures
>
> **5. Cachets au-delà de 28 dans un même mois.**
> L'Annexe 10 retient un maximum de 28 cachets par mois. Si je réalise par exemple 30 cachets au cours
> d'un même mois, les 2 cachets excédentaires sont-ils **totalement écartés** du décompte des 507 heures
> servant à l'affiliation, ou ce plafond n'a-t-il qu'une autre portée (par exemple le calcul de
> l'allocation) ? Et dans le cas d'un mois incomplet — une période d'emploi ne couvrant qu'une partie du
> mois — ce plafond de 28 est-il proratisé au nombre de jours, ou s'applique-t-il en entier ?
>
> **6. Contrat à cheval sur deux mois civils.**
> Lorsqu'un contrat commence dans un mois et se termine dans le suivant, est-il rattaché en **totalité
> au mois de sa date de fin**, ou réparti entre les deux mois au prorata ? La réponse change à la fois
> le décompte des heures et le salaire de référence, notamment pour un contrat situé à la limite de la
> période de référence.
>
> **7. Bornes de la période de référence.**
> Un contrat dont la fin tombe **exactement le premier jour** de la période de référence, ou
> **exactement le dernier**, est-il retenu ou écarté ? Ces bornes sont-elles inclusives ou exclusives ?
>
> ### C. Carences, différés et franchises — notamment en cas de renouvellement
>
> C'est la section qui me préoccupe le plus, parce qu'elle détermine les **premiers jours non
> indemnisés** après une nouvelle ouverture de droits.
>
> **8. Délai d'attente lors d'un renouvellement.**
> Le délai d'attente de 7 jours s'applique « une fois par période de 12 mois ». Lors d'un
> renouvellement — en particulier un **renouvellement anticipé** — trois choses me manquent :
> - ce délai se **réapplique-t-il** au nouveau droit ?
> - la période de 12 mois se compte-t-elle depuis la **date d'ouverture du droit précédent**, ou depuis
>   une autre date (dernier jour indemnisé, fin de contrat de travail retenue…) ?
> - si moins de 12 mois se sont écoulés, le délai est-il **entièrement supprimé**, ou appliqué au
>   **prorata** du temps restant ?
>
> **9. Reliquats de franchises de l'ancien droit lors d'une réadmission.**
> S'il reste, au moment de la réadmission, une franchise de congés payés ou une franchise salaires
> **non entièrement consommée** sur le droit précédent, ce reliquat est-il :
> - **reporté** et consommé sur le nouveau droit,
> - **remis à zéro**,
> - ou consommé selon une autre règle ?
>
> **10. Franchise salaires sur un droit issu d'un renouvellement anticipé.**
> Comment se calcule-t-elle dans ce cas précis ? Repart-elle des salaires de la nouvelle période de
> référence, y a-t-il un mécanisme particulier lorsque l'ancien droit n'était pas épuisé ?
>
> **11. Report du forfait mensuel de franchise congés payés.**
> La franchise de congés payés semble plafonnée par un forfait mensuel (de l'ordre de 2 ou 3 jours
> selon le total accordé à l'ouverture). Si ce forfait n'est pas intégralement consommé un mois donné —
> par exemple parce que le délai d'attente a absorbé les jours disponibles — le solde **se reporte-t-il**
> sur le mois suivant, en s'ajoutant au forfait de ce mois ? C'est ce que mes relevés de janvier et
> février 2026 semblent montrer (4 jours consommés en février), et j'aimerais en être certain.
>
> **12. Différé d'indemnisation spécifique.**
> Le guide indique que ce différé, lié aux indemnités de rupture, est « rarement appliqué » aux
> intermittents employés sous CDD d'usage. Puis-je considérer qu'il ne s'applique **jamais** dans ce
> cadre, ou existe-t-il des situations où il intervient malgré tout ?
>
> ### D. Salaire de référence
>
> **13. Salaires perçus hors Annexe 10.**
> Le guide précise que le salaire de référence retient les salaires de la période de référence « quel
> que soit le régime de l'activité ». Cela signifie-t-il que des salaires perçus **hors** Annexe 10
> (par exemple une activité d'enseignement au régime général) entrent bien dans ce salaire de
> référence — alors qu'ils sont, si je comprends bien, exclus du décompte des heures ?
>
> **14. Périodes assimilées ouvrant un aménagement du salaire de référence.**
> Certaines périodes non travaillées sont prises en compte. Lesquelles ouvrent droit à un
> **aménagement du salaire de référence** (et non seulement à un allongement de la période de
> référence) ? Le congé maternité, le congé d'adoption et une affection de longue durée semblent
> concernés ; qu'en est-il d'une **suspension du contrat de travail** ? Et pour l'affection de longue
> durée, quelles conditions exactes doivent être réunies (durée minimale, justificatif attendu) ?
>
> ### E. Deux points de calcul que je n'ai pu vérifier nulle part
>
> **15. Réadmission avec période de référence allongée (au-delà de 365 jours).**
> Lorsque la période de référence est allongée du fait de périodes assimilées, le simulateur officiel
> ne semble pas modéliser cet allongement. Pourriez-vous me confirmer la règle appliquée, ou m'indiquer
> comment vérifier un tel cas ?
>
> **16. Calcul du montant d'un trop-perçu en cas de renouvellement anticipé.**
> Je comprends dans quelles situations un trop-perçu peut naître lors d'un renouvellement anticipé.
> Comment son **montant** est-il déterminé en pratique — sur quelle assiette, sur quelle période, et
> les jours déjà indemnisés au titre de l'ancien droit sont-ils recalculés au nouveau taux ?
>
> ### F. Demande de documents
>
> Afin de comparer mes calculs à vos décomptes réels, pourriez-vous m'adresser, ou m'indiquer où les
> retrouver dans mon espace personnel :
>
> - les **justificatifs de mes déclarations mensuelles** depuis mars 2025, faisant apparaître le nombre
>   d'heures retenues pour chaque mois ;
> - la **notification d'ouverture de droits** de mars 2025 ;
> - un **relevé de situation** à jour ;
> - si possible, un décompte détaillé faisant apparaître le **délai d'attente, la franchise congés
>   payés et la franchise salaires** consommés mois par mois — ce sont ces lignes qui me permettraient
>   de valider le point 11.
>
> Je vous remercie très sincèrement du temps que vous consacrerez à ces précisions.
>
> Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations respectueuses.
>
> *[Nom, prénom]*
> *Identifiant France Travail : [à compléter]*

---

## Quand les réponses arrivent — par ordre de gravité

**Ne rien coder avant d'avoir la réponse écrite, et la citer avec sa date.**

### Réponses qui changeraient un chiffre déjà affiché à l'utilisateur

- **Question 5 (cachets > 28)** — la plus grave. Si les cachets excédentaires sont écartés de
  l'affiliation, Cadence **surcompte** aujourd'hui les heures d'un mois très chargé et peut afficher un
  « Sécurité » qui n'est pas acquis : c'est le devoir sacré n°2 en jeu. Les mois de Benoît plafonnent à
  20 cachets, donc aucun effet sur ses données — mais ça ne vaut pas pour un autre testeur.
- **Questions 8 et 9 (carences au renouvellement)** — déterminent les premiers jours non indemnisés
  après un renouvellement. Aujourd'hui, `delaiSeReapplique` applique le délai **entièrement ou pas du
  tout**, jamais au prorata, et le compte à partir de la date d'ouverture de l'ancien droit :
  **ce sont deux hypothèses non confirmées**, pas des règles sourcées.
- **Questions 1 et 3 (plafond AJ, plancher d'écrêtement)** — effet réel mais borné : le plafond ne
  mord qu'à salaire de référence très élevé, le plancher joue sur les cotisations.

### Réponses qui débloqueraient un calcul aujourd'hui refusé

- **Questions 4, 10, 13** — Cadence refuse actuellement de chiffrer la franchise salaires
  (`franchise_salaires_non_certifiee`) et celle d'un nouveau droit (F2 affiché à l'écran). Ces trois
  réponses ensemble permettraient de les câbler. ⚠️ Ne pas les câbler avec une seule des trois.
- **Question 16** — permettrait de chiffrer un trop-perçu, aujourd'hui rendu comme un verdict à trois
  états (`avere` / `ecarte` / `indetermine`), jamais comme un montant.

### Réponses qui confirmeraient un choix par défaut, sans effet connu

- **Questions 2, 6, 7, 11, 12, 14, 15** — confirment ou infirment une hypothèse déjà en place. Un
  démenti sur 6 ou 7 décalerait une fenêtre d'un jour ou déplacerait un contrat de mois, donc à ne pas
  négliger, mais aucun cas réel connu n'en dépend aujourd'hui.

### Et les documents (section F)

Ils débloquent le **point 12 ter** de `docs/critique_2026-08-03.md` : la validation de
`calculerSerieDepuisContrats` contre de vrais décomptes. C'est le seul point de la liste qui n'attend
pas une règle, mais des pièces.
