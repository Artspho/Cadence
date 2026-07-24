import { useMemo, useState } from "react";
import type { Contrat, MoisIndemnisationResultat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";
import { calculerJoursTravailes, calculerSerie } from "../engine/calculerSerie";
import { getAjReelleAt } from "../engine/ajReelleUtils";
import { bornesDuMois, joursDansMois, moisCle, moisEntre } from "../engine/dateUtils";

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

  // Ne devrait pas arriver ici : `resultat.calculable === true` implique déjà que
  // `profil.ouvertureDroits` est renseigné (calculerSerieDepuisContrats), garde de type uniquement.
  if (!profil.ouvertureDroits) {
    return null;
  }
  const { ouvertureDroits } = profil;

  // tauxPrelevementSource vit sur ouvertureDroits (renseigné une fois dans "Mon profil"), pas sur
  // chaque mois — s'il est absent, on ne peut structurellement pas calculer de montant net ici.
  const tauxRenseigne = ouvertureDroits.tauxPrelevementSource != null;
  // franchiseSalaires est un TOTAL (pas une valeur qui varie mois par mois) : le même objet est
  // porté par chaque mois calculé de la série, un seul suffit pour l'afficher une fois en pied de
  // tableau (cf. calculerSerieDepuisContrats, engine/indemnisationMensuelle.ts).
  const franchiseSalaires = mois.find((m) => m.calculable)?.franchiseSalaires;

  // ── Zone franchise : EXACTEMENT 2 mois grisés — le mois de réadmission (index 0, déjà grisé
  // séparément via m.calculable === false) et le mois plein suivant (index 1, ex. février pour
  // Benoît). Fixe, volontairement PAS proportionnelle à `franchiseCPTotale` (pas de
  // ceil(franchiseCPTotale / franchiseCPMensuelleMax) + 1) : ce que FT applique encore au-delà
  // (ex. 1 j de franchise CP en mars) est trop marginal pour justifier de cacher l'information —
  // à partir de l'index 2, `calculerSerie` tourne avec franchise=0/délai=0 et affiche un vrai
  // chiffre. `calculerSerie` n'est délibérément PAS appelé sur les 2 mois grisés : son mécanisme
  // de report ne réduit `delaiRestant` que lorsqu'il est consommé, jamais pendant un mois grisé —
  // câblé sur le vrai `ouvertureDroits.delaiAttenteInitial`, ça romprait la reconstruction dès le
  // 2e mois (cf. docs/reprise.md).
  const franchiseCPMensuelleMax = config.differesEtFranchises.franchiseCongesPayes.forfaitMensuelBas;
  const moisOuvertureCle = moisCle(ouvertureDroits.dateOuverture);
  const tauxPASFraction = (ouvertureDroits.tauxPrelevementSource ?? 0) / 100;

  function indexDepuisOuverture(moisLabel: string): number {
    return moisEntre(bornesDuMois(moisOuvertureCle).debut, bornesDuMois(moisLabel).debut).length - 1;
  }
  // Index 0 (mois de réadmission) déjà grisé séparément (m.calculable === false) — ne reste ici
  // que l'index 1 (le mois plein suivant).
  //
  // Limite connue, non couverte : si `ouvertureDroits.dateOuverture` tombe exactement le 1er du
  // mois (pas de split ancien/nouveau dossier), `calculerSerieDepuisContrats` ne grise aucun mois
  // de réadmission — l'index 0 est alors un mois plein normal, jamais grisé du tout (ni par le
  // mécanisme réadmission, ni par enZoneFranchise, qui ne couvre que l'index 1). Pas de profil
  // réel dans ce cas à ce jour ; à corriger si un tel profil se présente.
  function enZoneFranchise(moisLabel: string): boolean {
    return indexDepuisOuverture(moisLabel) === 1;
  }

  // Mois hors zone franchise : franchise CP et délai garantis à 0 pour ce mois, `calculerSerie`
  // peut être appelé sans risque avec ces valeurs triviales (aucun report à modéliser). Réutilise
  // `m.heuresDuMois`, déjà agrégé et proratisé par le pipeline existant (repartirContratParMois) —
  // aucune nouvelle lecture des contrats bruts.
  function calculerHorsZone(m: MoisIndemnisationResultat) {
    const ajNetteAvantPAS = getAjReelleAt(profil.ajReelleHistorique, `${m.moisLabel}-01`);
    const [resultatMois] = calculerSerie({
      mois: [
        {
          joursDuMois: joursDansMois(m.moisLabel),
          joursTravailes: calculerJoursTravailes([{ heures: m.heuresDuMois, cachets: 0 }], config),
          estGrise: false,
        },
      ],
      ajNetteAvantPAS: ajNetteAvantPAS ?? 0,
      tauxPAS: tauxPASFraction,
      franchiseCPTotale: 0,
      franchiseCPMensuelleMax,
      delaiAttente: 0,
    });
    const ajConnue = ajNetteAvantPAS !== null;
    return {
      joursIndemnisables: resultatMois.joursIndemnisables,
      montant: ajConnue ? resultatMois.netSocial : null,
      montantNet: ajConnue && tauxRenseigne ? resultatMois.netApresPAS : null,
    };
  }

  const moisCalcules = mois.filter((m): m is MoisIndemnisationResultat => m.calculable);
  const moisHorsZone = moisCalcules.filter((m) => !enZoneFranchise(m.moisLabel));
  const desMoisEnZoneFranchise = moisCalcules.some((m) => enZoneFranchise(m.moisLabel));
  // Un mois n'a pas d'AJ connue pour sa période (« — ») — distinct des mois en zone franchise,
  // qui ont leur propre bandeau explicatif (le flou + cadenas parle déjà pour eux).
  const desMoisSansAj = moisHorsZone.some((m) => calculerHorsZone(m).montant === null);

  // Revenu ARE du mois (hors zone franchise uniquement) : net avant PAS si le taux est renseigné,
  // montant sinon, 0 si le mois n'a pas d'AJ connue pour sa période (traité comme "pas d'ARE ce
  // mois-ci", pas une erreur).
  function revenuARE(m: MoisIndemnisationResultat): number {
    const vue = calculerHorsZone(m);
    if (vue.montant === null) return 0;
    return tauxRenseigne && vue.montantNet != null ? vue.montantNet : vue.montant;
  }

  // Les mois en zone franchise sont exclus du total ARE (montant réellement inconnu, pas 0) —
  // même principe que les mois de réadmission, déjà exclus par `moisCalcules`.
  const totalARE = moisHorsZone.reduce((acc, m) => acc + revenuARE(m), 0);
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
              const zoneFranchise = enZoneFranchise(m.moisLabel);
              const vue = zoneFranchise ? null : calculerHorsZone(m);
              const are = zoneFranchise ? 0 : revenuARE(m);
              const revenuTotal = are + m.salairesContratsBruts;
              return (
                <tr key={m.moisLabel} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{m.moisLabel}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.heuresDuMois} h</td>
                  <td className="text-right px-4 py-3 text-muted">{m.joursNonIndemnisables}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.delaiConsomme}</td>
                  <td className="text-right px-4 py-3 text-muted">{m.franchiseCPConsommee}</td>
                  <td className="text-right px-4 py-3 font-medium">{zoneFranchise ? <FranchiseEnCoursCell /> : vue!.joursIndemnisables}</td>
                  <td className="text-right px-4 py-3 font-medium">
                    {zoneFranchise ? <FranchiseEnCoursCell /> : vue!.montant != null ? `${vue!.montant.toFixed(2)} €` : "—"}
                  </td>
                  {tauxRenseigne && (
                    <td className="text-right px-4 py-3 font-medium">
                      {zoneFranchise ? <FranchiseEnCoursCell /> : vue!.montantNet != null ? `${vue!.montantNet.toFixed(2)} €` : "—"}
                    </td>
                  )}
                  <td className="text-right px-4 py-3 text-muted">{m.salairesContratsBruts > 0 ? `${m.salairesContratsBruts.toFixed(2)} €` : "—"}</td>
                  <td className="text-right px-4 py-3">{m.salairesContratsBruts > 0 ? <NetContratsPremiumCell /> : "—"}</td>
                  {/* Revenu total flouté systématiquement (même sans contrat, donc même pour un
                      total ARE seul), et bien sûr en zone franchise (ARE inconnue) — jamais un
                      chiffre en clair sur cette colonne. */}
                  <td className="text-right px-4 py-3">{!zoneFranchise && are === 0 && m.salairesContratsBruts === 0 ? "—" : <NetContratsPremiumCell />}</td>
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
                  additionner, encore moins avec l'ARE. */}
              <td className="text-right px-4 py-3">—</td>
              {/* "Revenu total" : flouté dès qu'au moins un mois de la période a des revenus
                  contrats (totalContrats > 0) — le total mélangerait alors du net ARE certain avec
                  du brut contrats, jamais présenté comme un chiffre final propre — ou dès qu'au
                  moins un mois est en zone franchise, où `totalARE` exclut une ARE réelle mais
                  encore inconnue (jamais un total présenté comme complet alors qu'il ne l'est pas).
                  Si aucun mois n'a de contrat ni de zone franchise, le total est de l'ARE pur, déjà
                  connu, rien à cacher. */}
              <td className="text-right px-4 py-3 font-semibold text-mint">
                {desMoisEnZoneFranchise ? <NetContratsPremiumCell /> : totalRevenu === 0 ? "—" : totalContrats > 0 ? <NetContratsPremiumCell /> : `${totalRevenu.toFixed(2)} €`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-line text-xs space-y-1">
        <p className="text-faint">Montant calculé sur l'AJ indiquée sur ton relevé France Travail.</p>
        {desMoisSansAj && <p className="text-amber">Certains mois n'ont pas de taux d'AJ connu pour leur période (« — ») — ajoute une période dont la date d'effet les couvre dans « Mon profil ».</p>}
        {desMoisEnZoneFranchise && (
          <p className="text-faint">
            Les premiers mois après une réadmission dépendent de ta franchise congés payés et de ton délai d'attente — montant exact disponible en Premium (upload de ton relevé France Travail).
          </p>
        )}
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

const TOOLTIP_ZONE_FRANCHISE_PREMIUM = "Franchise CP et délai d'attente en cours d'application — upload ton relevé FT pour voir le montant exact.";

// Mois en zone franchise (cf. TableauResultats, enZoneFranchise) : même traitement visuel que
// NetContratsPremiumCell, tooltip dédié — calculerSerie n'est délibérément pas appelé sur ces mois.
function FranchiseEnCoursCell() {
  return (
    <span title={TOOLTIP_ZONE_FRANCHISE_PREMIUM} aria-label={TOOLTIP_ZONE_FRANCHISE_PREMIUM} className="inline-flex items-center gap-1 cursor-help select-none">
      <span aria-hidden="true" className="blur-sm text-faint">
        ██████
      </span>
      <span aria-hidden="true">🔒</span>
    </span>
  );
}
