import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerFranchiseSalaires, calculerMoisIndemnisation, calculerSerieDepuisContrats, calculerSerieIndemnisation } from "../indemnisationMensuelle";
import type { FranchiseSalairesResultat, MoisIndemnisationEntree, SoldeIndemnisation } from "../../types";
import { contrat, profil } from "./testUtils";

describe("calculerMoisIndemnisation", () => {
  it("jours non indemnisables = floor(heures × 1,3 / 10), avant tout calcul de place disponible", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 31, heuresDuMois: 93 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursNonIndemnisables).toBe(12); // floor(93 × 1.3 / 10) = floor(12.09) = 12 (cas réel avril 2026)
  });

  it("consomme le délai d'attente puis la franchise CP, dans cet ordre, sur le seul reliquat restant", () => {
    // Quota volontairement large (non contraignant) : ce test isole l'ordre délai → CP, pas le
    // plafond mensuel lui-même (cf. tests dédiés plus bas).
    const solde: SoldeIndemnisation = { delaiRestant: 3, franchiseCPRestante: 10, quotaCPCarryOver: 100, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // 30 jours dispo, 0 non indemnisable, délai consomme 3, franchise CP consomme 10, reste 17 payés.
    expect(resultat.joursNonIndemnisables).toBe(0);
    expect(resultat.delaiConsomme).toBe(3);
    expect(resultat.franchiseCPConsommee).toBe(10);
    expect(resultat.joursIndemnises).toBe(17);
    expect(resultat.soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 92, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 }); // 100 + 2 (forfait) - 10 consommé
  });

  it("le forfait mensuel plafonne la franchise CP même avec beaucoup de place et un solde important (corrigé le 2026-07-23)", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 20, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    // Sans le forfait (ancien modèle, corrigé) : min(20, 30) = 20. Avec : plafonné au quota (0 report + 2 forfait).
    expect(resultat.franchiseCPConsommee).toBe(2);
  });

  it("le quota carry-over du mois précédent s'ajoute au forfait du mois suivant", () => {
    // Mois 1 : aucune place disponible pour la franchise CP (tout absorbé par le non-indemnisable,
    // 300 h -> floor(300*1.3/10)=39 >= 28 jours du mois).
    const mois1 = calculerMoisIndemnisation(
      { delaiRestant: 0, franchiseCPRestante: 10, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 },
      { moisLabel: "m1", joursDuMois: 28, heuresDuMois: 300 },
      franceTravailConfig,
    );
    expect(mois1.franchiseCPConsommee).toBe(0);
    expect(mois1.soldeFin.quotaCPCarryOver).toBe(2); // forfait 2j intégralement reporté, rien à consommer ce mois

    // Mois 2 : beaucoup de place disponible — sans le report, seul le forfait (2j) serait consommé.
    // Avec le report du mois 1, le quota disponible est 2 (carry) + 2 (forfait) = 4.
    const mois2 = calculerMoisIndemnisation(mois1.soldeFin, { moisLabel: "m2", joursDuMois: 30, heuresDuMois: 0 }, franceTravailConfig);
    expect(mois2.franchiseCPConsommee).toBe(4);
  });

  it("franchise salaires : toujours non certifiée par défaut, jamais une formule devinée sans total fourni", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 30, heuresDuMois: 0 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.franchiseSalaires).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("jamais de jours indemnisés négatifs même avec des heures disproportionnées au mois", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 28, heuresDuMois: 300 };
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultat.joursIndemnises).toBe(0);
    expect(resultat.delaiConsomme).toBe(0);
    expect(resultat.franchiseCPConsommee).toBe(0);
  });

  it("le palier du forfait mensuel se décide sur la franchise TOTALE fournie, pas sur le restant courant (corrige une limite connue, cf. docs/reprise.md)", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 20, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 }; // restant <= 24
    const entree: MoisIndemnisationEntree = { moisLabel: "test", joursDuMois: 31, heuresDuMois: 0 };
    // Sans 4e argument (défaut = franchiseCPRestante, comportement historique) : restant 20 <= 24 -> forfait bas (2j).
    const resultatDefaut = calculerMoisIndemnisation(solde, entree, franceTravailConfig);
    expect(resultatDefaut.franchiseCPConsommee).toBe(2);
    // Avec la franchise TOTALE réelle (30, > 24) : forfait haut (3j), même si le restant courant est déjà sous le seuil.
    const resultatAvecTotal = calculerMoisIndemnisation(solde, entree, franceTravailConfig, 30);
    expect(resultatAvecTotal.franchiseCPConsommee).toBe(3);
  });
});

describe("calculerMoisIndemnisation / calculerSerieIndemnisation — répartition mensuelle de la franchise salaires", () => {
  const franchiseSalairesTotale = (valeur: number): FranchiseSalairesResultat => ({ valeur, totalNonVerifie: true, sousEstimeeHorsA10: false });

  it("franchise salaires totale = 10j, dureeDroitsMois = 12, repartitionMoisMax = 8 (config) -> quota mensuel = ceil(10/8) = 2j/mois", () => {
    const solde: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 10, quotaSalairesCarryOver: 0 };
    const entree: MoisIndemnisationEntree = { moisLabel: "m1", joursDuMois: 30, heuresDuMois: 0 }; // plein de jours disponibles, pour isoler le quota
    const resultat = calculerMoisIndemnisation(solde, entree, franceTravailConfig, 0, franchiseSalairesTotale(10), 12);
    expect(resultat.joursIndemnises).toBe(28); // 30 - 2 (quota consommé)
    expect(resultat.soldeFin.franchiseSalairesRestante).toBe(8); // 10 - 2
    expect(resultat.soldeFin.quotaSalairesCarryOver).toBe(0); // quota intégralement consommé, rien à reporter
  });

  it("un mois sans jour disponible (tout absorbé par le non-indemnisable) : le quota de 2j n'est pas consommé, reporté au mois suivant", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 10, quotaSalairesCarryOver: 0 };
    // Mois 1 : 300h sur 28 jours -> floor(300×1,3/10)=39 non indemnisables >= 28 jours du mois, aucun reliquat.
    const mois1 = calculerMoisIndemnisation(soldeDepart, { moisLabel: "m1", joursDuMois: 28, heuresDuMois: 300 }, franceTravailConfig, 0, franchiseSalairesTotale(10), 12);
    expect(mois1.soldeFin.franchiseSalairesRestante).toBe(10); // rien consommé, aucun jour disponible ce mois-ci
    expect(mois1.soldeFin.quotaSalairesCarryOver).toBe(2); // le quota du mois 1 est intégralement reporté

    // Mois 2 : beaucoup de place -> quota disponible = 2 (report) + 2 (quota du mois) = 4.
    const mois2 = calculerMoisIndemnisation(mois1.soldeFin, { moisLabel: "m2", joursDuMois: 30, heuresDuMois: 0 }, franceTravailConfig, 0, franchiseSalairesTotale(10), 12);
    expect(mois2.joursIndemnises).toBe(26); // 30 - 4 (2 reporté + 2 du mois)
    expect(mois2.soldeFin.franchiseSalairesRestante).toBe(6); // 10 - 4
  });

  it("franchise salaires épuisée : plus aucune déduction les mois suivants", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 0, franchiseSalairesRestante: 3, quotaSalairesCarryOver: 0 };
    const moisEntrees: MoisIndemnisationEntree[] = [
      { moisLabel: "m1", joursDuMois: 30, heuresDuMois: 0 },
      { moisLabel: "m2", joursDuMois: 30, heuresDuMois: 0 },
      { moisLabel: "m3", joursDuMois: 30, heuresDuMois: 0 },
      { moisLabel: "m4", joursDuMois: 30, heuresDuMois: 0 },
    ];
    // quota mensuel = ceil(3/8) = 1j/mois : consomme 1j par mois jusqu'à épuisement au mois 3
    // (total 3j), puis plus aucune déduction — jamais un restant négatif.
    const resultats = calculerSerieIndemnisation(soldeDepart, moisEntrees, franceTravailConfig, 0, franchiseSalairesTotale(3), 12);
    expect(resultats.map((r) => r.joursIndemnises)).toEqual([29, 29, 29, 30]);
    expect(resultats[2].soldeFin.franchiseSalairesRestante).toBe(0); // épuisée après le mois 3
    expect(resultats[3].soldeFin.franchiseSalairesRestante).toBe(0); // reste à 0, jamais négative
  });
});

describe("calculerSerieIndemnisation — cas certifiés sur relevés France Travail réels (fév-mai 2026, cf. docs/reprise.md)", () => {
  it("reproduit exactement les 4 mois certifiés à partir du solde d'ouverture du 01/02/2026 (quotaCPCarryOver = 2, janvier absorbé par le délai d'attente)", () => {
    const soldeDepart: SoldeIndemnisation = { delaiRestant: 5, franchiseCPRestante: 5, quotaCPCarryOver: 2, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 };
    // Heures réelles (déclarations mensuelles France Travail, cachet = 12h) : fév 153h (21h+11
    // cachets), mars 105h (21h+7 cachets), avril 93h (21h+6 cachets), mai 21h (0 cachet).
    const mois: MoisIndemnisationEntree[] = [
      { moisLabel: "2026-02", joursDuMois: 28, heuresDuMois: 153 },
      { moisLabel: "2026-03", joursDuMois: 31, heuresDuMois: 105 },
      { moisLabel: "2026-04", joursDuMois: 30, heuresDuMois: 93 },
      { moisLabel: "2026-05", joursDuMois: 31, heuresDuMois: 21 },
    ];
    const resultats = calculerSerieIndemnisation(soldeDepart, mois, franceTravailConfig);

    expect(resultats.map((r) => r.joursIndemnises)).toEqual([0, 17, 18, 29]);
    expect(resultats.map((r) => r.joursNonIndemnisables)).toEqual([19, 13, 12, 2]);
    expect(resultats[0].delaiConsomme).toBe(5);
    expect(resultats[0].franchiseCPConsommee).toBe(4); // quota 2 (report janvier) + 2 (forfait février) = 4
    expect(resultats[1].franchiseCPConsommee).toBe(1); // le reste, franchise épuisée ensuite
    expect(resultats[2].franchiseCPConsommee).toBe(0);
    expect(resultats[3].franchiseCPConsommee).toBe(0);
    expect(resultats[3].soldeFin).toEqual({ delaiRestant: 0, franchiseCPRestante: 0, quotaCPCarryOver: 5, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 });
  });
});

describe("calculerSerieDepuisContrats", () => {
  // Scénario synthétique, pas une reproduction du cas réel certifié : depuis le refactor du
  // 2026-07-25 (ouvertureDroits remplace un solde de mi-parcours saisi à la main), revalider les 4
  // mois certifiés demanderait les vrais contrats depuis la vraie date d'ouverture (mars 2025),
  // qu'on n'a pas. Décision actée avec l'utilisateur : garder calculerSerieIndemnisation (cas
  // certifiés, ci-dessus) inchangé, et valider ici seulement le MÉCANISME de simulation depuis
  // ouvertureDroits sur des données inventées.
  const ouvertureDroits = { dateOuverture: "2026-02-01", franchiseCPTotale: 0, delaiAttenteInitial: 0 };

  it("calculable: false quand Profil.ouvertureDroits est absent — pas de chiffre inventé", () => {
    const p = profil({});
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    expect(resultat).toEqual({ calculable: false, raison: "ouverture_droits_manquante" });
  });

  it("un mois sans aucun contrat obtient 0 h (pas d'absence silencieuse)", () => {
    const p = profil({ ouvertureDroits });
    const contratFevrier = contrat({ dateDebut: "2026-02-10", date: "2026-02-10", typeRemuneration: "heures", nbHeures: 10, salaireBrut: 0 });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [contratFevrier], "2026-04-30", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    expect(resultat.mois.map((m) => m.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04"]);
    const mars = resultat.mois[1];
    if (!mars.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(mars.heuresDuMois).toBe(0); // mars : aucun contrat -> 0 h, pas absent du tableau
  });

  it("salairesContratsBruts : somme les salaireBrut de tous les contrats du mois (enseignement + spectacle)", () => {
    const p = profil({ ouvertureDroits });
    const contratEnseignement = contrat({
      dateDebut: "2026-02-01",
      date: "2026-02-01",
      type: "enseignement",
      typeRemuneration: "heures",
      nbHeures: 21,
      salaireBrut: 1000,
      etablissementAgree: true,
      enRapportAvecMetier: true,
    });
    const contratSpectacle = contrat({ dateDebut: "2026-02-10", date: "2026-02-10", typeRemuneration: "cachet", nbCachets: 1, salaireBrut: 500 });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [contratEnseignement, contratSpectacle], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(premier.salairesContratsBruts).toBe(1500);
  });

  it("salairesContratsBruts = 0 pour un mois sans aucun contrat", () => {
    const p = profil({ ouvertureDroits });
    const contratFevrier = contrat({ dateDebut: "2026-02-10", date: "2026-02-10", typeRemuneration: "heures", nbHeures: 10, salaireBrut: 200 });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [contratFevrier], "2026-03-31", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const mars = resultat.mois[1];
    if (!mars.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(mars.salairesContratsBruts).toBe(0);
  });

  it("dateDepart borne seulement l'affichage : les mois simulés avant restent cachés, pas absents du calcul", () => {
    const p = profil({ ouvertureDroits });
    const contratJanvier = contrat({ dateDebut: "2026-02-05", date: "2026-02-05", typeRemuneration: "heures", nbHeures: 10, salaireBrut: 0 });
    // dateDepart posterieur au mois d'ouverture : février doit être simulé (pour un état correct)
    // mais jamais retourné.
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-03-01" }, [contratJanvier], "2026-03-31", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    expect(resultat.mois.map((m) => m.moisLabel)).toEqual(["2026-03"]);
  });

  it("s'arrête au mois du dernier contrat, ou à aujourd'hui si plus tardif", () => {
    const p = profil({ ouvertureDroits });
    const contratFevrier = contrat({ dateDebut: "2026-02-10", date: "2026-02-10", typeRemuneration: "heures", nbHeures: 10, salaireBrut: 0 });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [contratFevrier], "2026-04-15", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    expect(resultat.mois.map((m) => m.moisLabel)).toEqual(["2026-02", "2026-03", "2026-04"]); // dateDuJour (avril) > dernier contrat (février)
  });

  it("montantMensuel non calculable (aj_manquante) quand Profil.ajReelleHistorique est vide", () => {
    const p = profil({ ouvertureDroits });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(premier.montantMensuel).toEqual({ calculable: false, raison: "aj_manquante" });
  });

  it("montantMensuel lit Profil.ajReelleHistorique (déplacé depuis SoldeIndemnisationDepart le 2026-07-25)", () => {
    // délai et franchise à 0 : tout le mois (28 j) est indemnisé, pour isoler le calcul du montant.
    const p = profil({ ouvertureDroits, ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }] });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(premier.joursIndemnises).toBe(28);
    expect(premier.montantMensuel).toEqual({ calculable: true, montant: 28 * 50, ajUtilisee: 50 });
  });

  it("montantNet = montantBrut × (1 - taux/100), arrondi, quand tauxPrelevementSource est renseigné", () => {
    const p = profil({
      ouvertureDroits: { ...ouvertureDroits, tauxPrelevementSource: 7.2 },
      ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }],
    });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    const montantMensuel = premier.montantMensuel;
    if (!montantMensuel.calculable) throw new Error("devrait être calculable");
    expect(montantMensuel.montant).toBe(1400); // 28 j × 50 €
    expect(montantMensuel.montantNet).toBe(Math.round(1400 * (1 - 7.2 / 100) * 100) / 100); // 1299.2
  });

  it("montantNet reste absent quand tauxPrelevementSource n'est pas renseigné", () => {
    const p = profil({ ouvertureDroits, ajReelleHistorique: [{ dateEffet: "2026-01-01", valeur: 50 }] });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    const montantMensuel = premier.montantMensuel;
    if (!montantMensuel.calculable) throw new Error("devrait être calculable");
    expect(montantMensuel.montantNet).toBeUndefined();
  });

  it("régression : les contrats artiste comptent bien, mélangés avec un enseignement récurrent sur le même mois (bug signalé, non reproduit)", () => {
    const p = profil({ ouvertureDroits });
    const enseignementRecurrent = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((mois) =>
      contrat({
        dateDebut: `${mois}-01`,
        date: `${mois}-28`,
        employeur: "Commune de Levallois Perret",
        type: "enseignement",
        typeRemuneration: "heures",
        nbHeures: 21,
        salaireBrut: 465,
        etablissementAgree: true,
        enRapportAvecMetier: true,
      }),
    );
    const artisteJuin = [
      contrat({ dateDebut: "2026-06-05", date: "2026-06-05", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "heures", nbHeures: 48, salaireBrut: 800 }),
      contrat({ dateDebut: "2026-06-12", date: "2026-06-12", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "heures", nbHeures: 26, salaireBrut: 400 }),
      contrat({ dateDebut: "2026-06-20", date: "2026-06-20", employeur: "Les Arts Phocéens", type: "artiste", typeRemuneration: "cachet", nbCachets: 6, salaireBrut: 700 }), // 72h
    ];
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [...enseignementRecurrent, ...artisteJuin], "2026-06-30", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    const juin = resultat.mois.find((m) => m.moisLabel === "2026-06");
    if (!juin?.calculable) throw new Error("devrait être calculable (pas un mois de réadmission)");
    expect(juin.heuresDuMois).toBe(167); // 21 (Levallois) + 48 + 26 + 72 (Arts Phocéens) — pas 21
    expect(juin.joursNonIndemnisables).toBe(21); // floor(167 × 1,3 / 10) = floor(21,71) = 21
  });

  it("dateOuverture le 18/01/2026 : premier élément de la série est le mois de réadmission non calculé", () => {
    const p = profil({ ouvertureDroits: { dateOuverture: "2026-01-18", franchiseCPTotale: 0, delaiAttenteInitial: 0 } });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-01-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    expect(resultat.mois.map((m) => m.moisLabel)).toEqual(["2026-01", "2026-02"]); // janvier (réadmission) puis février calculé normalement
    const premier = resultat.mois[0];
    if (premier.calculable) throw new Error("janvier devrait être un mois de réadmission non calculable");
    expect(premier.type).toBe("readmission");
  });

  it("dateOuverture le 01/02/2026 : aucun mois de transition, la série commence normalement en février", () => {
    const p = profil({ ouvertureDroits: { dateOuverture: "2026-02-01", franchiseCPTotale: 0, delaiAttenteInitial: 0 } });
    const resultat = calculerSerieDepuisContrats(p, { dateDepart: "2026-02-01" }, [], "2026-02-28", franceTravailConfig);
    if (!resultat.calculable) throw new Error("devrait être calculable");
    expect(resultat.mois.map((m) => m.moisLabel)).toEqual(["2026-02"]);
    const premier = resultat.mois[0];
    if (!premier.calculable) throw new Error("février devrait être calculable, pas un mois de réadmission");
  });
});

describe("calculerFranchiseSalaires — formule certifiée le 2026-07-23 (ARTCENA + flyer officiel)", () => {
  it("calcule un total positif, arrondi, à partir de la formule", () => {
    const smicMensuel = 1867.02; // valeur au 01/06/2026
    const smicJournalier = 86.17;
    const srTotal = smicMensuel * 30; // SR / smicMensuel = 30, exactement
    const sjm = 3 * smicJournalier * 2; // SJM / (3 × smicJournalier) = 2, exactement
    const p = profil({ dateAnniversaire: "2026-12-31" }); // après le 01/06/2026
    const resultat = calculerFranchiseSalaires(srTotal, sjm, p, franceTravailConfig);
    // 30 × 2 − 27 = 33
    expect(resultat).toEqual({ valeur: 33, totalNonVerifie: true, sousEstimeeHorsA10: true });
  });

  it("franchise nulle (jamais négative) quand le résultat brut est ≤ 0", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const resultat = calculerFranchiseSalaires(0, 0, p, franceTravailConfig);
    expect(resultat.valeur).toBe(0);
  });

  it("lit le SMIC à la date de fin de PRA, pas la valeur courante", () => {
    const smicMensuel = 1823.03; // valeur au 01/01/2026, PAS la valeur courante (1867,02 au 01/06/2026)
    const smicJournalier = 84.14;
    const srTotal = smicMensuel * 30;
    const sjm = 3 * smicJournalier * 2;
    const p = profil({ dateAnniversaire: "2026-03-15" }); // avant la revalorisation du 01/06/2026
    const resultat = calculerFranchiseSalaires(srTotal, sjm, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: 33, totalNonVerifie: true, sousEstimeeHorsA10: true });
  });

  it("sousEstimeeHorsA10 = false quand salairesHorsAnnexe10PRA est renseigné", () => {
    const p = profil({ dateAnniversaire: "2026-12-31", salairesHorsAnnexe10PRA: 5000 });
    const resultat = calculerFranchiseSalaires(10000, 100, p, franceTravailConfig);
    if (resultat.valeur === null) throw new Error("valeur ne devrait pas être null ici");
    expect(resultat.sousEstimeeHorsA10).toBe(false);
  });

  it("valeur null quand la date de fin de PRA est inconnue — jamais une formule devinée", () => {
    const p = profil({ dateAnniversaire: "" });
    const resultat = calculerFranchiseSalaires(100000, 100, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });

  it("valeur null quand la date de fin de PRA est antérieure à toute revalorisation SMIC connue", () => {
    const p = profil({ dateAnniversaire: "2020-01-01" });
    const resultat = calculerFranchiseSalaires(100000, 100, p, franceTravailConfig);
    expect(resultat).toEqual({ valeur: null, avertissement: "franchise_salaires_non_certifiee" });
  });
});
