// Phase 2 de la refonte Supabase — le contrat de construction du client.
//
// Ce que ces tests protègent : la promesse « Cadence s'ouvre SANS COMPTE ». Elle ne tient que si une
// configuration absente, vide ou malformée donne `null` au lieu de lever. Une exception ici
// remonterait jusqu'au rendu et transformerait « la connexion n'est pas configurée » en « l'app ne
// démarre plus ».
import { describe, expect, it } from "vitest";
import { construireClientAuth, obtenirClientAuth, reinitialiserClientAuthMemorise } from "../supabaseClient";

const URL_VALIDE = "https://rajybcuzsflrxphppsfx.supabase.co";
// Pas une vraie clé : `createClient` ne valide pas son contenu, seulement sa présence.
const CLE_FACTICE = "cle-anon-factice-pour-les-tests";

describe("construireClientAuth — une configuration incomplète ne doit jamais lever", () => {
  it("rend null quand rien n'est fourni", () => {
    expect(construireClientAuth({})).toBeNull();
  });

  it("rend null quand une seule des deux variables est là", () => {
    expect(construireClientAuth({ url: URL_VALIDE })).toBeNull();
    expect(construireClientAuth({ cleAnon: CLE_FACTICE })).toBeNull();
  });

  it("traite une variable vide ou faite d'espaces comme absente", () => {
    // Le cas réel : une variable déclarée dans .env mais laissée sans valeur.
    expect(construireClientAuth({ url: "", cleAnon: "" })).toBeNull();
    expect(construireClientAuth({ url: "   ", cleAnon: "   " })).toBeNull();
    expect(construireClientAuth({ url: URL_VALIDE, cleAnon: "  " })).toBeNull();
  });

  it("rend null au lieu de lever quand l'URL est malformée", () => {
    // Une URL mal recopiée est une faute de frappe, pas une raison d'empêcher Cadence de s'ouvrir.
    expect(construireClientAuth({ url: "rajybcuzsflrxphppsfx", cleAnon: CLE_FACTICE })).toBeNull();
    expect(construireClientAuth({ url: "://", cleAnon: CLE_FACTICE })).toBeNull();
  });

  it("rend un client utilisable quand les deux variables sont là", () => {
    const client = construireClientAuth({ url: URL_VALIDE, cleAnon: CLE_FACTICE });
    expect(client).not.toBeNull();
    // Les cinq gestes dont l'app a besoin sont bien présents : c'est ce qui prouve que `client.auth`
    // de la bibliothèque satisfait réellement l'interface étroite, et pas seulement au typage.
    expect(typeof client?.getSession).toBe("function");
    expect(typeof client?.onAuthStateChange).toBe("function");
    expect(typeof client?.signInWithOtp).toBe("function");
    expect(typeof client?.signInWithPassword).toBe("function");
    expect(typeof client?.signOut).toBe("function");
  });

  it("ne tient pas compte des espaces autour des valeurs", () => {
    expect(construireClientAuth({ url: ` ${URL_VALIDE} `, cleAnon: ` ${CLE_FACTICE} ` })).not.toBeNull();
  });
});

describe("obtenirClientAuth — l'environnement des TESTS est délibérément non configuré", () => {
  it("ne construit aucun client, sur n'importe quelle machine", () => {
    // ⚠️ CE TEST EST AUSSI LE GARDIEN DE `.env.test`. Vite charge le `.env` réel de la machine même
    // pendant les tests : sans `.env.test` (qui vide les deux variables), ce test passerait en
    // intégration continue et échouerait sur la machine de Benoît. Un test dont le résultat dépend
    // de la machine ne prouve rien — et ici, il ferait en plus ouvrir de vraies sessions Supabase
    // aux tests de composants.
    reinitialiserClientAuthMemorise();
    expect(obtenirClientAuth()).toBeNull();
  });

  it("ne construit le client qu'une fois (un seul rafraîchisseur de jeton)", () => {
    // Deux clients sur la même clé de stockage se marcheraient dessus. Ici les deux valent null,
    // mais c'est bien la même valeur mémorisée qui est rendue.
    reinitialiserClientAuthMemorise();
    expect(obtenirClientAuth()).toBe(obtenirClientAuth());
  });
});
