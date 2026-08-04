// Source de texte UNIQUE de la mention affichée AVANT tout envoi d'un document à Mistral.
//
// Pourquoi ici et pourquoi une seule source : ce texte est la CONTREPARTIE d'une décision produit —
// dire à l'utilisateur, en clair et avant l'envoi, ce qui se passe de son document. Le texte n'est
// donc pas de la décoration : c'est l'engagement qui rend la décision acceptable. S'il dérive, se
// dilue ou disparaît d'un des endroits où il doit apparaître, la décision n'est plus tenue. Une seule
// source, testée mot pour mot (cf. lib/__tests__/mentionEnvoiIA.test.ts), et le même libellé recopié
// dans CLAUDE.md.
//
// ⚠️ NE PAS REFORMULER sans décision explicite.
//
// ✅ ÉTAT AU 04/08/2026 — la phrase sur l'entraînement est désormais VRAIE. Le point 9 est CLOS.
// Benoît a désactivé l'utilisation de ses données pour l'entraînement dans la console Mistral (menu
// Privacy : l'option a été décochée). Le plan gratuit autorise cet opt-out, et une fois confirmé
// Mistral n'utilise plus les entrées/sorties pour entraîner ses modèles — vérifié à la source le
// 04/08/2026 (help.mistral.ai/en/articles/455207). La bascule de MISTRAL_API_KEY sur le plan Scale
// n'a donc PAS été nécessaire : les deux chemins rendent la même phrase vraie, et le gratuit était
// immédiat. L'ancien report du 03/08/2026 est éteint — il n'y a plus d'écart à reporter.
//
// ⚠️ FAIT DÉCLARÉ PAR BENOÎT, QUE CADENCE NE PEUT PAS VÉRIFIER — même statut que
// `meta.dateDerniereVerification` : personne ici ne peut lire son compte Mistral. Si l'opt-out était
// annulé (changement de clé, de compte ou d'organisation Mistral), cette phrase redeviendrait fausse
// SANS que rien dans le code ne s'en aperçoive. À re-contrôler dans la console à chaque changement
// de clé, et c'est CE fichier qu'il faudrait corriger en premier — annoncer une absence
// d'entraînement qui n'est plus garantie serait aussi faux que taire un entraînement qui a lieu
// (devoir n°2, dans les deux sens).
//
// ⚠️ CE QUI N'EST TOUJOURS PAS VRAI, ET QUE LE TEXTE NE DIT DONC PAS : les documents restent
// CONSERVÉS jusqu'à 30 jours côté Mistral. Le Zero Data Retention n'existe que sur le plan Scale,
// qui n'a pas été pris. Ne JAMAIS ajouter au texte une phrase sur la non-conservation : elle serait
// fausse. Le texte ne promet que l'absence d'entraînement — exactement ce qui est acquis, ni plus.
//
// Le texte lui-même n'a pas changé depuis le 31/07/2026 : seule sa véracité a été acquise.
//
// Texte BRUT volontairement (même principe que content/contradictionHorsA10.ts) : ni balisage à
// parser, ni fragments à recoller. L'emphase reste l'affaire du composant.

/**
 * Le texte validé, en un seul morceau. C'est la référence : toute autre forme de présentation doit
 * pouvoir se recomposer exactement en cette chaîne, sans un mot de plus ni de moins.
 */
export const MENTION_ENVOI_IA_INTEGRALE =
  "Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France, hébergement UE) pour lecture automatique. Ces documents ne sont pas utilisés pour entraîner les modèles de Mistral. Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte jamais ton appareil.";

/**
 * Le même texte découpé en trois phrases, pour l'aération typographique de la modale — jamais pour
 * en montrer une partie seulement. La concaténation est vérifiée par test contre
 * `MENTION_ENVOI_IA_INTEGRALE` : impossible d'en perdre un morceau en chemin.
 *
 * [0] ce qui se passe · [1] la conséquence (la phrase qui coûte) · [2] l'alternative gratuite
 */
export const MENTION_ENVOI_IA_PHRASES = [
  "Import assisté par IA (Mistral) — ce document est envoyé aux serveurs de Mistral AI (France, hébergement UE) pour lecture automatique.",
  "Ces documents ne sont pas utilisés pour entraîner les modèles de Mistral.",
  "Si tu préfères l'éviter, la saisie manuelle reste gratuite et ne quitte jamais ton appareil.",
] as const;

/**
 * Rappel APRÈS coup, sur l'écran de revue : au passé, puisque l'envoi a déjà eu lieu. Volontairement
 * distinct de la mention principale — celle-ci sert à décider avant, celui-là à se souvenir après.
 * Ne jamais l'afficher pour une extraction simulée : rien n'aurait été envoyé, la phrase serait
 * fausse (devoir n°2).
 */
export const RAPPEL_DOCUMENT_ENVOYE =
  "Ce document a été envoyé à Mistral AI (France, hébergement UE) pour lecture automatique. Ce document n'est pas utilisé pour entraîner les modèles de Mistral.";

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
