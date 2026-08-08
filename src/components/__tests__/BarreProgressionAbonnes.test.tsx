// @vitest-environment jsdom
//
// 08/08/2026, demande de Benoît : barre de progression vers la baisse de prix, en tête du tableau
// de bord. Lit `abonnesConfig.ts` directement (pas de props) — les assertions recalculent donc les
// valeurs attendues depuis ce même fichier plutôt que de recopier des nombres en dur, pour rester
// justes si Benoît met le config à jour plus tard.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarreProgressionAbonnes } from "../BarreProgressionAbonnes";
import { abonnesConfig } from "../../config/abonnesConfig";

describe("BarreProgressionAbonnes", () => {
  it("affiche le compte actuel sur le seuil, tel que déclaré dans abonnesConfig.ts", () => {
    render(<BarreProgressionAbonnes />);
    expect(screen.getByText(`${abonnesConfig.nombreActuel}/${abonnesConfig.seuilProchaineReduction} abonnés`)).toBeInTheDocument();
  });

  it("annonce le nombre d'abonnés restants tant que le seuil n'est pas atteint", () => {
    render(<BarreProgressionAbonnes />);
    const restants = abonnesConfig.seuilProchaineReduction - abonnesConfig.nombreActuel;
    if (restants > 0) {
      expect(screen.getByText(new RegExp(`encore ${restants} abonnés? avant la prochaine baisse de prix`, "i"))).toBeInTheDocument();
    } else {
      expect(screen.getByText(/seuil atteint/i)).toBeInTheDocument();
    }
  });

  it("ne dépasse jamais 100 % de largeur, même si le config venait à dépasser le seuil", () => {
    render(<BarreProgressionAbonnes />);
    const barre = document.querySelector(".bg-mint.transition-\\[width\\]") as HTMLElement;
    const largeur = parseFloat(barre.style.width);
    expect(largeur).toBeGreaterThanOrEqual(0);
    expect(largeur).toBeLessThanOrEqual(100);
  });
});
