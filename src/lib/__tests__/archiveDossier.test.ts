// @vitest-environment jsdom
//
// Environnement navigateur EXPRÈS : `generateAsync({ type: "blob" })` a besoin d'un vrai `Blob`, et
// c'est bien du code navigateur (l'archive se construit dans la page de l'utilisateur).
//
// Téléchargement groupé de « Mon dossier » (06/08/2026, demandé par Benoît).
//
// Ce que ces tests verrouillent : une archive INCOMPLÈTE ne passe jamais pour complète. Un échec
// partiel doit être remonté à l'appelant ET inscrit dans l'archive elle-même — sinon c'est un
// document perdu (devoir n°1) derrière un succès affiché (devoir n°2), les deux fautes d'un coup.
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { construireArchive, nomArchive } from "../archiveDossier";
import type { LigneDocument } from "../../storage/documentsStorage";

function doc(id: string, partiel: Partial<LigneDocument> = {}): LigneDocument {
  return {
    id,
    typeDocument: partiel.typeDocument ?? "justificatif_frais",
    categorieFrais: partiel.categorieFrais ?? "A",
    anneeFiscale: 2026,
    cheminStockage: `u/2026/x/${id}`,
    nomFichier: partiel.nomFichier ?? `${id}.pdf`,
    tailleOctets: 1000,
    mime: "application/pdf",
    dateDocument: null,
    notes: null,
    creeLe: "2026-08-06T09:00:00.000Z",
  };
}

const urlOk = async () => ({ url: "https://exemple/signe" });
const contenuOk = async () => new TextEncoder().encode("contenu").buffer;

/**
 * Relit l'archive produite pour vérifier ce qu'elle contient RÉELLEMENT.
 *
 * Les entrées de DOSSIER sont écartées (`.dir`) : JSZip les crée implicitement pour chaque niveau de
 * chemin (`justificatif_frais/`, `justificatif_frais/A/`), ce qui est normal dans un zip mais n'a
 * rien à voir avec les documents dont on veut prouver la présence.
 */
async function listerArchive(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(blob);
  return Object.entries(zip.files)
    .filter(([, entree]) => !entree.dir)
    .map(([nom]) => nom)
    .sort();
}

describe("construireArchive — cas nominal", () => {
  it("range chaque document sous <type>/<catégorie>/ dans l'archive", async () => {
    const resultat = await construireArchive([doc("a", { categorieFrais: "A", nomFichier: "violon.pdf" }), doc("b", { typeDocument: "aem_bulletin", categorieFrais: null, nomFichier: "aem.pdf" })], {
      obtenirUrl: urlOk,
      recupererContenu: contenuOk,
    });

    expect(resultat.nombreInclus).toBe(2);
    expect(resultat.echecs).toEqual([]);
    expect(await listerArchive(resultat.archive)).toEqual(["aem_bulletin/aem.pdf", "justificatif_frais/A/violon.pdf"]);
  });

  it("DEUX FICHIERS DE MÊME NOM sont tous deux présents — jamais l'un écrasé par l'autre", async () => {
    const resultat = await construireArchive([doc("a", { nomFichier: "facture.pdf" }), doc("b", { nomFichier: "facture.pdf" })], {
      obtenirUrl: urlOk,
      recupererContenu: contenuOk,
    });

    expect(resultat.nombreInclus).toBe(2);
    expect(await listerArchive(resultat.archive)).toEqual(["justificatif_frais/A/facture (2).pdf", "justificatif_frais/A/facture.pdf"]);
  });

  it("rend la progression après CHAQUE document, réussi ou non", async () => {
    const progression: [number, number][] = [];
    await construireArchive([doc("a"), doc("b"), doc("c")], {
      obtenirUrl: urlOk,
      recupererContenu: contenuOk,
      onProgression: (traites, total) => progression.push([traites, total]),
    });
    expect(progression).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("récupère les fichiers UN PAR UN, jamais en rafale (limitation côté serveur)", async () => {
    let enCours = 0;
    let maximumSimultane = 0;
    await construireArchive([doc("a"), doc("b"), doc("c")], {
      obtenirUrl: urlOk,
      recupererContenu: async () => {
        enCours += 1;
        maximumSimultane = Math.max(maximumSimultane, enCours);
        await new Promise((r) => setTimeout(r, 5));
        enCours -= 1;
        return new TextEncoder().encode("x").buffer;
      },
    });
    expect(maximumSimultane).toBe(1);
  });

  it("une liste vide produit une archive vide, sans planter", async () => {
    const resultat = await construireArchive([], { obtenirUrl: urlOk, recupererContenu: contenuOk });
    expect(resultat.nombreInclus).toBe(0);
    expect(await listerArchive(resultat.archive)).toEqual([]);
  });
});

describe("construireArchive — échec partiel, le cœur du sujet", () => {
  it("garde les fichiers réussis quand un autre échoue, et NOMME les manquants", async () => {
    const resultat = await construireArchive([doc("bon", { nomFichier: "bon.pdf" }), doc("casse", { nomFichier: "casse.pdf" })], {
      obtenirUrl: async (d) => (d.nomFichier === "casse.pdf" ? { erreur: "URL signée refusée" } : { url: "https://exemple/signe" }),
      recupererContenu: contenuOk,
    });

    expect(resultat.nombreInclus).toBe(1);
    expect(resultat.echecs).toEqual([{ nomFichier: "casse.pdf", motif: "URL signée refusée" }]);
    // Le fichier réussi est bien là : on n'abandonne pas tout pour un raté.
    expect(await listerArchive(resultat.archive)).toContain("justificatif_frais/A/bon.pdf");
  });

  it("INSCRIT L'INCOMPLÉTUDE DANS L'ARCHIVE — la vérité doit voyager avec le zip", async () => {
    const resultat = await construireArchive([doc("bon"), doc("casse", { nomFichier: "casse.pdf" })], {
      obtenirUrl: async (d) => (d.nomFichier === "casse.pdf" ? { erreur: "réseau coupé" } : { url: "https://exemple/signe" }),
      recupererContenu: contenuOk,
    });

    const zip = await JSZip.loadAsync(resultat.archive);
    const avertissement = await zip.file("_FICHIERS-MANQUANTS.txt")!.async("string");
    expect(avertissement).toMatch(/INCOMPLÈTE/);
    expect(avertissement).toContain("casse.pdf");
    expect(avertissement).toContain("réseau coupé");
    // Et surtout : dire que rien n'est perdu côté Cadence.
    expect(avertissement).toMatch(/existent toujours dans Cadence/i);
  });

  it("n'ajoute AUCUN avertissement quand tout a réussi", async () => {
    const resultat = await construireArchive([doc("a")], { obtenirUrl: urlOk, recupererContenu: contenuOk });
    const zip = await JSZip.loadAsync(resultat.archive);
    expect(zip.file("_FICHIERS-MANQUANTS.txt")).toBeNull();
  });

  it("un contenu qui lève est traité comme un échec nommé, pas comme un plantage", async () => {
    const resultat = await construireArchive([doc("a", { nomFichier: "a.pdf" })], {
      obtenirUrl: urlOk,
      recupererContenu: async () => {
        throw new Error("réponse 403");
      },
    });
    expect(resultat.nombreInclus).toBe(0);
    expect(resultat.echecs).toEqual([{ nomFichier: "a.pdf", motif: "réponse 403" }]);
  });

  it("continue après un échec au lieu de s'arrêter au premier", async () => {
    const recuperer = vi.fn(async (url: string) => {
      if (url.includes("casse")) throw new Error("boum");
      return new TextEncoder().encode("x").buffer;
    });
    const resultat = await construireArchive([doc("a", { nomFichier: "casse.pdf" }), doc("b"), doc("c")], {
      obtenirUrl: async (d) => ({ url: d.nomFichier === "casse.pdf" ? "https://exemple/casse" : "https://exemple/ok" }),
      recupererContenu: recuperer,
    });
    expect(recuperer).toHaveBeenCalledTimes(3);
    expect(resultat.nombreInclus).toBe(2);
    expect(resultat.echecs).toHaveLength(1);
  });
});

describe("nomArchive", () => {
  it("nomme l'archive complète avec l'horodatage", () => {
    expect(nomArchive("2026-08-06_0930")).toBe("cadence-dossier-2026-08-06_0930.zip");
  });

  it("suffixe par le groupe, en nettoyant la ponctuation du libellé", () => {
    expect(nomArchive("2026-08-06_0930", "C7 — Matériel, mobilier")).toBe("cadence-dossier-c7-mat-riel-mobilier-2026-08-06_0930.zip");
  });
});
