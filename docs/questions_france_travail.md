# Questions à poser à France Travail — courrier prêt à envoyer

**Rédigé le 06/08/2026.** Ces questions sont les seuls points du projet qu'aucune recherche
documentaire n'a pu trancher : à chaque fois, soit deux sources officielles se contredisent, soit le
guide reste muet. Cadence applique aujourd'hui un choix par défaut **assumé et documenté** pour
chacune, jamais une valeur inventée — mais un choix par défaut n'est pas une réponse.

⚠️ **Une question NE FIGURE PAS dans ce courrier, exprès** : la durée d'amortissement d'un instrument
de musique (point 20, `franceTravailConfig.ts:220`, actuellement 5 ans). Elle ne relève pas de France
Travail mais de l'**administration fiscale** — le BOFIP ne donne pas de durée pour l'instrument de
musique, alors qu'il en donne pour l'informatique et le mobilier. À poser au service des impôts ou à
un expert-comptable, pas au conseiller.

Où chaque réponse atterrira dans le code, une fois obtenue :

| Question | Fichier concerné |
|---|---|
| 1. Plafond de l'allocation journalière | `src/config/franceTravailConfig.ts:82` et `:102` |
| 2. Cachets au-delà de 28 par mois | `src/engine/decompteHeures.ts`, `src/engine/decoupageMensuel.ts` |
| 3. Contrat à cheval sur deux mois | `src/engine/salaireReference.ts:34`, `src/engine/decompteHeures.ts:140` |
| 4. Bornes de la période de référence | `src/engine/periodeReference.ts:95` |
| 5. Périodes assimilées et salaire de référence | `src/engine/salaireReference.ts:19` |
| 6. SMIC journalier de la franchise | `src/config/franceTravailConfig.ts:272` |

---

## Courrier

> **Objet : Demande de précisions sur le calcul des droits en Annexe 10 (artiste du spectacle)**
>
> Madame, Monsieur,
>
> Je suis artiste intermittent du spectacle, indemnisé au titre de l'Annexe 10. Afin de suivre
> précisément mes droits et de vérifier mes propres calculs, je me heurte à six points sur lesquels la
> documentation que j'ai consultée reste ambiguë, ou sur lesquels deux sources officielles ne
> concordent pas. Je vous serais très reconnaissant de bien vouloir me les préciser, ou de m'indiquer
> le texte de référence qui les tranche.
>
> **1. Plafond de l'allocation journalière — deux montants différents selon la source**
>
> Le guide France Travail que j'ai consulté indique que l'allocation journalière ne peut pas dépasser
> **174,80 €** depuis le 1er janvier 2024. La publication « Paramètres utiles » de l'Unédic (édition
> avril 2026) indique quant à elle **181,18 €**, après deux revalorisations successives (174,80 € puis
> 177,56 € puis 181,18 €).
>
> Quel est le montant applicable aujourd'hui, et à partir de quelle date chaque valeur a-t-elle pris
> effet ? Le montant du guide correspond-il à une valeur non actualisée ?
>
> **2. Cachets au-delà de 28 dans un même mois — comptent-ils pour l'affiliation aux 507 heures ?**
>
> L'Annexe 10 retient un maximum de 28 cachets par mois. Ma question porte sur l'effet exact de ce
> plafond : si je réalise par exemple 30 cachets au cours d'un même mois, les 2 cachets excédentaires
> sont-ils **totalement écartés** du décompte des 507 heures servant à l'affiliation, ou bien le
> plafond de 28 n'a-t-il qu'une autre portée (par exemple le calcul de l'allocation) ?
>
> Et dans le cas d'un mois incomplet (une période d'emploi qui ne couvre qu'une partie du mois), ce
> plafond de 28 est-il proratisé au nombre de jours, ou s'applique-t-il en entier ?
>
> **3. Contrat à cheval sur deux mois civils — comment est-il rattaché ?**
>
> Lorsqu'un contrat commence dans un mois et se termine dans le suivant, est-il rattaché en **totalité
> au mois de sa date de fin**, ou bien réparti entre les deux mois au prorata ? La réponse change à la
> fois le décompte des heures et le calcul du salaire de référence, notamment lorsque le contrat se
> trouve à la limite de la période de référence.
>
> **4. Bornes de la période de référence — les dates extrêmes sont-elles incluses ?**
>
> La période de référence est délimitée par deux dates. Un contrat dont la fin tombe **exactement le
> premier jour** de cette période, ou **exactement le dernier**, est-il retenu ou écarté ? Autrement
> dit, ces bornes sont-elles inclusives ou exclusives ?
>
> **5. Périodes assimilées et salaire annuel de référence**
>
> Certaines périodes non travaillées peuvent être prises en compte. Je souhaiterais savoir précisément
> lesquelles ouvrent droit à un **aménagement du salaire de référence** (et non seulement à un
> allongement de la période de référence). Le congé maternité, le congé d'adoption et une affection de
> longue durée semblent concernés ; qu'en est-il d'une **suspension du contrat de travail** ?
>
> **6. « SMIC journalier » utilisé pour la franchise congés payés / salaires**
>
> Le calcul de la franchise fait intervenir un « SMIC journalier ». Comment se détermine-t-il
> exactement ? S'obtient-il en multipliant le SMIC horaire brut par 7 heures, ou une autre convention
> s'applique-t-elle (par exemple 7 heures sur une base différente, ou un montant publié directement) ?
>
> **Enfin, une demande de documents.**
>
> Afin de comparer mes calculs à vos décomptes réels, pourriez-vous m'adresser, ou m'indiquer où les
> retrouver dans mon espace personnel :
>
> - les **justificatifs de mes déclarations mensuelles** depuis mars 2025, faisant apparaître le nombre
>   d'heures retenues pour chaque mois ;
> - la **notification d'ouverture de droits** de mars 2025 ;
> - un **relevé de situation** à jour.
>
> Je vous remercie par avance du temps que vous consacrerez à ces précisions, qui me permettront de
> suivre mes droits sans risque d'erreur.
>
> Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations respectueuses.
>
> *[Nom, prénom]*
> *Identifiant France Travail : [à compléter]*

---

## Quand les réponses arrivent

**Ne rien coder avant d'avoir la réponse écrite, et la citer.** Chaque valeur réglementaire du projet
porte sa source en commentaire (`✅ arrêté du 22 mai 2026`, `✅ Unédic « Paramètres utiles » avril
2026 p.3`) : une réponse de conseiller se cite de la même façon, avec sa date. Une réponse orale au
téléphone n'est pas une source — demander un écrit, ou noter explicitement qu'il s'agit d'un propos
rapporté.

⚠️ Deux réponses peuvent avoir un effet immédiat sur des chiffres déjà affichés à l'utilisateur :
- **question 1** : le plafond change l'allocation, mais seulement à salaire de référence très élevé ;
- **question 2** : si les cachets au-delà de 28 sont écartés, Cadence **surcompte** aujourd'hui les
  heures d'un mois très chargé, et peut donc afficher un « Sécurité » qui n'est pas acquis. Les mois de
  Benoît plafonnent à 20 cachets, donc l'effet est nul sur ses données — mais il ne le serait pas pour
  un autre testeur. À traiter en priorité si la réponse confirme l'écartement.

Les questions 3, 4, 5 et 6 confirment ou infirment un choix par défaut déjà en place, sans impact
connu sur les chiffres actuels — cf. les fiches 12, 18 et 19 de `docs/critique_2026-08-03.md`.
