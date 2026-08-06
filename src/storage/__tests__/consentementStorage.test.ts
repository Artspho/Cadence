// La preuve du consentement à la politique de confidentialité (06/08/2026, demandée par Benoît).
//
// Ce que ces tests verrouillent avant tout : la preuve n'est JAMAIS inventée. Un compte sans
// métadonnée (créé avant cette date, ou par lien magique quand ce chemin créait encore des comptes)
// ne doit produire AUCUNE ligne — écrire la date du jour donnerait une preuve fausse, ce qui est pire
// que pas de preuve du tout.
import { describe, expect, it, vi } from "vitest";
import {
  CLE_METADONNEE_CONSENTEMENT,
  TABLE_CONSENTEMENTS,
  consentementDejaEnregistre,
  consentementDepuisMetadonnees,
  metadonneeConsentement,
  synchroniserConsentement,
} from "../consentementStorage";
import type { ClientAuth, ClientConsentements, ErreurPostgrest } from "../../auth/supabaseClient";

const VERSION = "2026-08-05";
const INSTANT = "2026-08-06T09:30:00.000Z";
const UTILISATEUR = "u-42";

/** Faux client `consentements` : enregistre les appels et rend ce qu'on lui dit. */
function fauxClientConsentements(options: { lignes?: Record<string, unknown>[]; erreurLecture?: ErreurPostgrest; erreurInsertion?: ErreurPostgrest } = {}) {
  const insertions: Record<string, unknown>[] = [];
  const tablesVues: string[] = [];
  const client: ClientConsentements = {
    from(table: string) {
      tablesVues.push(table);
      return {
        select: () => ({
          eq: async () => ({ data: options.lignes ?? [], error: options.erreurLecture ?? null }),
        }),
        insert: async (ligne: Record<string, unknown>) => {
          insertions.push(ligne);
          return { data: null, error: options.erreurInsertion ?? null };
        },
      };
    },
  };
  return { client, insertions, tablesVues };
}

function fauxClientAuth(metadonnees?: Record<string, unknown>, erreur?: { message: string }): ClientAuth {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () =>
      erreur
        ? { data: { user: null }, error: erreur }
        : { data: { user: { id: UTILISATEUR, email: "benoit@example.com", user_metadata: metadonnees } }, error: null },
    ),
  };
}

const METADONNEE_VALIDE = { [CLE_METADONNEE_CONSENTEMENT]: { version: VERSION, accepte_le: INSTANT } };

describe("metadonneeConsentement", () => {
  it("porte la version du texte ET l'instant du clic, en ISO", () => {
    const metadonnee = metadonneeConsentement(VERSION, () => new Date(INSTANT));
    expect(metadonnee).toEqual({ [CLE_METADONNEE_CONSENTEMENT]: { version: VERSION, accepte_le: INSTANT } });
  });
});

describe("consentementDepuisMetadonnees — se méfier de tout ce qui vient du serveur", () => {
  it("relit une métadonnée valide", () => {
    expect(consentementDepuisMetadonnees(METADONNEE_VALIDE)).toEqual({ version: VERSION, accepteLe: INSTANT });
  });

  it("rend null quand il n'y a pas de métadonnée du tout (compte antérieur au 06/08/2026)", () => {
    expect(consentementDepuisMetadonnees(undefined)).toBeNull();
    expect(consentementDepuisMetadonnees({})).toBeNull();
  });

  it("rend null sur une forme inattendue plutôt qu'un objet partiel", () => {
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: "oui" })).toBeNull();
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: null })).toBeNull();
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: { version: VERSION } })).toBeNull();
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: { accepte_le: INSTANT } })).toBeNull();
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: { version: "", accepte_le: INSTANT } })).toBeNull();
  });

  it("rend null sur une DATE ILLISIBLE — mieux vaut aucune ligne qu'une ligne fausse", () => {
    expect(consentementDepuisMetadonnees({ [CLE_METADONNEE_CONSENTEMENT]: { version: VERSION, accepte_le: "hier" } })).toBeNull();
  });
});

describe("consentementDejaEnregistre — « une seule fois suffit »", () => {
  it("trouve la preuve quand la version correspond", async () => {
    const { client } = fauxClientConsentements({ lignes: [{ version_texte: VERSION }] });
    expect(await consentementDejaEnregistre(client, UTILISATEUR, VERSION)).toEqual({ present: true });
  });

  it("ne la trouve PAS quand seule une version ANTÉRIEURE est présente — le texte a changé, il faut reconsentir", async () => {
    const { client } = fauxClientConsentements({ lignes: [{ version_texte: "2026-01-01" }] });
    expect(await consentementDejaEnregistre(client, UTILISATEUR, VERSION)).toEqual({ present: false });
  });

  it("remonte l'erreur du serveur au lieu de conclure « absent »", async () => {
    const { client } = fauxClientConsentements({ erreurLecture: { message: "relation \"consentements\" does not exist" } });
    expect(await consentementDejaEnregistre(client, UTILISATEUR, VERSION)).toEqual({ erreur: 'relation "consentements" does not exist' });
  });
});

describe("synchroniserConsentement — la recopie en preuve durable", () => {
  it("écrit la ligne dans la bonne table, avec l'instant DU CLIC et non celui de la recopie", async () => {
    const { client, insertions, tablesVues } = fauxClientConsentements();
    const resultat = await synchroniserConsentement(fauxClientAuth(METADONNEE_VALIDE), client);

    expect(resultat).toEqual({ statut: "enregistre", version: VERSION });
    expect(tablesVues).toContain(TABLE_CONSENTEMENTS);
    expect(insertions).toHaveLength(1);
    expect(insertions[0]).toEqual({ user_id: UTILISATEUR, version_texte: VERSION, accepte_le: INSTANT });
    // Le point qui compte : `accepte_le` est l'instant du clic. Dater du jour de la recopie serait
    // écrire une date fausse (cf. l'avertissement de la migration 0004).
    expect(insertions[0].accepte_le).toBe(INSTANT);
  });

  it("N'INVENTE RIEN quand aucune métadonnée n'existe — aucune insertion du tout", async () => {
    const { client, insertions } = fauxClientConsentements();
    expect(await synchroniserConsentement(fauxClientAuth(undefined), client)).toEqual({ statut: "aucuneMetadonnee" });
    expect(insertions).toHaveLength(0);
  });

  it("n'écrit pas deux fois : la preuve déjà présente suffit", async () => {
    const { client, insertions } = fauxClientConsentements({ lignes: [{ version_texte: VERSION }] });
    expect(await synchroniserConsentement(fauxClientAuth(METADONNEE_VALIDE), client)).toEqual({ statut: "enregistre", version: VERSION });
    expect(insertions).toHaveLength(0);
  });

  it("traite 23505 (course entre deux appareils) comme un SUCCÈS — la preuve est en base", async () => {
    const { client } = fauxClientConsentements({ erreurInsertion: { message: "duplicate key value", code: "23505" } });
    expect(await synchroniserConsentement(fauxClientAuth(METADONNEE_VALIDE), client)).toEqual({ statut: "enregistre", version: VERSION });
  });

  it("remonte un échec RÉEL sans prétendre avoir enregistré", async () => {
    const { client } = fauxClientConsentements({ erreurInsertion: { message: "permission denied for table consentements", code: "42501" } });
    expect(await synchroniserConsentement(fauxClientAuth(METADONNEE_VALIDE), client)).toEqual({
      statut: "echec",
      message: "permission denied for table consentements",
    });
  });

  it("remonte l'échec de lecture de l'utilisateur", async () => {
    const { client, insertions } = fauxClientConsentements();
    expect(await synchroniserConsentement(fauxClientAuth(undefined, { message: "Failed to fetch" }), client)).toEqual({ statut: "echec", message: "Failed to fetch" });
    expect(insertions).toHaveLength(0);
  });

  it("ne lève jamais, même si le client explose", async () => {
    const clientCasse: ClientConsentements = {
      from() {
        throw new Error("client cassé");
      },
    };
    // ⚠️ Un throw ici remonterait dans un useEffect d'App.tsx : l'archivage de la preuve deviendrait
    // une panne totale de Cadence, alors que le consentement a bien été donné.
    expect(await synchroniserConsentement(fauxClientAuth(METADONNEE_VALIDE), clientCasse)).toEqual({ statut: "echec", message: "client cassé" });
  });
});
