import { describe, expect, it } from "vitest";
import { TAILLE_MAX_PDF_OCTETS, validerFichierPourEnvoiIA, type FichierCandidat } from "../fichierImportIA";

// Note de couverture : `lirePdfEnBase64` n'est pas testée ici — elle repose sur `FileReader`, absent
// de l'environnement `node` dans lequel tournent ces tests. Vérifiée à la main dans le navigateur.

function fichier(partiel: Partial<FichierCandidat> = {}): FichierCandidat {
  return { name: "notification.pdf", type: "application/pdf", size: 120_000, ...partiel };
}

describe("validerFichierPourEnvoiIA — refuser tôt ce qui échouerait de toute façon", () => {
  it("accepte un PDF de taille normale", () => {
    expect(validerFichierPourEnvoiIA(fichier())).toEqual({ ok: true });
  });

  it("refuse un fichier qui n'est pas un PDF", () => {
    const verdict = validerFichierPourEnvoiIA(fichier({ name: "photo.png", type: "image/png" }));
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ erreur: expect.stringContaining("PDF") });
  });

  it("refuse un fichier vide", () => {
    const verdict = validerFichierPourEnvoiIA(fichier({ size: 0 }));
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ erreur: expect.stringContaining("vide") });
  });
});

describe("validerFichierPourEnvoiIA — le type MIME manquant ne doit pas faire refuser un vrai PDF", () => {
  // Certains glisser-déposer et certains systèmes ne renseignent pas `type`.
  it("accepte un type vide si l'extension est .pdf", () => {
    expect(validerFichierPourEnvoiIA(fichier({ type: "" }))).toEqual({ ok: true });
  });

  it("accepte l'extension en majuscules", () => {
    expect(validerFichierPourEnvoiIA(fichier({ name: "AEM-JUIN.PDF", type: "" }))).toEqual({ ok: true });
  });

  it("refuse un type vide sans extension .pdf", () => {
    expect(validerFichierPourEnvoiIA(fichier({ name: "document", type: "" })).ok).toBe(false);
  });

  // L'extension ne doit jamais l'emporter sur un type MIME qui dit explicitement autre chose :
  // sinon un .png renommé en .pdf partirait pour rien.
  it("refuse une extension .pdf quand le type MIME dit autre chose", () => {
    expect(validerFichierPourEnvoiIA(fichier({ name: "faux.pdf", type: "image/png" })).ok).toBe(false);
  });
});

describe("validerFichierPourEnvoiIA — plafond de taille (corps de requête Edge)", () => {
  it("accepte un fichier pile à la limite", () => {
    expect(validerFichierPourEnvoiIA(fichier({ size: TAILLE_MAX_PDF_OCTETS }))).toEqual({ ok: true });
  });

  it("refuse un fichier d'un octet au-dessus de la limite", () => {
    expect(validerFichierPourEnvoiIA(fichier({ size: TAILLE_MAX_PDF_OCTETS + 1 })).ok).toBe(false);
  });

  it("dit le poids réel ET la limite, en mégaoctets lisibles", () => {
    const verdict = validerFichierPourEnvoiIA(fichier({ size: 5 * 1024 * 1024 }));
    expect(verdict).toMatchObject({ erreur: expect.stringContaining("5,0 Mo") });
    expect(verdict).toMatchObject({ erreur: expect.stringContaining("3,0 Mo") });
  });
});

describe("validerFichierPourEnvoiIA — chaque refus dit que rien n'est parti et propose une suite", () => {
  const refuses: FichierCandidat[] = [
    fichier({ name: "photo.png", type: "image/png" }),
    fichier({ size: 0 }),
    fichier({ size: TAILLE_MAX_PDF_OCTETS + 1 }),
  ];

  // Un refus muet sur ce point laisserait planer le doute : « est-ce que mon document est parti
  // quand même ? ». Sur un canal qui envoie des fiches de paie, la réponse doit être écrite.
  it("affirme dans tous les cas qu'aucun envoi n'a eu lieu", () => {
    for (const candidat of refuses) {
      const verdict = validerFichierPourEnvoiIA(candidat);
      expect(verdict).toMatchObject({ erreur: expect.stringContaining("Rien n'a été envoyé") });
    }
  });

  it("rappelle dans tous les cas que la saisie manuelle reste possible", () => {
    for (const candidat of refuses) {
      const verdict = validerFichierPourEnvoiIA(candidat);
      expect(verdict).toMatchObject({ erreur: expect.stringContaining("à la main") });
    }
  });
});
