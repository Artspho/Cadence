/**
 * Source de texte UNIQUE des mentions légales et de la politique de confidentialité.
 *
 * Prérequis posé par Benoît le 04/08/2026 (arbitrage 7 de la refonte Supabase) : « mentions légales +
 * politique de confidentialité minimales AVANT la phase 6 » — les documents des testeurs (notification
 * ARE, bulletins, potentiellement porteurs du NIR) allaient vivre sur un serveur qu'il gère. Rédigé le
 * 05/08/2026, avant tout code de stockage de documents (phase 6).
 *
 * ⚠️ « CADRE LÉGAL LÉGER » (mots de Benoît) : ce n'est pas un site commercial public, c'est une bêta
 * entre amis, sur invitation. Le texte reste minimal et honnête plutôt que de simuler un luxe
 * juridique qui ne correspond pas à la réalité du projet.
 *
 * ⚠️ CE TEXTE DOIT RESTER VRAI, PAS SEULEMENT RASSURANT (devoir n°2). En particulier :
 *  - le titulaire du compte Supabase (Benoît) peut TECHNIQUEMENT lire les données de tous les
 *    testeurs (RLS protège les testeurs les uns des autres, pas de lui — cf.
 *    supabase/migrations/0001_schema_et_rls.sql) : la réserve du point 6 des arbitrages, enfin levée ;
 *  - aucun outil de mesure d'audience ni cookie publicitaire n'existe dans ce dépôt (vérifié : aucune
 *    dépendance analytics/tracker) — à re-vérifier si un jour l'un d'eux est ajouté.
 *
 * ⚠️⚠️ DÉCISION EXPLICITE DE BENOÎT, PAS UN OUBLI (05/08/2026) : le paragraphe sur l'import IA NE DIT
 * PLUS que Mistral conserve les documents envoyés jusqu'à 30 jours (pas de Zero Data Retention sur le
 * plan gratuit, cf. content/mentionEnvoiIA.ts, qui lui continue de le dire — CE FAIT RESTE VRAI,
 * seul CE TEXTE-CI ne le mentionne plus). Rédigé une première fois avec cette phrase ; retrait demandé
 * par Benoît (« NON NÉGOCIABLE ») après qu'il ait été prévenu que ça affaiblit le caractère « informé »
 * du consentement décrit juste au-dessus dans ce même document. Ne pas la remettre sans lui redemander
 * — et ne jamais, à l'inverse, écrire que Mistral ne conserve rien : ce serait alors une contre-vérité,
 * pas seulement une omission.
 *
 * Texte BRUT volontairement (même principe que content/mentionEnvoiIA.ts et
 * content/contradictionHorsA10.ts) : pas de balisage à parser, l'emphase reste l'affaire du composant.
 */

export const CONTACT_LEGAL = "cadence@lesartsphoceens.fr";

/**
 * VERSION DU TEXTE, telle qu'elle est conservée dans la preuve de consentement (table
 * `consentements`, migration 0004). Sans elle, la preuve ne dirait pas à QUOI la personne a
 * consenti — donc ne prouverait rien.
 *
 * ⚠️ À INCRÉMENTER DÈS QUE `POLITIQUE_CONFIDENTIALITE` CHANGE SUR LE FOND (ce qui est collecté, où
 * c'est hébergé, qui peut le lire, à qui c'est transmis). Un consentement recueilli sur l'ancien
 * texte ne vaut pas pour le nouveau : changer cette valeur fait redemander la case aux comptes déjà
 * créés, ce qui est exactement l'effet voulu. Une correction de pure forme (faute de frappe,
 * reformulation sans changement de sens) ne la touche PAS — sinon plus personne ne la ferait
 * évoluer quand il le faut vraiment.
 *
 * Format : la date de la version, en ISO. Lisible dans la base sans avoir à consulter le code.
 */
export const VERSION_POLITIQUE = "2026-08-05";

export interface SectionLegale {
  titre: string;
  paragraphes: string[];
}

export const MENTIONS_LEGALES: SectionLegale[] = [
  {
    titre: "Éditeur",
    paragraphes: [
      "Cadence est édité par l'association Les Arts Phocéens.",
      `Contact : ${CONTACT_LEGAL}`,
      "Adresse postale : communicable sur demande, à l'adresse ci-dessus.",
    ],
  },
  {
    titre: "Directeur de la publication",
    paragraphes: ["Le représentant légal de l'association Les Arts Phocéens."],
  },
  {
    titre: "Hébergement",
    paragraphes: [
      "L'application est hébergée par Vercel Inc. (vercel.com).",
      "Les données (profil, contrats, documents) sont hébergées par Supabase, sur des serveurs situés à Paris (France, Union européenne).",
    ],
  },
];

export const POLITIQUE_CONFIDENTIALITE: SectionLegale[] = [
  {
    titre: "Qui est responsable de tes données",
    paragraphes: [`L'association Les Arts Phocéens est responsable du traitement de tes données dans Cadence. Pour toute question ou pour exercer tes droits, écris à ${CONTACT_LEGAL}.`],
  },
  {
    titre: "Ce que Cadence garde, et pourquoi",
    paragraphes: [
      "Ton adresse e-mail, pour te permettre de te connecter.",
      "Ton profil, tes contrats, tes périodes particulières et tes exercices : pour calculer où tu en es dans tes droits Annexe 10.",
      "Si tu utilises les frais réels : tes dépenses et tes biens amortis.",
      "Les documents que tu choisis de déposer (notification d'admission, bulletins de paie, relevés de situation, justificatifs de frais) — certains peuvent porter des informations sensibles, comme ton numéro de sécurité sociale.",
    ],
  },
  {
    titre: "Pourquoi ces données",
    paragraphes: ["Uniquement pour t'aider à suivre tes droits et à t'organiser. Cadence n'est pas un service officiel de France Travail et ne lui transmet rien."],
  },
  {
    titre: "Sur quelle base",
    paragraphes: ["Ton consentement, donné explicitement à l'inscription."],
  },
  {
    titre: "Où c'est hébergé",
    paragraphes: [
      "Chez Supabase, sur des serveurs situés à Paris (France, Union européenne).",
      "Si tu utilises l'import assisté par IA : le document que tu choisis d'envoyer est aussi transmis à Mistral AI (France, hébergement UE) pour en extraire automatiquement les informations. Ces documents ne sont pas utilisés pour entraîner les modèles de Mistral. Tu peux toujours préférer la saisie manuelle, qui ne quitte jamais ton appareil.",
    ],
  },
  {
    titre: "Qui peut techniquement voir quoi",
    paragraphes: [
      "Chaque testeur ne voit que ses propres données : une protection technique, activée au niveau de la base de données, empêche un testeur de voir ou modifier les données d'un autre.",
      "Cette protection ne s'applique pas au titulaire du compte technique de l'association (Supabase), qui peut, techniquement, accéder à l'ensemble des données hébergées. Cet accès n'est utilisé que pour la maintenance du service, jamais pour consulter le contenu des documents de qui que ce soit.",
    ],
  },
  {
    titre: "Combien de temps",
    paragraphes: [`Tant que ton compte existe. Tu peux à tout moment demander la suppression de ton compte et de tes données à ${CONTACT_LEGAL}.`],
  },
  {
    titre: "Tes droits",
    paragraphes: [
      `Accès, rectification, effacement, portabilité, opposition : écris à ${CONTACT_LEGAL}.`,
      "Tu peux aussi exporter toi-même toutes tes données à tout moment, au format JSON, depuis le bouton « Exporter mes données ».",
    ],
  },
  {
    titre: "Cookies et traceurs",
    paragraphes: ["Cadence n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Le stockage utilisé (navigateur et serveur) sert uniquement à faire fonctionner l'application et à te garder connecté."],
  },
];
