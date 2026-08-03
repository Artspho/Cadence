import { describe, expect, it } from "vitest";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { calculerStatutPrediction } from "../prediction";
import { contrat, profil } from "./testUtils";

describe("calculerStatutPrediction", () => {
  it("statut sécurité quand le seuil est déjà atteint", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 50 })]; // 600 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(resultat.niveau).toBe("securite");
    expect(resultat.heuresRestantes).toBe(0);
  });

  it("statut bloqué quand l'échéance est dépassée sans les heures requises", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 5 })]; // 60 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2027-01-15");
    expect(resultat.niveau).toBe("bloque");
  });

  it("un profil neuf sans date anniversaire connue (0 heure) n'affiche jamais le statut bloqué", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.heuresActuelles).toBe(0);
    expect(resultat.niveau).not.toBe("bloque");
    expect(resultat.niveau).toBe("a_rattraper");
    expect(resultat.message).not.toMatch(/échéance/i);
  });

  it("profil sans date anniversaire connue (mois restants à zéro) : rythmeRequis signale anniversaire_inconnu, jamais Infinity", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.rythmeRequis).toEqual({ atteignable: false, raison: "anniversaire_inconnu" });
    expect(JSON.stringify(resultat)).not.toMatch(/Infinity/);
  });

  it("anniversaire connu et déjà dépassé sans les heures requises : rythmeRequis signale delai_expire, jamais Infinity", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 5 })]; // 60 h, largement sous le seuil
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2027-01-15"); // après l'anniversaire
    expect(resultat.niveau).toBe("bloque");
    expect(resultat.rythmeRequis).toEqual({ atteignable: false, raison: "delai_expire" });
    expect(JSON.stringify(resultat)).not.toMatch(/Infinity/);
  });

  it("anniversaireConnu vaut false quand la date anniversaire est inconnue (fenêtre fictive 'aujourd'hui', pas une vraie échéance)", () => {
    const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
    const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");
    expect(resultat.anniversaireConnu).toBe(false);
  });

  it("réadmission avec historique de contrats trop court : retombe sur le seuil standard 507 h, jamais le plafond de sécurité gonflé (bug réel signalé par un testeur)", () => {
    // Scénario exact rapporté : réadmission, anniversaire 17/01/2027, un seul contrat ancien
    // (27/01/2026, 480 h) — rien avant. Mis à jour le 31/07/2026 (chantier calculerFenetreEnCours) :
    // sans dateAnniversairePrecedente saisie, la borne de réadmission du cycle EN COURS se déduit
    // désormais TOUJOURS de dateAnniversaire (17/01/2026 = 17/01/2027 - 12 mois, Règle #2, toujours
    // vraie) — l'extension bute donc immédiatement dessus (hors_bornes, tranchesTentees: 0) au lieu
    // d'épuiser 24 tentatives à l'aveugle (historique_insuffisant, l'ancien comportement quand la
    // borne n'était lue que si l'utilisateur l'avait saisie). Dans les deux cas, jamais le plafond de
    // sécurité gonflé (1515 h) : seuilHeures retombe sur 507 dès que calculable === false.
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission" });
    const contrats = [contrat({ date: "2026-01-27", nbCachets: 40 })]; // 480 h
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-23");

    expect(resultat.heuresActuelles).toBe(480);
    expect(resultat.seuilHeures).toBe(507); // jamais 1515
    expect(resultat.seuilReadmission).toEqual({ calculable: false, raison: "hors_bornes", tranchesTentees: 0, dateAnniversairePrecedente: "2026-01-17" });
  });

  it("cycle en cours après une réadmission récente : le compteur ne recompte jamais les heures de l'ancien droit (bug réel signalé le 31/07/2026 — Dashboard affichait 710 h, le NH exact de l'ancien droit, au lieu de la progression réelle)", () => {
    // Reproduit la forme du cas réel : réadmission dont le droit en cours a été ouvert par une FCT
    // récente (17/01/2026). `dateAnniversaire` porte la PROCHAINE échéance (17/01/2027, cf.
    // types/index.ts) — jamais la FCT elle-même. `dateAnniversairePrecedente` porte ici la VRAIE
    // borne HISTORIQUE (23/03/2025 — la FCT qui a ouvert le droit d'AVANT le droit en cours, cf.
    // engine/cycles.ts) et non la FCT du droit en cours (17/01/2026) : la borne de réadmission du
    // cycle en cours ne doit PAS dépendre de cette valeur (calculerFenetreEnCours la dérive toujours
    // de dateAnniversaire, cf. periodeReference.ts) — sans quoi elle laisserait justement l'extension
    // remonter jusqu'à l'ancien droit d'avant, exactement le bug que cette dérivation corrige.
    const p = profil({ dateAnniversaire: "2027-01-17", situation: "readmission", dateAnniversairePrecedente: "2025-03-23" });
    const contrats = [
      // Ancien droit (avant la FCT retenue) : gros volume, jamais recomptable pour CE cycle — s'il
      // fuitait dans le calcul, le total dépasserait très largement 507 h dès le premier contrat.
      contrat({ date: "2025-06-01", nbCachets: 60 }), // 720 h, hors du cycle en cours
      // Cycle en cours (après la FCT retenue) : seule cette progression doit compter.
      contrat({ date: "2026-03-01", nbCachets: 10 }), // 120 h
      contrat({ date: "2026-06-15", nbCachets: 6 }), // 72 h
    ];
    const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-31");

    // 120 + 72 = 192 h : uniquement le cycle en cours, jamais 192 + 720 (fuite de l'ancien droit) ni
    // 720 seul (fenêtre rétrospective affichée par erreur à la place de la progression).
    expect(resultat.heuresActuelles).toBe(192);
    expect(resultat.dateAnniversaire).toBe("2027-01-17"); // la vraie échéance, pas la FCT
    // Sous le seuil malgré l'ancien droit costaud : la tentative d'extension par tranches est bien
    // arrêtée à la FCT DÉRIVÉE du droit en cours (17/01/2026, PAS 23/03/2025 lu depuis
    // dateAnniversairePrecedente) — jamais autorisée à aller piocher les 720 h de l'ancien cycle.
    expect(resultat.seuilReadmission).toEqual({ calculable: false, raison: "hors_bornes", tranchesTentees: 0, dateAnniversairePrecedente: "2026-01-17" });
    expect(resultat.niveau).not.toBe("securite");
  });

  it("ne mute jamais les tableaux de contrats/périodes fournis (utilisable en simulation sans effet de bord)", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 20 })];
    const copie = [...contrats];
    calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
    expect(contrats).toEqual(copie);
    expect(contrats).toHaveLength(1);
  });

  it("un contrat hypothétique ajouté pour la simulation change le résultat sans toucher le tableau d'origine", () => {
    const p = profil({ dateAnniversaire: "2026-12-31" });
    const contrats = [contrat({ date: "2026-02-01", nbCachets: 10 })];
    const avant = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");

    const contratsSimules = [...contrats, contrat({ date: "2026-06-01", nbCachets: 40 })];
    const apres = calculerStatutPrediction(p, contratsSimules, [], franceTravailConfig, "2026-06-01");

    expect(apres.heuresActuelles).toBeGreaterThan(avant.heuresActuelles);
    expect(contrats).toHaveLength(1); // le tableau d'origine n'a pas été modifié
  });

  describe("heuresCertainesAVenir (contrats à venir persistés, SPEC §11.B)", () => {
    it("contrat déjà signé daté après aujourd'hui, dans la fenêtre : exclu de heuresActuelles, compté dans heuresCertainesAVenir", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [
        contrat({ date: "2026-02-01", nbCachets: 10 }), // 120 h, passé
        contrat({ date: "2026-09-01", nbCachets: 10 }), // 120 h, à venir (dateDuJour = 2026-06-01)
      ];
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(resultat.heuresActuelles).toBe(120);
      expect(resultat.heuresCertainesAVenir).toBe(120);
    });

    it("contrat futur daté après l'anniversaire (hors fenêtre) : n'est compté nulle part", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [
        contrat({ date: "2026-02-01", nbCachets: 10 }), // 120 h, passé
        contrat({ date: "2027-03-01", nbCachets: 10 }), // après l'anniversaire, hors fenêtre
      ];
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(resultat.heuresActuelles).toBe(120);
      expect(resultat.heuresCertainesAVenir).toBe(0);
    });

    it("heures acquises + heures certaines à venir atteignent le seuil : niveau sécurité même avec un rythme passé nul (correction du faux pessimisme)", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-09-01", nbCachets: 45 })]; // 540 h, tout à venir, rien acquis avant
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(resultat.heuresActuelles).toBe(0);
      expect(resultat.heuresCertainesAVenir).toBe(540);
      expect(resultat.niveau).toBe("securite");
    });

    it("anniversaire inconnu : heuresCertainesAVenir reste 0 même avec un contrat daté dans le futur (fenêtre fictive 'aujourd'hui' exclut tout ce qui est après)", () => {
      const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
      const contrats = [contrat({ date: "2026-09-01", nbCachets: 10 })]; // après dateDuJour (2026-06-01)
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(resultat.heuresCertainesAVenir).toBe(0);
    });

    it("aucun contrat à venir : heuresCertainesAVenir vaut 0 (non-régression explicite)", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 10 })];
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-06-01");
      expect(resultat.heuresCertainesAVenir).toBe(0);
    });

    it("un contrat à venir daté exactement sur l'anniversaire ne fait jamais basculer rythmeRequis en 'delai_expire' (bug trouvé en testant dans le navigateur : le dénominateur temps doit rester le vrai calendrier restant, pas la fin du segment certain)", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-12-31", nbCachets: 2 })]; // 24 h, dernier (et seul) contrat certain = pile la date anniversaire
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-23");
      expect(resultat.heuresCertainesAVenir).toBe(24);
      expect(resultat.joursRestants).toBeGreaterThan(0); // l'échéance réelle est encore loin (161 j)
      expect(resultat.rythmeRequis.atteignable).toBe(true); // jamais "delai_expire" ici : l'échéance n'est pas dépassée
    });

    it("les heures certaines à venir réduisent l'écart à couvrir par la projection : la date de franchissement projetée ne peut jamais être plus tardive qu'en les ignorant", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contratsSansCertain = [contrat({ date: "2026-02-01", nbCachets: 10 })]; // 120 h acquises, rien à venir
      const contratsAvecCertain = [...contratsSansCertain, contrat({ date: "2026-08-01", nbCachets: 10 })]; // + 120 h certaines à venir

      const sansCertain = calculerStatutPrediction(p, contratsSansCertain, [], franceTravailConfig, "2026-06-01");
      const avecCertain = calculerStatutPrediction(p, contratsAvecCertain, [], franceTravailConfig, "2026-06-01");

      expect(avecCertain.heuresCertainesAVenir).toBe(120);
      expect(sansCertain.rythmeMensuelActuel).toBe(avecCertain.rythmeMensuelActuel); // même rythme passé (heuresActuelles identique)
      expect(sansCertain.dateFranchissementProjetee).not.toBeNull();
      expect(avecCertain.dateFranchissementProjetee).not.toBeNull();
      expect(avecCertain.dateFranchissementProjetee! <= sansCertain.dateFranchissementProjetee!).toBe(true);
    });
  });

  // ── Point 5 de docs/critique_2026-08-03.md : le vert ne s'affiche plus sur une projection ──
  describe("le badge vert « Sécurité » n'est jamais accordé à une simple projection (point 5)", () => {
    it("projection au rythme passé suffisante mais aucune heure acquise : niveau « en_bonne_voie », jamais « securite »", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      // 300 h acquises au 1er juillet, soit ~50 h/mois : à ce rythme les 507 h tombent début novembre,
      // avant l'échéance. AVANT la correction, cet écran affichait « Sécurité » en vert — alors qu'il
      // manque 207 h et qu'il suffit de ne plus rien signer pour ne jamais les faire.
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 25 })]; // 300 h
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-01");

      expect(resultat.heuresActuelles).toBe(300);
      expect(resultat.heuresCertainesAVenir).toBe(0); // rien de signé à venir : c'est bien une pure projection
      expect(resultat.dateFranchissementProjetee).not.toBeNull();
      expect(resultat.dateFranchissementProjetee! <= "2026-12-31").toBe(true); // la projection franchit bien le seuil à temps
      expect(resultat.niveau).toBe("en_bonne_voie");
      expect(resultat.niveau).not.toBe("securite"); // le cœur du point 5
    });

    it("le message d'un « en_bonne_voie » ne promet rien : il dit explicitement que rien n'est acquis et chiffre ce qui manque", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 25 })]; // 300 h
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-01");

      expect(resultat.niveau).toBe("en_bonne_voie");
      expect(resultat.message).toMatch(/rien n'est encore acquis/i);
      expect(resultat.message).toMatch(/207 h/); // l'écart réel, pas seulement une date rassurante
      // Conditionnel obligatoire : « tu atteindrais », jamais « tu atteins ».
      expect(resultat.message).not.toMatch(/tu atteins/i);
    });

    it("contrôle négatif — les 507 h réellement travaillées gardent le vert, et le message ne parle pas de rythme", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 45 })]; // 540 h acquises
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-01");

      expect(resultat.niveau).toBe("securite");
      expect(resultat.message).toMatch(/tu as atteint/i);
      expect(resultat.message).not.toMatch(/rythme/i);
    });

    it("contrôle négatif — des contrats déjà SIGNÉS qui suffisent gardent le vert (un fait, pas une projection), et le message le dit", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-09-01", nbCachets: 45 })]; // 540 h, tout à venir mais déjà signé
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-07-01");

      expect(resultat.heuresActuelles).toBe(0);
      expect(resultat.niveau).toBe("securite");
      expect(resultat.message).toMatch(/contrats déjà signés/i); // ne laisse pas croire que les heures sont faites
    });
  });

  // ── Point 6 de docs/critique_2026-08-03.md : plus de « Bloqué » sur une situation rattrapable ──
  describe("le badge rouge « Bloqué » exige que l'objectif soit vraiment hors de portée (point 6)", () => {
    it("il ne manque qu'un seul cachet à 25 jours de l'échéance : jamais « bloque »", () => {
      // Le scénario nommé dans la critique. AVANT la correction : « Bloqué » en rouge, parce que
      // joursRestants <= 30 suffisait — sans jamais regarder qu'il ne manquait qu'un cachet.
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 41 })]; // 492 h : il manque 15 h, soit un cachet
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-12-06");

      expect(resultat.joursRestants).toBe(25);
      expect(resultat.heuresRestantesApresCertain).toBe(15);
      expect(resultat.niveau).not.toBe("bloque"); // le cœur du point 6
      expect(resultat.message).not.toMatch(/hors de portée/i);
    });

    it("échéance à 25 jours, rythme insuffisant, mais l'écart reste atteignable : « a_rattraper » et non « bloque »", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      // 408 h acquises (~36 h/mois) : la projection n'atteint plus le seuil à temps, mais les 99 h
      // manquantes restent très en dessous des 280 h que le plafond de l'Annexe 10 autorise en 25 j.
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 34 })]; // 408 h
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-12-06");

      expect(resultat.heuresRestantesApresCertain).toBe(99);
      expect(resultat.niveau).toBe("a_rattraper");
      expect(resultat.echeanceImminente).toBe(true); // l'urgence reste signalée, elle ne colore juste plus en rouge
      expect(resultat.message).toMatch(/encore atteignable/i);
    });

    it("contrôle négatif — écart réellement hors de portée du plafond Annexe 10 : « bloque », avec le motif affiché", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      // 96 h acquises : il manque 411 h en 25 j, quand le plafond légal (28 cachets × 12 h = 336 h/mois)
      // n'en permet que 280. Là, « Bloqué » est mérité — la correction ne doit pas l'avoir supprimé.
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 8 })]; // 96 h
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2026-12-06");

      expect(resultat.heuresRestantesApresCertain).toBe(411);
      expect(resultat.niveau).toBe("bloque");
      expect(resultat.message).toMatch(/hors de portée/i);
      expect(resultat.message).toMatch(/336 h\/mois/); // le seuil du jugement est affiché, donc contestable
    });

    it("contrôle négatif — échéance réellement dépassée sans les heures : toujours « bloque », quel que soit l'écart", () => {
      const p = profil({ dateAnniversaire: "2026-12-31" });
      const contrats = [contrat({ date: "2026-02-01", nbCachets: 42 })]; // 504 h : il ne manque que 3 h…
      const resultat = calculerStatutPrediction(p, contrats, [], franceTravailConfig, "2027-01-15"); // …mais l'échéance est passée

      expect(resultat.joursRestants).toBe(0);
      expect(resultat.niveau).toBe("bloque"); // le temps, lui, ne se rattrape pas
      expect(resultat.echeanceImminente).toBe(false); // pas "imminente" : dépassée
    });

    it("anniversaire inconnu : le plafond d'atteignabilité ne peut jamais produire un « bloque » (fenêtre fictive, joursRestants = 0)", () => {
      // Garde-fou : sans date anniversaire, joursRestants vaut 0 par artifice de calcul, donc le
      // plafond atteignable vaut 0 h — sans la garde `anniversaireConnu`, tout profil neuf afficherait
      // « Bloqué » dès l'installation de l'app.
      const p = profil({ dateAnniversaire: "", situation: "premiere_admission" });
      const resultat = calculerStatutPrediction(p, [], [], franceTravailConfig, "2026-06-01");

      expect(resultat.joursRestants).toBe(0);
      expect(resultat.anniversaireConnu).toBe(false);
      expect(resultat.niveau).not.toBe("bloque");
      expect(resultat.echeanceImminente).toBe(false);
    });
  });
});
