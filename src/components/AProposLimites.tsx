import { useState } from "react";
import { estPerime, franceTravailConfig, joursDepuisMiseAJourConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { regimeEffectif } from "../lib/profilHorsPerimetre";
import { validerCoherenceProfil } from "../lib/coherenceProfil";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import type { Profil } from "../types";

interface AProposLimitesProps {
  dateDuJour: string;
  profil: Profil;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
}

export function AProposLimites({ dateDuJour, profil, onModifierProfil }: AProposLimitesProps) {
  const jours = joursDepuisMiseAJourConfig(new Date(dateDuJour));
  // estPerime compare franceTravailConfig.meta.valableJusquau (un fait déclaré, jamais un
  // seuil de durée deviné) à dateDuJour — même fonction que TopBar.tsx, une seule source de
  // vérité pour la péremption, plus jamais deux logiques qui divergent.
  const perime = estPerime(new Date(dateDuJour), franceTravailConfig.meta.valableJusquau);
  const regime = regimeEffectif(profil);

  const [dateNaissance, setDateNaissance] = useState(profil.dateNaissance);
  const [situation, setSituation] = useState<Profil["situation"]>(profil.situation);
  const [dateAnniversaireConnue, setDateAnniversaireConnue] = useState(Boolean(profil.dateAnniversaire));
  const [dateAnniversaire, setDateAnniversaire] = useState(profil.dateAnniversaire);
  const [dateAnniversairePrecedente, setDateAnniversairePrecedente] = useState(profil.dateAnniversairePrecedente ?? "");
  const [confirmationRequise, setConfirmationRequise] = useState(false);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);

  const dateAnniversaireCandidate = dateAnniversaireConnue ? dateAnniversaire : "";
  const coherence = validerCoherenceProfil({ dateNaissance, situation, dateAnniversaire: dateAnniversaireCandidate });
  const formulaireComplet = dateNaissance.length > 0 && (!dateAnniversaireConnue || dateAnniversaire.length > 0);
  const peutEnregistrer = coherence.coherent && formulaireComplet;
  const dateAnniversaireModifiee = dateAnniversaireCandidate !== profil.dateAnniversaire;

  function reinitialiserConfirmation() {
    setConfirmationRequise(false);
    setErreurEcriture(null);
  }

  function enregistrer() {
    if (!peutEnregistrer) return;
    if (dateAnniversaireModifiee && !confirmationRequise) {
      setConfirmationRequise(true);
      return;
    }
    const resultat = onModifierProfil({
      ...profil,
      dateNaissance,
      situation,
      dateAnniversaire: dateAnniversaireCandidate,
      dateAnniversairePrecedente: situation === "readmission" && dateAnniversairePrecedente ? dateAnniversairePrecedente : undefined,
    });
    if (!resultat.ok) {
      setErreurEcriture(resultat.erreur);
      return;
    }
    setErreurEcriture(null);
    setConfirmationRequise(false);
  }

  return (
    <div className="space-y-6 max-w-[720px]">
      <section>
        <h2 className="font-display text-lg font-medium mb-2">Ton profil</h2>

        <div className="bg-surface border border-line rounded-card p-5 space-y-5 mb-4">
          <div>
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="apropos-date-naissance">
              Date de naissance
            </label>
            <input
              id="apropos-date-naissance"
              type="date"
              value={dateNaissance}
              onChange={(e) => {
                setDateNaissance(e.target.value);
                reinitialiserConfirmation();
              }}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
            />
          </div>

          <div>
            <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Ta situation</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSituation("premiere_admission");
                  reinitialiserConfirmation();
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "premiere_admission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
              >
                Première admission
              </button>
              <button
                onClick={() => {
                  setSituation("readmission");
                  reinitialiserConfirmation();
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "readmission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
              >
                Réadmission
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date anniversaire (fin de tes derniers droits ouverts)</span>
            <label className="flex items-center gap-2 text-sm text-muted mb-2">
              <input
                type="checkbox"
                checked={!dateAnniversaireConnue}
                onChange={(e) => {
                  setDateAnniversaireConnue(!e.target.checked);
                  reinitialiserConfirmation();
                }}
              />
              Je ne connais pas ma date anniversaire
            </label>
            {dateAnniversaireConnue && (
              <input
                type="date"
                value={dateAnniversaire}
                onChange={(e) => {
                  setDateAnniversaire(e.target.value);
                  reinitialiserConfirmation();
                }}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
              />
            )}
            {dateAnniversaireModifiee && coherence.coherent && (
              <p className="text-xs text-amber mt-2">Modifier ta date anniversaire recalcule toute ta fenêtre de référence et ton statut.</p>
            )}
          </div>

          {situation === "readmission" && (
            <div>
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="apropos-date-anniversaire-precedente">
                Date de fin de ta période de droits précédente (optionnel)
              </label>
              <input
                id="apropos-date-anniversaire-precedente"
                type="date"
                value={dateAnniversairePrecedente}
                onChange={(e) => {
                  setDateAnniversairePrecedente(e.target.value);
                  reinitialiserConfirmation();
                }}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
              />
              <p className="text-xs text-faint mt-1">
                Si tu as déjà eu des droits Annexe 10 ouverts avant cette période, indique la date à laquelle ils se sont terminés — elle figure sur ta précédente notification France Travail.
                Cadence s'en sert pour borner correctement la recherche d'heures si tu dois remonter loin. Si tu ne l'as pas sous la main, laisse vide : Cadence te le signalera dans le tableau de
                bord.
              </p>
            </div>
          )}

          {!coherence.coherent && <p className="text-xs text-red">{coherence.raison}</p>}
          {erreurEcriture && <p className="text-xs text-red">{erreurEcriture}</p>}

          <div className="flex gap-2">
            <button
              onClick={enregistrer}
              disabled={!peutEnregistrer}
              className="flex-1 bg-mint text-bg font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {confirmationRequise ? "Confirmer le changement" : "Enregistrer"}
            </button>
            {confirmationRequise && (
              <button onClick={reinitialiserConfirmation} className="px-4 rounded-lg border border-line text-muted">
                Annuler
              </button>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-card p-5">
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">
            Cette année, as-tu été payé pour autre chose que des concerts / prestations d'artiste&nbsp;? Par exemple du travail technique sur un spectacle
            (son, lumière, régie…), ou un emploi salarié classique hors spectacle.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onModifierProfil({ ...profil, regimeDeclare: "annexe10_pur" })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regime === "annexe10_pur" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
            >
              Non
            </button>
            <button
              onClick={() => onModifierProfil({ ...profil, regimeDeclare: "mixte" })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regime === "mixte" ? "border-amber bg-amber/10" : "border-line bg-surface-2"}`}
            >
              Oui
            </button>
            <button
              onClick={() => onModifierProfil({ ...profil, regimeDeclare: "inconnu" })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${regime === "inconnu" ? "border-amber bg-amber/10" : "border-line bg-surface-2"}`}
            >
              Je ne sais pas
            </button>
          </div>
          {regime !== "annexe10_pur" && (
            <p className="text-xs text-amber mt-2">Tant que c'est signalé, le tableau de bord, l'historique et le simulateur n'affichent aucune estimation.</p>
          )}
        </div>
      </section>

      <div className={`rounded-card border p-5 text-sm ${perime ? "border-amber/30 bg-amber/5 text-amber" : "border-line bg-surface text-muted"}`}>
        {perime && (
          <span className="inline-flex items-center gap-1 font-medium mr-1">
            <span aria-hidden>⚠</span> Règles à vérifier —
          </span>
        )}
        Règles vérifiées au {franceTravailConfig.meta.dateEntreeVigueur} ({jours} jours) — {franceTravailConfig.meta.source}.
        {perime && ` Ces règles ont peut-être changé depuis le ${franceTravailConfig.meta.valableJusquau} : vérifie auprès de France Travail avant de t'y fier.`}
      </div>

      <section>
        <h2 className="font-display text-lg font-medium mb-2">Périmètre du MVP</h2>
        <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
          <li>Annexe 10 uniquement. Pas d'arbitrage Annexe 8 ni régime général (article 65).</li>
          <li>Estimation, pas décision. Les montants sont indicatifs ; France Travail seul fait foi.</li>
          <li>Le module « indemnisation mensuelle / cumul » (franchises, seuils, plafond PMSS) n'est pas dans le MVP.</li>
          <li>Import PDF assisté, pas magique : extraction locale, revue avant enregistrement, non garantie exacte.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-medium mb-2">Limites structurelles à garder en tête</h2>
        <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
          <li>Toutes les données sont en localStorage : cache vidé ou changement d'appareil = perte de la saisie. Utilise l'export JSON régulièrement.</li>
          <li>La projection est linéaire : elle ignore la saisonnalité (festivals l'été, creux ensuite) et peut rassurer à tort.</li>
          <li>Risque de faux « feu vert » : des heures oubliées ou un cas hors périmètre peuvent afficher un statut rassurant à tort.</li>
          <li>Les profils mixtes (Annexe 10 + Annexe 8 + régime général) reposent sur ton propre signalement (ci-dessus) : rien n'est déduit automatiquement de tes contrats.</li>
          <li>Les alertes sont calculées à l'ouverture de l'app, pas envoyées de façon proactive (pas de backend).</li>
          <li>La formule de la franchise salaires reste un TODO : elle n'a pas pu être transcrite de façon fiable depuis le guide.</li>
        </ul>
      </section>

      {EMAIL_FEEDBACK && (
        <div>
          <a href={construireLienFeedback(EMAIL_FEEDBACK)} className="inline-block text-sm text-mint hover:underline">
            Donner mon avis sur Cadence →
          </a>
          <p className="text-xs text-faint mt-1">ou écris-moi directement à {EMAIL_FEEDBACK}</p>
        </div>
      )}
    </div>
  );
}
