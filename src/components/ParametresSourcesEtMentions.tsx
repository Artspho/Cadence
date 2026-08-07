/**
 * Onglet « Paramètres, Sources & Mentions » (refonte UI, 07/08/2026) — centralise ce qui était
 * dispersé : le périmètre/limites du MVP (jusqu'ici en pleine page dans « Mon profil »), les sources
 * réglementaires (jusqu'ici seulement citées en une ligne dans le bandeau « Règles vérifiées »), et
 * les mentions légales (jusqu'ici une modale isolée, conservée telle quelle ailleurs pour l'instant).
 *
 * Quatre sous-sections, choisies pour ne rien réinventer : chacune réutilise une source de vérité
 * déjà existante (`content/perimetreEtLimites.ts`, `franceTravailConfig.meta`,
 * `content/mentionsLegales.ts`) — ce composant n'affiche que du texte déjà écrit ailleurs et déjà
 * vérifié, il ne calcule ni ne décide rien.
 *
 * Desktop : onglets internes horizontaux (même grammaire que la nav principale de `TopBar.tsx`).
 * Mobile : accordéon vertical (`<details>`, même pattern que `ChecklistDocuments.tsx`) — des tabs
 * étroits sur petit écran seraient illisibles pour des libellés de cette longueur.
 */

import { useState } from "react";
import { franceTravailConfig } from "../config/franceTravailConfig";
import { formaterDateLisible } from "../lib/dateLisible";
import { CONTACT_LEGAL, MENTIONS_LEGALES, POLITIQUE_CONFIDENTIALITE, type SectionLegale } from "../content/mentionsLegales";
import { LIMITES_STRUCTURELLES, PERIMETRE_MVP } from "../content/perimetreEtLimites";

interface Onglet {
  id: string;
  titre: string;
  contenu: React.ReactNode;
}

function SectionLegaleAffichee({ section }: { section: SectionLegale }) {
  return (
    <div>
      <h4 className="font-display text-sm font-medium tracking-tight mb-1.5">{section.titre}</h4>
      <div className="space-y-1.5">
        {section.paragraphes.map((paragraphe, i) => (
          <p key={i} className="text-sm text-muted leading-relaxed">
            {paragraphe}
          </p>
        ))}
      </div>
    </div>
  );
}

function ContenuPerimetre() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-base font-medium tracking-tight mb-2">Périmètre du MVP</h3>
        <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
          {PERIMETRE_MVP.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-display text-base font-medium tracking-tight mb-2">Limites structurelles à garder en tête</h3>
        <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
          {LIMITES_STRUCTURELLES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** La valeur la plus récente d'un historique daté — affichage seulement, ne participe à aucun calcul. */
function plusRecent(historique: { dateEffet: string; valeur: number }[]): { dateEffet: string; valeur: number } {
  return [...historique].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet))[0];
}

function LigneParametre({ titre, valeur, detail }: { titre: string; valeur: string; detail?: React.ReactNode }) {
  const rienADeplier = !detail;
  const entete = (
    <span className="flex items-center justify-between gap-3 flex-wrap w-full">
      <span className="text-ink">{titre}</span>
      <span className="text-xs text-muted whitespace-nowrap">{valeur}</span>
    </span>
  );
  if (rienADeplier) return <div className="px-4 py-3 text-sm border-b border-line last:border-b-0">{entete}</div>;
  return (
    <details className="border-b border-line last:border-b-0 group">
      <summary className="px-4 py-3 text-sm cursor-pointer list-none flex items-start gap-2 hover:bg-surface-2/50 transition-colors">
        <span className="text-faint text-xs mt-1 group-open:rotate-90 transition-transform" aria-hidden>
          ▸
        </span>
        {entete}
      </summary>
      <div className="px-4 pb-4 pl-9 text-xs text-faint leading-relaxed">{detail}</div>
    </details>
  );
}

function HistoriqueDetail({ historique, unite }: { historique: { dateEffet: string; valeur: number }[]; unite: string }) {
  const tries = [...historique].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  return (
    <ul className="space-y-1">
      {tries.map((entree) => (
        <li key={entree.dateEffet}>
          {entree.valeur}
          {unite} — en vigueur depuis le {formaterDateLisible(entree.dateEffet)}
        </li>
      ))}
    </ul>
  );
}

function ContenuSources() {
  const { meta, are, valeursDatees } = franceTravailConfig;
  const smic = plusRecent(valeursDatees.smicHoraireBrutHistorique);
  const plafond = plusRecent(are.plafondHistorique);

  return (
    <div className="space-y-4">
      <div className="bg-surface-2 border border-line rounded-lg px-4 py-3">
        <p className="text-xs uppercase tracking-[.03em] text-muted mb-1">Édition en vigueur</p>
        <p className="text-sm text-ink leading-relaxed">{meta.source}</p>
        <p className="text-xs text-faint mt-2">Vérifiée sur pièce le {formaterDateLisible(meta.dateDerniereVerification)}.</p>
        <p className="text-xs text-faint mt-1">{meta.avertissement}</p>
      </div>
      <div className="border border-line rounded-card overflow-hidden">
        <LigneParametre
          titre="SMIC horaire brut"
          valeur={`${smic.valeur} €`}
          detail={<HistoriqueDetail historique={valeursDatees.smicHoraireBrutHistorique} unite=" €" />}
        />
        <LigneParametre
          titre="Plafond ARE (Annexe 10)"
          valeur={`${plafond.valeur} €/jour`}
          detail={<HistoriqueDetail historique={are.plafondHistorique} unite=" €/jour" />}
        />
        <LigneParametre titre="Allocation journalière minimale" valeur={`${are.ajMinimale} €`} />
        <LigneParametre titre="Plancher Annexe 10" valeur={`${are.plancherAnnexe10} €`} />
        {valeursDatees.pmssMensuel !== null && (
          <LigneParametre
            titre="PMSS mensuel"
            valeur={`${valeursDatees.pmssMensuel} €`}
            detail="Valeur courante uniquement, non historisée — non encore lue par le moteur (plafond de cumul à 118 % du PMSS, module non construit)."
          />
        )}
      </div>
    </div>
  );
}

function ContenuMentionsLegales() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[.03em] text-faint">Mentions légales</p>
        {MENTIONS_LEGALES.map((section) => (
          <SectionLegaleAffichee key={section.titre} section={section} />
        ))}
      </div>
      <div className="border-t border-line pt-4 space-y-4">
        <p className="text-xs uppercase tracking-[.03em] text-faint">Politique de confidentialité</p>
        {POLITIQUE_CONFIDENTIALITE.map((section) => (
          <SectionLegaleAffichee key={section.titre} section={section} />
        ))}
      </div>
    </div>
  );
}

function ContenuContact() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted leading-relaxed">Une question ou un avis sur Cadence ?</p>
      <a href={`mailto:${CONTACT_LEGAL}`} className="inline-block text-sm text-mint hover:underline">
        Écris à {CONTACT_LEGAL} →
      </a>
    </div>
  );
}

const ONGLETS: Onglet[] = [
  { id: "perimetre", titre: "Périmètre & Limites", contenu: <ContenuPerimetre /> },
  { id: "sources", titre: "Sources réglementaires", contenu: <ContenuSources /> },
  { id: "mentions", titre: "Mentions légales & Confidentialité", contenu: <ContenuMentionsLegales /> },
  { id: "contact", titre: "Support & Contact", contenu: <ContenuContact /> },
];

export function ParametresSourcesEtMentions() {
  const [actif, setActif] = useState(0);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-medium">Paramètres, sources &amp; mentions</h2>

      {/* Desktop : tabs horizontaux, un seul panneau affiché à la fois. */}
      <div className="hidden sm:block space-y-4">
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-line" aria-label="Sections des paramètres">
          {ONGLETS.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setActif(i)}
              aria-current={actif === i ? "page" : undefined}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                actif === i ? "border-mint text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {o.titre}
            </button>
          ))}
        </nav>
        <div className="bg-surface border border-line rounded-card p-5">{ONGLETS[actif].contenu}</div>
      </div>

      {/* Mobile : accordéon, toutes les sections listées et repliées (même pattern que ChecklistDocuments.tsx). */}
      <div className="sm:hidden space-y-3">
        {ONGLETS.map((o) => (
          <details key={o.id} className="bg-surface border border-line rounded-card overflow-hidden group">
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer list-none flex items-center gap-2 hover:bg-surface-2/50 transition-colors">
              <span className="text-faint text-xs group-open:rotate-90 transition-transform" aria-hidden>
                ▸
              </span>
              {o.titre}
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-line">{o.contenu}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
