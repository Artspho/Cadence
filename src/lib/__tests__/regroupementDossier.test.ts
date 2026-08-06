// Regroupement de « Mon dossier » (06/08/2026, demandé par Benoît).
//
// Ce que ces tests verrouillent avant tout : AUCUN DOCUMENT NE DISPARAÎT, quelle que soit la
// bizarrerie de ses champs (devoir n°1). Un regroupement qui filtre est un regroupement qui perd.
import { describe, expect, it } from "vitest";
import { cheminDansArchive, cheminUnique, regrouperDocuments } from "../regroupementDossier";
import type { LigneDocument, TypeDocument } from "../../storage/documentsStorage";

/**
 * Un type que le CODE ne connaît pas, mais que le serveur peut très bien renvoyer (valeur ajoutée en
 * SQL avant de l'être ici, ou l'inverse). Le cast est délibéré : c'est précisément la situation que
 * `regrouperDocuments` doit traiter sans perdre le document, et le typage TypeScript ne peut pas la
 * représenter puisqu'il suppose le contraire.
 */
const TYPE_INCONNU_DU_CODE = "type_venu_du_futur" as TypeDocument;

function doc(partiel: Partial<LigneDocument> & { id: string }): LigneDocument {
  return {
    id: partiel.id,
    typeDocument: partiel.typeDocument ?? "justificatif_frais",
    categorieFrais: partiel.categorieFrais ?? null,
    anneeFiscale: partiel.anneeFiscale ?? 2026,
    cheminStockage: partiel.cheminStockage ?? `u/2026/x/${partiel.id}`,
    nomFichier: partiel.nomFichier ?? `${partiel.id}.pdf`,
    tailleOctets: partiel.tailleOctets ?? 1000,
    mime: partiel.mime ?? "application/pdf",
    dateDocument: partiel.dateDocument ?? null,
    notes: partiel.notes ?? null,
    creeLe: partiel.creeLe ?? "2026-08-06T09:00:00.000Z",
  };
}

describe("regrouperDocuments — aucun document ne disparaît", () => {
  it("le total des documents regroupés égale toujours le total d'entrée", () => {
    const documents = [
      doc({ id: "a", typeDocument: "aem_bulletin" }),
      doc({ id: "b", typeDocument: "justificatif_frais", categorieFrais: "A" }),
      doc({ id: "c", typeDocument: "justificatif_frais", categorieFrais: null }),
      doc({ id: "d", typeDocument: TYPE_INCONNU_DU_CODE }),
      doc({ id: "e", typeDocument: "notification_are", categorieFrais: "C7" }), // catégorie illégitime
    ];
    const groupes = regrouperDocuments(documents);
    const compte = groupes.reduce((total, g) => total + g.documents.length, 0);
    expect(compte).toBe(5);
  });

  it("un type INCONNU du code atterrit dans « Autres documents », en fin de liste — jamais écarté", () => {
    const groupes = regrouperDocuments([doc({ id: "a", typeDocument: "aem_bulletin" }), doc({ id: "zz", typeDocument: TYPE_INCONNU_DU_CODE })]);
    const dernier = groupes[groupes.length - 1];
    expect(dernier.libelle).toBe("Autres documents");
    expect(dernier.documents.map((d) => d.id)).toEqual(["zz"]);
  });

  it("un justificatif de frais SANS catégorie va dans « Sans catégorie », toujours en dernier sous-groupe", () => {
    const groupes = regrouperDocuments([
      doc({ id: "sans", typeDocument: "justificatif_frais", categorieFrais: null }),
      doc({ id: "avecA", typeDocument: "justificatif_frais", categorieFrais: "A" }),
    ]);
    const frais = groupes.find((g) => g.type === "justificatif_frais")!;
    expect(frais.sousGroupes.map((s) => s.libelle)).toEqual([expect.stringContaining("A —"), "Sans catégorie"]);
    expect(frais.sousGroupes[1].documents.map((d) => d.id)).toEqual(["sans"]);
  });

  it("une catégorie INCONNUE tombe dans « Sans catégorie » plutôt que sous un libellé inventé", () => {
    const groupes = regrouperDocuments([doc({ id: "x", typeDocument: "justificatif_frais", categorieFrais: "Z9" })]);
    const frais = groupes.find((g) => g.type === "justificatif_frais")!;
    expect(frais.sousGroupes).toHaveLength(1);
    expect(frais.sousGroupes[0].categorie).toBeNull();
    expect(frais.sousGroupes[0].documents.map((d) => d.id)).toEqual(["x"]);
  });

  it("une catégorie posée sur un type qui n'est pas justificatif_frais est ignorée, le document reste dans son type", () => {
    const groupes = regrouperDocuments([doc({ id: "n", typeDocument: "notification_are", categorieFrais: "C7" })]);
    const notif = groupes.find((g) => g.type === "notification_are")!;
    expect(notif.documents.map((d) => d.id)).toEqual(["n"]);
    expect(notif.sousGroupes).toEqual([]);
  });
});

describe("regrouperDocuments — ordre et totaux", () => {
  it("les catégories suivent l'ordre officiel A, B, C1…C9, D, pas l'ordre d'arrivée", () => {
    const groupes = regrouperDocuments([
      doc({ id: "1", categorieFrais: "C7" }),
      doc({ id: "2", categorieFrais: "A" }),
      doc({ id: "3", categorieFrais: "D" }),
      doc({ id: "4", categorieFrais: "C1" }),
    ]);
    const frais = groupes[0];
    expect(frais.sousGroupes.map((s) => s.categorie)).toEqual(["A", "C1", "C7", "D"]);
  });

  it("les catégories vides sont omises", () => {
    const groupes = regrouperDocuments([doc({ id: "1", categorieFrais: "A" })]);
    expect(groupes[0].sousGroupes).toHaveLength(1);
  });

  it("l'ordre d'entrée est CONSERVÉ dans un groupe — jamais retrié (une seule source de vérité)", () => {
    const groupes = regrouperDocuments([
      doc({ id: "recent", categorieFrais: "A", creeLe: "2026-08-06T10:00:00.000Z" }),
      doc({ id: "ancien", categorieFrais: "A", creeLe: "2020-01-01T00:00:00.000Z" }),
    ]);
    expect(groupes[0].sousGroupes[0].documents.map((d) => d.id)).toEqual(["recent", "ancien"]);
  });

  it("les totaux d'octets s'additionnent par groupe et par sous-groupe", () => {
    const groupes = regrouperDocuments([
      doc({ id: "1", categorieFrais: "A", tailleOctets: 1500 }),
      doc({ id: "2", categorieFrais: "A", tailleOctets: 2500 }),
      doc({ id: "3", categorieFrais: "B", tailleOctets: 1000 }),
    ]);
    expect(groupes[0].totalOctets).toBe(5000);
    expect(groupes[0].sousGroupes[0].totalOctets).toBe(4000);
    expect(groupes[0].sousGroupes[1].totalOctets).toBe(1000);
  });

  it("une liste vide rend une liste vide, sans groupe fantôme", () => {
    expect(regrouperDocuments([])).toEqual([]);
  });
});

describe("cheminDansArchive", () => {
  it("range un justificatif de frais sous <type>/<catégorie>/", () => {
    expect(cheminDansArchive(doc({ id: "x", typeDocument: "justificatif_frais", categorieFrais: "C7", nomFichier: "facture.pdf" }))).toBe(
      "justificatif_frais/C7/facture.pdf",
    );
  });

  it("range les autres types sous <type>/ seulement", () => {
    expect(cheminDansArchive(doc({ id: "x", typeDocument: "aem_bulletin", nomFichier: "aem.pdf" }))).toBe("aem_bulletin/aem.pdf");
  });

  it("range un justificatif sans catégorie sous sans-categorie/", () => {
    expect(cheminDansArchive(doc({ id: "x", typeDocument: "justificatif_frais", categorieFrais: null, nomFichier: "f.pdf" }))).toBe(
      "justificatif_frais/sans-categorie/f.pdf",
    );
  });

  it("range un type inconnu sous autres/", () => {
    expect(cheminDansArchive(doc({ id: "x", typeDocument: TYPE_INCONNU_DU_CODE, nomFichier: "f.pdf" }))).toBe("autres/f.pdf");
  });
});

describe("cheminUnique — deux « facture.pdf » ne doivent JAMAIS s'écraser", () => {
  it("laisse un chemin libre intact", () => {
    const pris = new Set<string>();
    expect(cheminUnique("a/facture.pdf", pris)).toBe("a/facture.pdf");
  });

  it("numérote les doublons successifs au lieu de les écraser (devoir n°1)", () => {
    const pris = new Set<string>();
    expect(cheminUnique("a/facture.pdf", pris)).toBe("a/facture.pdf");
    expect(cheminUnique("a/facture.pdf", pris)).toBe("a/facture (2).pdf");
    expect(cheminUnique("a/facture.pdf", pris)).toBe("a/facture (3).pdf");
    expect(pris.size).toBe(3);
  });

  it("garde l'extension à sa place", () => {
    const pris = new Set(["a/photo.jpeg"]);
    expect(cheminUnique("a/photo.jpeg", pris)).toBe("a/photo (2).jpeg");
  });

  it("gère un nom SANS extension sans couper dans un dossier contenant un point", () => {
    const pris = new Set(["dossier.v2/scan"]);
    expect(cheminUnique("dossier.v2/scan", pris)).toBe("dossier.v2/scan (2)");
  });
});
