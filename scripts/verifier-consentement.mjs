#!/usr/bin/env node
/**
 * PREUVE DE LA TABLE `consentements` — migration 0004, demandée par Benoît le 06/08/2026.
 *
 * ⚠️ À LANCER APRÈS AVOIR COLLÉ `supabase/migrations/0004_consentements.sql` DANS L'ÉDITEUR SQL.
 * Tant que ce n'est pas fait, ce script échoue au premier contrôle et le dit explicitement.
 *
 * CE QU'IL PROUVE, et que les tests unitaires ne peuvent pas prouver :
 *  1. la table existe et accepte une preuve pour soi-même ;
 *  2. `unique (user_id, version_texte)` renvoie bien 23505 sur un doublon — c'est ce code qui permet à
 *     `synchroniserConsentement` de traiter une course entre deux appareils comme un succès ;
 *  3. ⚠️ LE CONTRÔLE CENTRAL — LA PREUVE EST INALTÉRABLE PAR SON PROPRE SUJET. Aucune politique RLS
 *     `update` ni `delete` n'existe sur cette table (seule du schéma dans ce cas). Un `update` et un
 *     `delete` sont donc tentés ICI, et doivent tous deux ÉCHOUER ou n'affecter AUCUNE ligne. Si l'un
 *     des deux réussit, la table ne prouve plus rien et ce script doit crier.
 *
 * ⚠️⚠️ CE SCRIPT LAISSE UNE LIGNE DERRIÈRE LUI, ET C'EST INÉVITABLE — c'est même la démonstration :
 * il ne PEUT PAS nettoyer, puisque supprimer sa propre preuve est précisément ce que la table
 * interdit. Contrairement aux quatre autres scripts `verifier:*`, il n'y a donc pas de nettoyage. La
 * ligne porte une version reconnaissable (`TEST-VERIFICATION-<pid>`), jamais une vraie version de
 * texte, et le script affiche à la fin le SQL exact pour l'effacer depuis le tableau de bord.
 * Aucun autre script n'en est gêné : les gardes de `verifier-documents.mjs` et
 * `verifier-frais-reels.mjs` portent sur `documents` et le bucket, pas sur `consentements`.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE = "consentements";

const URL_SUPABASE = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const COMPTE = {
  email: process.env.SUPABASE_TEST_A_EMAIL ?? "",
  motDePasse: process.env.SUPABASE_TEST_A_PASSWORD ?? "",
};

if (!URL_SUPABASE || !CLE_ANON || !COMPTE.email || !COMPTE.motDePasse) {
  console.error(`
Configuration manquante (mêmes variables que \`npm run verifier:rls\`), dans le .env du dépôt
(C:\\Users\\benoi\\cadence\\.env — PAS le dossier OneDrive du même nom) :

  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_TEST_A_EMAIL, SUPABASE_TEST_A_PASSWORD
`);
  process.exit(2);
}

const resultats = [];
function noter(intitule, reussi, detail = "") {
  resultats.push({ intitule, reussi });
  const etiquette = reussi ? "\x1b[32mOK   \x1b[0m" : "\x1b[31mÉCHEC\x1b[0m";
  console.log(`[${etiquette}] ${intitule}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}`);
  console.log(`Compte de test : ${COMPTE.email}\n`);

  const client = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: connexion, error: erreurConnexion } = await client.auth.signInWithPassword({ email: COMPTE.email, password: COMPTE.motDePasse });
  if (erreurConnexion || !connexion?.session) {
    console.error(`\nConnexion impossible (${COMPTE.email}) : ${erreurConnexion?.message ?? "aucune session"}\n`);
    process.exit(2);
  }
  const utilisateurId = connexion.session.user.id;
  console.log(`Utilisateur : ${utilisateurId}\n`);

  const version = `TEST-VERIFICATION-${process.pid}`;
  const accepteLe = "2026-08-06T09:30:00.000Z";

  // ── 1. La table existe et accepte une preuve pour soi-même ────────────────────────────────────
  const { error: erreurInsertion } = await client.from(TABLE).insert({ user_id: utilisateurId, version_texte: version, accepte_le: accepteLe });
  if (erreurInsertion && /does not exist|schema cache/i.test(erreurInsertion.message)) {
    console.error(`\nLa table « ${TABLE} » n'existe pas : la migration 0004 n'a pas été appliquée.`);
    console.error(`Colle supabase/migrations/0004_consentements.sql dans l'éditeur SQL de Supabase, puis relance.\n`);
    console.error(`(Message d'origine : ${erreurInsertion.message})\n`);
    process.exit(2);
  }
  noter("une preuve s'insère pour soi-même", !erreurInsertion, erreurInsertion?.message ?? "");
  if (erreurInsertion) process.exit(1);

  // ── 2. `accepte_le` est conservé TEL QUEL, pas remplacé par now() ─────────────────────────────
  const { data: relu } = await client.from(TABLE).select("version_texte, accepte_le, enregistre_le").eq("user_id", utilisateurId);
  const ligne = (relu ?? []).find((l) => l.version_texte === version);
  noter("la ligne est relisible par son propre sujet (droit d'accès)", Boolean(ligne), ligne ? "" : "ligne introuvable");
  noter(
    "`accepte_le` conserve l'instant du CLIC, pas celui de la recopie",
    ligne ? new Date(ligne.accepte_le).toISOString() === accepteLe : false,
    ligne ? `accepte_le = ${ligne.accepte_le} · enregistre_le = ${ligne.enregistre_le}` : "",
  );

  // ── 3. Un doublon rend bien 23505 ─────────────────────────────────────────────────────────────
  const { error: erreurDoublon } = await client.from(TABLE).insert({ user_id: utilisateurId, version_texte: version, accepte_le: accepteLe });
  noter(
    "un doublon (user_id, version_texte) rend le code 23505",
    erreurDoublon?.code === "23505",
    erreurDoublon ? `code reçu : ${erreurDoublon.code}` : "⚠️ AUCUNE erreur : la contrainte d'unicité manque",
  );

  // ── 4. LE CONTRÔLE CENTRAL : la preuve est inaltérable par son sujet ──────────────────────────
  const { data: apresUpdate, error: erreurUpdate } = await client
    .from(TABLE)
    .update({ version_texte: "FALSIFIE", accepte_le: "1999-01-01T00:00:00.000Z" })
    .eq("user_id", utilisateurId)
    .select("id");
  // Sans politique `update`, RLS ne lève pas forcément : elle rend simplement l'ensemble vide. Les
  // deux formes sont acceptables — ce qui ne l'est pas, c'est qu'une ligne ait été modifiée.
  noter(
    "MODIFIER sa propre preuve est refusé (aucune politique update)",
    Boolean(erreurUpdate) || (apresUpdate ?? []).length === 0,
    erreurUpdate ? `refus explicite : ${erreurUpdate.message}` : `${(apresUpdate ?? []).length} ligne(s) modifiée(s)`,
  );

  const { data: apresDelete, error: erreurDelete } = await client.from(TABLE).delete().eq("user_id", utilisateurId).select("id");
  noter(
    "SUPPRIMER sa propre preuve est refusé (aucune politique delete)",
    Boolean(erreurDelete) || (apresDelete ?? []).length === 0,
    erreurDelete ? `refus explicite : ${erreurDelete.message}` : `${(apresDelete ?? []).length} ligne(s) supprimée(s)`,
  );

  // ── 5. Après ces deux tentatives, la ligne est TOUJOURS là, intacte ───────────────────────────
  const { data: apresTout } = await client.from(TABLE).select("version_texte, accepte_le").eq("user_id", utilisateurId);
  const intacte = (apresTout ?? []).find((l) => l.version_texte === version);
  noter(
    "après tentatives de falsification et de suppression, la preuve est INTACTE",
    Boolean(intacte) && new Date(intacte?.accepte_le ?? 0).toISOString() === accepteLe,
    intacte ? "" : "⚠️ la ligne a disparu ou a été modifiée",
  );

  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${resultats.length - echecs.length} contrôle(s) conforme(s) sur ${resultats.length}.`);

  console.log(`
⚠️ CE SCRIPT NE NETTOIE PAS, ET C'EST LA DÉMONSTRATION MÊME : il ne peut pas supprimer sa propre
preuve. Pour retirer la ligne de test, depuis l'éditeur SQL de Supabase (qui contourne RLS) :

  delete from public.consentements where version_texte = '${version}';
`);

  if (echecs.length > 0) {
    console.log("LA PREUVE N'EN EST PAS UNE :");
    for (const e of echecs) console.log(`  · ${e.intitule}`);
    process.exit(1);
  }
  console.log("LA TABLE TIENT SES PROMESSES : la preuve s'écrit une fois, se relit, et son sujet ne\npeut ni la modifier ni la supprimer.\n");
}

main().catch((incident) => {
  console.error(`\nInterrompu : ${incident?.message ?? incident}\n`);
  process.exit(1);
});
