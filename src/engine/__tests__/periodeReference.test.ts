import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFenetreEnCours, calculerFenetreReference, deriverFctRetenueActuelle } from "../periodeReference";
import { ajouterJours, diffJours } from "../dateUtils";
import { contrat, periode, profil } from "./testUtils";

describe("calculerFenetreReference", () => {
  it("fenêtre de base : 365 j se terminant à la date anniversaire", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const fenetre = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(fenetre.dateFin).toBe("2026-12-31");
    expect(diffJours(fenetre.dateDebut, fenetre.dateFin)).toBe(364); // 365 jours inclusifs
    expect(fenetre.joursAllongementMaladie).toBe(0);
  });

  it("une maladie inter-contrat allonge la fenêtre d'autant de jours", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const periodes = [periode({ type: "maladie_intercontrat", dateDebut: "2025-01-01", dateFin: "2025-01-30" })]; // 30 jours
    const fenetre = calculerFenetreReference(p, [], periodes, franceTravailConfig, "2026-06-01");
    expect(fenetre.joursAllongementMaladie).toBe(30);

    const sansMaladie = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(diffJours(fenetre.dateDebut, sansMaladie.dateDebut)).toBe(30);
  });

  it("première admission sans date anniversaire connue : fenêtre glissante se terminant aujourd'hui", () => {
    const p = profil({ dateAnniversaire: "" });
    const fenetre = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    expect(fenetre.dateFin).toBe("2026-06-01");
  });

  it("réadmission : étend réellement la fenêtre et augmente le seuil requis quand des heures existent plus loin dans le passé", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    // 300 h dans la fenêtre de base (insuffisant) + 360 h qui n'apparaissent qu'une fois la
    // fenêtre étendue de 2 tranches — reprend le scénario de calculerAJBrutePourFenetre
    // (areBrute.test.ts), qui réussit légitimement à la 3e tentative (tranches = 2), très loin
    // du plafond de 24 : garde-fou de non-régression pour un vrai succès d'extension.
    const contrats = [
      contrat({ date: "2026-06-01", nbCachets: 25 }), // 300 h, dans la fenêtre de base
      contrat({ date: "2025-11-15", nbCachets: 30 }), // 360 h, compté seulement une fois étendue
    ];
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 2, seuilHeuresAjuste: 591 });
  });

  it("réadmission : pas d'extension si le seuil de base est déjà atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 45 })]; // 540 h >= 507 h
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: franceTravailConfig.seuilHeures });
  });

  it("réadmission : seuil non calculable quand l'historique de contrats est trop court pour jamais rattraper le seuil qui grimpe (bug réel signalé par un testeur)", () => {
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    // Un seul contrat récent, rien avant : reculer la fenêtre n'ajoute jamais d'heure
    // supplémentaire, alors que le seuil exigé grimpe de 42 h à chaque tranche — l'algorithme
    // épuise ses 24 tentatives sans jamais pouvoir réussir. AVANT ce correctif, ce même scénario
    // (au format réduit ci-dessus) passait le test précédent sans que personne ne remarque qu'il
    // s'agissait déjà du cas d'échec, pas d'un vrai succès (cf. docs/validation.md, dette tracée).
    // Pas de dateAnniversairePrecedente ici : c'est précisément le cas "historique_insuffisant",
    // à distinguer de "hors_bornes" ci-dessous (bound connue) dans les tests suivants.
    const contrats = [contrat({ date: "2026-01-27", typeRemuneration: "heures", nbHeures: 50 })];
    const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-07-23");
    expect(fenetre.seuilReadmission).toEqual({ calculable: false, raison: "historique_insuffisant", tranchesTentees: 24 });
    // Repli sur la fenêtre de base non étendue, pas la fenêtre poussée à 24 tranches sans validation.
    const fenetreNonReadmission = calculerFenetreReference({ ...p, situation: "premiere_admission" }, contrats, [], franceTravailConfig, "2026-07-23");
    expect(fenetre.dateDebut).toBe(fenetreNonReadmission.dateDebut);
  });

  describe("réadmission avec dateAnniversairePrecedente (bornage réel de la recherche)", () => {
    it("une borne lointaine ne change rien à un succès d'extension déjà validé (non-régression)", () => {
      const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission", dateAnniversairePrecedente: "2020-01-01" });
      const contrats = [
        contrat({ date: "2026-06-01", nbCachets: 25 }), // 300 h, dans la fenêtre de base
        contrat({ date: "2025-11-15", nbCachets: 30 }), // 360 h, compté seulement une fois étendue
      ];
      const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 2, seuilHeuresAjuste: 591 });
    });

    it("borne atteinte sans jamais trouver assez d'heures : calculable false, raison hors_bornes (résultat réglementaire, pas un manque de données)", () => {
      // Borne choisie pile sur la limite d'une tranche (2025-12-02) et aucun contrat : la
      // recherche s'arrête exactement à la borne, jamais avant (TRANCHES_MAX ne joue aucun rôle
      // ici, calculé indépendamment et vérifié par simulation avant d'écrire ce test).
      const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission", dateAnniversairePrecedente: "2025-12-02" });
      const fenetre = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
      expect(fenetre.seuilReadmission).toEqual({ calculable: false, raison: "hors_bornes", tranchesTentees: 1, dateAnniversairePrecedente: "2025-12-02" });
      expect(fenetre.dateDebut).toBe("2025-12-02"); // fenêtre gardée jusqu'à la borne, contrairement à historique_insuffisant
    });

    it("non-double-comptage : un contrat antérieur à la borne n'est jamais compté, même s'il suffirait à faire réussir la recherche", () => {
      const p = profil({ dateAnniversaire: "2026-12-31", situation: "readmission", dateAnniversairePrecedente: "2025-12-02" });
      // 600 h, largement de quoi réussir à n'importe quel seuil de la boucle — mais datées AVANT
      // la borne : si le moteur les comptait, ce test échouerait avec calculable:true.
      const contrats = [contrat({ date: "2025-06-01", nbCachets: 50 })];
      const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(fenetre.seuilReadmission).toEqual({ calculable: false, raison: "hors_bornes", tranchesTentees: 1, dateAnniversairePrecedente: "2025-12-02" });
    });

    it("borne plus proche que 365 j ET seuil déjà atteint dans la fenêtre naïve : la fenêtre de BASE elle-même est bornée, pas seulement son extension (corrigé le 31/07/2026, chantier renouvellement anticipé)", () => {
      // AVANT ce correctif : dateDebutAllonge (dateFin - 364 j) ignorait la borne tant que le seuil
      // était atteint dès la 1ʳᵉ itération (tranches=0, la borne n'est consultée que lors d'une
      // tentative d'extension) — la fenêtre débordait alors AVANT la borne, gonflant SR/NHT avec des
      // contrats déjà comptés pour le droit précédent. Cas réel qui a révélé le bug : Notification 2
      // du 31/07/2026 (FCT 17/01/2026, ancien droit clos le 23/03/2025, soit ~300 j avant — moins de
      // 365 j) — cf. engine/renouvellementAnticipe.test.ts, docs/validation.md Réel #1 ("~299 j").
      const p = profil({ dateAnniversaire: "2026-01-17", situation: "readmission", dateAnniversairePrecedente: "2025-03-23" });
      const contrats = [contrat({ date: "2026-01-17", typeRemuneration: "heures", nbHeures: 710 })]; // >= 507 h dès la fenêtre bornée
      const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-01-17");
      expect(fenetre.dateDebut).toBe("2025-03-24"); // borne + 1 jour, PAS dateFin - 364 (= 2025-01-18)
      expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: franceTravailConfig.seuilHeures });
    });

    it("même règle avec des dates et un volume d'heures totalement différents du cas réel (isole la règle générale, pas une coïncidence de calendrier)", () => {
      // Aucun rapport avec le cas réel du 31/07/2026 (dates arbitraires, 5 mois d'écart au lieu de
      // ~10, 600 h au lieu de 710) : si ce test passe pour des raisons différentes du précédent, la
      // borne s'applique bien à la fenêtre de base en général, pas seulement pour ce calendrier précis.
      const p = profil({ dateAnniversaire: "2026-08-01", situation: "readmission", dateAnniversairePrecedente: "2026-03-01" });
      const contrats = [contrat({ date: "2026-08-01", typeRemuneration: "heures", nbHeures: 600 })]; // >= 507 h dès la fenêtre bornée
      const fenetre = calculerFenetreReference(p, contrats, [], franceTravailConfig, "2026-08-01");
      expect(fenetre.dateDebut).toBe("2026-03-02"); // borne + 1 jour, PAS dateFin - 364 (= 2025-08-02)
      expect(fenetre.seuilReadmission).toEqual({ calculable: true, tranchesReadmission: 0, seuilHeuresAjuste: franceTravailConfig.seuilHeures });
    });
  });
});

// Bug réel corrigé le 31/07/2026 : RenouvellementAnticipe.tsx utilisait `profil.dateAnniversaire`
// directement comme FCT du droit en cours, alors que ce champ porte la PROCHAINE échéance (cf.
// types/index.ts, engine/prediction.ts) — ce qui recomptait à tort la fenêtre rétrospective déjà
// utilisée pour ouvrir le droit en cours dès qu'une réadmission datait de plus de quelques mois.
// Déplacé depuis renouvellementAnticipe.test.ts le 31/07/2026 quand la fonction a rejoint ce module.
describe("deriverFctRetenueActuelle", () => {
  it("retrouve la FCT du cas réel du 31/07/2026 à partir de la nouvelle date anniversaire (17/01/2026 + 12 mois = 17/01/2027)", () => {
    expect(deriverFctRetenueActuelle("2027-01-17", franceTravailConfig)).toBe("2026-01-17");
  });

  it("inverse exacte de la Règle #2 (NouveauDroitCalcule.dateAnniversaire = FCT retenue + 12 mois)", () => {
    const fct = "2025-03-23";
    const echeance = ajouterJours(fct, franceTravailConfig.periodeReferenceJours);
    expect(deriverFctRetenueActuelle(echeance, franceTravailConfig)).toBe(fct);
  });
});

// Bug réel corrigé le 31/07/2026 : Profil.dateAnniversairePrecedente n'a qu'UNE signification
// possible à la fois, mais deux usages légitimes et incompatibles le réclamaient — la vraie borne
// historique du cycle PASSÉ (engine/cycles.ts) et la borne du cycle EN COURS (ici). calculerFenetreEnCours
// dérive systématiquement cette dernière depuis dateAnniversaire, sans jamais lire
// dateAnniversairePrecedente tel quel — qui reste libre de porter sa vraie vocation historique.
describe("calculerFenetreEnCours", () => {
  it("dérive la borne de réadmission depuis dateAnniversaire, ignore dateAnniversairePrecedente même s'il porte une valeur historique différente (plus ancienne)", () => {
    // Cas réel du 31/07/2026 : droit en cours ouvert le 18/01/2026 (FCT 17/01/2026), prochaine
    // échéance 17/01/2027. dateAnniversairePrecedente porte encore la VRAIE borne historique du
    // cycle d'avant (23/03/2025, cf. engine/cycles.ts) — pas la FCT du droit en cours. Sans la
    // dérivation, la fenêtre en cours pourrait recompter les heures de l'ancien droit (24/03/2025→
    // 17/01/2026) si elle avait besoin d'étendre par tranches.
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission", dateAnniversairePrecedente: "2025-03-23" });
    // Volume qui ne peut être atteint qu'en recomptant les heures de l'ancien droit si la borne
    // n'est pas dérivée correctement : un seul contrat, juste avant la FCT du droit en cours.
    const contrats = [contrat({ date: "2025-06-01", nbCachets: 60 })]; // 720 h, avant la FCT du droit en cours (17/01/2026)
    const fenetre = calculerFenetreEnCours(p, contrats, [], franceTravailConfig, "2026-07-31");
    expect(fenetre.dateDebut).toBe("2026-01-18"); // borné à la FCT du droit en cours (17/01/2026) + 1 j
    expect(fenetre.dateFin).toBe("2027-01-17");
    // Le contrat de l'ancien droit (2025-06-01) n'entre jamais dans le décompte : la fenêtre ne
    // remonte pas jusque-là, quelle que soit la valeur de dateAnniversairePrecedente.
  });

  it("première admission ou dateAnniversaire inconnue : identique à calculerFenetreReference (rien à dériver)", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const attendu = calculerFenetreReference(p, [], [], franceTravailConfig, "2026-06-01");
    const obtenu = calculerFenetreEnCours(p, [], [], franceTravailConfig, "2026-06-01");
    expect(obtenu).toEqual(attendu);
  });
});
