import { useState } from "react";
import type { Contrat, DecompteHeuresResultat, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { heuresBrutesContrat } from "../engine/decompteHeures";
import { ContractForm } from "./ContractForm";

interface ContractListProps {
  profil: Profil;
  contrats: Contrat[];
  config: FranceTravailConfig;
  decompteActuel: DecompteHeuresResultat;
  onSupprimer: (id: string) => void;
  onSupprimerSerie: (recurrenceId: string) => void;
  /** Remplace TOUS les champs métier du contrat désigné — jamais statutVerification, qui reste à
   * la charge de l'appelant (cf. wrapper ci-dessous : l'édition libre le préserve tel quel). */
  onModifierContrat: (id: string, contrat: Omit<Contrat, "id">) => void;
  /**
   * État d'édition remonté dans App.tsx (pas un `useState` local) : le formulaire "Nouveau contrat"
   * toujours affiché au-dessus de cette liste doit disparaître pendant une édition, sinon les deux
   * `ContractForm` coexistent avec les MÊMES `id` de champs (`#salaire-brut`, etc.) — un vrai bug
   * trouvé en vérifiant dans le navigateur (`<label htmlFor>` associerait un clic au mauvais
   * formulaire), pas juste une gêne visuelle d'avoir deux formulaires ouverts à la fois.
   */
  contratEnEdition: Contrat | null;
  onChangerContratEnEdition: (contrat: Contrat | null) => void;
}

const COULEURS_TYPE: Record<Contrat["type"], string> = {
  artiste: "bg-mint/15 text-mint",
  enseignement: "bg-violet/15 text-violet",
  formation: "bg-violet/15 text-violet",
  ptp: "bg-teal/15 text-teal",
};

const LABELS_TYPE: Record<Contrat["type"], string> = {
  artiste: "Artiste",
  enseignement: "Enseignement",
  formation: "Formation",
  ptp: "PTP",
};

type Entree = { kind: "seul"; contrat: Contrat } | { kind: "serie"; recurrenceId: string; contrats: Contrat[] };

function dateTri(entree: Entree): string {
  return entree.kind === "seul" ? entree.contrat.date : entree.contrats[0].date; // contrats d'une série déjà triés desc
}

function annee(date: string): string {
  return date.slice(0, 4);
}

// Une série récurrente n'est jamais coupée par le filtre : si UN SEUL de ses contrats tombe dans
// l'année choisie, la série entière s'affiche (avec tous ses contrats, cf. le détail dépliable) —
// couper une série en morceaux par année la rendrait illisible sans rien apporter au besoin
// ("naviguer dans l'historique sans tout afficher en une seule liste plate").
function entreeDansAnnee(entree: Entree, anneeChoisie: string): boolean {
  if (anneeChoisie === "toutes") return true;
  if (entree.kind === "seul") return annee(entree.contrat.date) === anneeChoisie;
  return entree.contrats.some((c) => annee(c.date) === anneeChoisie);
}

export function ContractList({
  profil,
  contrats,
  config,
  decompteActuel,
  onSupprimer,
  onSupprimerSerie,
  onModifierContrat,
  contratEnEdition,
  onChangerContratEnEdition,
}: ContractListProps) {
  const [seriesOuvertes, setSeriesOuvertes] = useState<Set<string>>(new Set());
  const anneesDisponibles = [...new Set(contrats.map((c) => annee(c.date)))].sort((a, b) => (a < b ? 1 : -1));
  // Année la plus récente par défaut (l'activité récente est ce qu'on consulte le plus souvent) —
  // calculé une seule fois au montage : un nouveau contrat ajouté ensuite dans une année plus
  // récente ne doit pas faire sauter le filtre sous les pieds de l'utilisateur en cours de saisie.
  const [anneeChoisie, setAnneeChoisie] = useState<string>(() => anneesDisponibles[0] ?? "toutes");

  // Édition libre (01/08/2026) : réutilise ContractForm tel quel (tous champs modifiables), avec un
  // seul soin particulier — statutVerification n'est PAS un champ du formulaire (cf. ContractForm.tsx,
  // `soumettre()` ne le construit jamais) : le préserver explicitement ici est ce qui garantit qu'une
  // édition libre ne le fait jamais glisser de "confirme" vers "a_verifier" ou l'inverse, comme
  // demandé — seule la confirmation de correspondance AEM (RevueExtraction.tsx) le fait changer.
  if (contratEnEdition) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Modifier le contrat — {contratEnEdition.employeur || "Sans nom"}, {contratEnEdition.date}</p>
        <ContractForm
          profil={profil}
          config={config}
          decompteActuel={decompteActuel}
          valeurInitiale={contratEnEdition}
          onValider={(donnees) => {
            onModifierContrat(contratEnEdition.id, { ...donnees, statutVerification: contratEnEdition.statutVerification });
            onChangerContratEnEdition(null);
          }}
          onAnnuler={() => onChangerContratEnEdition(null)}
        />
      </div>
    );
  }

  if (contrats.length === 0) {
    return <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">Aucun contrat enregistré pour l'instant.</p>;
  }

  const groupes = new Map<string, Contrat[]>();
  const isoles: Contrat[] = [];
  for (const c of contrats) {
    if (c.recurrenceId) {
      const arr = groupes.get(c.recurrenceId) ?? [];
      arr.push(c);
      groupes.set(c.recurrenceId, arr);
    } else {
      isoles.push(c);
    }
  }

  const toutesLesEntrees: Entree[] = [
    ...isoles.map((contrat): Entree => ({ kind: "seul", contrat })),
    ...[...groupes.entries()].map(([recurrenceId, cs]): Entree => ({ kind: "serie", recurrenceId, contrats: [...cs].sort((a, b) => (a.date < b.date ? 1 : -1)) })),
  ].sort((a, b) => (dateTri(a) < dateTri(b) ? 1 : -1));

  const entrees = toutesLesEntrees.filter((entree) => entreeDansAnnee(entree, anneeChoisie));

  function basculerSerie(recurrenceId: string) {
    setSeriesOuvertes((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(recurrenceId)) suivant.delete(recurrenceId);
      else suivant.add(recurrenceId);
      return suivant;
    });
  }

  function supprimerSerieAvecConfirmation(recurrenceId: string, employeur: string, nb: number) {
    if (window.confirm(`Supprimer les ${nb} contrats de la série "${employeur}" ? Cette action ne peut pas être annulée depuis l'application (seul un import JSON de sauvegarde le permettrait).`)) {
      onSupprimerSerie(recurrenceId);
    }
  }

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Filtrer les contrats par année">
        {["toutes", ...anneesDisponibles].map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAnneeChoisie(a)}
            aria-current={anneeChoisie === a ? "page" : undefined}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${
              anneeChoisie === a ? "bg-surface-2 text-ink border border-line-strong" : "text-muted hover:text-ink"
            }`}
          >
            {a === "toutes" ? "Toutes" : a}
          </button>
        ))}
      </nav>

      {entrees.length === 0 ? (
        <p className="text-muted text-sm bg-surface border border-line rounded-card p-6 text-center">Aucun contrat pour l'année {anneeChoisie}.</p>
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line overflow-hidden">
          {entrees.map((entree) => {
            if (entree.kind === "seul") {
              const contrat = entree.contrat;
              const { heures } = heuresBrutesContrat(contrat, config);
              return (
                <div key={contrat.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COULEURS_TYPE[contrat.type]}`}>{LABELS_TYPE[contrat.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">
                      {contrat.employeur || "Sans nom"}
                      {/* Pastille informative, pas une alerte : absence du champ (contrats déjà existants
                          avant son ajout) ne veut rien dire et n'affiche donc rien — jamais un statut
                          affirmé sans preuve (devoir n°2). */}
                      {contrat.statutVerification === "a_verifier" && (
                        <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line align-middle">AEM/bulletin en attente</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {contrat.date}
                      {contrat.source === "import_pdf" ? " · importé PDF" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm tabular-nums text-ink">{heures.toFixed(1)} h</p>
                    <p className="text-xs text-muted tabular-nums">{contrat.salaireBrut.toFixed(0)} € brut</p>
                  </div>
                  <button onClick={() => onChangerContratEnEdition(contrat)} aria-label={`Modifier le contrat ${contrat.employeur}`} className="shrink-0 text-faint hover:text-ink transition-colors px-2 text-sm">
                    Modifier
                  </button>
                  <button onClick={() => onSupprimer(contrat.id)} aria-label={`Supprimer le contrat ${contrat.employeur}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
                    ✕
                  </button>
                </div>
              );
            }

            const { recurrenceId, contrats: contratsSerie } = entree;
            const ouverte = seriesOuvertes.has(recurrenceId);
            const employeur = contratsSerie[0].employeur;
            const type = contratsSerie[0].type;
            const premierMois = contratsSerie[contratsSerie.length - 1].date.slice(0, 7);
            const dernierMois = contratsSerie[0].date.slice(0, 7);
            const totalHeures = contratsSerie.reduce((somme, c) => somme + heuresBrutesContrat(c, config).heures, 0);
            const totalSalaire = contratsSerie.reduce((somme, c) => somme + c.salaireBrut, 0);

            return (
              <div key={recurrenceId} className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => basculerSerie(recurrenceId)} aria-expanded={ouverte} aria-label={ouverte ? "Replier la série" : "Déplier la série"} className="shrink-0 text-muted w-4">
                    {ouverte ? "▾" : "▸"}
                  </button>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COULEURS_TYPE[type]}`}>{LABELS_TYPE[type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{employeur || "Sans nom"}</p>
                    <p className="text-xs text-muted">
                      {contratsSerie.length} contrats récurrents · {premierMois} → {dernierMois}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm tabular-nums text-ink">{totalHeures.toFixed(1)} h</p>
                    <p className="text-xs text-muted tabular-nums">{totalSalaire.toFixed(0)} € brut</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimerSerieAvecConfirmation(recurrenceId, employeur, contratsSerie.length)}
                    className="shrink-0 text-xs text-red border border-red/30 rounded-full px-3 py-1 hover:bg-red/10 transition-colors"
                  >
                    Supprimer la série
                  </button>
                </div>
                {ouverte && (
                  <div className="mt-3 ml-7 space-y-1.5 border-t border-line pt-3">
                    {/* Pas de bouton "Modifier" par contrat d'une série (décision du 01/08/2026) :
                        éditer un seul contrat généré en lot casserait silencieusement l'hypothèse
                        "tous générés ensemble, valeurs cohérentes" sans que rien ne le trace nulle
                        part. Seule la suppression + régénération de la série entière est proposée —
                        cohérent avec "Supprimer la série" déjà seule opération de masse existante. */}
                    <p className="text-xs text-faint pb-1">Contrats d'une série récurrente : pour changer une valeur, supprime la série et régénère-la.</p>
                    {contratsSerie.map((contrat) => {
                      const { heures } = heuresBrutesContrat(contrat, config);
                      return (
                        <div key={contrat.id} className="flex items-center gap-3 text-sm">
                          <span className="text-muted flex-1">{contrat.date}</span>
                          <span className="tabular-nums text-ink">{heures.toFixed(1)} h</span>
                          <span className="tabular-nums text-muted w-20 text-right">{contrat.salaireBrut.toFixed(0)} €</span>
                          <button onClick={() => onSupprimer(contrat.id)} aria-label={`Supprimer le contrat du ${contrat.date}`} className="shrink-0 text-faint hover:text-red transition-colors px-2">
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
