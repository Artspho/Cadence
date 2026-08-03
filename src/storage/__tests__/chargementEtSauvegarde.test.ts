// @vitest-environment jsdom
//
// Correctif du 03/08/2026, point 🔴 n°1 de docs/critique_2026-08-03.md : `chargerDonnees`
// distingue désormais TROIS issues au lieu d'une seule, et `sauvegarderDonnees` fait glisser la
// version précédente dans une copie de secours au lieu d'écraser sans filet.
//
// Ce que ces tests verrouillent, dans l'ordre d'importance :
//  1. « rien en stockage » et « contenu illisible » ne se ressemblent plus — c'est la distinction
//     qui empêche l'appelant d'écrire par-dessus des données qu'il n'a pas su lire ;
//  2. la copie de secours tourne correctement, et n'est PAS écrasée par un démarrage à vide ;
//  3. un échec d'écriture remonte au lieu d'être avalé.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLE_QUARANTAINE,
  CLE_SAUVEGARDE,
  CLE_STOCKAGE,
  chargerDonnees,
  creerDonneesVides,
  reinitialiserDonnees,
  sauvegarderDonnees,
  type DonneesApp,
} from "../localStorageAdapter";
import { contrat, profil } from "../../engine/__tests__/testUtils";

function donneesAvec(nbContrats: number): DonneesApp {
  return {
    profil: profil({ dateAnniversaire: "2027-01-17" }),
    contrats: Array.from({ length: nbContrats }, (_, i) => contrat({ date: `2026-0${i + 1}-05`, nbCachets: 2, salaireBrut: 300 })),
    periodes: [],
    soldeIndemnisationDepart: null,
    exercicesGeles: {},
  };
}

// JSON valide et parfaitement récupérable à la main, refusé par le seul schéma : c'est le scénario
// réaliste (une évolution du schéma qui rend illisible l'existant), pas une bouillie d'octets.
const CONTENU_REFUSE_PAR_LE_SCHEMA = JSON.stringify({
  profil: null,
  contrats: [{ id: "c1", dateDebut: "2026-01-05", date: "2026-01-05", type: "type_inconnu", typeRemuneration: "cachet", territoire: "france", salaireBrut: 300, employeur: "X" }],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
});

describe("chargerDonnees — trois issues distinctes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("aucune clé : statut « vide » — un vrai premier lancement, écriture autorisée", async () => {
    expect(await chargerDonnees()).toEqual({ statut: "vide" });
  });

  it("contenu valide : statut « ok » avec les données", async () => {
    const donnees = donneesAvec(2);
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));

    const resultat = await chargerDonnees();
    expect(resultat.statut).toBe("ok");
    if (resultat.statut !== "ok") return;
    expect(resultat.donnees.contrats).toHaveLength(2);
  });

  it("JSON invalide : statut « illisible », JAMAIS « vide » — et le texte brut est transporté intact", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, "{ceci n'est pas du JSON");

    const resultat = await chargerDonnees();
    expect(resultat.statut).toBe("illisible");
    if (resultat.statut !== "illisible") return;
    expect(resultat.brut).toBe("{ceci n'est pas du JSON");
    expect(resultat.detail).not.toBe("");
  });

  it("JSON valide mais refusé par le schéma : « illisible » aussi — le contenu récupérable est préservé et le motif nommé", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, CONTENU_REFUSE_PAR_LE_SCHEMA);

    const resultat = await chargerDonnees();
    expect(resultat.statut).toBe("illisible");
    if (resultat.statut !== "illisible") return;
    expect(resultat.brut).toBe(CONTENU_REFUSE_PAR_LE_SCHEMA);
    expect(resultat.detail).toMatch(/contrats/); // le chemin fautif est nommé, pas un message opaque
  });

  it("chaîne vide : « illisible », pas « vide » — une clé présente et inexploitable n'est pas un stockage neuf", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, "");
    expect((await chargerDonnees()).statut).toBe("illisible");
  });

  it("stockage inaccessible (navigation privée verrouillée) : « illisible » sans brut, jamais « vide »", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    const resultat = await chargerDonnees();
    expect(resultat.statut).toBe("illisible");
    if (resultat.statut !== "illisible") return;
    expect(resultat.brut).toBeNull();
  });

  it("contenu illisible + copie de secours lisible : la copie est proposée", async () => {
    window.localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(donneesAvec(3)));
    window.localStorage.setItem(CLE_STOCKAGE, CONTENU_REFUSE_PAR_LE_SCHEMA);

    const resultat = await chargerDonnees();
    if (resultat.statut !== "illisible") throw new Error("statut attendu : illisible");
    expect(resultat.sauvegarde?.contrats).toHaveLength(3);
  });

  it("copie de secours elle-même illisible : traitée comme absente, jamais un second échec en cascade", async () => {
    window.localStorage.setItem(CLE_SAUVEGARDE, "{cassée aussi");
    window.localStorage.setItem(CLE_STOCKAGE, CONTENU_REFUSE_PAR_LE_SCHEMA);

    const resultat = await chargerDonnees();
    if (resultat.statut !== "illisible") throw new Error("statut attendu : illisible");
    expect(resultat.sauvegarde).toBeNull();
  });
});

describe("sauvegarderDonnees — rotation de la copie de secours", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("première écriture : rien à sauvegarder, la copie reste absente", async () => {
    expect(await sauvegarderDonnees(donneesAvec(1))).toEqual({ ok: true });
    expect(window.localStorage.getItem(CLE_SAUVEGARDE)).toBeNull();
  });

  it("deuxième écriture : la version précédente passe en copie de secours", async () => {
    await sauvegarderDonnees(donneesAvec(1));
    await sauvegarderDonnees(donneesAvec(2));

    expect(JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) as string).contrats).toHaveLength(2);
    expect(JSON.parse(window.localStorage.getItem(CLE_SAUVEGARDE) as string).contrats).toHaveLength(1);
  });

  it("la copie de secours ne recule que d'UN cran : après trois écritures, elle porte la deuxième", async () => {
    await sauvegarderDonnees(donneesAvec(1));
    await sauvegarderDonnees(donneesAvec(2));
    await sauvegarderDonnees(donneesAvec(3));

    expect(JSON.parse(window.localStorage.getItem(CLE_SAUVEGARDE) as string).contrats).toHaveLength(2);
  });

  it("réécrire un contenu IDENTIQUE ne consomme pas la copie de secours — sinon chaque ouverture de l'app la détruirait", async () => {
    // Le MÊME objet réécrit deux fois : c'est exactement ce que fait l'app au démarrage (elle
    // réécrit ce qu'elle vient de lire). `donneesAvec` ne peut pas servir ici, ses `id` de contrat
    // sont uniques à chaque appel — deux appels ne produisent jamais le même JSON.
    const etatCourant = donneesAvec(2);
    await sauvegarderDonnees(donneesAvec(1));
    await sauvegarderDonnees(etatCourant);
    await sauvegarderDonnees(etatCourant);

    expect(JSON.parse(window.localStorage.getItem(CLE_SAUVEGARDE) as string).contrats).toHaveLength(1);
  });

  it("échec d'écriture : remonté à l'appelant, jamais avalé — et l'existant reste intact", async () => {
    await sauvegarderDonnees(donneesAvec(1));
    const avant = window.localStorage.getItem(CLE_STOCKAGE);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const resultat = await sauvegarderDonnees(donneesAvec(5));
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.message).toMatch(/Quota/i);

    vi.restoreAllMocks();
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toBe(avant);
  });
});

describe("reinitialiserDonnees — le seul chemin autorisé à écrire depuis l'écran d'erreur", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("met le contenu illisible en quarantaine avant de repartir sur un état vide", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, CONTENU_REFUSE_PAR_LE_SCHEMA);

    const vides = await reinitialiserDonnees();

    expect(vides).toEqual(creerDonneesVides());
    expect(window.localStorage.getItem(CLE_QUARANTAINE)).toBe(CONTENU_REFUSE_PAR_LE_SCHEMA);
    expect(JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) as string)).toEqual(creerDonneesVides());
  });

  // Garantie de NON-ACCUMULATION : une clé unique et fixe, écrasée à chaque incident — jamais une
  // clé horodatée par incident. Deux quarantaines successives ne peuvent donc pas faire enfler le
  // stockage indéfiniment (ce qui rejoindrait le point n°2 de la critique, saturation). Le coût est
  // borné à UNE copie du jeu de données, quel que soit le nombre d'incidents.
  it("une seule quarantaine à la fois : un second incident écrase le premier, jamais d'accumulation", async () => {
    window.localStorage.setItem(CLE_STOCKAGE, CONTENU_REFUSE_PAR_LE_SCHEMA);
    await reinitialiserDonnees();

    const secondIncident = '{"encore casse":true}';
    window.localStorage.setItem(CLE_STOCKAGE, secondIncident);
    await reinitialiserDonnees();

    expect(window.localStorage.getItem(CLE_QUARANTAINE)).toBe(secondIncident);
    const clesQuarantaine = Object.keys(window.localStorage).filter((c) => c.includes("illisible"));
    expect(clesQuarantaine).toEqual([CLE_QUARANTAINE]);
  });
});
