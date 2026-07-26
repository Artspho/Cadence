import { useMemo, useState } from "react";
import type { Contrat, MoisIndemnisationResultat, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";
import { calculerJoursTravailes, calculerSerie } from "../engine/calculerSerie";
import { getAjReelleAt } from "../engine/ajReelleUtils";
import { joursDansMois } from "../engine/dateUtils";
import { repartirContratParMois } from "../engine/decoupageMensuel";
import { calculerNetEstime } from "../engine/estimationPaie";

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
      <button
        onClick={() => {
          // Resynchronise systématiquement sur la valeur réelle courante avant d'ouvrir
          // l'édition — `dateDepart` (state local) était initialisé une seule fois au montage
          // (`useState(solde.dateDepart)`) et ne se resynchronisait jamais si `solde` changeait
          // sans remonter ce composant, risque de resaisir/écraser avec une valeur périmée.
          setDateDepart(solde.dateDepart);
          setModification(true);
        }}
        className="text-xs text-mint hover:underline"
      >
        Modifier
      </button>
    </div>
  );
}

// Une ligne affichée du tableau — mois de réadmission ou mois normal, TOUJOURS calculée (plus
// aucun mois grisé/non calculé, cf. pivot documenté en tête de calculerSerie.ts). `estimation` est
// vrai tant que la franchise CP OU le délai d'attente n'était pas encore intégralement épuisé à
// l'ENTRÉE de ce mois (donc encore susceptible d'être affecté par l'incertitude du découpage
// jour-mois du mois de réadmission, cf. `estReadmission`) — jamais un flou, un simple badge texte.
interface LigneAffichage {
  moisLabel: string;
  heuresDuMois: number;
  joursNonIndemnisables: number;
  delaiConsomme: number;
  franchiseCPConsommee: number;
  joursIndemnisables: number;
  montant: number | null;
  montantNet: number | null;
  salairesContratsBruts: number;
  estimation: boolean;
  estReadmission: boolean;
}

function construireLignesAffichage(profil: Profil, contrats: Contrat[], config: FranceTravailConfig, mois: (MoisIndemnisationResultat | { calculable: false; moisLabel: string; salairesContratsBruts: number })[], ouvertureDroits: NonNullable<Profil["ouvertureDroits"]>, tauxRenseigne: boolean): LigneAffichage[] {
  const ligneReadmission = mois.find((m) => !m.calculable);
  const moisCalcules = mois.filter((m): m is MoisIndemnisationResultat => m.calculable);
  const tauxPASFraction = (ouvertureDroits.tauxPrelevementSource ?? 0) / 100;

  // Heures du mois de réadmission : pas exposées par calculerSerieDepuisContrats (mois jamais
  // simulé par indemnisationMensuelle.ts, cf. Q1 dans ce fichier moteur) — recalculées ici
  // directement depuis les vrais contrats, même fonction que le pipeline existant
  // (repartirContratParMois), traitées comme un mois calendaire entier (approximation assumée,
  // cf. calculerSerie.ts).
  const heuresReadmission = ligneReadmission
    ? contrats.reduce((total, c) => total + repartirContratParMois(c, config).filter((part) => part.moisCle === ligneReadmission.moisLabel).reduce((s, part) => s + part.heures, 0), 0)
    : 0;

  const entrees = [
    ...(ligneReadmission
      ? [
          {
            moisLabel: ligneReadmission.moisLabel,
            joursDuMois: joursDansMois(ligneReadmission.moisLabel),
            joursTravailes: calculerJoursTravailes([{ heures: heuresReadmission, cachets: 0 }], config),
            heuresDuMois: heuresReadmission,
          },
        ]
      : []),
    ...moisCalcules.map((m) => ({
      moisLabel: m.moisLabel,
      joursDuMois: joursDansMois(m.moisLabel),
      joursTravailes: m.joursNonIndemnisables,
      heuresDuMois: m.heuresDuMois,
    })),
  ];

  // Un seul appel, sur toute la série depuis la réadmission incluse : franchiseCPTotale/
  // delaiAttente sont de purs paramètres d'entrée (jamais recalculés, cf. Profil.ouvertureDroits) —
  // l'état (franchise CP restante, délai restant) se propage correctement mois après mois, y
  // compris à travers le mois de réadmission. ajNetteAvantPAS/tauxPAS à 0 : l'AJ réelle peut varier
  // dans le temps (plusieurs taux successifs), le montant est recalculé mois par mois ci-dessous
  // plutôt que par calculerSerie (qui suppose un taux unique pour toute la série).
  const serie = calculerSerie({
    mois: entrees.map(({ joursDuMois, joursTravailes }) => ({ joursDuMois, joursTravailes })),
    ajNetteAvantPAS: 0,
    tauxPAS: 0,
    franchiseCPTotale: ouvertureDroits.franchiseCPTotale,
    delaiAttente: ouvertureDroits.delaiAttenteInitial,
    config,
  });

  return entrees.map((entree, i) => {
    const s = serie[i];
    // Estimation tant qu'il restait quelque chose à consommer à l'ENTRÉE de ce mois (avant sa
    // propre consommation) — l'état précédent (ou les totaux initiaux pour le tout premier mois).
    const avant = i === 0 ? { cp: ouvertureDroits.franchiseCPTotale, delai: ouvertureDroits.delaiAttenteInitial } : { cp: serie[i - 1].franchiseCPRestante, delai: serie[i - 1].delaiRestant };
    const estimation = avant.cp > 0 || avant.delai > 0;

    const ajNetteAvantPAS = getAjReelleAt(profil.ajReelleHistorique, `${entree.moisLabel}-01`);
    const ajConnue = ajNetteAvantPAS !== null;
    const montant = ajConnue ? Math.round(s.joursIndemnisables * ajNetteAvantPAS * 100) / 100 : null;
    const montantNet = ajConnue && tauxRenseigne ? Math.round((montant as number) * (1 - tauxPASFraction) * 100) / 100 : null;

    const mCalculable = moisCalcules.find((m) => m.moisLabel === entree.moisLabel);

    return {
      moisLabel: entree.moisLabel,
      heuresDuMois: entree.heuresDuMois,
      joursNonIndemnisables: entree.joursTravailes,
      delaiConsomme: s.delaiConsomme,
      franchiseCPConsommee: s.franchiseCPConsommee,
      joursIndemnisables: s.joursIndemnisables,
      montant,
      montantNet,
      salairesContratsBruts: mCalculable?.salairesContratsBruts ?? 0,
      estimation,
      estReadmission: !mCalculable,
    };
  });
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

  const lignes = construireLignesAffichage(profil, contrats, config, mois, ouvertureDroits, tauxRenseigne);

  const desMoisEnEstimation = lignes.some((l) => l.estimation);
  const desMoisSansAj = lignes.some((l) => l.montant === null);

  function revenuARE(l: LigneAffichage): number {
    if (l.montant === null) return 0;
    return tauxRenseigne && l.montantNet != null ? l.montantNet : l.montant;
  }

  // Tous les mois affichés ont désormais un vrai chiffre (estimé ou certain) — plus aucune
  // exclusion "zone franchise" des totaux : le badge "Estimation" signale déjà l'incertitude sur
  // la ligne elle-même, un total qui l'exclurait silencieusement serait incohérent avec le chiffre
  // affiché juste au-dessus.
  const totalARE = lignes.reduce((acc, l) => acc + revenuARE(l), 0);
  const totalContrats = lignes.reduce((acc, l) => acc + l.salairesContratsBruts, 0);
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
            {lignes.map((l) => {
              const are = revenuARE(l);
              return (
                <tr key={l.moisLabel} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {l.moisLabel}
                      {l.estReadmission && (
                        <span title="Mois de réadmission — partagé entre deux droits, traité ici comme un mois entier (approximation)." aria-label="Mois de réadmission" className="cursor-help">
                          ℹ️
                        </span>
                      )}
                      {l.estimation && <BadgeEstimation />}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-muted">{l.heuresDuMois} h</td>
                  <td className="text-right px-4 py-3 text-muted">{l.joursNonIndemnisables}</td>
                  <td className="text-right px-4 py-3 text-muted">{l.delaiConsomme}</td>
                  <td className="text-right px-4 py-3 text-muted">{l.franchiseCPConsommee}</td>
                  <td className="text-right px-4 py-3 font-medium">{l.joursIndemnisables}</td>
                  <td className="text-right px-4 py-3 font-medium">{l.montant != null ? `${l.montant.toFixed(2)} €` : "—"}</td>
                  {tauxRenseigne && <td className="text-right px-4 py-3 font-medium">{l.montantNet != null ? `${l.montantNet.toFixed(2)} €` : "—"}</td>}
                  <td className="text-right px-4 py-3 text-muted">{l.salairesContratsBruts > 0 ? `${l.salairesContratsBruts.toFixed(2)} €` : "—"}</td>
                  <td className="text-right px-4 py-3">
                    {l.salairesContratsBruts > 0 ? (
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        ≈ {calculerNetEstime(l.salairesContratsBruts, config).toFixed(2)} €<BadgeEstimationPaie />
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {/* Revenu total flouté systématiquement (même sans contrat, donc même pour un
                      total ARE seul) — jamais un chiffre en clair sur cette colonne. */}
                  <td className="text-right px-4 py-3">{are === 0 && l.salairesContratsBruts === 0 ? "—" : <NetContratsPremiumCell />}</td>
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
                  même chiffre final que revenuARE(l) utilise déjà par ligne, pas la peine de
                  dupliquer un total "avant PAS" que personne n'a demandé. */}
              <td className="text-right px-4 py-3" colSpan={tauxRenseigne ? 2 : 1}>
                {totalARE === 0 ? "—" : `${totalARE.toFixed(2)} €`}
              </td>
              <td className="text-right px-4 py-3">{totalContrats > 0 ? `${totalContrats.toFixed(2)} €` : "—"}</td>
              <td className="text-right px-4 py-3">{totalContrats > 0 ? `≈ ${calculerNetEstime(totalContrats, config).toFixed(2)} €` : "—"}</td>
              {/* "Revenu total" : flouté dès qu'au moins un mois de la période a des revenus
                  contrats (totalContrats > 0) — le total mélangerait alors du net ARE avec du brut
                  contrats, jamais présenté comme un chiffre final propre. Si aucun mois n'a de
                  contrat, le total est de l'ARE pur (estimé ou certain, déjà signalé ligne par
                  ligne par le badge), rien à cacher de plus au niveau du total. */}
              <td className="text-right px-4 py-3 font-semibold text-mint">
                {totalRevenu === 0 ? "—" : totalContrats > 0 ? <NetContratsPremiumCell /> : `${totalRevenu.toFixed(2)} €`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-line text-xs space-y-1">
        <p className="text-faint">Montant calculé sur l'AJ indiquée sur ton relevé France Travail.</p>
        {desMoisSansAj && <p className="text-amber">Certains mois n'ont pas de taux d'AJ connu pour leur période (« — ») — ajoute une période dont la date d'effet les couvre dans « Mon profil ».</p>}
        {desMoisEnEstimation && (
          <p className="text-faint">
            <strong className="text-ink font-medium">Estimation</strong> : basée sur la franchise congés payés et le délai d'attente indiqués sur ta notification France Travail (« Mon profil »).
            Le mois de réadmission est traité comme un mois entier — le découpage exact jour par jour entre l'ancien et le nouveau droit n'est pas reconstituable par Cadence, ce qui rend ce
            mois-là (et les suivants tant que franchise/délai ne sont pas épuisés) approximatif. Montant exact disponible en Premium (upload de ton relevé France Travail, analyse IA).
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

const TOOLTIP_ESTIMATION =
  "Estimation basée sur les infos de ta notification France Travail (franchise congés payés / délai d'attente), pas encore intégralement épuisés à ce stade. Version Premium : upload ton relevé FT, analyse IA, montant garanti exact au centime.";

// Badge texte (jamais un flou) : le chiffre affiché EST un vrai calcul de Cadence, juste marqué
// comme estimation tant que la franchise CP ou le délai d'attente n'était pas épuisé à l'entrée du
// mois — cf. construireLignesAffichage, TableauResultats.
function BadgeEstimation() {
  return (
    <span
      title={TOOLTIP_ESTIMATION}
      aria-label={TOOLTIP_ESTIMATION}
      className="inline-flex items-center text-[10px] uppercase tracking-wide font-medium text-amber bg-amber/10 rounded px-1.5 py-0.5 cursor-help select-none whitespace-nowrap"
    >
      Estimation · basée sur ta notification FT
    </span>
  );
}

const TOOLTIP_ESTIMATION_PAIE =
  "Estimation ≈77% du brut (charges salariales moyennes d'artiste). Montant approximatif — les taux réels varient selon ta convention collective. Version Premium : analyse IA de tes bulletins réels, net exact garanti au centime.";

// Colonne "Net contrats", version gratuite : un vrai chiffre (approximatif, jamais un flou) —
// cf. engine/estimationPaie.ts, franceTravailConfig.ts (guso.tauxNetApproxSurBrut).
function BadgeEstimationPaie() {
  return (
    <span
      title={TOOLTIP_ESTIMATION_PAIE}
      aria-label={TOOLTIP_ESTIMATION_PAIE}
      className="inline-flex items-center text-[10px] uppercase tracking-wide font-medium text-amber bg-amber/10 rounded px-1.5 py-0.5 cursor-help select-none"
    >
      ≈77%
    </span>
  );
}
