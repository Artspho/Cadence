import { useMemo, useState } from "react";
import type { Contrat, MoisIndemnisationResultat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";

interface RevenusMensuelsProps {
  profil: Profil;
  soldeDepart: SoldeIndemnisationDepart | null;
  contrats: Contrat[];
  config: FranceTravailConfig;
  onConfigurerSolde: (solde: SoldeIndemnisationDepart) => void;
  onAllerVersProfil: () => void;
  dateDuJour: string;
}

export function RevenusMensuels({ profil, soldeDepart, contrats, config, onConfigurerSolde, onAllerVersProfil, dateDuJour }: RevenusMensuelsProps) {
  // Première admission = pas encore indemnisé, en train de viser les 507 h d'ouverture — ce
  // module (montants mensuels déjà versés) n'a aucun sens dans ce contexte, cf. docs/reprise.md.
  if (profil.situation === "premiere_admission") {
    return <PremiereAdmissionInfo />;
  }

  if (!profil.ouvertureDroits) {
    return <OuvertureDroitsManquante onAllerVersProfil={onAllerVersProfil} />;
  }

  if (!soldeDepart) {
    return <ConfigurationSolde dateDuJour={dateDuJour} onConfigurer={onConfigurerSolde} />;
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <SoldeRecap solde={soldeDepart} onConfigurer={onConfigurerSolde} />
      <TableauResultats profil={profil} soldeDepart={soldeDepart} contrats={contrats} config={config} dateDuJour={dateDuJour} />
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

// Bloque toute la simulation (devoir n°2 : pas de chiffre inventé) tant que
// Profil.ouvertureDroits n'est pas renseigné — cf. engine/indemnisationMensuelle.ts,
// calculerSerieDepuisContrats.
function OuvertureDroitsManquante({ onAllerVersProfil }: { onAllerVersProfil: () => void }) {
  return (
    <div className="max-w-[640px] bg-amber/10 border border-amber/30 rounded-card p-6 text-sm text-amber space-y-3">
      <p>Complète la section « Mon indemnisation en cours » dans ton profil pour activer la simulation.</p>
      <button onClick={onAllerVersProfil} className="text-sm bg-mint text-bg font-medium rounded-lg px-4 py-2">
        Aller à Mon profil →
      </button>
    </div>
  );
}

function ConfigurationSolde({ dateDuJour, onConfigurer }: { dateDuJour: string; onConfigurer: (solde: SoldeIndemnisationDepart) => void }) {
  const [dateDepart, setDateDepart] = useState(dateDuJour);

  return (
    <div className="max-w-[640px] bg-surface border border-line rounded-card p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-medium mb-2">Suivi de tes indemnisations mensuelles</h2>
        <p className="text-sm text-muted">
          À partir de quel mois veux-tu voir le tableau ? Cadence calcule automatiquement tout ce qui précède depuis l'ouverture de tes droits (renseignée dans « Mon profil ») — tu peux choisir
          de n'afficher que les mois récents.
        </p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="ri-date-depart">
          Afficher le tableau à partir de
        </label>
        <input
          id="ri-date-depart"
          type="date"
          value={dateDepart}
          onChange={(e) => setDateDepart(e.target.value)}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        />
      </div>

      <button onClick={() => onConfigurer({ dateDepart })} className="w-full bg-mint text-bg font-medium rounded-lg py-2 transition-opacity">
        Commencer le suivi
      </button>
    </div>
  );
}

function SoldeRecap({ solde, onConfigurer }: { solde: SoldeIndemnisationDepart; onConfigurer: (solde: SoldeIndemnisationDepart) => void }) {
  const [modification, setModification] = useState(false);
  const [dateDepart, setDateDepart] = useState(solde.dateDepart);

  if (modification) {
    return (
      <div className="bg-surface border border-line rounded-card p-4 text-sm text-muted flex flex-wrap items-center gap-3">
        <label htmlFor="ri-date-depart-modif" className="text-ink">
          Tableau affiché à partir de :
        </label>
        <input
          id="ri-date-depart-modif"
          type="date"
          value={dateDepart}
          onChange={(e) => setDateDepart(e.target.value)}
          className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
        />
        <button
          onClick={() => {
            if (!dateDepart) return;
            onConfigurer({ dateDepart });
            setModification(false);
          }}
          disabled={!dateDepart}
          className="bg-mint text-bg font-medium rounded-lg px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enregistrer
        </button>
        <button
          onClick={() => {
            setDateDepart(solde.dateDepart);
            setModification(false);
          }}
          className="px-3 py-1.5 rounded-lg border border-line text-muted text-xs"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-card p-4 text-sm text-muted flex flex-wrap items-center gap-3">
      <span>
        Tableau affiché à partir de : <span className="text-ink">{solde.dateDepart}</span>
      </span>
      <button onClick={() => setModification(true)} className="text-xs text-mint hover:underline">
        Modifier
      </button>
    </div>
  );
}

function TableauResultats({
  profil,
  soldeDepart,
  contrats,
  config,
  dateDuJour,
}: {
  profil: Profil;
  soldeDepart: SoldeIndemnisationDepart;
  contrats: Contrat[];
  config: FranceTravailConfig;
  dateDuJour: string;
}) {
  const resultat = useMemo(() => calculerSerieDepuisContrats(profil, soldeDepart, contrats, dateDuJour, config), [profil, soldeDepart, contrats, dateDuJour, config]);

  // Ne devrait pas arriver ici (RevenusMensuels bloque déjà plus haut sur ouvertureDroits absent),
  // gardé par exhaustivité du type — jamais un chiffre affiché sans point de départ réel.
  if (!resultat.calculable) {
    return (
      <div className="bg-amber/10 border border-amber/30 rounded-card p-4 text-sm text-amber">Complète la section « Mon indemnisation en cours » dans ton profil pour activer la simulation.</div>
    );
  }

  const mois = resultat.mois;

  if (mois.length === 0) {
    return <p className="text-sm text-muted bg-surface border border-line rounded-card p-6 text-center">Aucun contrat depuis le mois d'ouverture des droits pour l'instant.</p>;
  }

  // Aucune AJ réelle renseignée du tout : pas de repli sur une estimation (devoir n°2), la
  // simulation entière est bloquée plutôt que d'afficher un chiffre deviné.
  if ((profil.ajReelleHistorique ?? []).length === 0) {
    return (
      <div className="bg-amber/10 border border-amber/30 rounded-card p-4 text-sm text-amber">
        Renseigne l'allocation journalière indiquée sur ta notification France Travail (« Mon profil » → « Mon indemnisation en cours ») pour activer cette simulation. Sans cette donnée, Cadence
        ne peut pas calculer tes montants mensuels.
      </div>
    );
  }

  // Les lignes "mois de réadmission" (m.calculable === false) n'ont pas de montantMensuel — on ne
  // les compte pas ici, distinct du cas "AJ manquante" qui, lui, reste un vrai mois calculé.
  const desMoisSansAj = mois.some((m) => m.calculable && !m.montantMensuel.calculable);
  // tauxPrelevementSource vit sur ouvertureDroits (renseigné une fois dans "Mon profil"), pas sur
  // chaque mois — s'il est absent, on ne peut structurellement pas calculer de montant net ici.
  const tauxRenseigne = profil.ouvertureDroits?.tauxPrelevementSource != null;
  // franchiseSalaires est un TOTAL (pas une valeur qui varie mois par mois) : le même objet est
  // porté par chaque mois calculé de la série, un seul suffit pour l'afficher une fois en pied de
  // tableau (cf. calculerSerieDepuisContrats, engine/indemnisationMensuelle.ts).
  const franchiseSalaires = mois.find((m) => m.calculable)?.franchiseSalaires;

  // Revenu ARE du mois : net avant PAS si le taux est renseigné, montant sinon, 0 si le mois n'a
  // pas d'AJ connue pour sa période (traité comme "pas d'ARE ce mois-ci", pas une erreur).
  function revenuARE(m: MoisIndemnisationResultat): number {
    if (!m.montantMensuel.calculable) return 0;
    return tauxRenseigne && m.montantMensuel.montantNet != null ? m.montantMensuel.montantNet : m.montantMensuel.montant;
  }

  const moisCalcules = mois.filter((m): m is MoisIndemnisationResultat => m.calculable);
  const totalARE = moisCalcules.reduce((acc, m) => acc + revenuARE(m), 0);
  const totalContrats = moisCalcules.reduce((acc, m) => acc + m.salairesContratsBruts, 0);
  const totalRevenu = totalARE + totalContrats;

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
              <th className="text-right px-4 py-3">{tauxRenseigne ? "Montant net avant PAS" : "≈ Montant (AJ relevé)"}</th>
              {tauxRenseigne && <th className="text-right px-4 py-3">≈ Net reçu</th>}
              <th className="text-right px-4 py-3">Revenus contrats</th>
              <th className="text-right px-4 py-3">Net contrats</th>
              <th className="text-right px-4 py-3">Revenu total</th>
            </tr>
          </thead>
          <tbody>
            {mois.map((m) => {
              // Mois de réadmission : ligne grisée, aucun montant, jamais dans les totaux (cf.
              // desMoisSansAj ci-dessus, qui l'exclut déjà de son propre calcul).
              if (!m.calculable) {
                return (
                  <tr key={m.moisLabel} className="border-b border-line last:border-0 text-faint">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {m.moisLabel}
                        <span title={m.messageTooltip} aria-label={m.messageTooltip} className="cursor-help">
                          ℹ️
                        </span>
                      </span>
                    </td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    {tauxRenseigne && <td className="text-right px-4 py-3">—</td>}
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                    <td className="text-right px-4 py-3">—</td>
                  </tr>
                );
              }
              const are = revenuARE(m);
              const revenuTotal = are + m.salairesContratsBruts;
              return (
                <tr key={m.moisLabel} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{m.moisLabel}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.heuresDuMois} h</td>
                  <td className="text-right px-4 py-3 text-muted">{m.joursNonIndemnisables}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.delaiConsomme}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.franchiseCPConsommee}</td>
                  <td className="text-right px-4 py-3 font-medium">{m.joursIndemnises}</td>
                  <td className="text-right px-4 py-3 font-medium">{m.montantMensuel.calculable ? `${m.montantMensuel.montant.toFixed(2)} €` : "—"}</td>
                  {tauxRenseigne && (
                    <td className="text-right px-4 py-3 font-medium">
                      {m.montantMensuel.calculable && m.montantMensuel.montantNet != null ? `${m.montantMensuel.montantNet.toFixed(2)} €` : "—"}
                    </td>
                  )}
                  <td className="text-right px-4 py-3 text-muted">{m.salairesContratsBruts > 0 ? `${m.salairesContratsBruts.toFixed(2)} €` : "—"}</td>
                  <td className="text-right px-4 py-3">{m.salairesContratsBruts > 0 ? <NetContratsPremiumCell /> : "—"}</td>
                  <td className="text-right px-4 py-3 font-semibold text-mint">{are === 0 && m.salairesContratsBruts === 0 ? "—" : `${revenuTotal.toFixed(2)} €`}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-medium">
              <td className="px-4 py-3" colSpan={6}>
                Total
              </td>
              {/* ARE : une seule cellule totalisée, fusionnée sur "Montant..."/"Net reçu" — c'est le
                  même chiffre final que revenuARE(m) utilise déjà par ligne, pas la peine de
                  dupliquer un total "avant PAS" que personne n'a demandé. */}
              <td className="text-right px-4 py-3" colSpan={tauxRenseigne ? 2 : 1}>
                {totalARE === 0 ? "—" : `${totalARE.toFixed(2)} €`}
              </td>
              <td className="text-right px-4 py-3">{totalContrats > 0 ? `${totalContrats.toFixed(2)} €` : "—"}</td>
              {/* Jamais de total ici : "Net contrats" est un teaser Premium, aucun chiffre réel à
                  additionner, encore moins avec l'ARE (cf. totalARE/totalRevenu ci-dessus, intouchés). */}
              <td className="text-right px-4 py-3">—</td>
              <td className="text-right px-4 py-3 font-semibold text-mint">{totalRevenu === 0 ? "—" : `${totalRevenu.toFixed(2)} €`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-line text-xs space-y-1">
        <p className="text-faint">Montant calculé sur l'AJ indiquée sur ton relevé France Travail.</p>
        {desMoisSansAj && <p className="text-amber">Certains mois n'ont pas de taux d'AJ connu pour leur période (« — ») — ajoute une période dont la date d'effet les couvre dans « Mon profil ».</p>}
        {!tauxRenseigne && <p className="text-amber">Renseigne ton taux PAS dans le profil pour voir le montant réellement viré.</p>}
        {franchiseSalaires?.valeur === null && (
          <p className="text-faint">Franchise salaires non calculée par Cadence pour l'instant (formule non certifiée sur une source fiable) — vérifie ce point directement sur ton relevé France Travail.</p>
        )}
        {franchiseSalaires && franchiseSalaires.valeur !== null && franchiseSalaires.valeur > 0 && (
          <>
            <p className="text-faint">
              Franchise salaires : {franchiseSalaires.valeur} jour{franchiseSalaires.valeur > 1 ? "s" : ""} à déduire de ton indemnisation (formule officielle, guide France Travail p.14).
            </p>
            {franchiseSalaires.sousEstimeeHorsA10 && (
              <p className="text-amber">⚠️ Franchise salaires sous-estimée : renseigne tes salaires hors Annexe 10 dans le profil pour un calcul complet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TOOLTIP_NET_CONTRATS_PREMIUM = "Montant net exact disponible en Premium — analyse IA de tes bulletins";

// Teaser Premium : jamais de chiffre, même approximatif (devoir n°2) — un montant flou avec
// cadenas, pas une estimation qui pourrait être prise pour un vrai calcul Cadence.
function NetContratsPremiumCell() {
  return (
    <span title={TOOLTIP_NET_CONTRATS_PREMIUM} aria-label={TOOLTIP_NET_CONTRATS_PREMIUM} className="inline-flex items-center gap-1 cursor-help select-none">
      <span aria-hidden="true" className="blur-sm text-faint">
        ██████
      </span>
      <span aria-hidden="true">🔒</span>
    </span>
  );
}
