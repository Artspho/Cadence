// Test de CARACTÉRISATION du tableau « Revenus mensuels » sur données réelles certifiées.
//
// C'est le test réclamé par le point 12 quater de docs/critique_2026-08-03.md. Ce que les tests
// existants ne faisaient pas et qu'il fait :
//  - il part de la NOTIFICATION D'OUVERTURE réelle (date d'ouverture, franchise CP, délai) et des 62
//    contrats réels, jamais d'un solde de mi-parcours saisi à la main — l'ancien test « certifié »
//    alimentait `calculerSerieIndemnisation` avec `{ délai 5, CP 5, report 2 }`, un état qui encodait
//    DÉJÀ le résultat de janvier : il validait donc un calcul démarrant après le bug ;
//  - il déroule toute la chaîne de production jusqu'aux lignes affichées
//    (`calculerSerieDepuisContrats` → `construireLignesAffichage`) ;
//  - il compare aux relevés France Travail de Benoît, seule vérité disponible.
//
// La fixture est le fichier de récupération versionné le 03/08/2026 (point 22) : ce sont les vraies
// données, avec la vraie notification. C'est un instantané figé — il ne doit pas bouger.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importerJSON } from "../../storage/localStorageAdapter";
import { calculerSerieDepuisContrats, calculerSerieIndemnisation } from "../../engine/indemnisationMensuelle";
import { construireLignesAffichage } from "../lignesRevenusMensuels";
import { franceTravailConfig } from "../../config/franceTravailConfig";
import { diffJours } from "../../engine/dateUtils";

const CHEMIN_FIXTURE = fileURLToPath(new URL("../../../docs/cadence-fusion-2026-08-03.json", import.meta.url));
const DATE_DU_JOUR = "2026-08-03";

// Relevés France Travail réels de Benoît. Jours indemnisés par mois.
const JOURS_CERTIFIES: Record<string, number> = { "2026-02": 0, "2026-03": 17, "2026-04": 18, "2026-05": 29 };

function serieReelle() {
  const donnees = importerJSON(fs.readFileSync(CHEMIN_FIXTURE, "utf8"));
  const profil = donnees.profil;
  if (!profil?.ouvertureDroits) throw new Error("fixture invalide : ouvertureDroits attendu");
  const resultat = calculerSerieDepuisContrats(profil, { dateDepart: profil.ouvertureDroits.dateOuverture }, donnees.contrats, DATE_DU_JOUR, franceTravailConfig);
  if (!resultat.calculable) throw new Error("fixture invalide : série non calculable");
  return { profil, ouverture: profil.ouvertureDroits, contrats: donnees.contrats, mois: resultat.mois, lignes: construireLignesAffichage(resultat.mois) };
}

describe("tableau mensuel — chemin de production complet sur les données réelles certifiées", () => {
  it("la fixture porte bien la notification réelle (garde-fou : si elle dérive, les attentes ci-dessous ne veulent plus rien dire)", () => {
    const { ouverture, contrats } = serieReelle();
    expect(ouverture.dateOuverture).toBe("2026-01-18");
    expect(ouverture.franchiseCPTotale).toBe(5);
    expect(ouverture.delaiAttenteInitial).toBe(7);
    expect(contrats).toHaveLength(62);
  });

  it("reproduit les 4 mois certifiés par France Travail, sans aucun écart", () => {
    const { lignes } = serieReelle();
    const parMois = new Map(lignes.map((l) => [l.moisLabel, l]));
    for (const [mois, joursAttendus] of Object.entries(JOURS_CERTIFIES)) {
      expect(parMois.get(mois)?.joursIndemnisables, `mois ${mois}`).toBe(joursAttendus);
    }
  });

  // Le bug du point 21, verrouillé par sa conséquence en euros. Avant correction, le tableau
  // affichait 6 jours en janvier et 7 en février (309,94 € + 364,99 € = 674,93 € nets annoncés) là où
  // le relevé de février dit 0. Reproductible sans aucun contrat, à partir du profil seul.
  it("janvier et février 2026 ne portent AUCUN jour indemnisé — les 674,93 € du point 21 ne peuvent pas revenir", () => {
    const { lignes } = serieReelle();
    const parMois = new Map(lignes.map((l) => [l.moisLabel, l]));
    expect(parMois.get("2026-01")?.joursIndemnisables).toBe(0);
    expect(parMois.get("2026-01")?.montant).toBe(0);
    expect(parMois.get("2026-02")?.joursIndemnisables).toBe(0);
    expect(parMois.get("2026-02")?.montant).toBe(0);
  });

  it("le mois d'ouverture est calculé sur sa fenêtre du 18 au 31 janvier, pas sur le mois civil", () => {
    const { lignes } = serieReelle();
    const janvier = lignes.find((l) => l.moisLabel === "2026-01");
    expect(janvier?.joursDeLaFenetre).toBe(14); // 18 → 31 inclus, jamais 31
    // Heures des contrats DANS la fenêtre uniquement : 93 h, pas les 129 h du mois civil entier —
    // compter le mois entier déduisait du travail effectué sous le droit précédent.
    expect(janvier?.heuresDuMois).toBe(93);
    expect(janvier?.joursNonIndemnisables).toBe(12); // floor(93 × 1,3 / 10) = 12, pas 16
    expect(janvier?.messageOuverturePartielle).toContain("Mois de réadmission");
  });

  // Le seul cas réel qui distingue les deux ordres de consommation possibles, et donc ce qui a
  // tranché le point 3. Sources officielles concordantes : Annexe X art. 23 §1er (« différé
  // d'indemnisation, délai d'attente, franchise de congés payés, franchise ») et guide France Travail
  // p.12 et p.17 étape 6. L'ordre inverse (franchise CP d'abord), appliqué par l'ex-`franchises.ts`,
  // donnait janvier { délai 0, CP 2 } et février { délai 7, CP 2 } — contredit par les deux relevés.
  it("la répartition délai / franchise CP est celle des relevés, mois par mois", () => {
    const { lignes } = serieReelle();
    const parMois = new Map(lignes.map((l) => [l.moisLabel, l]));
    // Relevé de janvier : « 2 jours de délai » consommés, et rien de franchise.
    expect(parMois.get("2026-01")?.delaiConsomme).toBe(2);
    expect(parMois.get("2026-01")?.franchiseCPConsommee).toBe(0);
    // Relevé du 14/04/2026 : « franchise CP 4 / différé 5 / travail 19 » — les trois chiffres.
    expect(parMois.get("2026-02")?.delaiConsomme).toBe(5);
    expect(parMois.get("2026-02")?.franchiseCPConsommee).toBe(4);
    expect(parMois.get("2026-02")?.joursNonIndemnisables).toBe(19);
    // Mars solde le dernier jour de franchise.
    expect(parMois.get("2026-03")?.franchiseCPConsommee).toBe(1);
  });

  // CONTRÔLE NÉGATIF. Ce fichier a été écrit APRÈS le correctif : il passe donc au vert d'emblée, ce
  // qui ne prouve rien en soi. Le rouge, lui, a été établi par mesure sur le code d'avant (03/08/2026,
  // sur ces mêmes 62 contrats) : 6 jours en janvier et 7 en février, soit 674,93 € nets annoncés.
  // Ce test rejoue la seule erreur d'entrée qui produisait ce résultat — donner au mois d'ouverture
  // les 31 jours et les 129 h du mois CIVIL au lieu des 14 jours et 93 h de sa fenêtre — et épingle
  // le chiffre faux. S'il tombe au vert, c'est que le bug n'est plus reproductible ; s'il devient
  // rouge, c'est que quelqu'un a changé le décompte des jours non indemnisables et qu'il faut
  // reconfronter les 4 mois certifiés avant tout.
  it("contrôle négatif — avec le mois civil entier en entrée, le moteur produit bien les 6 jours faux de janvier", () => {
    const { ouverture } = serieReelle();
    const [janvier] = calculerSerieIndemnisation(
      { delaiRestant: ouverture.delaiAttenteInitial, franchiseCPRestante: ouverture.franchiseCPTotale, quotaCPCarryOver: 0, franchiseSalairesRestante: 0, quotaSalairesCarryOver: 0 },
      [{ moisLabel: "2026-01", joursDuMois: 31, heuresDuMois: 129 }], // le mois civil entier : l'erreur d'avant
      franceTravailConfig,
      ouverture.franchiseCPTotale,
    );
    expect(janvier.joursNonIndemnisables).toBe(16); // au lieu de 12
    expect(janvier.joursIndemnises).toBe(6); // au lieu de 0 — la signature du bug
    // 6 × 53,81 € × (1 − 3,10 %) = 312,84 € nets rien que pour janvier, sur un mois où le nouveau
    // droit n'ouvrait aucun jour indemnisable.
    expect(Math.round(6 * 53.81 * (1 - 0.031) * 100) / 100).toBeGreaterThan(300);
  });

  // Invariant n°1 demandé par Benoît : on ne peut pas avoir été indemnisé plus de jours qu'il ne s'est
  // écoulé de jours depuis l'ouverture des droits.
  it("invariant — le cumul des jours indemnisés ne dépasse jamais les jours calendaires écoulés", () => {
    const { ouverture, lignes } = serieReelle();
    let cumul = 0;
    for (const ligne of lignes) {
      cumul += ligne.joursIndemnisables;
      // Fin du mois de la ligne : borne calendaire la plus favorable au test (elle laisse passer le
      // plus de jours possible) — si l'invariant tient là, il tient partout.
      const finDuMois = `${ligne.moisLabel}-${String(new Date(Date.UTC(Number(ligne.moisLabel.slice(0, 4)), Number(ligne.moisLabel.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
      const joursEcoules = diffJours(ouverture.dateOuverture, finDuMois) + 1;
      expect(cumul, `cumul à fin ${ligne.moisLabel}`).toBeLessThanOrEqual(joursEcoules);
    }
  });

  // Invariant n°2 demandé par Benoît : franchise et délai sont consommés exactement une fois. Ni
  // deux fois (le bug d'origine les remettait à zéro en sautant le mois d'ouverture), ni au-delà du
  // total accordé par la notification.
  it("invariant — franchise CP et délai d'attente sont consommés exactement une fois, jamais plus que la notification", () => {
    const { ouverture, lignes, mois } = serieReelle();
    const delaiTotalConsomme = lignes.reduce((s, l) => s + l.delaiConsomme, 0);
    const cpTotalConsomme = lignes.reduce((s, l) => s + l.franchiseCPConsommee, 0);
    expect(delaiTotalConsomme).toBe(ouverture.delaiAttenteInitial);
    expect(cpTotalConsomme).toBe(ouverture.franchiseCPTotale);
    // Et les soldes du dernier mois sont bien à zéro, sans jamais être passés en négatif.
    const dernier = mois[mois.length - 1];
    expect(dernier.soldeFin.delaiRestant).toBe(0);
    expect(dernier.soldeFin.franchiseCPRestante).toBe(0);
    for (const m of mois) {
      expect(m.soldeFin.delaiRestant).toBeGreaterThanOrEqual(0);
      expect(m.soldeFin.franchiseCPRestante).toBeGreaterThanOrEqual(0);
      expect(m.soldeFin.quotaCPCarryOver).toBeGreaterThanOrEqual(0);
    }
  });

  // Décision de Benoît du 03/08/2026 : l'estimation est livrée tant que le document réel n'est pas
  // importé. Avant ce chantier, le badge disparaissait dès les franchises épuisées — les mois d'août
  // 2026 à janvier 2027 (~9 000 € bâtis sur des contrats pas encore travaillés) s'affichaient sans
  // aucune réserve.
  it("tous les mois sont marqués « estimation », y compris ceux dont franchise et délai sont soldés", () => {
    const { lignes } = serieReelle();
    expect(lignes.length).toBeGreaterThan(6);
    expect(lignes.every((l) => l.estimation)).toBe(true);
    // Verrou explicite sur les mois qui perdaient le badge avant le correctif.
    for (const mois of ["2026-08", "2026-12", "2027-01"]) {
      expect(lignes.find((l) => l.moisLabel === mois)?.estimation, `mois ${mois}`).toBe(true);
    }
  });
});
