import { describe, expect, it } from "vitest";
import { construireLienFeedback } from "../contact";

describe("construireLienFeedback", () => {
  it("construit exactement le lien attendu (sujet + gabarit fixes), sans aucune donnée utilisateur", () => {
    // La chaîne exacte prouve, par construction, qu'aucune autre donnée ne peut s'y glisser :
    // la fonction ne prend que l'email en paramètre, rien d'autre n'entre dans le résultat.
    const attendu =
      "mailto:test@exemple.fr?subject=Retour%20sur%20Cadence&body=Ce%20que%20je%20faisais%20%3A%20%0A%0ACe%20que%20j'attendais%20%3A%20%0A%0ACe%20qui%20s'est%20pass%C3%A9%20%3A%20%0A";
    expect(construireLienFeedback("test@exemple.fr")).toBe(attendu);
  });
});
