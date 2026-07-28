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

const ECHEC_GENERIQUE = "L'extraction a échoué. Réessaie, ou saisis le document à la main.";
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
 * Le SEUL statut dont on accepte de réafficher le message : le 503 que notre endpoint renvoie quand
 * `MISTRAL_API_KEY` est absente. C'est le seul cas où le message générique serait activement
 * trompeur, puisqu'il invite à réessayer alors que réessayer n'y changera jamais rien.
 *
 * Liste blanche et non liste noire, volontairement : entre nous et l'endpoint peuvent se glisser un
 * proxy, un CDN, un tunnel de dev, qui renvoient leurs propres 500/502/504 avec leur propre corps.
 * Tout ce qui n'est pas explicitement à nous retombe sur le message générique.
 */
const STATUTS_AU_MESSAGE_MAITRISE = new Set([503]);

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
  if (!STATUTS_AU_MESSAGE_MAITRISE.has(reponse.status)) return ECHEC_GENERIQUE;
  try {
    const corps = (await reponse.json()) as unknown;
    if (corps && typeof corps === "object" && "error" in corps) {
      const message = (corps as { error: unknown }).error;
      if (messageMontrable(message)) return message;
    }
  } catch {
    // Corps illisible ou non-JSON : on retombe sur le message générique, sans rien exposer.
  }
  return ECHEC_GENERIQUE;
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
