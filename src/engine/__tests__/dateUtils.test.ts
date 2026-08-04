// Point 15 de la critique du 03/08/2026 : `engine/dateUtils.ts` était le seul fichier de
// `src/engine/` sans tests dédiés, alors que ses treize fonctions portent TOUTE l'arithmétique de
// calendrier du moteur — fenêtres de 12 mois (periodeReference), décompte des jours non
// indemnisables (decompteHeures), prorata mensuel d'un contrat (decoupageMensuel), boucle des mois
// indemnisés (indemnisationMensuelle), âge au jour du plafond enseignement, rapprochement des
// contrats importés (lib/correspondanceContrat).
//
// Ces fonctions étaient couvertes seulement de biais, par les tests des modules qui les appellent :
// un décalage d'un jour s'y voyait comme un montant faux, sans dire lequel des deux calculs mentait.
// Ces tests fixent le comportement à la fonction, sans rien changer au code (comportement CONSTANT).
//
// Deux propriétés méritent une mention, car elles ne sont pas évidentes en lisant le code :
//   1. Passages à l'heure d'été/d'hiver : `joursChevauchement` compte des jours en divisant un écart
//      de millisecondes par 86 400 000. Les 28/03 → 30/03 et 24/10 → 26/10 contiennent une journée
//      de 23 h et une de 25 h en Europe/Paris (le fuseau de la machine de développement) ; le
//      `Math.round` de la fonction absorbe la dérive. Les assertions ci-dessous restent vraies dans
//      n'importe quel fuseau — en UTC elles ne traversent simplement aucun changement d'heure.
//   2. Années bissextiles : 2024 et 2028 sont bissextiles, 2026 ne l'est pas.
import { describe, expect, it } from "vitest";
import {
  ageAuJour,
  ajouterJours,
  bornesDuMois,
  clamp,
  dansIntervalle,
  diffJours,
  joursChevauchement,
  joursDansMois,
  moisCle,
  moisEntre,
  moisSuivant,
  toDate,
  toISO,
} from "../dateUtils";

describe("toDate / toISO — aller-retour sans dérive de fuseau", () => {
  it("toISO(toDate(x)) redonne exactement x", () => {
    // Le piège classique : parser une date en UTC puis la formater en heure locale décale d'un jour
    // à l'ouest de Greenwich (et d'un jour dans l'autre sens à l'est). Toutes les dates de Cadence
    // transitent par ce couple de fonctions : un décalage ici fausserait TOUT.
    for (const iso of ["2026-01-01", "2026-02-28", "2024-02-29", "2026-06-15", "2026-12-31", "1985-06-15"]) {
      expect(toISO(toDate(iso))).toBe(iso);
    }
  });

  it("toDate produit minuit en heure locale (c'est ce qui rend le format sûr)", () => {
    const d = toDate("2026-06-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // juin, indexé à 0
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("date invalide : toISO lève plutôt que d'inventer une date", () => {
    // Devoir n°2 : mieux vaut une exception visible qu'un jour faux affiché à l'écran.
    expect(() => toISO(toDate("pas-une-date"))).toThrow();
  });
});

describe("ajouterJours", () => {
  it("avance et recule d'un jour, y compris par-dessus un mois et une année", () => {
    expect(ajouterJours("2026-06-15", 1)).toBe("2026-06-16");
    expect(ajouterJours("2026-06-15", -1)).toBe("2026-06-14");
    expect(ajouterJours("2026-06-30", 1)).toBe("2026-07-01");
    expect(ajouterJours("2026-07-01", -1)).toBe("2026-06-30");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("0 jour : identité", () => {
    expect(ajouterJours("2026-06-15", 0)).toBe("2026-06-15");
  });

  it("29 février : présent en 2024, absent en 2026", () => {
    expect(ajouterJours("2024-02-28", 1)).toBe("2024-02-29");
    expect(ajouterJours("2024-02-29", 1)).toBe("2024-03-01");
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("changement d'heure : aucun jour perdu ni ajouté", () => {
    expect(ajouterJours("2026-03-28", 2)).toBe("2026-03-30"); // heure d'été
    expect(ajouterJours("2026-10-24", 2)).toBe("2026-10-26"); // heure d'hiver
  });

  it("fenêtre de référence : dateFin − 364 jours (periodeReference.ts)", () => {
    // `periodeReferenceJours` vaut 365 et la fenêtre est bornes incluses : le début est donc à
    // −(365 − 1) jours de la fin. Ancré ici parce que tout le décompte des 507 h en dépend.
    expect(ajouterJours("2026-06-01", -364)).toBe("2025-06-02");
    expect(diffJours("2025-06-02", "2026-06-01")).toBe(364);
    expect(joursChevauchement("2025-06-02", "2026-06-01", "2025-06-02", "2026-06-01")).toBe(365);
  });
});

describe("diffJours", () => {
  it("compte b − a, signé", () => {
    expect(diffJours("2026-06-01", "2026-06-15")).toBe(14);
    expect(diffJours("2026-06-15", "2026-06-01")).toBe(-14);
    expect(diffJours("2026-06-15", "2026-06-15")).toBe(0);
  });

  it("changement d'heure : compte des jours civils, pas des tranches de 24 h", () => {
    expect(diffJours("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffJours("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("une année entière : 365 jours (366 si elle contient un 29 février)", () => {
    expect(diffJours("2025-08-01", "2026-08-01")).toBe(365);
    expect(diffJours("2024-01-01", "2025-01-01")).toBe(366);
  });
});

describe("ageAuJour", () => {
  it("le seuil de 50 ans bascule le jour de l'anniversaire, pas la veille", () => {
    // decompteHeures.ts:189 : `age >= 50` choisit le plafond enseignement (120 h au lieu de 90 h).
    // Un jour d'écart change donc les heures retenues, donc le droit.
    expect(ageAuJour("1976-06-15", "2026-06-14")).toBe(49);
    expect(ageAuJour("1976-06-15", "2026-06-15")).toBe(50);
    expect(ageAuJour("1976-06-15", "2026-06-16")).toBe(50);
  });

  it("né un 29 février : 22 ans le 1er mars 2026, pas le 28 février", () => {
    expect(ageAuJour("2004-02-29", "2026-02-28")).toBe(21);
    expect(ageAuJour("2004-02-29", "2026-03-01")).toBe(22);
  });

  it("date de référence antérieure à la naissance : âge négatif, sans exception", () => {
    // Comportement documenté, pas souhaité : le garde-fou est en amont (lib/coherenceProfil.ts).
    // Consigné ici pour qu'une future exception ne passe pas pour un détail.
    expect(ageAuJour("1985-06-15", "1980-06-15")).toBe(-5);
  });
});

describe("moisCle", () => {
  it("donne la clé YYYY-MM du mois civil, aux deux bornes du mois", () => {
    expect(moisCle("2026-07-01")).toBe("2026-07");
    expect(moisCle("2026-07-31")).toBe("2026-07");
    expect(moisCle("2026-08-01")).toBe("2026-08");
    expect(moisCle("2026-01-31")).toBe("2026-01");
  });

  it("ignore une éventuelle heure dans la chaîne (fin de mois à 23 h 30 reste dans son mois)", () => {
    expect(moisCle("2026-07-31T23:30:00")).toBe("2026-07");
  });

  it("l'ordre alphabétique des clés est l'ordre chronologique", () => {
    // indemnisationMensuelle.ts:325 fait avancer un curseur avec `curseur <= moisFin` sur ces
    // chaînes : la boucle des mois indemnisés serait fausse si cette propriété tombait.
    const cles = ["2025-12", "2026-01", "2026-02", "2026-09", "2026-10"];
    expect([...cles].sort()).toEqual(cles);
  });
});

describe("joursDansMois", () => {
  it("28, 29, 30 et 31 jours selon le mois", () => {
    expect(joursDansMois("2026-02")).toBe(28);
    expect(joursDansMois("2024-02")).toBe(29);
    expect(joursDansMois("2026-04")).toBe(30);
    expect(joursDansMois("2026-01")).toBe(31);
    expect(joursDansMois("2026-12")).toBe(31);
  });

  it("cohérent avec bornesDuMois sur toute l'année 2026 et sur février 2024", () => {
    // indemnisationMensuelle.ts se sert des deux : `joursDansMois` pour les jours du mois et
    // `bornesDuMois` pour les dates. Ils ne doivent jamais se contredire.
    for (const mois of ["2024-02", "2026-01", "2026-02", "2026-04", "2026-12"]) {
      const { debut, fin } = bornesDuMois(mois);
      expect(diffJours(debut, fin) + 1).toBe(joursDansMois(mois));
    }
  });
});

describe("clamp", () => {
  it("laisse passer une valeur dans les bornes, y compris aux bornes", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("ramène en dessous du minimum et au-dessus du maximum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("bornes inversées (min > max) : le maximum gagne", () => {
    // Conséquence de l'écriture `Math.min(Math.max(v, min), max)`. Aucun appelant ne fait ça
    // aujourd'hui ; noté pour qu'un futur appel inversé ne surprenne pas.
    expect(clamp(5, 10, 0)).toBe(0);
  });
});

describe("dansIntervalle", () => {
  it("bornes incluses, et un jour de trop en sort", () => {
    expect(dansIntervalle("2026-06-01", "2026-06-01", "2026-06-30")).toBe(true);
    expect(dansIntervalle("2026-06-30", "2026-06-01", "2026-06-30")).toBe(true);
    expect(dansIntervalle("2026-06-15", "2026-06-01", "2026-06-30")).toBe(true);
    expect(dansIntervalle("2026-05-31", "2026-06-01", "2026-06-30")).toBe(false);
    expect(dansIntervalle("2026-07-01", "2026-06-01", "2026-06-30")).toBe(false);
  });

  it("contrat d'un seul jour : ce jour est dedans, ses voisins non", () => {
    // Cas du cachet unique, majoritaire dans les données réelles.
    expect(dansIntervalle("2026-06-15", "2026-06-15", "2026-06-15")).toBe(true);
    expect(dansIntervalle("2026-06-14", "2026-06-15", "2026-06-15")).toBe(false);
    expect(dansIntervalle("2026-06-16", "2026-06-15", "2026-06-15")).toBe(false);
  });

  it("intervalle inversé (fin avant début) : jamais vrai", () => {
    expect(dansIntervalle("2026-06-15", "2026-06-30", "2026-06-01")).toBe(false);
  });
});

describe("joursChevauchement", () => {
  it("intervalles identiques : tous les jours, bornes incluses", () => {
    expect(joursChevauchement("2026-06-01", "2026-06-30", "2026-06-01", "2026-06-30")).toBe(30);
    expect(joursChevauchement("2026-06-15", "2026-06-15", "2026-06-15", "2026-06-15")).toBe(1);
  });

  it("intervalle contenu dans l'autre : la durée du plus petit, quel que soit l'ordre des arguments", () => {
    expect(joursChevauchement("2026-06-10", "2026-06-20", "2026-06-01", "2026-06-30")).toBe(11);
    expect(joursChevauchement("2026-06-01", "2026-06-30", "2026-06-10", "2026-06-20")).toBe(11);
  });

  it("chevauchement partiel : seuls les jours communs", () => {
    expect(joursChevauchement("2026-05-25", "2026-06-05", "2026-06-01", "2026-06-30")).toBe(5); // 1er au 5 juin
    expect(joursChevauchement("2026-06-28", "2026-07-10", "2026-06-01", "2026-06-30")).toBe(3); // 28, 29, 30 juin
  });

  it("un seul jour commun : 1, et 0 dès qu'ils ne se touchent plus", () => {
    expect(joursChevauchement("2026-05-01", "2026-06-01", "2026-06-01", "2026-06-30")).toBe(1);
    expect(joursChevauchement("2026-05-01", "2026-05-31", "2026-06-01", "2026-06-30")).toBe(0);
  });

  it("aucun chevauchement : 0 dans les deux sens", () => {
    expect(joursChevauchement("2026-01-01", "2026-01-31", "2026-06-01", "2026-06-30")).toBe(0);
    expect(joursChevauchement("2026-06-01", "2026-06-30", "2026-01-01", "2026-01-31")).toBe(0);
  });

  it("intervalle inversé en entrée : 0, jamais un nombre de jours négatif", () => {
    expect(joursChevauchement("2026-06-10", "2026-06-01", "2026-01-01", "2026-12-31")).toBe(0);
  });

  it("années entières : 365 jours en 2026, 366 en 2024", () => {
    expect(joursChevauchement("2026-01-01", "2026-12-31", "2026-01-01", "2026-12-31")).toBe(365);
    expect(joursChevauchement("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31")).toBe(366);
  });

  it("changement d'heure : une journée de 23 h et une de 25 h comptent toujours pour un jour", () => {
    // C'est LE cas que l'arrondi de la fonction protège. Sans le `Math.round`, la division par
    // 86 400 000 renverrait 2,958… (mars) et 3,041… (octobre) — donc des heures assimilées ou un
    // prorata de contrat faux d'un jour, deux fois par an.
    expect(joursChevauchement("2026-03-28", "2026-03-30", "2026-03-28", "2026-03-30")).toBe(3);
    expect(joursChevauchement("2026-10-24", "2026-10-26", "2026-10-24", "2026-10-26")).toBe(3);
    // Et sur une fenêtre qui traverse les deux bascules : mars 2026 → novembre 2026.
    expect(joursChevauchement("2026-03-01", "2026-11-01", "2026-03-01", "2026-11-01")).toBe(246);
  });
});

describe("moisEntre", () => {
  it("dates dans un même mois : une seule clé", () => {
    expect(moisEntre("2026-03-05", "2026-03-20")).toEqual(["2026-03"]);
    expect(moisEntre("2026-03-05", "2026-03-05")).toEqual(["2026-03"]);
  });

  it("un jour à cheval sur deux mois : deux clés", () => {
    expect(moisEntre("2026-01-31", "2026-02-01")).toEqual(["2026-01", "2026-02"]);
  });

  it("contrat à cheval sur une fin d'année : clés dans l'ordre chronologique", () => {
    expect(moisEntre("2025-11-15", "2026-02-10")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("année fiscale complète : exactement 12 clés (FraisReelsGraphiques.tsx)", () => {
    const mois = moisEntre("2026-01-01", "2026-12-31");
    expect(mois).toHaveLength(12);
    expect(mois[0]).toBe("2026-01");
    expect(mois[11]).toBe("2026-12");
  });

  it("fenêtre de 12 mois glissants : 13 mois civils touchés, pas 12", () => {
    // Une fenêtre du 15/08/2025 au 14/08/2026 empiète sur treize mois civils. C'est normal — mais
    // c'est le genre de « 13 au lieu de 12 » qui se lit comme un bug si personne ne l'a écrit.
    expect(moisEntre("2025-08-15", "2026-08-14")).toHaveLength(13);
  });

  it("dates inversées : liste DÉCROISSANTE, pas une liste vide", () => {
    // Comportement de date-fns (eachMonthOfInterval accepte les intervalles inversés). Aucun garde-
    // fou dans dateUtils : les appelants (decoupageMensuel.ts:64) reçoivent des contrats dont la
    // saisie interdit déjà dateDebut > date (ContractForm.tsx:58). Consigné pour qu'un futur
    // appelant sans ce garde-fou ne se croie pas protégé ici.
    expect(moisEntre("2026-06-01", "2026-01-01")).toEqual(["2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]);
  });
});

describe("bornesDuMois", () => {
  it("premier et dernier jour du mois, février compris", () => {
    expect(bornesDuMois("2026-02")).toEqual({ debut: "2026-02-01", fin: "2026-02-28" });
    expect(bornesDuMois("2024-02")).toEqual({ debut: "2024-02-01", fin: "2024-02-29" });
    expect(bornesDuMois("2026-01")).toEqual({ debut: "2026-01-01", fin: "2026-01-31" });
    expect(bornesDuMois("2026-04")).toEqual({ debut: "2026-04-01", fin: "2026-04-30" });
    expect(bornesDuMois("2026-12")).toEqual({ debut: "2026-12-01", fin: "2026-12-31" });
  });

  it("le mois d'un début et d'une fin est bien le mois demandé", () => {
    for (const mois of ["2025-11", "2026-02", "2026-10"]) {
      const { debut, fin } = bornesDuMois(mois);
      expect(moisCle(debut)).toBe(mois);
      expect(moisCle(fin)).toBe(mois);
    }
  });
});

describe("moisSuivant", () => {
  it("passe au mois suivant, et à l'année suivante après décembre", () => {
    expect(moisSuivant("2026-01")).toBe("2026-02");
    expect(moisSuivant("2026-11")).toBe("2026-12");
    expect(moisSuivant("2026-12")).toBe("2027-01");
    expect(moisSuivant("2024-02")).toBe("2024-03");
  });

  it("douze itérations depuis janvier 2026 retombent sur janvier 2027", () => {
    // Forme exacte de la boucle d'indemnisationMensuelle.ts:325 : aucun mois sauté ni compté deux
    // fois sur une année de droits.
    let curseur = "2026-01";
    const parcours: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      parcours.push(curseur);
      curseur = moisSuivant(curseur);
    }
    expect(parcours).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(curseur).toBe("2027-01");
  });
});

describe("invariant du prorata mensuel — aucun jour perdu ni inventé", () => {
  // C'est la propriété dont dépend `repartirContratParMois` (decoupageMensuel.ts:64-78) : la somme
  // des jours attribués mois par mois doit égaler la durée totale du contrat. Si elle tombait, les
  // heures et le salaire d'un contrat à cheval seraient répartis sur un total faux — donc un nombre
  // d'heures faux dans le décompte des 507 h.
  const cas = [
    { debut: "2026-03-05", fin: "2026-03-20", libelle: "un seul mois" },
    { debut: "2025-11-15", fin: "2026-02-10", libelle: "à cheval sur une fin d'année" },
    { debut: "2024-01-15", fin: "2024-03-15", libelle: "à cheval sur un 29 février" },
    { debut: "2026-03-01", fin: "2026-04-30", libelle: "à cheval sur le passage à l'heure d'été" },
    { debut: "2026-10-01", fin: "2026-11-30", libelle: "à cheval sur le passage à l'heure d'hiver" },
    { debut: "2025-08-15", fin: "2026-08-14", libelle: "fenêtre de 12 mois glissants" },
  ];

  for (const { debut, fin, libelle } of cas) {
    it(`somme des jours par mois = durée totale (${libelle})`, () => {
      const total = moisEntre(debut, fin).reduce((somme, cle) => {
        const bornes = bornesDuMois(cle);
        return somme + joursChevauchement(debut, fin, bornes.debut, bornes.fin);
      }, 0);
      expect(total).toBe(diffJours(debut, fin) + 1);
    });
  }
});
