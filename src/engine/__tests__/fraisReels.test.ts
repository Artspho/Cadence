import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerBaseR, calculerFraisReels, genererTexteDeclaration } from "../fraisReels";
import type { BienAmorti, ConfigFraisReels, Depense, RevenuImposableArtistique } from "../../types/fraisReels";

let compteur = 0;
function depense(partiel: Partial<Depense> & Pick<Depense, "categorie" | "montantTotal">): Depense {
  compteur += 1;
  return {
    id: `d-${compteur}`,
    anneeFiscale: 2026,
    date: "2026-03-01",
    description: `Dépense ${compteur}`,
    remboursementEmployeur: 0,
    partPro: 1,
    montantDeductible: 0, // jamais lu par le moteur (recalculé depuis les champs source), cf. fraisReels.ts
    statutJustificatif: "fourni",
    ...partiel,
  };
}

function revenu(partiel: Partial<RevenuImposableArtistique> = {}): RevenuImposableArtistique {
  return { anneeFiscale: 2026, salaireNetImposable: 0, allocationsAre: 0, congesSpectacles: 0, indemnitesJournalieres: 0, ...partiel };
}

function config(partiel: Partial<ConfigFraisReels> & Pick<ConfigFraisReels, "profilFiscal" | "revenu">): ConfigFraisReels {
  return { anneeFiscale: 2026, modeA: "forfait", modeB: "forfait", ...partiel };
}

describe("calculerBaseR", () => {
  it("somme les 4 revenus, plafonnée à plafondBaseR2025", () => {
    const r = calculerBaseR(revenu({ salaireNetImposable: 10_000 }), "artiste_exclusif", franceTravailConfig);
    expect(r).toBe(10_000);
  });

  it("plafonne R à 145 550 € (2025) au-delà", () => {
    const r = calculerBaseR(revenu({ salaireNetImposable: 200_000 }), "artiste_exclusif", franceTravailConfig);
    expect(r).toBe(145_550);
  });

  it("ne varie pas selon profilFiscal (décision actée le 2026-07-26) — même R pour enseignant_pur", () => {
    const rArtiste = calculerBaseR(revenu({ salaireNetImposable: 10_000 }), "artiste_exclusif", franceTravailConfig);
    const rEnseignant = calculerBaseR(revenu({ salaireNetImposable: 10_000 }), "enseignant_pur", franceTravailConfig);
    expect(rArtiste).toBe(rEnseignant);
  });

  it("pré-remplissage ARE : allocationsAre est bien inclus dans R", () => {
    const r = calculerBaseR(revenu({ salaireNetImposable: 8_000, allocationsAre: 2_000 }), "artiste_exclusif", franceTravailConfig);
    expect(r).toBe(10_000);
  });
});

describe("calculerFraisReels — cas certifiés spec §10", () => {
  it("artiste exclusif, R = 10 000 € : A = 1400, B = 500, forfait 10% = 1000, avantage = +900, recommandation frais_reels", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);

    expect(resultat.baseR).toBe(10_000);
    expect(resultat.montantA).toBe(1_400);
    expect(resultat.montantB).toBe(500);
    expect(resultat.forfait10Pct).toBe(1_000);
    expect(resultat.avantage).toBe(900);
    expect(resultat.recommandation).toBe("frais_reels");
  });

  it("artiste exclusif, R = 200 000 € : R plafonné à 145 550, A = 20 377 € (145550×14%), B = 7 277,50 €", () => {
    // Coquille corrigée le 2026-07-26 (validée avec l'utilisateur) : la spec §10 indiquait A =
    // 14 000 €, incohérent avec B = 7 277,50 € qui confirme pourtant le même plafond (145550×5%
    // = 7277,50 exactement) — 145550×14% = 20 377 €, pas 14 000.
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 200_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);

    expect(resultat.baseR).toBe(145_550);
    expect(resultat.montantA).toBe(20_377);
    expect(resultat.montantB).toBe(7_277.5);
  });

  it("enseignant pur, R = 10 000, 0 dépense C : A=0, B=0, forfait 10% = 1000, frais réels = 0, avantage = -1000, recommandation forfait_10", () => {
    const c = config({ profilFiscal: "enseignant_pur", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);

    expect(resultat.montantA).toBe(0);
    expect(resultat.montantB).toBe(0);
    expect(resultat.totalFraisReels).toBe(0);
    expect(resultat.forfait10Pct).toBe(1_000);
    expect(resultat.avantage).toBe(-1_000);
    expect(resultat.recommandation).toBe("forfait_10");
  });

  it("enseignant pur, R = 10 000, dépenses C = 1500 : avantage = +500, recommandation frais_reels", () => {
    const c = config({ profilFiscal: "enseignant_pur", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const depenses = [depense({ categorie: "C5", montantTotal: 1_500 })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantA).toBe(0);
    expect(resultat.montantB).toBe(0);
    expect(resultat.totalFraisReels).toBe(1_500);
    expect(resultat.avantage).toBe(500);
    expect(resultat.recommandation).toBe("frais_reels");
  });

  it("dépense C6 (local pro) : calcul pro-rata surface correct via partPro générique (30 m² pro / 90 m² total = 33,3 %)", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const surfacePro = 30;
    const surfaceTotale = 90;
    const depenses = [depense({ categorie: "C6", montantTotal: 900, partPro: surfacePro / surfaceTotale })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantC.C6).toBeCloseTo(300, 2); // 900 × (30/90)
  });

  it("dépense C3 sans justificatif suffisant : forfait 52 repas × 5,45 € = 283,40 €", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }), nombreRepasC3: 52 });
    const resultat = calculerFraisReels([], c, franceTravailConfig);

    expect(resultat.montantC.C3).toBeCloseTo(283.4, 2);
  });

  it("nombreRepasC3 renseigné : exclusif, ignore les dépenses C3 individuelles saisies en parallèle", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }), nombreRepasC3: 10 });
    const depenses = [depense({ categorie: "C3", montantTotal: 999 })]; // ne doit pas être compté
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantC.C3).toBeCloseTo(10 * 5.45, 2);
  });

  it("dépense avec remboursement employeur : montantTotal 200 € − remb 60 € × 80% pro = 112 €", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const depenses = [depense({ categorie: "C9", montantTotal: 200, remboursementEmployeur: 60, partPro: 0.8 })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantC.C9).toBeCloseTo(112, 2);
  });

  it("modeA = 'reel' avec dépenses A réelles > forfait 14% : montant réel retenu à la place du forfait", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }), modeA: "reel" });
    // Forfait 14% de 10 000 = 1400 ; dépenses réelles A = 2000 > 1400.
    const depenses = [depense({ categorie: "A", montantTotal: 2_000 })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantA).toBe(2_000);
  });

  it("modeB reste au forfait alors que modeA passe au réel : les deux rubriques restent indépendantes", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }), modeA: "reel" });
    const depenses = [depense({ categorie: "A", montantTotal: 2_000 })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);

    expect(resultat.montantB).toBe(500); // forfait 5% de 10 000, inchangé
  });

  it("le forfait 10% est borné au plancher (495 €) même si R est très faible", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 1_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);
    expect(resultat.forfait10Pct).toBe(495);
  });

  it("le forfait 10% est borné au plafond (14 171 €) même si R est très élevé", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 200_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);
    expect(resultat.forfait10Pct).toBe(14_171); // R plafonné à 145550, 10% = 14555, borné à 14171
  });
});

describe("Depense — statut justificatif et stockage (structure ; comportement complet cf. storage/documentsStorage.ts)", () => {
  it("dépense avec documentId (Supabase Storage, commit 6) : statutJustificatif = 'fourni'", () => {
    const d = depense({ categorie: "C1", montantTotal: 50, statutJustificatif: "fourni", documentId: "doc-abc123" });
    expect(d.statutJustificatif).toBe("fourni");
    expect(d.documentId).toBe("doc-abc123");
  });

  it("driveFileId (reliquat de lecture, module Drive retiré) : conserve ce champ — aucune perte de données (devoir n°1)", () => {
    const d = depense({ categorie: "C1", montantTotal: 50, statutJustificatif: "fourni", driveFileId: "abc123", driveWebViewLink: "https://drive.google.com/abc123" });
    expect(d.statutJustificatif).toBe("fourni");
    expect(d.justificatifData).toBeUndefined();
    expect(d.driveFileId).toBe("abc123");
  });

  it("une dépense référencée par driveFileId conserve ce champ à travers une sérialisation — aucune perte de données (devoir n°1), l'affichage d'un badge « non accessible » est un comportement UI, cf. lib/justificatifAffichage.ts", () => {
    const d = depense({ categorie: "C2", montantTotal: 30, driveFileId: "xyz789", driveWebViewLink: "https://drive.google.com/xyz789" });
    // Simule un objet sérialisé/relu (ex. après rechargement de page) : le champ driveFileId doit
    // survivre intact, rien côté moteur ne le supprime ni ne le vide — le module Drive lui-même a
    // disparu (commit 6), mais la RÉFÉRENCE historique reste lisible.
    const relu: Depense = JSON.parse(JSON.stringify(d));
    expect(relu.driveFileId).toBe("xyz789");
    expect(relu.driveWebViewLink).toBe("https://drive.google.com/xyz789");
  });
});

describe("calculerFraisReels — intégration biensAmortis (Q4, amortissements multi-années)", () => {
  function bien(partiel: Partial<BienAmorti> & Pick<BienAmorti, "prixHT" | "dateAchat" | "dureeAns">): BienAmorti {
    return { id: "bien-1", designation: "Bien test", categorie: "instrument", tauxPro: 1, ...partiel };
  }

  it("sans biensAmortis : comportement identique à avant leur introduction (rétrocompatibilité totale)", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const d = [depense({ categorie: "C7", montantTotal: 80 })];
    const resultat = calculerFraisReels(d, c, franceTravailConfig);
    expect(resultat.montantC.C7).toBe(80);
    expect(resultat.amortissements).toBeUndefined();
  });

  it("avec biensAmortis + anneeImposition : C7 augmenté du montant exact de l'annuité déductible", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const d = [depense({ categorie: "C7", montantTotal: 80 })];
    const b = bien({ prixHT: 900, dateAchat: "2025-01-15", dureeAns: 3 }); // annuité pleine = 300
    const resultat = calculerFraisReels(d, c, franceTravailConfig, [b], 2025);
    expect(resultat.montantC.C7).toBe(380); // 80 (dépenses C7) + 300 (amortissement)
    expect(resultat.amortissements?.totalDeductible).toBe(300);
    expect(resultat.amortissements?.biensEnCours).toEqual([b]);
  });
});

describe("genererTexteDeclaration", () => {
  const CARACTERES_INTERDITS = /[→×✅–—‘’“”]|[\u{1F300}-\u{1FAFF}]|[☀-➿]/u;

  it("ne contient aucun caractère interdit (flèches, ×, coches, emojis, tirets longs, guillemets courbes)", () => {
    const c = config({
      profilFiscal: "artiste_exclusif",
      revenu: revenu({ salaireNetImposable: 10_000 }),
      nombreRepasC3: 12,
    });
    const depenses = [
      depense({ categorie: "C1", montantTotal: 45.5, description: "Trajet SNCF Paris-Lyon" }),
      depense({ categorie: "C5", montantTotal: 120, description: "Abonnement La Lettre du musicien" }),
    ];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);
    const texte = genererTexteDeclaration(resultat, c);

    expect(texte).not.toMatch(CARACTERES_INTERDITS);
  });

  it("contient le total des frais réels", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);
    const texte = genererTexteDeclaration(resultat, c);

    expect(texte).toContain("TOTAL FRAIS REELS");
    expect(texte).toContain(resultat.totalFraisReels.toFixed(2));
  });

  // Le texte part tel quel dans la case libre d'impots.gouv.fr (et en page 3 du PDF) : l'arbitrage
  // interne « frais réels vs abattement 10 % » n'a rien à y faire, il reste cantonné à l'UI.
  it("ne mentionne NI le forfait 10% NI l'avantage : arbitrage interne, hors déclaration", () => {
    const c = config({ profilFiscal: "artiste_exclusif", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const resultat = calculerFraisReels([], c, franceTravailConfig);
    const texte = genererTexteDeclaration(resultat, c);

    expect(texte).not.toMatch(/forfait 10\s*%?/i);
    expect(texte).not.toMatch(/avantage/i);
    expect(texte).not.toContain(resultat.forfait10Pct.toFixed(2));
    expect(texte.trimEnd().endsWith(`TOTAL FRAIS REELS : ${resultat.totalFraisReels.toFixed(2)} €`)).toBe(true);
  });

  it("enseignant pur : aucune ligne A/B dans le texte généré (forfaits désactivés)", () => {
    const c = config({ profilFiscal: "enseignant_pur", revenu: revenu({ salaireNetImposable: 10_000 }) });
    const depenses = [depense({ categorie: "C5", montantTotal: 1_500 })];
    const resultat = calculerFraisReels(depenses, c, franceTravailConfig);
    const texte = genererTexteDeclaration(resultat, c);

    expect(texte).not.toMatch(/^A -/m);
    expect(texte).not.toMatch(/^B -/m);
  });
});
