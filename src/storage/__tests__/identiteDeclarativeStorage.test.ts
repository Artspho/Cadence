import { beforeEach, describe, expect, it, vi } from "vitest";
import { exporterJSON, importerJSON, sauvegarderDonnees, chargerDonnees, type DonneesApp } from "../localStorageAdapter";
import {
  CLE_IDENTITE_DECLARATIVE_POUR_TESTS as CLE_IDENTITE,
  chargerIdentiteDeclarative,
  identiteComplete,
  identiteVide,
  sauvegarderIdentiteDeclarative,
} from "../identiteDeclarativeStorage";

const IDENTITE = { nom: "Zahra", prenom: "Benoît", profession: "Musicien intermittent du spectacle", adresse: "12 rue des Artistes, 13001 Marseille" };
const DONNEES_VIDES: DonneesApp = { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null };

// L'environnement vitest du projet est `node` (cf. vite.config.ts) : pas de `window`. Stub mémoire
// minimal plutôt que d'ajouter jsdom, qui n'est pas une dépendance du projet — ces tests portent sur
// le cloisonnement des clés, pas sur le DOM.
const memoire = new Map<string, string>();
const localStorageStub: Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> = {
  getItem: (cle) => (memoire.has(cle) ? memoire.get(cle)! : null),
  setItem: (cle, valeur) => void memoire.set(cle, String(valeur)),
  removeItem: (cle) => void memoire.delete(cle),
  clear: () => memoire.clear(),
};
vi.stubGlobal("window", { localStorage: localStorageStub });

beforeEach(() => {
  memoire.clear();
});

describe("identiteDeclarativeStorage — aller-retour", () => {
  it("relit exactement ce qui a été écrit", async () => {
    await sauvegarderIdentiteDeclarative(IDENTITE);
    expect(await chargerIdentiteDeclarative()).toEqual(IDENTITE);
  });

  it("clé absente : retourne une identité vide, ne lève pas", async () => {
    expect(await chargerIdentiteDeclarative()).toEqual(identiteVide);
  });

  it("contenu corrompu : retourne une identité vide plutôt que de faire échouer la page", async () => {
    window.localStorage.setItem(CLE_IDENTITE, "{ pas du json");
    expect(await chargerIdentiteDeclarative()).toEqual(identiteVide);
  });

  it("adresse omise : reste valide (champ optionnel)", async () => {
    const sansAdresse = { nom: "Zahra", prenom: "Benoît", profession: "Musicien" };
    await sauvegarderIdentiteDeclarative(sansAdresse);
    expect(await chargerIdentiteDeclarative()).toEqual(sansAdresse);
  });
});

describe("identiteComplete", () => {
  it("exige nom, prénom et profession non vides", () => {
    expect(identiteComplete(IDENTITE)).toBe(true);
    expect(identiteComplete(identiteVide)).toBe(false);
    expect(identiteComplete({ nom: "Zahra", prenom: "", profession: "Musicien" })).toBe(false);
    expect(identiteComplete({ nom: "Zahra", prenom: "Benoît", profession: "" })).toBe(false);
  });

  it("n'accepte pas des espaces comme valeur", () => {
    expect(identiteComplete({ nom: "   ", prenom: "Benoît", profession: "Musicien" })).toBe(false);
  });

  it("l'adresse n'est pas requise", () => {
    expect(identiteComplete({ nom: "Zahra", prenom: "Benoît", profession: "Musicien" })).toBe(true);
  });
});

// ── Le point critique de la fonctionnalité ────────────────────────────────────────────────────
// L'identité est la seule donnée nominative de Cadence, et la SPEC §11.A prévoit de collecter les
// exports JSON des testeurs de la bêta. Ces tests verrouillent le fait qu'elle n'y entre jamais.
describe("isolation vis-à-vis de exporterJSON / importerJSON", () => {
  it("exporterJSON ne contient aucune donnée d'identité, même quand la clé est renseignée", async () => {
    await sauvegarderIdentiteDeclarative(IDENTITE);

    const exporte = exporterJSON(DONNEES_VIDES);

    expect(exporte).not.toContain("Zahra");
    expect(exporte).not.toContain("Benoît");
    expect(exporte).not.toContain("Musicien");
    expect(exporte).not.toContain("rue des Artistes");
    expect(exporte).not.toContain("identite");
    expect(Object.keys(JSON.parse(exporte))).toEqual(["schemaVersion", "exporteLe", "profil", "contrats", "periodes", "soldeIndemnisationDepart"]);
  });

  it("importerJSON ignore une clé d'identité injectée dans le fichier importé", async () => {
    const exporte = JSON.parse(exporterJSON(DONNEES_VIDES));
    // Fichier malveillant ou bricolé à la main : on tente d'injecter de l'identité par l'import.
    const falsifie = JSON.stringify({ ...exporte, identiteDeclarative: IDENTITE, cadence_identite_declarative: IDENTITE });

    const importe = importerJSON(falsifie);

    expect(importe).toEqual(DONNEES_VIDES);
    expect(Object.keys(importe)).not.toContain("identiteDeclarative");
    expect(Object.keys(importe)).not.toContain("cadence_identite_declarative");
  });

  it("un import complet n'écrase pas l'identité déjà stockée", async () => {
    await sauvegarderIdentiteDeclarative(IDENTITE);

    const importe = importerJSON(exporterJSON(DONNEES_VIDES));
    await sauvegarderDonnees(importe);

    expect(await chargerIdentiteDeclarative()).toEqual(IDENTITE);
  });

  it("sauvegarder l'identité ne touche pas la clé de données de l'app", async () => {
    await sauvegarderDonnees(DONNEES_VIDES);
    const avant = window.localStorage.getItem("cadence:v1:donnees");

    await sauvegarderIdentiteDeclarative(IDENTITE);

    expect(window.localStorage.getItem("cadence:v1:donnees")).toBe(avant);
    expect(await chargerDonnees()).toEqual(DONNEES_VIDES);
  });

  it("les deux clés sont bien distinctes et coexistent", async () => {
    await sauvegarderDonnees(DONNEES_VIDES);
    await sauvegarderIdentiteDeclarative(IDENTITE);

    expect(CLE_IDENTITE).not.toBe("cadence:v1:donnees");
    expect(window.localStorage.getItem(CLE_IDENTITE)).not.toBeNull();
    expect(window.localStorage.getItem("cadence:v1:donnees")).not.toBeNull();
  });
});
