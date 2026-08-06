#!/usr/bin/env node
/**
 * PREUVE DU COMMIT 6 DE LA PHASE 6 — les justificatifs de frais réels vivent sur Supabase Storage.
 *
 * POURQUOI CE SCRIPT EXISTE. Les 1042 tests unitaires prouvent que `DepenseForm`/`DepensesList`/
 * `remplacerDocument` appellent les BONNES chaînes sur un client injecté. Ils ne prouvent pas que ces
 * chaînes marchent contre le VRAI projet. `verifier-documents.mjs` couvre déjà la fondation (les 10
 * types, la contrainte des deux axes, un upload/téléchargement/suppression simple) ; il ne couvre PAS
 * ce que le commit 6 a ajouté. C'est le rôle de ce script.
 *
 * CE QU'IL PROUVE :
 *  1. un justificatif de dépense (`justificatif_frais` + `categorie_frais`, les DEUX axes ensemble)
 *     se dépose réellement et rend l'`id` qui devient `Depense.documentId` ;
 *  2. le lien « Voir » : depuis ce seul `documentId`, on retrouve la ligne, on en dérive une URL
 *     signée, et le contenu téléchargé est IDENTIQUE octet pour octet à celui déposé — la chaîne
 *     complète de `lib/justificatifAffichage.ts` type `"signe"` ;
 *  3. LE POINT CENTRAL DU COMMIT 6 — remplacer un justificatif insère le NOUVEAU avant de retirer
 *     l'ANCIEN : à l'instant intermédiaire, les DEUX existent (aucun trou où ni l'un ni l'autre n'est
 *     là, devoir n°1) ; après l'opération, l'ancien a disparu de la table ET du bucket, le nouveau
 *     reste téléchargeable ;
 *  4. la suppression fonctionne vraiment (les politiques RLS `documents_supprimer` /
 *     `justificatifs_supprimer` de la migration 0001 étaient supposées suffire, jamais exercées sur
 *     ce chemin — c'est ici qu'elles le sont).
 *
 * ⚠️ CE QU'IL NE PROUVE PAS. Ce script ne peut pas importer `storage/documentsStorage.ts` (aucun
 * lanceur TypeScript dans ce dépôt) : il REJOUE les mêmes séquences d'appels, à la main, dans le même
 * ordre. Que le code TypeScript émette bien ces séquences est prouvé par les tests unitaires ; que le
 * serveur les accepte est prouvé ici. Ni l'un ni l'autre ne prouve le rendu à l'écran.
 * Si `documentsStorage.ts` change d'ordre ou de chaîne, ce script ne le verra pas — le garder aligné
 * à la main, même principe que la liste `TYPES_DOCUMENT` de `verifier-documents.mjs`.
 *
 * ⚠️ DEVOIR N°1 — CE SCRIPT ÉCRIT DANS LA BASE ET DANS LE BUCKET. Il refuse de démarrer si le compte
 * de test possède déjà une ligne dans `documents` ou un fichier dans son dossier du bucket. Il ne
 * supprime que ce qu'il a créé lui-même.
 */

import { createClient } from "@supabase/supabase-js";

const TABLE = "documents";
const BUCKET = "justificatifs";
const ANNEE = 2026;
const CATEGORIE = "A"; // catégorie de frais réels valide, cf. contrainte des deux axes (migration 0001)

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

Ce sont les mêmes que celles de \`npm run verifier:rls\` / \`verifier:documents\`.
`);
  process.exit(2);
}

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

/** Rejoue `construireCheminStockage` : `<user_id>/<annee>/<type>/<uuid>-<nom>`. */
function construireChemin(utilisateurId, nomFichier) {
  const nomNettoye = nomFichier.trim().replace(/[/\\]/g, "_").replace(/\s+/g, "_");
  return `${utilisateurId}/${ANNEE}/justificatif_frais/${crypto.randomUUID()}-${nomNettoye}`;
}

/** Rejoue `deposerDocument` : upload dans le bucket PUIS insertion de la ligne, dans cet ordre. */
async function deposer(client, utilisateurId, nomFichier, contenu) {
  const chemin = construireChemin(utilisateurId, nomFichier);
  const octets = Buffer.from(contenu);

  const { error: erreurUpload } = await client.storage.from(BUCKET).upload(chemin, octets, { contentType: "text/plain" });
  if (erreurUpload) return { statut: "echec", message: erreurUpload.message };

  const { data, error: erreurInsertion } = await client
    .from(TABLE)
    .insert({
      user_id: utilisateurId,
      type_document: "justificatif_frais",
      categorie_frais: CATEGORIE,
      annee_fiscale: ANNEE,
      chemin_stockage: chemin,
      nom_fichier: nomFichier,
      taille_octets: octets.length,
      mime: "text/plain",
      date_document: null,
      notes: null,
    })
    .select("id");
  if (erreurInsertion) return { statut: "ficherEnvoyeLigneEchouee", cheminStockage: chemin, message: erreurInsertion.message };

  return { statut: "depose", id: data?.[0]?.id, cheminStockage: chemin };
}

/** Rejoue `obtenirDocument` : retrouver la ligne depuis le seul `documentId`. */
async function obtenirDocument(client, documentId) {
  const { data, error } = await client.from(TABLE).select("*").eq("id", documentId).order("cree_le", { ascending: false });
  if (error) return { erreur: error.message };
  const document = (data ?? [])[0];
  if (!document) return { erreur: "Document introuvable." };
  return { document };
}

/** Rejoue `supprimerDocument` : la LIGNE d'abord, puis le FICHIER. */
async function supprimer(client, document) {
  const { error: erreurLigne } = await client.from(TABLE).delete().eq("id", document.id);
  if (erreurLigne) return { ok: false, message: erreurLigne.message };
  const { error: erreurFichier } = await client.storage.from(BUCKET).remove([document.chemin_stockage]);
  if (erreurFichier) return { ok: false, message: erreurFichier.message };
  return { ok: true };
}

/** Le fichier existe-t-il réellement dans le bucket ? (list du dossier, puis recherche du nom) */
async function fichierExiste(client, chemin) {
  const dossier = chemin.slice(0, chemin.lastIndexOf("/"));
  const nom = chemin.slice(chemin.lastIndexOf("/") + 1);
  const { data, error } = await client.storage.from(BUCKET).list(dossier);
  if (error) return false;
  return (data ?? []).some((entree) => entree.name === nom);
}

async function contenuTelecharge(client, chemin) {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(chemin, 60);
  if (error || !data?.signedUrl) return { erreur: error?.message ?? "aucune URL signée" };
  const reponse = await fetch(data.signedUrl);
  return { contenu: await reponse.text() };
}

async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}`);
  console.log(`Compte de test : ${COMPTE.email}\n`);

  const client = creerClient();
  const utilisateurId = await connecter(client);
  console.log(`Utilisateur : ${utilisateurId}\n`);

  // ── Garde devoir n°1 ────────────────────────────────────────────────────────────────────────────
  const { data: lignesExistantes, error: erreurGardeTable } = await client.from(TABLE).select("id").eq("user_id", utilisateurId);
  if (erreurGardeTable) {
    console.error(`\nLecture impossible (${erreurGardeTable.message}). Les migrations sont-elles appliquées ? Arrêt.\n`);
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

  const aNettoyer = []; // { id, chemin_stockage }

  try {
    // ── 1. Dépôt d'un justificatif de dépense (les DEUX axes ensemble) ───────────────────────────
    const CONTENU_INITIAL = "facture luthier — revision archet — 180 EUR";
    const initial = await deposer(client, utilisateurId, "facture luthier.pdf", CONTENU_INITIAL);
    noter(
      "un justificatif de dépense se dépose (justificatif_frais + categorie_frais ensemble)",
      initial.statut === "depose" && typeof initial.id === "string",
      initial.statut === "depose" ? `documentId = ${initial.id}` : initial.message,
    );
    if (initial.statut !== "depose") throw new Error("Dépôt initial impossible, la suite n'aurait aucun sens.");
    aNettoyer.push({ id: initial.id, chemin_stockage: initial.cheminStockage });

    // Le nom est nettoyé : l'espace de « facture luthier.pdf » devient « _ » dans le chemin.
    noter("le chemin de stockage respecte la convention <user>/<annee>/<type>/<uuid>-<nom nettoyé>", initial.cheminStockage.startsWith(`${utilisateurId}/${ANNEE}/justificatif_frais/`) && initial.cheminStockage.endsWith("-facture_luthier.pdf"), initial.cheminStockage);

    // ── 2. Le lien « Voir » : du seul documentId au contenu réel ─────────────────────────────────
    const relu = await obtenirDocument(client, initial.id);
    noter("depuis le seul documentId, la ligne est retrouvée (lien « Voir »)", !("erreur" in relu) && relu.document?.chemin_stockage === initial.cheminStockage, "erreur" in relu ? relu.erreur : "");

    if (!("erreur" in relu)) {
      const telecharge = await contenuTelecharge(client, relu.document.chemin_stockage);
      noter(
        "l'URL signée dérivée du documentId rend un contenu IDENTIQUE à celui déposé",
        telecharge.contenu === CONTENU_INITIAL,
        "erreur" in telecharge ? telecharge.erreur : telecharge.contenu === CONTENU_INITIAL ? "" : `reçu : « ${String(telecharge.contenu).slice(0, 60)} »`,
      );
    }

    // ── 3. LE POINT CENTRAL : remplacer insère le NOUVEAU avant de retirer l'ANCIEN ──────────────
    const CONTENU_REMPLACANT = "facture luthier CORRIGEE — revision archet — 195 EUR";
    const remplacant = await deposer(client, utilisateurId, "facture luthier corrigee.pdf", CONTENU_REMPLACANT);
    noter("remplacement — le nouveau justificatif est déposé d'abord", remplacant.statut === "depose", remplacant.statut === "depose" ? "" : remplacant.message);
    if (remplacant.statut !== "depose") throw new Error("Dépôt du remplaçant impossible.");
    aNettoyer.push({ id: remplacant.id, chemin_stockage: remplacant.cheminStockage });

    // L'INSTANT INTERMÉDIAIRE — c'est ici que le devoir n°1 se joue : les DEUX doivent exister.
    const ancienEncoreLa = await fichierExiste(client, initial.cheminStockage);
    const nouveauDejaLa = await fichierExiste(client, remplacant.cheminStockage);
    noter("À L'INSTANT INTERMÉDIAIRE, les DEUX fichiers existent — aucun trou (devoir n°1)", ancienEncoreLa && nouveauDejaLa, `ancien présent : ${ancienEncoreLa} · nouveau présent : ${nouveauDejaLa}`);

    // Puis, et seulement puis, l'ancien est retiré.
    const ancien = await obtenirDocument(client, initial.id);
    const suppression = "erreur" in ancien ? { ok: false, message: ancien.erreur } : await supprimer(client, ancien.document);
    noter("remplacement — l'ancien est ensuite retiré (RLS de suppression, migration 0001)", suppression.ok, suppression.ok ? "" : suppression.message);
    if (suppression.ok) {
      const index = aNettoyer.findIndex((d) => d.id === initial.id);
      if (index !== -1) aNettoyer.splice(index, 1); // déjà supprimé, ne pas le renettoyer
    }

    // ── 4. État final : l'ancien a disparu partout, le nouveau est intact ────────────────────────
    const ancienRelu = await obtenirDocument(client, initial.id);
    noter("après remplacement, l'ancienne LIGNE a disparu de la table", "erreur" in ancienRelu, "erreur" in ancienRelu ? "" : "⚠️ la ligne existe encore");
    noter("après remplacement, l'ancien FICHIER a disparu du bucket", !(await fichierExiste(client, initial.cheminStockage)), "");

    const finalTelecharge = await contenuTelecharge(client, remplacant.cheminStockage);
    noter("après remplacement, le NOUVEAU justificatif reste téléchargeable et à jour", finalTelecharge.contenu === CONTENU_REMPLACANT, "erreur" in finalTelecharge ? finalTelecharge.erreur : "");
  } finally {
    // ── Nettoyage : uniquement ce que ce script a créé ─────────────────────────────────────────────
    if (aNettoyer.length > 0) {
      const ids = aNettoyer.map((d) => d.id);
      const chemins = aNettoyer.map((d) => d.chemin_stockage);
      const { error: erreurLignes } = await client.from(TABLE).delete().in("id", ids);
      console.log(erreurLignes ? `\n⚠️ Nettoyage des lignes RATÉ (${erreurLignes.message}).` : `\nNettoyage : ${ids.length} ligne(s) supprimée(s).`);
      const { error: erreurFichiers } = await client.storage.from(BUCKET).remove(chemins);
      console.log(erreurFichiers ? `⚠️ Nettoyage du bucket RATÉ (${erreurFichiers.message}).` : `Nettoyage : ${chemins.length} fichier(s) supprimé(s) du bucket.`);
    }
  }

  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${resultats.length - echecs.length} contrôle(s) conforme(s) sur ${resultats.length}.`);
  if (echecs.length > 0) {
    console.log("\nLE COMMIT 6 N'EST PAS PROUVÉ CONTRE LE VRAI SERVEUR :");
    for (const e of echecs) console.log(`  · ${e.intitule}`);
    process.exit(1);
  }
  console.log("\nLE COMMIT 6 EST PROUVÉ CONTRE LE VRAI SERVEUR : un justificatif de dépense se dépose,\nse retrouve depuis son seul documentId, et son remplacement ne passe JAMAIS par un instant\noù ni l'ancien ni le nouveau n'existe.\n");
}

main().catch((incident) => {
  console.error(`\nInterrompu : ${incident?.message ?? incident}\n`);
  process.exit(1);
});
