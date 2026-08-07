/**
 * Écran de revue des propositions d'extraction IA.
 *
 * Principe non négociable : RIEN n'est écrit sans un geste explicite de l'utilisateur, proposition
 * par proposition. Il n'y a volontairement pas de bouton « tout appliquer » — une extraction IA
 * n'est pas une source de vérité, c'est une aide à la saisie. Un contrat passe toujours par le
 * formulaire complet (relecture champ par champ) ; les propositions de profil passent par
 * `onModifierProfil`, qui revalide (forme Zod + cohérence) et refuse d'écrire un profil invalide.
 *
 * Toute la décision « cette proposition est-elle applicable sans risque ? » vit dans
 * lib/routageExtraction.ts (pure et testée). Ce composant ne fait que l'afficher : aucune règle
 * métier ne doit être dupliquée ici.
 */

import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, PeriodeAssimilee, Profil } from "../types";
import type { ExtractionResult, Proposition } from "../types/extraction";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { RAPPEL_DOCUMENT_ENVOYE } from "../content/mentionEnvoiIA";
import type { ResultatEcritureProfil } from "../lib/coherenceProfil";
import {
  comparerContratExistant,
  contratConfirmeDepuisCorrespondance,
  contratDepuisProposition,
  detecterMergeAmbiguHeuresCachets,
  evaluerExtraction,
  periodeDepuisProposition,
  profilAvecProposition,
  type PropositionEvaluee,
  type StatutProposition,
} from "../lib/routageExtraction";
import type { DiagnosticAbsenceCorrespondance } from "../lib/correspondanceContrat";
import { formaterDateLisible } from "../lib/dateLisible";
import { ContractForm } from "./ContractForm";
import { PeriodeForm } from "./PeriodeForm";
import { TableauComparaison } from "./TableauComparaison";

interface RevueExtractionProps {
  resultat: ExtractionResult;
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onAjouterContrat: (contrat: Omit<Contrat, "id">) => void;
  onAjouterPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onModifierProfil: (profil: Profil) => ResultatEcritureProfil;
  /**
   * Contrats déjà saisis, pour proposer une correspondance plutôt qu'une création systématique
   * (cf. lib/correspondanceContrat.ts). Optionnel : absent (ex. bac à sable de développement, qui
   * n'a pas d'identifiants réels) = aucune correspondance jamais recherchée, comportement inchangé.
   */
  contrats?: Contrat[];
  /** Requis seulement si `contrats` est fourni — confirme une correspondance en mettant à jour le
   * contrat existant désigné (cf. contratConfirmeDepuisCorrespondance). */
  onModifierContrat?: (id: string, contrat: Omit<Contrat, "id">) => void;
  /** Bandeau affiché au-dessus de tout (ex. avertissement « extraction simulée » en développement). */
  bandeau?: React.ReactNode;
  /**
   * Vrai uniquement si ce résultat vient d'un document réellement envoyé au serveur. Affiche alors un
   * rappel discret de l'envoi et de son destinataire — la mention principale, elle, a été montrée
   * AVANT l'envoi (`ConsentementEnvoiIA.tsx`), pas ici : à ce stade il serait trop tard pour décider.
   *
   * Faux/absent pour une extraction simulée : écrire « ce document a été envoyé » alors que rien
   * n'est parti serait une phrase fausse, quand bien même elle serait rassurante (devoir n°2).
   */
  documentEnvoye?: boolean;
}

type EtatCarte = "en_attente" | "applique" | "ecarte";

const LABEL_DOCUMENT: Record<ExtractionResult["typeDocumentDetecte"], string> = {
  bulletin_paie: "Bulletin de paie",
  aem: "AEM (Attestation d'Employeur Mensuelle)",
  notification_admission: "Notification d'admission",
  releve_situation: "Relevé de situation",
  declaration_fiscale_annuelle: "Déclaration fiscale annuelle",
  attestation_cpam: "Attestation CPAM",
  justificatif_declaration: "Justificatif de déclaration mensuelle",
  attestation_taux_pas: "Attestation de taux de prélèvement à la source",
  non_reconnu: "Type de document non reconnu",
};

const LABEL_CONFIANCE: Record<"haute" | "moyenne" | "faible", string> = {
  haute: "confiance haute",
  moyenne: "à vérifier",
  faible: "peu fiable",
};

const COULEUR_CONFIANCE: Record<"haute" | "moyenne" | "faible", string> = {
  haute: "text-mint",
  moyenne: "text-amber",
  faible: "text-red",
};

export const LABELS_CHAMPS: Record<Proposition["cible"], Record<string, string>> = {
  contrat: {
    natureDocumentSource: "Type de document source",
    dateDebut: "Date de début",
    date: "Date de fin",
    type: "Nature du contrat",
    typeRemuneration: "Mode de rémunération",
    territoire: "Territoire",
    nbCachets: "Nombre de cachets",
    nbHeures: "Nombre d'heures",
    nbJoursEEE: "Jours travaillés (EEE)",
    salaireBrut: "Salaire brut (€)",
    employeur: "Employeur",
    etablissementAgree: "Établissement agréé",
    enRapportAvecMetier: "En rapport avec le métier",
  },
  profil_ouverture_droits: {
    dateOuverture: "Date d'ouverture des droits",
    franchiseCPTotale: "Franchise congés payés (jours)",
    delaiAttenteInitial: "Délai d'attente (jours)",
    dateLimiteIndemnisation: "Date limite d'indemnisation",
  },
  profil_infos: {
    dateAnniversaire: "Date anniversaire",
    dateNaissance: "Date de naissance",
    dateAnniversairePrecedente: "Date anniversaire précédente",
    situation: "Situation",
    dureeDroitsMois: "Durée des droits (mois)",
  },
  periode_assimilee: { type: "Type de période", dateDebut: "Début", dateFin: "Fin" },
  aj_reelle_historique: { dateEffet: "Date d'effet", valeur: "Montant (€)", natureMontant: "Nature du montant" },
  taux_pas_historique: { valeur: "Prélèvement à la source (%)", dateEffet: "Date d'effet" },
  info_seule: {},
};

/** Valeurs d'énumération rendues lisibles. Une valeur inconnue est affichée brute, jamais masquée. */
export const LABELS_VALEURS: Record<string, string> = {
  aem: "AEM (Attestation d'Employeur Mensuelle)",
  bulletin_paie: "Bulletin de paie",
  artiste: "Artiste",
  enseignement: "Enseignement",
  formation: "Formation",
  ptp: "PTP",
  cachet: "Cachets",
  heures: "Heures",
  france: "France",
  eee_suisse_uk: "EEE / Suisse / Royaume-Uni",
  premiere_admission: "Première admission",
  readmission: "Réadmission",
  maternite: "Maternité",
  adoption: "Adoption",
  accident_travail: "Accident du travail",
  ald: "Affection de longue durée (ALD)",
  suspension_contrat: "Suspension de contrat",
  maladie_intercontrat: "Maladie intercontrat",
  net: "Net",
  brut: "Brut",
  indetermine: "Indéterminé",
};

const STYLE_STATUT: Record<StatutProposition, { libelle: string; classe: string }> = {
  revue_formulaire: { libelle: "À vérifier dans le formulaire", classe: "bg-mint/15 text-mint" },
  applicable: { libelle: "Applicable", classe: "bg-mint/15 text-mint" },
  confirmation_ecrasement: { libelle: "Remplacerait une valeur existante", classe: "bg-amber/15 text-amber" },
  information: { libelle: "Information", classe: "bg-surface-2 text-muted" },
  non_applicable: { libelle: "Non applicable", classe: "bg-amber/15 text-amber" },
};

/**
 * Rend lisible une clé de champ dont on n'a pas d'étiquette : uniquement le cas de `info_seule`,
 * dont les clés sont produites librement par l'IA (« salaireDeReferenceOfficiel »). On se contente
 * de séparer les mots — pas de traduction ni de reformulation, pour ne pas donner à croire que
 * l'app a compris de quoi il s'agit. Les accents manquent donc parfois : c'est le texte de l'IA,
 * pas un libellé de Cadence.
 */
export function humaniserCle(cle: string): string {
  const mots = cle.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}

const RE_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function formaterValeur(valeur: unknown): { texte: string; nonLu: boolean } {
  if (valeur === null || valeur === undefined || valeur === "") return { texte: "non lu dans le document", nonLu: true };
  if (typeof valeur === "boolean") return { texte: valeur ? "Oui" : "Non", nonLu: false };
  if (typeof valeur === "string") {
    if (RE_DATE_ISO.test(valeur)) return { texte: formaterDateLisible(valeur), nonLu: false };
    return { texte: LABELS_VALEURS[valeur] ?? valeur, nonLu: false };
  }
  return { texte: String(valeur), nonLu: false };
}

/**
 * Texte purement informatif accompagnant un « aucune correspondance » (cf.
 * lib/correspondanceContrat.ts, diagnostiquerAbsenceCorrespondance) — jamais une action, jamais une
 * suggestion de fusion. Rend visible POURQUOI rien n'a été proposé, là où c'était un silence total
 * jusqu'ici (cas réel du 01/08/2026 : indiscernable sans relire le code).
 */
function texteDiagnosticAbsence(diagnostic: DiagnosticAbsenceCorrespondance): string {
  switch (diagnostic.type) {
    case "deja_confirme":
      return `Un contrat du même employeur et de la même période existe déjà, mais il est déjà confirmé par un document (${diagnostic.contratExistant.employeur} · ${formaterDateLisible(diagnostic.contratExistant.dateDebut)} → ${formaterDateLisible(diagnostic.contratExistant.date)}) — c'est pour ça qu'il n'est pas reproposé ici.`;
    case "nom_different_meme_mois":
      return `Un contrat de la même période existe déjà, mais sous un autre nom d'employeur : « ${diagnostic.contratExistant.employeur} » dans ton profil, « ${diagnostic.employeurDocument} » sur ce document — vérifie qu'il ne s'agit pas du même employeur écrit différemment.`;
    case "aucune_piste":
      return "Aucun contrat existant ne correspond (même employeur, même période) — sera enregistré comme un nouveau contrat.";
  }
}

export function RevueExtraction({
  resultat,
  profil,
  config,
  decompteActuel,
  onAjouterContrat,
  onAjouterPeriode,
  onModifierProfil,
  contrats = [],
  onModifierContrat,
  bandeau,
  documentEnvoye = false,
}: RevueExtractionProps) {
  const evaluees = evaluerExtraction(resultat, profil, contrats);
  const [etats, setEtats] = useState<Record<number, EtatCarte>>({});
  const [erreurs, setErreurs] = useState<Record<number, string>>({});
  const [formulaireOuvert, setFormulaireOuvert] = useState<number | null>(null);

  function appliquerAuProfil(index: number, proposition: Proposition) {
    // Le candidat est construit sans effet de bord ; c'est onModifierProfil (App.tsx) qui décide
    // s'il est écrit. Un refus laisse l'ancien profil intact et s'affiche sur la carte.
    const candidat = profilAvecProposition(profil, proposition);
    const ecriture = onModifierProfil(candidat);
    if (!ecriture.ok) {
      setErreurs((e) => ({ ...e, [index]: ecriture.erreur }));
      return;
    }
    setErreurs((e) => {
      const suite = { ...e };
      delete suite[index];
      return suite;
    });
    setEtats((s) => ({ ...s, [index]: "applique" }));
  }

  function enregistrerContrat(index: number, contrat: Omit<Contrat, "id">) {
    onAjouterContrat(contrat);
    setFormulaireOuvert(null);
    setEtats((s) => ({ ...s, [index]: "applique" }));
  }

  function enregistrerPeriode(index: number, periode: Omit<PeriodeAssimilee, "id">) {
    onAjouterPeriode(periode);
    setFormulaireOuvert(null);
    setEtats((s) => ({ ...s, [index]: "applique" }));
  }

  /**
   * Confirme qu'un contrat déjà saisi ("a_verifier") EST celui décrit par ce document — met à jour
   * ses champs avec les valeurs officielles (contratConfirmeDepuisCorrespondance, jamais un spread
   * aveugle) et le fait passer à "confirme". N'ajoute JAMAIS un nouveau contrat : c'est exactement
   * ce qui évite le doublon (cf. plan « cycle de vie du contrat »).
   */
  function confirmerCorrespondance(index: number, existant: Contrat, proposition: Extract<Proposition, { cible: "contrat" }>) {
    onModifierContrat?.(existant.id, contratConfirmeDepuisCorrespondance(existant, proposition.donnees));
    setEtats((s) => ({ ...s, [index]: "applique" }));
  }

  const restantes = evaluees.filter((_, i) => (etats[i] ?? "en_attente") === "en_attente").length;

  return (
    <div className="space-y-6">
      {bandeau}

      <div className="bg-surface border border-line rounded-card p-5 space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Document détecté</p>
            <h2 className="font-display text-lg font-semibold tracking-tight">{LABEL_DOCUMENT[resultat.typeDocumentDetecte]}</h2>
          </div>
          <p className="text-xs text-faint">
            {/* evaluees.length, pas resultat.propositions.length : après fusionnerContratsDupliques
                (routageExtraction.ts), le nombre de CARTES réellement affichées peut être inférieur
                au nombre de propositions brutes renvoyées par le modèle — afficher le compte brut
                ici serait incohérent avec ce qui est effectivement rendu en dessous. */}
            {evaluees.length === 0
              ? "Aucune proposition"
              : `${evaluees.length} proposition${evaluees.length > 1 ? "s" : ""} · ${restantes} à traiter`}
          </p>
        </div>
        <p className="text-xs text-faint leading-relaxed">
          Rien n'est enregistré tant que tu ne valides pas chaque proposition, une par une. Une extraction automatique peut se tromper : ce qui fait
          foi reste le document que tu as sous les yeux.
        </p>
        {documentEnvoye && <p className="text-xs text-faint leading-relaxed border-t border-line pt-3">{RAPPEL_DOCUMENT_ENVOYE}</p>}
        {resultat.avertissementsGeneraux.length > 0 && (
          <ul className="text-sm text-amber space-y-1.5 border-t border-line pt-3">
            {resultat.avertissementsGeneraux.map((a, i) => (
              <li key={i} className="leading-relaxed">
                ⚠ {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      {evaluees.map((evaluee, index) => (
        <CarteProposition
          key={index}
          evaluee={evaluee}
          etat={etats[index] ?? "en_attente"}
          erreur={erreurs[index]}
          formulaireOuvert={formulaireOuvert === index}
          profil={profil}
          config={config}
          decompteActuel={decompteActuel}
          onAppliquer={() => appliquerAuProfil(index, evaluee.proposition)}
          onOuvrirFormulaire={() => setFormulaireOuvert(index)}
          onFermerFormulaire={() => setFormulaireOuvert(null)}
          onEnregistrerContrat={(contrat) => enregistrerContrat(index, contrat)}
          onEnregistrerPeriode={(periode) => enregistrerPeriode(index, periode)}
          onConfirmerCorrespondance={(existant) => {
            if (evaluee.proposition.cible === "contrat") confirmerCorrespondance(index, existant, evaluee.proposition);
          }}
          onEcarter={() => setEtats((s) => ({ ...s, [index]: "ecarte" }))}
        />
      ))}
    </div>
  );
}

interface CartePropositionProps {
  evaluee: PropositionEvaluee;
  etat: EtatCarte;
  erreur?: string;
  formulaireOuvert: boolean;
  profil: Profil;
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onAppliquer: () => void;
  onOuvrirFormulaire: () => void;
  onFermerFormulaire: () => void;
  onEnregistrerContrat: (contrat: Omit<Contrat, "id">) => void;
  onEnregistrerPeriode: (periode: Omit<PeriodeAssimilee, "id">) => void;
  onConfirmerCorrespondance: (existant: Contrat) => void;
  onEcarter: () => void;
}

function CarteProposition({
  evaluee,
  etat,
  erreur,
  formulaireOuvert,
  profil,
  config,
  decompteActuel,
  onAppliquer,
  onOuvrirFormulaire,
  onFermerFormulaire,
  onEnregistrerContrat,
  onEnregistrerPeriode,
  onConfirmerCorrespondance,
  onEcarter,
}: CartePropositionProps) {
  const { proposition, titre, statut, motif, avertissements, correspondances, diagnosticAbsence, champsEcrases } = evaluee;
  const labels = LABELS_CHAMPS[proposition.cible];
  const style = STYLE_STATUT[statut];
  const traitee = etat !== "en_attente";
  // Choix explicite de l'utilisateur d'ignorer les correspondances proposées et de traiter ce
  // document comme un contrat séparé (cf. plan, §5 : jamais un choix automatique). Purement local à
  // la carte — ne fait rien tant que rien n'est validé, donc pas besoin d'être suivi par le parent.
  const [traiterCommeNouveau, setTraiterCommeNouveau] = useState(false);
  const aDesCorrespondances = proposition.cible === "contrat" && (correspondances?.length ?? 0) > 0 && !traiterCommeNouveau;
  // 07/08/2026 : un contrat déjà confirmé par un document n'est plus proposé en correspondance
  // (diagnosticAbsence.type === "deja_confirme"), mais rien n'empêchait jusqu'ici de cliquer quand
  // même « Vérifier et enregistrer » et de créer un second contrat identique. Même principe que
  // `traiterCommeNouveau` ci-dessus : un choix explicite, jamais automatique, avant d'ouvrir le
  // formulaire dans ce cas précis.
  const [doublonContratConfirme, setDoublonContratConfirme] = useState(false);
  const estDoublonContratNonConfirme = proposition.cible === "contrat" && diagnosticAbsence?.type === "deja_confirme" && !doublonContratConfirme;

  return (
    <section className={`bg-surface border rounded-card p-5 space-y-4 transition-opacity ${traitee ? "border-line opacity-60" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-base font-medium tracking-tight">{titre}</h3>
          <p className="text-xs text-faint mt-1 leading-relaxed">{proposition.justification}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${etat === "applique" ? "bg-mint/15 text-mint" : etat === "ecarte" ? "bg-surface-2 text-faint" : style.classe}`}>
          {etat === "applique" ? "Enregistré" : etat === "ecarte" ? "Écarté" : style.libelle}
        </span>
      </div>

      <dl className="text-sm divide-y divide-line/60 border-y border-line/60">
        {Object.entries(proposition.donnees).map(([champ, valeur]) => {
          const { texte, nonLu } = formaterValeur(valeur);
          const confiance = proposition.confiance[champ];
          return (
            <div key={champ} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-muted">{labels[champ] ?? humaniserCle(champ)}</dt>
              <dd className="text-right flex items-baseline gap-2">
                <span className={nonLu ? "text-faint italic" : "text-ink"}>{texte}</span>
                {confiance && !nonLu && <span className={`text-xs ${COULEUR_CONFIANCE[confiance]}`}>· {LABEL_CONFIANCE[confiance]}</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      {avertissements.length > 0 && (
        <ul className="text-xs text-amber space-y-1.5">
          {avertissements.map((a, i) => (
            <li key={i} className="leading-relaxed">
              ⚠ {a}
            </li>
          ))}
        </ul>
      )}

      {motif && (
        <p className={`text-xs leading-relaxed rounded-lg px-3 py-2.5 ${statut === "non_applicable" ? "bg-amber/10 text-amber" : "bg-surface-2 text-muted"}`}>{motif}</p>
      )}

      {erreur && (
        <p className="text-xs text-red leading-relaxed bg-red/10 rounded-lg px-3 py-2.5">
          Rien n'a été enregistré : {erreur}
        </p>
      )}

      {!traitee && !formulaireOuvert && aDesCorrespondances && proposition.cible === "contrat" && (
        <div className="space-y-3">
          <p className="text-sm text-ink">Ce document semble correspondre à un contrat déjà saisi :</p>
          {(correspondances ?? []).map((candidat) => {
            const comparaisons = comparerContratExistant(candidat, proposition.donnees);
            const mergeAmbigu = proposition.cible === "contrat" ? detecterMergeAmbiguHeuresCachets(candidat, proposition.donnees) : null;
            return (
              <div key={candidat.id} className="border border-line rounded-lg p-3 space-y-2.5">
                <p className="text-sm text-ink">
                  {candidat.employeur} · {formaterDateLisible(candidat.dateDebut)} → {formaterDateLisible(candidat.date)} · {candidat.salaireBrut.toFixed(0)} € brut
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line align-middle">AEM/bulletin en attente</span>
                </p>
                <TableauComparaison comparaisons={comparaisons} />
                {mergeAmbigu ? (
                  // Purement informatif — jamais un bouton qui fusionnerait ou réinitialiserait quoi
                  // que ce soit ici (cf. detecterMergeAmbiguHeuresCachets, lib/routageExtraction.ts).
                  <p className="text-xs leading-relaxed rounded-lg px-3 py-2.5 bg-amber/10 text-amber">
                    Ce document ne mentionne que {labels[mergeAmbigu.champManquant === "nbHeures" ? "nbCachets" : "nbHeures"]?.toLowerCase()}, mais ce contrat porte déjà {labels[mergeAmbigu.champManquant]?.toLowerCase()}
                    &nbsp;: {mergeAmbigu.valeurExistante}. Pour éviter un double comptage, cette correspondance ne peut pas être confirmée en un clic — modifie ce contrat depuis « Contrats » si besoin (la
                    case « Activité mixte » s'applique là-bas).
                  </p>
                ) : (
                  <button
                    onClick={() => onConfirmerCorrespondance(candidat)}
                    className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90"
                  >
                    Confirmer la correspondance avec ce contrat
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => setTraiterCommeNouveau(true)} className="px-4 py-2 rounded-lg border border-line text-muted text-sm hover:text-ink transition-colors">
            Aucun de ceux-ci — nouveau contrat séparé
          </button>
        </div>
      )}

      {!traitee && !formulaireOuvert && !aDesCorrespondances && proposition.cible === "contrat" && diagnosticAbsence && (
        <p className="text-xs text-muted leading-relaxed rounded-lg px-3 py-2.5 bg-surface-2">{texteDiagnosticAbsence(diagnosticAbsence)}</p>
      )}

      {/* 07/08/2026 : ce que cette proposition remplacerait, avant tout clic — jamais un écrasement
          en un clic aveugle (cf. statutSelonEcrasement, lib/routageExtraction.ts). Même principe que
          le tableau de comparaison de contrat ci-dessus, appliqué à profil_ouverture_droits/profil_infos. */}
      {!traitee && !formulaireOuvert && statut === "confirmation_ecrasement" && champsEcrases && (
        <div className="space-y-2">
          <p className="text-sm text-amber">Ce document remplacerait des valeurs déjà enregistrées :</p>
          <TableauComparaison comparaisons={champsEcrases} labels={labels} />
        </div>
      )}

      {!traitee && !formulaireOuvert && !aDesCorrespondances && (
        <div className="flex items-center gap-2 flex-wrap">
          {statut === "applicable" && (
            <button onClick={onAppliquer} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90">
              Enregistrer dans mon profil
            </button>
          )}
          {statut === "confirmation_ecrasement" && (
            <button onClick={onAppliquer} className="bg-amber text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90">
              Remplacer par les valeurs du document
            </button>
          )}
          {statut === "revue_formulaire" && !estDoublonContratNonConfirme && (
            <button onClick={onOuvrirFormulaire} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90">
              Vérifier et enregistrer
            </button>
          )}
          {statut === "revue_formulaire" && estDoublonContratNonConfirme && (
            <button
              onClick={() => setDoublonContratConfirme(true)}
              className="px-4 py-2 rounded-lg border border-amber/40 text-amber text-sm hover:bg-amber/10 transition-colors"
            >
              Créer quand même un nouveau contrat
            </button>
          )}
          <button onClick={onEcarter} className="px-4 py-2 rounded-lg border border-line text-muted text-sm hover:text-ink transition-colors">
            {statut === "applicable" || statut === "revue_formulaire" || statut === "confirmation_ecrasement" ? (statut === "confirmation_ecrasement" ? "Garder mes valeurs actuelles" : "Ignorer") : "J'ai noté"}
          </button>
        </div>
      )}

      {etat === "applique" && proposition.cible !== "contrat" && (
        <p className="text-xs text-faint">Modifiable à tout moment dans « Mon profil ».</p>
      )}

      {formulaireOuvert && proposition.cible === "contrat" && (
        <div className="pt-2">
          <ContractForm
            profil={profil}
            config={config}
            decompteActuel={decompteActuel}
            valeurInitiale={contratDepuisProposition(proposition.donnees)}
            onValider={onEnregistrerContrat}
            onAnnuler={onFermerFormulaire}
          />
        </div>
      )}

      {formulaireOuvert && proposition.cible === "periode_assimilee" && (
        <div className="pt-2">
          <PeriodeForm valeurInitiale={periodeDepuisProposition(proposition.donnees)} onValider={onEnregistrerPeriode} onAnnuler={onFermerFormulaire} />
        </div>
      )}
    </section>
  );
}
