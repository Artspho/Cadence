/**
 * src/lib/documentsRequis.ts — quels documents l'utilisateur doit déposer, et ce qui manque encore.
 *
 * Logique PURE et testée, volontairement séparée de l'UI : c'est elle qui porte la vérité de la
 * checklist de l'espace dépôt, le JSX ne fait que l'afficher. Même principe que
 * `lib/routageExtraction.ts` — un badge affiché à l'écran est une affirmation sur les droits de
 * quelqu'un, elle se teste.
 *
 * ════════ LA CONTRAINTE FONDATRICE ════════
 *
 * L'app ne garde AUCUNE trace des fichiers déposés. Ce qui est stocké, c'est
 * `{ profil, contrats, periodes, soldeIndemnisationDepart }` — les chiffres, jamais les documents
 * (cf. storage/localStorageAdapter.ts). Aucun champ n'existe pour « une notification a été déposée ».
 *
 * Conséquence, et c'est le devoir sacré n°2 au mot près : un statut adossé à « tu as déposé un
 * fichier » MENTIRAIT dès qu'une extraction est refusée par le routage ou abandonnée à l'écran de
 * revue — document passé, donnée absente, feu vert affiché. Tout ici se calcule donc depuis les
 * DONNÉES PRÉSENTES. Bénéfice gratuit : une saisie manuelle éteint le statut exactement comme un
 * import, ce qui est le comportement juste.
 *
 * C'est aussi pourquoi le vocabulaire ne dit jamais « fournie » (l'app ne peut pas l'observer) mais
 * « complète » / « incomplète » / « rien de renseigné » — décision de Benoît du 29/07/2026.
 *
 * ════════ CE QUI N'EST VOLONTAIREMENT PAS RÉCLAMÉ ════════
 *
 * Réclamer une donnée qui ne change rien à l'écran est du bruit, et à terme un badge que
 * l'utilisateur apprend à ignorer — ce qui détruit la valeur des vrais manques. Sont donc exclus,
 * chacun pour une raison vérifiée dans le code :
 *
 * - `dureeDroitsMois` : absent, le moteur retombe sur 12 (indemnisationMensuelle.ts:270). Et surtout
 *   la franchise salaires — le SEUL calcul qui consomme ce champ — n'est jamais active dans l'app :
 *   aucun appelant ne fournit le SR/SJM qu'elle exige, donc `quotaMensuelSalaires` renvoie 0 quoi
 *   qu'il arrive (indemnisationMensuelle.ts:338-341). Le réclamer enverrait l'utilisateur chercher
 *   un chiffre sans effet observable. À réintroduire le jour où ce chantier sera câblé.
 * - `salairesHorsAnnexe10PRA` : indissociable de `regimeDeclare`, lui-même jamais déduit d'un
 *   document par décision documentée. Et dans le périmètre supporté (`annexe10_pur`), il ne sert
 *   pas : `regimeDeclare: "mixte"` est un cas hors périmètre qui masque déjà l'onglet (App.tsx:166).
 * - `situation` : requis par le type `Profil` et garanti par le schéma de lecture — il ne peut pas
 *   manquer sur un profil chargé. Un manque qui ne peut jamais se déclencher est du code mort.
 * - `soldeIndemnisationDepart` : choix d'affichage de l'utilisateur, aucun document ne le porte.
 *
 * ════════ TROIS LIMITES ASSUMÉES, À AFFICHER TELLES QUELLES ════════
 *
 * Ce sont des `note` sur les lignes concernées, pas des manques à combler. Les taire serait pire
 * que de les dire.
 *
 * 1. La ligne « bulletins / AEM » ne peut JAMAIS être « complète ». L'app ne connaît pas la liste
 *    des mois travaillés : elle est structurellement incapable de distinguer « je n'ai pas
 *    travaillé en mars » de « j'ai oublié mars ». Afficher « complet » ici serait un faux feu vert
 *    sur le compteur 507 h lui-même — le plus grave possible. D'où `non_evaluable` dès qu'il y a au
 *    moins un contrat, jamais `complet`.
 * 2. La ligne « attestation CPAM » ne promet rien : aucune case d'arrivée n'existe pour une
 *    `PeriodeAssimilee` (ni setter, ni UI — cf. routageExtraction.ts:20). Déposer cette pièce ne
 *    produit rien d'applicable aujourd'hui, et la ligne le dit.
 * 3. Les lignes « relevé de situation » et « attestation de taux » n'ont pas de statut calculable :
 *    elles ne portent aucune donnée qui leur soit propre (tout ce qu'elles contiennent figure aussi
 *    sur la notification). Leur rôle est d'être des sources ALTERNATIVES, pas des cases à cocher.
 */

import type { Contrat, Profil } from "../types";

export type IdDocument = "notification_admission" | "bulletins_aem" | "releve_situation" | "attestation_cpam" | "attestation_taux";

export type StatutLigne =
  /** Aucune donnée du groupe n'est présente. */
  | "rien_renseigne"
  /** Certaines présentes, au moins un manque bloquant. */
  | "incomplet"
  /** Tous les manques bloquants sont comblés (des précisions peuvent rester). */
  | "complet"
  /** L'app ne PEUT PAS savoir — jamais un statut par défaut, toujours une limite assumée. */
  | "non_evaluable";

export type RoleLigne =
  /** Indispensable au fonctionnement dès que les droits sont ouverts. */
  | "requis"
  /** Ne concerne pas tout le monde : l'absence n'est pas un manque. */
  | "seulement_si_concerne"
  /** Source alternative d'une donnée déjà réclamée ailleurs. */
  | "complement";

export type PoidsManque =
  /** Une fonction de l'app est bloquée ou fausse sans cette donnée. */
  | "bloquant"
  /** L'app fonctionne, mais moins précisément. Jamais compté dans « N informations manquent ». */
  | "precision";

export interface ManqueDonnee {
  libelle: string;
  poids: PoidsManque;
  /** Ce que l'utilisateur constate à l'écran tant que la donnée manque. Vérifié dans le code. */
  consequence: string;
}

export interface LigneDocument {
  id: IdDocument;
  /** Nom du document tel que l'utilisateur le connaît. */
  document: string;
  role: RoleLigne;
  statut: StatutLigne;
  /** Manques bloquants d'abord, puis les précisions. Vide si rien ne manque. */
  manques: ManqueDonnee[];
  /** Sert au libellé « incomplète (N informations manquent) » — bloquants SEULEMENT. */
  nbManquesBloquants: number;
  /** Nombre de contrats enregistrés — uniquement sur la ligne bulletins/AEM. */
  nbContrats?: number;
  /** Limite assumée à afficher telle quelle. Ce n'est pas un manque. */
  note?: string;
}

/** Une chaîne de date absente est stockée `""` sur un profil (cf. Profil.dateAnniversaire). */
function renseignee(valeur: string | undefined): boolean {
  return typeof valeur === "string" && valeur.length > 0;
}

/**
 * Une vérification unitaire. `applicable: false` = cette donnée ne concerne pas ce profil (ex. la
 * date anniversaire en première admission) : ce n'est alors NI un manque NI une donnée présente.
 *
 * Cette forme déclarative existe pour une raison précise : elle permet de distinguer « rien de
 * renseigné » d'« incomplet » sans compter les vérifications à la main. Une version antérieure
 * comparait le nombre de manques à un total écrit en dur (3 ou 4 selon la situation) — n'importe
 * quel ajout de vérification l'aurait désynchronisé en silence, et une ligne « incomplète » se
 * serait affichée « rien de renseigné » sans qu'aucun test ne le voie.
 */
interface Verification extends ManqueDonnee {
  present: boolean;
  applicable: boolean;
}

/**
 * Ligne « notification d'admission » — la seule à statut pleinement calculable, et de loin la plus
 * décisive : elle porte à elle seule 9 des données dont l'app a besoin.
 */
function ligneNotification(profil: Profil | null): LigneDocument {
  const ouverture = profil?.ouvertureDroits;
  const readmission = profil?.situation === "readmission";

  const verifications: Verification[] = [
    {
      // Les trois paramètres d'ouverture ne peuvent pas manquer séparément : `Profil.ouvertureDroits`
      // les exige tous les trois, et le routage refuse d'en écrire un partiel (mettre 0 « en
      // attendant » serait un chiffre inventé qui décale les dates de versement). Un seul manque,
      // donc, qui les nomme tous les trois — trois cases basculant toujours ensemble donneraient
      // l'illusion de trois vérifications indépendantes.
      libelle: "Paramètres de ton ouverture de droits : date d'ouverture, franchise congés payés (en jours), délai d'attente (en jours)",
      poids: "bloquant",
      consequence: "Sans les trois, l'onglet Revenus n'affiche aucun montant. Ils se saisissent ensemble.",
      present: ouverture != null,
      applicable: true,
    },
    {
      libelle: "Allocation journalière nette",
      poids: "bloquant",
      // Le mot « nette » n'est pas décoratif : un relevé de situation donne le plus souvent l'AJ
      // BRUTE, et le routage la refuse (aucune conversion fiable n'existe). D'où le renvoi explicite
      // vers la notification. Signalétique uniquement — cf. le Point 2 brut/nette, ouvert.
      consequence:
        "Sans elle, aucun montant mensuel n'est calculé — Cadence n'affiche jamais d'estimation de repli. Elle se lit sur ta notification, qui dit « allocation journalière nette » ; un relevé de situation donne le plus souvent le montant BRUT, qui ne convient pas.",
      present: (profil?.ajReelleHistorique ?? []).length > 0,
      applicable: true,
    },
    {
      libelle: "Date de naissance",
      poids: "bloquant",
      consequence: "Sans elle, le plafond d'heures d'enseignement retenu (70 h ou 120 h) peut être le mauvais.",
      present: renseignee(profil?.dateNaissance),
      applicable: true,
    },
    {
      libelle: "Date anniversaire (fin du contrat qui a ouvert tes droits)",
      poids: "bloquant",
      consequence: "Sans elle, la période de référence est fausse, donc tout le décompte des 507 h.",
      present: renseignee(profil?.dateAnniversaire),
      // Vide est un état LÉGITIME en première admission — l'app le supporte explicitement
      // (`dateAnniversaireConnue` dans l'onboarding) et la fenêtre de référence retombe alors sur la
      // date du jour (periodeReference.ts:41). Ce n'est un manque qu'en réadmission, où
      // `coherenceProfil.ts:30` l'exige. La vérification reste utile malgré cette règle : le schéma
      // de LECTURE ne contrôle pas la cohérence (par conception, pour ne jamais faire régresser un
      // profil déjà enregistré), donc un profil ancien peut arriver ici sans cette date.
      applicable: readmission,
    },
    {
      libelle: "Date limite de ton indemnisation",
      // BLOQUANT, et pas « précision » comme dans une première version de ce fichier. Vérifié le
      // 29/07/2026 : son absence produit de VRAIS mois erronés à l'écran, sans aucune protection
      // compensatoire. La borne dure de `calculerSerieDepuisContrats` est purement sautée quand le
      // champ est absent (indemnisationMensuelle.ts:254), la fin de série retombe alors sur
      // `dateDuJour` (:246), et `RevenusMensuels.tsx` ne mentionne ce champ nulle part — ni
      // troncature, ni avertissement. Deux tests voisins le prouvent sur le même profil
      // (indemnisationMensuelle.test.ts:372 et :401) : dernier mois simulé 2027-01 avec la date,
      // 2027-02 sans elle. Ce mois hors droits porte un montant calculé comme les autres, et l'écart
      // grossit avec le temps puisque la borne haute est la date du jour.
      // C'est la régression que Benoît avait lui-même signalée le 26/07/2026.
      // Classement tenable : la donnée est toujours atteignable — le lexique, validé sur pièces
      // réelles, la trouve sur la notification ET sur le relevé, sous deux formulations équivalentes.
      poids: "bloquant",
      consequence:
        "Sans elle, le tableau mensuel n'est pas borné : des mois s'affichent avec un montant au-delà de droits qui n'existent plus. Elle figure sur ta notification et sur ton relevé de situation.",
      present: renseignee(ouverture?.dateLimiteIndemnisation),
      // Inatteignable tant que `ouvertureDroits` est absent : l'afficher ferait un faux manque
      // supplémentaire pour un trou déjà signalé par la première ligne.
      applicable: ouverture != null,
    },
    {
      libelle: "Taux de prélèvement à la source",
      // Précision, et celle-ci est confirmée : l'app dégrade HONNÊTEMENT quand le taux manque. La
      // colonne est renommée « ≈ Montant (AJ relevé) » au lieu de « Montant net avant PAS »
      // (RevenusMensuels.tsx:364) et un avertissement ambre invite à le renseigner (:446). Aucun
      // chiffre faux n'est affiché — c'est exactement ce qui la distingue de la date limite ci-dessus.
      poids: "precision",
      consequence: "Sans lui, les montants mensuels restent bruts — aucun net n'est affiché, et le tableau le signale.",
      present: ouverture?.tauxPrelevementSource != null,
      applicable: ouverture != null,
    },
    {
      libelle: "Date anniversaire précédente (sur ta notification précédente)",
      poids: "precision",
      consequence: "Sans elle, Cadence ne peut pas ajuster ton seuil de réadmission et le signale par une alerte.",
      present: renseignee(profil?.dateAnniversairePrecedente),
      applicable: readmission,
    },
  ];

  const aEvaluer = verifications.filter((v) => v.applicable);
  const manquantes = aEvaluer.filter((v) => !v.present);
  const bloquants = manquantes.filter((m) => m.poids === "bloquant");

  // « rien de renseigné » = AUCUNE donnée bloquante présente. Déduit des vérifications elles-mêmes,
  // jamais d'un total écrit à la main. `profil === null` (tout premier lancement) y tombe
  // naturellement, sans cas particulier.
  const aucuneDonnee = aEvaluer.filter((v) => v.poids === "bloquant").every((v) => !v.present);

  return {
    id: "notification_admission",
    document: "Notification d'admission ARE",
    role: "requis",
    statut: aucuneDonnee ? "rien_renseigne" : bloquants.length > 0 ? "incomplet" : "complet",
    // Bloquants d'abord : ce qu'il faut aller chercher avant tout le reste.
    manques: [...bloquants, ...manquantes.filter((m) => m.poids === "precision")].map(({ libelle, poids, consequence }) => ({ libelle, poids, consequence })),
    nbManquesBloquants: bloquants.length,
  };
}

/**
 * Ligne « bulletins / AEM » — jamais « complète », par honnêteté. Voir la limite n°1 en tête de
 * fichier : c'est le compteur 507 h qui est en jeu.
 */
function ligneBulletins(contrats: Contrat[]): LigneDocument {
  const aucun = contrats.length === 0;
  return {
    id: "bulletins_aem",
    document: "Bulletins de paie ou AEM",
    role: "requis",
    statut: aucun ? "rien_renseigne" : "non_evaluable",
    manques: aucun
      ? [
          {
            libelle: "Au moins un contrat",
            poids: "bloquant",
            consequence: "Sans contrat, le compteur des 507 h reste à zéro.",
          },
        ]
      : [],
    nbManquesBloquants: aucun ? 1 : 0,
    // Le NOMBRE DE CONTRATS, pas un nombre de mois : un contrat peut chevaucher plusieurs mois
    // (une année scolaire d'enseignement en couvre dix). Recompter les mois ici dupliquerait
    // `engine/decoupageMensuel.ts` et risquerait d'en diverger silencieusement — on n'affiche que
    // ce que l'app sait sans calcul.
    nbContrats: contrats.length,
    note: aucun
      ? undefined
      : "Cadence ne connaît pas la liste de tes mois travaillés : elle ne peut pas savoir s'il en manque. À toi de vérifier que tous tes contrats de la période de référence sont là — c'est le compteur des 507 h qui en dépend.",
  };
}

/**
 * Construit la checklist de l'espace dépôt.
 *
 * @param profil   Profil enregistré, `null` au tout premier lancement.
 * @param contrats Contrats enregistrés, toutes provenances confondues (saisie, import PDF, récurrent).
 *
 * `periodes` n'est pas un paramètre : la ligne CPAM est `non_evaluable` de toute façon (l'app ne
 * peut pas savoir si quelqu'un a eu un arrêt de travail), et aucune période ne peut être créée
 * aujourd'hui — le compte serait toujours 0.
 */
export function documentsRequis(profil: Profil | null, contrats: Contrat[]): LigneDocument[] {
  const lignes: LigneDocument[] = [ligneNotification(profil), ligneBulletins(contrats)];

  lignes.push({
    id: "releve_situation",
    document: "Relevé de situation",
    role: "complement",
    // Aucune donnée propre : tout ce qu'il porte figure aussi sur la notification. Un statut serait
    // donc inventé de toutes pièces.
    statut: "non_evaluable",
    manques: [],
    nbManquesBloquants: 0,
    note: "Utile pour recouper tes chiffres, et il porte la date limite d'indemnisation si elle manque. Attention : l'allocation qu'il affiche est le plus souvent le montant BRUT, qui ne peut pas servir de montant net.",
  });

  lignes.push({
    id: "attestation_cpam",
    document: "Attestation CPAM (maternité, arrêt, accident du travail)",
    role: "seulement_si_concerne",
    // L'app ne peut pas savoir si l'utilisateur est concerné : l'absence de période n'est pas un
    // manque. Et de toute façon, rien ne pourrait encore en être appliqué.
    statut: "non_evaluable",
    manques: [],
    nbManquesBloquants: 0,
    note: "Cadence ne sait pas encore enregistrer ces périodes : déposer cette attestation ne servirait à rien pour l'instant. Si tu es concerné, garde la pièce de côté.",
  });

  // Ligne affichée UNIQUEMENT quand le taux manque : c'est sa seule raison d'être, et une ligne
  // sans objet dans une checklist est du bruit qui dilue les vrais manques.
  if (profil?.ouvertureDroits?.tauxPrelevementSource == null) {
    lignes.push({
      id: "attestation_taux",
      document: "Attestation de taux de prélèvement à la source",
      role: "complement",
      statut: "non_evaluable",
      manques: [],
      nbManquesBloquants: 0,
      note: "Nécessaire seulement si le taux ne figure pas sur ta notification. Il est aussi rappelé sur ton relevé de situation, et disponible dans ton espace France Travail, rubrique « Mes attestations ».",
    });
  }

  return lignes;
}

/**
 * Vrai s'il reste au moins un manque BLOQUANT — de quoi décider si l'espace dépôt met la checklist
 * en avant ou la laisse discrète. Les précisions ne comptent pas : elles n'empêchent rien de
 * fonctionner, et déclencher une mise en avant permanente pour elles reviendrait à crier au loup.
 */
export function aDesManquesBloquants(lignes: LigneDocument[]): boolean {
  return lignes.some((l) => l.nbManquesBloquants > 0);
}
