/**
 * Checklist de l'espace dépôt : ce que l'utilisateur doit déposer, et ce qui manque encore.
 *
 * Ce composant n'a AUCUNE logique de décision — il rend `lib/documentsRequis.ts`, qui porte la
 * vérité et est testé pour elle. La séparation est volontaire : un badge à l'écran est une
 * affirmation sur les droits de quelqu'un, elle ne doit pas dépendre d'une condition écrite dans du
 * JSX où personne ne la teste.
 *
 * Deux règles d'affichage qui viennent directement des devoirs sacrés :
 *
 * 1. Le vert (menthe) est réservé à « complète », et « complète » n'est atteignable que par la ligne
 *    notification. La ligne bulletins/AEM est affichée en NEUTRE même avec cent contrats — jamais en
 *    vert : l'app ne connaît pas la liste des mois travaillés, et un vert y serait un faux feu vert
 *    sur le compteur des 507 h.
 * 2. Les lignes sans statut calculable (relevé, CPAM, attestation de taux) ne portent pas de badge
 *    d'état mais une étiquette de RÔLE. Leur donner un badge aurait été inventer un statut.
 *
 * Replié par défaut (`<details>` sans `open`) : la vue d'ensemble d'abord, le détail par donnée
 * seulement pour qui le demande. Décision UX de Benoît, 29/07/2026.
 */

import type { Contrat, Profil } from "../types";
import { documentsRequis, type LigneDocument } from "../lib/documentsRequis";

interface ChecklistDocumentsProps {
  profil: Profil | null;
  contrats: Contrat[];
}

interface Etiquette {
  texte: string;
  /** Classes Tailwind du badge. Le vert est réservé au seul « complète » réellement atteignable. */
  classes: string;
}

function etiquetteDe(ligne: LigneDocument): Etiquette {
  const neutre = "bg-surface-2 border-line text-muted";
  const alerte = "bg-amber/10 border-amber/30 text-amber";
  const ok = "bg-mint/10 border-mint/30 text-mint";

  if (ligne.id === "bulletins_aem") {
    // Jamais de vert ici, quel que soit le nombre de contrats : l'exhaustivité est inconnaissable.
    if (ligne.statut === "rien_renseigne") return { texte: "aucun contrat", classes: alerte };
    const n = ligne.nbContrats ?? 0;
    return { texte: `${n} contrat${n > 1 ? "s" : ""} renseigné${n > 1 ? "s" : ""}`, classes: neutre };
  }

  switch (ligne.statut) {
    case "rien_renseigne":
      return { texte: "rien de renseigné", classes: alerte };
    case "incomplet":
      return {
        texte: `incomplète — ${ligne.nbManquesBloquants} information${ligne.nbManquesBloquants > 1 ? "s" : ""} manque${ligne.nbManquesBloquants > 1 ? "nt" : ""}`,
        classes: alerte,
      };
    case "complet":
      return { texte: "complète", classes: ok };
    case "non_evaluable":
      // Étiquette de RÔLE, pas d'état : ces lignes ne portent aucune donnée qui leur soit propre.
      return { texte: ligne.role === "seulement_si_concerne" ? "seulement si tu es concerné" : "en complément", classes: neutre };
  }
}

/** Une ligne dépliable. `open` jamais forcé : tout est replié à l'arrivée. */
function LigneChecklist({ ligne }: { ligne: LigneDocument }) {
  const etiquette = etiquetteDe(ligne);
  const bloquants = ligne.manques.filter((m) => m.poids === "bloquant");
  const precisions = ligne.manques.filter((m) => m.poids === "precision");
  // Rien à déplier : ni manque, ni limite à expliquer. On rend alors une ligne inerte plutôt qu'un
  // chevron qui ouvre sur du vide.
  const rienADeplier = ligne.manques.length === 0 && !ligne.note;

  const entete = (
    <span className="flex items-center justify-between gap-3 flex-wrap w-full">
      <span className="text-ink">{ligne.document}</span>
      <span className={`text-xs rounded-full border px-2.5 py-0.5 whitespace-nowrap ${etiquette.classes}`}>{etiquette.texte}</span>
    </span>
  );

  if (rienADeplier) {
    return <div className="px-4 py-3 text-sm border-b border-line last:border-b-0">{entete}</div>;
  }

  return (
    <details className="border-b border-line last:border-b-0 group">
      <summary className="px-4 py-3 text-sm cursor-pointer list-none flex items-start gap-2 hover:bg-surface-2/50 transition-colors">
        <span className="text-faint text-xs mt-1 group-open:rotate-90 transition-transform" aria-hidden>
          ▸
        </span>
        {entete}
      </summary>

      <div className="px-4 pb-4 pl-9 space-y-3 text-sm">
        {bloquants.length > 0 && (
          <ul className="space-y-2">
            {bloquants.map((m) => (
              <li key={m.libelle}>
                <span className="text-ink">{m.libelle}</span>
                <span className="block text-xs text-muted leading-relaxed mt-0.5">{m.consequence}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Les précisions sont séparées et introduites comme telles : elles n'empêchent rien de
            fonctionner, et les mélanger aux bloquants ferait lire « il manque 5 choses » là où il en
            manque deux qui comptent. */}
        {precisions.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-faint mb-1.5">Facultatif — l'app fonctionne sans, mais moins précisément :</p>
            <ul className="space-y-2">
              {precisions.map((m) => (
                <li key={m.libelle}>
                  <span className="text-muted">{m.libelle}</span>
                  <span className="block text-xs text-faint leading-relaxed mt-0.5">{m.consequence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Limite assumée, affichée telle quelle. Ce n'est pas un manque à combler. */}
        {ligne.note && <p className="text-xs text-muted leading-relaxed bg-surface-2 border border-line rounded-lg px-3 py-2">{ligne.note}</p>}
      </div>
    </details>
  );
}

export function ChecklistDocuments({ profil, contrats }: ChecklistDocumentsProps) {
  const lignes = documentsRequis(profil, contrats);

  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-sm font-medium tracking-tight">Ce qu'il te reste à fournir</h4>
        {/* Dire d'où vient le statut évite le contresens le plus probable : croire que Cadence a gardé
            une trace des fichiers déposés. Elle ne garde que les chiffres — c'est pourquoi une saisie
            manuelle compte autant qu'un import, et pourquoi le mot « fourni » n'est jamais employé. */}
        <p className="text-xs text-faint leading-relaxed mt-1">
          Calculé d'après les informations déjà enregistrées, pas d'après les fichiers déposés — remplir un champ à la main compte donc autant qu'un import. Cadence ne conserve
          aucun document.
        </p>
      </div>
      <div className="border-t border-line">
        {lignes.map((ligne) => (
          <LigneChecklist key={ligne.id} ligne={ligne} />
        ))}
      </div>
    </section>
  );
}
