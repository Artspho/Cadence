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
      confiance: { date: "haute", dateDebut: "moyenne", salaireBrut: "haute", employeur: "haute" },
      justification: "Période d'emploi en en-tête ; brut total au bas du bulletin.",
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
 * Cas des refus : chaque proposition ici doit être affichée SANS être appliquée.
 * Sert à vérifier qu'aucune de ces trois situations ne peut produire un chiffre faux.
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
      // Refus n°2 : l'app n'a pas d'écran pour enregistrer une période assimilée.
      cible: "periode_assimilee",
      donnees: { type: "accident_travail", dateDebut: "2026-04-06", dateFin: "2026-04-24" },
      confiance: { type: "haute", dateDebut: "haute", dateFin: "haute" },
      justification: "Mention « accident du travail » avec dates de suspension, page 1.",
    },
    {
      // Refus n°3 : ouverture de droits incomplète — franchise et délai absents.
      cible: "profil_ouverture_droits",
      donnees: {
        dateOuverture: "2026-03-01",
        franchiseCPTotale: null,
        delaiAttenteInitial: null,
        dateLimiteIndemnisation: null,
        tauxPrelevementSource: 5.4,
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
  { id: "releve", libelle: "Relevé de situation (3 refus)", resultat: extractionReleveAvecRefus },
  { id: "non_reconnu", libelle: "Document non reconnu (rien à proposer)", resultat: extractionNonReconnue },
];
