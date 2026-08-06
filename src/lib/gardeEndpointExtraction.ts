// Garde de `/api/extract-document` — point 8 de docs/critique_2026-08-03.md, phase 0 de la refonte.
//
// POURQUOI CE FICHIER. Le handler acceptait n'importe quel POST : aucun contrôle d'origine, aucun
// quota, et surtout **aucun contrôle de taille côté serveur** — la limite de 3 Mo n'existait que dans
// le navigateur (`lib/fichierImportIA.ts`), donc contournable par un `curl`. Conséquence directe et
// non théorique : quiconque connaît l'URL peut faire tourner la facture Mistral, et les endpoints
// publics sont scannés automatiquement. La fiche du point 8 conclut « ne pas déployer publiquement
// en l'état » — or la refonte Supabase ouvre l'app à des bêta-testeurs, donc l'échéance est là.
//
// POURQUOI DANS `src/lib/` ET PAS DANS `api/`. Les tests ne couvrent que `src/**` (cf. `include` dans
// vite.config.ts). Une garde placée dans `api/` serait non testée — et une garde non testée sur le
// chemin qui protège une facture n'a aucune valeur de preuve. Même convention que `lib/ocrIllisible.ts`,
// déjà importé par `api/extract-document.ts`.
//
// ⚠️ CE QUE CETTE GARDE NE FAIT PAS ENCORE (07/08/2026). À lire avant de la croire suffisante
// (devoir n°2 : dire la bonne raison, et ne pas afficher un faux feu vert) :
//
//   1. AUCUN QUOTA. Reporté délibérément (demande explicite de Benoît le 07/08/2026, une fois
//      l'authentification posée) : un quota réel exige un compteur PARTAGÉ entre les instances — le
//      runtime Edge est sans état, et le projet n'a ni KV ni Redis. Il s'adossera à la base Supabase
//      et à l'identité que l'authentification ci-dessous fournit désormais.
//
//   2. LE CONTRÔLE D'ORIGINE N'EST PAS UNE SERRURE. Il arrête un navigateur qui appellerait
//      l'endpoint depuis un autre site (l'en-tête `Origin` est posé par le navigateur, une page ne
//      peut pas mentir dessus). Il n'arrête pas un `curl` qui forge l'en-tête à la main. C'est une
//      réduction de surface réelle contre l'abus opportuniste — la VRAIE serrure est
//      `verifierAuthentification` ci-dessous : un jeton de session valide, lui, ne se forge pas.

import { TAILLE_MAX_PDF_OCTETS } from "./fichierImportIA";

/**
 * Origines acceptées par défaut, quand la variable d'environnement n'est pas posée.
 *
 * L'URL de BRANCHE, et pas une URL de déploiement : c'est l'origine canonique du projet (les URLs de
 * déploiement changent à chaque build et cloisonnent le stockage — c'est déjà ce qui a fait perdre
 * des contrats une fois). Un défaut plutôt qu'une exigence de configuration : une variable oubliée
 * dans Vercel casserait l'import IA sans que rien ne l'explique, et « configuration manquante » est
 * un mauvais message quand on peut simplement connaître la bonne valeur.
 */
export const ORIGINES_AUTORISEES_PAR_DEFAUT = ["https://cadence-git-master-benoit3.vercel.app"] as const;

/**
 * Longueur maximale de la charge base64 acceptée, **dérivée** de la limite client plutôt que saisie
 * à nouveau : base64 encode 3 octets sur 4 caractères. Un second chiffre en dur finirait par
 * diverger du premier, et c'est le navigateur qui annonce la limite à l'utilisateur — les deux
 * doivent parler du même seuil.
 */
export const LONGUEUR_MAX_BASE64 = Math.ceil(TAILLE_MAX_PDF_OCTETS / 3) * 4;

/**
 * Taille du document reçu, en octets, déduite de la longueur de sa charge base64.
 *
 * Le remplissage final (`=`, une ou deux fois) représente 1 ou 2 octets de moins que ce que la
 * longueur suggère : on le retire pour ne pas annoncer une taille supérieure à la réalité. L'écart
 * résiduel est nul — c'est un calcul exact pour toute charge base64 bien formée.
 */
export function tailleDocumentDepuisBase64(base64: string): number {
  const remplissage = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - remplissage;
}

/**
 * Lit la liste d'origines depuis une variable d'environnement (valeurs séparées par des virgules).
 *
 * Absente ou vide → le défaut ci-dessus, jamais une liste vide : une liste vide refuserait tout, et
 * un refus général provoqué par une variable oubliée est indiscernable d'une attaque dans les logs.
 * La barre oblique finale est retirée, parce qu'un en-tête `Origin` n'en porte jamais et qu'une
 * valeur recopiée depuis la barre d'adresse en porte souvent une.
 */
export function lireOriginesAutorisees(brut: string | undefined): string[] {
  const declarees = (brut ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o.length > 0);
  return declarees.length > 0 ? declarees : [...ORIGINES_AUTORISEES_PAR_DEFAUT];
}

/**
 * Origine de développement local, acceptée quel que soit le port (5173 en `dev`, 4173 en `preview`,
 * et tout autre port si celui-là est déjà pris).
 *
 * Accepter localhost n'affaiblit pas la garde : quelqu'un qui forge un en-tête `Origin` peut aussi
 * bien y écrire l'URL de production. Le contrôle d'origine ne vise pas ce cas (cf. l'en-tête de ce
 * fichier), et refuser localhost ne coûterait que le confort de développement.
 */
function estOrigineLocale(origine: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine);
}

export function origineAutorisee(origine: string | null, autorisees: string[]): boolean {
  if (origine === null || origine === "") return false;
  const normalisee = origine.replace(/\/+$/, "");
  return estOrigineLocale(normalisee) || autorisees.includes(normalisee);
}

/**
 * Verdict d'une requête. Le statut HTTP fait partie du verdict, et non du handler : le code du
 * refus est une décision de sécurité (403 « je sais qui tu es et c'est non » vs 413 « trop gros »),
 * pas un détail de transport. Le rendre testable évite qu'il dérive silencieusement.
 */
export type VerdictRequete = { ok: true } | { ok: false; statut: 400 | 403 | 413; erreur: string };

function enMegaoctets(octets: number): string {
  return (octets / (1024 * 1024)).toFixed(1).replace(".", ",");
}

/**
 * Contrôle une requête d'extraction avant tout appel à Mistral.
 *
 * ORDRE DÉLIBÉRÉ : l'origine d'abord, la charge ensuite. Un appelant non autorisé doit être refusé
 * sans qu'on inspecte son contenu, et surtout sans qu'un octet ne parte chez Mistral.
 *
 * Les messages d'erreur ne contiennent JAMAIS un fragment du document (même règle que le handler,
 * cf. api/extract-document.ts, cas 3) : seulement des tailles et des raisons.
 */
export function verifierRequeteExtraction(params: {
  origine: string | null;
  pdfBase64: unknown;
  originesAutorisees: string[];
}): VerdictRequete {
  if (!origineAutorisee(params.origine, params.originesAutorisees)) {
    return {
      ok: false,
      statut: 403,
      erreur: "Cette requête ne vient pas d'une origine autorisée. Rien n'a été envoyé.",
    };
  }

  if (typeof params.pdfBase64 !== "string" || params.pdfBase64.length === 0) {
    return { ok: false, statut: 400, erreur: "pdfBase64 manquant" };
  }

  if (params.pdfBase64.length > LONGUEUR_MAX_BASE64) {
    const recue = tailleDocumentDepuisBase64(params.pdfBase64);
    return {
      ok: false,
      statut: 413,
      erreur:
        `Ce document pèse ${enMegaoctets(recue)} Mo, au-delà de la limite de ` +
        `${enMegaoctets(TAILLE_MAX_PDF_OCTETS)} Mo que le service peut recevoir. Rien n'a été envoyé.`,
    };
  }

  return { ok: true };
}

/**
 * Verdict de l'authentification. `503` couvre une configuration serveur absente (pas la faute de
 * l'appelant, même famille que `ConfigurationManquanteError` pour `MISTRAL_API_KEY`) ; `401` couvre
 * tout le reste — jeton absent, expiré, révoqué ou serveur d'authentification muet. Volontairement
 * pas plus précis que ça : distinguer « expiré » de « invalide » n'aiderait pas l'utilisateur (le
 * geste est le même : se reconnecter), et le distinguer inviterait à essayer de deviner pourquoi un
 * jeton précis a été refusé, ce que Supabase seul sait.
 */
export type VerdictAuthentification = { ok: true; utilisateurId: string } | { ok: false; statut: 401 | 503; erreur: string };

/**
 * Réduit à ce que `verifierAuthentification` lit vraiment de la réponse — pas `Response` au complet.
 * Même conception que `ClientAuth` (`auth/supabaseClient.ts`) : les tests fabriquent un faux objet de
 * trois champs au lieu de simuler un `Response` DOM complet, et `fetch` satisfait ce type telle quelle.
 */
export interface ReponseAuthSupabase {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

const MESSAGE_AUTH_REQUISE = "Authentification requise. Reconnecte-toi puis réessaie. Rien n'a été envoyé.";
const MESSAGE_SESSION_INVALIDE = "Ta session n'est plus valide. Reconnecte-toi puis réessaie. Rien n'a été envoyé.";
const MESSAGE_CONFIGURATION_MANQUANTE = "L'authentification n'est pas configurée côté serveur : l'import de document est indisponible pour l'instant.";

/**
 * Valide le jeton de session envoyé par le navigateur (`Authorization: Bearer <access_token>`)
 * auprès du serveur d'authentification Supabase — point 8, phase authentification (07/08/2026).
 *
 * C'EST LA VRAIE SERRURE, contrairement au contrôle d'origine ci-dessus : un jeton de session
 * Supabase valide ne se forge pas (il est signé par le serveur d'authentification), là où un en-tête
 * `Origin` se recopie à la main dans n'importe quel `curl`. Un appelant anonyme — donc un bot qui
 * scanne les endpoints publics — n'a structurellement aucun moyen de produire un jeton qui passe
 * cette étape.
 *
 * `appelerSupabase` est injecté (défaut `fetch`) pour que les tests n'appellent jamais le vrai
 * serveur Supabase — même discipline que `client: ClientAuth` dans `EcranConnexionObligatoire.tsx`.
 * On appelle `GET {url}/auth/v1/user` directement (l'API REST du serveur d'authentification, pas le
 * SDK `@supabase/supabase-js`) : c'est la même vérification, sans dépendre de la compatibilité du SDK
 * avec le runtime Edge pour une seule requête HTTP.
 */
export async function verifierAuthentification(
  autorisation: string | null,
  supabaseUrl: string,
  supabaseAnonKey: string,
  appelerSupabase: (url: string, init: RequestInit) => Promise<ReponseAuthSupabase> = fetch,
): Promise<VerdictAuthentification> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, statut: 503, erreur: MESSAGE_CONFIGURATION_MANQUANTE };
  }

  const jeton = autorisation?.startsWith("Bearer ") ? autorisation.slice("Bearer ".length).trim() : "";
  if (jeton === "") {
    return { ok: false, statut: 401, erreur: MESSAGE_AUTH_REQUISE };
  }

  let reponse: ReponseAuthSupabase;
  try {
    reponse = await appelerSupabase(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jeton}`, apikey: supabaseAnonKey },
    });
  } catch {
    return { ok: false, statut: 401, erreur: MESSAGE_SESSION_INVALIDE };
  }
  if (!reponse.ok) {
    return { ok: false, statut: 401, erreur: MESSAGE_SESSION_INVALIDE };
  }

  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return { ok: false, statut: 401, erreur: MESSAGE_SESSION_INVALIDE };
  }
  const utilisateurId = (corps as { id?: unknown } | null)?.id;
  if (typeof utilisateurId !== "string" || utilisateurId === "") {
    return { ok: false, statut: 401, erreur: MESSAGE_SESSION_INVALIDE };
  }

  return { ok: true, utilisateurId };
}
