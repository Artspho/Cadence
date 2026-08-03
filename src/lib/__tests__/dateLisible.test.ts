import { describe, expect, it } from "vitest";
import { formaterDateLisible } from "../dateLisible";

// Ce formateur ne sert qu'à l'affichage, mais il affiche des dates de SOURCE réglementaire
// (« Règles vérifiées le… »). Une date décalée d'un jour ou un « Invalid Date » à l'écran
// décrédibiliseraient l'information la plus sensible du bandeau : sa fraîcheur.
describe("formaterDateLisible", () => {
  it("met une date ISO en français lisible", () => {
    expect(formaterDateLisible("2026-08-03")).toBe("3 août 2026");
  });

  it("écrit « 1er » pour le premier du mois, seule irrégularité de l'ordinal français", () => {
    expect(formaterDateLisible("2026-06-01")).toBe("1er juin 2026");
  });

  it("orthographie correctement les mois accentués", () => {
    expect(formaterDateLisible("2026-02-15")).toBe("15 février 2026");
    expect(formaterDateLisible("2026-12-25")).toBe("25 décembre 2026");
  });

  // Le piège que le choix de l'UTC évite : une date ISO nue est lue à minuit UTC. Relue en heure
  // locale dans un fuseau négatif, elle reculerait d'un jour.
  it("ne décale pas le jour, quel que soit le fuseau (lecture en UTC)", () => {
    expect(formaterDateLisible("2026-01-01")).toBe("1er janvier 2026");
    expect(formaterDateLisible("2026-12-31")).toBe("31 décembre 2026");
  });

  it("accepte une date ISO horodatée", () => {
    expect(formaterDateLisible("2026-08-03T10:30:00Z")).toBe("3 août 2026");
  });

  // Devoir n°2 : une entrée illisible ressort telle quelle, jamais « Invalid Date » ni une date
  // inventée qui aurait l'air vraie.
  it("renvoie l'entrée telle quelle si elle n'est pas une date", () => {
    expect(formaterDateLisible("pas une date")).toBe("pas une date");
    expect(formaterDateLisible("")).toBe("");
    expect(formaterDateLisible("2026-13-45")).toBe("2026-13-45");
  });
});
