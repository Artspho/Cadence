import { useState } from "react";
import { estPerime, franceTravailConfig, joursDepuisMiseAJourConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { regimeEffectif } from "../lib/profilHorsPerimetre";
import { validerCoherenceProfil } from "../lib/coherenceProfil";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import type { Profil } from "../types";

type OnModifierProfil = (profil: Profil) => ResultatEcritureProfil;

interface MonProfilProps {
  dateDuJour: string;
  profil: Profil;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
}

export function MonProfil({ dateDuJour, profil, onModifierProfil }: MonProfilProps) {
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
            <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-date-naissance">
              Date de naissance
            </label>
            <input
              id="profil-date-naissance"
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
              <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-date-anniversaire-precedente">
                Date de fin de ta période de droits précédente (optionnel)
              </label>
              <input
                id="profil-date-anniversaire-precedente"
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

      {profil.situation === "readmission" && <MonIndemnisationEnCours profil={profil} onModifierProfil={onModifierProfil} />}

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
          <li>
            Le suivi des jours réellement indemnisés mois par mois est disponible (onglet « Revenus mensuels »), calculé automatiquement depuis tes contrats et l'ouverture de tes droits
            (renseignée ci-dessus, section « Mon indemnisation en cours »). La franchise salaires et le plafond de cumul (118&nbsp;% du PMSS) ne sont pas calculés.
          </li>
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
          <li>
            La franchise salaires est calculée selon la formule officielle (guide France Travail, page 14). Si tu n'as eu que des contrats Annexe 10, le calcul est complet. Si tu avais aussi des
            contrats hors spectacle, renseigne le champ ci-dessus pour affiner.
          </li>
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

// Paramètres de l'ouverture de droits en cours (Profil.ouvertureDroits) + historique d'AJ réelle
// (Profil.ajReelleHistorique, déplacé ici depuis RevenusMensuels.tsx le 2026-07-25 : c'est une
// caractéristique de l'ouverture de droits, pas du point de départ d'affichage du tableau mensuel).
// Consommés automatiquement mois par mois par calculerSerieDepuisContrats — jamais reconstruits.
function MonIndemnisationEnCours({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const ouverture = profil.ouvertureDroits;
  const [dateOuverture, setDateOuverture] = useState(ouverture?.dateOuverture ?? "");
  const [franchiseCPTotale, setFranchiseCPTotale] = useState(ouverture?.franchiseCPTotale ?? 0);
  const [delaiAttenteInitial, setDelaiAttenteInitial] = useState(ouverture?.delaiAttenteInitial ?? 7);
  const [tauxPrelevementSource, setTauxPrelevementSource] = useState(ouverture?.tauxPrelevementSource?.toString() ?? "");
  // dureeDroitsMois/salairesHorsAnnexe10PRA vivent sur Profil, pas ouvertureDroits (cf.
  // types/index.ts) — composantes de la franchise salaires, connues indépendamment de la
  // notification d'ouverture de droits elle-même.
  const [dureeDroitsMois, setDureeDroitsMois] = useState(profil.dureeDroitsMois?.toString() ?? "");
  const [salairesHorsAnnexe10PRA, setSalairesHorsAnnexe10PRA] = useState(profil.salairesHorsAnnexe10PRA?.toString() ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  function enregistrer() {
    if (!dateOuverture) return;
    const tauxSaisi = tauxPrelevementSource.trim() === "" ? undefined : Number(tauxPrelevementSource);
    const resultat = onModifierProfil({
      ...profil,
      dureeDroitsMois: dureeDroitsMois === "" ? undefined : (Number(dureeDroitsMois) as 12 | 6),
      salairesHorsAnnexe10PRA: salairesHorsAnnexe10PRA.trim() === "" ? null : Number(salairesHorsAnnexe10PRA),
      ouvertureDroits: { dateOuverture, franchiseCPTotale, delaiAttenteInitial, tauxPrelevementSource: tauxSaisi },
    });
    if (!resultat.ok) {
      setErreur(resultat.erreur);
      return;
    }
    setErreur(null);
  }

  return (
    <section>
      <h2 className="font-display text-lg font-medium mb-2">Mon indemnisation en cours</h2>
      <div className="bg-surface border border-line rounded-card p-5 space-y-5">
        <p className="text-sm text-muted">
          Ces informations figurent sur ta notification d'ouverture de droits France Travail. Tu peux la retrouver dans ton espace personnel francetravail.fr → « Mes paiements » → « Mes
          notifications ».
        </p>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-date-ouverture">
            Date d'ouverture de tes droits
          </label>
          <input
            id="profil-date-ouverture"
            type="date"
            value={dateOuverture}
            onChange={(e) => setDateOuverture(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">Date indiquée en haut de ta notification, ex. « 18 janvier 2026 ».</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-franchise-cp-totale">
            Franchise congés payés (total)
          </label>
          <input
            id="profil-franchise-cp-totale"
            type="number"
            min={0}
            value={franchiseCPTotale}
            onChange={(e) => setFranchiseCPTotale(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">Sur ta notification, rubrique « Franchises » → « Franchise congés payés totale ». Pas le solde restant — le total initial, ex. « 18 jours ».</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-delai-attente">
            Délai d'attente
          </label>
          <input
            id="profil-delai-attente"
            type="number"
            min={0}
            value={delaiAttenteInitial}
            onChange={(e) => setDelaiAttenteInitial(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">Sur ta notification, rubrique « Délai d'attente ». Presque toujours 7 jours.</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-duree-droits">
            Durée des droits
          </label>
          <select
            id="profil-duree-droits"
            value={dureeDroitsMois}
            onChange={(e) => setDureeDroitsMois(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          >
            <option value="">—</option>
            <option value="12">12 mois (standard)</option>
            <option value="6">6 mois (clause de rattrapage)</option>
          </select>
          <p className="text-xs text-faint mt-1">Indiqué dans ta notification France Travail. Standard = 12 mois. Clause de rattrapage = 6 mois.</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-salaires-hors-a10">
            Salaires hors Annexe 10 sur la période de référence (€)
          </label>
          <input
            id="profil-salaires-hors-a10"
            type="number"
            min={0}
            placeholder="0 si tu n'as eu que des contrats spectacle"
            value={salairesHorsAnnexe10PRA}
            onChange={(e) => setSalairesHorsAnnexe10PRA(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">Salaires bruts totaux des contrats hors spectacle (régime général, Annexe 8…) sur ta période de référence. Laisse vide si tu n'en as pas eu.</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-taux-pas">
            Taux de prélèvement à la source (%)
          </label>
          <input
            id="profil-taux-pas"
            type="number"
            min={0}
            max={99}
            step={0.1}
            placeholder="ex. 7,2"
            value={tauxPrelevementSource}
            onChange={(e) => setTauxPrelevementSource(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">Retrouve ton taux sur impots.gouv.fr ou sur ton bulletin France Travail.</p>
        </div>

        {erreur && <p className="text-xs text-red">{erreur}</p>}

        <button
          onClick={enregistrer}
          disabled={!dateOuverture}
          className="w-full bg-mint text-bg font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Enregistrer
        </button>

        <GestionAjReelle profil={profil} onModifierProfil={onModifierProfil} />
      </div>
    </section>
  );
}

// Historique des taux d'AJ nette successifs (un utilisateur peut connaître plusieurs taux sur une
// même période d'indemnisation, cf. types/index.ts). Aucun repli sur une AJ estimée : sans entrée
// couvrant un mois donné, RevenusMensuels.tsx affiche honnêtement l'absence de montant pour ce mois.
function GestionAjReelle({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const historique = profil.ajReelleHistorique ?? [];
  const [dateEffet, setDateEffet] = useState("");
  const [valeur, setValeur] = useState("");

  function ajouter() {
    if (!dateEffet || valeur.trim() === "") return;
    const nouveau = [...historique, { dateEffet, valeur: Number(valeur) }].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
    onModifierProfil({ ...profil, ajReelleHistorique: nouveau });
    setDateEffet("");
    setValeur("");
  }

  function supprimer(index: number) {
    onModifierProfil({ ...profil, ajReelleHistorique: historique.filter((_, i) => i !== index) });
  }

  return (
    <div className="border-t border-line pt-5 space-y-4">
      <div>
        <h3 className="font-display text-base font-medium">Allocation journalière réelle</h3>
        <p className="text-xs text-faint mt-1">
          Indique l'allocation journalière nette figurant sur ta notification d'ouverture de droits France Travail (ligne « Allocation journalière nette »).
        </p>
      </div>

      {historique.length === 0 ? (
        <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">Sans ce chiffre, le montant mensuel ne peut pas être calculé.</p>
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
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-aj-date-effet">
            Date d'effet
          </label>
          <input
            id="profil-aj-date-effet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-aj-valeur">
            AJ nette (€)
          </label>
          <input
            id="profil-aj-valeur"
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
