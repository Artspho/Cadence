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
import { documentsRequis, progressionDocuments, type IdDocument, type LigneDocument } from "../lib/documentsRequis";
import type { TypeDocument } from "../storage/documentsStorage";

interface ChecklistDocumentsProps {
  profil: Profil | null;
  contrats: Contrat[];
  /** Bascule sur l'onglet import avec ce type suggéré. Absent : pas de bouton d'action par ligne. */
  onDemanderImport?: (type: TypeDocument) => void;
}

/**
 * Les deux seules lignes qui portent un vrai manque bloquant importable (cf. `documentsRequis.ts`) :
 * les trois autres (relevé, CPAM, attestation de taux) sont des compléments jamais « manquants » au
 * sens bloquant, donc jamais concernées par ce bouton — pas la peine de les faire figurer ici.
 */
const TYPE_DOCUMENT_PAR_LIGNE: Partial<Record<IdDocument, TypeDocument>> = {
  notification_admission: "notification_are",
  bulletins_aem: "aem_bulletin",
};

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
function LigneChecklist({ ligne, onDemanderImport }: { ligne: LigneDocument; onDemanderImport?: (type: TypeDocument) => void }) {
  const etiquette = etiquetteDe(ligne);
  const bloquants = ligne.manques.filter((m) => m.poids === "bloquant");
  const precisions = ligne.manques.filter((m) => m.poids === "precision");
  // Le bouton n'a de sens que s'il reste un vrai manque bloquant à combler ET que ce document se
  // dépose par le canal import — jamais sur les lignes de complément (relevé, CPAM, attestation de
  // taux), qui n'ont structurellement aucun manque bloquant (cf. TYPE_DOCUMENT_PAR_LIGNE).
  const typeImportable = TYPE_DOCUMENT_PAR_LIGNE[ligne.id];
  const bouton =
    onDemanderImport && typeImportable && ligne.nbManquesBloquants > 0 ? (
      <button
        type="button"
        onClick={(e) => {
          // `entete` est rendu à l'intérieur d'un `<summary>` : sans ceci, le clic ouvrirait/fermerait
          // aussi le détail de la ligne en plus de déclencher l'action.
          e.preventDefault();
          e.stopPropagation();
          onDemanderImport(typeImportable);
        }}
        className="text-xs text-mint hover:text-mint/80 transition-colors whitespace-nowrap underline underline-offset-2"
      >
        Importer ce document
      </button>
    ) : null;
  // Rien à déplier : ni manque, ni limite à expliquer, ni bouton. On rend alors une ligne inerte
  // plutôt qu'un chevron qui ouvre sur du vide.
  const rienADeplier = ligne.manques.length === 0 && !ligne.note && !bouton;

  const entete = (
    <span className="flex items-center justify-between gap-3 flex-wrap w-full">
      <span className="text-ink">{ligne.document}</span>
      <span className="flex items-center gap-2 flex-wrap justify-end">
        {bouton}
        <span className={`text-xs rounded-full border px-2.5 py-0.5 whitespace-nowrap ${etiquette.classes}`}>{etiquette.texte}</span>
      </span>
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

export function ChecklistDocuments({ profil, contrats, onDemanderImport }: ChecklistDocumentsProps) {
  const lignes = documentsRequis(profil, contrats);
  const { combles, total } = progressionDocuments(lignes);

  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-sm font-medium tracking-tight">Ce qu'il te reste à fournir</h4>
        {/* Dire d'où vient le statut évite le contresens le plus probable : croire que ce badge reflète
            les fichiers eux-mêmes. Depuis le commit 4 (phase 6), Cadence PEUT conserver un document
            (connecté, sur ton choix — cf. « Mon dossier ») ; ce statut-ci continue pourtant de ne
            regarder QUE les données déjà enregistrées, jamais la présence d'un fichier stocké — sinon
            il dépendrait d'une connexion et d'un choix distincts de ce qu'il mesure vraiment. */}
        <p className="text-xs text-faint leading-relaxed mt-1">
          Calculé d'après les informations déjà enregistrées, pas d'après les fichiers déposés — remplir un champ à la main compte donc autant qu'un import. Si tu conserves un
          document sur le serveur (une fois connecté), tu le retrouveras dans « Mon dossier » — ce statut-ci ne s'appuie jamais sur ça.
        </p>
        {/* `total` dépend de la situation (première admission vs réadmission) et de ce qui est déjà
            renseigné — jamais un chiffre fixe du genre « X/9 », qui mentirait dès que l'un des deux
            change (cf. `progressionDocuments`). Absent si `total` est nul (ne devrait pas arriver en
            pratique, mais une jauge 0/0 affirmerait une complétude qu'aucune donnée ne soutient). */}
        {total > 0 && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${(combles / total) * 100}%` }} />
            </div>
            <p className="text-xs text-faint mt-1.5">
              {combles}/{total} informations bloquantes renseignées
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-line">
        {lignes.map((ligne) => (
          <LigneChecklist key={ligne.id} ligne={ligne} onDemanderImport={onDemanderImport} />
        ))}
      </div>
    </section>
  );
}
