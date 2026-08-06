import { useState } from "react";
import type { CategorieFrais, Depense, StatutJustificatif } from "../../types/fraisReels";
import { CATEGORIES_ORDONNEES, LIBELLES_CATEGORIE_COMPLETS } from "./categorieLabels";
import { calculerStatutJustificatif } from "../../lib/statutJustificatif";
import { remplacerDocument } from "../../storage/documentsStorage";
import type { ClientDocuments, ClientFichiers } from "../../auth/supabaseClient";

interface DepenseFormProps {
  anneeFiscale: number;
  valeurInitiale?: Depense; // édition si présent, ajout sinon
  ratioLocalPro: number | null; // config.localPro.surfaceProM2/surfaceTotalM2, null si non renseigné
  nombreRepasC3Actif: boolean; // config.nombreRepasC3 renseigné (> 0)
  /** Compte obligatoire (05/08/2026) : toujours résolu par App.tsx avant que cet écran soit atteignable. */
  utilisateurId: string;
  clientDocuments: ClientDocuments | null;
  clientFichiers: ClientFichiers | null;
  onValider: (depense: Omit<Depense, "id">) => void;
  onSupprimer?: () => void;
  onAnnuler: () => void;
}

export function DepenseForm({ anneeFiscale, valeurInitiale, ratioLocalPro, nombreRepasC3Actif, utilisateurId, clientDocuments, clientFichiers, onValider, onSupprimer, onAnnuler }: DepenseFormProps) {
  const [date, setDate] = useState(valeurInitiale?.date ?? "");
  const [categorie, setCategorie] = useState<CategorieFrais>(valeurInitiale?.categorie ?? "C1");
  const [description, setDescription] = useState(valeurInitiale?.description ?? "");
  const [montantTotal, setMontantTotal] = useState(valeurInitiale?.montantTotal?.toString() ?? "");
  const [remboursementEmployeur, setRemboursementEmployeur] = useState(valeurInitiale?.remboursementEmployeur?.toString() ?? "0");
  const [partProPct, setPartProPct] = useState(Math.round((valeurInitiale?.partPro ?? 1) * 100).toString());
  const [justificatifNom, setJustificatifNom] = useState(valeurInitiale?.justificatifNom);
  const [documentId, setDocumentId] = useState(valeurInitiale?.documentId);
  const [notes, setNotes] = useState(valeurInitiale?.notes ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const partProEffectivePct = categorie === "C6" && ratioLocalPro !== null ? Math.round(ratioLocalPro * 100) : Number(partProPct) || 0;
  const partProVerrouillee = categorie === "C6" && ratioLocalPro !== null;

  const montantTotalNum = parseFloat(montantTotal) || 0;
  const remboursementNum = parseFloat(remboursementEmployeur) || 0;
  const montantDeductible = Math.max(0, (montantTotalNum - remboursementNum) * (partProEffectivePct / 100));

  // `documentId` (nouveau) OU un reliquat de lecture (justificatifData/driveFileId, jamais réécrits
  // depuis ce commit, cf. types/fraisReels.ts) comptent tous les deux comme « fourni » : une dépense
  // enregistrée avant ce commit ne doit pas soudain paraître sans justificatif.
  const aUnJustificatif = Boolean(documentId) || Boolean(valeurInitiale?.justificatifData) || Boolean(valeurInitiale?.driveFileId);
  const statutJustificatif = calculerStatutJustificatif(categorie, aUnJustificatif);

  /**
   * Dépose (ou remplace) le justificatif sur Supabase Storage — la SEULE destination depuis le
   * commit 6 de la phase 6 (05/08/2026, retrait complet de Google Drive et du repli localStorage).
   * `remplacerDocument` ne retire l'ancien fichier qu'APRÈS que le nouveau a réussi (devoir n°1).
   */
  async function onFichierChoisi(fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur("Fichier trop volumineux (max 5 Mo).");
      return;
    }
    if (!clientDocuments || !clientFichiers) {
      setErreur("Le stockage n'est pas disponible pour l'instant — réessaie dans un instant.");
      return;
    }

    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const resultat = await remplacerDocument(clientFichiers, clientDocuments, documentId ?? null, {
        utilisateurId,
        fichier,
        typeDocument: "justificatif_frais",
        categorieFrais: categorie,
        anneeFiscale,
        dateDocument: date || undefined,
      });
      if (resultat.statut === "echec") {
        setErreur(`Envoi impossible : ${resultat.message}`);
        return;
      }
      if (resultat.statut === "ficherEnvoyeLigneEchouee") {
        // Le fichier est bien parti, mais sa ligne n'a pas pu être créée : `documentId` resterait
        // inutilisable (rien à retrouver dans « Mon dossier »), donc on le dit comme un échec plutôt
        // que de prétendre avoir un justificatif exploitable (devoir n°2).
        setErreur(`Le fichier a été envoyé mais n'a pas pu être enregistré : ${resultat.message}`);
        return;
      }
      setDocumentId(resultat.id);
      setJustificatifNom(fichier.name);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !description.trim() || montantTotalNum <= 0) return;
    onValider({
      anneeFiscale,
      date,
      categorie,
      description: description.trim(),
      montantTotal: montantTotalNum,
      remboursementEmployeur: remboursementNum,
      partPro: partProEffectivePct / 100,
      montantDeductible: Math.round(montantDeductible * 100) / 100,
      statutJustificatif,
      justificatifNom,
      documentId,
      // Reliquats de lecture, jamais modifiés par ce formulaire — préservés tels quels pour ne pas
      // effacer la référence d'un justificatif déposé avant ce commit (cf. types/fraisReels.ts).
      justificatifData: valeurInitiale?.justificatifData,
      driveFileId: valeurInitiale?.driveFileId,
      driveWebViewLink: valeurInitiale?.driveWebViewLink,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="titre-depense-form">
      <form onSubmit={soumettre} className="bg-surface border border-line rounded-hero p-6 max-w-[560px] w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 id="titre-depense-form" className="font-display text-lg font-semibold tracking-tight">
          {valeurInitiale ? "Modifier la dépense" : "Ajouter une dépense"}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-date">
              Date
            </label>
            <input id="dep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-categorie">
              Catégorie
            </label>
            <select id="dep-categorie" value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieFrais)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2">
              {CATEGORIES_ORDONNEES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLES_CATEGORIE_COMPLETS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-description">
            Description
          </label>
          <input id="dep-description" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="ex. SNCF Paris-Lyon, cours de chant..." className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>

        {categorie === "C3" && nombreRepasC3Actif && (
          <p className="text-xs text-amber bg-amber/10 rounded-lg px-3 py-2">
            Tu utilises le forfait repas — cette dépense individuelle ne sera pas prise en compte dans le total C3 (le forfait s'applique à la place, cf. réglages forfaits).
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-montant">
              Montant total TTC (€)
            </label>
            <input id="dep-montant" type="number" min="0" step="0.01" value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-remb">
              Remboursement employeur (€)
            </label>
            <input id="dep-remb" type="number" min="0" step="0.01" value={remboursementEmployeur} onChange={(e) => setRemboursementEmployeur(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-partpro">
            Part professionnelle (%)
          </label>
          <input
            id="dep-partpro"
            type="range"
            min="0"
            max="100"
            step="1"
            disabled={partProVerrouillee}
            value={partProEffectivePct}
            onChange={(e) => setPartProPct(e.target.value)}
            className="w-full disabled:opacity-60"
          />
          <p className="text-xs text-faint mt-1">
            {partProEffectivePct} %{" "}
            {partProVerrouillee && ratioLocalPro !== null && "— repris automatiquement du ratio surface pro/surface totale (réglages forfaits, C6)."}
          </p>
        </div>

        <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
          <p className="text-sm text-ink">
            Montant déductible = <span className="font-display font-semibold tabular-nums">{montantDeductible.toFixed(2)} €</span>
          </p>
          <p className="text-xs text-faint mt-0.5">
            ({montantTotalNum.toFixed(2)} − {remboursementNum.toFixed(2)}) × {partProEffectivePct} %
          </p>
        </div>

        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Justificatif</span>
          <label className={`inline-block bg-surface-2 border border-line rounded-lg px-4 py-2 text-sm transition-colors ${envoiEnCours ? "opacity-60" : "cursor-pointer hover:border-line-strong"}`}>
            {envoiEnCours ? "Envoi…" : justificatifNom ? "Remplacer le fichier" : "Choisir un fichier (PDF, JPG, PNG)"}
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={envoiEnCours} onChange={(e) => onFichierChoisi(e.target.files?.[0])} />
          </label>
          {justificatifNom && <span className="text-xs text-muted ml-2">{justificatifNom}</span>}
          <p className="mt-2">
            <StatutBadge statut={statutJustificatif} />
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="dep-notes">
            Notes (optionnel)
          </label>
          <input id="dep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>

        {erreur && <p className="text-sm text-red">{erreur}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={!date || !description.trim() || montantTotalNum <= 0 || envoiEnCours} className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
            {valeurInitiale ? "Enregistrer les modifications" : "Ajouter la dépense"}
          </button>
          <button type="button" onClick={onAnnuler} className="px-4 rounded-lg border border-line text-muted">
            Annuler
          </button>
          {onSupprimer && (
            <button type="button" onClick={onSupprimer} className="px-4 rounded-lg border border-red/30 text-red">
              Supprimer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function StatutBadge({ statut }: { statut: StatutJustificatif }) {
  if (statut === "fourni") return <span className="inline-flex items-center gap-1.5 text-xs text-mint">● Justificatif fourni</span>;
  if (statut === "non_requis") return <span className="inline-flex items-center gap-1.5 text-xs text-faint">● Non requis (forfait)</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs text-red">● Justificatif manquant</span>;
}
