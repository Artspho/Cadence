#!/usr/bin/env node
/**
 * CONTRÔLE NÉGATIF DE L'ISOLATION ENTRE UTILISATEURS — livrable de la phase 1 de la refonte Supabase.
 *
 * POURQUOI CE SCRIPT EXISTE. Écrire « RLS activé » dans une migration ne protège rien : la seule
 * preuve recevable est d'essayer, en tant qu'utilisateur B, de lire et de modifier les données de
 * l'utilisateur A, et de constater le refus. Tant que ce script n'a pas tourné en vert contre le vrai
 * projet, la phase 1 n'est PAS validée.
 *
 * POURQUOI IL N'EST PAS DANS LA SUITE DE TESTS (vitest). Un test qui se met en « skip » faute de
 * configuration afficherait une suite verte : quelqu'un en conclurait que l'isolation est prouvée
 * alors que rien n'aurait été exercé. Un faux feu vert est précisément ce que le devoir n°2 interdit.
 * D'où une commande séparée et explicite — `npm run verifier:rls` — dont la SORTIE est la preuve.
 *
 * POURQUOI EN HTTP BRUT ET NON VIA @supabase/supabase-js. Un attaquant ne passe pas par le SDK : il
 * parle directement à l'API. Exercer la même frontière que lui est plus convaincant, et ça évite
 * d'ajouter une dépendance avant que le code applicatif en ait besoin (phase 3).
 *
 * ⚠️ DEVOIR N°1 — CE SCRIPT ÉCRIT DANS LA BASE. Il refuse donc de démarrer si l'un des deux comptes
 * de test contient déjà la moindre ligne : sans cette garde, l'utiliser par erreur avec le compte
 * réel de Benoît ferait supprimer ses données au nettoyage. Il ne supprime QUE ce qu'il a créé.
 */

const TABLES = [
  "donnees_utilisateur",
  "donnees_sauvegarde",
  "donnees_quarantaine",
  "frais_reels",
  "biens_amortis",
  "identite_declarative",
  "documents",
];

const BUCKET = "justificatifs";

/** Une ligne d'essai par table, respectant les contraintes de la migration 0001. */
function ligneDEssai(table, marqueur) {
  switch (table) {
    case "donnees_quarantaine":
      return { brut: `essai-rls-${marqueur}`, motif: "contrôle négatif" };
    case "frais_reels":
      return { annee_fiscale: 2026, donnees: { essai: marqueur } };
    case "documents":
      return {
        // `aem_bulletin` volontairement : la contrainte de la migration exige alors
        // `categorie_frais` NULL. Si la contrainte des deux axes disparaissait, cet insert
        // continuerait de passer — c'est `documents_contrainte_deux_axes` ci-dessous qui la teste.
        type_document: "aem_bulletin",
        annee_fiscale: 2026,
        chemin_stockage: `essai-rls/${marqueur}.pdf`,
        nom_fichier: `${marqueur}.pdf`,
        taille_octets: 1234,
        mime: "application/pdf",
      };
    default:
      return { donnees: { essai: marqueur } };
  }
}

// ── Configuration ───────────────────────────────────────────────────────────────────────────────
// Les variantes `VITE_*` servent de repli : ce sont les MÊMES valeurs que celles dont l'app aura
// besoin (phase 3), et faire remplir deux fois la même chose est le meilleur moyen d'en oublier une.
const URL_SUPABASE = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE_ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const COMPTES = {
  A: { email: process.env.SUPABASE_TEST_A_EMAIL ?? "", motDePasse: process.env.SUPABASE_TEST_A_PASSWORD ?? "" },
  B: { email: process.env.SUPABASE_TEST_B_EMAIL ?? "", motDePasse: process.env.SUPABASE_TEST_B_PASSWORD ?? "" },
};

if (!URL_SUPABASE || !CLE_ANON || !COMPTES.A.email || !COMPTES.A.motDePasse || !COMPTES.B.email || !COMPTES.B.motDePasse) {
  console.error(`
Configuration manquante. Ce script a besoin de six variables, à poser dans le fichier
.env du dépôt (C:\\Users\\benoi\\cadence\\.env — PAS le dossier OneDrive du même nom) :

  VITE_SUPABASE_URL          https://<ref>.supabase.co
  VITE_SUPABASE_ANON_KEY     la clé « anon » / publishable — JAMAIS la clé service_role,
                             qui contourne RLS par conception et rendrait ce test toujours vert
  SUPABASE_TEST_A_EMAIL      \\
  SUPABASE_TEST_A_PASSWORD    | DEUX COMPTES DE TEST DÉDIÉS, vides.
  SUPABASE_TEST_B_EMAIL       | N'utilise JAMAIS ton compte réel : le script écrit et nettoie.
  SUPABASE_TEST_B_PASSWORD   /

(SUPABASE_URL et SUPABASE_ANON_KEY, sans préfixe, sont acceptées en remplacement des
deux premières — mais il est inutile de renseigner les deux formes.)

Le script refusera de démarrer si l'un des comptes contient déjà des données.
`);
  process.exit(2);
}

// ── Petite mécanique HTTP ───────────────────────────────────────────────────────────────────────
function enTetes(jeton, extra = {}) {
  return {
    apikey: CLE_ANON,
    ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
    ...extra,
  };
}

async function rest(methode, chemin, jeton, corps, prefer) {
  const reponse = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    method: methode,
    headers: enTetes(jeton, {
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    }),
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await reponse.text();
  let json = null;
  try {
    json = texte ? JSON.parse(texte) : null;
  } catch {
    json = null;
  }
  return { statut: reponse.status, json, texte };
}

async function connecter(nom, { email, motDePasse }) {
  const reponse = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CLE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse }),
  });
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok || !donnees?.access_token) {
    console.error(`\nConnexion impossible pour le compte ${nom} (${email}) — statut ${reponse.status}.`);
    console.error(`Réponse : ${JSON.stringify(donnees)}`);
    console.error(
      "\nSi le message parle de confirmation d'e-mail : confirme les deux comptes de test depuis le\n" +
        "tableau de bord Supabase (Authentication > Users), ou crée-les avec « Auto Confirm User ».\n"
    );
    process.exit(2);
  }
  return { jeton: donnees.access_token, id: donnees.user.id };
}

// ── Journal des résultats ───────────────────────────────────────────────────────────────────────
const resultats = [];
function noter(categorie, intitule, reussi, detail = "") {
  resultats.push({ categorie, intitule, reussi, detail });
  const etiquette = reussi ? "\x1b[32mOK   \x1b[0m" : "\x1b[31mÉCHEC\x1b[0m";
  console.log(`[${etiquette}] ${categorie} · ${intitule}${detail ? ` — ${detail}` : ""}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\nProjet : ${URL_SUPABASE}\n`);
  const a = await connecter("A", COMPTES.A);
  const b = await connecter("B", COMPTES.B);
  console.log(`Compte A : ${a.id}\nCompte B : ${b.id}\n`);

  if (a.id === b.id) {
    console.error("A et B sont le MÊME utilisateur : le test ne prouverait rien. Arrêt.");
    process.exit(2);
  }

  // ── Garde devoir n°1 : les deux comptes doivent être vides ────────────────────────────────────
  for (const [nom, session] of [["A", a], ["B", b]]) {
    for (const table of TABLES) {
      const { statut, json } = await rest("GET", `${table}?select=*`, session.jeton);
      if (statut === 404 || (statut >= 400 && statut !== 401 && statut !== 403)) {
        console.error(`\nLa table « ${table} » semble absente ou inaccessible (statut ${statut}).`);
        console.error("Applique d'abord supabase/migrations/0001_schema_et_rls.sql. Arrêt.\n");
        process.exit(2);
      }
      if (Array.isArray(json) && json.length > 0) {
        console.error(
          `\nLe compte ${nom} contient déjà ${json.length} ligne(s) dans « ${table} ».\n` +
            "Ce script écrit et nettoie : il REFUSE de tourner sur un compte non vide, pour ne\n" +
            "jamais supprimer des données qu'il n'a pas créées (devoir n°1). Utilise deux comptes\n" +
            "de test dédiés. Arrêt.\n"
        );
        process.exit(2);
      }
    }
  }
  console.log("Garde : les deux comptes de test sont vides.\n");

  const marqueur = `${Date.now()}`;
  const creees = [];

  // ── 1. CONTRÔLES POSITIFS ─────────────────────────────────────────────────────────────────────
  // Indispensables AVANT tout contrôle négatif : une table absente, mal nommée ou injoignable
  // renverrait zéro ligne à B — ce qui ressemblerait exactement à une isolation réussie. Sans cette
  // étape, un script tout vert ne prouverait rien du tout.
  for (const table of TABLES) {
    const { statut, json, texte } = await rest(
      "POST",
      table,
      a.jeton,
      ligneDEssai(table, marqueur),
      "return=representation"
    );
    const ok = statut === 201 && Array.isArray(json) && json.length === 1;
    noter("positif", `A écrit dans ${table}`, ok, ok ? "" : `statut ${statut} · ${texte.slice(0, 140)}`);
    if (ok) creees.push({ table, ligne: json[0] });
  }

  for (const table of TABLES) {
    const { json } = await rest("GET", `${table}?select=*`, a.jeton);
    const ok = Array.isArray(json) && json.length === 1;
    noter("positif", `A relit sa propre ligne dans ${table}`, ok, ok ? "" : `${json?.length ?? "?"} ligne(s)`);
  }

  // ── 2. CONTRÔLES NÉGATIFS — B ne doit RIEN voir ni pouvoir toucher ────────────────────────────
  for (const table of TABLES) {
    const { json } = await rest("GET", `${table}?select=*`, b.jeton);
    const ok = Array.isArray(json) && json.length === 0;
    noter("négatif", `B ne voit rien dans ${table}`, ok, ok ? "" : `⚠️ ${json?.length ?? "?"} ligne(s) VISIBLES`);
  }

  for (const table of TABLES) {
    const { json } = await rest("PATCH", `${table}?select=*`, b.jeton, { maj_par_appareil: "pirate" }, "return=representation");
    // PostgREST renvoie 200 avec un tableau VIDE quand aucune ligne ne correspond : « succès » qui
    // n'a rien modifié. C'est le tableau vide qui est la preuve, pas le statut.
    const ok = !Array.isArray(json) || json.length === 0;
    noter("négatif", `B ne peut pas modifier ${table}`, ok, ok ? "" : `⚠️ ${json.length} ligne(s) MODIFIÉES`);
  }

  for (const table of TABLES) {
    const { json } = await rest("DELETE", `${table}?select=*`, b.jeton, undefined, "return=representation");
    const ok = !Array.isArray(json) || json.length === 0;
    noter("négatif", `B ne peut pas supprimer dans ${table}`, ok, ok ? "" : `⚠️ ${json.length} ligne(s) SUPPRIMÉES`);
  }

  // La preuve que les tentatives de B ont réellement échoué : les lignes de A sont TOUJOURS là.
  // Un DELETE « réussi mais sans effet » et un DELETE effectif se distinguent seulement ici.
  for (const table of TABLES) {
    const { json } = await rest("GET", `${table}?select=*`, a.jeton);
    const ok = Array.isArray(json) && json.length === 1;
    noter("négatif", `la ligne de A dans ${table} a survécu aux tentatives de B`, ok, ok ? "" : "⚠️ ligne perdue");
  }

  // ── 3. CONTRÔLES NÉGATIFS — anonyme (clé publique seule, aucune session) ─────────────────────
  for (const table of TABLES) {
    const { statut, json } = await rest("GET", `${table}?select=*`, null);
    const ok = statut === 401 || statut === 403 || (Array.isArray(json) && json.length === 0);
    noter("anonyme", `sans session, ${table} ne livre rien`, ok, ok ? `statut ${statut}` : `⚠️ ${json?.length} ligne(s)`);
  }

  // ── 4. La contrainte des deux axes (règle validée le 04/08/2026) ──────────────────────────────
  // Un document qui n'est pas un justificatif de frais ne doit pas porter de catégorie fiscale :
  // les catégories SNAM-CGT sont celles des frais professionnels, pas des AEM.
  {
    const { statut } = await rest("POST", "documents", a.jeton, {
      ...ligneDEssai("documents", `${marqueur}-axes`),
      chemin_stockage: `essai-rls/${marqueur}-axes.pdf`,
      categorie_frais: "C3",
    });
    const ok = statut >= 400;
    noter("contrainte", "un AEM portant une catégorie de frais est REFUSÉ", ok, `statut ${statut}`);
  }
  {
    const { statut } = await rest("POST", "documents", a.jeton, {
      type_document: "justificatif_frais",
      annee_fiscale: 2026,
      chemin_stockage: `essai-rls/${marqueur}-sanscat.pdf`,
      nom_fichier: "x.pdf",
      taille_octets: 10,
      mime: "application/pdf",
    });
    const ok = statut >= 400;
    noter("contrainte", "un justificatif de frais SANS catégorie est REFUSÉ", ok, `statut ${statut}`);
  }

  // ── 5. Stockage des fichiers ──────────────────────────────────────────────────────────────────
  const cheminA = `${a.id}/2026/essai/${marqueur}.txt`;
  let fichierDepose = false;
  {
    const reponse = await fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${cheminA}`, {
      method: "POST",
      headers: enTetes(a.jeton, { "Content-Type": "text/plain" }),
      body: "contenu d'essai",
    });
    fichierDepose = reponse.ok;
    noter("positif", "A dépose un fichier dans son dossier", reponse.ok, `statut ${reponse.status}`);
  }

  if (fichierDepose) {
    const lireAvec = async (jeton) =>
      fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${cheminA}`, { headers: enTetes(jeton) });

    const parA = await lireAvec(a.jeton);
    noter("positif", "A relit son propre fichier", parA.ok, `statut ${parA.status}`);

    const parB = await lireAvec(b.jeton);
    noter("négatif", "B ne peut PAS lire le fichier de A", !parB.ok, `statut ${parB.status}`);

    const parAnonyme = await lireAvec(null);
    noter("anonyme", "sans session, le fichier de A est inaccessible", !parAnonyme.ok, `statut ${parAnonyme.status}`);

    const depotDeB = await fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${a.id}/2026/essai/intrus.txt`, {
      method: "POST",
      headers: enTetes(b.jeton, { "Content-Type": "text/plain" }),
      body: "intrusion",
    });
    noter("négatif", "B ne peut PAS écrire dans le dossier de A", !depotDeB.ok, `statut ${depotDeB.status}`);
  }

  // ── 6. Nettoyage — uniquement ce que ce script a créé ─────────────────────────────────────────
  console.log("");
  for (const { table } of creees) {
    await rest("DELETE", `${table}?user_id=eq.${a.id}`, a.jeton);
  }
  await rest("DELETE", `documents?user_id=eq.${a.id}`, a.jeton);
  if (fichierDepose) {
    await fetch(`${URL_SUPABASE}/storage/v1/object/${BUCKET}/${cheminA}`, {
      method: "DELETE",
      headers: enTetes(a.jeton),
    });
  }
  const restes = [];
  for (const table of TABLES) {
    const { json } = await rest("GET", `${table}?select=*`, a.jeton);
    if (Array.isArray(json) && json.length > 0) restes.push(`${table} (${json.length})`);
  }
  noter("nettoyage", "aucune ligne d'essai laissée derrière", restes.length === 0, restes.join(", "));

  // ── Verdict ───────────────────────────────────────────────────────────────────────────────────
  const echecs = resultats.filter((r) => !r.reussi);
  console.log(`\n${"─".repeat(78)}`);
  console.log(`${resultats.length} contrôles · ${resultats.length - echecs.length} conformes · ${echecs.length} en échec`);
  if (echecs.length > 0) {
    console.log("\nL'ISOLATION N'EST PAS PROUVÉE. Ne pas poursuivre la refonte :");
    for (const e of echecs) console.log(`  · ${e.categorie} · ${e.intitule} ${e.detail}`);
    process.exit(1);
  }
  console.log("\nISOLATION PROUVÉE : un utilisateur ne peut ni voir, ni modifier, ni supprimer les");
  console.log("données d'un autre — ni en base, ni dans le stockage de fichiers, ni sans session.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nErreur inattendue :", err);
  process.exit(1);
});
