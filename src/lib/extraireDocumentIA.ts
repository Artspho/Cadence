/**
 * SEUL chemin réseau de l'import assisté par IA côté navigateur.
 *
 * Deux invariants, chacun protégeant un devoir sacré :
 *
 * 1. **Ne doit être appelé que depuis le gestionnaire « Envoyer ce document » de
 *    `components/ConsentementEnvoiIA.tsx`.** Le consentement n'est pas un avertissement posé à côté
 *    du chemin : il EST le chemin. Toute autre origine d'appel enverrait un document sans que
 *    l'utilisateur ait vu la mention, ce qui casse la contrepartie de la décision du 28/07/2026
 *    (cf. `content/mentionEnvoiIA.ts`).
 *
 * 2. **Appelle notre propre endpoint, jamais `api.mistral.ai` directement.** La clé API ne doit
 *    jamais exister côté navigateur — c'est précisément le défaut du brouillon
 *    `docs/files/ImportDocumentIA.jsx`, qui appelait Mistral depuis la page avec la clé saisie dans
 *    un `<input>`. Testé explicitement (cf. `__tests__/extraireDocumentIA.test.ts`).
 *
 * La réponse est revalidée avec le schéma partagé : le serveur valide déjà, mais un front qui fait
 * confiance à ce qui arrive du réseau finirait par afficher n'importe quelle forme comme si c'était
 * une proposition sûre. Une réponse mal formée ne produit AUCUNE proposition — jamais une
 * proposition partielle, qui donnerait l'illusion d'une lecture réussie (devoir n°2).
 */

import { extractionResultSchema, type ExtractionResult } from "../types/extraction";

export const ENDPOINT_EXTRACTION = "/api/extract-document";

/**
 * Le repli, quand le corps de la réponse n'est pas un texte que nous avons rédigé.
 *
 * ⚠️ LE CODE HTTP EST AFFICHÉ, ET C'EST LE 06/08/2026 QUI L'A IMPOSÉ. Benoît a signalé « l'import IA
 * ne marche plus » avec, pour seule information, « L'extraction a échoué. Réessaie ». Impossible d'en
 * déduire quoi que ce soit : le même texte couvrait un dépassement de délai, une erreur de Mistral, un
 * refus de proxy et un mauvais verbe HTTP. Sonder l'endpoint au `curl` a été nécessaire pour éliminer
 * la moitié des hypothèses — un utilisateur, lui, n'a pas ce recours.
 *
 * Le code est un nombre lu sur la réponse, pas un extrait de corps : il ne peut donc rien divulguer du
 * document ni d'une adresse interne, contrairement au corps lui-même (cf. `messageMontrable`).
 */
function echecGenerique(statut?: number): string {
  const code = statut === undefined ? "" : ` (code ${statut})`;
  return `L'extraction a échoué${code}. Réessaie, ou saisis le document à la main.`;
}
const REPONSE_INATTENDUE =
  "Le service d'extraction a répondu quelque chose d'inattendu. Aucune proposition n'a été retenue — saisis le document à la main.";
/**
 * `fetch` rejette (hors ligne, connexion coupée, DNS). Formulation prudente à dessein : une coupure
 * peut survenir APRÈS que le corps de la requête soit parti, donc on n'affirme pas « ton document
 * n'a pas été transmis » — ce serait rassurant et potentiellement faux. On dit seulement ce qu'on
 * sait : rien n'est revenu.
 */
const ECHEC_RESEAU =
  "Le service d'extraction n'a pas pu être joint (connexion interrompue). Aucune proposition n'a été reçue — réessaie, ou saisis les informations à la main.";

/**
 * Les SEULS statuts dont on accepte de réafficher le message : ceux dont NOUS écrivons le texte.
 *
 *  · **503** — `MISTRAL_API_KEY` absente côté serveur (réessayer n'y changera jamais rien) ;
 *  · **422** — l'OCR n'a rien pu extraire (`OcrIllisibleError`, cf. lib/ocrIllisible.ts). Doit
 *    s'afficher différemment de « rien d'exploitable dedans », pour que l'utilisateur sache qu'il
 *    s'agit d'un échec de LECTURE et pas d'un document sans intérêt ;
 *  · **413 / 403 / 400** — les trois refus de `lib/gardeEndpointExtraction.ts`.
 *
 * ⚠️ LES TROIS DERNIERS ONT ÉTÉ AJOUTÉS LE 06/08/2026, ET C'ÉTAIT UN VRAI DÉFAUT, PAS UN CONFORT.
 * Benoît a vu « L'extraction a échoué. Réessaie, ou saisis le document à la main. » sans pouvoir
 * savoir pourquoi. Or dans ces trois cas le serveur avait rédigé une raison exacte — « Ce document
 * pèse 4,2 Mo, au-delà de la limite de 3,0 Mo », « Cette requête ne vient pas d'une origine
 * autorisée » — et le client la jetait pour afficher **« Réessaie »**, qui est un conseil FAUX :
 * aucun de ces trois refus ne change au deuxième essai. Un message qui envoie sur une fausse piste
 * est du même ordre qu'un chiffre faux (devoir n°2), et celui-là faisait chercher une panne
 * inexistante.
 *
 * Liste blanche et non liste noire, volontairement, et **les 5xx restent dehors** : entre nous et
 * l'endpoint peuvent se glisser un proxy, un CDN, un tunnel de dev, qui renvoient leurs propres
 * 500/502/504 avec leur propre corps. Le 500 de notre endpoint porte de toute façon déjà un texte
 * générique, il n'y a rien à y gagner. `messageMontrable` reste le dernier filtre pour tous.
 */
const STATUTS_AU_MESSAGE_MAITRISE = new Set([503, 422, 413, 403, 400]);

/**
 * Un message que l'on accepte de montrer : non vide, de longueur raisonnable, et sans chevrons —
 * aucune de nos phrases n'en contient, alors qu'une page d'erreur HTML en est faite. Garde-fou de
 * dernier recours si un intermédiaire répondait un 503 avec son propre corps.
 */
function messageMontrable(message: unknown): message is string {
  return typeof message === "string" && message.trim() !== "" && message.length <= 400 && !/[<>]/.test(message);
}

/**
 * Récupère le message d'erreur de notre endpoint (`{ error: string }`) quand — et seulement quand —
 * il s'agit d'un cas dont nous maîtrisons le texte. On ne recopie jamais à l'écran un corps de
 * réponse d'origine inconnue : ni page d'erreur de proxy, ni trace technique, ni adresse interne.
 */
async function lireMessageErreur(reponse: Response): Promise<string> {
  if (!STATUTS_AU_MESSAGE_MAITRISE.has(reponse.status)) return echecGenerique(reponse.status);
  try {
    const corps = (await reponse.json()) as unknown;
    if (corps && typeof corps === "object" && "error" in corps) {
      const message = (corps as { error: unknown }).error;
      if (messageMontrable(message)) return message;
    }
  } catch {
    // Corps illisible ou non-JSON : on retombe sur le message générique, sans rien exposer.
  }
  return echecGenerique(reponse.status);
}

export async function extraireDocumentIA(pdfBase64: string): Promise<ExtractionResult> {
  // Cette fonction ne doit JAMAIS laisser échapper une erreur dont le message vient d'ailleurs que
  // d'ici : son appelant (ImportDocumentIA.tsx) affiche `error.message` tel quel à l'utilisateur, en
  // se fiant à cette garantie. D'où les deux enveloppes ci-dessous — sans elles, un « Failed to
  // fetch » ou un « Unexpected token '<' » du moteur JS atterrirait à l'écran.
  let reponse: Response;
  try {
    reponse = await fetch(ENDPOINT_EXTRACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfBase64 }),
    });
  } catch {
    throw new Error(ECHEC_RESEAU);
  }

  if (!reponse.ok) {
    throw new Error(await lireMessageErreur(reponse));
  }

  // Un 200 ne garantit pas du JSON : une réécriture mal configurée, un portail captif ou un CDN
  // peuvent répondre 200 avec une page HTML. `json()` lèverait alors une SyntaxError technique.
  let brut: unknown;
  try {
    brut = (await reponse.json()) as unknown;
  } catch {
    throw new Error(REPONSE_INATTENDUE);
  }

  const valide = extractionResultSchema.safeParse(brut);
  if (!valide.success) {
    throw new Error(REPONSE_INATTENDUE);
  }
  return valide.data;
}
