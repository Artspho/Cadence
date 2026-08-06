import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../../types/extraction";
import { ENDPOINT_EXTRACTION, extraireDocumentIA } from "../extraireDocumentIA";

const RESULTAT_VALIDE: ExtractionResult = {
  typeDocumentDetecte: "bulletin_paie",
  propositions: [],
  avertissementsGeneraux: [],
};

// Les paramètres sont déclarés (même inutilisés) pour que `mock.calls` soit typé : c'est ce qui
// permet d'affirmer sur l'URL et le corps réellement passés, notamment le test « jamais mistral.ai ».
function simulerReponse(statut: number, corps: unknown, corpsIllisible = false) {
  const fetchSimule = vi.fn(async (_url: string, _options?: RequestInit) => ({
    ok: statut >= 200 && statut < 300,
    status: statut,
    json: async () => {
      if (corpsIllisible) throw new Error("corps non-JSON");
      return corps;
    },
  }));
  vi.stubGlobal("fetch", fetchSimule);
  return fetchSimule;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extraireDocumentIA — le seul chemin réseau du navigateur", () => {
  it("appelle NOTRE endpoint en POST avec le PDF, et rien d'autre", async () => {
    const fetchSimule = simulerReponse(200, RESULTAT_VALIDE);
    await extraireDocumentIA("UERGLWZpY3RpZg==", "jeton-test");

    expect(fetchSimule).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSimule.mock.calls[0];
    expect(url).toBe(ENDPOINT_EXTRACTION);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ pdfBase64: "UERGLWZpY3RpZg==" });
  });

  // 07/08/2026, point 8 : sans ce jeton, le serveur (`gardeEndpointExtraction.ts::verifierAuthentification`)
  // refuse tout — c'est la garantie que ce test verrouille côté appelant.
  it("transmet le jeton de session en Authorization: Bearer", async () => {
    const fetchSimule = simulerReponse(200, RESULTAT_VALIDE);
    await extraireDocumentIA("UERGLWZpY3RpZg==", "jeton-de-session");

    const [, options] = fetchSimule.mock.calls[0];
    expect((options?.headers as Record<string, string>)?.Authorization).toBe("Bearer jeton-de-session");
  });

  // Le défaut exact du brouillon docs/files/ImportDocumentIA.jsx : appeler Mistral depuis la page,
  // avec la clé API dans le navigateur. Ce test échouerait si quelqu'un refaisait ce chemin ici.
  it("n'appelle JAMAIS api.mistral.ai directement (la clé ne doit pas exister côté navigateur)", async () => {
    const fetchSimule = simulerReponse(200, RESULTAT_VALIDE);
    await extraireDocumentIA("UERG", "jeton-test");

    for (const appel of fetchSimule.mock.calls) {
      expect(String(appel[0])).not.toContain("mistral.ai");
    }
  });

  it("renvoie le résultat validé quand la réponse est conforme", async () => {
    simulerReponse(200, RESULTAT_VALIDE);
    await expect(extraireDocumentIA("UERG", "jeton-test")).resolves.toEqual(RESULTAT_VALIDE);
  });
});

describe("extraireDocumentIA — aucune proposition douteuse ne passe (devoir n°2)", () => {
  it("rejette une réponse dont la forme ne correspond pas au schéma partagé", async () => {
    simulerReponse(200, { typeDocumentDetecte: "type_qui_nexiste_pas", propositions: [] });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/inattendu/i);
  });

  it("rejette une réponse amputée plutôt que d'en retenir la moitié", async () => {
    // `avertissementsGeneraux` manquant : accepter ça reviendrait à perdre en silence les
    // avertissements du document, qui sont justement ce qui empêche un faux feu vert.
    simulerReponse(200, { typeDocumentDetecte: "bulletin_paie", propositions: [] });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/inattendu/i);
  });
});

describe("extraireDocumentIA — messages d'erreur honnêtes", () => {
  // Sans cette remontée, l'utilisateur lirait « réessaie » alors que réessayer n'y changerait rien.
  it("remonte tel quel le message de configuration du 503 (clé Mistral absente)", async () => {
    const messageServeur =
      "MISTRAL_API_KEY n'est pas définie côté serveur : l'import de document est indisponible. Aucun document n'a été envoyé.";
    simulerReponse(503, { error: messageServeur });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(messageServeur);
  });

  it("retombe sur un message générique quand le corps d'erreur n'est pas exploitable", async () => {
    simulerReponse(500, null, true);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
  });

  // 30/07/2026 : un OCR vide (bulletin GHS-sPAIEctacle) s'affichait comme un document lu
  // normalement sans rien à en tirer. Le 422 (OcrIllisibleError, api/extract-document.ts) doit
  // remonter tel quel, avec un message distinct qui invite à changer d'export PDF.
  it("remonte tel quel le message du 422 (OCR vide, échec de lecture technique)", async () => {
    const messageServeur =
      "Ce document n'a pas pu être lu (aucun texte détecté à l'intérieur) — ce n'est pas qu'il n'y avait rien " +
      "d'exploitable dedans, c'est un échec de lecture. Essaie un export PDF différent.";
    simulerReponse(422, { error: messageServeur });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(messageServeur);
  });

  /*
   * LES TROIS REFUS DE LA GARDE (06/08/2026) — ajoutés parce que Benoît est resté bloqué dessus.
   *
   * Il voyait « L'extraction a échoué. Réessaie, ou saisis le document à la main. » sans savoir
   * pourquoi, alors que le serveur avait rédigé la raison exacte. Et « Réessaie » est FAUX dans ces
   * trois cas : aucun ne change au deuxième essai. Le serveur savait, le client jetait.
   */
  it("remonte tel quel le 413 — un document trop gros ne passera pas mieux au deuxième essai", async () => {
    const messageServeur = "Ce document pèse 4,2 Mo, au-delà de la limite de 3,0 Mo que le service peut recevoir. Rien n'a été envoyé.";
    simulerReponse(413, { error: messageServeur });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(messageServeur);
  });

  it("remonte tel quel le 403 — origine non autorisée, réessayer n'y changera jamais rien", async () => {
    const messageServeur = "Cette requête ne vient pas d'une origine autorisée. Rien n'a été envoyé.";
    simulerReponse(403, { error: messageServeur });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(messageServeur);
  });

  it("remonte tel quel le 400 de la garde", async () => {
    simulerReponse(400, { error: "pdfBase64 manquant" });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow("pdfBase64 manquant");
  });

  it("le filtre HTML s'applique AUSSI aux trois nouveaux statuts — un 403 de pare-feu n'est pas de nous", async () => {
    // Un WAF ou un CDN peut lui aussi répondre 403. `messageMontrable` reste donc le dernier filtre :
    // élargir la liste blanche ne doit pas ouvrir la porte au corps d'un intermédiaire.
    simulerReponse(403, { error: "<html><body>Forbidden — edge node 10.0.0.4</body></html>" });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
  });

  it("LES 5xx RESTENT DEHORS, volontairement", async () => {
    // Le 500 de notre endpoint porte déjà un texte générique : rien à y gagner, et un 5xx est
    // justement ce qu'un proxy renvoie le plus volontiers avec son propre corps.
    simulerReponse(500, { error: "Échec de l'extraction. Réessaie ou saisis manuellement." });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
  });

  /*
   * LE CODE HTTP DANS LE MESSAGE GÉNÉRIQUE (06/08/2026).
   *
   * Sans lui, « L'extraction a échoué. Réessaie » couvrait indifféremment un dépassement de délai, une
   * erreur de Mistral, un refus de proxy et un mauvais verbe HTTP — Benoît a signalé une panne avec
   * cette seule phrase, et il a fallu sonder l'endpoint au `curl` pour éliminer des hypothèses. Un
   * utilisateur n'a pas ce recours.
   */
  it("affiche le CODE HTTP quand le message n'est pas de nous — sinon la panne est indiagnosticable", async () => {
    simulerReponse(504, { error: "Gateway Timeout" });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/code 504/);
  });

  it("l'affiche aussi sur un statut à nous dont le corps a été filtré", async () => {
    // Filtré parce que c'est du HTML : on ne montre pas le corps, mais on ne cache pas le code.
    simulerReponse(403, { error: "<html>Forbidden</html>" });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/code 403/);
  });

  it("N'INVENTE PAS de code quand il n'y en a pas — un échec réseau n'a pas de statut", async () => {
    // `fetch` qui rejette (hors ligne, DNS) : aucune réponse, donc aucun code. Afficher « code 0 » ou
    // « code undefined » serait une information fabriquée.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Failed to fetch"); }));
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/connexion interrompue/i);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.not.toThrow(/code/i);
  });

  // Un proxy / CDN / tunnel de dev peut répondre son propre 504 avec son propre corps : ce n'est pas
  // notre texte, il ne doit pas atterrir à l'écran (adresse interne exposée au passage).
  it("n'affiche pas le corps d'un statut qui n'est pas le nôtre (504 de proxy)", async () => {
    const fuite = "Gateway Timeout — upstream 10.0.0.4:8080";
    simulerReponse(504, { error: fuite });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.not.toThrow(fuite);
  });

  // Garde-fou de dernier recours : même sur un 503, un corps fait de balises n'est pas de nous.
  it("n'affiche pas une page HTML même renvoyée sur un 503", async () => {
    simulerReponse(503, { error: "<html><body>Service Unavailable — 10.0.0.4</body></html>" });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
  });

  it("ignore un message anormalement long plutôt que de le déverser à l'écran", async () => {
    simulerReponse(503, { error: "x".repeat(5000) });
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/saisis le document à la main/i);
  });
});

// ImportDocumentIA.tsx affiche `error.message` tel quel, en se fiant à cette garantie : tout ce qui
// sort d'ici est un texte que NOUS avons rédigé. Ces deux cas sont ceux où un message technique du
// moteur JavaScript arriverait à l'écran sans les enveloppes ajoutées dans extraireDocumentIA.
describe("extraireDocumentIA — aucun message technique ne peut fuir vers l'utilisateur", () => {
  it("traduit un échec réseau (hors ligne) en message lisible, sans « Failed to fetch »", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/connexion interrompue/i);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.not.toThrow(/Failed to fetch/);
  });

  // Ne prétend pas que le document n'est pas parti : une coupure peut survenir après l'envoi du corps.
  it("ne prétend pas, sur échec réseau, que le document n'a pas été transmis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.not.toThrow(/n'a pas été transmis|n'a pas été envoyé/);
  });

  it("traduit un 200 qui ne contient pas du JSON (page HTML d'un proxy) sans exposer la SyntaxError", async () => {
    simulerReponse(200, null, true);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.toThrow(/inattendu/i);
    await expect(extraireDocumentIA("UERG", "jeton-test")).rejects.not.toThrow(/Unexpected token|JSON/);
  });
});
