/**
 * api/extract-document.ts (v4 — corrigé après retour Claude Code du 28/07/2026 :
 * champs réels confirmés, nouvelles cibles profil_infos/periode_assimilee,
 * type/territoire nullable, exclusions explicites, nommage AEM)
 *
 * Reçoit un PDF en base64, l'envoie à Mistral Document AI (endpoint OCR avec
 * annotation structurée) pour extraction, renvoie un ExtractionResult (voir
 * src/types/extraction.ts, schéma partagé avec le front). NE PERSISTE RIEN côté
 * serveur (stateless).
 *
 * Reconstruit le 28/07/2026 depuis la doc officielle Mistral :
 * - https://docs.mistral.ai/studio-api/document-processing/basic_ocr
 * - https://docs.mistral.ai/studio-api/document-processing/annotations
 *
 * ⚠️ Le format exact de `document_annotation_format` en JSON Schema brut
 * (curl) n'était pas développé sur la page récupérée — seul l'onglet Python
 * (Pydantic) l'était. La forme utilisée ici (`{ type: "json_schema",
 * json_schema: { name, schema } }`) suit la convention standard des autres
 * endpoints Mistral, mais N'A PAS été testée en direct. Premier test à faire
 * avec un simple `console.log(JSON.stringify(data))` avant de faire
 * confiance au parsing ci-dessous.
 *
 * Modèle : "mistral-ocr-latest" — alias officiel qui pointe toujours vers le
 * modèle OCR le plus récent (actuellement OCR 4), pas besoin de coder un
 * numéro de version en dur.
 */

import { zodToJsonSchema } from "zod-to-json-schema";
// Schéma partagé avec le front (écran de revue) — source unique, cf. l'en-tête du fichier.
import { extractionResultSchema, type ExtractionResult } from "../src/types/extraction";

/**
 * Runtime Edge (et non Node). Choix cohérent avec le code : le handler ci-dessous
 * utilise déjà la signature web standard `(req: Request) => Promise<Response>`,
 * qui est exactement celle du runtime Edge de Vercel. En runtime Node, Vercel
 * attendrait `(req: VercelRequest, res: VercelResponse)`.
 *
 * ⚠️ Limite à garder en tête avant le premier vrai document : le corps d'une
 * requête Edge est plafonné (~4 Mo sur Vercel). Un PDF en base64 pèse ~1,33× le
 * fichier d'origine, donc au-delà d'environ 3 Mo de PDF la requête sera rejetée
 * côté plateforme, avant même d'atteindre ce code. À traiter côté client
 * (message clair, voire compression) quand on branchera l'appel réseau.
 */
export const config = { runtime: "edge" };

const MISTRAL_MODEL = "mistral-ocr-latest";

// ⚠️ Pendant les tests (phase actuelle) : clé du tier gratuit "Experiment" de
// La Plateforme (console.mistral.ai), aucune carte bancaire nécessaire.
// AVANT tout document réel d'un vrai utilisateur (même Benoît en test réel) :
// vérifier dans la console si le tier gratuit garantit bien l'absence
// d'entraînement sur les données envoyées (l'engagement contractuel trouvé
// dans nos recherches est explicitement rattaché aux abonnements payants,
// pas confirmé pour le tier gratuit) — cf. brief_claude_code_documents_premium.md.
// Si ce n'est pas garanti, passer sur une clé payante (~1 centime/document).

const INSTRUCTIONS = `Tu es un extracteur de documents pour Cadence, une app d'aide à la gestion des droits des
artistes-interprètes intermittents du spectacle (régime Annexe 10, France). Documents reçus :
bulletin de paie, AEM (Attestation d'Employeur Mensuelle — la pièce qui fait foi, pas « l'AER »),
notification d'admission ARE (France Travail), relevé de situation (France Travail), déclaration
fiscale annuelle, attestation CPAM.

Détecte le type du document, puis produis des propositions d'écriture vers les cibles du schéma.

════════ COMMENT CHOISIR LA CIBLE : UN TEST, PAS UNE IMPRESSION ════════

Pour chaque donnée lue, réponds à deux questions :
  1. Correspond-elle à un champ nommé du schéma ? (voir le LEXIQUE ci-dessous)
  2. Le document l'énonce-t-il explicitement — au point que tu peux CITER les mots du document
     qui la nomment ?

DEUX FOIS OUI  → tu DOIS utiliser la cible structurée, et recopier la citation dans
                 « justification ». Ranger en « info_seule » une donnée explicite est une ERREUR
                 D'EXTRACTION, aussi grave qu'inventer une valeur.
SINON          → « info_seule ».

« info_seule » est la destination RÉSIDUELLE : données sans champ correspondant dans le schéma, ou
dont le sens est ambigu. Ce n'est PAS un refuge prudent. N'y range jamais une donnée dont tu peux
à la fois citer le libellé et nommer le champ.

Attention : ce test ne t'autorise jamais à combler un trou. Si tu ne peux pas citer, tu ne
remplis pas. Précision et prudence vont ensemble — elles ne s'échangent pas l'une contre l'autre.

════════ LEXIQUE : CE QUE DIT LE DOCUMENT → LE CHAMP À REMPLIR ════════

NOTIFICATION D'ADMISSION ARE / RELEVÉ DE SITUATION

  « Le montant de votre allocation journalière nette est de X euros »
        → aj_reelle_historique : valeur = X, natureMontant = "net"
  « allocation brute », « montant brut journalier »
        → aj_reelle_historique : valeur, natureMontant = "brut"

  RÈGLE DE LECTURE pour dateEffet (champ OBLIGATOIRE) : la date d'effet de l'allocation est la date
  à partir de laquelle le document dit que tu es indemnisable, énoncée DANS LE MÊME DOCUMENT. La
  reprendre n'est pas une invention, c'est la lecture normale du document — ne renonce jamais à la
  cible structurée pour ce motif. Si et seulement si aucune telle date n'y figure → « info_seule ».

  « Vous êtes indemnisable à partir du DATE »
        → profil_ouverture_droits.dateOuverture  (et dateEffet de l'allocation, cf. ci-dessus)
  « N jours de franchise congés payés »
        → profil_ouverture_droits.franchiseCPTotale = N   (un nombre de JOURS, pas un montant)
  « N jours de délai d'attente »
        → profil_ouverture_droits.delaiAttenteInitial = N  (presque toujours 7)
  « taux de prélèvement à la source : X % »
        → profil_ouverture_droits.tauxPrelevementSource = X
        Le document peut MENTIONNER le prélèvement à la source sans donner de taux : dans ce cas,
        laisse null. La mention n'est pas un chiffre.

  dateLimiteIndemnisation — DEUX FORMULATIONS ÉQUIVALENTES, selon le document :
        « La date limite de votre indemnisation est le X »        (relevé de situation)
        « jusqu'à votre date anniversaire, soit le : X inclus »   (notification d'admission)
        → profil_ouverture_droits.dateLimiteIndemnisation = X, dans les DEUX cas.
        Vérifié : sur deux documents réels d'un même dossier (notification et relevé de situation),
        ces deux phrases portent la MÊME date. Ce sont deux façons de dire le même fait.

  ⚠️⚠️ PIÈGE — UNE SEULE PHRASE, DEUX CHAMPS DIFFÉRENTS
  Une notification contient une phrase de la forme :
     « Vos droits sont ouverts sur la base de la fin de votre contrat de travail du DATE_A
       ayant permis l'ouverture de vos droits jusqu'à votre date anniversaire,
       soit le : DATE_B inclus »
  Elle énonce DEUX dates séparées d'environ un an, et elles vont dans DEUX champs distincts :
     • DATE_A — « fin de votre contrat de travail du … »
           → profil_infos.dateAnniversaire
     • DATE_B — « jusqu'à votre date anniversaire, soit le … »
           → profil_ouverture_droits.dateLimiteIndemnisation
  Ne les échange JAMAIS. Le champ Cadence dateAnniversaire porte le même nom que DATE_B mais
  désigne DATE_A : IGNORE le mot « anniversaire » tel que l'emploie le document, fie-toi
  uniquement à « fin de votre contrat de travail ». Ne confonds pas non plus dateAnniversaire
  avec dateNaissance.

  « né(e) le », date de naissance
        → profil_infos.dateNaissance
  « première admission » / « réadmission », « reprise de droits »
        → profil_infos.situation
  « durée de vos droits : 12 mois » / « 6 mois », écrit LITTÉRALEMENT en mois
        → profil_infos.dureeDroitsMois
        Ne le déduis JAMAIS d'un intervalle entre deux dates, même si cet intervalle fait
        exactement douze mois, même si les deux dates sont explicites. Si le nombre de mois n'est
        pas écrit en clair, laisse null. Aucune arithmétique sur les dates n'est autorisée ici.

  À ranger en « info_seule » (aucun champ dans le schéma — c'est le bon usage d'info_seule) :
  salaire journalier de référence, salaire de référence, nombre d'heures retenues (NHT), nombre de
  jours travaillés et la période de référence associée (ex. « 57 jours travaillés dans la période
  du 24 mars 2025 au 17 janvier 2026 »), jours non indemnisés, totaux mensuels versés.

BULLETIN DE PAIE / AEM

  période d'emploi   → contrat.dateDebut et contrat.date

  Format GHS/sPAIEctacle fréquent : « Période du X au Y » (ou « Période d'emploi du X au Y »)
  → X = contrat.dateDebut, Y = contrat.date. Même cible que « période d'emploi » ci-dessus, ce
  n'est qu'une autre formulation de la même donnée — ne la range jamais en « info_seule » sous
  prétexte que le mot « période d'emploi » n'apparaît pas littéralement.
  brut total         → contrat.salaireBrut (bruts AVANT abattement frais professionnels)
  nombre de cachets  → contrat.nbCachets
  nombre d'heures    → contrat.nbHeures
        Ne convertis JAMAIS cachets en heures ni l'inverse. Si le document montre des heures, reste
        en heures. Si le nombre de cachets n'est pas écrit, ne le déduis pas du montant brut.
  employeur          → contrat.employeur

  Un bulletin GHS/sPAIEctacle présente parfois ces données sous forme de tableau plutôt qu'en
  phrase — même cible, ne traite pas différemment :
     • une ligne de tableau du type « Cachets | 1,00 » (ou une colonne « Cachets » avec une
       quantité en face) → contrat.nbCachets, exactement comme « nombre de cachets » en prose.
     • « MONTANT BRUT » en intitulé de colonne ou de ligne de tableau → contrat.salaireBrut,
       exactement comme « brut total ».

  activité artiste explicite : une ligne comme « Cachets isolés représentations » (ou toute
  ligne nommant des cachets de représentation/concert/spectacle) décrit l'ACTIVITÉ elle-même →
  contrat.type = "artiste", à utiliser comme justification (cf. CAS 4 ci-dessous). Une ligne
  purement administrative comme « Emploi Artiste Musicien » ne suffit pas seule (voir règle
  contrat.type ci-dessous).

  typeRemuneration est DISTINCT de type — c'est le mode de rémunération, pas l'activité :
     • une ligne comme « Cachets isolés représentations » permet de remplir les DEUX :
       type = "artiste" ET typeRemuneration = "cachet" — ce sont deux propositions séparées,
       pas une.
     • ne déduis JAMAIS typeRemuneration depuis nbCachets seul : la présence d'un nombre de
       cachets ne prouve pas que le mode de paiement est "cachet" plutôt que "heures".

  contrat.type — RÈGLE D'ACTIVITÉ, pas de statut. Ne renseigne ce champ que si le document décrit
  l'ACTIVITÉ elle-même :
     • "artiste"      : cachets de représentation, concert, spectacle, enregistrement — une
                        prestation artistique nommée.
     • "enseignement" : heures de cours, intervention pédagogique, nom d'un établissement
                        d'enseignement.
  Une simple ligne administrative de statut ou de catégorie d'emploi (« Statut : Artiste »,
  « Emploi : Artiste Musicien », « catégorie »), SEULE et sans description d'activité, NE SUFFIT
  PAS : laisse null et range la mention en « info_seule ».
  Motif : le statut administratif et la nature de l'activité ne coïncident pas toujours — des
  heures de cours peuvent être payées par un employeur du spectacle sous statut artiste. Et ce
  champ décide des règles de décompte des 507 h et du plafond enseignement 70/120 h : s'y tromper
  fausse le décompte.

  contrat.territoire : laisse null sauf mention explicite d'un pays ou d'une zone. Un bulletin ne
  l'indique presque jamais — null est ici la BONNE réponse, pas un échec.

  contrat.etablissementAgree — NE JAMAIS DÉDUIRE true DE LA SEULE PRÉSENCE D'UN NOM D'ÉTABLISSEMENT
  D'ENSEIGNEMENT. « Agréé » est un statut administratif précis, presque jamais écrit noir sur blanc
  sur un bulletin de paie. Ne mets true QUE si le mot « agréé » ou « agrément » (ou une mention
  explicite équivalente, ex. « établissement agréé par l'État ») figure LITTÉRALEMENT dans le
  document à propos de cet établissement.
     • « Conservatoire à rayonnement régional de X », « École de musique Y », « Académie Z », un nom
       de collège ou d'université : ce sont des NOMS, pas des agréments → null.
     • Le mot n'apparaît pas → null. Ce null est la BONNE réponse, pas un échec.
  Motif : ce champ conditionne (avec enRapportAvecMetier) la prise en compte des heures
  d'enseignement dans les 507 h. Un true inventé y ferait entrer des heures qui n'y ont pas droit —
  donc un compteur 507 h trop élevé, et un feu vert que l'utilisateur n'a pas.

════════ QUATRE ERREURS OBSERVÉES, À NE PAS REFAIRE ════════

CAS 1 — allocation rangée au mauvais endroit
  mauvais : le document dit « Le montant de votre allocation journalière nette est de 53,81 euros »
            et « Vous êtes indemnisable à partir du 18 janvier 2026 » ; extraction produite :
            info_seule { montantAllocationNette: 53.81 }.
  attendu : aj_reelle_historique { dateEffet: "2026-01-18", valeur: 53.81, natureMontant: "net" }.

CAS 2 — les deux dates de la phrase piège échangées (erreur d'un an)
  document : « … fin de votre contrat de travail du 17 janvier 2026 ayant permis l'ouverture de vos
             droits jusqu'à votre date anniversaire, soit le : 17 janvier 2027 inclus »
  mauvais : profil_infos { dateAnniversaire: "2027-01-17" }
  attendu : profil_infos { dateAnniversaire: "2026-01-17" }
            ET profil_ouverture_droits { dateLimiteIndemnisation: "2027-01-17" }

CAS 3 — confiance incohérente
  mauvais : un champ laissé à null, déclaré absent du document, mais accompagné de
            confiance: "haute".
  attendu : n'inscris une confiance QUE pour les champs que tu as effectivement renseignés. Un
            champ à null n'a pas de confiance.

CAS 4 — statut administratif pris pour une activité
  document : « Statut Artiste », « Emploi Artiste Musicien », et par ailleurs « 1 Cachets isolés
             représentations ».
  correct   : contrat.type = "artiste", justifié par « Cachets isolés représentations » (l'activité).
  incorrect : contrat.type = "artiste" justifié par la seule ligne « Statut Artiste ».
  incorrect : un bulletin où seule une ligne « Statut » existe, sans activité décrite → type doit
              rester null.

════════ RÈGLES DE SÛRETÉ (elles priment sur tout le reste) ════════

- Jamais de valeur inventée. Champ illisible ou absent → null s'il est nullable, sinon pas de
  proposition du tout. Doute réel → « info_seule » + un mot dans « avertissementsGeneraux ».
- natureMontant : la nature EXACTE écrite dans le document, mot pour mot. Jamais une supposition,
  jamais de conversion de ta part. Si le document ne dit ni « net » ni « brut » → "indetermine".
- periode_assimilee : si c'est un arrêt de travail CPAM sans précision permettant de trancher entre
  "ald" et "maladie_intercontrat" (effets OPPOSÉS sur le décompte des 507 h), NE PRODUIS PAS de
  periode_assimilee → « info_seule » avec les dates + un avertissement demandant à l'utilisateur de
  choisir lui-même. Ne devine jamais ce champ.
- « justification » contient toujours une citation du document.
- Dates au format ISO (AAAA-MM-JJ).
- N'extrais JAMAIS de coordonnées bancaires, de numéro de sécurité sociale (NIR), ni d'adresse
  postale complète, même présents dans le document — ignore-les entièrement.

JAMAIS À PROPOSER : regimeDeclare (auto-déclaré par l'utilisateur, jamais déduit d'un scan),
salairesHorsAnnexe10PRA seul, toute constante réglementaire (plafonds enseignement/formation,
barèmes), activiteHorsAnnexe10 (déprécié), la date de départ d'affichage (choix de l'utilisateur).

════════ RELECTURE AVANT DE RÉPONDRE ════════

1. Relis chaque proposition « info_seule » : cette donnée correspond-elle à un champ nommé du
   LEXIQUE ? Si oui, DÉPLACE-LA vers sa cible structurée.
2. Si tu as rempli dateAnniversaire, vérifie que la date retenue est celle de la FIN DE CONTRAT DE
   TRAVAIL, et non celle qui suit les mots « date anniversaire » dans le document.
3. Si la phrase piège est présente, vérifie que ses DEUX dates ont été placées : DATE_A dans
   dateAnniversaire, DATE_B dans dateLimiteIndemnisation.
4. Si tu as rempli dureeDroitsMois, vérifie que le nombre de mois est écrit en clair dans le
   document. Sinon, remets-le à null.
5. Si tu as rempli contrat.type, vérifie que ta justification cite une ACTIVITÉ et non une simple
   ligne de statut.
6. Vérifie que chaque « justification » contient une citation, et que tu n'as inscrit de confiance
   que pour les champs effectivement renseignés.`;

/**
 * Erreur de configuration du serveur (clé API absente) — distincte d'un échec
 * d'extraction. Elle ne dépend pas du document envoyé : le message peut donc
 * être renvoyé tel quel au client sans risque de fuite de données personnelles.
 */
export class ConfigurationManquanteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationManquanteError";
  }
}

export async function extractDocument(pdfBase64: string): Promise<ExtractionResult> {
  // Garde explicite : sans cette vérification, une clé absente partait en
  // `Bearer ` vide, Mistral répondait 401, et l'utilisateur voyait un 500
  // générique « Réessaie » — alors que réessayer n'y changera rien.
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new ConfigurationManquanteError(
      "MISTRAL_API_KEY n'est pas définie côté serveur : l'import de document est " +
        "indisponible. Aucun document n'a été envoyé. Définis la variable " +
        "d'environnement (voir .env.example) puis redéploie."
    );
  }

  // Dialecte JSON Schema draft-07, sans `$ref` interne.
  //
  // Pourquoi cette forme : `{ target: "openApi3" }` (la forme d'avant) produit un
  // dialecte OpenAPI 3 avec deux écarts au JSON Schema standard — 19 nullables
  // écrits `"nullable": true`, et 5 `$ref` vers le pointeur profond
  // `#/properties/propositions/items/anyOf/0/properties/confiance/additionalProperties`,
  // que tous les validateurs ne résolvent pas.
  //
  // VÉRIFIÉ — comparaison exhaustive des deux schémas générés (29/07/2026) :
  //   • 22 descriptions avant, 22 après, contenus rigoureusement identiques ;
  //   • 55 champs obligatoires avant, 55 après, listes rigoureusement identiques,
  //     et aucun champ ne devient obligatoire ;
  //   • la nullabilité n'est pas perdue, elle est réécrite en branche `null` explicite
  //     (`["boolean","null"]`, ou `anyOf[…, { type: "null" }]` pour les enums).
  //   Ce changement ne perd donc aucune information.
  //
  // VÉRIFIÉ — appel réel à l'API Mistral (29/07/2026, PDF bidon sans aucune donnée
  // personnelle, les deux dialectes envoyés tour à tour) : statut 200 dans les DEUX
  // cas, et comportement identique (typeDocumentDetecte "non_reconnu", 0 proposition).
  // Les trois points qui restaient en doute sont donc levés : Mistral accepte la clé
  // racine `$schema`, le `const` sur le discriminant `cible` (là où openApi3 écrivait
  // `enum: ["contrat"]`), et les `additionalProperties` libres (`confiance`,
  // `info_seule.donnees`).
  //
  // À ne pas se raconter pour autant : ce changement n'a RIEN réparé. La forme
  // openApi3 était acceptée elle aussi, et la crainte d'un rejet au premier envoi —
  // héritée des notes du 28/07 — ne s'est pas matérialisée. On garde draft-07 parce
  // que c'est du JSON Schema standard : lisible par n'importe quel validateur, et
  // moins exposé si Mistral durcit un jour sa validation. Pas parce que l'autre
  // forme cassait quelque chose.
  //
  // ⚠️ CE QUI RESTE NON VÉRIFIÉ, et qui est ailleurs : le comportement de ce chemin
  // sur de VRAIS documents. Le prompt et le lexique ont été mis au point dans le
  // Playground, et l'appel via l'app n'a été éprouvé que sur un PDF absurde, dont la
  // bonne réponse était « rien à proposer ». Le premier document réel sera la
  // première vraie épreuve du couple prompt + schéma.
  const schema = zodToJsonSchema(extractionResultSchema, { $refStrategy: "none" });

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      document: {
        type: "document_url",
        // Mistral accepte une URL publique OU une data URI base64 dans le
        // même champ `document_url` (confirmé pour les images ; à vérifier
        // que le PDF suit exactement la même convention avant le premier test).
        document_url: `data:application/pdf;base64,${pdfBase64}`,
      },
      document_annotation_format: {
        type: "json_schema",
        json_schema: { name: "ExtractionResult", schema },
      },
      document_annotation_prompt: INSTRUCTIONS,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }

  const data = await response.json();

  // document_annotation peut arriver en objet déjà parsé ou en chaîne JSON
  // selon la version de l'API — on gère les deux, prudence oblige.
  const rawAnnotation = data?.document_annotation;
  if (!rawAnnotation) {
    throw new Error("Réponse inattendue de l'API Mistral (pas d'annotation de document).");
  }
  const parsedJson = typeof rawAnnotation === "string" ? JSON.parse(rawAnnotation) : rawAnnotation;

  // Validation Zod côté serveur aussi : garde-fou si le modèle dérive du schéma
  // malgré le mode structuré (arrive rarement, mais "jamais de faux feu vert").
  return extractionResultSchema.parse(parsedJson);
}

// ─── Handler HTTP (exemple générique Vercel/Cloudflare Functions) ──────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // TODO (Phase 4) : vérifier ici que la requête vient d'un utilisateur
  // premium valide (cf. verify-subscription.ts) avant d'appeler extractDocument.

  try {
    const { pdfBase64 } = (await req.json()) as { pdfBase64: string };
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 manquant" }), { status: 400 });
    }

    const result = await extractDocument(pdfBase64);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Cas 1 : le serveur est mal configuré. Ce n'est pas un échec d'extraction,
    // et réessayer ne servirait à rien — on le dit clairement (503 = service
    // indisponible), avec un message qui ne contient aucune donnée du document.
    if (err instanceof ConfigurationManquanteError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Cas 2 : tout le reste. Ne jamais renvoyer le contenu du document dans un
    // message d'erreur.
    return new Response(
      JSON.stringify({ error: "Échec de l'extraction. Réessaie ou saisis manuellement." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
