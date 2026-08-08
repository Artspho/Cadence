/**
 * « Documents à rassembler » — fusion de deux sources qui répondaient chacune à une moitié de la
 * question (08/08/2026, demande de Benoît, depuis l'onglet « Import PDF » renommé « Déposer un
 * document ») :
 *
 *   - `content/documentsUtiles.ts` : la référence STATIQUE, groupée par situation, avec pour chaque
 *     document le POURQUOI en langage clair — c'est elle qui porte la structure et le texte de ce
 *     composant (jugée la plus claire des deux par Benoît).
 *   - `lib/documentsRequis.ts` : le statut DYNAMIQUE calculé depuis les vraies données du profil —
 *     quand une ligne a un statut calculable (notification, bulletins), il remplace le badge
 *     générique « indispensable » par « rien de renseigné / incomplète / complète », plus précis.
 *
 * Remplace `ChecklistDocuments.tsx` (qui vivait ici, dans l'onglet dépôt) et `DocumentsUtiles.tsx`
 * (qui vivait dans « Mon profil ») — les deux étaient une liste de documents à déposer, affichée à
 * deux endroits différents avec deux présentations différentes. Une seule maintenant, un seul endroit.
 */

import type { Contrat, Profil } from "../types";
import { documentsRequis, progressionDocuments, type IdDocument, type LigneDocument } from "../lib/documentsRequis";
import type { TypeDocument } from "../storage/documentsStorage";
import { GROUPES_DOCUMENTS_UTILES, type DocumentUtile } from "../content/documentsUtiles";

/** Les deux seules lignes qui portent un vrai manque bloquant importable (cf. documentsRequis.ts) :
 *  les autres n'ont jamais de bouton, quel que soit leur statut. */
const TYPE_DOCUMENT_PAR_LIGNE: Partial<Record<IdDocument, TypeDocument>> = {
  notification_admission: "notification_are",
  bulletins_aem: "aem_bulletin",
};

const LIBELLE_ROLE: Record<DocumentUtile["role"], string> = {
  indispensable: "indispensable",
  utile: "utile",
  complement: "en complément",
};

const LIBELLE_CANAL: Record<DocumentUtile["canal"], string> = {
  ia_possible: "dépôt IA possible",
  manuel_uniquement: "saisie manuelle",
};

interface Etiquette {
  texte: string;
  classes: string;
}

const NEUTRE = "bg-surface-2 border-line text-muted";
const ALERTE = "bg-amber/10 border-amber/30 text-amber";
const OK = "bg-mint/10 border-mint/30 text-mint";

/** `undefined` sur une ligne `non_evaluable` : pas de statut dynamique à afficher, l'appelant retombe
 *  alors sur les badges statiques (role/canal) de `documentsUtiles.ts`. */
function etiquetteDynamique(ligne: LigneDocument): Etiquette | undefined {
  if (ligne.id === "bulletins_aem") {
    if (ligne.statut === "rien_renseigne") return { texte: "aucun contrat", classes: ALERTE };
    if (ligne.statut === "non_evaluable") {
      const n = ligne.nbContrats ?? 0;
      return { texte: `${n} contrat${n > 1 ? "s" : ""} renseigné${n > 1 ? "s" : ""}`, classes: NEUTRE };
    }
  }
  switch (ligne.statut) {
    case "rien_renseigne":
      return { texte: "rien de renseigné", classes: ALERTE };
    case "incomplet":
      return { texte: `incomplète — ${ligne.nbManquesBloquants} information${ligne.nbManquesBloquants > 1 ? "s" : ""} manque${ligne.nbManquesBloquants > 1 ? "nt" : ""}`, classes: ALERTE };
    case "complet":
      return { texte: "complète", classes: OK };
    case "non_evaluable":
      return undefined;
  }
}

function LigneDocumentARassembler({
  doc,
  ligne,
  onDemanderImport,
}: {
  doc: DocumentUtile;
  ligne?: LigneDocument;
  onDemanderImport?: (type: TypeDocument) => void;
}) {
  const dynamique = ligne ? etiquetteDynamique(ligne) : undefined;
  const badges: Etiquette[] = dynamique
    ? [dynamique]
    : [
        { texte: LIBELLE_ROLE[doc.role], classes: NEUTRE },
        { texte: LIBELLE_CANAL[doc.canal], classes: NEUTRE },
      ];

  const typeImportable = TYPE_DOCUMENT_PAR_LIGNE[doc.id as IdDocument];
  const bouton =
    onDemanderImport && typeImportable && ligne && ligne.nbManquesBloquants > 0 ? (
      <button
        type="button"
        onClick={(e) => {
          // `entete` est rendu dans un `<summary>` : sans ceci, le clic ouvrirait/fermerait aussi le
          // détail de la ligne en plus de déclencher l'action.
          e.preventDefault();
          e.stopPropagation();
          onDemanderImport(typeImportable);
        }}
        className="text-xs text-mint hover:text-mint/80 transition-colors whitespace-nowrap underline underline-offset-2"
      >
        Importer ce document
      </button>
    ) : null;

  const manquesBloquants = ligne?.manques.filter((m) => m.poids === "bloquant") ?? [];
  const manquesPrecisions = ligne?.manques.filter((m) => m.poids === "precision") ?? [];

  return (
    <details className="border-b border-line last:border-b-0 group">
      <summary className="px-4 py-3 text-sm cursor-pointer list-none flex items-start gap-2 hover:bg-surface-2/50 transition-colors">
        <span className="text-faint text-xs mt-1 group-open:rotate-90 transition-transform" aria-hidden>
          ▸
        </span>
        <span className="flex items-center justify-between gap-3 flex-wrap w-full">
          <span className="text-ink">{doc.nom}</span>
          <span className="flex items-center gap-2 flex-wrap justify-end">
            {bouton}
            {badges.map((b) => (
              <span key={b.texte} className={`text-xs rounded-full border px-2.5 py-0.5 whitespace-nowrap ${b.classes}`}>
                {b.texte}
              </span>
            ))}
          </span>
        </span>
      </summary>

      <div className="px-4 pb-4 pl-9 space-y-3 text-sm">
        <p className="text-muted leading-relaxed">{doc.pourquoi}</p>

        {manquesBloquants.length > 0 && (
          <ul className="space-y-2">
            {manquesBloquants.map((m) => (
              <li key={m.libelle}>
                <span className="text-ink">{m.libelle}</span>
                <span className="block text-xs text-muted leading-relaxed mt-0.5">{m.consequence}</span>
              </li>
            ))}
          </ul>
        )}

        {manquesPrecisions.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-faint mb-1.5">Facultatif — l'app fonctionne sans, mais moins précisément :</p>
            <ul className="space-y-2">
              {manquesPrecisions.map((m) => (
                <li key={m.libelle}>
                  <span className="text-muted">{m.libelle}</span>
                  <span className="block text-xs text-faint leading-relaxed mt-0.5">{m.consequence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Limite assumée par documentsRequis.ts (ex. bulletins/AEM jamais « complète ») — affichée
            telle quelle, ce n'est pas un manque à combler. */}
        {ligne?.note && <p className="text-xs text-muted leading-relaxed bg-surface-2 border border-line rounded-lg px-3 py-2">{ligne.note}</p>}

        <p className="text-xs text-faint leading-relaxed">{doc.noteCanal}</p>
      </div>
    </details>
  );
}

interface DocumentsARassemblerProps {
  profil: Profil | null;
  contrats: Contrat[];
  /** Bascule sur l'onglet import avec ce type suggéré. Absent : pas de bouton d'action par ligne. */
  onDemanderImport?: (type: TypeDocument) => void;
}

export function DocumentsARassembler({ profil, contrats, onDemanderImport }: DocumentsARassemblerProps) {
  const lignes = documentsRequis(profil, contrats);
  const { combles, total } = progressionDocuments(lignes);
  const ligneParId = new Map(lignes.map((l) => [l.id, l]));

  // Ligne "attestation_taux" absente de `lignes` ⇒ le taux est déjà renseigné (documentsRequis.ts ne
  // la pousse que tant qu'il manque) : plus la peine de la lister, ni le groupe qui ne contiendrait
  // qu'elle. Filtre appliqué UNIQUEMENT à cette ligne — les autres restent des références utiles à
  // relire même une fois complètes (ex. "contrat d'enseignement", jamais calculable dynamiquement).
  const groupesAffiches = GROUPES_DOCUMENTS_UTILES.map((groupe) => ({
    ...groupe,
    documents: groupe.documents.filter((doc) => doc.id !== "attestation_taux" || ligneParId.has("attestation_taux" as IdDocument)),
  })).filter((groupe) => groupe.documents.length > 0);

  return (
    <section className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h4 className="font-display text-lg font-medium tracking-tight">Documents à rassembler</h4>
        <p className="text-xs text-faint leading-relaxed mt-1">
          Calculé d'après les informations déjà enregistrées, pas d'après les fichiers déposés — remplir un champ à la main compte donc autant qu'un import. Si tu conserves un document sur le
          serveur (une fois connecté), tu le retrouveras dans « Mon dossier » — ce statut-ci ne s'appuie jamais sur ça.
        </p>
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
        {groupesAffiches.map((groupe) => (
          <div key={groupe.titre}>
            <p className="px-4 pt-3 pb-1 text-xs uppercase tracking-[.03em] text-faint bg-surface-2/50">{groupe.titre}</p>
            {groupe.documents.map((doc) => (
              <LigneDocumentARassembler key={doc.id} doc={doc} ligne={ligneParId.get(doc.id as IdDocument)} onDemanderImport={onDemanderImport} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
