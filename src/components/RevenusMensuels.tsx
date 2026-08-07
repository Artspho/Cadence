import { useMemo, useState } from "react";
import type { Contrat, PeriodeAssimilee, Profil, SoldeIndemnisationDepart } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerSerieDepuisContrats } from "../engine/indemnisationMensuelle";
import { construireLignesAffichage, type LigneAffichage } from "../lib/lignesRevenusMensuels";
import { calculerNetEstime } from "../engine/estimationPaie";
import { calculerFenetreEnCours } from "../engine/periodeReference";
import { calculerSalaireReference } from "../engine/salaireReference";
import { calculerSJM } from "../engine/areNette";
import { descriptionMoisOuverturePartielle } from "../content/moisOuverturePartielle";
import { formaterDateLisible, formaterMoisAnnee } from "../lib/dateLisible";

interface RevenusMensuelsProps {
  profil: Profil;
  soldeDepart: SoldeIndemnisationDepart | null;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  config: FranceTravailConfig;
  onConfigurerSolde: (solde: SoldeIndemnisationDepart) => void;
  onAllerVersProfil: () => void;
  dateDuJour: string;
}

export function RevenusMensuels({ profil, soldeDepart, contrats, periodes, config, onConfigurerSolde, onAllerVersProfil, dateDuJour }: RevenusMensuelsProps) {
  // Le seul vrai prérequis est `ouvertureDroits` — les paramètres de la notification France Travail.
  // Ce module était auparavant fermé à tout profil `situation === "premiere_admission"` : un proxy de
  // « pas encore indemnisé » qui excluait aussi le premier admis venant d'ouvrir ses PREMIERS droits,
  // pourtant indemnisé et notification en main. `situation` décide de la fenêtre de référence
  // (periodeReference.ts), jamais de l'état d'indemnisation ; ce moteur-ci ne l'a jamais lu.
  // Aucun risque de chiffre inventé pour autant : les trois gardes ci-dessous (ouvertureDroits,
  // soldeDepart, ajReelleHistorique non vide) sont les seules qui protégeaient réellement.
  if (!profil.ouvertureDroits) {
    return <OuvertureDroitsManquante onAllerVersProfil={onAllerVersProfil} />;
  }

  if (!soldeDepart) {
    return <ConfigurationSolde dateDuJour={dateDuJour} onConfigurer={onConfigurerSolde} />;
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <SoldeRecap solde={soldeDepart} onConfigurer={onConfigurerSolde} />
      <TableauResultats profil={profil} soldeDepart={soldeDepart} contrats={contrats} periodes={periodes} config={config} dateDuJour={dateDuJour} />
    </div>
  );
}

// Bloque toute la simulation (devoir n°2 : pas de chiffre inventé) tant que
// Profil.ouvertureDroits n'est pas renseigné — cf. engine/indemnisationMensuelle.ts,
// calculerSerieDepuisContrats.
//
// Message unique volontairement : deux situations mènent ici — « mes droits sont ouverts mais je n'ai
// pas encore saisi ma notification » et « mes droits ne sont pas encore ouverts » — et Cadence ne
// peut PAS les distinguer (rien ne le lui dit, et `situation` ne le dit pas non plus, cf. plus haut).
// Le texte est donc formulé pour être vrai dans les deux cas, plutôt que de supposer l'une des deux
// et de se tromper la moitié du temps. Écran neutre, pas un blocage : l'onglet reste atteignable.
function OuvertureDroitsManquante({ onAllerVersProfil }: { onAllerVersProfil: () => void }) {
  return (
    <div className="max-w-[640px] bg-surface border border-line rounded-card p-6 text-sm text-muted space-y-3">
      <p className="text-ink">Cette simulation a besoin des informations de ta notification d'ouverture de droits France Travail.</p>
      <p>
        Si tes droits sont déjà ouverts, renseigne-les dans « Mon profil » → « Mon indemnisation en cours ». S'ils ne le sont pas encore, la simulation s'activera d'elle-même une fois cette
        notification reçue — en attendant, l'onglet Tableau de bord suit tes heures.
      </p>
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
        Tableau affiché à partir de : <span className="text-ink">{formaterDateLisible(solde.dateDepart)}</span>
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


function TableauResultats({
  profil,
  soldeDepart,
  contrats,
  periodes,
  config,
  dateDuJour,
}: {
  profil: Profil;
  soldeDepart: SoldeIndemnisationDepart;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  config: FranceTravailConfig;
  dateDuJour: string;
}) {
  // SR/SJM de la PRA qui a ouvert les droits en cours, pour la franchise salaires
  // (calculerFranchiseSalaires). Fenêtre volontairement identique à celle d'App.tsx:70-72 (même
  // calculerFenetreEnCours — pas calculerFenetreReference seule, cf. son correctif du 31/07/2026) —
  // PAS une fenêtre inventée ici. Cette fenêtre ne coïncide avec la vraie PRA d'admission QUE si
  // `profil.dateAnniversaire` est renseignée : sinon `calculerFenetreEnCours` retombe sur une fenêtre
  // glissante finissant à `dateDuJour` (cf. periodeReference.ts), qui n'a pas de sens pour un total
  // censé être fixé une fois pour toutes à l'ouverture des droits. D'où la garde ci-dessous :
  // `srSjmPourFranchiseSalaires` reste `undefined` (franchise non certifiée, comportement historique)
  // tant que cette date n'est pas connue, plutôt que de calculer un chiffre qui dériverait jour après jour.
  const srSjmPourFranchiseSalaires = useMemo(() => {
    if (!profil.dateAnniversaire) return undefined;
    const fenetre = calculerFenetreEnCours(profil, contrats, periodes, config, dateDuJour);
    const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, fenetre);
    // Corrigé le 31/07/2026 (cf. App.tsx, même correctif) : SJM sur sar ?? sr, pas sur sr seul —
    // `srContrats` (utilisé par calculerFranchiseSalaires pour SR_total) reste lui le SR brut, c'est
    // une grandeur distincte (cf. commentaire de calculerFranchiseSalaires, indemnisationMensuelle.ts).
    return { srContrats: sr, sjm: calculerSJM(sar ?? sr, nht, config) };
  }, [profil, contrats, periodes, config, dateDuJour]);

  const resultat = useMemo(
    () => calculerSerieDepuisContrats(profil, soldeDepart, contrats, dateDuJour, config, srSjmPourFranchiseSalaires),
    [profil, soldeDepart, contrats, dateDuJour, config, srSjmPourFranchiseSalaires],
  );

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

  // tauxPrelevementSourceHistorique vit sur ouvertureDroits (renseigné une fois dans "Mon profil",
  // potentiellement plusieurs fois si le taux a changé) — s'il est vide, on ne peut structurellement
  // pas calculer de montant net ici. Sert seulement à décider d'afficher la colonne « Net » (une
  // colonne, pas un chiffre) : la valeur réellement appliquée à CHAQUE mois est celle que le moteur a
  // retenue pour ce mois-là (getTauxPASAt), jamais ce booléen global.
  const tauxRenseigne = (ouvertureDroits.tauxPrelevementSourceHistorique?.length ?? 0) > 0;
  // franchiseSalaires est un TOTAL (pas une valeur qui varie mois par mois) : le même objet est
  // porté par chaque mois calculé de la série, un seul suffit pour l'afficher une fois en pied de
  // tableau (cf. calculerSerieDepuisContrats, engine/indemnisationMensuelle.ts).
  const franchiseSalaires = mois[0]?.franchiseSalaires;

  const lignes = construireLignesAffichage(mois);

  const desMoisEnEstimation = lignes.some((l) => l.estimation);
  const desMoisSansAj = lignes.some((l) => l.montant === null);
  // Note de bas de tableau : reprend la DESCRIPTION du mois d'ouverture partiel plutôt qu'une seconde
  // rédaction — l'ancienne phrase affirmait « le découpage exact jour par jour entre l'ancien et le
  // nouveau droit », faux pour une première admission (aucun droit antérieur). Absente s'il n'y a pas
  // de mois partiel du tout (ouverture pile le 1er du mois), où la phrase n'avait rien à dire.
  //
  // Description SEULE, pas le libellé complet du tooltip : la suite de ce paragraphe enchaîne sur le
  // teaser Premium, avec lequel le rappel « consulte ton relevé France Travail » ferait doublon (cf.
  // descriptionMoisOuverturePartielle). Même dérivation du booléen que le moteur
  // (indemnisationMensuelle.ts, ligne d'ouverture partielle) : `situation === "readmission"` = il
  // existe un droit antérieur, et rien d'autre.
  const messageMoisPartiel = lignes.some((l) => l.messageOuverturePartielle) ? descriptionMoisOuverturePartielle(profil.situation === "readmission") : null;

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
                      {formaterMoisAnnee(`${l.moisLabel}-01`)}
                      {l.messageOuverturePartielle && (
                        <span title={l.messageOuverturePartielle} aria-label={l.messageOuverturePartielle} className="cursor-help">
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
                  <td className="text-right px-4 py-3 font-medium">
                    {l.montant != null ? (
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        {l.montant.toFixed(2)} €
                        {l.ecretementPMSS && (
                          <span
                            title={`Écrêté par le plafond de cumul (ARE + rémunérations ≤ 118 % du PMSS, soit ${l.ecretementPMSS.plafond.toFixed(2)} € ce mois-ci) — sans ce plafond, le montant aurait été de ${l.ecretementPMSS.montantAvantEcretement.toFixed(2)} €.`}
                            aria-label="Montant écrêté par le plafond de cumul à 118 % du PMSS"
                            className="cursor-help"
                          >
                            ✂️
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
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
        {/* Formulation revue le 03/08/2026. L'ancienne disait « ce mois-là, et les suivants tant que
            franchise/délai ne sont pas épuisés, restent approximatifs » — ce qui laissait entendre
            qu'au-delà les chiffres devenaient certains. Ils ne le sont jamais : quatre réserves
            connues et documentées subsistent (formule des jours non indemnisables calée sur 4 relevés
            et non déduite du texte, total de franchise salaires déclaré et non calculé, jours
            d'inscription supposés couvrir le mois entier, modèle validé sur un seul droit — cf.
            docs/critique_2026-08-03.md). Et les mois à venir reposent sur des contrats pas encore
            travaillés. Le chiffre qui fait foi reste celui du relevé. (Le plafond de cumul à 118 % du
            PMSS, cinquième réserve à l'origine, est appliqué depuis le 07/08/2026 — signalé ligne par
            ligne ci-dessus quand il joue réellement, cf. `ecretementPMSS`.) */}
        {desMoisEnEstimation && (
          <p className="text-faint">
            <strong className="text-ink font-medium">Estimation</strong> : chaque ligne est une estimation calculée depuis la franchise congés payés et le délai d'attente de ta notification France
            Travail (« Mon profil »), tant que tu n'as pas importé le relevé du mois. Les mois à venir supposent en plus que les contrats déjà saisis seront bien travaillés.
            {messageMoisPartiel ? ` ${messageMoisPartiel}` : ""} Montant exact disponible en Premium (upload de ton relevé France Travail, analyse IA).
          </p>
        )}
        {!tauxRenseigne && <p className="text-amber">Renseigne ton taux PAS dans le profil pour voir le montant réellement viré.</p>}
        {franchiseSalaires?.valeur === null && (
          <p className="text-faint">Franchise salaires non calculée par Cadence pour l'instant (formule non certifiée sur une source fiable) — vérifie ce point directement sur ton relevé France Travail.</p>
        )}
        {/* ⚠️ RETOUR À L'ÉTAT SÛR (03/08/2026, point 🔴 n°4 de docs/critique_2026-08-03.md).
            Ce bloc annonçait « Franchise salaires : X jours à déduire de ton indemnisation » alors que
            les montants du tableau ci-dessus ne la déduisent PAS : ils viennent de `calculerSerie`
            (engine/calculerSerie.ts), qui ne connaît pas du tout la franchise salaires. Deux chiffres
            contradictoires sur le même écran, dont un faux (devoir sacré n°2).
            Le cas est devenu atteignable le 03/08/2026 avec le champ déclaratif
            `ouvertureDroits.franchiseSalairesTotale` : avant, `valeur` était toujours `null` et ce
            bloc ne s'affichait jamais. C'est donc une régression de ce jour-là, remise ici en état sûr.
            À NE PAS réactiver tel quel : le rétablissement passe par le câblage de la déduction dans
            le réducteur mensuel de `calculerSerie` (chantier séparé, à spécifier — décision de Benoît
            du 03/08/2026 : ne pas apprendre le mois partiel au moteur A, ce qui contredirait la
            décision actée sur l'indécomposabilité des mois de régularisation).
            La branche `valeur === null` ci-dessus, elle, reste affichée : dire « non calculée » est
            exact et n'a jamais rien promis. */}
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
