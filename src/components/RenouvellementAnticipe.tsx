// Renouvellement anticipé (réadmission sur demande expresse) : compare le droit en cours (chiffres
// déclarés depuis Profil.ouvertureDroits + Profil.ajReelleHistorique) au nouveau droit recalculé par
// engine/renouvellementAnticipe.ts pour une FCT anticipée choisie par l'utilisateur.
//
// Simulation seulement, jamais la demande elle-même (cf. SPEC.md §11.B) : un lien renvoie vers
// l'espace personnel France Travail pour la démarche réelle. Le bandeau de trop-perçu suit les trois
// états de `comparaison.tropPercu` (cf. RisqueTropPercu, engine/renouvellementAnticipe.ts) : rouge si
// le risque est avéré, ambre s'il est indéterminé, rien seulement s'il est écarté — l'absence de
// bandeau ne doit JAMAIS couvrir un « on ne sait pas » (faux feu vert corrigé le 03/08/2026). F2
// (franchise salaires non fiabilisée) et F3 (trop-perçu ponctuel du mois de transition) restent, eux,
// TOUJOURS affichés, jamais conditionnels — ces deux points ne sont garantis dans aucun cas.
import { useState } from "react";
import type { Contrat, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerRenouvellementAnticipe, type AncienDroit } from "../engine/renouvellementAnticipe";
import { deriverFctRetenueActuelle } from "../engine/periodeReference";
import { RENOUVELLEMENT_ANTICIPE } from "../content/renouvellementAnticipe";

interface RenouvellementAnticipeProps {
  profil: Profil;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  config: FranceTravailConfig;
}

export function RenouvellementAnticipe({ profil, contrats, periodes, config }: RenouvellementAnticipeProps) {
  const [fctRetenue, setFctRetenue] = useState("");

  const ouverture = profil.ouvertureDroits;
  // Trié croissant par dateEffet à l'écriture (cf. GestionAjReelle, MonProfil.tsx) : la dernière
  // entrée est donc la plus récente, jamais recalculée ici — un chiffre déclaré (devoir sacré n°2).
  const historique = profil.ajReelleHistorique ?? [];
  const derniereAJ = historique.length > 0 ? historique[historique.length - 1] : null;

  // `Profil.dateAnniversaire` stocke la PROCHAINE échéance du droit en cours (cf. types/index.ts,
  // engine/prediction.ts) — c'est donc directement `ancien.dateAnniversaire` ("la date anniversaire
  // actuellement notifiée"). La FCT qui a ouvert ce droit, elle, n'est jamais stockée séparément : on
  // la déduit via `deriverFctRetenueActuelle` (échéance - 12 mois exactement, cf. sa doc pour la
  // preuve de fiabilité de cette inversion).
  const donneesManquantes = !ouverture || !profil.dateAnniversaire || !derniereAJ;

  const comparaison =
    !donneesManquantes && fctRetenue
      ? (() => {
          const ancien: AncienDroit = {
            dateOuverture: ouverture.dateOuverture,
            fctRetenue: deriverFctRetenueActuelle(profil.dateAnniversaire, config),
            dateAnniversaire: profil.dateAnniversaire,
            ajNette: derniereAJ.valeur,
            franchiseCPTotale: ouverture.franchiseCPTotale,
            delaiAttenteInitial: ouverture.delaiAttenteInitial,
          };
          return calculerRenouvellementAnticipe(contrats, periodes, profil, config, ancien, fctRetenue);
        })()
      : null;

  return (
    <section>
      <details className="bg-surface border border-line rounded-card">
        <summary className="cursor-pointer select-none list-none px-5 py-3 font-display text-lg font-medium flex items-center gap-2">
          <span aria-hidden="true">▸</span>
          Renouvellement anticipé
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-5">
          <p className="text-sm text-muted">
            Si tu as déjà atteint 507 h avant ta date anniversaire, tu peux demander à France Travail un réexamen anticipé de tes droits — parfois à la baisse. Simule ici ce que ça donnerait avant de
            te décider.
          </p>

          {donneesManquantes ? (
            <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">
              Renseigne d'abord ta date anniversaire (« Ton profil » ci-dessus), ton ouverture de droits et ton allocation journalière réelle (« Mon indemnisation en cours » ci-dessus) pour pouvoir
              simuler un renouvellement anticipé.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="renouvellement-fct-retenue">
                  Dernière fin de contrat déclarée et justifiée avant ta demande
                </label>
                <input
                  id="renouvellement-fct-retenue"
                  type="date"
                  value={fctRetenue}
                  onChange={(e) => setFctRetenue(e.target.value)}
                  className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
                />
                <p className="text-xs text-faint mt-1">{RENOUVELLEMENT_ANTICIPE.attestationRequise}</p>
              </div>

              {comparaison && (
                <div className="space-y-4">
                  {/* Trois états, trois rendus — cf. RisqueTropPercu (engine) : rouge si le risque est
                      prouvé, ambre si Cadence ne peut pas conclure (jamais un silence, qui se lirait
                      comme « pas de risque »), rien seulement si les DEUX franchises sont prouvées
                      épuisées. Aucun montant dans aucun cas. */}
                  {comparaison.tropPercu.etat === "avere" && <p className="text-xs rounded-lg px-3 py-2 bg-red/10 text-red">{RENOUVELLEMENT_ANTICIPE.tropPercu.avere}</p>}
                  {comparaison.tropPercu.etat === "indetermine" && (
                    <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{RENOUVELLEMENT_ANTICIPE.tropPercu.indetermine[comparaison.tropPercu.raison]}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line p-3">
                      <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Droit actuel</p>
                      <p className="text-lg font-medium">{comparaison.ancien.ajNette.toFixed(2)} €/j</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${comparaison.baisse ? "border-red/40 bg-red/5" : "border-line"}`}>
                      <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Nouveau droit simulé</p>
                      <p className="text-lg font-medium">{comparaison.nouveau.ajNette.net.toFixed(2)} €/j</p>
                    </div>
                  </div>

                  <p className={`text-sm font-medium ${comparaison.baisse ? "text-red" : "text-mint"}`}>
                    Écart : {comparaison.ecartAJ >= 0 ? "+" : ""}
                    {comparaison.ecartAJ.toFixed(2)} €/j
                    {comparaison.baisse && " — ce renouvellement ferait BAISSER ton allocation."}
                  </p>

                  <ul className="text-sm text-muted space-y-1">
                    <li>Nouvelle date anniversaire : {comparaison.nouveau.dateAnniversaire}</li>
                    <li>Nouvelle franchise congés payés : {comparaison.nouveau.franchiseCPTotale} j</li>
                    <li>
                      Délai d'attente :{" "}
                      {comparaison.nouveau.delaiReapplique
                        ? `${comparaison.nouveau.delaiAttenteInitial} j (se réapplique)`
                        : "ne se réapplique pas (déjà couru il y a moins de 12 mois)"}
                    </li>
                  </ul>
                </div>
              )}

              {/* F2/F3 — toujours affichés, jamais conditionnels au reste du calcul (cf. en-tête). */}
              <div className="border-t border-line pt-3 space-y-2 text-xs text-muted">
                <p>{RENOUVELLEMENT_ANTICIPE.franchiseSalairesNonFiabilisee}</p>
                <p>{RENOUVELLEMENT_ANTICIPE.troPPercuMoisTransition}</p>
              </div>
            </>
          )}

          <div className="pt-1">
            <p className="text-xs text-faint mb-1">{RENOUVELLEMENT_ANTICIPE.simulationSeulement}</p>
            <a href={RENOUVELLEMENT_ANTICIPE.urlEspacePersonnel} target="_blank" rel="noreferrer" className="inline-block text-sm text-mint hover:underline">
              {RENOUVELLEMENT_ANTICIPE.libelleLienEspacePersonnel}
            </a>
          </div>
        </div>
      </details>
    </section>
  );
}
