import { estPerime, franceTravailConfig, joursDepuisMiseAJourConfig } from "../config/franceTravailConfig";
import type { Profil } from "../types";

interface AProposLimitesProps {
  dateDuJour: string;
  profil: Profil;
  onModifierProfil: (profil: Profil) => void;
}

export function AProposLimites({ dateDuJour, profil, onModifierProfil }: AProposLimitesProps) {
  const jours = joursDepuisMiseAJourConfig(new Date(dateDuJour));
  // estPerime compare franceTravailConfig.meta.valableJusquau (un fait déclaré, jamais un
  // seuil de durée deviné) à dateDuJour — même fonction que TopBar.tsx, une seule source de
  // vérité pour la péremption, plus jamais deux logiques qui divergent.
  const perime = estPerime(new Date(dateDuJour), franceTravailConfig.meta.valableJusquau);

  return (
    <div className="space-y-6 max-w-[720px]">
      <section>
        <h2 className="font-display text-lg font-medium mb-2">Ton profil</h2>
        <div className="bg-surface border border-line rounded-card p-5">
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(profil.activiteHorsAnnexe10)}
              onChange={(e) => onModifierProfil({ ...profil, activiteHorsAnnexe10: e.target.checked })}
            />
            <span>
              Cette année, as-tu été payé pour autre chose que des concerts / prestations d'artiste&nbsp;? Par exemple du travail technique sur un spectacle
              (son, lumière, régie…), ou un emploi salarié classique hors spectacle.
            </span>
          </label>
          {profil.activiteHorsAnnexe10 && (
            <p className="text-xs text-amber mt-2">Tant que c'est coché, le tableau de bord, l'historique et le simulateur n'affichent aucune estimation.</p>
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

      <a href="mailto:?subject=Retour%20sur%20Cadence" className="inline-block text-sm text-mint hover:underline">
        Donner mon avis sur Cadence →
      </a>
    </div>
  );
}
