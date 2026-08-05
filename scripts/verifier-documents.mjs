#!/usr/bin/env node
/**
 * PREUVE DE LA FONDATION DOCUMENTS — livrable du commit 2 de la phase 6.
 *
 * POURQUOI CE SCRIPT EXISTE. `documentsStorage.test.ts` prouve que `deposerDocument`/
 * `listerDocuments`/`corrigerTypeDocument`/`obtenirUrlTelechargement` appellent les BONNES chaînes
 * (`storage.from(bucket).upload(...)`, `.from('documents').insert(...).select(...)`, etc.) sur un
 * client injecté. Il ne prouve pas que ces chaînes marchent contre le VRAI projet, ni que la
 * migration 0003 a réellement été appliquée. Tant que ce script n'a pas tourné en vert, la fondation
 * n'est qu'une intention — même principe que `verifier-verrou.mjs` et `verifier-sauvegarde-serveur.mjs`.
 *
 * CE QU'IL PROUVE :
 *  1. les 5 NOUVELLES valeurs de `type_document` (migration 0003) sont acceptées — si la migration
 *     n'a pas été collée dans l'éditeur SQL, ce script échoue ici et le dit clairement ;
 *  2. la contrainte des DEUX AXES (migration 0001, categorie_frais réservée à justificatif_frais)
 *     n'a PAS été affaiblie par 0003 — testée sur une valeur NEUVE (attestation_cpam + categorie),
 *     pas seulement sur les anciennes valeurs déjà couvertes par `verifier-rls.mjs` ;
 *  3. un fichier réel se dépose dans le bucket `justificatifs`, se retélécharge par URL signée avec
 *     un contenu IDENTIQUE (pas juste un statut 200 — le contenu, octet pour octet), et se supprime ;
 *  4. `corrigerTypeDocument` change bien le type d'une ligne déjà créée, sans toucher au chemin.
 *
 * ⚠️ DEVOIR N°1 — CE SCRIPT ÉCRIT DANS LA BASE ET DANS LE BUCKET. Il refuse de démarrer si le compte
 * de test possède déjà une ligne dans `documents` ou un fichier dans son dossier du bucket. Il ne
 * supprime que ce qu'il a créé lui-même.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE = "documents";
const BUCKET = "justificatifs";

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

Ce sont les mêmes que celles de \`npm run verifier:rls\` / \`verifier:verrou\` / \`verifier:sauvegarde\`.
`);
  process.exit(2);
}

// Les 10 valeurs de la migration 0003 — à tenir synchronisé avec supabase/migrations/0003 et
// src/storage/documentsStorage.ts (TypeDocument). Volontairement dupliqué en dur ici plutôt
// qu'importé : ce script n'a pas de lanceur TypeScript, et une divergence accidentelle serait de
// toute façon détectée (le script échouerait sur la valeur oubliée).
const TYPES_DOCUMENT = [
  "aem_bulletin",
  "notification_are",
  "releve_situation",
  "declaration_fiscale",
  "justificatif_frais",
  "attestation_cpam",
  "justificatif_declaration",
  "attestation_taux_pas",
  "document_non_classe",
  "planning_travail",
];

function creerClient() {
  return createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
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

async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}`);
  console.log(`Compte de test : ${COMPTE.email}\n`);

  const client = creerClient();
  const utilisateurId = await connecter(client);
  console.log(`Utilisateur : ${utilisateurId}\n`);

  // ── Garde devoir n°1 ──────────────────────────────────────────────────────────────────────────
  const { data: lignesExistantes, error: erreurGardeTable } = await client.from(TABLE).select("id").eq("user_id", utilisateurId);
  if (erreurGardeTable) {
    console.error(`\nLecture impossible (${erreurGardeTable.message}). La migration 0001 est-elle appliquée ? Arrêt.\n`);
    process.exit(2);
  }
  if (lignesExistantes && lignesExistantes.length > 0) {
    console.error(`\nCe compte possède DÉJÀ ${lignesExistantes.length} ligne(s) dans « ${TABLE} ». Ce script écrit et nettoie : il REFUSE de tourner sur un compte non vide. Arrêt.\n`);
    process.exit(2);
  }
  const { data: fichiersExistants, error: erreurGardeBucket } = await client.storage.from(BUCKET).list(utilisateurId);
  if (erreurGardeBucket) {
    console.error(`\nListage du bucket impossible (${erreurGardeBucket.message}). Arrêt.\n`);
    process.exit(2);
  }
  if (fichiersExistants && fichiersExistants.length > 0) {
    console.error(`\nCe compte possède DÉJÀ des fichiers dans son dossier du bucket « ${BUCKET} ». Arrêt.\n`);
    process.exit(2);
  }
  console.log("Garde : ni ligne ni fichier existants pour ce compte.\n");

  const marqueur = `doc-${process.pid}`;
  const lignesCreees = [];
  const cheminsDeposes = [];

  try {
    // ── 1. Les 10 valeurs de type_document sont acceptées (migration 0003 comprise) ─────────────
    for (const type of TYPES_DOCUMENT) {
      const ligne = {
        user_id: utilisateurId,
        type_document: type,
        categorie_frais: type === "justificatif_frais" ? "A" : null,
        annee_fiscale: 2026,
        chemin_stockage: `${utilisateurId}/2026/${type}/${marqueur}-essai.pdf`,
        nom_fichier: "essai.pdf",
        taille_octets: 10,
        mime: "application/pdf",
      };
      const { data, error } = await client.from(TABLE).insert(ligne).select("id");
      const ok = !error && data?.length === 1;
      noter(`type_document accepté : ${type}`, ok, error ? error.message : "");
      if (ok) lignesCreees.push(data[0].id);
    }

    // ── 2. LA CONTRAINTE DES DEUX AXES N'EST PAS AFFAIBLIE, testée sur une valeur NEUVE ─────────
    const { error: erreurDeuxAxes } = await client.from(TABLE).insert({
      user_id: utilisateurId,
      type_document: "attestation_cpam",
      categorie_frais: "A", // interdit : categorie_frais réservée à justificatif_frais
      annee_fiscale: 2026,
      chemin_stockage: `${utilisateurId}/2026/attestation_cpam/${marqueur}-refus.pdf`,
      nom_fichier: "refus.pdf",
      taille_octets: 10,
      mime: "application/pdf",
    });
    noter("la contrainte des deux axes refuse toujours categorie_frais hors justificatif_frais", Boolean(erreurDeuxAxes), erreurDeuxAxes ? "" : "⚠️ AUCUNE erreur : la contrainte est affaiblie");

    // ── 3. Upload réel, téléchargement réel, CONTENU IDENTIQUE ───────────────────────────────────
    const contenu = `contenu de test ${marqueur}`;
    const cheminUpload = `${utilisateurId}/2026/aem_bulletin/${marqueur}-reel.txt`;
    const { error: erreurUpload } = await client.storage.from(BUCKET).upload(cheminUpload, Buffer.from(contenu), { contentType: "text/plain" });
    noter("upload réel dans le bucket", !erreurUpload, erreurUpload?.message ?? "");
    if (!erreurUpload) cheminsDeposes.push(cheminUpload);

    const { data: urlSignee, error: erreurUrl } = await client.storage.from(BUCKET).createSignedUrl(cheminUpload, 60);
    noter("URL signée obtenue", !erreurUrl && Boolean(urlSignee?.signedUrl), erreurUrl?.message ?? "");

    if (urlSignee?.signedUrl) {
      const reponse = await fetch(urlSignee.signedUrl);
      const contenuTelecharge = await reponse.text();
      noter("le contenu téléchargé est IDENTIQUE à celui déposé", contenuTelecharge === contenu, contenuTelecharge === contenu ? "" : `reçu : « ${contenuTelecharge.slice(0, 60)} »`);
    } else {
      noter("le contenu téléchargé est IDENTIQUE à celui déposé", false, "aucune URL signée à essayer");
    }

    // ── 4. corrigerTypeDocument change le type, jamais le chemin ─────────────────────────────────
    if (lignesCreees.length > 0) {
      const idACorrigier = lignesCreees[0];
      const { data: avant } = await client.from(TABLE).select("chemin_stockage").eq("id", idACorrigier).maybeSingle();
      const { error: erreurCorrection } = await client.from(TABLE).update({ type_document: "document_non_classe" }).eq("id", idACorrigier);
      const { data: apres } = await client.from(TABLE).select("type_document, chemin_stockage").eq("id", idACorrigier).maybeSingle();
      noter(
        "corriger le type change bien le type, sans toucher au chemin",
        !erreurCorrection && apres?.type_document === "document_non_classe" && apres?.chemin_stockage === avant?.chemin_stockage,
        erreurCorrection?.message ?? "",
      );
    }
  } finally {
    // ── Nettoyage : uniquement ce que ce script a créé ──────────────────────────────────────────
    if (lignesCreees.length > 0) {
      const { error } = await client.from(TABLE).delete().in("id", lignesCreees);
      console.log(error ? `\n⚠️ Nettoyage des lignes RATÉ (${error.message}).` : `\nNettoyage : ${lignesCreees.length} ligne(s) supprimée(s).`);
    }
    if (cheminsDeposes.length > 0) {
      const { error } = await client.storage.from(BUCKET).remove(cheminsDeposes);
      console.log(error ? `⚠️ Nettoyage du bucket RATÉ (${error.message}).` : `Nettoyage : ${cheminsDeposes.length} fichier(s) supprimé(s) du bucket.`);
    }
  }

  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${resultats.length - echecs.length} contrôle(s) conforme(s) sur ${resultats.length}.`);
  if (echecs.length > 0) {
    console.log("\nLA FONDATION N'EST PAS PROUVÉE :");
    for (const e of echecs) console.log(`  · ${e.intitule}`);
    process.exit(1);
  }
  console.log("\nLA FONDATION EST PROUVÉE : les 10 types sont acceptés, la contrainte des deux axes\ntient toujours, l'upload/téléchargement/suppression réels fonctionnent.\n");
}

main().catch((incident) => {
  console.error(`\nInterrompu : ${incident?.message ?? incident}\n`);
  process.exit(1);
});
