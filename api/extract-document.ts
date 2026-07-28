/**
 * api/extract-document.ts (v4 — corrigé après retour Claude Code du 28/07/2026 :
 * champs réels confirmés, nouvelles cibles profil_infos/periode_assimilee,
 * type/territoire nullable, exclusions explicites, nommage AEM)
 *
 * Reçoit un PDF en base64, l'envoie à Mistral Document AI (endpoint OCR avec
 * annotation structurée) pour extraction, renvoie un ExtractionResult (voir
 * extraction-schema.ts). NE PERSISTE RIEN côté serveur (stateless).
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
import { extractionResultSchema, type ExtractionResult } from "./extraction-schema";

const MISTRAL_MODEL = "mistral-ocr-latest";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// ⚠️ Pendant les tests (phase actuelle) : clé du tier gratuit "Experiment" de
// La Plateforme (console.mistral.ai), aucune carte bancaire nécessaire.
// AVANT tout document réel d'un vrai utilisateur (même Benoît en test réel) :
// vérifier dans la console si le tier gratuit garantit bien l'absence
// d'entraînement sur les données envoyées (l'engagement contractuel trouvé
// dans nos recherches est explicitement rattaché aux abonnements payants,
// pas confirmé pour le tier gratuit) — cf. brief_claude_code_documents_premium.md.
// Si ce n'est pas garanti, passer sur une clé payante (~1 centime/document).

const INSTRUCTIONS = `Tu es un extracteur de documents pour Cadence, une app d'aide à la
gestion des droits des artistes-interprètes intermittents du spectacle (régime Annexe 10,
France). Les documents que tu reçois sont : un bulletin de paie ou une AEM (Attestation
d'Employeur Mensuelle — la pièce qui fait foi, pas "l'AER"), une notification d'admission ARE
(France Travail), un relevé de situation (France Travail), une déclaration fiscale annuelle
(France Travail), ou une attestation CPAM (arrêt de travail, maternité, accident du travail).

Pour chaque document, détecte le type puis produis une ou plusieurs "propositions d'écriture",
chacune ciblant un endroit précis du modèle de données de Cadence (schéma fourni) :

- "contrat" : un bulletin de paie ou une AEM -> un Contrat. Ne convertis jamais cachets <-> heures.
  "type" et "territoire" sont volontairement nullable : un bulletin de paie n'indique presque
  jamais artiste vs enseignement, ni le territoire — laisse null plutôt que d'inventer.
- "profil_ouverture_droits" : une Notification d'admission -> dateOuverture, franchiseCPTotale
  (JOURS), delaiAttenteInitial (JOURS), dateLimiteIndemnisation (le document dit littéralement
  "La date limite de votre indemnisation est le..."), tauxPrelevementSource (%).
- "profil_infos" : dateAnniversaire, dateNaissance, dateAnniversairePrecedente, situation
  (premiere_admission/readmission), dureeDroitsMois (12 ou 6) — trouvés sur la notification ou,
  pour dateNaissance, parfois sur un bulletin de paie/avis d'imposition.
- "periode_assimilee" : maternité, adoption, accident du travail, suspension de contrat -> type,
  dateDebut, dateFin. RÈGLE CRITIQUE : si le document est un simple arrêt de travail CPAM SANS
  précision permettant de trancher entre "ald" et "maladie_intercontrat" (effets opposés sur le
  décompte), NE PRODUIS PAS de proposition "periode_assimilee" — produis un "info_seule" avec les
  dates et un avertissement demandant à l'utilisateur de choisir manuellement. Ne devine jamais
  ce champ.
- "aj_reelle_historique" : un montant d'allocation journalière daté. RÈGLE CRITIQUE : indique
  toujours la nature EXACTE du montant trouvé ("net" ou "brut") dans "natureMontant", d'après les
  mots mêmes du document — jamais une supposition, jamais de conversion automatique de ta part.
  Un relevé de situation dit typiquement "allocation brute" ; une notification d'admission dit
  typiquement "allocation journalière nette".
- "info_seule" : toute donnée utile pour vérifier ou recaler les calculs de l'app (salaire de
  référence officiel, NHT officiel, jours non indemnisés, taux d'imposition, montants bruts/nets
  du relevé, périodes assimilées ambiguës, etc.) qui n'a pas de destination sûre — ne la perds
  jamais, range-la en "info_seule" plutôt que d'inventer une destination ou une valeur.

Champs et catégories JAMAIS à proposer, quel que soit le document :
- "regimeDeclare" : signalé par l'utilisateur uniquement, jamais déduit d'un scan.
- "salairesHorsAnnexe10PRA" : proposer ce champ seul crée une contradiction avec regimeDeclare —
  ne le propose jamais dans cette version.
- Toute constante réglementaire (plafonds enseignement/formation, barèmes) : ce sont des
  paramètres de configuration de l'app, jamais des données à extraire d'un document utilisateur.
- "activiteHorsAnnexe10" : champ déprécié.
- Le point de départ d'affichage ("date de départ") : c'est un choix de l'utilisateur, aucun
  document ne le contient — ne propose jamais ce champ.

Règles impératives :
- Jamais de valeur inventée : champ illisible, absent, ou ambigu -> pas de proposition pour ce
  champ, plutôt un message dans "avertissementsGeneraux" ou une proposition "info_seule".
- Chaque proposition porte une "confiance" par champ (haute/moyenne/faible) et une "justification"
  courte (où dans le document l'info a été trouvée).
- Dates au format ISO (AAAA-MM-JJ).
- N'extrais JAMAIS de coordonnées bancaires complètes, de numéro de sécurité sociale (NIR), ni
  d'adresse postale complète, même si présents dans le document — ignore-les entièrement.`;

export async function extractDocument(pdfBase64: string): Promise<ExtractionResult> {
  const schema = zodToJsonSchema(extractionResultSchema, { target: "openApi3" });

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY ?? ""}`,
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
    // Ne jamais renvoyer le contenu du document dans un message d'erreur.
    return new Response(
      JSON.stringify({ error: "Échec de l'extraction. Réessaie ou saisis manuellement." }),
      { status: 500 }
    );
  }
}
