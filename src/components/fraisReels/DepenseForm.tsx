import { useState } from "react";
import type { CategorieFrais, Depense, StatutJustificatif } from "../../types/fraisReels";
import { CATEGORIES_ORDONNEES, LIBELLES_CATEGORIE_COMPLETS } from "./categorieLabels";
import { calculerStatutJustificatif } from "../../lib/statutJustificatif";
import { getToken } from "../../lib/googleDriveAuth";
import { uploaderJustificatif } from "../../lib/googleDriveStorage";

interface DepenseFormProps {
  anneeFiscale: number;
  valeurInitiale?: Depense; // édition si présent, ajout sinon
  ratioLocalPro: number | null; // config.localPro.surfaceProM2/surfaceTotalM2, null si non renseigné
  nombreRepasC3Actif: boolean; // config.nombreRepasC3 renseigné (> 0)
  driveActif: boolean; // config.driveConnecte && config.stockageJustificatifs === 'drive'
  onValider: (depense: Omit<Depense, "id">) => void;
  onSupprimer?: () => void;
  onAnnuler: () => void;
}

function lireFichierEnBase64(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

export function DepenseForm({ anneeFiscale, valeurInitiale, ratioLocalPro, nombreRepasC3Actif, driveActif, onValider, onSupprimer, onAnnuler }: DepenseFormProps) {
  const [date, setDate] = useState(valeurInitiale?.date ?? "");
  const [categorie, setCategorie] = useState<CategorieFrais>(valeurInitiale?.categorie ?? "C1");
  const [description, setDescription] = useState(valeurInitiale?.description ?? "");
  const [montantTotal, setMontantTotal] = useState(valeurInitiale?.montantTotal?.toString() ?? "");
  const [remboursementEmployeur, setRemboursementEmployeur] = useState(valeurInitiale?.remboursementEmployeur?.toString() ?? "0");
  const [partProPct, setPartProPct] = useState(Math.round((valeurInitiale?.partPro ?? 1) * 100).toString());
  const [justificatifNom, setJustificatifNom] = useState(valeurInitiale?.justificatifNom);
  const [justificatifData, setJustificatifData] = useState(valeurInitiale?.justificatifData);
  const [driveFileId, setDriveFileId] = useState(valeurInitiale?.driveFileId);
  const [driveWebViewLink, setDriveWebViewLink] = useState(valeurInitiale?.driveWebViewLink);
  const [notes, setNotes] = useState(valeurInitiale?.notes ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const partProEffectivePct = categorie === "C6" && ratioLocalPro !== null ? Math.round(ratioLocalPro * 100) : Number(partProPct) || 0;
  const partProVerrouillee = categorie === "C6" && ratioLocalPro !== null;

  const montantTotalNum = parseFloat(montantTotal) || 0;
  const remboursementNum = parseFloat(remboursementEmployeur) || 0;
  const montantDeductible = Math.max(0, (montantTotalNum - remboursementNum) * (partProEffectivePct / 100));

  const statutJustificatif = calculerStatutJustificatif(categorie, Boolean(justificatifData) || Boolean(driveFileId));

  // Justificatif local (base64) et Drive sont exclusifs : on efface toujours l'autre mode avant
  // d'écrire le nouveau, sinon une dépense pourrait garder un driveFileId périmé après un
  // remplacement en local (ou l'inverse).
  async function onFichierChoisi(fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur("Fichier trop volumineux (max 5 Mo).");
      return;
    }

    if (driveActif) {
      const token = getToken();
      if (token) {
        setEnvoiEnCours(true);
        setErreur(null);
        try {
          const { driveFileId: id, driveWebViewLink: lien } = await uploaderJustificatif(token, fichier, anneeFiscale);
          setDriveFileId(id);
          setDriveWebViewLink(lien);
          setJustificatifNom(fichier.name);
          setJustificatifData(undefined);
          setEnvoiEnCours(false);
          return;
        } catch {
          setErreur("Échec de l'envoi vers Google Drive — fichier stocké localement à la place.");
          setEnvoiEnCours(false);
          // tombe dans le fallback localStorage ci-dessous
        }
      }
    }

    try {
      const base64 = await lireFichierEnBase64(fichier);
      setJustificatifData(base64);
      setJustificatifNom(fichier.name);
      setDriveFileId(undefined);
      setDriveWebViewLink(undefined);
      if (!driveActif) setErreur(null);
    } catch {
      setErreur("Échec de la lecture du fichier.");
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
      justificatifData,
      driveFileId,
      driveWebViewLink,
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
            {envoiEnCours ? "Envoi vers Drive…" : justificatifNom ? "Remplacer le fichier" : "Choisir un fichier (PDF, JPG, PNG)"}
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={envoiEnCours} onChange={(e) => onFichierChoisi(e.target.files?.[0])} />
          </label>
          {justificatifNom && <span className="text-xs text-muted ml-2">{justificatifNom}</span>}
          {driveFileId && <span className="text-xs text-faint ml-2">(sur Google Drive)</span>}
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
