// Phase 4 de la refonte Supabase — la vérification chiffrée.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//  1. qu'un « identique » ne puisse pas être affiché sur des données différentes ;
//  2. qu'un « différent » ne puisse pas être affiché sur des données identiques (fausse alerte) ;
//  3. que ce module ne fasse RIEN d'autre que lire — pas d'écriture, ni serveur ni locale.
import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION_DONNEES, creerDonneesVides, type DonneesApp } from "../localStorageAdapter";
import { TABLE_DONNEES } from "../miroirSupabase";
import { canoniser, decompter, lireLigneServeur, listerDifferences, texteCanonique, verifierMigration } from "../verificationMigration";
import type { ClientLectureDonnees } from "../../auth/supabaseClient";

const UTILISATEUR = "2ed466db-a58b-4ec4-b73a-28a2a333b82d";
const MAJ_LE = "2026-08-05T09:12:00.000Z";

const DONNEES: DonneesApp = {
  ...creerDonneesVides(),
  contrats: [
    {
      id: "c1",
      dateDebut: "2026-01-05",
      date: "2026-01-05",
      type: "artiste",
      typeRemuneration: "cachet",
      territoire: "france",
      nbCachets: 3,
      salaireBrut: 1200,
      employeur: "Orchestre du Miroir",
    },
  ],
};

/** Hacheur déterministe : le texte canonique lui-même. Suffit pour tester la DÉCISION d'égalité. */
const hacheurIdentite = async (texte: string) => texte;

/**
 * Faux client de lecture. Enregistre ce qui a été demandé, et n'expose QUE le chemin de lecture —
 * si un jour ce module appelait `upsert`, il n'y aurait rien à appeler et le test casserait.
 */
function fauxClient(reponse: { data: Record<string, unknown> | null; error: { message: string } | null } | Error) {
  const maybeSingle = vi.fn(async () => {
    if (reponse instanceof Error) throw reponse;
    return reponse;
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as ClientLectureDonnees, from, select, eq, maybeSingle };
}

function ligneServeur(donnees: unknown, versionSchema: unknown = SCHEMA_VERSION_DONNEES) {
  return { data: { donnees, version_schema: versionSchema, maj_le: MAJ_LE }, error: null };
}

describe("canoniser — la forme comparable", () => {
  it("trie les clés des objets, récursivement", () => {
    expect(texteCanonique({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("NE trie PAS les tableaux : deux contrats permutés ne sont pas la même donnée", () => {
    expect(canoniser([{ id: "b" }, { id: "a" }])).toEqual([{ id: "b" }, { id: "a" }]);
  });

  it("laisse les valeurs simples et `null` intacts", () => {
    expect(texteCanonique({ profil: null, n: 12.5, s: "x" })).toBe('{"n":12.5,"profil":null,"s":"x"}');
  });
});

describe("verifierMigration — le verdict", () => {
  it("dit « identique » quand les deux côtés portent les mêmes données", async () => {
    const { client } = fauxClient(ligneServeur(DONNEES));
    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite);

    expect(verdict.statut).toBe("identique");
    if (verdict.statut !== "identique") return;
    expect(verdict.local.contrats).toBe(1);
    expect(verdict.serveur.contrats).toBe(1);
    expect(verdict.majLe).toBe(MAJ_LE);
  });

  it("dit « identique » même si Postgres a renvoyé les clés dans un AUTRE ORDRE", async () => {
    // LE PIÈGE QUI PRODUIRAIT UNE FAUSSE ALERTE. Le JSONB de Postgres ne conserve pas l'ordre des
    // clés : sans canonisation, ce cas — rigoureusement les mêmes données — s'afficherait
    // « différent » et enverrait chercher une perte de données inexistante.
    const memeContratClesInversees = {
      employeur: "Orchestre du Miroir",
      salaireBrut: 1200,
      nbCachets: 3,
      territoire: "france",
      typeRemuneration: "cachet",
      type: "artiste",
      date: "2026-01-05",
      dateDebut: "2026-01-05",
      id: "c1",
    };
    const { client } = fauxClient(
      ligneServeur({ exercicesGeles: {}, soldeIndemnisationDepart: null, periodes: [], contrats: [memeContratClesInversees], profil: null }),
    );

    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite);
    expect(verdict.statut).toBe("identique");
  });

  it("dit « différent » et NOMME l'endroit quand un contrat a changé", async () => {
    const altere = { ...DONNEES, contrats: [{ ...DONNEES.contrats[0], salaireBrut: 1201 }] };
    const { client } = fauxClient(ligneServeur(altere));

    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite);
    expect(verdict.statut).toBe("different");
    if (verdict.statut !== "different") return;
    expect(verdict.differences).toEqual(["les contrats"]);
    expect(verdict.empreinteLocale).not.toBe(verdict.empreinteServeur);
  });

  it("dit « différent » quand le serveur a MOINS de contrats — le cas d'une perte", async () => {
    const { client } = fauxClient(ligneServeur({ ...DONNEES, contrats: [] }));
    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite);

    expect(verdict.statut).toBe("different");
    if (verdict.statut !== "different") return;
    expect(verdict.local.contrats).toBe(1);
    expect(verdict.serveur.contrats).toBe(0);
  });

  it("dit « absente » (et non « différent ») quand aucune ligne n'existe encore", async () => {
    const { client } = fauxClient({ data: null, error: null });
    expect(await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite)).toEqual({ statut: "absente" });
  });

  it("refuse de comparer si la version de schéma n'est pas celle attendue", async () => {
    const { client } = fauxClient(ligneServeur(DONNEES, 99));
    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite);
    expect(verdict).toEqual({ statut: "versionInattendue", attendue: SCHEMA_VERSION_DONNEES, recue: 99 });
  });

  it("rend un échec explicite quand Supabase refuse la lecture", async () => {
    const { client } = fauxClient({ data: null, error: { message: "JWT expired" } });
    expect(await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite)).toEqual({ statut: "echec", message: "JWT expired" });
  });

  it("rend un échec au lieu d'un verdict quand l'empreinte ne peut pas être calculée", async () => {
    // Sans empreinte il n'y a pas de preuve. Se rabattre sur une comparaison plus faible serait pire
    // que de ne rien conclure, parce que le résultat serait cru.
    const { client } = fauxClient(ligneServeur(DONNEES));
    const verdict = await verifierMigration(client, UTILISATEUR, DONNEES, async () => {
      throw new Error("contexte non sécurisé");
    });
    expect(verdict).toEqual({ statut: "echec", message: "contexte non sécurisé" });
  });

  it("ne lève jamais, même si la bibliothèque lève", async () => {
    const { client } = fauxClient(new Error("réseau injoignable"));
    expect(await verifierMigration(client, UTILISATEUR, DONNEES, hacheurIdentite)).toEqual({ statut: "echec", message: "réseau injoignable" });
  });
});

describe("lireLigneServeur — ce qui est demandé au serveur", () => {
  it("lit la bonne table, filtrée sur l'utilisateur de la session", async () => {
    const { client, from, select, eq } = fauxClient(ligneServeur(DONNEES));
    await lireLigneServeur(client, UTILISATEUR);

    expect(from).toHaveBeenCalledWith(TABLE_DONNEES);
    expect(select).toHaveBeenCalledWith("donnees, version_schema, maj_le");
    expect(eq).toHaveBeenCalledWith("user_id", UTILISATEUR);
  });

  it("n'appelle QUE le chemin de lecture — aucune écriture, jamais (règle de la phase 4)", async () => {
    const { client, from } = fauxClient(ligneServeur(DONNEES));
    await lireLigneServeur(client, UTILISATEUR);

    expect(from).toHaveBeenCalledTimes(1);
    // La garantie principale est dans le type `ClientLectureDonnees`, qui n'expose ni `upsert`, ni
    // `insert`, ni `update`, ni `delete`. Ce test vérifie l'autre moitié, comme en phase 3.
    expect(Object.keys(from.mock.results[0].value)).toEqual(["select"]);
  });
});

describe("decompter — les chiffres montrés à l'humain", () => {
  it("compte ce qui est là", () => {
    expect(decompter({ contrats: [1, 2], periodes: [3], exercicesGeles: { a: {}, b: {} }, profil: { nom: "x" } })).toEqual({
      contrats: 2,
      periodes: 1,
      exercicesGeles: 2,
      profilPresent: true,
    });
  });

  it("rend 0 plutôt que d'exploser sur une valeur serveur inattendue", () => {
    // Les données serveur n'ont traversé aucun schéma Zod : ce module doit encaisser n'importe quoi.
    expect(decompter({ contrats: "pas un tableau", exercicesGeles: null, profil: null })).toEqual({
      contrats: 0,
      periodes: 0,
      exercicesGeles: 0,
      profilPresent: false,
    });
    expect(decompter(null)).toEqual({ contrats: 0, periodes: 0, exercicesGeles: 0, profilPresent: false });
  });
});

describe("listerDifferences — dire OÙ, pas seulement QUE", () => {
  it("ne signale rien quand tout concorde", () => {
    expect(listerDifferences(DONNEES, DONNEES)).toEqual([]);
  });

  it("signale chaque partie qui diffère, sous un nom lisible", () => {
    expect(listerDifferences(DONNEES, { ...DONNEES, contrats: [], profil: { nom: "inconnu" } })).toEqual(["le profil", "les contrats"]);
  });

  it("signale un champ inattendu venu du serveur au lieu de l'ignorer", () => {
    const differences = listerDifferences(DONNEES, { ...DONNEES, brouillon: true });
    expect(differences).toEqual(["des champs inattendus côté serveur (brouillon)"]);
  });
});
