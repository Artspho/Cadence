// Inventaire STATIQUE des documents utiles à Cadence — à ne pas confondre avec
// `lib/documentsRequis.ts` (la checklist DYNAMIQUE de l'espace dépôt, qui lit l'état réel du
// profil pour dire ce qu'il manque). Celui-ci répond à une question différente et antérieure :
// « qu'est-ce que je dois rassembler, avant même d'avoir commencé à remplir Cadence ? » — une
// référence à lire une fois, pas un statut qui bouge avec la saisie.
//
// Sources croisées pour cet inventaire (toutes déjà dans le dépôt, aucune supposition) :
//   - docs/files/inventaire_donnees_et_documents.md — le tableau des besoins (§3) et l'audit de
//     couverture IA type par type (§5), tous deux vérifiés contre le code le 29/07/2026.
//   - lib/documentsRequis.ts — quelles données sont réellement réclamées, et pourquoi certaines
//     ne le sont volontairement pas.
//   - CLAUDE.md — état de la Phase 3 « périodes assimilées » (écran de saisie manuel committé,
//     `PeriodeForm.tsx`/`PeriodeList.tsx`), qui corrige un point périmé de l'inventaire ci-dessus :
//     une attestation CPAM a désormais une case d'arrivée (saisie manuelle), même si le canal IA
//     continue de la refuser (aucun lexique dédié, piège ald/maladie_intercontrat non tranchable).
//
// La « déclaration fiscale annuelle » n'apparaît volontairement pas ici : décision actée du
// 29/07/2026 (inventaire_donnees_et_documents.md §6.1) — son seul champ atteignable
// (`tauxPrelevementSource`) a déjà deux sources plus fiables (notification, relevé), et le reste
// du document n'a aucune case d'arrivée dans Cadence. L'inclure inviterait à rassembler une pièce
// pour un gain nul.

export type RoleDocument = "indispensable" | "utile" | "complement";

export type CanalDocument =
  /** Le canal « Importer avec l'IA » reconnaît ce document et sait quoi en tirer. */
  | "ia_possible"
  /** Le canal IA ne reconnaît pas ce document aujourd'hui : saisie manuelle uniquement. */
  | "manuel_uniquement";

export interface DocumentUtile {
  id: string;
  nom: string;
  /** À quoi sert ce document dans Cadence — jamais un jargon administratif seul. */
  pourquoi: string;
  role: RoleDocument;
  canal: CanalDocument;
  /** Nuance sur le canal ou sur la fiabilité — affichée telle quelle, jamais éludée. */
  noteCanal: string;
}

export interface GroupeDocumentsUtiles {
  titre: string;
  documents: DocumentUtile[];
}

export const GROUPES_DOCUMENTS_UTILES: GroupeDocumentsUtiles[] = [
  {
    titre: "Toujours utile",
    documents: [
      {
        id: "notification_admission",
        nom: "Notification d'admission ARE",
        pourquoi:
          "Le document le plus décisif de tout ton dossier : à lui seul, il donne la plupart des chiffres dont Cadence a besoin — ton allocation journalière nette, les dates de ton ouverture de droits, ta date anniversaire.",
        role: "indispensable",
        canal: "ia_possible",
        noteCanal: "Le mieux lu par le canal IA aujourd'hui — vérifie quand même chaque valeur avant de l'enregistrer.",
      },
      {
        id: "bulletins_aem",
        nom: "Bulletins de paie ou AEM",
        pourquoi:
          "Chaque mois travaillé alimente ton compteur vers les 507 h. Un mois oublié rend le compteur incomplet sans que Cadence puisse le deviner.",
        role: "indispensable",
        canal: "ia_possible",
        noteCanal: "Lu par le canal IA, mais cette lecture n'a encore jamais été confirmée sur un vrai document — relis toujours le résultat.",
      },
      {
        id: "releve_situation",
        nom: "Relevé de situation",
        pourquoi:
          "Utile pour recouper tes chiffres mois après mois, et il porte parfois la date limite de ton indemnisation si elle manque ailleurs.",
        role: "utile",
        canal: "ia_possible",
        noteCanal: "Attention : le montant qu'il affiche est presque toujours BRUT. Pour l'allocation nette, utilise ta notification.",
      },
    ],
  },
  {
    titre: "Si tu enseignes",
    documents: [
      {
        id: "contrat_enseignement",
        nom: "Contrat d'enseignement",
        pourquoi:
          "Seule source pour savoir si ton établissement est agréé et si ton enseignement est en rapport avec ton métier d'artiste — les deux conditions qui déterminent si ces heures comptent dans tes 507 h.",
        role: "indispensable",
        canal: "manuel_uniquement",
        noteCanal: "Pas encore lu par le canal IA — les deux cases se cochent à la main dans le formulaire du contrat.",
      },
    ],
  },
  {
    titre: "Si tu as eu un arrêt maladie longue durée, un accident du travail, ou un congé maternité / adoption",
    documents: [
      {
        id: "attestation_cpam",
        nom: "Attestation CPAM ou notification de la Sécurité sociale",
        pourquoi: "Ces périodes comptent 5 h/jour dans tes 507 h et peuvent allonger ta fenêtre de référence.",
        role: "indispensable",
        canal: "manuel_uniquement",
        noteCanal: "Pas encore lu par le canal IA — saisis la période toi-même dans Mon profil, section « Périodes particulières ».",
      },
    ],
  },
  {
    titre: "Si ton taux de prélèvement à la source ne figure pas déjà sur ta notification",
    documents: [
      {
        id: "attestation_taux",
        nom: "Attestation de taux de prélèvement à la source",
        pourquoi: "Sans lui, Cadence affiche tes montants mensuels en brut, sans version nette.",
        role: "complement",
        canal: "manuel_uniquement",
        noteCanal: "Ce document précis n'est pas reconnu par le canal IA — mais le taux figure aussi sur ta notification ou ton relevé, eux bien couverts.",
      },
    ],
  },
];
