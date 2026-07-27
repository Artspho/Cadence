import { describe, expect, it } from "vitest";
import { calculerStatutJustificatif } from "../statutJustificatif";

describe("calculerStatutJustificatif", () => {
  it("catégorie A/B sans fichier : non requis (SNAM §5)", () => {
    expect(calculerStatutJustificatif("A", false)).toBe("non_requis");
    expect(calculerStatutJustificatif("B", false)).toBe("non_requis");
  });

  it("catégorie C/D sans fichier : manquant", () => {
    expect(calculerStatutJustificatif("C1", false)).toBe("manquant");
    expect(calculerStatutJustificatif("D", false)).toBe("manquant");
  });

  it("fourni dès qu'un fichier est présent, quelle que soit la catégorie — y compris via un driveFileId (étape 3)", () => {
    expect(calculerStatutJustificatif("C1", true)).toBe("fourni");
    expect(calculerStatutJustificatif("A", true)).toBe("fourni");
  });
});
