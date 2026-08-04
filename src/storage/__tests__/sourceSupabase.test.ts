// Phase 5 de la refonte Supabase — le serveur devient la source de vérité.
//
// C'est le premier module de Cadence capable de perdre des données : il lit ce qui sera affiché et
// écrit ce qui fera référence. Ces tests protègent, dans l'ordre d'importance :
//
//  1. AUCUNE ÉCRITURE À L'AVEUGLE — une écriture qui ne peut plus nommer la version qu'elle remplace
//     est refusée, jamais forcée. C'est le scénario « deux stockages qui se croient seuls », celui
//     qui a déjà coûté ses contrats à Benoît une fois ;
//  2. « ILLISIBLE » N'EST PAS « VIDE » — la faute corrigée le 03/08/2026 côté localStorage ne doit
//     pas renaître côté serveur ;
//  3. AUCUN FAUX ÉCHEC — une écriture réellement effectuée n'est jamais annoncée comme ratée, sinon
//     on invite à refaire ce qui est déjà fait ;
//  4. AUCUN FAUX VERROU — sans jeton exploitable rendu par le serveur, on refuse d'écrire au lieu de
//     fabriquer une protection qui n'en est pas une.
import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION_DONNEES, creerDonneesVides, exporterJSON, importerJSON, type DonneesApp } from "../localStorageAdapter";
import { TABLE_DONNEES } from "../miroirSupabase";
import { ecrireEtatServeur, lireEtatServeur } from "../sourceSupabase";
import type { ClientSourceDonnees, ErreurPostgrest } from "../../auth/supabaseClient";
import { contrat, profil } from "../../engine/__tests__/testUtils";

const UTILISATEUR = "2ed466db-a58b-4ec4-b73a-28a2a333b82d";
const JETON = "2026-08-05T01:05:26.123456+00:00";
const JETON_SUIVANT = "2026-08-05T09:14:02.987654+00:00";

const DONNEES: DonneesApp = {
  ...creerDonneesVides(),
  profil: profil({ dateAnniversaire: "2027-01-17" }),
  contrats: [contrat({ date: "2026-01-05", nbCachets: 3, salaireBrut: 1200 })],
};

/** Ce que le schéma refuse : un `type` de contrat inconnu. JSON parfaitement valide par ailleurs. */
const CONTENU_REFUSE_PAR_LE_SCHEMA = {
  profil: null,
  contrats: [{ id: "c1", dateDebut: "2026-01-05", date: "2026-01-05", type: "type_inconnu", typeRemuneration: "cachet", territoire: "france", salaireBrut: 300, employeur: "X" }],
  periodes: [],
  soldeIndemnisationDepart: null,
  exercicesGeles: {},
};

type Reponse<T> = { data: T; error: ErreurPostgrest | null } | Error;

/**
 * Faux client qui enregistre chaque chaîne d'appel exercée.
 *
 * Il vaut aussi comme filet sur l'assertion de type de `construireClient` (`as unknown as
 * ClientSourceDonnees`, TS2589) : ce que le compilateur ne peut pas vérifier là-bas, ces tests le
 * vérifient en exigeant que seules les méthodes déclarées soient appelées, et dans cet ordre.
 */
function fauxClient(reponses: {
  lecture?: Reponse<Record<string, unknown> | null>;
  insertion?: Reponse<Record<string, unknown>[] | null>;
  modification?: Reponse<Record<string, unknown>[] | null>;
} = {}) {
  const tables: string[] = [];
  const colonnesLues: string[] = [];
  const filtresLecture: Array<[string, string]> = [];
  const filtresModification: Array<[string, string]> = [];
  const chargesInserees: Record<string, unknown>[] = [];
  const chargesModifiees: Record<string, unknown>[] = [];

  function rendre<T>(reponse: Reponse<T> | undefined, defaut: T) {
    if (reponse instanceof Error) throw reponse;
    return reponse ?? { data: defaut, error: null };
  }

  const from = vi.fn((table: string) => {
    tables.push(table);
    return {
      select: (colonnes: string) => {
        colonnesLues.push(colonnes);
        return {
          eq: (colonne: string, valeur: string) => {
            filtresLecture.push([colonne, valeur]);
            return { maybeSingle: async () => rendre(reponses.lecture, null) };
          },
        };
      },
      insert: (charge: Record<string, unknown>) => {
        chargesInserees.push(charge);
        return { select: async () => rendre(reponses.insertion, [{ maj_le: JETON }]) };
      },
      update: (charge: Record<string, unknown>) => {
        chargesModifiees.push(charge);
        return {
          eq: (colonne1: string, valeur1: string) => {
            filtresModification.push([colonne1, valeur1]);
            return {
              eq: (colonne2: string, valeur2: string) => {
                filtresModification.push([colonne2, valeur2]);
                return { select: async () => rendre(reponses.modification, [{ maj_le: JETON_SUIVANT }]) };
              },
            };
          },
        };
      },
    };
  });

  return { client: { from } as unknown as ClientSourceDonnees, tables, colonnesLues, filtresLecture, filtresModification, chargesInserees, chargesModifiees };
}

describe("lireEtatServeur — ce que le serveur a le droit de dire", () => {
  it("interroge la bonne table, la bonne ligne, et demande la version ET l'horodatage", async () => {
    const faux = fauxClient({ lecture: { data: null, error: null } });
    await lireEtatServeur(faux.client, UTILISATEUR);

    expect(faux.tables).toEqual([TABLE_DONNEES]);
    // `maj_le` fait partie des colonnes demandées : sans elle, aucune écriture ultérieure ne pourrait
    // être protégée.
    expect(faux.colonnesLues[0]).toContain("maj_le");
    expect(faux.filtresLecture).toEqual([["user_id", UTILISATEUR]]);
  });

  it("aucune ligne : « absente » — rien n'a encore été téléversé, ce n'est pas une erreur", async () => {
    const faux = fauxClient({ lecture: { data: null, error: null } });
    expect(await lireEtatServeur(faux.client, UTILISATEUR)).toEqual({ statut: "absente" });
  });

  it("ligne valide : « lu », avec les données et le jeton rendu par le serveur", async () => {
    const faux = fauxClient({ lecture: { data: { donnees: DONNEES, version_schema: SCHEMA_VERSION_DONNEES, maj_le: JETON }, error: null } });

    const etat = await lireEtatServeur(faux.client, UTILISATEUR);
    expect(etat.statut).toBe("lu");
    if (etat.statut !== "lu") return;
    expect(etat.donnees).toEqual(DONNEES);
    expect(etat.jeton).toBe(JETON);
  });

  it("contenu refusé par le schéma : « illisible », JAMAIS un état vide — et le jeton est conservé", async () => {
    const faux = fauxClient({ lecture: { data: { donnees: CONTENU_REFUSE_PAR_LE_SCHEMA, version_schema: SCHEMA_VERSION_DONNEES, maj_le: JETON }, error: null } });

    const etat = await lireEtatServeur(faux.client, UTILISATEUR);
    expect(etat.statut).toBe("illisible");
    if (etat.statut !== "illisible") return;
    // Le motif nomme l'endroit du refus : c'est ce qui rend le contenu récupérable à la main.
    expect(etat.detail).toContain("contrats");
    // Le brut est rendu intact pour pouvoir être exporté avant toute décision.
    expect(etat.brut).toEqual(CONTENU_REFUSE_PAR_LE_SCHEMA);
    expect(etat.jeton).toBe(JETON);
  });

  it("version de schéma inattendue : dite telle quelle, AVANT toute tentative de validation", async () => {
    // Données volontairement invalides pour le schéma courant : le résultat doit malgré tout être
    // « versionInattendue ». Annoncer « illisible » enverrait chercher une perte de données là où il
    // n'y a qu'un changement de format.
    const faux = fauxClient({ lecture: { data: { donnees: CONTENU_REFUSE_PAR_LE_SCHEMA, version_schema: 999, maj_le: JETON }, error: null } });

    expect(await lireEtatServeur(faux.client, UTILISATEUR)).toEqual({ statut: "versionInattendue", attendue: SCHEMA_VERSION_DONNEES, recue: 999, jeton: JETON });
  });

  it("un profil bien formé mais INCOHÉRENT est accepté à la lecture — le schéma d'écriture, lui, le refuse", async () => {
    // LA distinction qui empêche un faux « données perdues » : une règle de cohérence ajoutée après
    // coup ne doit jamais rendre illisible un état déjà enregistré (cf. lib/coherenceProfil.ts). Une
    // réadmission sans date anniversaire passe la FORME (`z.string()` accepte "") et échoue la
    // COHÉRENCE.
    const incoherent: DonneesApp = { ...creerDonneesVides(), profil: profil({ situation: "readmission", dateAnniversaire: "" }) };
    const faux = fauxClient({ lecture: { data: { donnees: incoherent, version_schema: SCHEMA_VERSION_DONNEES, maj_le: JETON }, error: null } });

    expect((await lireEtatServeur(faux.client, UTILISATEUR)).statut).toBe("lu");
    // Le même contenu par le chemin d'ÉCRITURE : refusé. Les deux chemins sont bien distincts, et
    // c'est ce test qui l'atteste — pas seulement un commentaire.
    expect(() => importerJSON(exporterJSON(incoherent))).toThrow();
  });

  it("`maj_le` absent ou inexploitable : « echec » — pas de jeton fabriqué, donc pas de faux verrou", async () => {
    for (const majLe of [undefined, null, 42, ""]) {
      const faux = fauxClient({ lecture: { data: { donnees: DONNEES, version_schema: SCHEMA_VERSION_DONNEES, maj_le: majLe }, error: null } });
      const etat = await lireEtatServeur(faux.client, UTILISATEUR);
      expect(etat.statut).toBe("echec");
    }
  });

  it("erreur du serveur : « echec », avec le message — jamais confondu avec « absente »", async () => {
    const faux = fauxClient({ lecture: { data: null, error: { message: "JWT expired" } } });
    expect(await lireEtatServeur(faux.client, UTILISATEUR)).toEqual({ statut: "echec", message: "JWT expired" });
  });

  it("panne réseau (la bibliothèque lève) : « echec », et la fonction ne lève pas", async () => {
    const faux = fauxClient({ lecture: new Error("Failed to fetch") });
    expect(await lireEtatServeur(faux.client, UTILISATEUR)).toEqual({ statut: "echec", message: "Failed to fetch" });
  });
});

describe("ecrireEtatServeur — première écriture (aucune ligne encore)", () => {
  it("insère (et n'« upsert » pas) : une ligne apparue entre-temps ne peut donc pas être écrasée", async () => {
    const faux = fauxClient();
    await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, null);

    expect(faux.chargesInserees).toHaveLength(1);
    expect(faux.chargesModifiees).toHaveLength(0);
    const charge = faux.chargesInserees[0];
    expect(charge.user_id).toBe(UTILISATEUR);
    expect(charge.donnees).toEqual(DONNEES);
    expect(charge.version_schema).toBe(SCHEMA_VERSION_DONNEES);
    // `maj_le` n'est JAMAIS envoyé : c'est le trigger serveur qui l'écrit. L'envoyer laisserait le
    // navigateur décider de l'ordre des écritures, ce que le schéma refuse explicitement.
    expect(charge).not.toHaveProperty("maj_le");
  });

  it("succès : « ecrit », avec le jeton de la nouvelle version", async () => {
    const faux = fauxClient({ insertion: { data: [{ maj_le: JETON }], error: null } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, null)).toEqual({ statut: "ecrit", jeton: JETON });
  });

  it("la ligne existait déjà (23505) : « conflit » — quelqu'un a téléversé avant nous", async () => {
    const faux = fauxClient({ insertion: { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, null)).toEqual({ statut: "conflit" });
  });

  it("autre erreur : « echec » — un conflit et une panne ne mènent pas au même écran", async () => {
    const faux = fauxClient({ insertion: { data: null, error: { message: "row-level security", code: "42501" } } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, null)).toEqual({ statut: "echec", message: "row-level security" });
  });

  it("écrit mais sans jeton rendu : « ecritJetonPerdu », et SURTOUT pas « echec »", async () => {
    const faux = fauxClient({ insertion: { data: [], error: null } });
    // L'insertion a réussi : annoncer un échec inviterait à refaire une écriture déjà faite.
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, null)).toEqual({ statut: "ecritJetonPerdu" });
  });
});

describe("ecrireEtatServeur — le verrou entre appareils", () => {
  it("écrit sous condition : filtre sur l'utilisateur ET sur la version attendue", async () => {
    const faux = fauxClient();
    await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON);

    expect(faux.chargesInserees).toHaveLength(0);
    expect(faux.chargesModifiees).toHaveLength(1);
    // Les deux filtres, dans cet ordre : sans le second, l'écriture serait aveugle.
    expect(faux.filtresModification).toEqual([
      ["user_id", UTILISATEUR],
      ["maj_le", JETON],
    ]);
  });

  it("une ligne touchée : « ecrit », avec le jeton de la version suivante", async () => {
    const faux = fauxClient({ modification: { data: [{ maj_le: JETON_SUIVANT }], error: null } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "ecrit", jeton: JETON_SUIVANT });
  });

  it("ZÉRO ligne touchée : « conflit » — le serveur ne porte plus la version annoncée, on n'écrit pas", async () => {
    const faux = fauxClient({ modification: { data: [], error: null } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "conflit" });
  });

  it("réponse sans tableau : « conflit » aussi — dans le doute, on ne force jamais l'écriture", async () => {
    const faux = fauxClient({ modification: { data: null, error: null } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "conflit" });
  });

  it("erreur du serveur : « echec », l'état serveur est intact", async () => {
    const faux = fauxClient({ modification: { data: null, error: { message: "JWT expired" } } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "echec", message: "JWT expired" });
  });

  it("panne réseau (la bibliothèque lève) : « echec », et la fonction ne lève pas", async () => {
    const faux = fauxClient({ modification: new Error("Failed to fetch") });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "echec", message: "Failed to fetch" });
  });

  it("modifié mais sans jeton rendu : « ecritJetonPerdu » — il faudra relire avant d'écrire encore", async () => {
    const faux = fauxClient({ modification: { data: [{}], error: null } });
    expect(await ecrireEtatServeur(faux.client, UTILISATEUR, DONNEES, JETON)).toEqual({ statut: "ecritJetonPerdu" });
  });
});
