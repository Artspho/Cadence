import { describe, expect, it } from "vitest";
import { centreAlertesPourEcran } from "../alertesAffichage";
import { CONTRADICTION_HORS_A10 } from "../../content/contradictionHorsA10";
import type { Alerte } from "../../types";

const contradiction: Alerte = {
  code: "salaires_hors_a10_contradictoires",
  niveau: "critique",
  titre: CONTRADICTION_HORS_A10.titre,
  message: CONTRADICTION_HORS_A10.messageAlerte,
  actionSuggeree: CONTRADICTION_HORS_A10.action,
};

const plafond: Alerte = {
  code: "plafond_enseignement",
  niveau: "attention",
  titre: "Plafond d'enseignement dépassé",
  message: "20 h d'enseignement ne comptent plus.",
};

const rythme: Alerte = {
  code: "rythme_insuffisant",
  niveau: "attention",
  titre: "Rythme insuffisant",
  message: "Il manque 50 h.",
};

describe("centreAlertesPourEcran — bandeau de contradiction affiché", () => {
  it("retire l'alerte de contradiction : le même fait n'est plus écrit deux fois sur l'écran", () => {
    const r = centreAlertesPourEcran([contradiction, plafond], true);
    expect(r.alertes.map((a) => a.code)).toEqual(["plafond_enseignement"]);
    expect(r.afficherCentre).toBe(true);
  });

  it("ne retire QU'elle, et garde l'ordre d'origine des autres alertes", () => {
    const r = centreAlertesPourEcran([contradiction, plafond, rythme], true);
    expect(r.alertes).toEqual([plafond, rythme]);
  });

  // Le piège central : la contradiction est souvent la SEULE alerte d'un profil. Filtrer sans plus
  // de précaution laisserait AlertCenter afficher « ✓ Aucune alerte pour l'instant » juste au-dessus
  // d'un bandeau rouge — un faux feu vert (devoir sacré n°2).
  it("ne monte plus le centre du tout quand la contradiction était la seule alerte (jamais de faux « Aucune alerte » sous un bandeau critique)", () => {
    const r = centreAlertesPourEcran([contradiction], true);
    expect(r.alertes).toEqual([]);
    expect(r.afficherCentre).toBe(false);
  });

  it("aucune alerte du tout + bandeau affiché : rien à monter non plus", () => {
    expect(centreAlertesPourEcran([], true)).toEqual({ alertes: [], afficherCentre: false });
  });
});

describe("centreAlertesPourEcran — pas de bandeau sur cet écran", () => {
  it("laisse la liste intacte, contradiction comprise : sans bandeau, l'alerte est le seul porteur du message", () => {
    const r = centreAlertesPourEcran([contradiction, plafond], false);
    expect(r.alertes).toEqual([contradiction, plafond]);
    expect(r.afficherCentre).toBe(true);
  });

  it("liste vide sans bandeau : le centre reste monté, c'est le vrai « Aucune alerte pour l'instant »", () => {
    expect(centreAlertesPourEcran([], false)).toEqual({ alertes: [], afficherCentre: true });
  });

  it("ne mute pas le tableau reçu", () => {
    const entree = [contradiction, plafond];
    centreAlertesPourEcran(entree, true);
    expect(entree).toHaveLength(2);
  });
});
