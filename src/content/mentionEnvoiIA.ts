// Source de texte UNIQUE de la mention affichée AVANT tout envoi d'un document à Mistral.
//
// Pourquoi ici et pourquoi une seule source : ce texte est la CONTREPARTIE d'une décision produit
// (28/07/2026) — rester sur le tier gratuit Mistral « Experiment », où les documents envoyés peuvent
// servir à entraîner les modèles, à condition que ce soit dit à l'utilisateur en clair et avant
// l'envoi. Le texte n'est donc pas de la décoration : c'est l'engagement qui rend la décision
// acceptable. S'il dérive, se dilue ou disparaît d'un des endroits où il doit apparaître, la
// décision n'est plus tenue. Une seule source, testée mot pour mot (cf.
// lib/__tests__/mentionEnvoiIA.test.ts), et le même libellé recopié dans CLAUDE.md.
//
// ⚠️ NE PAS REFORMULER sans décision explicite. Et si l'offre Mistral change (passage à une clé
// payante, où l'engagement de non-entraînement s'applique), c'est CE fichier qu'il faut corriger en
// premier : annoncer un entraînement qui n'a plus lieu serait aussi faux que taire celui qui a lieu.
//
// Texte BRUT volontairement (même principe que content/contradictionHorsA10.ts) : ni balisage à
// parser, ni fragments à recoller. L'emphase reste l'affaire du composant.

/**
 * Le texte validé, en un seul morceau. C'est la référence : toute autre forme de présentation doit
 * pouvoir se recomposer exactement en cette chaîne, sans un mot de plus ni de moins.
 */
export const MENTION_ENVOI_IA_INTEGRALE =
  "Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France, hébergement UE) pour lecture automatique. Sur l'offre que nous utilisons actuellement, Mistral peut utiliser ce document pour entraîner ses modèles d'IA. Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte jamais ton appareil.";

/**
 * Le même texte découpé en trois phrases, pour l'aération typographique de la modale — jamais pour
 * en montrer une partie seulement. La concaténation est vérifiée par test contre
 * `MENTION_ENVOI_IA_INTEGRALE` : impossible d'en perdre un morceau en chemin.
 *
 * [0] ce qui se passe · [1] la conséquence (la phrase qui coûte) · [2] l'alternative gratuite
 */
export const MENTION_ENVOI_IA_PHRASES = [
  "Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France, hébergement UE) pour lecture automatique.",
  "Sur l'offre que nous utilisons actuellement, Mistral peut utiliser ce document pour entraîner ses modèles d'IA.",
  "Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte jamais ton appareil.",
] as const;

/**
 * Rappel APRÈS coup, sur l'écran de revue : au passé, puisque l'envoi a déjà eu lieu. Volontairement
 * distinct de la mention principale — celle-ci sert à décider avant, celui-là à se souvenir après.
 * Ne jamais l'afficher pour une extraction simulée : rien n'aurait été envoyé, la phrase serait
 * fausse (devoir n°2).
 */
export const RAPPEL_DOCUMENT_ENVOYE =
  "Ce document a été envoyé à Mistral AI (France, hébergement UE) pour lecture automatique. Sur l'offre que nous utilisons actuellement, il peut servir à entraîner leurs modèles d'IA.";

/**
 * Annonce du canal, affichée en permanence sur la zone de dépôt — AVANT même de choisir un fichier,
 * pour que l'utilisateur sache ce que fait ce bouton avant de cliquer. Volontairement une phrase à
 * elle seule, et non un extrait de `MENTION_ENVOI_IA_PHRASES` : cette liste ne doit jamais être
 * montrée en partie (le détail se lit d'un bloc, dans la modale, au moment de décider).
 */
export const ANNONCE_CANAL_IA =
  "Ce canal envoie ton document à un serveur pour le faire lire automatiquement. Le détail — destinataire, hébergement, usage — t'est présenté avant chaque envoi, et rien ne part sans ton accord.";

/** Libellés des deux issues de la modale. L'annulation nomme l'alternative, elle ne dit pas « non ». */
export const LIBELLE_ENVOYER = "Envoyer ce document";
export const LIBELLE_ANNULER = "Annuler — saisir à la main";
