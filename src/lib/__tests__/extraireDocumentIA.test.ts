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
    await extraireDocumentIA("UERGLWZpY3RpZg==");

    expect(fetchSimule).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSimule.mock.calls[0];
    expect(url).toBe(ENDPOINT_EXTRACTION);
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ pdfBase64: "UERGLWZpY3RpZg==" });
  });

  // Le défaut exact du brouillon docs/files/ImportDocumentIA.jsx : appeler Mistral depuis la page,
  // avec la clé API dans le navigateur. Ce test échouerait si quelqu'un refaisait ce chemin ici.
  it("n'appelle JAMAIS api.mistral.ai directement (la clé ne doit pas exister côté navigateur)", async () => {
    const fetchSimule = simulerReponse(200, RESULTAT_VALIDE);
    await extraireDocumentIA("UERG");

    for (const appel of fetchSimule.mock.calls) {
      expect(String(appel[0])).not.toContain("mistral.ai");
    }
  });

  it("renvoie le résultat validé quand la réponse est conforme", async () => {
    simulerReponse(200, RESULTAT_VALIDE);
    await expect(extraireDocumentIA("UERG")).resolves.toEqual(RESULTAT_VALIDE);
  });
});

describe("extraireDocumentIA — aucune proposition douteuse ne passe (devoir n°2)", () => {
  it("rejette une réponse dont la forme ne correspond pas au schéma partagé", async () => {
    simulerReponse(200, { typeDocumentDetecte: "type_qui_nexiste_pas", propositions: [] });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/inattendu/i);
  });

  it("rejette une réponse amputée plutôt que d'en retenir la moitié", async () => {
    // `avertissementsGeneraux` manquant : accepter ça reviendrait à perdre en silence les
    // avertissements du document, qui sont justement ce qui empêche un faux feu vert.
    simulerReponse(200, { typeDocumentDetecte: "bulletin_paie", propositions: [] });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/inattendu/i);
  });
});

describe("extraireDocumentIA — messages d'erreur honnêtes", () => {
  // Sans cette remontée, l'utilisateur lirait « réessaie » alors que réessayer n'y changerait rien.
  it("remonte tel quel le message de configuration du 503 (clé Mistral absente)", async () => {
    const messageServeur =
      "MISTRAL_API_KEY n'est pas définie côté serveur : l'import de document est indisponible. Aucun document n'a été envoyé.";
    simulerReponse(503, { error: messageServeur });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(messageServeur);
  });

  it("retombe sur un message générique quand le corps d'erreur n'est pas exploitable", async () => {
    simulerReponse(500, null, true);
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/saisis le document à la main/i);
  });

  // Un proxy / CDN / tunnel de dev peut répondre son propre 504 avec son propre corps : ce n'est pas
  // notre texte, il ne doit pas atterrir à l'écran (adresse interne exposée au passage).
  it("n'affiche pas le corps d'un statut qui n'est pas le nôtre (504 de proxy)", async () => {
    const fuite = "Gateway Timeout — upstream 10.0.0.4:8080";
    simulerReponse(504, { error: fuite });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/saisis le document à la main/i);
    await expect(extraireDocumentIA("UERG")).rejects.not.toThrow(fuite);
  });

  // Garde-fou de dernier recours : même sur un 503, un corps fait de balises n'est pas de nous.
  it("n'affiche pas une page HTML même renvoyée sur un 503", async () => {
    simulerReponse(503, { error: "<html><body>Service Unavailable — 10.0.0.4</body></html>" });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/saisis le document à la main/i);
  });

  it("ignore un message anormalement long plutôt que de le déverser à l'écran", async () => {
    simulerReponse(503, { error: "x".repeat(5000) });
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/saisis le document à la main/i);
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
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/connexion interrompue/i);
    await expect(extraireDocumentIA("UERG")).rejects.not.toThrow(/Failed to fetch/);
  });

  // Ne prétend pas que le document n'est pas parti : une coupure peut survenir après l'envoi du corps.
  it("ne prétend pas, sur échec réseau, que le document n'a pas été transmis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(extraireDocumentIA("UERG")).rejects.not.toThrow(/n'a pas été transmis|n'a pas été envoyé/);
  });

  it("traduit un 200 qui ne contient pas du JSON (page HTML d'un proxy) sans exposer la SyntaxError", async () => {
    simulerReponse(200, null, true);
    await expect(extraireDocumentIA("UERG")).rejects.toThrow(/inattendu/i);
    await expect(extraireDocumentIA("UERG")).rejects.not.toThrow(/Unexpected token|JSON/);
  });
});
