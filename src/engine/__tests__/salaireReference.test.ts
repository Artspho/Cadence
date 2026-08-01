import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerSalaireReference } from "../salaireReference";
import { contrat, periode, profil } from "./testUtils";

const FENETRE = { dateDebut: "2026-01-01", dateFin: "2026-12-31" };

describe("calculerSalaireReference", () => {
  it("exclut totalement l'enseignement et la formation du SR et du NHT", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contratsBase = [contrat({ date: "2026-06-01", type: "artiste", typeRemuneration: "cachet", nbCachets: 40, salaireBrut: 8000 })];
    const contratsAvecEnseignement = [
      ...contratsBase,
      contrat({ date: "2026-07-01", type: "enseignement", typeRemuneration: "heures", nbHeures: 60, salaireBrut: 3000, etablissementAgree: true, enRapportAvecMetier: true }),
    ];

    const resultatBase = calculerSalaireReference(contratsBase, [], p, franceTravailConfig, FENETRE);
    const resultatAvecEnseignement = calculerSalaireReference(contratsAvecEnseignement, [], p, franceTravailConfig, FENETRE);

    expect(resultatAvecEnseignement.sr).toBe(resultatBase.sr);
    expect(resultatAvecEnseignement.nht).toBe(resultatBase.nht);
  });

  // Bug réel du 01/08/2026 (cf. engine/decompteHeures.test.ts) : le NHT réutilise
  // calculerDecompteHeures — un contrat mixte heures+cachets sous-comptait donc aussi le NHT, pas
  // seulement le compteur 507 h. Le NHT alimente directement le montant de l'ARE (areBrute.ts,
  // partie B) : ce sous-comptage aurait produit un montant faux, pas seulement un compteur faux.
  it("le NHT compte heures ET cachets d'un même contrat mixte, jamais un seul", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-28", type: "artiste", typeRemuneration: "heures", nbHeures: 14, nbCachets: 3, salaireBrut: 245 })];
    const resultat = calculerSalaireReference(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.nht).toBe(50); // 14 h + 3 × 12 h, jamais seulement 14 ou seulement 36
  });

  it("applique le SAR aménagé quand des périodes maternité/adoption/ALD sont retenues", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    // Contrat en SEPTEMBRE, volontairement HORS de la maternité. Il tombait auparavant le 01/06, donc
    // en pleine maternité déclarée : une donnée contradictoire (travailler pendant son congé) qui
    // passait inaperçue tant que le chevauchement n'était pas vérifié. Le déplacer garde à ce test son
    // objet — le SAR sur 100 jours — au lieu d'y figer l'incohérence en attendant 99.
    const contrats = [contrat({ date: "2026-09-01", nbCachets: 40, salaireBrut: 8000 })];
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })]; // 100 jours

    const resultat = calculerSalaireReference(contrats, periodes, p, franceTravailConfig, FENETRE);
    expect(resultat.joursPeriodeAssimileesRetenues).toBe(100);
    expect(resultat.sar).not.toBeNull();
    expect(resultat.sar).toBeGreaterThan(resultat.sr); // le SAR "regonfle" le SR sur une période réduite
  });

  it("un jour travaillé sous contrat n'est jamais compté comme jour de période assimilée (dénominateur du SAR)", () => {
    // Ici le montant est en jeu, pas seulement un compteur : les jours de période sont SOUSTRAITS du
    // dénominateur, donc compter un jour travaillé gonfle le SAR et l'allocation. Deux contrats d'un
    // jour posés dans la maternité -> 2 jours retirés, et un SAR strictement plus BAS que sans eux.
    const p = profil({ dateNaissance: "1990-01-01" });
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })]; // 100 jours
    const horsPeriode = [contrat({ date: "2026-09-01", nbCachets: 40, salaireBrut: 8000 })];
    const dansPeriode = [...horsPeriode, contrat({ date: "2026-04-10", nbCachets: 1, salaireBrut: 0 }), contrat({ date: "2026-04-11", nbCachets: 1, salaireBrut: 0 })];

    const sansChevauchement = calculerSalaireReference(horsPeriode, periodes, p, franceTravailConfig, FENETRE);
    const avecChevauchement = calculerSalaireReference(dansPeriode, periodes, p, franceTravailConfig, FENETRE);

    expect(sansChevauchement.joursPeriodeAssimileesRetenues).toBe(100);
    expect(avecChevauchement.joursPeriodeAssimileesRetenues).toBe(98);
    // Salaire brut identique (les deux contrats ajoutés valent 0 €) : seul le dénominateur change.
    expect(avecChevauchement.sr).toBe(sansChevauchement.sr);
    expect(avecChevauchement.sar).toBeLessThan(sansChevauchement.sar as number);
  });

  it("un contrat d'enseignement compte comme jour travaillé, même si son salaire est exclu du SR", () => {
    // La question posée par l'exclusion n'est pas « ce contrat alimente-t-il le SR ? » mais « ce jour
    // a-t-il été travaillé ? ». Un jour de cours est un jour sous contrat.
    const p = profil({ dateNaissance: "1990-01-01" });
    const periodes = [periode({ type: "maternite", dateDebut: "2026-03-01", dateFin: "2026-06-08" })];
    const contrats = [
      contrat({ date: "2026-09-01", nbCachets: 40, salaireBrut: 8000 }),
      contrat({ date: "2026-04-10", type: "enseignement", typeRemuneration: "heures", nbHeures: 4, salaireBrut: 200, etablissementAgree: true, enRapportAvecMetier: true }),
    ];

    const resultat = calculerSalaireReference(contrats, periodes, p, franceTravailConfig, FENETRE);
    expect(resultat.joursPeriodeAssimileesRetenues).toBe(99);
  });

  it("ne calcule pas de SAR sans période assimilée éligible", () => {
    const p = profil({ dateNaissance: "1990-01-01" });
    const contrats = [contrat({ date: "2026-06-01", nbCachets: 40, salaireBrut: 8000 })];
    const resultat = calculerSalaireReference(contrats, [], p, franceTravailConfig, FENETRE);
    expect(resultat.sar).toBeNull();
  });
});
