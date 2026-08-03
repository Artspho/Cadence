// @vitest-environment jsdom
//
// Points 5 et 6 de docs/critique_2026-08-03.md — le badge du tableau de bord.
// Les tests du moteur (engine/__tests__/prediction.test.ts) prouvent le NIVEAU calculé ; ils ne
// prouvent pas le MOT affiché. Or c'est le mot et la couleur qui mentaient : « Sécurité » en vert
// sur une projection, « Bloqué » en rouge sur une situation rattrapable. Ce fichier ferme la chaîne
// jusqu'au texte réellement rendu, dans le même esprit que le point 12 quater de la critique
// (tester le chemin de production, pas une valeur pré-mâchée) : le niveau n'est jamais écrit à la
// main ici, il vient de calculerStatutPrediction, et les props sont montées exactement comme
// App.tsx puis Dashboard.tsx les montent.
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectionChart } from "../ProjectionChart";
import { calculerStatutPrediction, construireSerieAcquisition, construireSerieAVenir } from "../../engine/prediction";
import { calculerFenetreEnCours } from "../../engine/periodeReference";
import { diffJours } from "../../engine/dateUtils";
import { franceTravailConfig as config } from "../../config/franceTravailConfig";
import { contrat, profil } from "../../engine/__tests__/testUtils";
import type { Contrat } from "../../types";

// Reproduit la préparation des props d'App.tsx (lignes 121-124) puis leur passage par Dashboard.tsx :
// aucun niveau, aucune série, aucune date n'est fabriquée à la main pour le test.
function rendreBadge(contrats: Contrat[], dateDuJour: string, dateAnniversaire = "2026-12-31") {
  const p = profil({ dateAnniversaire });
  const fenetre = calculerFenetreEnCours(p, contrats, [], config, dateDuJour);
  const prediction = calculerStatutPrediction(p, contrats, [], config, dateDuJour);
  const dateCap = diffJours(dateDuJour, fenetre.dateFin) >= 0 ? dateDuJour : fenetre.dateFin;

  render(
    <ProjectionChart
      fenetreDebut={fenetre.dateDebut}
      fenetreFin={prediction.dateAnniversaire}
      dateCap={dateCap}
      serie={construireSerieAcquisition(p, contrats, [], config, fenetre, dateCap)}
      serieAVenir={construireSerieAVenir(p, contrats, [], config, fenetre, dateCap)}
      seuilHeures={prediction.seuilHeures}
      heuresActuelles={prediction.heuresActuelles}
      heuresCertainesAVenir={prediction.heuresCertainesAVenir}
      niveau={prediction.niveau}
      dateFranchissementProjetee={prediction.dateFranchissementProjetee}
      rythmeMensuelActuel={prediction.rythmeMensuelActuel}
      anniversaireConnu={prediction.anniversaireConnu}
    />,
  );
  return prediction;
}

describe("badge de statut affiché (points 5 et 6 de la critique du 03/08/2026)", () => {
  it("projection suffisante mais rien d'acquis : l'écran affiche « En bonne voie », jamais « Sécurité »", () => {
    // 300 h acquises au 1er juillet (~50 h/mois) : la projection franchit les 507 h avant l'échéance.
    const prediction = rendreBadge([contrat({ date: "2026-02-01", nbCachets: 25 })], "2026-07-01");

    expect(prediction.heuresActuelles).toBe(300); // le seuil n'est PAS atteint
    expect(screen.getByText("En bonne voie")).toBeInTheDocument();
    expect(screen.queryByText("Sécurité")).not.toBeInTheDocument(); // le faux feu vert du point 5
  });

  it("le badge « En bonne voie » n'emprunte pas le vert (réservé à l'acquis) ni le teal du segment « confirmé à venir »", () => {
    rendreBadge([contrat({ date: "2026-02-01", nbCachets: 25 })], "2026-07-01");

    const badge = screen.getByText("En bonne voie").closest("span")!;
    expect(badge.className).toContain("text-violet");
    expect(badge.className).not.toContain("text-mint"); // le vert reste au droit acquis
    expect(badge.className).not.toContain("text-teal"); // le teal désigne déjà les contrats signés
  });

  it("il ne manque qu'un cachet à 25 jours de l'échéance : l'écran n'affiche jamais « Bloqué »", () => {
    // 492 h : il manque 15 h. AVANT la correction, cet écran affichait « Bloqué » en rouge.
    const prediction = rendreBadge([contrat({ date: "2026-02-01", nbCachets: 41 })], "2026-12-06");

    expect(prediction.joursRestants).toBe(25);
    expect(screen.queryByText("Bloqué")).not.toBeInTheDocument(); // le faux « Bloqué » du point 6
  });

  it("échéance à 25 jours, rythme insuffisant mais écart rattrapable : l'écran affiche « À rattraper », pas « Bloqué »", () => {
    // 408 h : il manque 99 h en 25 j, très en dessous du plafond de l'Annexe 10.
    rendreBadge([contrat({ date: "2026-02-01", nbCachets: 34 })], "2026-12-06");

    expect(screen.getByText("À rattraper")).toBeInTheDocument();
    expect(screen.queryByText("Bloqué")).not.toBeInTheDocument();
  });

  it("contrôle négatif — 540 h réellement acquises : l'écran affiche bien « Sécurité » en vert", () => {
    rendreBadge([contrat({ date: "2026-02-01", nbCachets: 45 })], "2026-07-01");

    const badge = screen.getByText("Sécurité").closest("span")!;
    expect(badge.className).toContain("text-mint");
  });

  it("contrôle négatif — écart hors de portée du plafond légal : l'écran affiche « Bloqué » en rouge", () => {
    // 96 h : il manque 411 h en 25 j, quand le plafond n'en permet que 280. Le rouge n'a pas disparu.
    rendreBadge([contrat({ date: "2026-02-01", nbCachets: 8 })], "2026-12-06");

    const badge = screen.getByText("Bloqué").closest("span")!;
    expect(badge.className).toContain("text-red");
  });
});
