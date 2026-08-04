// Phase 3 de la refonte Supabase — la copie serveur.
//
// Ce que ces tests protègent, dans l'ordre d'importance : que la copie ne puisse JAMAIS faire échouer
// l'application (elle ne lève jamais), et qu'elle n'affirme JAMAIS un succès que Supabase n'a pas
// confirmé.
import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION_DONNEES, creerDonneesVides, type DonneesApp } from "../localStorageAdapter";
import { TABLE_DONNEES, copierDonneesVersSupabase } from "../miroirSupabase";
import type { ClientDonnees } from "../../auth/supabaseClient";

const UTILISATEUR = "2ed466db-a58b-4ec4-b73a-28a2a333b82d";
const HORLOGE = () => new Date("2026-08-04T18:55:00.000Z");

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

/** Faux client d'écriture : enregistre ce qu'on lui demande, renvoie ce que le test veut. */
function fauxClient(reponse: { error: { message: string } | null } | Error = { error: null }) {
  const upsert = vi.fn(async (ligne: Record<string, unknown>) => {
    if (reponse instanceof Error) throw reponse;
    void ligne;
    return reponse;
  });
  const from = vi.fn(() => ({ upsert }));
  return { client: { from } as unknown as ClientDonnees, from, upsert };
}

describe("copierDonneesVersSupabase — ce qui part vers le serveur", () => {
  it("écrit dans la bonne table, avec l'identifiant de la session et la version du schéma", async () => {
    const { client, from, upsert } = fauxClient();
    await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE);

    expect(from).toHaveBeenCalledWith(TABLE_DONNEES);
    const ligne = upsert.mock.calls[0][0];
    // `user_id` est fourni explicitement (l'upsert de PostgREST a besoin de la colonne de conflit).
    // La phase 1 a prouvé qu'un `user_id` usurpé est refusé en 403 : le fournir n'ouvre aucune porte.
    expect(ligne.user_id).toBe(UTILISATEUR);
    expect(ligne.donnees).toEqual(DONNEES);
    expect(ligne.version_schema).toBe(SCHEMA_VERSION_DONNEES);
  });

  it("rend l'horodatage de la CONFIRMATION, pas une date d'écriture supposée", async () => {
    const { client } = fauxClient();
    const resultat = await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE);
    expect(resultat).toEqual({ ok: true, horodatage: "2026-08-04T18:55:00.000Z" });
  });

  it("n'appelle QUE `upsert` — aucune lecture, jamais (règle de la phase 3)", async () => {
    // La garantie principale est dans le type `ClientDonnees`, qui n'expose aucun `select`. Ce test
    // vérifie l'autre moitié : qu'aucune autre méthode n'est sollicitée sur la table.
    const { client, from, upsert } = fauxClient();
    await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE);
    expect(from).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(Object.keys(from.mock.results[0].value)).toEqual(["upsert"]);
  });
});

describe("copierDonneesVersSupabase — les échecs, qui ne doivent jamais devenir des incidents", () => {
  it("rend l'erreur de Supabase telle quelle, sans prétendre au succès", async () => {
    const { client } = fauxClient({ error: { message: 'new row violates row-level security policy for table "donnees_utilisateur"' } });
    const resultat = await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE);
    expect(resultat.ok).toBe(false);
    expect(resultat).toEqual({ ok: false, message: expect.stringContaining("row-level security") });
  });

  it("NE LÈVE JAMAIS, même si le client explose (réseau coupé, serveur en pause)", async () => {
    // Le cas réel le plus probable : palier gratuit mis en pause après 7 jours d'inactivité
    // (arbitrage 4), ou simplement pas de réseau. Cadence doit continuer sans broncher.
    const { client } = fauxClient(new Error("TypeError: Failed to fetch"));
    const resultat = await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE);
    expect(resultat).toEqual({ ok: false, message: "TypeError: Failed to fetch" });
  });

  it("survit à un rejet qui n'est même pas une Error", async () => {
    const upsert = vi.fn(async () => Promise.reject("panne brute"));
    const client = { from: () => ({ upsert }) } as unknown as ClientDonnees;
    expect(await copierDonneesVersSupabase(client, UTILISATEUR, DONNEES, HORLOGE)).toEqual({ ok: false, message: "panne brute" });
  });
});
