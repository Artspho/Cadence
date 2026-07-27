// Câblage UI de l'amortissement multi-années (C7, cf. spec §7) sur le moteur déjà validé
// (engine/fraisReels/calculerAmortissementsAnnee.ts) — aucune règle de calcul ni constante
// réglementaire ici : le seuil vient de `ftConfig`, la durée est saisie par l'utilisateur (jamais
// imposée par Cadence, cf. MENTION_DUREE_A_VALIDER), et annuités / années de fin / restes à
// amortir viennent tous du résultat retourné par le moteur.
import { useMemo, useState } from "react";
import type { BienAmorti, CategorieBienAmorti } from "../../types/fraisReels";
import type { FranceTravailConfig } from "../../config/franceTravailConfig";
import { calculerAmortissementsAnnee } from "../../engine/fraisReels/calculerAmortissementsAnnee";
import { alertesContinuation, CATEGORIES_BIEN_ORDONNEES, depasseSeuilAmortissement, LIBELLE_CATEGORIE_BIEN, MENTION_DUREE_A_VALIDER } from "../../lib/amortissementBiensUi";

interface AmortissementBiensProps {
  anneeImposition: number;
  biens: BienAmorti[];
  ftConfig: FranceTravailConfig;
  onAjouter: (bien: Omit<BienAmorti, "id">) => void;
  onSupprimer: (id: string) => void;
}

function formatMoisAnneeFr(iso: string): string {
  if (!/^\d{4}-\d{2}/.test(iso)) return iso || "—";
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function FormulaireBien({ ftConfig, onAjouter, onAnnuler }: { ftConfig: FranceTravailConfig; onAjouter: (bien: Omit<BienAmorti, "id">) => void; onAnnuler: () => void }) {
  const [designation, setDesignation] = useState("");
  const [categorie, setCategorie] = useState<CategorieBienAmorti>("instrument");
  const [dateAchat, setDateAchat] = useState("");
  const [prixHT, setPrixHT] = useState("");
  const [dureeAns, setDureeAns] = useState("");
  const [tauxProPct, setTauxProPct] = useState("100");
  // Sous le seuil uniquement : l'utilisateur choisit entre déduction immédiate et amortissement.
  // Au-dessus, le choix n'existe pas (amortissement obligatoire), cf. `amortissementObligatoire`.
  const [lisserSousSeuil, setLisserSousSeuil] = useState(false);

  const prixHTNum = parseFloat(prixHT) || 0;
  const dureeAnsNum = parseInt(dureeAns, 10) || 0;
  const tauxProNum = (parseFloat(tauxProPct) || 0) / 100;
  const amortissementObligatoire = depasseSeuilAmortissement(prixHTNum, ftConfig);
  const seuil = ftConfig.fraisReels.amortissements.seuilAmortissementHT;

  // Sous le seuil et sans choix explicite de lisser : le bien relève d'une dépense C7 ponctuelle,
  // pas de ce module — on n'enregistre rien plutôt que de créer un amortissement non voulu.
  const enregistrementPossible = amortissementObligatoire || lisserSousSeuil;
  const formulaireValide = enregistrementPossible && designation.trim() !== "" && dateAchat !== "" && prixHTNum > 0 && dureeAnsNum > 0;

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!formulaireValide) return;
    onAjouter({ designation: designation.trim(), categorie, dateAchat, prixHT: prixHTNum, dureeAns: dureeAnsNum, tauxPro: tauxProNum });
    onAnnuler();
  }

  return (
    <form onSubmit={soumettre} className="bg-surface-2 border border-line rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-designation">
            Nom du bien
          </label>
          <input
            id="bien-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="ex. Violoncelle Jean Lot"
            className="w-full bg-surface border border-line rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-categorie">
            Catégorie
          </label>
          <select id="bien-categorie" value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieBienAmorti)} className="w-full bg-surface border border-line rounded-lg px-3 py-2">
            {CATEGORIES_BIEN_ORDONNEES.map((c) => (
              <option key={c} value={c}>
                {LIBELLE_CATEGORIE_BIEN[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-date">
            Date d'achat
          </label>
          <input id="bien-date" type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-prix">
            Prix d'achat HT (€)
          </label>
          <input id="bien-prix" type="number" min="0" step="0.01" value={prixHT} onChange={(e) => setPrixHT(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2" />
        </div>
      </div>

      {prixHTNum > 0 &&
        (amortissementObligatoire ? (
          <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber flex items-start gap-2">
            <span aria-hidden>⚠</span>
            <span>
              Au-dessus de {seuil.toFixed(2)} € HT, ce bien ne peut pas être déduit en une seule fois : il doit être amorti sur plusieurs années (SNAM §7). Renseigne une durée ci-dessous.
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              À {seuil.toFixed(2)} € HT ou moins, tu as le choix : déduction immédiate l'année de l'achat, ou amortissement si tu préfères lisser.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLisserSousSeuil(false)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${!lisserSousSeuil ? "border-mint bg-mint/10" : "border-line bg-surface"}`}
              >
                <span className="block text-sm text-ink">Déduction immédiate (C7)</span>
              </button>
              <button
                type="button"
                onClick={() => setLisserSousSeuil(true)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${lisserSousSeuil ? "border-mint bg-mint/10" : "border-line bg-surface"}`}
              >
                <span className="block text-sm text-ink">Amortir sur plusieurs années</span>
              </button>
            </div>
            {!lisserSousSeuil && <p className="text-xs text-faint">Déduction immédiate : ajoute-le comme dépense ordinaire catégorie C7 (« + Ajouter une dépense » ci-dessus), pas ici.</p>}
          </div>
        ))}

      {enregistrementPossible && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-duree">
              Durée d'amortissement retenue (années)
            </label>
            <input id="bien-duree" type="number" min="1" step="1" value={dureeAns} onChange={(e) => setDureeAns(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="bien-tauxpro">
              Part professionnelle (%)
            </label>
            <input id="bien-tauxpro" type="number" min="1" max="100" step="1" value={tauxProPct} onChange={(e) => setTauxProPct(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2" />
          </div>
          <p className="col-span-2 text-xs text-faint">{MENTION_DUREE_A_VALIDER}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={!formulaireValide} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          Ajouter ce bien
        </button>
        <button type="button" onClick={onAnnuler} className="px-4 py-2 rounded-lg border border-line text-muted text-sm">
          Annuler
        </button>
      </div>
    </form>
  );
}

export function AmortissementBiens({ anneeImposition, biens, ftConfig, onAjouter, onSupprimer }: AmortissementBiensProps) {
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const retour = useMemo(() => calculerAmortissementsAnnee(biens, anneeImposition, ftConfig), [biens, anneeImposition, ftConfig]);
  const alertes = useMemo(() => alertesContinuation(retour), [retour]);

  return (
    <div className="border-t border-line pt-5 space-y-4">
      <div>
        <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Biens amortis (C7)</span>
        <p className="text-sm text-muted">
          Un bien au-dessus de {ftConfig.fraisReels.amortissements.seuilAmortissementHT.toFixed(2)} € HT se déduit sur plusieurs années. La liste est conservée d'une année sur l'autre : pas de ressaisie
          en {anneeImposition + 1}.
        </p>
      </div>

      {biens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[.03em] text-muted">
                <th className="text-left font-normal pb-2">Bien</th>
                <th className="text-left font-normal pb-2">Achat</th>
                <th className="text-right font-normal pb-2">Durée</th>
                <th className="text-right font-normal pb-2">Annuité {anneeImposition}</th>
                <th className="text-right font-normal pb-2">Fin</th>
                <th className="text-right font-normal pb-2">Reste</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {retour.detail.map(({ bien, resultat }) => (
                <tr key={bien.id} className="border-t border-line">
                  <td className="py-2 text-ink">
                    {bien.designation}
                    <span className="block text-xs text-faint">{LIBELLE_CATEGORIE_BIEN[bien.categorie]}</span>
                  </td>
                  <td className="py-2 text-muted">{formatMoisAnneeFr(bien.dateAchat)}</td>
                  <td className="py-2 text-muted text-right tabular-nums">{bien.dureeAns} ans</td>
                  <td className="py-2 text-right tabular-nums font-display font-semibold text-ink">{resultat.annuiteDeductible.toFixed(2)} €</td>
                  <td className="py-2 text-muted text-right tabular-nums">{resultat.anneeFin}</td>
                  <td className="py-2 text-muted text-right tabular-nums">{resultat.resteAAmortir.toFixed(2)} €</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => onSupprimer(bien.id)} className="text-xs text-red border border-red/30 rounded-lg px-2 py-1">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td colSpan={3} className="pt-2 text-muted">
                  Total déductible en {anneeImposition} (reporté en C7)
                </td>
                <td className="pt-2 text-right tabular-nums font-display font-semibold text-ink">{retour.totalDeductible.toFixed(2)} €</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {alertes.length > 0 && (
        <ul className="space-y-1">
          {alertes.map(({ bien, anneeFin }) => (
            <li key={bien.id} className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber flex items-start gap-2">
              <span aria-hidden>⚠</span>
              <span>
                « {bien.designation} » génère encore une annuité déductible jusqu'en {anneeFin} — pense à la reporter les années suivantes.
              </span>
            </li>
          ))}
        </ul>
      )}

      {retour.biensFuturs.length > 0 && (
        <p className="text-xs text-faint">
          {retour.biensFuturs.length} bien(s) acheté(s) après {anneeImposition} — pas encore d'annuité cette année.
        </p>
      )}
      {retour.biensSoldes.length > 0 && <p className="text-xs text-faint">{retour.biensSoldes.length} bien(s) intégralement amorti(s) — conservés pour mémoire, sans effet sur {anneeImposition}.</p>}

      {formulaireOuvert ? (
        <FormulaireBien ftConfig={ftConfig} onAjouter={onAjouter} onAnnuler={() => setFormulaireOuvert(false)} />
      ) : (
        <button type="button" onClick={() => setFormulaireOuvert(true)} className="px-4 py-2 rounded-lg border border-line text-sm text-ink">
          + Ajouter un bien à amortir
        </button>
      )}
    </div>
  );
}
