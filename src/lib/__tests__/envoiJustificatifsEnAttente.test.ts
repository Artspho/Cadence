// @vitest-environment jsdom
//
// Sortie des justificatifs du localStorage (chantier décidé le 04/08/2026, après le point 2). Ces
// tests portent sur la logique pure : `uploader` est injecté, donc aucun réseau, aucun jeton, aucune
// dépendance à la configuration Google — c'est ce qui permet de tout verrouiller AVANT que l'ID client
// OAuth n'existe.
//
// La règle que ces tests protègent avant tout : le contenu local n'est effacé que lorsque l'envoi de
// CE fichier est confirmé (devoir sacré n°1). Tout le reste en découle.
import { describe, expect, it, vi } from "vitest";
import type { Depense } from "../../types/fraisReels";
import { envoyerJustificatifsLocaux, fichierDepuisDataUrl, justificatifsEnAttente, poidsJustificatifsEnAttente } from "../envoiJustificatifsEnAttente";

/** Une data URL réelle, de la forme exacte que produit `FileReader.readAsDataURL`. */
const DATA_URL_PDF = `data:application/pdf;base64,${btoa("contenu de facture")}`;

function depense(partiel: Partial<Depense> = {}): Depense {
  return {
    id: "d1",
    anneeFiscale: 2026,
    date: "2026-03-10",
    categorie: "C1",
    description: "Péage",
    montantTotal: 12.5,
    remboursementEmployeur: 0,
    partPro: 1,
    montantDeductible: 12.5,
    statutJustificatif: "fourni",
    ...partiel,
  };
}

const LOCAL = depense({ id: "locale", justificatifNom: "facture.pdf", justificatifData: DATA_URL_PDF });
const SUR_DRIVE = depense({ id: "drive", justificatifNom: "deja.pdf", driveFileId: "abc123", driveWebViewLink: "https://drive.example/abc123" });
const SANS_JUSTIFICATIF = depense({ id: "sans", statutJustificatif: "manquant" });

describe("justificatifsEnAttente — ce qui est encore dans ce navigateur", () => {
  it("retient les justificatifs locaux, et EUX SEULS", () => {
    expect(justificatifsEnAttente([LOCAL, SUR_DRIVE, SANS_JUSTIFICATIF]).map((d) => d.id)).toEqual(["locale"]);
  });

  it("un justificatif déjà sur Drive n'est jamais compté en attente, même si un base64 traîne encore", () => {
    // Cas d'un état hybride hérité : `driveFileId` fait foi, c'est lui qui prouve que le fichier est
    // sorti. Le recompter en attente le renverrait une seconde fois sur Drive, en doublon.
    const hybride = depense({ id: "hybride", driveFileId: "xyz", justificatifData: DATA_URL_PDF });
    expect(justificatifsEnAttente([hybride])).toEqual([]);
  });

  it("liste vide : rien en attente, aucune exception", () => {
    expect(justificatifsEnAttente([])).toEqual([]);
  });

  it("le poids en attente est la somme des contenus locaux — c'est le chiffre qu'on annonce à l'écran", () => {
    expect(poidsJustificatifsEnAttente([LOCAL, SUR_DRIVE])).toBe(DATA_URL_PDF.length);
    expect(poidsJustificatifsEnAttente([SUR_DRIVE, SANS_JUSTIFICATIF])).toBe(0);
  });
});

describe("fichierDepuisDataUrl", () => {
  it("reconstruit un fichier avec son nom, son type et son contenu", async () => {
    const fichier = fichierDepuisDataUrl(DATA_URL_PDF, "facture.pdf");
    expect(fichier).not.toBeNull();
    expect(fichier?.name).toBe("facture.pdf");
    expect(fichier?.type).toBe("application/pdf");
    expect(await fichier?.text()).toBe("contenu de facture");
  });

  it("contenu inexploitable : `null` plutôt qu'une exception", () => {
    // Un justificatif illisible ne doit pas interrompre l'envoi des autres — et surtout il ne doit pas
    // être effacé : il ressortira au prochain essai, toujours listé en attente, ce qui est la vérité.
    expect(fichierDepuisDataUrl("pas une data url", "x.pdf")).toBeNull();
    expect(fichierDepuisDataUrl("data:application/pdf;base64,???", "x.pdf")).toBeNull();
    expect(fichierDepuisDataUrl("", "x.pdf")).toBeNull();
  });

  it("type absent dans l'en-tête : un type générique, jamais une exception", () => {
    const fichier = fichierDepuisDataUrl(`data:;base64,${btoa("x")}`, "sans-type.bin");
    expect(fichier?.type).toBe("application/octet-stream");
  });
});

describe("envoyerJustificatifsLocaux — le contenu local ne part QU'APRÈS confirmation", () => {
  it("envoi réussi : driveFileId écrit ET base64 effacé, dans le même objet", async () => {
    const uploader = vi.fn().mockResolvedValue({ driveFileId: "id-1", driveWebViewLink: "https://drive.example/id-1" });
    const r = await envoyerJustificatifsLocaux([LOCAL], uploader);

    expect(r.envoyes).toBe(1);
    expect(r.echecs).toBe(0);
    expect(r.depenses[0].driveFileId).toBe("id-1");
    expect(r.depenses[0].driveWebViewLink).toBe("https://drive.example/id-1");
    expect(r.depenses[0].justificatifData).toBeUndefined();
    // Le nom du fichier est conservé : c'est lui qui s'affiche dans la liste des dépenses.
    expect(r.depenses[0].justificatifNom).toBe("facture.pdf");
  });

  it("ÉCHEC D'ENVOI : le base64 est INTACT, aucun driveFileId inventé", async () => {
    // Le test le plus important du fichier. Si cette garantie tombait, un réseau coupé ferait
    // disparaître un justificatif — devoir sacré n°1.
    const uploader = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const r = await envoyerJustificatifsLocaux([LOCAL], uploader);

    expect(r.envoyes).toBe(0);
    expect(r.echecs).toBe(1);
    expect(r.nomsEnEchec).toEqual(["facture.pdf"]);
    expect(r.depenses[0].justificatifData).toBe(DATA_URL_PDF);
    expect(r.depenses[0].driveFileId).toBeUndefined();
    // Et il reste listé en attente : l'état affiché après un échec dit la vérité.
    expect(justificatifsEnAttente(r.depenses)).toHaveLength(1);
  });

  it("échec au milieu : ce qui est parti est parti, ce qui reste est intact — état lisible", async () => {
    const uploader = vi
      .fn()
      .mockResolvedValueOnce({ driveFileId: "ok-1", driveWebViewLink: "l1" })
      .mockRejectedValueOnce(new Error("réseau coupé"))
      .mockResolvedValueOnce({ driveFileId: "ok-3", driveWebViewLink: "l3" });

    const trois = [
      depense({ id: "a", justificatifNom: "a.pdf", justificatifData: DATA_URL_PDF }),
      depense({ id: "b", justificatifNom: "b.pdf", justificatifData: DATA_URL_PDF }),
      depense({ id: "c", justificatifNom: "c.pdf", justificatifData: DATA_URL_PDF }),
    ];
    const r = await envoyerJustificatifsLocaux(trois, uploader);

    expect({ envoyes: r.envoyes, echecs: r.echecs, nomsEnEchec: r.nomsEnEchec }).toEqual({ envoyes: 2, echecs: 1, nomsEnEchec: ["b.pdf"] });
    expect(r.depenses.map((d) => d.driveFileId)).toEqual(["ok-1", undefined, "ok-3"]);
    expect(r.depenses.map((d) => Boolean(d.justificatifData))).toEqual([false, true, false]);
    expect(justificatifsEnAttente(r.depenses).map((d) => d.id)).toEqual(["b"]);
  });

  it("un justificatif illisible est compté en échec et CONSERVÉ, sans bloquer les suivants", async () => {
    const uploader = vi.fn().mockResolvedValue({ driveFileId: "ok", driveWebViewLink: "l" });
    const deux = [
      depense({ id: "casse", justificatifNom: "casse.pdf", justificatifData: "data:application/pdf;base64,???" }),
      depense({ id: "bon", justificatifNom: "bon.pdf", justificatifData: DATA_URL_PDF }),
    ];
    const r = await envoyerJustificatifsLocaux(deux, uploader);

    expect(r.nomsEnEchec).toEqual(["casse.pdf"]);
    expect(r.envoyes).toBe(1);
    expect(r.depenses[0].justificatifData).toBe("data:application/pdf;base64,???"); // conservé
    expect(uploader).toHaveBeenCalledTimes(1); // l'illisible n'a même pas été tenté
  });

  it("n'envoie ni ce qui est déjà sur Drive, ni ce qui n'a aucun justificatif", async () => {
    const uploader = vi.fn().mockResolvedValue({ driveFileId: "id", driveWebViewLink: "l" });
    const r = await envoyerJustificatifsLocaux([SUR_DRIVE, SANS_JUSTIFICATIF], uploader);

    expect(uploader).not.toHaveBeenCalled();
    expect({ envoyes: r.envoyes, echecs: r.echecs }).toEqual({ envoyes: 0, echecs: 0 });
    expect(r.depenses).toEqual([SUR_DRIVE, SANS_JUSTIFICATIF]);
  });

  it("envois SÉQUENTIELS, pas en parallèle : sinon Drive créerait plusieurs dossiers du même nom", async () => {
    // `uploaderJustificatif` crée au besoin `Cadence/Frais_<année>`. Drive autorise deux dossiers
    // homonymes, contrairement à un système de fichiers : deux envois simultanés sur une année vierge
    // produiraient deux dossiers, et les justificatifs se retrouveraient éparpillés.
    let enCours = 0;
    let maxSimultanes = 0;
    const uploader = vi.fn(async () => {
      enCours += 1;
      maxSimultanes = Math.max(maxSimultanes, enCours);
      await Promise.resolve();
      enCours -= 1;
      return { driveFileId: "id", driveWebViewLink: "l" };
    });

    await envoyerJustificatifsLocaux(
      [depense({ id: "a", justificatifData: DATA_URL_PDF }), depense({ id: "b", justificatifData: DATA_URL_PDF }), depense({ id: "c", justificatifData: DATA_URL_PDF })],
      uploader,
    );

    expect(uploader).toHaveBeenCalledTimes(3);
    expect(maxSimultanes).toBe(1);
  });

  it("chaque justificatif part dans le dossier de SON année fiscale", async () => {
    const uploader = vi.fn().mockResolvedValue({ driveFileId: "id", driveWebViewLink: "l" });
    await envoyerJustificatifsLocaux(
      [depense({ id: "a", anneeFiscale: 2025, justificatifData: DATA_URL_PDF }), depense({ id: "b", anneeFiscale: 2026, justificatifData: DATA_URL_PDF })],
      uploader,
    );
    expect(uploader.mock.calls.map((c) => c[1])).toEqual([2025, 2026]);
  });

  it("rien en attente : aucun appel, compte-rendu à zéro, dépenses inchangées", async () => {
    const uploader = vi.fn();
    const r = await envoyerJustificatifsLocaux([], uploader);
    expect(uploader).not.toHaveBeenCalled();
    expect(r).toEqual({ depenses: [], envoyes: 0, echecs: 0, nomsEnEchec: [] });
  });
});
