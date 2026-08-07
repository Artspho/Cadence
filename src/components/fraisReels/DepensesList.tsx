import { useMemo, useState } from "react";
import type { Depense, StatutJustificatif } from "../../types/fraisReels";
import { COULEUR_BADGE_CATEGORIE, LIBELLES_CATEGORIE_COMPLETS } from "./categorieLabels";
import { DepenseForm, StatutBadge } from "./DepenseForm";
import { calculerAffichageJustificatif } from "../../lib/justificatifAffichage";
import { obtenirDocument, obtenirUrlTelechargement } from "../../storage/documentsStorage";
import type { ClientDocuments, ClientFichiers } from "../../auth/supabaseClient";
import { formaterDateLisible } from "../../lib/dateLisible";

interface DepensesListProps {
  anneeFiscale: number;
  depenses: Depense[];
  ratioLocalPro: number | null;
  nombreRepasC3Actif: boolean;
  /** Compte obligatoire (05/08/2026) : toujours résolu par App.tsx avant que cet écran soit atteignable. */
  utilisateurId: string;
  clientDocuments: ClientDocuments | null;
  clientFichiers: ClientFichiers | null;
  onAjouter: (depense: Omit<Depense, "id">) => void;
  onModifier: (depense: Depense) => void;
  onSupprimer: (id: string) => void;
}

type Tri = "date" | "categorie";

const CATEGORIES_JUSTIFICATIF_REQUIS: Depense["categorie"][] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "D"];

/**
 * Le lien « Voir » d'un justificatif — trois passés possibles (lien Drive/base64 hérité, badge
 * « indisponible ») et un présent (Supabase Storage, `type: "signe"`) : contrairement aux autres,
 * son URL n'existe pas tant qu'on ne l'a pas demandée (jamais mise en cache, cf. `ClientFichiers`),
 * donc CE cas-là seul a besoin d'un état de chargement et de gérer un échec.
 */
function LienJustificatif({ depense, clientDocuments, clientFichiers }: { depense: Depense; clientDocuments: ClientDocuments | null; clientFichiers: ClientFichiers | null }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const etat = calculerAffichageJustificatif(depense);

  if (etat.type === "lien") {
    return (
      <a href={etat.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-mint underline underline-offset-2">
        Voir
      </a>
    );
  }
  if (etat.type === "indisponible") {
    return (
      <span className="text-xs text-faint" title="Connecte Google Drive pour y accéder — le fichier reste préservé sur Drive">
        Sur Drive (non accessible)
      </span>
    );
  }
  if (etat.type === "signe") {
    async function voir(e: React.MouseEvent) {
      e.stopPropagation();
      if (etat.type !== "signe" || !clientDocuments || !clientFichiers) {
        setErreur("Stockage indisponible.");
        return;
      }
      setEnCours(true);
      setErreur(null);
      try {
        const document = await obtenirDocument(clientDocuments, etat.documentId);
        if ("erreur" in document) {
          setErreur(document.erreur);
          return;
        }
        const url = await obtenirUrlTelechargement(clientFichiers, document.document.cheminStockage);
        if ("erreur" in url) {
          setErreur(url.erreur);
          return;
        }
        window.open(url.url, "_blank", "noopener,noreferrer");
      } finally {
        setEnCours(false);
      }
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <button type="button" onClick={voir} disabled={enCours} className="text-xs text-mint underline underline-offset-2 disabled:opacity-50">
          {enCours ? "…" : "Voir"}
        </button>
        {erreur && (
          <span className="text-xs text-red" role="alert">
            {erreur}
          </span>
        )}
      </span>
    );
  }
  return null;
}

export function DepensesList({ anneeFiscale, depenses, ratioLocalPro, nombreRepasC3Actif, utilisateurId, clientDocuments, clientFichiers, onAjouter, onModifier, onSupprimer }: DepensesListProps) {
  const [tri, setTri] = useState<Tri>("date");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [depenseEnEdition, setDepenseEnEdition] = useState<Depense | null>(null);

  const depensesTriees = useMemo(() => [...depenses].sort((a, b) => (tri === "date" ? a.date.localeCompare(b.date) : a.categorie.localeCompare(b.categorie))), [depenses, tri]);

  function sansJustificatif(d: Depense): boolean {
    return d.statutJustificatif === "manquant" && CATEGORIES_JUSTIFICATIF_REQUIS.includes(d.categorie);
  }

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-medium">Mes dépenses</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setTri("date")} className={`px-2.5 py-1 rounded-full border ${tri === "date" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
              Trier par date
            </button>
            <button onClick={() => setTri("categorie")} className={`px-2.5 py-1 rounded-full border ${tri === "categorie" ? "border-mint bg-mint/10 text-ink" : "border-line text-muted"}`}>
              Trier par catégorie
            </button>
          </div>
          <button onClick={() => setFormulaireOuvert(true)} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm">
            + Ajouter une dépense
          </button>
        </div>
      </div>

      {depensesTriees.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">Aucune dépense enregistrée pour {anneeFiscale}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-[.03em] text-muted border-b border-line">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Catégorie</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Montant déductible</th>
                <th className="text-left px-3 py-2">Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {depensesTriees.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0 hover:bg-surface-2/50 cursor-pointer" onClick={() => setDepenseEnEdition(d)}>
                  <td className="px-3 py-2.5 text-muted whitespace-nowrap">{formaterDateLisible(d.date)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_BADGE_CATEGORIE[d.categorie]}`}>{d.categorie}</span>
                  </td>
                  <td className="px-3 py-2.5 text-ink">{d.description}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{d.montantDeductible.toFixed(2)} €</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <StatutBadge statut={d.statutJustificatif} />
                      {sansJustificatif(d) && <span className="w-1.5 h-1.5 rounded-full bg-red" title="Justificatif requis pour cette catégorie" aria-label="Justificatif manquant" />}
                      <LienJustificatif depense={d} clientDocuments={clientDocuments} clientFichiers={clientFichiers} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formulaireOuvert && (
        <DepenseForm
          anneeFiscale={anneeFiscale}
          ratioLocalPro={ratioLocalPro}
          nombreRepasC3Actif={nombreRepasC3Actif}
          utilisateurId={utilisateurId}
          clientDocuments={clientDocuments}
          clientFichiers={clientFichiers}
          onValider={(d) => {
            onAjouter(d);
            setFormulaireOuvert(false);
          }}
          onAnnuler={() => setFormulaireOuvert(false)}
        />
      )}

      {depenseEnEdition && (
        <DepenseForm
          anneeFiscale={anneeFiscale}
          valeurInitiale={depenseEnEdition}
          ratioLocalPro={ratioLocalPro}
          nombreRepasC3Actif={nombreRepasC3Actif}
          utilisateurId={utilisateurId}
          clientDocuments={clientDocuments}
          clientFichiers={clientFichiers}
          onValider={(d) => {
            onModifier({ ...d, id: depenseEnEdition.id });
            setDepenseEnEdition(null);
          }}
          onSupprimer={() => {
            onSupprimer(depenseEnEdition.id);
            setDepenseEnEdition(null);
          }}
          onAnnuler={() => setDepenseEnEdition(null)}
        />
      )}
    </section>
  );
}

// Utilisé par FraisReels.tsx pour le badge rouge de synthèse (section 2, cf. spec §8).
export function compterDepensesSansJustificatif(depenses: Depense[]): number {
  return depenses.filter((d) => d.statutJustificatif === "manquant" && CATEGORIES_JUSTIFICATIF_REQUIS.includes(d.categorie)).length;
}

export type { StatutJustificatif };
