#!/usr/bin/env node
/**
 * PREUVE DU VERROU ENTRE APPAREILS — livrable du commit B de la phase 5.
 *
 * POURQUOI CE SCRIPT EXISTE. `src/storage/sourceSupabase.ts` refuse d'écrire quand la version
 * attendue n'est plus celle du serveur. Ses tests unitaires prouvent qu'il DEMANDE cette condition ;
 * ils ne prouvent pas que Postgres la fait RESPECTER. Entre les deux il y a une hypothèse non
 * vérifiée : qu'un `maj_le` relu à la microseconde près soit comparable tel quel à travers l'API.
 * Tant que ce script n'a pas montré un refus à l'écran, le verrou est une intention, pas une
 * protection — et brancher la bascule dessus reviendrait à croire une garantie non mesurée.
 *
 * CE QU'IL PROUVE, ET CE QU'IL NE PROUVE PAS. Il exerce le vrai SDK contre le vrai projet, avec les
 * MÊMES chaînes d'appel que le module (`insert().select()`, `update().eq().eq().select()`) — mais ce
 * n'est pas littéralement le module qui tourne (pas de lanceur TypeScript dans le projet). La preuve
 * tient donc en deux morceaux qu'il faut lire ensemble : `sourceSupabase.test.ts` atteste que le
 * module appelle bien ces chaînes, ce script atteste que ces chaînes verrouillent.
 *
 * ⚠️ LE CONTRÔLE POSITIF DE L'ÉTAPE 4 N'EST PAS DÉCORATIF. « Zéro ligne modifiée » peut vouloir dire
 * « le verrou a joué » comme « ma requête était mal formée » (un `+` mal encodé dans un horodatage
 * suffirait). Sans une écriture conditionnelle qui RÉUSSIT avec le bon jeton, un script tout vert
 * prouverait l'inverse de ce qu'il annonce. C'est la même leçon que les contrôles positifs de
 * `verifier-rls.mjs`.
 *
 * ⚠️ DEVOIR N°1 — CE SCRIPT ÉCRIT DANS LA BASE. Il refuse de démarrer si le compte visé possède déjà
 * une ligne de données. C'est ce qui rend impossible de l'exécuter par erreur sur le compte réel de
 * Benoît : la ligne qui porte ses 62 contrats n'est pas vide, donc le script s'arrête. Il ne supprime
 * que ce qu'il a créé lui-même.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE = "donnees_utilisateur";

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

Ce sont les mêmes que celles de \`npm run verifier:rls\`.
`);
  process.exit(2);
}

/** Deux clients distincts = deux appareils, comme deux navigateurs sur le même compte. */
function creerAppareil() {
  return createClient(URL_SUPABASE, CLE_ANON, {
    // Aucune persistance : un script ne doit pas laisser de session sur le disque.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function connecter(nom, client) {
  const { data, error } = await client.auth.signInWithPassword({ email: COMPTE.email, password: COMPTE.motDePasse });
  if (error || !data?.session) {
    console.error(`\nConnexion impossible pour ${nom} (${COMPTE.email}) : ${error?.message ?? "aucune session"}`);
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

/** L'état écrit par un appareil donné : reconnaissable, pour prouver QUI a gagné. */
function etat(appareil, marqueur) {
  return { profil: null, contrats: [], periodes: [], soldeIndemnisationDepart: null, exercicesGeles: {}, ecritPar: appareil, marqueur };
}

async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}`);
  console.log(`Compte de test : ${COMPTE.email}\n`);

  const appareil1 = creerAppareil();
  const appareil2 = creerAppareil();
  const utilisateurId = await connecter("appareil 1", appareil1);
  const idBis = await connecter("appareil 2", appareil2);

  if (utilisateurId !== idBis) {
    console.error("Les deux sessions ne portent pas le même utilisateur. Arrêt.");
    process.exit(2);
  }
  console.log(`Utilisateur : ${utilisateurId}\n`);

  // ── Garde devoir n°1 ──────────────────────────────────────────────────────────────────────────
  // La ligne doit être ABSENTE. Cette garde est ce qui rend impossible d'exécuter le script sur le
  // compte réel de Benoît : sa ligne existe et porte ses 62 contrats, donc le script s'arrêterait ici.
  const { data: existante, error: erreurGarde } = await appareil1.from(TABLE).select("user_id, maj_le").eq("user_id", utilisateurId).maybeSingle();
  if (erreurGarde) {
    console.error(`\nLecture impossible (${erreurGarde.message}). La migration 0001 est-elle appliquée ? Arrêt.\n`);
    process.exit(2);
  }
  if (existante) {
    console.error(
      `\nCe compte possède DÉJÀ une ligne dans « ${TABLE} » (maj_le = ${existante.maj_le}).\n` +
        "Ce script écrit et nettoie : il REFUSE de tourner sur un compte non vide, pour ne jamais\n" +
        "supprimer des données qu'il n'a pas créées (devoir n°1). Vérifie que SUPABASE_TEST_A_EMAIL\n" +
        "désigne bien un compte de TEST. Arrêt.\n"
    );
    process.exit(2);
  }
  console.log(`Garde : aucune ligne pour ce compte dans « ${TABLE} ».\n`);

  const marqueur = `verrou-${process.pid}`;
  let ligneCreee = false;

  try {
    // ── Étape 1 : première écriture (aucune ligne) — `insert`, pas `upsert` ──────────────────────
    const insertion = await appareil1.from(TABLE).insert({ user_id: utilisateurId, donnees: etat("appareil-1", marqueur), version_schema: 1 }).select("maj_le");
    const jeton1 = insertion.data?.[0]?.maj_le;
    ligneCreee = !insertion.error;
    noter("1. l'appareil 1 crée la ligne et reçoit une version", !insertion.error && typeof jeton1 === "string", insertion.error ? insertion.error.message : `maj_le = ${jeton1}`);
    if (!ligneCreee) throw new Error("impossible de créer la ligne de départ — la suite ne prouverait rien");

    // ── Étape 2 : l'insertion concurrente est refusée, et le code est bien 23505 ─────────────────
    // `ecrireEtatServeur` s'appuie sur ce code exact pour distinguer un conflit d'une panne. Si le
    // code changeait, un conflit s'afficherait comme une panne réseau : cause fausse à l'écran.
    const insertionBis = await appareil2.from(TABLE).insert({ user_id: utilisateurId, donnees: etat("appareil-2", marqueur), version_schema: 1 }).select("maj_le");
    noter(
      "2. l'appareil 2 ne peut pas créer une seconde ligne, et l'erreur porte le code 23505",
      insertionBis.error?.code === "23505",
      insertionBis.error ? `code ${insertionBis.error.code}` : "AUCUNE erreur : la ligne aurait été dupliquée ou écrasée"
    );

    // ── Étape 3 : les deux appareils lisent la même version ─────────────────────────────────────
    const lecture1 = await appareil1.from(TABLE).select("donnees, version_schema, maj_le").eq("user_id", utilisateurId).maybeSingle();
    const lecture2 = await appareil2.from(TABLE).select("donnees, version_schema, maj_le").eq("user_id", utilisateurId).maybeSingle();
    const vueCommune = lecture1.data?.maj_le;
    noter("3. les deux appareils lisent la même version", typeof vueCommune === "string" && vueCommune === lecture2.data?.maj_le, `maj_le = ${vueCommune}`);

    // ── Étape 4 : CONTRÔLE POSITIF — l'écriture conditionnelle RÉUSSIT avec le bon jeton ─────────
    // Sans cette étape, le refus de l'étape 5 pourrait n'être qu'une requête mal formée.
    const ecriture1 = await appareil1
      .from(TABLE)
      .update({ user_id: utilisateurId, donnees: etat("appareil-1", `${marqueur}-v2`), version_schema: 1 })
      .eq("user_id", utilisateurId)
      .eq("maj_le", vueCommune)
      .select("maj_le");
    const jeton2 = ecriture1.data?.[0]?.maj_le;
    const positifOk = !ecriture1.error && ecriture1.data?.length === 1 && typeof jeton2 === "string" && jeton2 !== vueCommune;
    noter(
      "4. CONTRÔLE POSITIF : avec la bonne version, l'appareil 1 écrit — et la version change",
      positifOk,
      ecriture1.error ? ecriture1.error.message : `${ecriture1.data?.length ?? 0} ligne(s) · nouvelle maj_le = ${jeton2}`
    );
    if (!positifOk) throw new Error("le filtre conditionnel ne fonctionne pas même avec la bonne version : un « refus » ne prouverait rien");

    // ── Étape 5 : LE VERROU — l'appareil 2 écrit avec une version périmée ────────────────────────
    const ecriture2 = await appareil2
      .from(TABLE)
      .update({ user_id: utilisateurId, donnees: etat("appareil-2", `${marqueur}-ECRASEMENT`), version_schema: 1 })
      .eq("user_id", utilisateurId)
      .eq("maj_le", vueCommune)
      .select("maj_le");
    noter(
      "5. LE VERROU : avec une version périmée, l'appareil 2 est REFUSÉ (zéro ligne touchée)",
      !ecriture2.error && ecriture2.data?.length === 0,
      ecriture2.error ? `erreur ${ecriture2.error.message}` : `${ecriture2.data?.length ?? "?"} ligne(s) touchée(s)`
    );

    // ── Étape 6 : LA PREUVE DU DEVOIR N°1 — le contenu de l'appareil 1 a survécu ─────────────────
    const apres = await appareil1.from(TABLE).select("donnees, maj_le").eq("user_id", utilisateurId).maybeSingle();
    const gagnant = apres.data?.donnees?.ecritPar;
    const contenuIntact = gagnant === "appareil-1" && apres.data?.donnees?.marqueur === `${marqueur}-v2`;
    noter("6. le contenu de l'appareil 1 est INTACT : rien n'a été écrasé", contenuIntact, `écrit par « ${gagnant} », marqueur « ${apres.data?.donnees?.marqueur} »`);

    // ── Étape 7 : le refus est temporaire — après relecture, l'appareil 2 peut écrire ─────────────
    // Sinon le verrou serait un blocage définitif, ce qui n'est pas une protection mais une panne.
    const jetonFrais = apres.data?.maj_le;
    const reprise = await appareil2
      .from(TABLE)
      .update({ user_id: utilisateurId, donnees: etat("appareil-2", `${marqueur}-apres-relecture`), version_schema: 1 })
      .eq("user_id", utilisateurId)
      .eq("maj_le", jetonFrais)
      .select("maj_le");
    noter("7. après avoir relu, l'appareil 2 écrit normalement — le refus n'est pas un blocage", !reprise.error && reprise.data?.length === 1, reprise.error ? reprise.error.message : `${reprise.data?.length ?? 0} ligne(s)`);
  } finally {
    // ── Nettoyage : uniquement la ligne créée par ce script ───────────────────────────────────────
    if (ligneCreee) {
      const { error } = await appareil1.from(TABLE).delete().eq("user_id", utilisateurId);
      console.log(error ? `\n⚠️ Nettoyage RATÉ (${error.message}) — supprime la ligne du compte de test à la main.` : "\nNettoyage : la ligne d'essai est supprimée.");
    }
  }

  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${resultats.length - echecs.length} contrôle(s) conforme(s) sur ${resultats.length}.`);
  if (echecs.length > 0) {
    console.log("\nLE VERROU N'EST PAS PROUVÉ. Ne pas brancher la bascule dessus :");
    for (const e of echecs) console.log(`  · ${e.intitule}`);
    process.exit(1);
  }
  console.log("\nLE VERROU EST PROUVÉ : une écriture fondée sur une version périmée est refusée par le\nserveur, et le contenu déjà en place survit intact.\n");
}

main().catch((incident) => {
  console.error(`\nInterrompu : ${incident?.message ?? incident}\n`);
  process.exit(1);
});
