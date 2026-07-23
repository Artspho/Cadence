import { useMemo, useState } from "react";
import type { Contrat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";

interface RevenusMensuelsProps {
  profil: Profil;
  soldeDepart: SoldeIndemnisationDepart | null;
  contrats: Contrat[];
  config: FranceTravailConfig;
  onConfigurerSolde: (solde: SoldeIndemnisationDepart) => void;
  dateDuJour: string;
}

export function RevenusMensuels({ profil, soldeDepart, contrats, config, onConfigurerSolde, dateDuJour }: RevenusMensuelsProps) {
  // Première admission = pas encore indemnisé, en train de viser les 507 h d'ouverture — ce
  // module (montants mensuels déjà versés) n'a aucun sens dans ce contexte, cf. docs/reprise.md.
  if (profil.situation === "premiere_admission") {
    return <PremiereAdmissionInfo />;
  }

  if (!soldeDepart) {
    return <ConfigurationSolde dateDuJour={dateDuJour} onConfigurer={onConfigurerSolde} />;
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <SoldeRecap solde={soldeDepart} />
      <GestionAjReelle solde={soldeDepart} onConfigurer={onConfigurerSolde} />
      <TableauResultats soldeDepart={soldeDepart} contrats={contrats} config={config} dateDuJour={dateDuJour} />
    </div>
  );
}

function PremiereAdmissionInfo() {
  return (
    <div className="max-w-[640px] bg-surface border border-line rounded-card p-6 text-sm text-muted">
      La simulation mensuelle sera disponible une fois tes droits ouverts. Pour l'instant, concentre-toi sur l'onglet Tableau de bord pour suivre tes heures.
    </div>
  );
}

function ConfigurationSolde({ dateDuJour, onConfigurer }: { dateDuJour: string; onConfigurer: (solde: SoldeIndemnisationDepart) => void }) {
  const [date, setDate] = useState(dateDuJour);
  const [delaiRestant, setDelaiRestant] = useState(0);
  const [franchiseCPRestante, setFranchiseCPRestante] = useState(0);
  const [quotaCPCarryOver, setQuotaCPCarryOver] = useState(0);

  return (
    <div className="max-w-[640px] bg-surface border border-line rounded-card p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-medium mb-2">Suivi de tes indemnisations mensuelles</h2>
        <p className="text-sm text-muted">
          Sur ton relevé France Travail le plus récent, cherche la section « Jours non indemnisés ». Note le mois de ce relevé, puis indique combien de jours de délai d'attente et de franchise
          congés payés il te reste. Cadence part de là pour calculer les mois suivants — il ne recalcule jamais ce que France Travail a déjà traité avant cette date.
        </p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-date-releve">
          Mois du relevé de référence
        </label>
        <input
          id="ri-date-releve"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-delai-restant">
            Jours de délai d'attente restants
          </label>
          <input
            id="ri-delai-restant"
            type="number"
            min={0}
            value={delaiRestant}
            onChange={(e) => setDelaiRestant(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-franchise-cp">
            Jours de franchise congés payés restants
          </label>
          <input
            id="ri-franchise-cp"
            type="number"
            min={0}
            value={franchiseCPRestante}
            onChange={(e) => setFranchiseCPRestante(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
      </div>

      <p className="text-xs text-faint">
        Si tu ne connais pas encore ces valeurs, laisse 0 — c'est déjà le cas le plus courant une fois les franchises épuisées. Si tu viens de reprendre tes droits, contacte France Travail pour
        confirmer tes franchises restantes.
      </p>

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-quota-carry-over">
          Report de forfait congés payés du mois précédent
        </label>
        <input
          id="ri-quota-carry-over"
          type="number"
          min={0}
          value={quotaCPCarryOver}
          onChange={(e) => setQuotaCPCarryOver(Math.max(0, Number(e.target.value)))}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        />
        <p className="text-xs text-faint mt-1">
          Si tu viens d'ouvrir tes droits ce mois-ci et que le mois précédent était un mois blanc (délai d'attente), mets 2. Ce chiffre figure sur ta notification d'ouverture de droits — pas
          besoin de le deviner, laisse 0 si tu ne sais pas.
        </p>
      </div>

      <button
        onClick={() => onConfigurer({ date, delaiRestant, franchiseCPRestante, quotaCPCarryOver, ajReelleHistorique: [] })}
        className="w-full bg-mint text-bg font-medium rounded-lg py-2 transition-opacity"
      >
        Commencer le suivi
      </button>
    </div>
  );
}

function SoldeRecap({ solde }: { solde: SoldeIndemnisationDepart }) {
  return (
    <div className="bg-surface border border-line rounded-card p-4 text-sm text-muted flex flex-wrap gap-x-6 gap-y-1">
      <span>
        Point de départ : <span className="text-ink">{solde.date}</span>
      </span>
      <span>
        Délai d'attente restant à cette date : <span className="text-ink">{solde.delaiRestant} j</span>
      </span>
      <span>
        Franchise congés payés restante à cette date : <span className="text-ink">{solde.franchiseCPRestante} j</span>
      </span>
      <span>
        Report de forfait congés payés : <span className="text-ink">{solde.quotaCPCarryOver ?? 0} j</span>
      </span>
    </div>
  );
}

// Historique des taux d'AJ nette successifs (un utilisateur peut connaître plusieurs taux sur une
// même période d'indemnisation, cf. types/index.ts). Aucun repli sur une AJ estimée : sans entrée
// couvrant un mois donné, TableauResultats affiche honnêtement l'absence de montant pour ce mois.
function GestionAjReelle({ solde, onConfigurer }: { solde: SoldeIndemnisationDepart; onConfigurer: (solde: SoldeIndemnisationDepart) => void }) {
  const historique = solde.ajReelleHistorique ?? [];
  const [dateEffet, setDateEffet] = useState("");
  const [valeur, setValeur] = useState("");

  function ajouter() {
    if (!dateEffet || valeur.trim() === "") return;
    const nouveau = [...historique, { dateEffet, valeur: Number(valeur) }].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
    onConfigurer({ ...solde, ajReelleHistorique: nouveau });
    setDateEffet("");
    setValeur("");
  }

  function supprimer(index: number) {
    onConfigurer({ ...solde, ajReelleHistorique: historique.filter((_, i) => i !== index) });
  }

  return (
    <div className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <h3 className="font-display text-base font-medium">Allocation journalière réelle</h3>
        <p className="text-xs text-faint mt-1">Ton allocation journalière nette indiquée sur ton relevé France Travail ou ta notification d'ouverture de droits.</p>
      </div>

      {historique.length === 0 ? (
        <p className="text-sm text-muted">Aucune AJ renseignée</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.03em] text-muted border-b border-line">
            <tr>
              <th className="text-left py-2">Date d'effet</th>
              <th className="text-right py-2">AJ nette (€)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {historique.map((h, i) => (
              <tr key={`${h.dateEffet}-${i}`} className="border-b border-line last:border-0">
                <td className="py-2">{h.dateEffet}</td>
                <td className="text-right py-2">{h.valeur.toFixed(2)}</td>
                <td className="text-right py-2">
                  <button onClick={() => supprimer(i)} className="text-xs text-muted hover:text-red transition-colors">
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-aj-date-effet">
            Date d'effet
          </label>
          <input
            id="ri-aj-date-effet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-aj-valeur">
            AJ nette (€)
          </label>
          <input
            id="ri-aj-valeur"
            type="number"
            min={0}
            step="0.01"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <button
          onClick={ajouter}
          disabled={!dateEffet || valeur.trim() === ""}
          className="bg-mint text-bg font-medium rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
        >
          + Ajouter une période
        </button>
      </div>
    </div>
  );
}

function TableauResultats({
  soldeDepart,
  contrats,
  config,
  dateDuJour,
}: {
  soldeDepart: SoldeIndemnisationDepart;
  contrats: Contrat[];
  config: FranceTravailConfig;
  dateDuJour: string;
}) {
  const resultats = useMemo(() => calculerSerieDepuisContrats(soldeDepart, contrats, dateDuJour, config), [soldeDepart, contrats, dateDuJour, config]);

  if (resultats.length === 0) {
    return <p className="text-sm text-muted bg-surface border border-line rounded-card p-6 text-center">Aucun contrat depuis le mois du solde de départ pour l'instant.</p>;
  }

  // Aucune AJ réelle renseignée du tout : pas de repli sur une estimation (devoir n°2), la
  // simulation entière est bloquée plutôt que d'afficher un chiffre deviné.
  if ((soldeDepart.ajReelleHistorique ?? []).length === 0) {
    return (
      <div className="bg-amber/10 border border-amber/30 rounded-card p-4 text-sm text-amber">
        Renseigne l'allocation journalière indiquée sur ta notification France Travail pour activer cette simulation. Sans cette donnée, Cadence ne peut pas calculer tes montants mensuels.
      </div>
    );
  }

  const desMoisSansAj = resultats.some((r) => !r.montantMensuel.calculable);

  return (
    <div className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.03em] text-muted border-b border-line">
            <tr>
              <th className="text-left px-4 py-3">Mois</th>
              <th className="text-right px-4 py-3">Heures travaillées</th>
              <th className="text-right px-4 py-3">Non indemnisables</th>
              <th className="text-right px-4 py-3">Délai</th>
              <th className="text-right px-4 py-3">Franchise CP</th>
              <th className="text-right px-4 py-3">Jours indemnisés</th>
              <th className="text-right px-4 py-3">≈ Montant (AJ relevé)</th>
            </tr>
          </thead>
          <tbody>
            {resultats.map((r) => (
              <tr key={r.moisLabel} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{r.moisLabel}</td>
                <td className="text-right px-4 py-3 text-muted">{r.heuresDuMois} h</td>
                <td className="text-right px-4 py-3 text-muted">{r.joursNonIndemnisables}</td>
                <td className="text-right px-4 py-3 text-muted">{r.delaiConsomme}</td>
                <td className="text-right px-4 py-3 text-muted">{r.franchiseCPConsommee}</td>
                <td className="text-right px-4 py-3 font-medium">{r.joursIndemnises}</td>
                <td className="text-right px-4 py-3 font-medium">{r.montantMensuel.calculable ? `${r.montantMensuel.montant.toFixed(2)} €` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-line text-xs space-y-1">
        <p className="text-faint">Montant calculé sur l'AJ indiquée sur ton relevé France Travail.</p>
        {desMoisSansAj && <p className="text-amber">Certains mois n'ont pas de taux d'AJ connu pour leur période (« — ») — ajoute une période dont la date d'effet les couvre.</p>}
        <p className="text-faint">Franchise salaires non calculée par Cadence pour l'instant (formule non certifiée sur une source fiable) — vérifie ce point directement sur ton relevé France Travail.</p>
      </div>
    </div>
  );
}
