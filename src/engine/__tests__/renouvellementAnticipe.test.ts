import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFenetreReference } from "../periodeReference";
import { calculerDecompteHeures } from "../decompteHeures";
import { calculerSalaireReference } from "../salaireReference";
import { calculerAJBrutePourFenetre } from "../areBrute";
import { calculerAJNette, calculerSJM } from "../areNette";
import { ajouterJours, diffJours } from "../dateUtils";
import { calculerFranchiseCPAcquise, calculerJoursTravaillesFenetre, calculerRenouvellementAnticipe, delaiSeReapplique, type AncienDroit } from "../renouvellementAnticipe";
import { calculerSerieDepuisContrats } from "../indemnisationMensuelle";
import { contrat, periode, profil } from "./testUtils";

// Cas réel du 31/07/2026 (session Cadence, prompt produit) — deux notifications France Travail
// authentiques : Notification 1 = droit actuellement en cours (avant renouvellement anticipé),
// Notification 2 = résultat réel du renouvellement anticipé demandé avant la date anniversaire.
// Fixture de non-régression BLOQUANTE (devoir sacré n°2) : si un seul chiffre diverge, le moteur est
// faux, on n'avance pas.
//
// Un seul contrat par période plutôt que des dizaines de contrats d'un jour (style habituel de
// testUtils) : un contrat en heures, dimensionné pour couvrir exactement le nombre de jours
// travaillés visé et porter exactement le NH/SR visés, reproduit le cas réel sans complexité inutile.
describe("renouvellementAnticipe — cas réel du 31/07/2026 (Notification 1 + Notification 2)", () => {
  const FCT_ANCIENNE = "2025-03-23";
  const FCT_NOUVELLE = "2026-01-17";

  const contratAncien = contrat({
    dateDebut: ajouterJours(FCT_ANCIENNE, -60), // -> 61 jours calendaires inclus, cf. Notification 1
    date: FCT_ANCIENNE,
    typeRemuneration: "heures",
    nbHeures: 683,
    salaireBrut: 9120.07,
  });
  const contratNouveau = contrat({
    dateDebut: ajouterJours(FCT_NOUVELLE, -56), // -> 57 jours calendaires inclus, cf. Notification 2
    date: FCT_NOUVELLE,
    typeRemuneration: "heures",
    nbHeures: 710,
    salaireBrut: 9229.35,
  });
  const contrats = [contratAncien, contratNouveau];

  // situation "premiere_admission" pour la vérification de Notification 1 : évite la recherche par
  // tranches de periodeReference.ts (réservée à la réadmission), et confirme la règle #1 du prompt
  // ("le moteur standard, fenêtre 365 j se terminant à la FCT, suffit") sans rien y ajouter.
  const profilCourant = profil({ dateNaissance: "1985-06-15", situation: "premiere_admission", dateAnniversaire: FCT_ANCIENNE });

  it("Notification 1 (ancien droit) : le moteur STANDARD retrouve SR, NH, AJ nette et la franchise CP acquise", () => {
    const fenetre = calculerFenetreReference(profilCourant, contrats, [], franceTravailConfig, FCT_ANCIENNE);
    // Vérifie l'énoncé du cas réel ("61 j travaillés du 24/03/2024 au 23/03/2025") plutôt que de le
    // supposer : la fenêtre standard (365 j se terminant à la FCT) doit retomber exactement dessus.
    expect(fenetre.dateDebut).toBe("2024-03-24");
    expect(fenetre.dateFin).toBe(FCT_ANCIENNE);
    expect(diffJours(fenetre.dateDebut, fenetre.dateFin) + 1).toBe(365);

    const decompte = calculerDecompteHeures(contrats, [], profilCourant, franceTravailConfig, fenetre);
    const { sr, sar, nht } = calculerSalaireReference(contrats, [], profilCourant, franceTravailConfig, fenetre);
    expect(sr).toBeCloseTo(9120.07, 2);
    expect(nht).toBe(683);
    expect(sar).toBeNull();

    const ajBrute = calculerAJBrutePourFenetre(fenetre, decompte.total, sar ?? sr, nht, franceTravailConfig);
    const sjm = calculerSJM(sr, nht, franceTravailConfig);
    const ajNette = calculerAJNette(ajBrute.brut, sjm, profilCourant, franceTravailConfig);
    expect(ajNette.net).toBeCloseTo(53.31, 2);

    const joursTravailles = calculerJoursTravaillesFenetre(contrats, fenetre);
    expect(joursTravailles).toBe(61);
    expect(calculerFranchiseCPAcquise(joursTravailles, franceTravailConfig)).toBe(6);
  });

  it("Notification 2 (nouveau droit, renouvellement anticipé) : calculerRenouvellementAnticipe retrouve exactement les mêmes chiffres", () => {
    const ancien: AncienDroit = {
      // Date de notification non fournie par le cas réel (seule la FCT retenue et la date
      // anniversaire notifiée le sont) — approximée à J+2 après la FCT, un délai de traitement
      // plausible. N'affecte que delaiReapplique/tropPercuRisque, non vérifiés par ce test (cf. les
      // cas D1/D2/C1 dédiés, construits et vérifiés au simulateur officiel séparément).
      dateOuverture: "2025-03-25",
      fctRetenue: FCT_ANCIENNE,
      dateAnniversaire: "2026-03-23", // date anniversaire notifiée sur Notification 1
      ajNette: 53.31,
      franchiseCPTotale: 6,
      delaiAttenteInitial: 7,
    };

    const resultat = calculerRenouvellementAnticipe(contrats, [], profilCourant, franceTravailConfig, ancien, FCT_NOUVELLE);

    expect(resultat.nouveau.fctRetenue).toBe(FCT_NOUVELLE);
    // Fenêtre bornée par la FCT de l'ancien droit (23/03/2025), PAS 365 j pleins : ~299 j (diffJours,
    // convention exclusive), soit 300 j inclusifs — cf. docs/validation.md Réel #1 ("~299 j") et le
    // texte officiel du simulateur France Travail.
    expect(resultat.nouveau.fenetreDateDebut).toBe("2025-03-24");
    expect(diffJours(resultat.nouveau.fenetreDateDebut, FCT_NOUVELLE)).toBe(299);
    expect(resultat.nouveau.sr).toBeCloseTo(9229.35, 2);
    expect(resultat.nouveau.nht).toBe(710);
    expect(resultat.nouveau.sar).toBeNull();
    expect(resultat.nouveau.ajBrute.brut).toBeCloseTo(55.02, 2); // cf. docs/validation.md, cas réel #1
    expect(resultat.nouveau.ajNette.net).toBeCloseTo(53.81, 2);
    expect(resultat.nouveau.joursTravaillesFenetre).toBe(57);
    expect(resultat.nouveau.franchiseCPTotale).toBe(5);
    // Règle #2 : nouvelle date anniversaire = FCT retenue + 12 mois exactement, sans lien avec
    // l'ancienne (23/03/2026) — 17/01/2026 + 365 j = 17/01/2027.
    expect(resultat.nouveau.dateAnniversaire).toBe("2027-01-17");

    // 53,81 € contre 53,31 € : légère hausse, pas de baisse.
    expect(resultat.ecartAJ).toBeCloseTo(0.5, 2);
    expect(resultat.baisse).toBe(false);
    expect(resultat.tropPercuChiffrable).toBe(false);
  });
});

// Cas fictifs B1/B2/B3/E1 construits pour ce chantier et vérifiés un par un contre le simulateur
// officiel France Travail (simucalcul.pole-emploi-services.fr, section "franchises" activée,
// consulté le 31/07/2026) — même démarche que Fictif #2/#3 dans docs/validation.md. Détail complet
// (entrées, sortie simulateur, sortie moteur) dans le rapport de session, pas dupliqué ici.
describe("cas fictifs B1/B2/B3/E1 — vérifiés au simulateur officiel du 31/07/2026", () => {
  const ancien: AncienDroit = {
    dateOuverture: "2025-03-25",
    fctRetenue: "2025-03-23",
    dateAnniversaire: "2026-03-23",
    ajNette: 53.31,
    franchiseCPTotale: 6,
    delaiAttenteInitial: 7,
  };
  const profilBase = profil({ dateNaissance: "1985-06-15", situation: "readmission", dateAnniversairePrecedente: "2025-03-23" });

  it("B1 — baisse nette (55,02→44,70 € brut ; 53,31→43,63 € net)", () => {
    const contrats = [contrat({ dateDebut: "2026-04-15", date: "2026-06-01", typeRemuneration: "heures", nbHeures: 520, salaireBrut: 6000 })];
    const r = calculerRenouvellementAnticipe(contrats, [], profilBase, franceTravailConfig, ancien, "2026-06-01");
    expect(r.nouveau.ajBrute.brut).toBeCloseTo(44.7, 2);
    expect(r.nouveau.ajNette.net).toBeCloseTo(43.63, 2);
    expect(r.nouveau.franchiseCPTotale).toBe(5); // simulateur : "Votre franchise CP : 5 jour(s)"
    expect(r.baisse).toBe(true);
  });

  it("B2 — quasi identique à l'ancien droit, écart < 1 € (53,31→53,35 € net)", () => {
    const contrats = [contrat({ dateDebut: "2026-01-01", date: "2026-06-01", typeRemuneration: "heures", nbHeures: 684, salaireBrut: 9130 })];
    const r = calculerRenouvellementAnticipe(contrats, [], profilBase, franceTravailConfig, ancien, "2026-06-01");
    expect(r.nouveau.ajNette.net).toBeCloseTo(53.35, 2);
    expect(Math.abs(r.ecartAJ)).toBeLessThan(1);
    // Point B2 : une légère HAUSSE ne doit surtout pas se lire comme une baisse à tort.
    expect(r.baisse).toBe(false);
  });

  it("B3a — touche le PLANCHER (44 € brut)", () => {
    const contrats = [contrat({ dateDebut: "2026-05-20", date: "2026-06-01", typeRemuneration: "heures", nbHeures: 510, salaireBrut: 500 })];
    const r = calculerRenouvellementAnticipe(contrats, [], profilBase, franceTravailConfig, ancien, "2026-06-01");
    expect(r.nouveau.ajBrute.brut).toBe(44);
    expect(r.nouveau.ajBrute.plancherApplique).toBe(true);
    expect(r.nouveau.ajNette.net).toBeCloseTo(43.91, 2);
  });

  it("B3b — touche le PLAFOND (config.are.plafond) : le clamp interne fonctionne, MAIS écart ouvert avec le simulateur avant clamp (cf. rapport de session — hors périmètre, pré-existant à areBrute.ts)", () => {
    // SR volontairement irréaliste (400 000 €) pour forcer le dépassement du plafond. Le simulateur
    // officiel donne 155,77 € (AJ initiale, avant clamp) là où areBrute.ts donne 188,72 € — un écart
    // significatif, MAIS jamais rencontré à un SR réaliste (Fictif #3, docs/validation.md, SR 50 000 €,
    // concorde). Pas de valeur simulateur figée ici : seul le comportement du CLAMP de Cadence
        // (garanti quel que soit le SR d'entrée) est vérifié, pas le calcul A+B+C en amont à ce SR.
    const contrats = [contrat({ dateDebut: "2025-08-01", date: "2026-06-01", typeRemuneration: "heures", nbHeures: 700, salaireBrut: 400000 })];
    const r = calculerRenouvellementAnticipe(contrats, [], profilBase, franceTravailConfig, ancien, "2026-06-01");
    expect(r.nouveau.ajBrute.brut).toBe(franceTravailConfig.are.plafond);
    expect(r.nouveau.ajBrute.plafondApplique).toBe(true);
  });

  it("E1 — période assimilée (ALD) hors contrat dans la nouvelle fenêtre : SAR utilisé à la place du SR (55,04→54,21 € net)", () => {
    const contrats = [contrat({ dateDebut: "2026-04-01", date: "2026-06-01", typeRemuneration: "heures", nbHeures: 520, salaireBrut: 6500 })];
    const periodes = [periode({ type: "ald", dateDebut: "2025-09-01", dateFin: "2025-11-30" })]; // 91 j hors contrat
    const r = calculerRenouvellementAnticipe(contrats, periodes, profilBase, franceTravailConfig, ancien, "2026-06-01");
    expect(r.nouveau.sar).not.toBeNull();
    expect(r.nouveau.ajBrute.brut).toBeCloseTo(55.04, 2);
    // Confirme le correctif SJM du 31/07/2026 (App.tsx et consorts) : sans lui, ce test donnerait
    // 54,42 € (SJM calculé sur le SR brut), pas 54,21 € (SJM calculé sur le SAR, comme le simulateur
    // officiel) — écart de 0,21 €, largement au-dessus de la tolérance d'arrondi (0,50 €/j max admis
    // pour un vrai arrondi, cf. docs/validation.md, mais celui-ci n'en était pas un).
    expect(r.nouveau.ajNette.net).toBeCloseTo(54.21, 1);
  });
});

// Cas C1 — franchise CP de l'ancien droit non épuisée à la FCT retenue (demande faite tôt après
// l'ouverture). Le simulateur officiel ne permet PAS de vérifier ce cas numériquement (son
// formulaire ne prend que des totaux plats — jours travaillés, salaire de la période — pas une
// simulation mensuelle depuis une date d'ouverture) : validé ici par la réutilisation directe de
// `calculerSerieDepuisContrats` (indemnisationMensuelle.ts, déjà testé par ailleurs), avec un profil
// sans aucun contrat pendant l'ancien droit — le cas le plus défavorable, chaque mois consomme le
// forfait CP au maximum (2 j/mois, franchiseCPTotale=6 ≤ seuilFranchiseTotaleJours). Le calendrier
// obtenu (épuisée en avril, après 3 mois pleins depuis l'ouverture du 18/01/2026) reproduit presque
// exactement le raisonnement du cas réel donné dans le prompt ("franchise CP ancienne (6j, à 2j/mois)
// était épuisée en ~3 mois") — bonne confirmation croisée, même si ce n'est pas le même calendrier.
describe("tropPercuRisque — cas C1 (franchise CP non épuisée) et son complémentaire", () => {
  const ancienPetiteFranchise: AncienDroit = {
    dateOuverture: "2026-01-18",
    fctRetenue: "2026-01-15",
    dateAnniversaire: "2027-01-18",
    ajNette: 50,
    franchiseCPTotale: 6,
    delaiAttenteInitial: 7,
  };
  const profilBase = profil({ dateNaissance: "1985-06-15", situation: "readmission" });

  it("C1 — demande 6 semaines après l'ouverture : franchise CP pas encore épuisée, tropPercuRisque = true", () => {
    const r = calculerRenouvellementAnticipe([], [], profilBase, franceTravailConfig, ancienPetiteFranchise, "2026-03-01");
    expect(r.tropPercuRisque).toBe(true);
    expect(r.tropPercuChiffrable).toBe(false); // jamais un montant, cf. devoir sacré n°2
  });

  it("complémentaire — demande ~4 mois après l'ouverture : franchise CP épuisée (0 j restant depuis un mois complet), tropPercuRisque = false", () => {
    const r = calculerRenouvellementAnticipe([], [], profilBase, franceTravailConfig, ancienPetiteFranchise, "2026-05-15");
    expect(r.tropPercuRisque).toBe(false);
  });

  // Garde-fou de sourçage (03/08/2026) : la formule officielle du montant EXISTE et est citée dans
  // renouvellementAnticipe.ts (Annexe X art. 31 §2), mais trois verrous la rendent non calculable par
  // Cadence — assiette incomplète (franchise salaires jamais calculée), AJ brute/nette non tranchée,
  // plafond « dans la limite de ce que vous avez perçu » indisponible. Ce test échoue dès que
  // quelqu'un câble un montant : c'est le signal qu'il faut d'abord relire ces trois verrous et
  // docs/validation.md, pas un test à contourner.
  it("aucun montant de trop-perçu n'est exposé, quel que soit le scénario (devoir sacré n°2)", () => {
    const scenarios = ["2026-03-01", "2026-05-15", "2026-08-01"].map((fct) => calculerRenouvellementAnticipe([], [], profilBase, franceTravailConfig, ancienPetiteFranchise, fct));

    for (const r of scenarios) {
      expect(r.tropPercuChiffrable).toBe(false);
      // Aucune clé de la comparaison ne porte de montant de trop-perçu : ni maintenant, ni ajoutée
      // discrètement plus tard sous un autre nom.
      const clesMontant = Object.keys(r).filter((cle) => /^tropPercu/.test(cle) && !["tropPercuRisque", "tropPercuChiffrable"].includes(cle));
      expect(clesMontant).toEqual([]);
    }
  });

  // ⚠️ CARACTÉRISATION D'UNE LIMITE CONNUE, PAS UN COMPORTEMENT SOUHAITÉ. La règle officielle
  // (guide FT juillet 2026, encadré p.15) vise « les franchises congés payés ET salaires totales » ;
  // `ancienneFranchiseCPEpuisee` ne regarde que la CP. Un `tropPercuRisque === false` signifie donc
  // « franchise CP prouvée épuisée », pas « aucun risque ». Ce test fige l'écart pour qu'il reste
  // visible et documenté (cf. CLAUDE.md, décision produit en attente) — le jour où la franchise
  // salaires devient calculable, c'est ce test qu'il faut réécrire, pas contourner.
  it("limite connue : le verdict ignore la franchise salaires — franchiseSalairesRestante vaut 0 par défaut, jamais parce qu'elle est prouvée épuisée", () => {
    const serie = calculerSerieDepuisContrats(
      { ...profilBase, ouvertureDroits: { dateOuverture: ancienPetiteFranchise.dateOuverture, franchiseCPTotale: 6, delaiAttenteInitial: 7 } },
      { dateDepart: ancienPetiteFranchise.dateOuverture },
      [],
      "2026-05-15",
      franceTravailConfig,
    );
    expect(serie.calculable).toBe(true);
    if (!serie.calculable) return;

    const moisCalcules = serie.mois.filter((m) => m.calculable);
    expect(moisCalcules.length).toBeGreaterThan(0);
    for (const m of moisCalcules) {
      if (!m.calculable) continue;
      // 0 « par défaut » et non « épuisée » : le total lui-même est absent (valeur null).
      expect(m.soldeFin.franchiseSalairesRestante).toBe(0);
      const franchiseSalaires = m.franchiseSalaires;
      expect(franchiseSalaires.valeur).toBeNull();
      if (franchiseSalaires.valeur !== null) continue;
      expect(franchiseSalaires.avertissement).toBe("franchise_salaires_non_certifiee");
    }
  });
});

// Règle du délai d'attente (jamais testée jusqu'ici dans le moteur, cf. prompt produit du
// 31/07/2026) : il ne se réapplique pas s'il a déjà couru sur les 12 derniers mois.
describe("delaiSeReapplique", () => {
  it("ne se réapplique pas à moins de 12 mois de l'ouverture de l'ancien droit (cas D1)", () => {
    expect(delaiSeReapplique("2025-06-01", "2026-01-17", franceTravailConfig)).toBe(false); // ~7,5 mois
  });

  it("se réapplique à 12 mois exactement ou plus de l'ouverture de l'ancien droit (cas D2)", () => {
    expect(delaiSeReapplique("2025-01-17", "2026-01-17", franceTravailConfig)).toBe(true); // exactement 365 j
    expect(delaiSeReapplique("2024-06-01", "2026-01-17", franceTravailConfig)).toBe(true); // ~19,5 mois
  });
});
