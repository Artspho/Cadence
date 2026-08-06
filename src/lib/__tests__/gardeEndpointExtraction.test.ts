// Tests de la garde de `/api/extract-document` (point 8).
//
// Ce qui est réellement en jeu ici : la facture Mistral. Un test qui passerait « par construction »
// ne vaudrait rien, donc chaque refus est vérifié avec son STATUT, et la limite de taille est
// vérifiée de part et d'autre du seuil, pas seulement très au-dessus.
//
// ⚠️ Ces tests ne prouvent RIEN sur le quota : il n'existe pas encore (cf. l'en-tête de
// lib/gardeEndpointExtraction.ts, reporté sur demande explicite de Benoît). Ne pas lire une suite
// verte ici comme « le point 8 est clos ». L'authentification, elle, EST couverte depuis le
// 07/08/2026 (`verifierAuthentification`, tout en bas de ce fichier).

import { describe, expect, it, vi } from "vitest";
import { TAILLE_MAX_PDF_OCTETS } from "../fichierImportIA";
import {
  LONGUEUR_MAX_BASE64,
  ORIGINES_AUTORISEES_PAR_DEFAUT,
  lireOriginesAutorisees,
  origineAutorisee,
  tailleDocumentDepuisBase64,
  verifierAuthentification,
  verifierRequeteExtraction,
} from "../gardeEndpointExtraction";

const ORIGINE_LEGITIME = ORIGINES_AUTORISEES_PAR_DEFAUT[0];
const AUTORISEES = [...ORIGINES_AUTORISEES_PAR_DEFAUT];

/** Charge base64 bien formée de `octets` octets décodés — le remplissage suit la vraie règle. */
function chargeDe(octets: number): string {
  const longueur = Math.ceil(octets / 3) * 4;
  const remplissage = octets % 3 === 1 ? "==" : octets % 3 === 2 ? "=" : "";
  return "A".repeat(longueur - remplissage.length) + remplissage;
}

describe("le seuil serveur est dérivé du seuil client, pas saisi une seconde fois", () => {
  it("LONGUEUR_MAX_BASE64 correspond exactement à TAILLE_MAX_PDF_OCTETS encodés", () => {
    expect(LONGUEUR_MAX_BASE64).toBe(Math.ceil(TAILLE_MAX_PDF_OCTETS / 3) * 4);
    // Le seuil client est un multiple de 3 : l'encodage est donc sans remplissage, et l'aller-retour
    // taille → base64 → taille est exact. Si quelqu'un change TAILLE_MAX_PDF_OCTETS pour une valeur
    // non multiple de 3, ce test le signale au lieu de laisser passer une dérive de quelques octets.
    expect(tailleDocumentDepuisBase64(chargeDe(TAILLE_MAX_PDF_OCTETS))).toBe(TAILLE_MAX_PDF_OCTETS);
  });

  it("déduit la taille décodée en tenant compte du remplissage", () => {
    expect(tailleDocumentDepuisBase64("QQ==")).toBe(1);
    expect(tailleDocumentDepuisBase64("QUE=")).toBe(2);
    expect(tailleDocumentDepuisBase64("QUJD")).toBe(3);
  });
});

describe("contrôle d'origine", () => {
  it("accepte l'origine canonique du projet", () => {
    expect(origineAutorisee(ORIGINE_LEGITIME, AUTORISEES)).toBe(true);
  });

  it("accepte la même origine avec une barre oblique finale (recopiée depuis la barre d'adresse)", () => {
    expect(origineAutorisee(`${ORIGINE_LEGITIME}/`, AUTORISEES)).toBe(true);
  });

  it("accepte localhost sur n'importe quel port, en http", () => {
    expect(origineAutorisee("http://localhost:5173", AUTORISEES)).toBe(true);
    expect(origineAutorisee("http://localhost:4173", AUTORISEES)).toBe(true);
    expect(origineAutorisee("http://127.0.0.1:5173", AUTORISEES)).toBe(true);
  });

  it("refuse une origine inconnue, une origine absente, et une origine vide", () => {
    expect(origineAutorisee("https://site-de-quelquun-dautre.example", AUTORISEES)).toBe(false);
    expect(origineAutorisee(null, AUTORISEES)).toBe(false);
    expect(origineAutorisee("", AUTORISEES)).toBe(false);
  });

  it("ne se laisse pas berner par une origine qui CONTIENT l'origine autorisée", () => {
    // Le piège classique d'un contrôle écrit avec `includes` au lieu d'une égalité.
    expect(origineAutorisee(`https://cadence-git-master-benoit3.vercel.app.attaquant.example`, AUTORISEES)).toBe(false);
    expect(origineAutorisee(`https://evil-cadence-git-master-benoit3.vercel.app`, AUTORISEES)).toBe(false);
  });

  it("refuse localhost en https ou avec un chemin — l'expression n'est pas approximative", () => {
    expect(origineAutorisee("https://localhost:5173", AUTORISEES)).toBe(false);
    expect(origineAutorisee("http://localhost:5173/api", AUTORISEES)).toBe(false);
    expect(origineAutorisee("http://localhost.attaquant.example", AUTORISEES)).toBe(false);
  });
});

describe("lecture de la liste d'origines", () => {
  it("retombe sur le défaut quand la variable est absente, vide, ou ne contient que des séparateurs", () => {
    expect(lireOriginesAutorisees(undefined)).toEqual([...ORIGINES_AUTORISEES_PAR_DEFAUT]);
    expect(lireOriginesAutorisees("")).toEqual([...ORIGINES_AUTORISEES_PAR_DEFAUT]);
    expect(lireOriginesAutorisees("  ,  , ")).toEqual([...ORIGINES_AUTORISEES_PAR_DEFAUT]);
  });

  it("lit plusieurs origines, en retirant les espaces et les barres obliques finales", () => {
    expect(lireOriginesAutorisees("https://a.example/, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("une liste déclarée REMPLACE le défaut (elle ne s'y ajoute pas)", () => {
    // Sinon on ne pourrait jamais retirer l'origine par défaut, ce qui est exactement ce qu'il
    // faudra faire si l'URL canonique du projet change.
    expect(lireOriginesAutorisees("https://a.example")).toEqual(["https://a.example"]);
  });
});

describe("verdict complet, dans l'ordre voulu", () => {
  it("laisse passer une requête légitime de taille normale", () => {
    const verdict = verifierRequeteExtraction({
      origine: ORIGINE_LEGITIME,
      pdfBase64: chargeDe(1024),
      originesAutorisees: AUTORISEES,
    });
    expect(verdict).toEqual({ ok: true });
  });

  it("refuse une origine étrangère en 403, AVANT même de regarder la charge", () => {
    // La charge est ici volontairement énorme ET absente de type valide : si le verdict était
    // 413 ou 400, cela prouverait que l'origine n'est pas contrôlée en premier — donc qu'un
    // appelant non autorisé fait travailler le serveur avant d'être refusé.
    const verdict = verifierRequeteExtraction({
      origine: "https://site-de-quelquun-dautre.example",
      pdfBase64: 12345,
      originesAutorisees: AUTORISEES,
    });
    expect(verdict).toEqual({
      ok: false,
      statut: 403,
      erreur: "Cette requête ne vient pas d'une origine autorisée. Rien n'a été envoyé.",
    });
  });

  it("refuse une charge absente, vide, ou d'un autre type, en 400", () => {
    for (const pdfBase64 of [undefined, null, "", 42, {}, []]) {
      const verdict = verifierRequeteExtraction({ origine: ORIGINE_LEGITIME, pdfBase64, originesAutorisees: AUTORISEES });
      expect(verdict).toEqual({ ok: false, statut: 400, erreur: "pdfBase64 manquant" });
    }
  });

  it("accepte EXACTEMENT la limite et refuse le premier caractère au-delà, en 413", () => {
    const aLaLimite = verifierRequeteExtraction({
      origine: ORIGINE_LEGITIME,
      pdfBase64: "A".repeat(LONGUEUR_MAX_BASE64),
      originesAutorisees: AUTORISEES,
    });
    expect(aLaLimite).toEqual({ ok: true });

    const unDeTrop = verifierRequeteExtraction({
      origine: ORIGINE_LEGITIME,
      pdfBase64: "A".repeat(LONGUEUR_MAX_BASE64 + 1),
      originesAutorisees: AUTORISEES,
    });
    expect(unDeTrop.ok).toBe(false);
    if (unDeTrop.ok) throw new Error("inatteignable");
    expect(unDeTrop.statut).toBe(413);
  });

  it("annonce la taille reçue et la limite, en mégaoctets, sans jamais citer le document", () => {
    const dixMo = chargeDe(10 * 1024 * 1024);
    const verdict = verifierRequeteExtraction({
      origine: ORIGINE_LEGITIME,
      pdfBase64: dixMo,
      originesAutorisees: AUTORISEES,
    });
    if (verdict.ok) throw new Error("un document de 10 Mo devait être refusé");
    expect(verdict.erreur).toContain("10,0 Mo");
    expect(verdict.erreur).toContain("3,0 Mo");
    expect(verdict.erreur).toContain("Rien n'a été envoyé");
    // Aucun fragment de la charge dans le message.
    expect(verdict.erreur).not.toContain("AAAA");
  });

  it("le contournement que le point 8 décrivait est fermé : 10 Mo par une origine légitime sont refusés côté serveur", () => {
    // C'est LE test qui porte le point : la limite de 3 Mo n'existait que dans le navigateur, donc
    // un appelant qui ne passe pas par le navigateur l'ignorait entièrement.
    const verdict = verifierRequeteExtraction({
      origine: ORIGINE_LEGITIME,
      pdfBase64: chargeDe(10 * 1024 * 1024),
      originesAutorisees: AUTORISEES,
    });
    expect(verdict.ok).toBe(false);
  });
});

describe("verifierAuthentification — la VRAIE serrure (point 8, 07/08/2026)", () => {
  const URL_SUPABASE = "https://exemple.supabase.co";
  const CLE_ANON = "cle-anon-test";

  /** Simule la réponse de `GET {url}/auth/v1/user` sans jamais appeler le vrai serveur Supabase. */
  function fauxSupabase(statut: number, corps: unknown, corpsIllisible = false) {
    return vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: statut >= 200 && statut < 300,
      status: statut,
      json: async () => {
        if (corpsIllisible) throw new Error("corps non-JSON");
        return corps;
      },
    }));
  }

  it("refuse SANS appeler Supabase quand l'en-tête Authorization est absent — un scanner anonyme n'a rien à présenter", async () => {
    const appelerSupabase = fauxSupabase(200, { id: "u-1" });
    const verdict = await verifierAuthentification(null, URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
    expect(appelerSupabase).not.toHaveBeenCalled();
  });

  it("refuse un en-tête qui ne porte pas le schéma Bearer", async () => {
    const appelerSupabase = fauxSupabase(200, { id: "u-1" });
    const verdict = await verifierAuthentification("jeton-sans-bearer", URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
    expect(appelerSupabase).not.toHaveBeenCalled();
  });

  it("accepte un jeton que Supabase valide, et rend l'identifiant de l'utilisateur", async () => {
    const appelerSupabase = fauxSupabase(200, { id: "u-42" });
    const verdict = await verifierAuthentification("Bearer jeton-valide", URL_SUPABASE, CLE_ANON, appelerSupabase);
    expect(verdict).toEqual({ ok: true, utilisateurId: "u-42" });
    // Le jeton envoyé à Supabase est celui reçu, PAS l'en-tête brut (sans le préfixe « Bearer »
    // redoublé) — et la clé anon voyage dans `apikey`, jamais dans le jeton lui-même.
    const [url, options] = appelerSupabase.mock.calls[0];
    expect(url).toBe(`${URL_SUPABASE}/auth/v1/user`);
    expect((options as RequestInit).headers).toEqual({ Authorization: "Bearer jeton-valide", apikey: CLE_ANON });
  });

  it("refuse un jeton que Supabase rejette (expiré ou révoqué)", async () => {
    const appelerSupabase = fauxSupabase(401, { message: "invalid JWT" });
    const verdict = await verifierAuthentification("Bearer jeton-expire", URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
  });

  it("refuse proprement une réponse Supabase illisible, sans laisser fuiter une erreur technique", async () => {
    const appelerSupabase = fauxSupabase(200, null, true);
    const verdict = await verifierAuthentification("Bearer jeton-valide", URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
  });

  it("refuse un corps sans identifiant exploitable, même sur un 200", async () => {
    const appelerSupabase = fauxSupabase(200, { pas_d_id: true });
    const verdict = await verifierAuthentification("Bearer jeton-valide", URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
  });

  it("refuse un échec réseau vers Supabase comme une session invalide, pas comme un crash", async () => {
    const appelerSupabase = vi.fn(async (_url: string, _init: RequestInit) => {
      throw new TypeError("Failed to fetch");
    });
    const verdict = await verifierAuthentification("Bearer jeton-valide", URL_SUPABASE, CLE_ANON, appelerSupabase);
    if (verdict.ok) throw new Error("devrait être refusé");
    expect(verdict.statut).toBe(401);
  });

  it("rend 503 (configuration serveur, pas la faute de l'appelant) quand l'URL ou la clé Supabase manquent", async () => {
    const appelerSupabase = fauxSupabase(200, { id: "u-1" });
    const sansUrl = await verifierAuthentification("Bearer jeton-valide", "", CLE_ANON, appelerSupabase);
    const sansCle = await verifierAuthentification("Bearer jeton-valide", URL_SUPABASE, "", appelerSupabase);
    if (sansUrl.ok || sansCle.ok) throw new Error("devrait être refusé");
    expect(sansUrl.statut).toBe(503);
    expect(sansCle.statut).toBe(503);
    expect(appelerSupabase).not.toHaveBeenCalled();
  });
});
