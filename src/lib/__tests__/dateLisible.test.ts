import { describe, expect, it } from "vitest";
import { formaterDateLisible, formaterMoisAnnee } from "../dateLisible";

// Ce formateur ne sert qu'à l'affichage, mais il affiche des dates de SOURCE réglementaire
// (« Règles vérifiées le… »). Une date décalée d'un jour ou un « Invalid Date » à l'écran
// décrédibiliseraient l'information la plus sensible du bandeau : sa fraîcheur.
describe("formaterDateLisible", () => {
  it("met une date ISO au format JJ/MM/AAAA", () => {
    expect(formaterDateLisible("2026-08-03")).toBe("03/08/2026");
  });

  it("garde le zéro de tête sur le jour et le mois", () => {
    expect(formaterDateLisible("2026-06-01")).toBe("01/06/2026");
  });

  it("fonctionne sur toutes les dates de l'année", () => {
    expect(formaterDateLisible("2026-02-15")).toBe("15/02/2026");
    expect(formaterDateLisible("2026-12-25")).toBe("25/12/2026");
  });

  // Le piège que le choix de l'UTC évite : une date ISO nue est lue à minuit UTC. Relue en heure
  // locale dans un fuseau négatif, elle reculerait d'un jour.
  it("ne décale pas le jour, quel que soit le fuseau (lecture en UTC)", () => {
    expect(formaterDateLisible("2026-01-01")).toBe("01/01/2026");
    expect(formaterDateLisible("2026-12-31")).toBe("31/12/2026");
  });

  it("accepte une date ISO horodatée", () => {
    expect(formaterDateLisible("2026-08-03T10:30:00Z")).toBe("03/08/2026");
  });

  // Devoir n°2 : une entrée illisible ressort telle quelle, jamais « Invalid Date » ni une date
  // inventée qui aurait l'air vraie.
  it("renvoie l'entrée telle quelle si elle n'est pas une date", () => {
    expect(formaterDateLisible("pas une date")).toBe("pas une date");
    expect(formaterDateLisible("")).toBe("");
    expect(formaterDateLisible("2026-13-45")).toBe("2026-13-45");
  });
});

describe("formaterMoisAnnee", () => {
  it("met une date ISO en mois et année, en français", () => {
    expect(formaterMoisAnnee("2026-08-03")).toBe("août 2026");
    expect(formaterMoisAnnee("2026-01-15")).toBe("janvier 2026");
  });

  it("renvoie l'entrée telle quelle si elle n'est pas une date", () => {
    expect(formaterMoisAnnee("pas une date")).toBe("pas une date");
  });
});
