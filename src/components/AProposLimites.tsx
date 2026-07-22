import { estPerime, franceTravailConfig, joursDepuisMiseAJourConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { regimeEffectif } from "../lib/profilHorsPerimetre";
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
  const regime = regimeEffectif(profil);

  return (
    <div className="space-y-6 max-w-[720px]">
      <section>
        <h2 className="font-display text-lg font-medium mb-2">Ton profil</h2>
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
