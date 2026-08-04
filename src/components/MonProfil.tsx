import { useState } from "react";
import { franceTravailConfig, joursDepuisDerniereVerification } from "../config/franceTravailConfig";
import { formaterDateLisible } from "../lib/dateLisible";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { profilHorsPerimetre, regimeEffectif } from "../lib/profilHorsPerimetre";
import { CONTRADICTION_HORS_A10 } from "../content/contradictionHorsA10";
import { validerCoherenceProfil } from "../lib/coherenceProfil";
import { estSaisieNegative } from "../lib/saisieNombrePositif";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import type { Contrat, PeriodeAssimilee, Profil } from "../types";
import { PeriodeForm } from "./PeriodeForm";
import { PeriodeList } from "./PeriodeList";
import { DocumentsUtiles } from "./DocumentsUtiles";
import { RenouvellementAnticipe } from "./RenouvellementAnticipe";
import { DateNaissanceInput } from "./DateNaissanceInput";

type OnModifierProfil = (profil: Profil) => ResultatEcritureProfil;

interface MonProfilProps {
  dateDuJour: string;
  profil: Profil;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onSupprimerPeriode: (id: string) => void;
}

export function MonProfil({ dateDuJour, profil, onModifierProfil, contrats, periodes, onAjouterPeriode, onSupprimerPeriode }: MonProfilProps) {
  const [formPeriodeOuvert, setFormPeriodeOuvert] = useState(false);
  // Compté depuis la dernière VÉRIFICATION des constantes, pas depuis l'entrée en vigueur du SMIC
  // (point 14). Purement informatif : aucun seuil ne lui est appliqué, il ne déclenche rien.
  const jours = joursDepuisDerniereVerification(new Date(dateDuJour));
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

  // Pré-remplit le brouillon de CETTE section depuis la suggestion de MonIndemnisationEnCours —
  // n'écrit jamais directement dans le profil (onModifierProfil), pour ne garder qu'une seule porte
  // d'écriture sur `dateAnniversaire` : le bouton "Enregistrer" ci-dessous, comme pour toute autre
  // modification de ce formulaire. Cf. le commentaire sur SalairesHorsAnnexe10 plus bas : deux
  // porteurs d'écriture sur le même champ finissent par s'écraser l'un l'autre.
  function suggererDateAnniversaire(date: string) {
    setDateAnniversaireConnue(true);
    setDateAnniversaire(date);
    reinitialiserConfirmation();
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
            <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date de naissance</span>
            <DateNaissanceInput
              value={dateNaissance}
              onChange={(v) => {
                setDateNaissance(v);
                reinitialiserConfirmation();
              }}
              idPrefix="profil-date-naissance"
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

          <SalairesHorsAnnexe10 profil={profil} onModifierProfil={onModifierProfil} />
        </div>
      </section>

      <MonIndemnisationEnCours profil={profil} onModifierProfil={onModifierProfil} onSuggestionDateAnniversaire={suggererDateAnniversaire} />

      <RenouvellementAnticipe profil={profil} contrats={contrats} periodes={periodes} config={franceTravailConfig} />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-medium">Périodes particulières</h2>
          {!formPeriodeOuvert && (
            <button type="button" onClick={() => setFormPeriodeOuvert(true)} className="text-sm bg-mint text-bg font-medium rounded-lg px-4 py-2">
              Ajouter une période
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-3">Maternité, adoption, accident du travail, ALD, suspension de contrat ou maladie inter-contrat pendant la période de référence.</p>
        {formPeriodeOuvert && (
          <div className="mb-3">
            <PeriodeForm
              onValider={(periode) => {
                onAjouterPeriode(periode);
                setFormPeriodeOuvert(false);
              }}
              onAnnuler={() => setFormPeriodeOuvert(false)}
            />
          </div>
        )}
        <PeriodeList periodes={periodes} onSupprimer={onSupprimerPeriode} />
      </section>

      {/* Bandeau neutre : il énonce une date de vérification et ses sources, il ne porte plus aucun
          jugement de péremption (point 13 — la bannière « Règles à vérifier » ne pouvait jamais
          s'allumer, elle a été supprimée plutôt que rafistolée). Le compteur de jours n'apparaît
          qu'à partir d'un jour révolu : « (il y a 0 jour) » le jour même serait vrai mais absurde. */}
      <div className="rounded-card border p-5 text-sm border-line bg-surface text-muted">
        Règles vérifiées le {formaterDateLisible(franceTravailConfig.meta.dateDerniereVerification)}
        {jours >= 1 && ` (il y a ${jours} jour${jours > 1 ? "s" : ""})`} — {franceTravailConfig.meta.source}.
      </div>

      <DocumentsUtiles />

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
            contrats hors spectacle, renseigne le champ «&nbsp;Salaires hors Annexe 10 sur la période de référence&nbsp;» ci-dessus pour affiner.
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

// Salaires perçus hors Annexe 10 sur la période de référence (Profil.salairesHorsAnnexe10PRA).
//
// Vit ici, dans la carte du régime déclaré, et NON dans « Mon indemnisation en cours » où il se
// trouvait jusqu'au 2026-07-28 : cette section-là est réservée aux profils en réadmission, si bien
// que le champ était inatteignable en première admission — un profil en première admission ne
// pouvait créer la contradiction (et donc en être averti) que par import JSON manuel. Aucune raison
// métier ne le limitait à la réadmission : ni `calculerFranchiseSalaires`
// (engine/indemnisationMensuelle.ts) ni `profilHorsPerimetre` ne regardent `profil.situation`, et
// contrairement à `dateAnniversairePrecedente`, le type ne le déclare pas propre à la réadmission
// (cf. types/index.ts). C'était un effet de bord de son emplacement.
//
// Sa place ici est aussi la bonne pour l'utilisateur : les DEUX moitiés de la contradiction (le
// régime déclaré juste au-dessus, ce montant) sont désormais côte à côte, ce que le bandeau promet
// précisément (« corriger l'une des deux »).
//
// Formulaire à part avec son propre bouton, pour deux raisons : les trois boutons de régime
// enregistrent au clic (rien à valider), et le champ ne doit surtout PAS être écrit à deux endroits
// à la fois — deux `useState` initialisés au montage sur la même donnée, et le formulaire enregistré
// en second réécrirait sa valeur périmée par-dessus l'autre.
function SalairesHorsAnnexe10({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const enregistre = profil.salairesHorsAnnexe10PRA?.toString() ?? "";
  const [saisie, setSaisie] = useState(enregistre);
  const [erreur, setErreur] = useState<string | null>(null);

  const modifie = saisie.trim() !== enregistre;
  // Même règle que le bandeau et l'alerte, lue à sa source unique — jamais un second `> 0` recopié.
  const contradiction = profilHorsPerimetre(profil).motif === "salaires_hors_a10_contradictoires";

  function enregistrer() {
    if (!modifie) return;
    const vide = saisie.trim() === "";
    const valeur = vide ? null : Number(saisie);
    if (valeur !== null && !Number.isFinite(valeur)) {
      setErreur("Montant illisible : saisis un nombre, ou laisse le champ vide.");
      return;
    }
    const resultat = onModifierProfil({ ...profil, salairesHorsAnnexe10PRA: valeur });
    setErreur(resultat.ok ? null : resultat.erreur);
  }

  return (
    <div className="border-t border-line mt-5 pt-5">
      <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-salaires-hors-a10">
        Salaires hors Annexe 10 sur la période de référence (€)
      </label>
      {contradiction && (
        <p className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 mb-2 rounded-full bg-red/15 text-red">
          <span aria-hidden>●</span>
          {CONTRADICTION_HORS_A10.titre}
        </p>
      )}
      <input
        id="profil-salaires-hors-a10"
        type="number"
        min={0}
        placeholder="0 si tu n'as eu que des contrats spectacle"
        value={saisie}
        onChange={(e) => {
          if (estSaisieNegative(e.target.value)) return; // champ sans <form> : min={0} ne bloque rien
          setSaisie(e.target.value);
          setErreur(null);
        }}
        className={`w-full bg-surface-2 border rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${contradiction ? "border-red/40" : "border-line"}`}
      />
      <p className="text-xs text-faint mt-1">
        Salaires bruts totaux des contrats hors spectacle (régime général, Annexe 8…) sur ta période de référence. Laisse vide si tu n'en as pas eu. Sert au calcul de la franchise salaires.
      </p>
      {erreur && <p className="text-xs text-red mt-2">{erreur}</p>}
      <button
        onClick={enregistrer}
        disabled={!modifie}
        className="mt-3 w-full bg-mint text-bg font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        Enregistrer
      </button>
    </div>
  );
}

// Paramètres de l'ouverture de droits en cours (Profil.ouvertureDroits) + historique d'AJ réelle
// (Profil.ajReelleHistorique, déplacé ici depuis RevenusMensuels.tsx le 2026-07-25 : c'est une
// caractéristique de l'ouverture de droits, pas du point de départ d'affichage du tableau mensuel).
// Consommés automatiquement mois par mois par calculerSerieDepuisContrats — jamais reconstruits.
function MonIndemnisationEnCours({
  profil,
  onModifierProfil,
  onSuggestionDateAnniversaire,
}: {
  profil: Profil;
  onModifierProfil: OnModifierProfil;
  onSuggestionDateAnniversaire: (date: string) => void;
}) {
  const ouverture = profil.ouvertureDroits;
  const [dateOuverture, setDateOuverture] = useState(ouverture?.dateOuverture ?? "");
  const [franchiseCPTotale, setFranchiseCPTotale] = useState(ouverture?.franchiseCPTotale ?? 0);
  const [delaiAttenteInitial, setDelaiAttenteInitial] = useState(ouverture?.delaiAttenteInitial ?? 7);
  // Chaîne et non nombre, délibérément : "" (non renseigné) et "0" (aucune franchise notifiée) sont
  // deux états DIFFÉRENTS, et c'est cette différence qui permet au verdict de trop-perçu de conclure
  // « écarté » au lieu de « indéterminé » (cf. engine/renouvellementAnticipe.ts, RisqueTropPercu).
  // Un `?? 0` comme pour la franchise CP ci-dessus les écraserait l'un sur l'autre.
  const [franchiseSalairesTotale, setFranchiseSalairesTotale] = useState(ouverture?.franchiseSalairesTotale?.toString() ?? "");
  const [dateLimiteIndemnisation, setDateLimiteIndemnisation] = useState(ouverture?.dateLimiteIndemnisation ?? "");
  // Mémorise la dernière date acceptée pour ne pas réafficher la même suggestion en boucle après un
  // clic — mais la refaire apparaître si `dateLimiteIndemnisation` change vers une autre valeur.
  // `profil.dateAnniversaire` reste la source de vérité pour "déjà renseignée" : la suggestion accepte
  // seulement de pré-remplir le brouillon de "Ton profil", elle n'écrit rien ici (cf. suggererDateAnniversaire).
  const [dateSuggereeAcceptee, setDateSuggereeAcceptee] = useState<string | null>(null);
  // dureeDroitsMois vit sur Profil, pas ouvertureDroits (cf. types/index.ts) — composante de la
  // franchise salaires, connue indépendamment de la notification d'ouverture de droits elle-même.
  // L'autre composante, salairesHorsAnnexe10PRA, a quitté cette section le 2026-07-28 : elle est
  // désormais saisie dans la carte du régime déclaré, atteignable en première admission comme en
  // réadmission (cf. SalairesHorsAnnexe10 ci-dessus). Ne PAS la réintroduire ici : le `...profil`
  // ci-dessous en préserve la valeur, alors qu'un second état local finirait par l'écraser.
  const [dureeDroitsMois, setDureeDroitsMois] = useState(profil.dureeDroitsMois?.toString() ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  function enregistrer() {
    if (!dateOuverture) return;
    const resultat = onModifierProfil({
      ...profil,
      dureeDroitsMois: dureeDroitsMois === "" ? undefined : (Number(dureeDroitsMois) as 12 | 6),
      ouvertureDroits: {
        dateOuverture,
        franchiseCPTotale,
        delaiAttenteInitial,
        // Champ géré séparément (GestionTauxPAS, plusieurs lignes datées possibles) — préservé tel
        // quel, jamais écrasé par ce formulaire qui ne le touche pas.
        tauxPrelevementSourceHistorique: ouverture?.tauxPrelevementSourceHistorique,
        dateLimiteIndemnisation: dateLimiteIndemnisation.trim() === "" ? undefined : dateLimiteIndemnisation,
        franchiseSalairesTotale: franchiseSalairesTotale.trim() === "" ? undefined : Math.max(0, Number(franchiseSalairesTotale)),
      },
    });
    if (!resultat.ok) {
      setErreur(resultat.erreur);
      return;
    }
    setErreur(null);
  }

  return (
    <section>
      {/* Repliée tant qu'aucune notification n'est saisie, dépliée dès qu'il y en a une. La section
          n'est PLUS conditionnée à `situation === "readmission"` (2026-07-28) : un premier admis qui
          vient d'ouvrir ses premiers droits a exactement la même notification à saisir, et en était
          privé — ainsi que de tout l'onglet « Revenus mensuels » qui en dépend. Le gating ne peut pas
          porter sur `ouvertureDroits` lui-même (c'est la donnée que ce formulaire crée : il ne
          s'afficherait jamais) ; d'où un simple pli, qui n'impose rien à qui n'a pas encore de droits
          ouverts sans jamais bloquer qui en a. */}
      <details open={Boolean(ouverture)} className="bg-surface border border-line rounded-card">
        <summary className="cursor-pointer select-none list-none px-5 py-3 font-display text-lg font-medium flex items-center gap-2">
          <span aria-hidden="true">▸</span>
          Mon indemnisation en cours
          {!ouverture && <span className="text-xs font-sans font-normal text-faint">— si tes droits sont déjà ouverts</span>}
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-5">
          <p className="text-sm text-muted">
            Ces informations figurent sur ta notification d'ouverture de droits France Travail. Tu peux la retrouver dans ton espace personnel francetravail.fr → « Mes paiements » → « Mes
            notifications ». Si tes droits ne sont pas encore ouverts, laisse cette section vide.
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
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-franchise-salaires-totale">
            Franchise salaires (total)
          </label>
          <input
            id="profil-franchise-salaires-totale"
            type="number"
            min={0}
            value={franchiseSalairesTotale}
            onChange={(e) => {
              if (estSaisieNegative(e.target.value)) return;
              setFranchiseSalairesTotale(e.target.value);
            }}
            placeholder="non renseignée"
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          {/* Champ déclaratif, jamais recalculé : le total exige les salaires de TOUS les régimes, que
              Cadence ne suit pas (cf. types/index.ts). Laisser vide ≠ saisir 0 — d'où la consigne
              explicite, sans quoi personne ne penserait à écrire un zéro. */}
          <p className="text-xs text-faint mt-1">
            Sur ta notification, rubrique « Franchises » → « Franchise salaires totale ». <strong>Beaucoup de notifications n'en mentionnent aucune : dans ce cas, saisis 0.</strong> Laisser vide
            signifie « je ne sais pas », et Cadence ne pourra pas écarter le risque de trop-perçu lors d'un renouvellement anticipé.
          </p>
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
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-date-limite-indemnisation">
            Date limite de ton indemnisation
          </label>
          <input
            id="profil-date-limite-indemnisation"
            type="date"
            value={dateLimiteIndemnisation}
            onChange={(e) => setDateLimiteIndemnisation(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
          <p className="text-xs text-faint mt-1">
            Sur ta notification, phrase « La date limite de votre indemnisation est le JJ/MM/AAAA ». Laisse vide si tu ne l'as pas sous la main — le suivi mensuel restera alors non borné dans le
            temps.
          </p>
          {dateLimiteIndemnisation && !profil.dateAnniversaire && dateLimiteIndemnisation !== dateSuggereeAcceptee && (
            <p className="text-xs rounded-lg px-3 py-2 mt-2 bg-teal/10 text-teal flex items-center justify-between gap-3 flex-wrap">
              <span>Ta date anniversaire semble être le {dateLimiteIndemnisation.split("-").reverse().join("/")} — veux-tu la renseigner ?</span>
              <button
                type="button"
                onClick={() => {
                  setDateSuggereeAcceptee(dateLimiteIndemnisation);
                  onSuggestionDateAnniversaire(dateLimiteIndemnisation);
                }}
                className="shrink-0 text-xs bg-teal text-bg font-medium rounded-lg px-3 py-1.5"
              >
                Oui, utiliser cette date
              </button>
            </p>
          )}
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

        {erreur && <p className="text-xs text-red">{erreur}</p>}

        <button
          onClick={enregistrer}
          disabled={!dateOuverture}
          className="w-full bg-mint text-bg font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Enregistrer
        </button>

          <GestionAjReelle profil={profil} onModifierProfil={onModifierProfil} />
          <GestionTauxPAS profil={profil} onModifierProfil={onModifierProfil} />
        </div>
      </details>
    </section>
  );
}

// Historique des taux d'AJ nette successifs (un utilisateur peut connaître plusieurs taux sur une
// même période d'indemnisation, cf. types/index.ts). Aucun repli sur une AJ estimée : sans entrée
// couvrant un mois donné, RevenusMensuels.tsx affiche honnêtement l'absence de montant pour ce mois.
// Seuil de plausibilité pour le champ "AJ nette" ci-dessous : une AJ nette réelle ne peut pas
// s'approcher du plafond de l'AJ BRUTE (config.are.plafond, 181,18 €) — au-delà de 60 €/j, la
// CSG/CRDS s'ajoute toujours à la retraite complémentaire (cf. engine/areNette.ts), donc un net
// est structurellement inférieur au brut dont il découle. Avertissement de plausibilité seulement
// (pas un blocage, pas un champ `natureMontant` déclaratif qui déplacerait le risque sans le
// réduire, cf. docs/reprise.md) : la valeur la plus probable en cas de dépassement est que
// l'utilisateur a recopié la ligne « allocation brute » d'un relevé de situation au lieu de la
// ligne « allocation journalière nette » de sa notification.
const SEUIL_PLAUSIBILITE_AJ_NETTE = franceTravailConfig.are.plafond * 0.9;

function GestionAjReelle({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const historique = profil.ajReelleHistorique ?? [];
  const [dateEffet, setDateEffet] = useState("");
  const [valeur, setValeur] = useState("");
  const valeurImplausible = valeur.trim() !== "" && Number(valeur) >= SEUIL_PLAUSIBILITE_AJ_NETTE;

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
        <p className="text-xs text-faint mt-1">Si ton allocation journalière a été revalorisée en cours de droits, ajoute une nouvelle ligne avec la date d'effet — visible sur tes relevés de situation.</p>
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
            onChange={(e) => {
              if (estSaisieNegative(e.target.value)) return;
              setValeur(e.target.value);
            }}
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

      {valeurImplausible && (
        <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">
          Ce montant semble élevé pour une allocation <strong>nette</strong> — vérifie que tu n'as
          pas recopié la ligne « allocation brute » d'un relevé de situation au lieu de la ligne
          « allocation journalière nette » de ta notification d'ouverture de droits.
        </p>
      )}
    </div>
  );
}

// Historique des taux de prélèvement à la source successifs (la DGFIP peut le revaloriser plusieurs
// fois sur une même période d'indemnisation, ex. réel : 3,30 % mi-2025 puis 3,10 % dès fin
// 2025/2026 — pas seulement une fois par an, cf. types/index.ts). Même pattern que
// GestionAjReelle ci-dessus. Aucun repli sur un taux estimé : sans entrée couvrant un mois donné,
// RevenusMensuels.tsx affiche honnêtement le montant brut pour ce mois (pas de net).
function GestionTauxPAS({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const ouverture = profil.ouvertureDroits;
  const historique = ouverture?.tauxPrelevementSourceHistorique ?? [];
  const [dateEffet, setDateEffet] = useState("");
  const [valeur, setValeur] = useState("");

  function ajouter() {
    if (!ouverture || !dateEffet || valeur.trim() === "") return;
    const nouveau = [...historique, { dateEffet, valeur: Number(valeur) }].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
    onModifierProfil({ ...profil, ouvertureDroits: { ...ouverture, tauxPrelevementSourceHistorique: nouveau } });
    setDateEffet("");
    setValeur("");
  }

  function supprimer(index: number) {
    if (!ouverture) return;
    onModifierProfil({ ...profil, ouvertureDroits: { ...ouverture, tauxPrelevementSourceHistorique: historique.filter((_, i) => i !== index) } });
  }

  if (!ouverture) return null;

  return (
    <div className="border-t border-line pt-5 space-y-4">
      <div>
        <h3 className="font-display text-base font-medium">Taux de prélèvement à la source</h3>
        <p className="text-xs text-faint mt-1">Visible sur tes relevés de situation France Travail ou sur impots.gouv.fr.</p>
        <p className="text-xs text-faint mt-1">Si ton taux a été revalorisé par la DGFIP en cours de droits, ajoute une nouvelle ligne avec la date d'effet.</p>
      </div>

      {historique.length === 0 ? (
        <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">Sans ce chiffre, seul le montant brut est affiché — pas de montant net estimé.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.03em] text-muted border-b border-line">
            <tr>
              <th className="text-left py-2">Date d'effet</th>
              <th className="text-right py-2">Taux (%)</th>
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
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-taux-pas-date-effet">
            Date d'effet
          </label>
          <input
            id="profil-taux-pas-date-effet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-taux-pas-valeur">
            Taux (%)
          </label>
          <input
            id="profil-taux-pas-valeur"
            type="number"
            min={0}
            max={99}
            step={0.1}
            placeholder="ex. 7,2"
            value={valeur}
            onChange={(e) => {
              if (estSaisieNegative(e.target.value)) return;
              setValeur(e.target.value);
            }}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <button
          onClick={ajouter}
          disabled={!dateEffet || valeur.trim() === ""}
          className="bg-mint text-bg font-medium rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
        >
          + Ajouter un taux
        </button>
      </div>
    </div>
  );
}
