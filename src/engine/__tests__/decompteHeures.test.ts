import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerDecompteHeures } from "../decompteHeures";
import { contrat, periode, profil } from "./testUtils";

const FENETRE = { dateDebut: "2026-01-01", dateFin: "2026-12-31" };

describe("calculerDecompteHeures", () => {
  it("600 h de cachets + 70 h d'enseignement (<50 ans) = 670 h, seuil 507 h ouvert", () => {
    const p = profil({ dateNaissance: "1990-01-01" }); // <50 ans au 2026-12-31
    const contrats = [
      contrat({ date: "2026-06-01", type: "artiste", typeRemuneration: "cachet", nbCachets: 50 }), // 50*12 = 600 h
      contrat({ date: "2026-06-15", type: "enseignement", typeRemuneration: "heures", nbHeures: 70, etablissementAgree: true, enRapportAvecMetier: true }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.total).toBe(670);
    expect(resultat.repartition.cachets).toBe(600);
    expect(resultat.repartition.enseignementRetenu).toBe(70);
    expect(resultat.repartition.enseignementExcedentaire).toBe(0);
    expect(resultat.total).toBeGreaterThanOrEqual(franceTravailConfig.seuilHeures);
  });

  it("90 h d'enseignement sont plafonnées à 70 h avant 50 ans", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 90, etablissementAgree: true, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.plafondEnseignementApplicable).toBe(70);
    expect(resultat.repartition.enseignementRetenu).toBe(70);
    expect(resultat.repartition.enseignementExcedentaire).toBe(20);
  });

  it("à 50 ans, le plafond d'enseignement passe à 120 h", () => {
    const p = profil({ dateNaissance: "1976-01-01" }); // 50 ans au 2026-12-31
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 110, etablissementAgree: true, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.plafondEnseignementApplicable).toBe(120);
    expect(resultat.repartition.enseignementRetenu).toBe(110);
    expect(resultat.repartition.enseignementExcedentaire).toBe(0);
  });

  it("l'enseignement sans établissement agréé ni lien avec le métier ne compte pas du tout", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 50, etablissementAgree: false, enRapportAvecMetier: true })];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.enseignementRetenu).toBe(0);
  });

  it("100 jours de maternité ajoutent 500 h au décompte (5 h/jour)", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })]; // 100 jours inclusifs
    const resultat = calculerDecompteHeures([], periodes, p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.assimilees).toBe(500);
  });

  describe("aucun jour compté deux fois : période assimilée chevauchant un contrat", () => {
    // Le défaut corrigé le 29/07/2026. Sans exclusion, un jour couvert par un contrat ET par une
    // période valait ses heures de contrat PLUS 5 h assimilées — un compteur 507 h gonflé, donc un
    // faux feu vert. Maternité, adoption, ALD, AT et maladie inter-contrat sont par définition hors
    // contrat : le chevauchement viole la condition réglementaire, l'exclure est conforme au guide.
    const p = profil({ dateNaissance: "1990-01-01" });
    const PERIODE_100J = periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" });

    it("un contrat d'un jour dans la période retire 5 h, et ses propres heures restent comptées", () => {
      const contrats = [contrat({ date: "2026-04-10", typeRemuneration: "cachet", nbCachets: 1 })];
      const resultat = calculerDecompteHeures(contrats, [PERIODE_100J], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(495); // 99 jours × 5 h, et non 100
      expect(resultat.repartition.cachets).toBe(12); // le cachet lui-même compte toujours
      // Le total ne double compte plus le 10 avril : 495 + 12, pas 500 + 12.
      expect(resultat.total).toBe(507);
    });

    it("un contrat de plusieurs jours retire tous ses jours de chevauchement, sans doublon entre contrats", () => {
      const contrats = [
        contrat({ dateDebut: "2026-04-01", date: "2026-04-10", typeRemuneration: "heures", nbHeures: 20 }), // 10 jours dans la période
        contrat({ dateDebut: "2026-04-05", date: "2026-04-12", typeRemuneration: "heures", nbHeures: 10 }), // chevauche le précédent : 2 jours neufs
      ];
      const resultat = calculerDecompteHeures(contrats, [PERIODE_100J], p, franceTravailConfig, FENETRE);
      // 12 jours couverts au total (1er au 12 avril), comptés UNE fois : 88 jours × 5 h.
      expect(resultat.repartition.assimilees).toBe(440);
    });

    it("un contrat hors de la période ne retire rien", () => {
      const contrats = [contrat({ date: "2026-09-01", typeRemuneration: "cachet", nbCachets: 1 })];
      const resultat = calculerDecompteHeures(contrats, [PERIODE_100J], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(500);
    });

    it("un contrat HORS FENÊTRE ne retire rien : il n'apporte aucune heure ici, donc aucun double compte à corriger", () => {
      // Fenêtre 2026 ; contrat de décembre 2025 chevauchant… rien de la période, mais le principe
      // compte : l'exclusion ne doit porter que sur les contrats qui alimentent CE décompte, sinon
      // elle sous-compterait sans rien réparer.
      const periodeDebutAnnee = periode({ type: "ald", dateDebut: "2026-01-01", dateFin: "2026-01-10" }); // 10 jours
      const contrats = [contrat({ dateDebut: "2025-12-20", date: "2025-12-31", typeRemuneration: "heures", nbHeures: 10 })];
      const resultat = calculerDecompteHeures(contrats, [periodeDebutAnnee], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(50);
    });

    it("la période est bornée par la fenêtre : les jours antérieurs ne comptent pas", () => {
      const aCheval = periode({ type: "accident_travail", dateDebut: "2025-12-25", dateFin: "2026-01-05" }); // 5 jours dans la fenêtre
      const resultat = calculerDecompteHeures([], [aCheval], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(25);
    });
  });

  describe("suspension_contrat : exception à l'exclusion — compte toujours 5 h/jour", () => {
    // suspension_contrat se produit PAR NATURE pendant un contrat actif (c'est tout son principe :
    // le contrat existe mais est suspendu). L'exclusion posée pour maternité/adoption/ald/AT ne
    // s'applique donc pas à lui : le guide FT dit qu'il compte 5 h/jour même en chevauchant un
    // contrat. Confirmé par le tableau des 6 types (29/07/2026) — pas une supposition de logique.
    const p = profil({ dateNaissance: "1990-01-01" });

    it("suspension seule dans la fenêtre : 100 jours × 5 h = 500 h", () => {
      const suspension = periode({ type: "suspension_contrat", dateDebut: "2026-03-01", dateFin: "2026-06-08" }); // 100 jours
      const resultat = calculerDecompteHeures([], [suspension], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(500);
    });

    it("suspension chevauchant un contrat : les 5 h/jour restent comptées, pas exclues", () => {
      const suspension = periode({ type: "suspension_contrat", dateDebut: "2026-03-01", dateFin: "2026-06-08" }); // 100 jours
      const contrats = [contrat({ date: "2026-04-10", typeRemuneration: "cachet", nbCachets: 1 })]; // en plein dans la période
      const resultat = calculerDecompteHeures(contrats, [suspension], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(500); // pas 495 : aucune exclusion pour ce type
      expect(resultat.repartition.cachets).toBe(12); // le cachet compte aussi, normalement
    });

    it("suspension hors fenêtre : 0 h", () => {
      const suspension = periode({ type: "suspension_contrat", dateDebut: "2025-01-01", dateFin: "2025-06-08" });
      const resultat = calculerDecompteHeures([], [suspension], p, franceTravailConfig, FENETRE);
      expect(resultat.repartition.assimilees).toBe(0);
    });
  });

  it("le cumul enseignement + formation est plafonné à 338 h", () => {
    const p = profil({ dateNaissance: "1976-01-01" }); // plafond enseignement 120 h
    const contrats = [
      contrat({ date: "2026-05-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 120, etablissementAgree: true, enRapportAvecMetier: true }),
      contrat({ date: "2026-06-01", type: "formation", typeRemuneration: "heures", nbHeures: 250 }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.repartition.enseignementRetenu).toBe(120);
    expect(resultat.repartition.formationRetenue).toBe(218); // 338 - 120
    expect(resultat.repartition.formationExcedentaire).toBe(32);
  });

  it("détecte les mois où le plafond de cachets est dépassé", () => {
    const p = profil();
    const contrats = [
      contrat({ date: "2026-03-05", nbCachets: 20 }),
      contrat({ date: "2026-03-20", nbCachets: 15 }),
    ];
    const resultat = calculerDecompteHeures(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.cachetsParMois["2026-03"]).toBe(35);
  });
});
