import { useMemo, useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil, Territoire, TypeContrat, TypeRemuneration } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { heuresBrutesContrat } from "../engine/decompteHeures";
import { champAEffacerEnModeExclusif, detecterActiviteMixteInitiale } from "../lib/activiteMixteFormulaire";
import { MESSAGE_CONTRAT_DEUX_MOIS, contratSurPlusieursMois } from "../lib/contratUnSeulMois";
import { MESSAGE_EEE_SANS_JOURS, contratEEESansJours } from "../lib/contratTerritoireEEE";
import { ContractFormRecurrent } from "./ContractFormRecurrent";

interface ContractFormProps {
  profil: Profil;
  config: FranceTravailConfig;
  /** Décompte déjà atteint sur la fenêtre en cours, AVANT ce contrat — sert uniquement à l'aperçu temps réel des plafonds. */
  decompteActuel: DecompteHeuresResultat;
  valeurInitiale?: Partial<Contrat>;
  onValider: (contrat: Omit<Contrat, "id">) => void;
  /** Absent dans les contextes où un contrat récurrent n'a pas de sens (relecture d'un import PDF déjà extrait, simulation temporaire non persistée) : le CTA associé ne s'affiche alors pas. */
  onValiderRecurrent?: (contrats: Contrat[]) => void;
  onAnnuler?: () => void;
  /** Simulateur.tsx uniquement : le contrat n'est jamais persisté ("et si"), donc l'indice "ce contrat sera affiché comme à venir" serait faux — masqué dans ce contexte. */
  previsualisationSeulement?: boolean;
}

const TYPES_CONTRAT: { id: TypeContrat; label: string }[] = [
  { id: "artiste", label: "Artiste" },
  { id: "enseignement", label: "Enseignement" },
  { id: "formation", label: "Formation" },
  { id: "ptp", label: "PTP" },
];

export function ContractForm({ profil, config, decompteActuel, valeurInitiale, onValider, onValiderRecurrent, onAnnuler, previsualisationSeulement }: ContractFormProps) {
  const [formRecurrentOuvert, setFormRecurrentOuvert] = useState(false);
  const [type, setType] = useState<TypeContrat>(valeurInitiale?.type ?? "artiste");
  const [territoire, setTerritoire] = useState<Territoire>(valeurInitiale?.territoire ?? "france");
  const [dateDebut, setDateDebut] = useState(valeurInitiale?.dateDebut ?? valeurInitiale?.date ?? "");
  const [date, setDate] = useState(valeurInitiale?.date ?? "");
  const [employeur, setEmployeur] = useState(valeurInitiale?.employeur ?? "");
  const [salaireBrut, setSalaireBrut] = useState(valeurInitiale?.salaireBrut?.toString() ?? "");
  const [nbCachets, setNbCachets] = useState(valeurInitiale?.nbCachets?.toString() ?? "");
  const [nbHeures, setNbHeures] = useState(valeurInitiale?.nbHeures?.toString() ?? "");
  // cf. lib/activiteMixteFormulaire.ts pour le détail du garde-fou (bug réel du 01/08/2026).
  const [activiteMixte, setActiviteMixte] = useState(detecterActiviteMixteInitiale(valeurInitiale?.nbHeures, valeurInitiale?.nbCachets));
  const [nbJoursEEE, setNbJoursEEE] = useState(valeurInitiale?.nbJoursEEE?.toString() ?? "");
  const [etablissementAgree, setEtablissementAgree] = useState(valeurInitiale?.etablissementAgree ?? false);
  const [enRapportAvecMetier, setEnRapportAvecMetier] = useState(valeurInitiale?.enRapportAvecMetier ?? false);

  // Un contrat peut porter seulement des cachets, seulement des heures, ou les deux à la fois (ex.
  // heures de répétition ET cachets de représentation sur la même AEM) — confirmé sur pièce réelle
  // le 01/08/2026, et le moteur (engine/decompteHeures.ts) compte désormais les deux ensemble quand
  // les deux sont renseignés. `typeRemuneration` reste un champ requis par le schéma (sert encore à
  // l'attribution d'affichage cachets/heuresScene quand les deux sont présents sur un contrat
  // "artiste"), mais ce n'est PLUS un choix que l'utilisateur doit faire explicitement : il se
  // déduit de ce qui est effectivement rempli, jamais l'inverse.
  const typeRemuneration: TypeRemuneration = nbHeures && !nbCachets ? "heures" : "cachet";

  // Pré-rempli à la même date que `date` (contrat d'un seul jour, cas le plus courant) tant que
  // l'utilisateur n'a pas explicitement modifié `dateDebut` — cf. changerDateFin ci-dessous.
  const dateFinEffective = date || new Date().toISOString().slice(0, 10);
  const dateDebutInvalide = Boolean(dateDebut) && dateDebut > dateFinEffective;
  // Un contrat ne couvre jamais deux mois civils (cf. lib/contratUnSeulMois.ts) : on bloque ici pour
  // EXPLIQUER avant de refuser, mais la règle est réellement tenue par le garde d'App.tsx — ce
  // formulaire n'est qu'une des portes d'écriture (import de bulletin, revue IA, édition en liste).
  const contratADeuxMois = contratSurPlusieursMois({ dateDebut: dateDebut || dateFinEffective, date: dateFinEffective });

  function changerDateFin(nouvelleDate: string) {
    if (dateDebut === date || dateDebut === "") {
      setDateDebut(nouvelleDate);
    }
    setDate(nouvelleDate);
  }

  function changerNbCachets(valeur: string) {
    setNbCachets(valeur);
    if (champAEffacerEnModeExclusif("nbCachets", valeur, activiteMixte) === "nbHeures") setNbHeures("");
  }
  function changerNbHeures(valeur: string) {
    setNbHeures(valeur);
    if (champAEffacerEnModeExclusif("nbHeures", valeur, activiteMixte) === "nbCachets") setNbCachets("");
  }

  // Un contrat ne porte que les champs de SON territoire (cf. lib/contratTerritoireEEE.ts, point 17) :
  // en EEE le décompte ne lit que `nbJoursEEE` et ignore cachets et heures, en France c'est l'inverse.
  // Les états de saisie, eux, sont conservés intacts : basculer le territoire par erreur puis revenir
  // ne perd rien de ce qui a été tapé — c'est le contrat ENREGISTRÉ qui est nettoyé, pas le formulaire.
  // Quand des valeurs sont ainsi écartées, `avertissementEEE` ci-dessous le dit avant l'enregistrement :
  // jamais une donnée abandonnée en silence (devoir n°1).
  const estEEE = territoire === "eee_suisse_uk";
  const brouillon: Contrat = {
    id: "brouillon",
    dateDebut: dateDebut || dateFinEffective,
    date: dateFinEffective,
    type,
    typeRemuneration,
    territoire,
    nbCachets: !estEEE && nbCachets ? parseFloat(nbCachets) : undefined,
    nbHeures: !estEEE && nbHeures ? parseFloat(nbHeures) : undefined,
    nbJoursEEE: estEEE && nbJoursEEE ? parseFloat(nbJoursEEE) : undefined,
    salaireBrut: parseFloat(salaireBrut) || 0,
    employeur,
    etablissementAgree,
    enRapportAvecMetier,
  };

  const apercu = useMemo(() => heuresBrutesContrat(brouillon, config), [brouillon, config]);

  const alerteEnseignement = useMemo(() => {
    if (type !== "enseignement") return null;
    if (!etablissementAgree || !enRapportAvecMetier) {
      return { niveau: "attention" as const, texte: "Sans établissement agréé ET lien avec le métier, ces heures ne comptent pas du tout." };
    }
    const cumulApres = decompteActuel.repartition.enseignementRetenu + apercu.heures;
    if (cumulApres > decompteActuel.plafondEnseignementApplicable) {
      const excedent = cumulApres - decompteActuel.plafondEnseignementApplicable;
      return {
        niveau: "attention" as const,
        texte: `${Math.round(excedent)} h dépasseront le plafond de ${decompteActuel.plafondEnseignementApplicable} h : elles ne compteront pas.`,
      };
    }
    return { niveau: "info" as const, texte: `${Math.round(cumulApres)} h / ${decompteActuel.plafondEnseignementApplicable} h de plafond enseignement.` };
  }, [type, etablissementAgree, enRapportAvecMetier, apercu, decompteActuel]);

  const alerteCumul = useMemo(() => {
    const cumulEnseignementFormation = decompteActuel.repartition.enseignementRetenu + decompteActuel.repartition.formationRetenue + (type === "formation" ? apercu.heures : 0);
    const plafond = config.enseignement.plafondCumulEnseignementFormation;
    if (type === "formation" && cumulEnseignementFormation > plafond) {
      return `${Math.round(cumulEnseignementFormation - plafond)} h dépasseront le cumul enseignement + formation (plafond ${plafond} h).`;
    }
    return null;
  }, [type, apercu, decompteActuel, config]);

  // Point 17 : un contrat EEE sans jours travaillés ne compterait AUCUNE heure. On bloque à la saisie
  // pour expliquer avant de refuser — le vrai rempart reste le garde d'App.tsx, qui couvre aussi
  // l'import de bulletin et la revue IA (cf. lib/contratTerritoireEEE.ts).
  // Le prédicat de la règle est appelé tel quel, sur le brouillon : le formulaire ne réimplémente pas
  // la condition, sinon les deux divergent. ⚠️ Piège vérifié le 04/08/2026 : tester `!nbJoursEEE` sur
  // l'état de saisie laisserait passer un « 0 » — c'est une chaîne non vide, donc truthy — que le garde
  // d'App.tsx refuserait ensuite. Le formulaire dirait oui, l'écriture dirait non.
  const eeeSansJours = contratEEESansJours(brouillon);
  // Cas de l'ÉDITION d'un contrat EEE hérité qui porte des cachets ou des heures : les champs
  // correspondants ne sont pas affichés en territoire EEE, donc sans ce message l'utilisateur ne
  // saurait pas que des valeurs enregistrées vont disparaître de son contrat. Comparé à zéro APRÈS
  // conversion, pour ne pas avertir à propos de « 0 cachet » — un avertissement sans objet est un
  // faux avertissement (devoir n°2).
  const remunerationEcarteeParEEE = estEEE && ((parseFloat(nbCachets) || 0) > 0 || (parseFloat(nbHeures) || 0) > 0);
  const avertissementEEE = remunerationEcarteeParEEE ? "Les cachets et heures saisis ne comptent pas en territoire EEE : ils ne seront pas enregistrés sur ce contrat." : null;

  const alerteCachets = useMemo(() => {
    // nbCachets renseigné, pas typeRemuneration === "cachet" : un contrat mixte (heures ET cachets)
    // doit aussi être compté pour ce plafond, même si son mode principal affiché est "heures".
    if (!nbCachets || territoire === "eee_suisse_uk" || !date) return null;
    const mois = date.slice(0, 7);
    const dejaCeMois = Object.entries(decompteActuel.cachetsParMois).find(([cle]) => cle === mois)?.[1] ?? 0;
    const total = dejaCeMois + (parseFloat(nbCachets) || 0);
    if (total > config.plafondCachetsParMois) {
      return `${total} cachets ce mois-ci : au-delà du plafond de ${config.plafondCachetsParMois}/mois.`;
    }
    return null;
  }, [territoire, date, nbCachets, decompteActuel, config]);

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (dateDebutInvalide || contratADeuxMois || eeeSansJours) return;
    onValider({
      dateDebut: dateDebut || brouillon.date,
      date: brouillon.date,
      type,
      typeRemuneration,
      territoire,
      nbCachets: brouillon.nbCachets,
      nbHeures: brouillon.nbHeures,
      nbJoursEEE: brouillon.nbJoursEEE,
      salaireBrut: brouillon.salaireBrut,
      employeur,
      etablissementAgree: type === "enseignement" ? etablissementAgree : undefined,
      enRapportAvecMetier: type === "enseignement" ? enRapportAvecMetier : undefined,
      source: valeurInitiale?.source ?? "manuel",
    });
  }

  // Le contrat récurrent (lib/contratRecurrent.ts) a son propre <form> : on ne peut pas l'imbriquer
  // dans celui ci-dessous (HTML invalide, soumission imprévisible). On bascule donc entre deux
  // rendus complets plutôt que d'ouvrir ContractFormRecurrent en accordéon au milieu du formulaire.
  if (formRecurrentOuvert) {
    return (
      <ContractFormRecurrent
        onValider={(contrats) => {
          onValiderRecurrent?.(contrats);
          setFormRecurrentOuvert(false);
        }}
        onAnnuler={() => setFormRecurrentOuvert(false)}
      />
    );
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-line rounded-card p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {TYPES_CONTRAT.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setType(t.id)}
            title={t.id === "ptp" ? "Projet de Transition Professionnelle — 1 h de PTP compte comme 1 h Annexe 10 pour les 507 h." : undefined}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${type === t.id ? "border-mint bg-mint/10 text-ink" : "border-line bg-surface-2 text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "ptp" && (
        <p className="text-xs text-faint">Projet de Transition Professionnelle — 1 h de PTP compte comme 1 h Annexe 10 pour les 507 h.</p>
      )}

      {type === "enseignement" && onValiderRecurrent && (
        <div className="rounded-lg bg-teal/10 px-4 py-3 space-y-2">
          <p className="text-sm text-ink font-medium">Cours régulier sur l'année scolaire ?</p>
          <p className="text-xs text-teal">Même employeur, mêmes heures chaque mois : génère tous les contrats en une fois plutôt que de les saisir un par un.</p>
          <button type="button" onClick={() => setFormRecurrentOuvert(true)} className="text-sm bg-mint text-bg font-medium rounded-lg px-4 py-2">
            Contrat récurrent →
          </button>
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="employeur">
          Employeur
        </label>
        <input id="employeur" value={employeur} onChange={(e) => setEmployeur(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="date-debut">
            Date de début
          </label>
          <input id="date-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="date-fin">
            Date de fin
          </label>
          <input id="date-fin" type="date" value={date} onChange={(e) => changerDateFin(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          {!previsualisationSeulement && date && date > new Date().toISOString().slice(0, 10) && (
            <p className="text-xs text-muted mt-1">Ce contrat sera affiché comme « à venir · confirmé » dans ton graphique. S'il est annulé, supprime-le.</p>
          )}
        </div>
      </div>
      {dateDebutInvalide && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">La date de début doit être avant ou égale à la date de fin.</p>}
      {contratADeuxMois && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{MESSAGE_CONTRAT_DEUX_MOIS}</p>}

      <div>
        <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Territoire</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTerritoire("france")} className={`rounded-lg border px-3 py-2 text-sm ${territoire === "france" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}>
            France
          </button>
          <button
            type="button"
            onClick={() => setTerritoire("eee_suisse_uk")}
            className={`rounded-lg border px-3 py-2 text-sm ${territoire === "eee_suisse_uk" ? "border-mint bg-mint/10" : "border-line bg-surface-2"}`}
          >
            EEE / Suisse / UK
          </button>
        </div>
      </div>

      {territoire === "eee_suisse_uk" ? (
        <div>
          <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="jours-eee">
            Nombre de jours travaillés
          </label>
          <input id="jours-eee" type="number" min="0" step="0.5" value={nbJoursEEE} onChange={(e) => setNbJoursEEE(e.target.value)} className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
          <p className="text-xs text-faint mt-1">{config.heuresParJourEEE} h retenues par jour.</p>
          {eeeSansJours && <p className="text-xs rounded-lg px-3 py-2 mt-2 bg-amber/10 text-amber">{MESSAGE_EEE_SANS_JOURS}</p>}
          {avertissementEEE && <p className="text-xs rounded-lg px-3 py-2 mt-2 bg-amber/10 text-amber">{avertissementEEE}</p>}
        </div>
      ) : (
        <div>
          <span className="block text-xs uppercase tracking-[.03em] text-muted mb-1">Rémunération</span>
          <p className="text-xs text-faint mb-2">
            Renseigne cachets ou heures. Coche « Activité mixte » seulement si ce contrat porte réellement les deux à la fois (ex. heures de répétition et cachets de représentation sur la même
            attestation) — sinon, remplir un champ vide automatiquement l'autre.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="nb-cachets">
                Nombre de cachets
              </label>
              <input
                id="nb-cachets"
                type="number"
                min="0"
                step="1"
                placeholder="Si applicable"
                value={nbCachets}
                onChange={(e) => changerNbCachets(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="nb-heures">
                Nombre d'heures
              </label>
              <input
                id="nb-heures"
                type="number"
                min="0"
                step="0.5"
                placeholder="Si applicable"
                value={nbHeures}
                onChange={(e) => changerNbHeures(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted mt-2">
            <input type="checkbox" checked={activiteMixte} onChange={(e) => setActiviteMixte(e.target.checked)} />
            Activité mixte (cachets ET heures réellement indépendants)
          </label>
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor="salaire-brut">
          Salaire brut (€)
        </label>
        <input id="salaire-brut" type="number" min="0" step="0.01" value={salaireBrut} onChange={(e) => setSalaireBrut(e.target.value)} required className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2" />
      </div>

      {type === "enseignement" && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={etablissementAgree} onChange={(e) => setEtablissementAgree(e.target.checked)} />
            Établissement agréé
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={enRapportAvecMetier} onChange={(e) => setEnRapportAvecMetier(e.target.checked)} />
            En rapport avec le métier
          </label>
        </div>
      )}

      {alerteEnseignement && (
        <p className={`text-xs rounded-lg px-3 py-2 ${alerteEnseignement.niveau === "attention" ? "bg-amber/10 text-amber" : "bg-teal/10 text-teal"}`}>{alerteEnseignement.texte}</p>
      )}
      {alerteCumul && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{alerteCumul}</p>}
      {alerteCachets && <p className="text-xs rounded-lg px-3 py-2 bg-amber/10 text-amber">{alerteCachets}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={dateDebutInvalide || contratADeuxMois || eeeSansJours} className="flex-1 bg-mint text-bg font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
          Enregistrer le contrat
        </button>
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} className="px-4 rounded-lg border border-line text-muted">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
