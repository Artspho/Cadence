/**
 * Extractions SIMULÉES, en dur, pour valider l'écran de revue sans infrastructure.
 *
 * Pourquoi des fixtures plutôt qu'un vrai appel : à ce stade aucun document ne doit transiter vers
 * Mistral (DPA non réglé, cf. api/extract-document.ts). Ces objets permettent de vérifier l'UX et
 * le routage vers ajouterContrat / modifierProfil sans réseau, sans clé API, sans document réel.
 *
 * Typés `ExtractionResult` exprès : si le schéma partagé change, ce fichier casse à la compilation
 * plutôt que de laisser l'écran de revue être validé contre une forme périmée.
 *
 * ⚠️ Chiffres et employeurs FICTIFS, choisis pour exercer chaque branche de routageExtraction.ts.
 * Réservé au mode développement (cf. RevueExtraction.tsx) : affichés à un vrai utilisateur, ils
 * seraient des montants faux (devoir sacré n°2).
 */

import type { ExtractionResult } from "../types/extraction";

/**
 * Cas nominal : tout est applicable. Notification d'admission complète, avec une AJ explicitement
 * NETTE (le seul cas où un montant d'AJ peut être routé automatiquement).
 */
export const extractionNotificationAdmission: ExtractionResult = {
  typeDocumentDetecte: "notification_admission",
  propositions: [
    {
      cible: "profil_ouverture_droits",
      donnees: {
        dateOuverture: "2026-02-01",
        franchiseCPTotale: 12,
        delaiAttenteInitial: 7,
        dateLimiteIndemnisation: "2027-01-31",
        tauxPrelevementSource: 7.2,
        tauxPrelevementSourceDateEffet: "2026-02-01",
      },
      confiance: {
        dateOuverture: "haute",
        franchiseCPTotale: "haute",
        delaiAttenteInitial: "haute",
        dateLimiteIndemnisation: "haute",
        tauxPrelevementSource: "moyenne",
      },
      justification: "Encadré « Votre indemnisation » page 1 ; date limite au paragraphe suivant.",
    },
    {
      cible: "profil_infos",
      donnees: {
        dateAnniversaire: "2026-01-15",
        dateNaissance: null,
        dateAnniversairePrecedente: null,
        situation: "readmission",
        dureeDroitsMois: 12,
      },
      confiance: { dateAnniversaire: "haute", situation: "haute", dureeDroitsMois: "moyenne" },
      justification: "« Fin du contrat de travail ouvrant droit » page 1 ; mention « réadmission » en en-tête.",
    },
    {
      cible: "aj_reelle_historique",
      donnees: { dateEffet: "2026-02-01", valeur: 54.55, natureMontant: "net" },
      confiance: { valeur: "haute", natureMontant: "haute", dateEffet: "haute" },
      justification: "Ligne « Allocation journalière nette : 54,55 € » — le document dit littéralement « nette ».",
    },
    {
      cible: "info_seule",
      donnees: { salaireDeReferenceOfficiel: 24800, nombreHeuresTravailleesOfficiel: 632, joursNonIndemnisables: 19 },
      confiance: { salaireDeReferenceOfficiel: "haute", nombreHeuresTravailleesOfficiel: "haute", joursNonIndemnisables: "moyenne" },
      justification: "Tableau récapitulatif page 2 — à comparer aux chiffres calculés par Cadence.",
    },
  ],
  avertissementsGeneraux: [],
};

/**
 * Bulletin de paie : le cas le plus fréquent, et celui où le document est le plus muet.
 * `type`, `typeRemuneration` et `territoire` sont à null → l'écran doit prévenir que le formulaire
 * remplira des valeurs par défaut, et ne jamais les faire passer pour des valeurs lues.
 */
export const extractionBulletinPaie: ExtractionResult = {
  typeDocumentDetecte: "bulletin_paie",
  propositions: [
    {
      cible: "contrat",
      donnees: {
        natureDocumentSource: "bulletin_paie",
        date: "2026-06-28",
        dateDebut: "2026-06-24",
        type: null,
        typeRemuneration: null,
        territoire: null,
        nbCachets: null,
        nbHeures: null,
        nbJoursEEE: null,
        salaireBrut: 1420.5,
        employeur: "Compagnie du Exemple Fictif",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "moyenne", salaireBrut: "haute", employeur: "haute", natureDocumentSource: "haute" },
      justification: "Période d'emploi en en-tête ; brut total au bas du bulletin. En-tête « Bulletin de paie ».",
    },
    {
      cible: "info_seule",
      donnees: { nombreDeCachetsMentionne: null, mentionConventionCollective: "Convention collective non identifiée sur ce bulletin" },
      confiance: { mentionConventionCollective: "faible" },
      justification: "Le nombre de cachets n'apparaît pas explicitement — ne pas le déduire du montant brut.",
    },
  ],
  avertissementsGeneraux: [
    "Un bulletin de paie ne fait pas foi auprès de France Travail : la pièce de référence est l'AEM (Attestation d'Employeur Mensuelle).",
    "Le nombre de cachets n'a pas pu être lu. Ne le déduis pas du montant brut : renseigne-le d'après ton AEM.",
  ],
};

/**
 * AEM d'artiste musicien où heures ET cachets sont tous les deux renseignés sur le même contrat
 * (ex. heures de répétition distinctes de cachets de représentation) — cas réel observé en
 * production le 01/08/2026, où le modèle avait à tort rangé nbCachets à null avec une justification
 * fausse après avoir déjà rempli nbHeures (cf. CAS 7, api/extract-document.ts). Cette fixture fige
 * le comportement ATTENDU (les deux champs remplis indépendamment) pour repérer une régression de
 * CODE qui supprimerait l'un des deux au routage — elle ne peut pas, en revanche, garantir que le
 * modèle continuera à bien lire les deux cases : ça reste une question de qualité de prompt, pas de
 * code, revalidée uniquement par un futur envoi réel.
 */
export const extractionAemHeuresEtCachets: ExtractionResult = {
  typeDocumentDetecte: "aem",
  propositions: [
    {
      cible: "contrat",
      donnees: {
        natureDocumentSource: "aem",
        date: "2026-06-28",
        dateDebut: "2026-06-26",
        type: "artiste",
        typeRemuneration: "heures",
        territoire: null,
        nbCachets: 3,
        nbHeures: 14,
        nbJoursEEE: null,
        salaireBrut: 245,
        employeur: "Association Fictive du Festival de Test",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", type: "haute", typeRemuneration: "haute", nbCachets: "haute", nbHeures: "haute", salaireBrut: "haute", employeur: "haute", natureDocumentSource: "haute" },
      justification: "« Nombre d'HEURES effectuées : 14 » et « Nombre de CACHETS : 3 » toutes deux renseignées sur la même attestation, emploi « Artiste musicien ». En-tête « Attestation d'Employeur Mensuelle ».",
    },
  ],
  avertissementsGeneraux: [],
};

/**
 * Même AEM que ci-dessus, mais dans la forme BRUTE réellement renvoyée par l'app déployée le
 * 01/08/2026 (après le correctif CAS 7) : au lieu d'UNE proposition portant les deux champs, le
 * modèle a produit DEUX propositions "contrat" distinctes — une "heures", une "cachet" — partageant
 * le MÊME `salaireBrut: 245`. L'avertissement général confirmait déjà « même contrat », mais rien
 * n'empêchait techniquement de valider les deux cartes de revue, ce qui aurait compté 245 € deux
 * fois. Cette fixture fige le cas d'ENTRÉE de `fusionnerContratsDupliques` (cf.
 * routageExtraction.ts) — la sortie attendue après fusion est structurellement identique à
 * `extractionAemHeuresEtCachets` ci-dessus (un seul salaireBrut, les deux champs réunis).
 */
export const extractionAemDupliqueeHeuresCachets: ExtractionResult = {
  typeDocumentDetecte: "aem",
  propositions: [
    {
      cible: "contrat",
      donnees: {
        natureDocumentSource: "aem",
        date: "2026-06-28",
        dateDebut: "2026-06-26",
        type: "artiste",
        typeRemuneration: "heures",
        territoire: null,
        nbCachets: null,
        nbHeures: 14,
        nbJoursEEE: null,
        salaireBrut: 245,
        employeur: "Association Fictive du Festival de Test",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", type: "haute", typeRemuneration: "haute", nbHeures: "haute", salaireBrut: "haute", employeur: "haute", natureDocumentSource: "haute" },
      justification: "« Nombre d'HEURES effectuées : 14 » ; « SALAIRES BRUTS 245,00 » ; employeur « Association Fictive du Festival de Test ». En-tête « Attestation d'Employeur Mensuelle ».",
    },
    {
      cible: "contrat",
      donnees: {
        natureDocumentSource: "aem",
        date: "2026-06-28",
        dateDebut: "2026-06-26",
        type: "artiste",
        typeRemuneration: "cachet",
        territoire: null,
        nbCachets: 3,
        nbHeures: null,
        nbJoursEEE: null,
        salaireBrut: 245,
        employeur: "Association Fictive du Festival de Test",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", type: "haute", typeRemuneration: "haute", nbCachets: "haute", salaireBrut: "haute", employeur: "haute", natureDocumentSource: "haute" },
      justification: "« Nombre de CACHETS isolés 3 » ; « SALAIRES BRUTS 245,00 » ; employeur « Association Fictive du Festival de Test ». En-tête « Attestation d'Employeur Mensuelle ».",
    },
  ],
  avertissementsGeneraux: ["Les deux modes de rémunération (heures et cachets) sont présents et doivent être traités séparément pour le même contrat."],
};

/**
 * Cas des refus (aj_reelle_historique, profil_ouverture_droits) + un cas de revue manuelle
 * (periode_assimilee, routée vers PeriodeForm depuis le 31/07/2026) : chaque proposition ici doit
 * être affichée sans jamais s'appliquer directement (statut "applicable"). Sert à vérifier
 * qu'aucune de ces situations ne peut produire un chiffre faux ni un écrasement silencieux.
 */
export const extractionReleveAvecRefus: ExtractionResult = {
  typeDocumentDetecte: "releve_situation",
  propositions: [
    {
      // Refus n°1 : montant BRUT. Le champ de l'app attend une AJ nette (cf. routageExtraction.ts).
      cible: "aj_reelle_historique",
      donnees: { dateEffet: "2026-03-01", valeur: 62.14, natureMontant: "brut" },
      confiance: { valeur: "haute", natureMontant: "haute", dateEffet: "haute" },
      justification: "Colonne « Allocation brute » du relevé — le document dit « brute », pas « nette ».",
    },
    {
      // Revue manuelle (PAS un refus depuis le 31/07/2026) : routée vers PeriodeForm, pré-remplie,
      // mais jamais appliquée directement — ald/maladie_intercontrat ayant des effets opposés sur
      // le décompte, la confirmation humaine du type reste requise (cf. routageExtraction.ts).
      cible: "periode_assimilee",
      donnees: { type: "accident_travail", dateDebut: "2026-04-06", dateFin: "2026-04-24" },
      confiance: { type: "haute", dateDebut: "haute", dateFin: "haute" },
      justification: "Mention « accident du travail » avec dates de suspension, page 1.",
    },
    {
      // Refus n°2 : ouverture de droits incomplète — franchise et délai absents.
      cible: "profil_ouverture_droits",
      donnees: {
        dateOuverture: "2026-03-01",
        franchiseCPTotale: null,
        delaiAttenteInitial: null,
        dateLimiteIndemnisation: null,
        tauxPrelevementSource: 5.4,
        tauxPrelevementSourceDateEffet: "2026-03-01",
      },
      confiance: { dateOuverture: "moyenne", tauxPrelevementSource: "haute" },
      justification: "Un relevé de situation rappelle la date d'ouverture mais pas le détail des franchises.",
    },
    {
      cible: "info_seule",
      donnees: { montantBrutVerseSurLaPeriode: 1864.2, joursIndemnisesSurLaPeriode: 30 },
      confiance: { montantBrutVerseSurLaPeriode: "haute", joursIndemnisesSurLaPeriode: "haute" },
      justification: "Tableau des paiements du relevé — utile pour recaler le tableau mensuel de Cadence.",
    },
  ],
  avertissementsGeneraux: [
    "Ce relevé indique des montants BRUTS. Cadence raisonne sur l'allocation journalière nette : ne recopie pas ces montants tels quels.",
  ],
};

/**
 * Justificatif de déclaration de situation mensuelle (actualisation) — structure vérifiée sur
 * plusieurs pièces réelles le 01/08/2026 (employeurs et montants ici FICTIFS, cf. avertissement en
 * tête de fichier). Exerce le piège le plus important de ce type de document : le MÊME employeur
 * apparaît deux fois dans le mois (une fois en cachet isolé, une fois sur une semaine) — deux
 * propositions "contrat" distinctes, jamais fusionnées. Le total mixte heures+cachets du bas de
 * document est rangé en "info_seule", jamais recopié dans un nbHeures/nbCachets individuel.
 */
export const extractionJustificatifDeclaration: ExtractionResult = {
  typeDocumentDetecte: "justificatif_declaration",
  propositions: [
    {
      cible: "contrat",
      donnees: {
        // Ni AEM ni bulletin de paie : ce document-type n'est ni l'un ni l'autre littéralement
        // (justificatif de déclaration mensuelle) — null est la bonne réponse, pas une devinette.
        natureDocumentSource: null,
        date: "2026-02-01",
        dateDebut: "2026-02-01",
        type: null,
        typeRemuneration: "cachet",
        territoire: null,
        nbCachets: 1,
        nbHeures: null,
        nbJoursEEE: null,
        salaireBrut: 181,
        employeur: "Orchestre Fictif de la Vallée",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", typeRemuneration: "haute", nbCachets: "haute", salaireBrut: "haute", employeur: "haute" },
      justification: "Encadré « Orchestre Fictif de la Vallée — Du 01 février 2026 au 01 février 2026 — Vous avez effectué 1 cachet(s) pour un montant de 181,00 € brut ».",
    },
    {
      // Même employeur que la proposition précédente, période DIFFÉRENTE plus tard dans le mois —
      // doit rester une proposition séparée, jamais fusionnée avec la première.
      cible: "contrat",
      donnees: {
        natureDocumentSource: null,
        date: "2026-02-15",
        dateDebut: "2026-02-10",
        type: null,
        typeRemuneration: "cachet",
        territoire: null,
        nbCachets: 6,
        nbHeures: null,
        nbJoursEEE: null,
        salaireBrut: 829,
        employeur: "Orchestre Fictif de la Vallée",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", typeRemuneration: "haute", nbCachets: "haute", salaireBrut: "haute", employeur: "haute" },
      justification: "Encadré « Orchestre Fictif de la Vallée — Du 10 février 2026 au 15 février 2026 — Vous avez effectué 6 cachet(s) pour un montant de 829,00 € brut ».",
    },
    {
      cible: "contrat",
      donnees: {
        natureDocumentSource: null,
        date: "2026-02-28",
        dateDebut: "2026-02-01",
        type: null,
        typeRemuneration: "heures",
        territoire: null,
        nbCachets: null,
        nbHeures: 21,
        nbJoursEEE: null,
        salaireBrut: 465,
        employeur: "Commune Fictive de Test",
        etablissementAgree: null,
        enRapportAvecMetier: null,
      },
      confiance: { date: "haute", dateDebut: "haute", typeRemuneration: "haute", nbHeures: "haute", salaireBrut: "haute", employeur: "haute" },
      justification: "Encadré « Commune Fictive de Test — Du 01 février 2026 au 28 février 2026 — Vous avez travaillé 21h pour un montant de 465,00 € brut ».",
    },
    {
      // Total du bas de document : mélange heures et cachets (équivalent-heures), jamais réutilisé
      // pour remplir un nbHeures/nbCachets individuel — cf. piège dédié dans api/extract-document.ts.
      cible: "info_seule",
      donnees: { totalActivitesMoisNombre: 3, totalActivitesMoisHeuresCachetsMelanges: "105 h (21 h + 7 cachet(s))", totalActivitesMoisMontantBrut: 1475 },
      confiance: { totalActivitesMoisNombre: "haute", totalActivitesMoisMontantBrut: "haute" },
      justification: "Encadré « Total des activités — 3 pour un employeur — 105 h (21 h + 7 cachet(s)) / 1475,00 € » en bas de document.",
    },
  ],
  avertissementsGeneraux: [
    "Ce document confirme des contrats généralement déjà saisis à la main : vérifie qu'aucune de ces propositions ne double un contrat que tu as déjà enregistré ce mois-ci avant de valider.",
  ],
};

/**
 * Attestation de taux de prélèvement à la source (espace personnel impots.gouv.fr) — document
 * dédié à cette seule information, distinct de la notification/du relevé (qui ne rapportent qu'UN
 * taux, cf. propositionOuvertureDroitsSchema). Ici l'attestation liste DEUX taux successifs : la
 * fixture fige le comportement attendu — DEUX propositions "taux_pas_historique" distinctes, jamais
 * une seule qui choisirait le taux le plus récent comme valeur "primaire" (gap documenté fermé pour
 * ce canal, cf. lib/routageExtraction.ts et CLAUDE.md). Chiffres et dates FICTIFS.
 */
export const extractionAttestationTauxPAS: ExtractionResult = {
  typeDocumentDetecte: "attestation_taux_pas",
  propositions: [
    {
      cible: "taux_pas_historique",
      donnees: { valeur: 2.9, dateEffet: "2025-01-01" },
      confiance: { valeur: "haute", dateEffet: "haute" },
      justification: "« Taux personnalisé : 2,90 %, applicable depuis le 01/01/2025 ».",
    },
    {
      cible: "taux_pas_historique",
      donnees: { valeur: 3.45, dateEffet: "2026-01-01" },
      confiance: { valeur: "haute", dateEffet: "haute" },
      justification: "« Taux personnalisé : 3,45 %, applicable depuis le 01/01/2026 ».",
    },
  ],
  avertissementsGeneraux: [],
};

/** Cas dégradé : document non reconnu, rien à proposer. L'écran doit rester lisible et honnête. */
export const extractionNonReconnue: ExtractionResult = {
  typeDocumentDetecte: "non_reconnu",
  propositions: [],
  avertissementsGeneraux: [
    "Le type de ce document n'a pas pu être identifié. Aucune donnée n'a été extraite — saisis les informations manuellement.",
  ],
};

export const FIXTURES_EXTRACTION: { id: string; libelle: string; resultat: ExtractionResult }[] = [
  { id: "notification", libelle: "Notification d'admission (tout applicable)", resultat: extractionNotificationAdmission },
  { id: "bulletin", libelle: "Bulletin de paie (champs manquants)", resultat: extractionBulletinPaie },
  { id: "aem_heures_et_cachets", libelle: "AEM (heures ET cachets sur le même contrat)", resultat: extractionAemHeuresEtCachets },
  { id: "aem_dupliquee", libelle: "AEM (bug réel : salaire dupliqué sur 2 propositions, avant fusion)", resultat: extractionAemDupliqueeHeuresCachets },
  { id: "releve", libelle: "Relevé de situation (2 refus + 1 à vérifier)", resultat: extractionReleveAvecRefus },
  { id: "justificatif_declaration", libelle: "Justificatif de déclaration mensuelle (même employeur 2×, à ne pas fusionner)", resultat: extractionJustificatifDeclaration },
  { id: "attestation_taux_pas", libelle: "Attestation de taux PAS (historique de 2 taux, jamais une seule valeur primaire)", resultat: extractionAttestationTauxPAS },
  { id: "non_reconnu", libelle: "Document non reconnu (rien à proposer)", resultat: extractionNonReconnue },
];
