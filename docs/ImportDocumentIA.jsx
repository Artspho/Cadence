import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  KeyRound,
  Info,
} from "lucide-react";

const COLORS = {
  bg: "#0A0C10",
  surface: "#12161D",
  surfaceAlt: "#181D26",
  border: "#242A35",
  textPrimary: "#F4F6F8",
  textMuted: "#8A93A3",
  mint: "#3FD69B",
  amber: "#F5C46B",
  red: "#F2726B",
  teal: "#57A9F0",
  violet: "#9B8CFF",
};

const CONFIANCE_STYLE = {
  haute: { color: COLORS.mint, bg: "rgba(63,214,155,0.12)", label: "Confiance haute" },
  moyenne: { color: COLORS.amber, bg: "rgba(245,196,107,0.12)", label: "Confiance moyenne" },
  faible: { color: COLORS.red, bg: "rgba(242,114,107,0.12)", label: "Confiance faible" },
};

const CIBLE_LABEL = {
  contrat: "Nouveau contrat",
  profil_ouverture_droits: "Ouverture de droits (Profil)",
  profil_date_anniversaire: "Date anniversaire (Profil)",
  aj_reelle_historique: "Historique AJ réelle",
  info_seule: "Information (non enregistrée)",
};

const CHAMP_LABEL = {
  date: "Date de fin de contrat",
  dateDebut: "Date de début",
  type: "Type",
  typeRemuneration: "Nature",
  territoire: "Territoire",
  nbCachets: "Nb cachets",
  nbHeures: "Nb heures",
  nbJoursEEE: "Nb jours EEE",
  salaireBrut: "Salaire brut (€)",
  employeur: "Employeur",
  etablissementAgree: "Établissement agréé",
  enRapportAvecMetier: "En rapport avec le métier",
  dateOuverture: "Date d'ouverture des droits",
  franchiseCPTotale: "Franchise CP totale (jours)",
  delaiAttenteInitial: "Délai d'attente (jours)",
  dateAnniversaire: "Date anniversaire",
  dateEffet: "Date d'effet",
  valeur: "Montant (€)",
  natureMontant: "Nature du montant",
};

const DOC_TYPE_LABEL = {
  bulletin_paie: "Bulletin de paie",
  notification_admission: "Notification d'admission ARE",
  releve_situation: "Relevé de situation",
  declaration_fiscale_annuelle: "Déclaration fiscale annuelle",
  non_reconnu: "Document non reconnu",
};

const INSTRUCTIONS = `Tu es un extracteur de documents pour Cadence, une app d'aide à la
gestion des droits des artistes-interprètes intermittents du spectacle (régime Annexe 10,
France). Les documents que tu reçois sont : un bulletin de paie / contrat (GUSO ou employeur
direct), une notification d'admission ARE (France Travail), un relevé de situation (France
Travail), ou une déclaration fiscale annuelle (France Travail).

Pour chaque document, détecte le type puis produis une ou plusieurs "propositions d'écriture",
chacune ciblant un endroit précis du modèle de données de Cadence (schéma fourni) :

- "contrat" : un bulletin de paie -> un Contrat. Ne convertis jamais cachets <-> heures : reprends
  exactement l'unité utilisée dans le document.
- "profil_ouverture_droits" : une Notification d'admission -> dateOuverture, franchiseCPTotale
  (en JOURS, pas en euros), delaiAttenteInitial (en JOURS).
- "profil_date_anniversaire" : la date anniversaire officielle si présente dans le document.
- "aj_reelle_historique" : un montant d'allocation journalière daté. RÈGLE CRITIQUE : indique
  toujours la nature EXACTE du montant trouvé ("net" ou "brut") dans "natureMontant", d'après les
  mots mêmes du document — jamais une supposition, jamais de conversion automatique de ta part.
  Un relevé de situation dit typiquement "allocation brute" ; une notification d'admission dit
  typiquement "allocation journalière nette".
- "info_seule" : toute donnée utile pour vérifier ou recaler les calculs de l'app (salaire de
  référence officiel, NHT officiel, jours non indemnisés, taux d'imposition, montants bruts/nets
  du relevé, etc.) qui n'a pas de champ d'écriture direct connu à ce jour — ne la perds jamais,
  range-la simplement en "info_seule" plutôt que de l'inventer une destination.

Règles impératives :
- Jamais de valeur inventée : champ illisible ou absent -> pas de proposition pour ce champ, plutôt
  un message dans "avertissementsGeneraux".
- Chaque proposition porte une "confiance" par champ (haute/moyenne/faible) et une "justification"
  courte (où dans le document l'info a été trouvée).
- Dates au format ISO (AAAA-MM-JJ).
- N'extrais JAMAIS de coordonnées bancaires complètes, de numéro de sécurité sociale, ni d'adresse
  postale complète, même si présents dans le document — ignore-les entièrement.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    typeDocumentDetecte: {
      type: "string",
      enum: ["bulletin_paie", "notification_admission", "releve_situation", "declaration_fiscale_annuelle", "non_reconnu"],
    },
    propositions: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            title: "PropositionContrat",
            properties: {
              cible: { type: "string", enum: ["contrat"] },
              donnees: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  dateDebut: { type: "string" },
                  type: { type: "string", enum: ["artiste", "enseignement", "formation", "ptp"] },
                  typeRemuneration: { type: "string", enum: ["cachet", "heures"] },
                  territoire: { type: "string", enum: ["france", "eee_suisse_uk"] },
                  nbCachets: { type: "number" },
                  nbHeures: { type: "number" },
                  nbJoursEEE: { type: "number" },
                  salaireBrut: { type: "number" },
                  employeur: { type: "string" },
                  etablissementAgree: { type: "boolean" },
                  enRapportAvecMetier: { type: "boolean" },
                },
              },
              confiance: { type: "object" },
              justification: { type: "string" },
            },
            required: ["cible", "donnees", "confiance", "justification"],
          },
          {
            type: "object",
            title: "PropositionOuvertureDroits",
            properties: {
              cible: { type: "string", enum: ["profil_ouverture_droits"] },
              donnees: {
                type: "object",
                properties: {
                  dateOuverture: { type: "string" },
                  franchiseCPTotale: { type: "number" },
                  delaiAttenteInitial: { type: "number" },
                },
              },
              confiance: { type: "object" },
              justification: { type: "string" },
            },
            required: ["cible", "donnees", "confiance", "justification"],
          },
          {
            type: "object",
            title: "PropositionDateAnniversaire",
            properties: {
              cible: { type: "string", enum: ["profil_date_anniversaire"] },
              donnees: {
                type: "object",
                properties: { dateAnniversaire: { type: "string" } },
              },
              confiance: { type: "object" },
              justification: { type: "string" },
            },
            required: ["cible", "donnees", "confiance", "justification"],
          },
          {
            type: "object",
            title: "PropositionAjReelle",
            properties: {
              cible: { type: "string", enum: ["aj_reelle_historique"] },
              donnees: {
                type: "object",
                properties: {
                  dateEffet: { type: "string" },
                  valeur: { type: "number" },
                  natureMontant: { type: "string", enum: ["net", "brut", "indetermine"] },
                },
              },
              confiance: { type: "object" },
              justification: { type: "string" },
            },
            required: ["cible", "donnees", "confiance", "justification"],
          },
          {
            type: "object",
            title: "PropositionInfoSeule",
            properties: {
              cible: { type: "string", enum: ["info_seule"] },
              donnees: { type: "object" },
              confiance: { type: "object" },
              justification: { type: "string" },
            },
            required: ["cible", "donnees", "confiance", "justification"],
          },
        ],
      },
    },
    avertissementsGeneraux: { type: "array", items: { type: "string" } },
  },
  required: ["typeDocumentDetecte", "propositions", "avertissementsGeneraux"],
};

export default function ImportDocumentIA() {
  const [apiKey, setApiKey] = useState("");
  const [step, setStep] = useState("cle");
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({});
  const [editedDonnees, setEditedDonnees] = useState({});
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const fontBody = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };
  const fontDisplay = { fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" };

  function handleFileSelected(f) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setError("");
    setFile(f);
    setStep("consent");
  }

  function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function handleSendToAI() {
    setStep("loading");
    setError("");
    try {
      const base64 = await fileToBase64(file);
      // ⚠️ Appel Mistral Document AI (OCR + annotation structurée) directement
      // depuis le navigateur, pour tester en direct. Le support CORS de
      // api.mistral.ai pour ce type d'appel n'est pas confirmé — si ça échoue
      // avec une erreur réseau (pas une erreur JSON), c'est probablement ça :
      // tester alors via le vrai endpoint serveur (extract-document.ts).
      const response = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: { type: "document_url", document_url: `data:application/pdf;base64,${base64}` },
          document_annotation_format: { type: "json_schema", json_schema: { name: "ExtractionResult", schema: RESPONSE_SCHEMA } },
          document_annotation_prompt: INSTRUCTIONS,
        }),
      });
      const data = await response.json();
      const rawAnnotation = data?.document_annotation;
      if (!rawAnnotation) throw new Error(data?.message || "Réponse inattendue de l'API Mistral.");
      const parsed = typeof rawAnnotation === "string" ? JSON.parse(rawAnnotation) : rawAnnotation;
      setResult(parsed);
      const initSelected = {};
      const initEdited = {};
      (parsed.propositions || []).forEach((p, i) => {
        initSelected[i] = p.cible !== "info_seule";
        initEdited[i] = { ...p.donnees };
      });
      setSelected(initSelected);
      setEditedDonnees(initEdited);
      setStep("review");
    } catch (e) {
      setError(e.message || "L'extraction a échoué. Tu peux réessayer ou saisir manuellement.");
      setStep("error");
    }
  }

  function updateChamp(i, key, value) {
    setEditedDonnees((prev) => ({ ...prev, [i]: { ...prev[i], [key]: value } }));
  }

  function reset() {
    setStep("idle");
    setFile(null);
    setConsent(false);
    setResult(null);
    setSelected({});
    setEditedDonnees({});
    setError("");
  }

  if (step === "cle") {
    return (
      <div style={{ background: COLORS.bg, ...fontBody }} className="w-full min-h-[500px] rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center gap-5 text-center">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
        <div style={{ background: "rgba(155,140,255,0.12)" }} className="w-12 h-12 rounded-xl flex items-center justify-center">
          <KeyRound size={22} color={COLORS.violet} />
        </div>
        <div>
          <h2 style={{ color: COLORS.textPrimary, ...fontDisplay }} className="text-lg font-semibold mb-1">Clé API Mistral (test uniquement)</h2>
          <p style={{ color: COLORS.textMuted }} className="text-sm max-w-sm">
            Ce prototype appelle Mistral Document AI directement depuis le navigateur pour que
            tu puisses tester en direct. Le tier gratuit "Experiment" (console.mistral.ai)
            convient pour cette phase de tests. En production, la clé restera côté serveur,
            jamais exposée dans le navigateur.
          </p>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Colle ta clé API Mistral ici"
          style={{ background: COLORS.surface, color: COLORS.textPrimary, borderColor: COLORS.border }}
          className="w-full max-w-sm border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        />
        <div style={{ background: "rgba(245,196,107,0.08)", borderColor: COLORS.amber }} className="border rounded-xl p-4 flex items-start gap-3 text-left max-w-sm">
          <AlertTriangle size={16} color={COLORS.amber} className="shrink-0 mt-0.5" />
          <p style={{ color: COLORS.textPrimary }} className="text-xs leading-relaxed">
            Ok pour tester avec des documents non sensibles. Dès qu'un <strong>vrai document
            d'un vrai utilisateur</strong> passe dedans, vérifie d'abord dans la console Mistral
            que le tier gratuit garantit bien l'absence d'entraînement — sinon bascule sur une
            clé payante (~1 centime/document).
          </p>
        </div>
        <button
          disabled={!apiKey}
          onClick={() => setStep("idle")}
          style={{ background: apiKey ? COLORS.mint : COLORS.border, color: apiKey ? "#0A0C10" : COLORS.textMuted }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          Continuer
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, ...fontBody }} className="w-full min-h-[600px] rounded-2xl p-6 md:p-8">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>

      <div className="flex items-center gap-3 mb-2">
        <div style={{ background: "rgba(63,214,155,0.12)" }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
          <FileText size={20} color={COLORS.mint} />
        </div>
        <div>
          <h2 style={{ color: COLORS.textPrimary, ...fontDisplay }} className="text-lg font-semibold">Import assisté par IA (Mistral)</h2>
          <p style={{ color: COLORS.textMuted }} className="text-sm">Bulletins de paie & documents France Travail — sortie routée vers Cadence</p>
        </div>
      </div>
      <p style={{ color: COLORS.textMuted }} className="text-xs mb-8">
        Prototype fonctionnel — dépose un vrai PDF pour tester l'extraction en direct.
      </p>

      {step === "idle" && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileSelected(e.dataTransfer.files[0]); }}
          style={{ borderColor: COLORS.border, background: COLORS.surface }}
          className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition hover:brightness-110"
        >
          <Upload size={28} color={COLORS.teal} />
          <p style={{ color: COLORS.textPrimary, ...fontDisplay }} className="font-medium">Dépose un PDF ici, ou clique pour choisir un fichier</p>
          <p style={{ color: COLORS.textMuted }} className="text-sm text-center">Bulletin de paie, relevé de situation, notification d'admission, déclaration fiscale</p>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileSelected(e.target.files[0])} />
        </div>
      )}

      {error && step === "idle" && <p style={{ color: COLORS.red }} className="mt-3 text-sm">{error}</p>}

      {step === "consent" && file && (
        <div style={{ background: COLORS.surface, borderColor: COLORS.border }} className="border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} color={COLORS.textMuted} />
            <span style={{ color: COLORS.textPrimary }} className="text-sm font-medium truncate">{file.name}</span>
            <button onClick={reset} className="ml-auto shrink-0" style={{ color: COLORS.textMuted }} aria-label="Annuler"><X size={16} /></button>
          </div>
          <div className="flex items-start gap-3 mb-5">
            <ShieldCheck size={20} color={COLORS.violet} className="shrink-0 mt-0.5" />
            <div>
              <p style={{ color: COLORS.textPrimary }} className="text-sm font-medium mb-1">Avant d'envoyer ce document à l'IA</p>
              <p style={{ color: COLORS.textMuted }} className="text-sm leading-relaxed">
                Ce fichier sera envoyé à l'API Mistral Document AI pour en extraire les
                informations. Rien n'est enregistré dans ton tableau de bord avant que tu ne
                valides toi-même chaque proposition, à l'étape suivante.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-4 h-4 shrink-0" />
            <span style={{ color: COLORS.textPrimary }} className="text-sm">J'ai compris et j'accepte l'envoi de ce document à l'IA pour extraction.</span>
          </label>
          <div className="flex gap-3">
            <button
              disabled={!consent}
              onClick={handleSendToAI}
              style={{ background: consent ? COLORS.mint : COLORS.border, color: consent ? "#0A0C10" : COLORS.textMuted }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              Envoyer à l'IA
            </button>
            <button onClick={reset} style={{ color: COLORS.textMuted }} className="px-4 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div style={{ background: COLORS.surface }} className="rounded-2xl p-12 flex flex-col items-center gap-3">
          <Loader2 size={28} color={COLORS.teal} className="animate-spin" />
          <p style={{ color: COLORS.textPrimary }} className="text-sm font-medium">Analyse du document en cours…</p>
        </div>
      )}

      {step === "error" && (
        <div style={{ background: "rgba(242,114,107,0.08)", borderColor: COLORS.red }} className="border rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle size={20} color={COLORS.red} className="shrink-0 mt-0.5" />
          <div>
            <p style={{ color: COLORS.textPrimary }} className="text-sm font-medium mb-1">{error}</p>
            <button onClick={reset} style={{ color: COLORS.teal }} className="text-sm font-medium underline">Recommencer</button>
          </div>
        </div>
      )}

      {step === "review" && result && (
        <div className="space-y-5">
          <span style={{ background: "rgba(87,169,240,0.12)", color: COLORS.teal }} className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block">
            {DOC_TYPE_LABEL[result.typeDocumentDetecte] || "Type inconnu"}
          </span>

          {result.avertissementsGeneraux && result.avertissementsGeneraux.length > 0 && (
            <div style={{ background: "rgba(245,196,107,0.08)", borderColor: COLORS.amber }} className="border rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} color={COLORS.amber} className="shrink-0 mt-0.5" />
              <ul style={{ color: COLORS.textPrimary }} className="text-sm space-y-1 list-disc list-inside">
                {result.avertissementsGeneraux.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {(result.propositions || []).map((p, i) => {
            const donnees = editedDonnees[i] || {};
            const isInfoSeule = p.cible === "info_seule";
            const isAjRisquee =
              p.cible === "aj_reelle_historique" &&
              (donnees.natureMontant === "brut" || donnees.natureMontant === "indetermine");

            return (
              <div key={i} style={{ background: COLORS.surface, borderColor: isAjRisquee ? COLORS.red : COLORS.border }} className="border rounded-2xl overflow-hidden">
                <div style={{ borderColor: COLORS.border }} className="flex items-center gap-3 p-4 border-b">
                  {!isInfoSeule && (
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                      className="w-4 h-4 shrink-0"
                    />
                  )}
                  <span style={{ color: COLORS.textPrimary, ...fontDisplay }} className="text-sm font-semibold flex-1">
                    {CIBLE_LABEL[p.cible] || p.cible}
                  </span>
                  {isInfoSeule && <Info size={14} color={COLORS.textMuted} />}
                </div>

                {isAjRisquee && (
                  <div style={{ background: "rgba(242,114,107,0.1)" }} className="flex items-start gap-2 p-3 border-b">
                    <AlertTriangle size={14} color={COLORS.red} className="shrink-0 mt-0.5" />
                    <p style={{ color: COLORS.textPrimary }} className="text-xs leading-relaxed">
                      Ce document indique un montant <strong>{donnees.natureMontant === "brut" ? "BRUT" : "de nature indéterminée"}</strong>.
                      Cadence traite cet historique comme <strong>net</strong> — ne valide pas sans vérifier
                      toi-même la conversion (point non résolu, cf. SPEC).
                    </p>
                  </div>
                )}

                <div className="divide-y" style={{ borderColor: COLORS.border }}>
                  {Object.entries(donnees).map(([key, value]) => {
                    const conf = p.confiance?.[key] || "moyenne";
                    const confStyle = CONFIANCE_STYLE[conf] || CONFIANCE_STYLE.moyenne;
                    return (
                      <div key={key} style={{ borderColor: COLORS.border }} className="flex items-center justify-between gap-4 p-4">
                        <div className="flex-1 min-w-0">
                          <label style={{ color: COLORS.textMuted }} className="text-xs block mb-1">{CHAMP_LABEL[key] || key}</label>
                          <input
                            value={value ?? ""}
                            onChange={(e) => updateChamp(i, key, e.target.value)}
                            disabled={isInfoSeule}
                            style={{ background: COLORS.surfaceAlt, color: COLORS.textPrimary, borderColor: COLORS.border, ...fontDisplay }}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-60"
                          />
                        </div>
                        {!isInfoSeule && (
                          <span style={{ background: confStyle.bg, color: confStyle.color }} className="text-xs font-medium px-2 py-1 rounded-full shrink-0">
                            {confStyle.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {p.justification && (
                  <p style={{ color: COLORS.textMuted, borderColor: COLORS.border }} className="text-xs p-4 border-t">{p.justification}</p>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("done")}
              style={{ background: COLORS.mint, color: "#0A0C10" }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              Enregistrer les propositions cochées
            </button>
            <button onClick={reset} style={{ color: COLORS.textMuted }} className="px-4 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div style={{ background: "rgba(63,214,155,0.08)", borderColor: COLORS.mint }} className="border rounded-2xl p-6 flex items-center gap-3 flex-wrap">
          <CheckCircle2 size={20} color={COLORS.mint} className="shrink-0" />
          <p style={{ color: COLORS.textPrimary }} className="text-sm font-medium">Propositions enregistrées. Ton tableau de bord est à jour.</p>
          <button onClick={reset} style={{ color: COLORS.teal }} className="ml-auto text-sm font-medium underline">Importer un autre document</button>
        </div>
      )}
    </div>
  );
}
