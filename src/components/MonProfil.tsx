import { useEffect, useState } from "react";
import { franceTravailConfig } from "../config/franceTravailConfig";
import { formaterDateLisible } from "../lib/dateLisible";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { profilHorsPerimetre, regimeEffectif } from "../lib/profilHorsPerimetre";
import { CONTRADICTION_HORS_A10 } from "../content/contradictionHorsA10";
import { validerCoherenceProfil } from "../lib/coherenceProfil";
import { estSaisieNegative } from "../lib/saisieNombrePositif";
import { ajouterJours } from "../engine/dateUtils";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import type { Contrat, DecompteHeuresResultat, PeriodeAssimilee, Profil } from "../types";
import { PeriodeForm } from "./PeriodeForm";
import { PeriodeList } from "./PeriodeList";
import { DateNaissanceInput } from "./DateNaissanceInput";
import { MentionsLegales } from "./MentionsLegales";
import { LIMITES_STRUCTURELLES, PERIMETRE_MVP } from "../content/perimetreEtLimites";
import { InfoPopover } from "./InfoPopover";
import { ouvrirMesCourriers } from "./OuvrirEspacePersonnelFT";
import { ImportDocumentIA } from "./ImportDocumentIA";
import type { TypeDocument } from "../storage/documentsStorage";

type OnModifierProfil = (profil: Profil) => ResultatEcritureProfil;

/**
 * Petit retour visuel après un clic réussi sur « Enregistrer » (08/08/2026, demande de Benoît) : sans
 * lui, rien à l'écran ne change quand les valeurs enregistrées sont déjà celles affichées — impossible
 * de savoir si le clic a été pris en compte. Disparaît de lui-même après 2 s, jamais cliquable.
 */
function useConfirmationEnregistrement(): [boolean, () => void] {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const minuteur = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(minuteur);
  }, [visible]);
  return [visible, () => setVisible(true)];
}

function ConfirmationEnregistrement({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="text-sm text-mint inline-flex items-center gap-1.5" role="status">
      <span aria-hidden="true">✓</span> Enregistré
    </span>
  );
}

/** Ancre native + défilement doux (08/08/2026, demande de Benoît : un saut direct est moins lisible
 *  qu'un défilement animé). `href` reste posé pour l'accessibilité (clic milieu, ouverture dans un
 *  nouvel onglet) — seul le clic gauche normal est intercepté pour animer le défilement. */
function allerVersSection(e: React.MouseEvent<HTMLAnchorElement>, cible: string) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const element = document.getElementById(cible);
  if (!element) return;
  e.preventDefault();
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Même pastille que dans « Ta progression » et en haut à droite de chaque section — une seule
 *  définition visuelle pour que la coche soit reconnaissable partout. */
export function BadgeEtapeComplete({ complete }: { complete: boolean }) {
  return (
    <span
      aria-hidden="true"
      title={complete ? "Complété" : "À compléter"}
      className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs transition-colors ${
        complete ? "bg-mint border-mint text-bg" : "border-line-strong text-transparent"
      }`}
    >
      ✓
    </span>
  );
}

interface EtapeProfil {
  cible: string;
  label: string;
  complete: boolean;
}

/** Partagées entre `etapesProfil` (compteur global) et les pastilles posées sur chaque section
 *  (BadgeEtapeComplete) — une seule formule par catégorie, jamais recopiée. */
function tonProfilComplet(profil: Profil): boolean {
  return profil.dateNaissance !== "" && profil.dateAnniversaire !== "";
}
function regimeDeclareComplet(profil: Profil): boolean {
  return regimeEffectif(profil) === "annexe10_pur" || (profil.salairesHorsAnnexe10PRA !== undefined && profil.salairesHorsAnnexe10PRA !== null);
}

/**
 * Les catégories INDISPENSABLES de « Mon profil » (08/08/2026, demande de Benoît) — pas les manques
 * bloquants exacts du moteur (lib/documentsRequis.ts, qui mélange des champs d'autres onglets comme
 * l'AJ réelle) : ici, une catégorie = une carte de CETTE page, pour que la coche corresponde à ce que
 * l'utilisateur voit en scrollant.
 *
 * « Mon indemnisation en cours » et « Taux de prélèvement » n'apparaissent QUE si des droits sont
 * déjà ouverts : sans notification France Travail, ces deux cases sont hors de portée (on ne peut
 * pas remplir une ouverture de droits qui n'existe pas encore) — les compter comme « à faire »
 * culpabiliserait pour rien un premier admis qui vient d'arriver. Elles rejoignent la liste dès que
 * `ouvertureDroits` existe.
 */
function etapesProfil(profil: Profil): EtapeProfil[] {
  const etapes: EtapeProfil[] = [{ cible: "section-ton-profil", label: "Ton profil", complete: tonProfilComplet(profil) }];

  if (profil.ouvertureDroits) {
    etapes.push({ cible: "section-mon-indemnisation", label: "Mon indemnisation en cours", complete: true });
    etapes.push({
      cible: "section-taux-pas",
      label: "Taux de prélèvement à la source",
      complete: (profil.ouvertureDroits.tauxPrelevementSourceHistorique?.length ?? 0) > 0,
    });
  }

  etapes.push({ cible: "section-regime-declare", label: "Régime déclaré", complete: regimeDeclareComplet(profil) });

  return etapes;
}

interface TacheOptionnelle {
  cible: string;
  label: string;
  note: string;
}

/** Jamais comptées dans le X/N : ni bloquantes, ni « à faire » pour tout le monde — juste des
 *  raccourcis vers ce qui ne concerne qu'une partie des utilisateurs. */
const TACHES_OPTIONNELLES: TacheOptionnelle[] = [
  { cible: "section-periodes-particulieres", label: "Périodes particulières", note: "uniquement si concerné (maternité, arrêt maladie, accident du travail…)" },
  { cible: "section-mon-indemnisation", label: "Historique de tes ouvertures de droits précédentes", note: "seulement si tu veux reconstituer tes anciens cycles" },
];

/**
 * Gestionnaire de tâches en tête d'onglet (08/08/2026, demande de Benoît) : sans lui, rien ne dit à
 * un nouvel utilisateur que cette page doit être remplie EN PREMIER pour que le reste de Cadence
 * (tableau de bord, revenus mensuels, simulateur) calcule quoi que ce soit de fiable. Chaque étape
 * renvoie vers sa section par ancre plutôt que de dupliquer les champs ici.
 *
 * Masqué entièrement une fois les catégories indispensables toutes complétées (demande de Benoît) :
 * inutile de continuer à occuper de la place en tête de page pour dire « c'est bon » — la carte de
 * chaque section porte de toute façon sa propre coche (BadgeEtapeComplete), qui reste visible.
 */
function ProgressionProfil({ profil }: { profil: Profil }) {
  const etapes = etapesProfil(profil);
  const completees = etapes.filter((e) => e.complete).length;
  const total = etapes.length;

  if (completees === total) return null;

  return (
    <section className="rounded-card border p-5 bg-amber/5 border-amber/30">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-display text-lg font-medium">Informations à compléter</h2>
        <span className="text-sm font-medium tabular-nums text-amber">
          {completees}/{total} complété{completees > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-muted mb-4">Nécessaires au bon fonctionnement de Cadence (tableau de bord, revenus mensuels, simulateur).</p>

      {/* Deux colonnes dans le même cadre (08/08/2026, demande de Benoît) : le facultatif à droite au
          lieu d'en dessous, pour que le cadre reste court plutôt que de s'empiler en hauteur. */}
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 md:divide-x md:divide-line">
        <ul className="space-y-2">
          {etapes.map((etape) => (
            <li key={etape.label}>
              <a href={`#${etape.cible}`} onClick={(e) => allerVersSection(e, etape.cible)} className="flex items-center gap-2.5 text-sm group">
                <BadgeEtapeComplete complete={etape.complete} />
                <span className={`group-hover:underline ${etape.complete ? "text-muted" : "text-ink"}`}>{etape.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="md:pl-6">
          <p className="text-xs uppercase tracking-[.03em] text-faint mb-2">Facultatif</p>
          <ul className="space-y-1.5">
            {TACHES_OPTIONNELLES.map((tache) => (
              <li key={tache.label} className="text-sm">
                <a href={`#${tache.cible}`} onClick={(e) => allerVersSection(e, tache.cible)} className="text-muted hover:text-ink hover:underline">
                  {tache.label}
                </a>
                <span className="text-xs text-faint"> — {tache.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

interface MonProfilProps {
  dateDuJour: string;
  profil: Profil;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
  contrats: Contrat[];
  periodes: PeriodeAssimilee[];
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onSupprimerPeriode: (id: string) => void;
  /** Nécessaires à l'import IA embarqué dans « Mon indemnisation » et « Taux de prélèvement » — même
   *  pipeline que l'onglet « Importer », juste sans changer d'onglet pour l'atteindre. */
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
  /**
   * Vers l'onglet « Paramètres, sources & mentions » (refonte UI, 07/08/2026), où le texte complet du
   * périmètre/des limites vit désormais aussi — absent : les liens « En savoir plus » des info-bulles
   * ne font rien (ne devrait pas arriver en pratique, `App.tsx` la fournit toujours).
   */
  onNaviguerVersParametres?: () => void;
}

export function MonProfil({
  dateDuJour,
  profil,
  onModifierProfil,
  contrats,
  periodes,
  onAjouterPeriode,
  onSupprimerPeriode,
  decompteActuel,
  onAjouterContrat,
  onModifierContrat,
  onNaviguerVersParametres = () => {},
}: MonProfilProps) {
  const [formPeriodeOuvert, setFormPeriodeOuvert] = useState(false);
  const [mentionsLegalesOuvertes, setMentionsLegalesOuvertes] = useState(false);
  const regime = regimeEffectif(profil);

  const [dateNaissance, setDateNaissance] = useState(profil.dateNaissance);
  const [situation, setSituation] = useState<Profil["situation"]>(profil.situation);
  const [dateAnniversaireConnue, setDateAnniversaireConnue] = useState(Boolean(profil.dateAnniversaire));
  const [dateAnniversaire, setDateAnniversaire] = useState(profil.dateAnniversaire);
  const [dateAnniversairePrecedente, setDateAnniversairePrecedente] = useState(profil.dateAnniversairePrecedente ?? "");
  const [confirmationRequise, setConfirmationRequise] = useState(false);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);

  const dateAnniversaireCandidate = dateAnniversaireConnue ? dateAnniversaire : "";
  const coherence = validerCoherenceProfil({
    dateNaissance,
    situation,
    dateAnniversaire: dateAnniversaireCandidate,
    dateAnniversairePrecedente: dateAnniversairePrecedente || undefined,
  });
  const formulaireComplet = dateNaissance.length > 0 && (!dateAnniversaireConnue || dateAnniversaire.length > 0);
  const peutEnregistrer = coherence.coherent && formulaireComplet;
  const dateAnniversaireModifiee = dateAnniversaireCandidate !== profil.dateAnniversaire;

  const [profilEnregistre, declencherProfilEnregistre] = useConfirmationEnregistrement();

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
    declencherProfilEnregistre();
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <ProgressionProfil profil={profil} />

      <section id="section-ton-profil" className="scroll-mt-20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-display text-lg font-medium">Ton profil</h2>
          <BadgeEtapeComplete complete={tonProfilComplet(profil)} />
        </div>

        {/* Deux cartes côte à côte (07/08/2026, demande de Benoît) : ce qui t'identifie et ce qui suit
            tes 507 h sont deux sujets différents, jusqu'ici fondus dans une seule carte au point de se
            confondre. Un seul bouton "Enregistrer" en dessous écrit toujours les deux d'un coup — la
            séparation est seulement visuelle, la donnée reste validée ensemble (cf. validerCoherenceProfil).
            `items-start` (08/08/2026) : sans lui, la grille étire les deux cartes à la même hauteur —
            en réadmission, « Suivi des 507 h » grandit (champ + paragraphe en plus) et « Ton identité »
            se retrouvait étiré avec un grand vide en bas, un effet moche corrigé ici. Depuis
            (08/08/2026, toujours Benoît) : les deux moitiés vivent maintenant dans UN seul cadre
            (`divide-x` au lieu de deux cartes séparées), et le bouton Enregistrer est repassé À
            L'INTÉRIEUR de ce même cadre plutôt qu'en dessous, dans le vide. */}
        <div className="bg-surface border border-line rounded-card p-5">
          <div className="grid md:grid-cols-2 gap-6 md:divide-x md:divide-line">
            <div className="space-y-5 md:pr-6">
              <h3 className="font-display text-sm font-medium tracking-tight text-muted">Ton identité</h3>
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
                      // Une réadmission SANS date anniversaire connue est bloquée à la validation
                      // (validerCoherenceProfil) — la case "je ne sais pas" ci-contre n'est donc jamais
                      // proposée dans ce cas. Reforcer `true` ici évite l'impasse pour qui l'avait
                      // cochée en "Première admission" avant de changer d'avis.
                      setDateAnniversaireConnue(true);
                      reinitialiserConfirmation();
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${situation === "readmission" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
                  >
                    Réadmission
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5 md:pl-6">
              <div>
                <h3 className="font-display text-sm font-medium tracking-tight text-muted">Suivi des 507 heures</h3>
                <p className="text-xs text-faint mt-1">Détermine quand ton compteur de 507 h repart à zéro — sans rapport avec le montant de ton allocation, ci-dessous.</p>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-[.03em] text-muted mb-2">Date anniversaire (fin de tes derniers droits ouverts)</span>
                {/* Case masquée en réadmission, pas seulement désactivée : une réadmission sans cette
                    date est bloquée à la validation (coherenceProfil.ts) — autant ne jamais montrer un
                    choix qui mène droit à une impasse. */}
                {situation !== "readmission" && (
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
                )}
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
                    Cadence s'en sert pour borner correctement la recherche d'heures si tu dois remonter loin. Si tu ne l'as pas sous la main, laisse vide : Cadence te le signalera dans le tableau
                    de bord.
                  </p>
                </div>
              )}
            </div>
          </div>

          {!coherence.coherent && <p className="text-xs text-red mt-4">{coherence.raison}</p>}
          {erreurEcriture && <p className="text-xs text-red mt-4">{erreurEcriture}</p>}

          <div className="flex items-center gap-3 mt-5">
            <div className="flex gap-2">
              <button
                onClick={enregistrer}
                disabled={!peutEnregistrer}
                className="flex-1 md:flex-none md:px-8 bg-mint text-bg font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {confirmationRequise ? "Confirmer le changement" : "Enregistrer"}
              </button>
              {confirmationRequise && (
                <button onClick={reinitialiserConfirmation} className="px-4 rounded-lg border border-line text-muted">
                  Annuler
                </button>
              )}
            </div>
            <ConfirmationEnregistrement visible={profilEnregistre} />
          </div>
        </div>
      </section>

      {/* Chacune en pleine largeur, l'une sous l'autre (08/08/2026, demande de Benoît — retour en
          arrière sur le pairage en demi-colonnes du 08/08/2026 : « Mon indemnisation » est trop
          dense pour partager une rangée). La page reste néanmoins organisée en colonne (une section
          pleine largeur après l'autre, cf. le reste de cet onglet) — seule cette paire cesse d'être
          côte à côte. */}
      <div id="section-mon-indemnisation" className="scroll-mt-20">
        <MonIndemnisationEnCours
          profil={profil}
          onModifierProfil={onModifierProfil}
          onSuggestionDateAnniversaire={suggererDateAnniversaire}
          contrats={contrats}
          decompteActuel={decompteActuel}
          onAjouterContrat={onAjouterContrat}
          onAjouterPeriode={onAjouterPeriode}
          onModifierContrat={onModifierContrat}
        />
      </div>
      {profil.ouvertureDroits && (
        <div id="section-taux-pas" className="scroll-mt-20">
          <GestionTauxPAS
            profil={profil}
            onModifierProfil={onModifierProfil}
            contrats={contrats}
            decompteActuel={decompteActuel}
            onAjouterContrat={onAjouterContrat}
            onAjouterPeriode={onAjouterPeriode}
            onModifierContrat={onModifierContrat}
          />
        </div>
      )}

      {/* « Documents à rassembler » a déménagé dans l'onglet « Déposer un document » (08/08/2026,
          demande de Benoît), fusionnée avec la checklist qui y vivait déjà — Périodes particulières
          n'a donc plus de voisine et passe dans son propre cadre (elle n'en avait pas avant, sa
          bordure lui venait uniquement du pairage avec DocumentsUtiles). */}
      <section id="section-periodes-particulieres" className="scroll-mt-20 bg-surface border border-line rounded-card p-5">
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

      {/* Déplacé tout en bas de l'onglet (08/08/2026, demande de Benoît) : cette carte concerne un cas
          minoritaire (revenus hors spectacle), elle n'a plus besoin d'être la première chose vue en
          arrivant sur « Mon profil ». */}
      <div id="section-regime-declare" className="scroll-mt-20 bg-surface border border-line rounded-card p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <span className="block text-xs uppercase tracking-[.03em] text-muted">
            Cette année, as-tu été payé pour autre chose que des concerts / prestations d'artiste&nbsp;? Par exemple du travail technique sur un spectacle
            (son, lumière, régie…), ou un emploi salarié classique hors spectacle.
          </span>
          <BadgeEtapeComplete complete={regimeDeclareComplet(profil)} />
        </div>
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

      {/* Les deux sections en pleine page ont été remplacées par ces info-bulles (refonte UI,
          07/08/2026) : le texte complet ne bouge pas (content/perimetreEtLimites.ts, une seule
          source avec l'onglet Paramètres), seul son point d'entrée change — plus lisible pour qui ne
          veut pas le lire à chaque visite, toujours accessible pour qui le veut. */}
      <div className="flex items-center gap-5 flex-wrap text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          Périmètre du MVP
          <InfoPopover titre="Périmètre du MVP" onEnSavoirPlus={onNaviguerVersParametres}>
            <ul className="list-disc list-inside space-y-1">
              {PERIMETRE_MVP.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InfoPopover>
        </span>
        <span className="inline-flex items-center gap-1.5">
          Limites structurelles à garder en tête
          <InfoPopover titre="Limites structurelles à garder en tête" onEnSavoirPlus={onNaviguerVersParametres}>
            <ul className="list-disc list-inside space-y-1">
              {LIMITES_STRUCTURELLES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InfoPopover>
        </span>
      </div>

      {EMAIL_FEEDBACK && (
        <div>
          <a href={construireLienFeedback(EMAIL_FEEDBACK)} className="inline-block text-sm text-mint hover:underline">
            Donner mon avis sur Cadence →
          </a>
          <p className="text-xs text-faint mt-1">ou écris-moi directement à {EMAIL_FEEDBACK}</p>
        </div>
      )}

      <div>
        <button type="button" onClick={() => setMentionsLegalesOuvertes(true)} className="text-xs text-faint hover:text-muted transition-colors underline">
          Mentions légales &amp; confidentialité
        </button>
      </div>

      {mentionsLegalesOuvertes && <MentionsLegales onFermer={() => setMentionsLegalesOuvertes(false)} />}
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
  const [confirme, declencherConfirme] = useConfirmationEnregistrement();

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
    if (resultat.ok) declencherConfirme();
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
      <div className="mt-2 flex justify-center">
        <ConfirmationEnregistrement visible={confirme} />
      </div>
    </div>
  );
}

interface ImportInlineProps {
  profil: Profil;
  contrats: Contrat[];
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierProfil: OnModifierProfil;
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
  typeSuggere: TypeDocument;
}

// Import IA embarqué directement dans « Mon indemnisation en cours » et « Taux de prélèvement à la
// source » (08/08/2026, demande de Benoît) : plus de redirection vers l'onglet « Importer » — déposer
// le fichier ici l'envoie directement à l'IA, exactement le même pipeline (ImportDocumentIA), juste
// sans changer d'onglet pour l'atteindre. Replié par défaut (`<details>`) pour ne pas allonger la
// page : chaque section reste courte tant que personne ne clique.
function ImportInline({ profil, contrats, decompteActuel, onAjouterContrat, onAjouterPeriode, onModifierProfil, onModifierContrat, typeSuggere }: ImportInlineProps) {
  return (
    <details className="rounded-lg border border-line bg-surface-2">
      <summary className="cursor-pointer select-none list-none px-4 py-2.5 text-sm text-muted hover:text-ink transition-colors flex items-center gap-2">
        <span aria-hidden="true">▸</span>
        Importer le fichier
      </summary>
      <div className="px-4 pb-4 pt-1">
        <ImportDocumentIA
          profil={profil}
          config={franceTravailConfig}
          decompteActuel={decompteActuel}
          contrats={contrats}
          onAjouterContrat={onAjouterContrat}
          onAjouterPeriode={onAjouterPeriode}
          onModifierProfil={onModifierProfil}
          onModifierContrat={onModifierContrat}
          typeSuggere={typeSuggere}
          compact
        />
      </div>
    </details>
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
  contrats,
  decompteActuel,
  onAjouterContrat,
  onAjouterPeriode,
  onModifierContrat,
}: {
  profil: Profil;
  onModifierProfil: OnModifierProfil;
  onSuggestionDateAnniversaire: (date: string) => void;
  contrats: Contrat[];
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
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
  const [confirme, declencherConfirme] = useConfirmationEnregistrement();

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
    declencherConfirme();
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
        <summary className="cursor-pointer select-none list-none px-5 py-3 font-display text-lg font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">▸</span>
            Mon indemnisation en cours
            {!ouverture && <span className="text-xs font-sans font-normal text-faint">— si tes droits sont déjà ouverts</span>}
          </span>
          <BadgeEtapeComplete complete={Boolean(ouverture)} />
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-5">
          <p className="text-sm text-muted">
            Ces informations figurent sur ta notification d'ouverture de droits France Travail. Tu peux la retrouver dans ton espace personnel francetravail.fr → « Mes paiements » → « Mes
            notifications ». Si tes droits ne sont pas encore ouverts, laisse cette section vide.
          </p>

          {/* Le lien France Travail ouvre un vrai nouvel onglet, comme OuvrirEspacePersonnelFT —
              jamais une iframe (FranceConnect l'interdit). L'import, lui, reste ici : inutile de
              changer d'onglet pour déposer le fichier, l'IA le reçoit directement (cf. ImportInline). */}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={ouvrirMesCourriers} className="text-sm bg-mint text-bg font-medium rounded-lg px-4 py-2 transition-opacity hover:opacity-90">
              Télécharger ma notification sur France Travail
            </button>
          </div>

          <ImportInline
            profil={profil}
            contrats={contrats}
            decompteActuel={decompteActuel}
            onAjouterContrat={onAjouterContrat}
            onAjouterPeriode={onAjouterPeriode}
            onModifierProfil={onModifierProfil}
            onModifierContrat={onModifierContrat}
            typeSuggere="notification_are"
          />

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
        <div className="flex justify-center">
          <ConfirmationEnregistrement visible={confirme} />
        </div>

          {/* Allocation journalière réelle (GestionAjReelle) déménagée dans RevenusMensuels.tsx le
              07/08/2026 (idée de Benoît) : c'est là qu'elle est réellement consommée mois par mois,
              pas ici. Le taux de PAS, lui, est parti le 08/08/2026 dans sa propre carte à côté
              (cf. le rendu en grille dans MonProfil ci-dessus) — seul l'historique des ouvertures de
              droits précédentes reste ici. */}
          <GestionHistoriqueOuvertureDroits profil={profil} onModifierProfil={onModifierProfil} />
        </div>
      </details>
    </section>
  );
}

// Historique des taux de prélèvement à la source successifs (la DGFIP peut le revaloriser plusieurs
// fois sur une même période d'indemnisation, ex. réel : 3,30 % mi-2025 puis 3,10 % dès fin
// 2025/2026 — pas seulement une fois par an, cf. types/index.ts). Même pattern que GestionAjReelle
// (RevenusMensuels.tsx, depuis le 07/08/2026). Aucun repli sur un taux estimé : sans entrée
// couvrant un mois donné, RevenusMensuels.tsx affiche honnêtement le montant brut pour ce mois (pas de net).
function GestionTauxPAS({
  profil,
  onModifierProfil,
  contrats,
  decompteActuel,
  onAjouterContrat,
  onAjouterPeriode,
  onModifierContrat,
}: {
  profil: Profil;
  onModifierProfil: OnModifierProfil;
  contrats: Contrat[];
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
}) {
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
    <div className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium">Taux de prélèvement à la source</h3>
          <p className="text-xs text-faint mt-1">Visible sur tes relevés de situation France Travail ou sur impots.gouv.fr.</p>
          <p className="text-xs text-faint mt-1">Si ton taux a été revalorisé par la DGFIP en cours de droits, ajoute une nouvelle ligne avec la date d'effet.</p>
        </div>
        <BadgeEtapeComplete complete={historique.length > 0} />
      </div>

      {/* Même pattern que « Mon indemnisation en cours » ci-contre : un lien vers la source externe,
          un import qui reste ici plutôt que de changer d'onglet. */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.open("https://cfspart.impots.gouv.fr/tremisu/accueil.html", "_blank", "noopener,noreferrer")}
          className="text-sm bg-mint text-bg font-medium rounded-lg px-4 py-2 transition-opacity hover:opacity-90"
        >
          Consulter mon taux sur impots.gouv.fr
        </button>
      </div>

      <ImportInline
        profil={profil}
        contrats={contrats}
        decompteActuel={decompteActuel}
        onAjouterContrat={onAjouterContrat}
        onAjouterPeriode={onAjouterPeriode}
        onModifierProfil={onModifierProfil}
        onModifierContrat={onModifierContrat}
        typeSuggere="attestation_taux_pas"
      />

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
                <td className="py-2">{formaterDateLisible(h.dateEffet)}</td>
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

/**
 * Suggère la date d'échéance du PROCHAIN cycle passé à saisir (le plus ancien pas encore connu) —
 * jamais imposée, juste pré-remplie dans un champ qui reste modifiable (devoir n°2 : une suggestion
 * n'est pas un fait). Toujours enchaîné (confirmé par Benoît le 07/08/2026) : un cycle se termine la
 * veille du jour où le suivant commence, donc l'échéance du cycle qu'on s'apprête à ajouter est
 * l'ouverture du plus ancien cycle déjà connu, moins un jour — ou `dateAnniversairePrecedente`
 * elle-même si aucun cycle n'est encore saisi (elle EST déjà cette échéance, par définition).
 *
 * Ne déduit jamais la date d'OUVERTURE : elle dépend de la durée réelle du cycle (12 mois ? clause de
 * rattrapage à 6 mois ?), que rien ici ne permet de connaître — c'est justement ce que cet historique
 * existe pour capturer plutôt que d'approximer.
 */
function suggererDateEcheanceHistorique(historique: { dateOuverture: string; dateEcheance: string }[], dateAnniversairePrecedente: string | undefined): string {
  if (historique.length === 0) return dateAnniversairePrecedente ?? "";
  const plusAncienneOuverture = historique.reduce((min, h) => (h.dateOuverture < min ? h.dateOuverture : min), historique[0].dateOuverture);
  return ajouterJours(plusAncienneOuverture, -1);
}

// Historique des ouvertures de droits ANTÉRIEURES à celle en cours (07/08/2026, idée de Benoît) —
// même pattern que GestionAjReelle/GestionTauxPAS ci-dessus, mais purement optionnel : sans lui,
// `engine/cycles.ts` reconstruit les vieux cycles par soustraction calendaire de 12 mois comme avant
// (jamais bloquant, contrairement à l'AJ nette ou au taux PAS — un onglet Historique reste utilisable
// sans ce champ, juste avec des dates approximées et signalées comme telles). Deux dates par entrée
// (`dateOuverture`/`dateEcheance`) : `decouperExercices` n'a besoin de rien d'autre pour ce cycle-là
// (pas de franchise/délai — ceux-ci ne concernent que le droit EN COURS, cf. types/index.ts).
function GestionHistoriqueOuvertureDroits({ profil, onModifierProfil }: { profil: Profil; onModifierProfil: OnModifierProfil }) {
  const historique = profil.historiqueOuvertureDroits ?? [];
  // Le plus récent d'abord à l'écran (demande explicite de Benoît) — le stockage, lui, reste trié
  // croissant par `dateEcheance` (même convention que ajReelleHistorique/tauxPrelevementSourceHistorique).
  const historiqueAffiche = [...historique].sort((a, b) => b.dateEcheance.localeCompare(a.dateEcheance));
  const suggestionEcheance = suggererDateEcheanceHistorique(historique, profil.dateAnniversairePrecedente);
  const [dateOuverture, setDateOuverture] = useState("");
  const [dateEcheance, setDateEcheance] = useState(suggestionEcheance);
  // Repropose la suggestion après chaque ajout (le champ vient d'être vidé) ou si l'historique change
  // sous nos pieds (import IA, suppression) — jamais si l'utilisateur est déjà en train d'y taper autre
  // chose, pour ne pas écraser une saisie en cours.
  useEffect(() => {
    setDateEcheance((actuelle) => (actuelle === "" ? suggestionEcheance : actuelle));
  }, [suggestionEcheance]);

  function ajouter() {
    if (!dateOuverture || !dateEcheance) return;
    const nouveau = [...historique, { dateOuverture, dateEcheance }].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
    onModifierProfil({ ...profil, historiqueOuvertureDroits: nouveau });
    setDateOuverture("");
    setDateEcheance("");
  }

  function supprimer(entree: { dateOuverture: string; dateEcheance: string }) {
    onModifierProfil({ ...profil, historiqueOuvertureDroits: historique.filter((h) => h !== entree) });
  }

  return (
    <div className="border-t border-line pt-5 space-y-4">
      <div>
        <h3 className="font-display text-base font-medium">Historique de tes ouvertures de droits précédentes</h3>
        <p className="text-xs text-faint mt-1">
          Optionnel : ajoute une ancienne notification d'admission (date d'ouverture et date d'échéance) pour que l'onglet « Historique » reconstruise ce cycle avec ses vraies dates plutôt qu'une
          approximation.
        </p>
        <p className="text-xs text-faint mt-1">
          Ajoute-les en partant du plus récent : la date d'échéance se pré-remplit toute seule (un cycle se termine la veille du suivant) — vérifie-la, elle reste modifiable.
        </p>
      </div>

      {historiqueAffiche.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[.03em] text-muted border-b border-line">
            <tr>
              <th className="text-left py-2">Date d'ouverture</th>
              <th className="text-left py-2">Date d'échéance</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {historiqueAffiche.map((h) => (
              <tr key={`${h.dateOuverture}-${h.dateEcheance}`} className="border-b border-line last:border-0">
                <td className="py-2">{formaterDateLisible(h.dateOuverture)}</td>
                <td className="py-2">{formaterDateLisible(h.dateEcheance)}</td>
                <td className="text-right py-2">
                  <button onClick={() => supprimer(h)} className="text-xs text-muted hover:text-red transition-colors">
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
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-historique-date-ouverture">
            Date d'ouverture
          </label>
          <input
            id="profil-historique-date-ouverture"
            type="date"
            value={dateOuverture}
            onChange={(e) => setDateOuverture(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-2" htmlFor="profil-historique-date-echeance">
            Date d'échéance
          </label>
          <input
            id="profil-historique-date-echeance"
            type="date"
            value={dateEcheance}
            onChange={(e) => setDateEcheance(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
          />
        </div>
        <button
          onClick={ajouter}
          disabled={!dateOuverture || !dateEcheance}
          className="bg-mint text-bg font-medium rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
        >
          + Ajouter une ouverture de droits
        </button>
      </div>
    </div>
  );
}
