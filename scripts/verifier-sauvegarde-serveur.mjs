#!/usr/bin/env node
/**
 * PREUVE DU FILET SERVEUR — livrable de la dette ouverte au commit D (phase 5, session 8, 05/08/2026).
 *
 * POURQUOI CE SCRIPT EXISTE, ET POURQUOI `verifier-rls.mjs` NE SUFFIT PAS. `verifier-rls.mjs` prouve
 * l'ISOLATION (B ne touche pas aux données de A) ; il n'exerce jamais un utilisateur qui met à jour
 * SA PROPRE ligne de `donnees_utilisateur` — donc il ne peut pas dire si le trigger de la migration
 * 0002 alimente réellement `donnees_sauvegarde`. Tant que ce script n'a pas tourné en vert contre le
 * vrai projet, la dette n'est PAS soldée, quel que soit l'état de `verifier:rls`.
 *
 * CE QU'IL PROUVE, PRÉCISÉMENT :
 *  1. une PREMIÈRE écriture (insert, rien à sauvegarder) NE crée AUCUNE ligne dans
 *     `donnees_sauvegarde` — le trigger ne doit réagir qu'à une mise à jour, jamais à une création ;
 *  2. après une PREMIÈRE mise à jour, `donnees_sauvegarde` porte le contenu D'AVANT cette mise à
 *     jour (v1), jamais celui qu'on vient d'écrire (v2) ;
 *  3. après une SECONDE mise à jour, `donnees_sauvegarde` a SUIVI : elle porte maintenant v2 (le
 *     contenu d'avant CETTE mise à jour-ci), pas v1 — la preuve que le filet n'est pas figé sur sa
 *     toute première copie ;
 *  4. `cree_le` AVANCE entre les deux sauvegardes — la preuve que la date n'est pas restée collée à
 *     l'instant de la création de la ligne, ce qui était précisément le défaut identifié dans la
 *     dette (`cree_le` sans trigger, réécrit explicitement dans la requête d'upsert).
 *
 * ⚠️ DEVOIR N°1 — CE SCRIPT ÉCRIT DANS LA BASE. Il refuse de démarrer si le compte visé possède déjà
 * une ligne dans `donnees_utilisateur` OU `donnees_sauvegarde`. C'est ce qui rend impossible de
 * l'exécuter par erreur sur le compte réel de Benoît. Il ne supprime que ce qu'il a créé lui-même.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE_DONNEES = "donnees_utilisateur";
const TABLE_SAUVEGARDE = "donnees_sauvegarde";

const URL_SUPABASE = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const COMPTE = {
  email: process.env.SUPABASE_TEST_A_EMAIL ?? "",
  motDePasse: process.env.SUPABASE_TEST_A_PASSWORD ?? "",
};

if (!URL_SUPABASE || !CLE_ANON || !COMPTE.email || !COMPTE.motDePasse) {
  console.error(`
Configuration manquante. Ce script a besoin de quatre variables, dans le .env du dépôt
(C:\\Users\\benoi\\cadence\\.env — PAS le dossier OneDrive du même nom) :

  VITE_SUPABASE_URL          https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY     la clé « anon » — JAMAIS la clé service_role, qui contourne RLS
  SUPABASE_TEST_A_EMAIL      le compte de TEST (jamais le compte réel : ce script écrit)
  SUPABASE_TEST_A_PASSWORD

Ce sont les mêmes que celles de \`npm run verifier:rls\` / \`npm run verifier:verrou\`.
`);
  process.exit(2);
}

function creerAppareil() {
  return createClient(URL_SUPABASE, CLE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function connecter(client) {
  const { data, error } = await client.auth.signInWithPassword({ email: COMPTE.email, password: COMPTE.motDePasse });
  if (error || !data?.session) {
    console.error(`\nConnexion impossible (${COMPTE.email}) : ${error?.message ?? "aucune session"}`);
    console.error("\nSi le message parle de confirmation d'e-mail : confirme le compte de test depuis\nAuthentication > Users, ou recrée-le avec « Auto Confirm User ».\n");
    process.exit(2);
  }
  return data.session.user.id;
}

const resultats = [];
function noter(intitule, reussi, detail = "") {
  resultats.push({ intitule, reussi });
  const etiquette = reussi ? "\x1b[32mOK   \x1b[0m" : "\x1b[31mÉCHEC\x1b[0m";
  console.log(`[${etiquette}] ${intitule}${detail ? ` — ${detail}` : ""}`);
}

/** État reconnaissable, pour prouver QUELLE version le filet porte. */
function etat(marqueur) {
  return { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {}, marqueur };
}

async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}`);
  console.log(`Compte de test : ${COMPTE.email}\n`);

  const client = creerAppareil();
  const utilisateurId = await connecter(client);
  console.log(`Utilisateur : ${utilisateurId}\n`);

  // ── Garde devoir n°1 : les DEUX tables doivent être vides pour ce compte ─────────────────────────
  const existanteDonnees = await client.from(TABLE_DONNEES).select("user_id").eq("user_id", utilisateurId).maybeSingle();
  const existanteSauvegarde = await client.from(TABLE_SAUVEGARDE).select("user_id").eq("user_id", utilisateurId).maybeSingle();
  if (existanteDonnees.error || existanteSauvegarde.error) {
    console.error(`\nLecture impossible. La migration 0002 est-elle appliquée ? (${existanteDonnees.error?.message ?? existanteSauvegarde.error?.message}) Arrêt.\n`);
    process.exit(2);
  }
  if (existanteDonnees.data || existanteSauvegarde.data) {
    console.error(
      "\nCe compte possède DÉJÀ une ligne dans « donnees_utilisateur » ou « donnees_sauvegarde ».\n" +
        "Ce script écrit et nettoie : il REFUSE de tourner sur un compte non vide, pour ne jamais\n" +
        "supprimer des données qu'il n'a pas créées (devoir n°1). Vérifie que SUPABASE_TEST_A_EMAIL\n" +
        "désigne bien un compte de TEST. Arrêt.\n"
    );
    process.exit(2);
  }
  console.log("Garde : les deux tables sont vides pour ce compte.\n");

  const marqueur = `sauvegarde-${process.pid}`;
  let ligneCreee = false;

  try {
    // ── Étape 1 : première écriture (insert) — rien à sauvegarder ────────────────────────────────
    const insertion = await client.from(TABLE_DONNEES).insert({ user_id: utilisateurId, donnees: etat(`${marqueur}-v1`), version_schema: 1 }).select("maj_le");
    const jeton1 = insertion.data?.[0]?.maj_le;
    ligneCreee = !insertion.error;
    noter("1. première écriture (insert) réussie", !insertion.error && typeof jeton1 === "string", insertion.error ? insertion.error.message : `maj_le = ${jeton1}`);
    if (!ligneCreee) throw new Error("impossible de créer la ligne de départ — la suite ne prouverait rien");

    // ── Étape 2 : CONTRÔLE NÉGATIF — l'insert seul ne doit créer AUCUNE sauvegarde ────────────────
    const apresInsert = await client.from(TABLE_SAUVEGARDE).select("*").eq("user_id", utilisateurId).maybeSingle();
    noter(
      "2. après un simple insert, « donnees_sauvegarde » reste ABSENTE (rien à sauvegarder)",
      !apresInsert.error && apresInsert.data === null,
      apresInsert.error ? apresInsert.error.message : apresInsert.data ? "⚠️ une ligne existe déjà — le trigger a réagi à un INSERT" : "absente, comme attendu"
    );

    // ── Étape 3 : première mise à jour (v1 → v2) ─────────────────────────────────────────────────
    const maj1 = await client.from(TABLE_DONNEES).update({ donnees: etat(`${marqueur}-v2`) }).eq("user_id", utilisateurId).eq("maj_le", jeton1).select("maj_le");
    const jeton2 = maj1.data?.[0]?.maj_le;
    noter("3. première mise à jour (v1 → v2) réussie", !maj1.error && maj1.data?.length === 1, maj1.error ? maj1.error.message : `nouveau maj_le = ${jeton2}`);

    // ── Étape 4 : LE FILET — la sauvegarde porte v1 (le contenu D'AVANT), jamais v2 ────────────────
    const sauvegarde1 = await client.from(TABLE_SAUVEGARDE).select("donnees, cree_le").eq("user_id", utilisateurId).maybeSingle();
    const marqueurSauvegarde1 = sauvegarde1.data?.donnees?.marqueur;
    noter(
      "4. LE FILET : après la mise à jour, la sauvegarde porte v1 (le contenu D'AVANT)",
      marqueurSauvegarde1 === `${marqueur}-v1`,
      sauvegarde1.error ? sauvegarde1.error.message : `sauvegarde = « ${marqueurSauvegarde1} »`
    );
    const creeLe1 = sauvegarde1.data?.cree_le;

    // ── Étape 5 : seconde mise à jour (v2 → v3) ──────────────────────────────────────────────────
    const maj2 = await client.from(TABLE_DONNEES).update({ donnees: etat(`${marqueur}-v3`) }).eq("user_id", utilisateurId).eq("maj_le", jeton2).select("maj_le");
    noter("5. seconde mise à jour (v2 → v3) réussie", !maj2.error && maj2.data?.length === 1, maj2.error ? maj2.error.message : `nouveau maj_le = ${maj2.data?.[0]?.maj_le}`);

    // ── Étape 6 : LE FILET SUIT — la sauvegarde porte maintenant v2, pas v1 ──────────────────────
    const sauvegarde2 = await client.from(TABLE_SAUVEGARDE).select("donnees, cree_le").eq("user_id", utilisateurId).maybeSingle();
    const marqueurSauvegarde2 = sauvegarde2.data?.donnees?.marqueur;
    noter(
      "6. LE FILET SUIT : après la seconde mise à jour, la sauvegarde porte v2, pas v1",
      marqueurSauvegarde2 === `${marqueur}-v2`,
      sauvegarde2.error ? sauvegarde2.error.message : `sauvegarde = « ${marqueurSauvegarde2} »`
    );

    // ── Étape 7 : `cree_le` AVANCE — pas une date figée sur la première sauvegarde ────────────────
    const creeLe2 = sauvegarde2.data?.cree_le;
    const dateAvance = typeof creeLe1 === "string" && typeof creeLe2 === "string" && new Date(creeLe2).getTime() > new Date(creeLe1).getTime();
    noter("7. « cree_le » avance entre les deux sauvegardes (pas une date périmée)", dateAvance, `${creeLe1} → ${creeLe2}`);
  } finally {
    // ── Nettoyage : uniquement ce que ce script a créé, dans les DEUX tables ─────────────────────
    const { error: erreurDonnees } = await client.from(TABLE_DONNEES).delete().eq("user_id", utilisateurId);
    const { error: erreurSauvegarde } = await client.from(TABLE_SAUVEGARDE).delete().eq("user_id", utilisateurId);
    if (erreurDonnees || erreurSauvegarde) {
      console.log(`\n⚠️ Nettoyage RATÉ (${erreurDonnees?.message ?? ""} ${erreurSauvegarde?.message ?? ""}) — supprime les lignes du compte de test à la main.`);
    } else {
      console.log("\nNettoyage : les lignes d'essai sont supprimées des deux tables.");
    }
  }

  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${resultats.length - echecs.length} contrôle(s) conforme(s) sur ${resultats.length}.`);
  if (echecs.length > 0) {
    console.log("\nLE FILET SERVEUR N'EST PAS PROUVÉ. La dette n'est PAS soldée :");
    for (const e of echecs) console.log(`  · ${e.intitule}`);
    process.exit(1);
  }
  console.log("\nLE FILET SERVEUR EST PROUVÉ : « donnees_sauvegarde » est alimentée automatiquement à\nchaque mise à jour, porte toujours le contenu D'AVANT, et sa date de sauvegarde avance.\n");
}

main().catch((incident) => {
  console.error(`\nInterrompu : ${incident?.message ?? incident}\n`);
  process.exit(1);
});
