// Source de texte UNIQUE du rappel « l'AEM fait foi, pas le bulletin de paie » — même principe que
// content/mentionEnvoiIA.ts : un seul fait, énoncé une seule fois, réutilisé partout où il doit
// apparaître, pour ne jamais dériver en deux formulations différentes du même avertissement.
//
// Ce fait ne change pas selon le canal d'import (local pdfjs ou IA Mistral) : c'est la phrase
// d'ENCADREMENT autour de lui qui diffère légitimement.
// - `components/ImportBulletins.tsx` (canal local) : rappel STATIQUE, toujours affiché au-dessus de
//   la zone de dépôt, quel que soit le document — l'app ne sait pas encore, avant lecture, si ce qui
//   sera déposé est une AEM ou un bulletin.
// - `components/RevueExtraction.tsx` (canal IA) : avertissement CONDITIONNEL, affiché seulement
//   quand `natureDocumentSource === "bulletin_paie"` (cf. types/extraction.ts, lib/routageExtraction.ts)
//   — l'extraction a déjà lu le document et peut donc cibler l'avertissement, jamais l'inverse
//   (silence sur une vraie AEM, ou un « non déterminé » resté honnête).
export const RAPPEL_AEM_FAIT_FOI = "La pièce qui fait foi auprès de France Travail est l'AEM (Attestation d'Employeur Mensuelle), pas le bulletin de paie.";
