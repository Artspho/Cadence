// Point 2 de docs/critique_2026-08-03.md, part manquante : savoir avant d'écrire, et pouvoir dire ce
// qui occupe la place. Ces tests portent sur la mesure pure — le composant qui l'affiche est testé
// séparément (components/__tests__/BandeauStockagePlein.test.tsx).
import { describe, expect, it } from "vitest";
import { chargeAdditionnelleTiendrait, formaterTaille, mesurerOccupation, type StockageMesurable } from "../capaciteStockage";

/**
 * Faux stockage, avec un plafond réglable : c'est le seul moyen de tester le comportement « plein »
 * sans dépendre du quota réel du navigateur qui exécute les tests — quota qui varie d'une machine et
 * d'un navigateur à l'autre, et qu'aucun test ne peut donc supposer.
 */
function stockageFactice(contenu: Record<string, string> = {}, plafondCaracteres = Infinity): StockageMesurable & { contenu: Record<string, string> } {
  const donnees = { ...contenu };
  const occupation = () => Object.entries(donnees).reduce((t, [k, v]) => t + k.length + v.length, 0);
  return {
    contenu: donnees,
    get length() {
      return Object.keys(donnees).length;
    },
    key: (i: number) => Object.keys(donnees)[i] ?? null,
    getItem: (cle: string) => donnees[cle] ?? null,
    setItem: (cle: string, valeur: string) => {
      const apres = occupation() - (donnees[cle]?.length ?? 0) - (cle in donnees ? cle.length : 0) + cle.length + valeur.length;
      if (apres > plafondCaracteres) {
        const erreur = new Error("Setting the value exceeded the quota.");
        erreur.name = "QuotaExceededError";
        throw erreur;
      }
      donnees[cle] = valeur;
    },
    removeItem: (cle: string) => {
      delete donnees[cle];
    },
  };
}

describe("mesurerOccupation", () => {
  it("compte les clés ET les valeurs, et donne le total", () => {
    // "a" (1) + "xx" (2) = 3 ; "bb" (2) + "yyyy" (4) = 6.
    const occupation = mesurerOccupation(stockageFactice({ a: "xx", bb: "yyyy" }));
    expect(occupation.totalOctets).toBe(9);
    expect(occupation.parCle).toEqual([
      { cle: "bb", octets: 6 },
      { cle: "a", octets: 3 },
    ]);
  });

  it("trie du plus volumineux au plus léger : c'est l'ordre dans lequel on veut le lire", () => {
    const occupation = mesurerOccupation(stockageFactice({ petit: "x", enorme: "x".repeat(1000), moyen: "x".repeat(50) }));
    expect(occupation.parCle.map((c) => c.cle)).toEqual(["enorme", "moyen", "petit"]);
  });

  it("stockage vide : total à zéro, aucune clé — jamais une exception", () => {
    expect(mesurerOccupation(stockageFactice())).toEqual({ totalOctets: 0, parCle: [] });
  });

  it("stockage inaccessible (navigation privée verrouillée) : occupation vide au lieu de lever", () => {
    // C'est l'écran qu'on voit quand tout va mal : il ne doit pas tomber à son tour.
    const stockageQuiLeve: StockageMesurable = {
      get length(): number {
        throw new Error("SecurityError");
      },
      key: () => null,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    expect(mesurerOccupation(stockageQuiLeve)).toEqual({ totalOctets: 0, parCle: [] });
  });
});

describe("chargeAdditionnelleTiendrait", () => {
  it("vrai quand la place suffit", () => {
    expect(chargeAdditionnelleTiendrait("x".repeat(100), stockageFactice({}, 10_000))).toBe(true);
  });

  it("faux quand la place manque — constaté en essayant, pas déduit d'un seuil", () => {
    // Plafond à 1 000 caractères, déjà 900 occupés : une charge de 500 ne peut pas tenir.
    const stockage = stockageFactice({ deja: "x".repeat(896) }, 1000);
    expect(chargeAdditionnelleTiendrait("x".repeat(500), stockage)).toBe(false);
  });

  it("ne laisse JAMAIS la clé d'essai derrière elle, que l'essai réussisse ou échoue", () => {
    // Sinon le filet deviendrait lui-même un consommateur d'espace — et un doublon des données.
    const stockageOk = stockageFactice({}, 10_000);
    chargeAdditionnelleTiendrait("x".repeat(100), stockageOk);
    expect(Object.keys(stockageOk.contenu)).toEqual([]);

    const stockagePlein = stockageFactice({ deja: "x".repeat(896) }, 1000);
    chargeAdditionnelleTiendrait("x".repeat(500), stockagePlein);
    expect(Object.keys(stockagePlein.contenu)).toEqual(["deja"]);
  });

  it("le cas réel du point 2 : un justificatif de 5 Mo encodé en base64 ne tient pas dans 10 Mo déjà bien remplis", () => {
    // Ordre de grandeur mesuré le 04/08/2026 : 5 Mo de fichier → ~6,7 Mo en base64 (+33 %).
    const justificatifBase64 = "x".repeat(Math.round(5 * 1024 * 1024 * 1.33));
    const stockagePresquePlein = stockageFactice({ depenses: "x".repeat(5 * 1024 * 1024) }, 10 * 1024 * 1024);
    expect(chargeAdditionnelleTiendrait(justificatifBase64, stockagePresquePlein)).toBe(false);
    // Et le même justificatif tient dans un stockage vide de même plafond : le refus vient bien de
    // l'occupation, pas de la taille en soi.
    expect(chargeAdditionnelleTiendrait(justificatifBase64, stockageFactice({}, 10 * 1024 * 1024))).toBe(true);
  });
});

describe("formaterTaille", () => {
  it("octets, kilo-octets et méga-octets, avec la virgule française", () => {
    expect(formaterTaille(512)).toBe("512 o");
    expect(formaterTaille(23_654)).toBe("23,1 Ko");
    expect(formaterTaille(7_025_459)).toBe("6,7 Mo");
  });

  it("les bornes ne sautent pas d'une unité à l'autre trop tôt", () => {
    expect(formaterTaille(1023)).toBe("1023 o");
    expect(formaterTaille(1024)).toBe("1,0 Ko");
    expect(formaterTaille(1024 * 1024 - 1)).toBe("1024,0 Ko");
    expect(formaterTaille(1024 * 1024)).toBe("1,0 Mo");
  });

  it("zéro s'affiche en octets, pas en vide", () => {
    expect(formaterTaille(0)).toBe("0 o");
  });
});
