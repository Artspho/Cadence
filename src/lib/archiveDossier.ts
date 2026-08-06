import JSZip from "jszip";
import type { LigneDocument } from "../storage/documentsStorage";
import { cheminDansArchive, cheminUnique } from "./regroupementDossier";

/**
 * TÉLÉCHARGEMENT GROUPÉ DE « MON DOSSIER » — demandé par Benoît le 06/08/2026, en même temps que le
 * regroupement par catégorie.
 *
 * L'archive est construite DANS LE NAVIGATEUR : chaque fichier est récupéré par son URL signée, puis
 * ajouté au zip. Il n'existe aucune fonction serveur pour le faire, et en ajouter une donnerait à
 * Cadence un accès aux contenus qu'elle n'a pas besoin d'avoir.
 *
 * ⚠️ CONSÉQUENCE À DIRE À L'UTILISATEUR, PAS À TAIRE : tout passe par sa mémoire vive. Un dossier de
 * quelques dizaines de justificatifs (~5 Mo maximum par fichier) reste confortable ; plusieurs
 * centaines feraient souffrir un téléphone. C'est pourquoi `construireArchive` rend la progression :
 * l'écran doit montrer où il en est, jamais figer en silence.
 *
 * ⚠️ ÉCHEC PARTIEL — LE POINT LE PLUS IMPORTANT DE CE MODULE. Si UN fichier ne peut pas être récupéré
 * (URL signée refusée, réseau coupé), l'archive n'est PAS abandonnée : les autres sont conservés, et
 * les manquants sont rendus dans `echecs`. L'appelant DOIT les nommer à l'écran. Une archive
 * silencieusement incomplète serait le pire des deux devoirs à la fois : des données perdues (n°1)
 * derrière un succès affiché (n°2). Un fichier `_FICHIERS-MANQUANTS.txt` est donc aussi glissé dans
 * l'archive elle-même — pour que la vérité voyage avec le zip, même ouvert dans six mois.
 */

export interface EchecArchive {
  nomFichier: string;
  motif: string;
}

export interface ResultatArchive {
  archive: Blob;
  /** Nombre de documents réellement présents dans l'archive. */
  nombreInclus: number;
  /** Documents absents, avec leur motif. JAMAIS silencieux : à afficher. */
  echecs: EchecArchive[];
}

export interface OptionsArchive {
  /** Résout l'URL signée d'un document. Injecté : ce module ne connaît pas Supabase. */
  obtenirUrl: (document: LigneDocument) => Promise<{ url: string } | { erreur: string }>;
  /**
   * Récupère le contenu. Injecté pour les tests ; `fetch` en vrai.
   *
   * ⚠️ `ArrayBuffer` et NON `Blob` : JSZip ne reconnaît pas le `Blob` de Node (il lève « Is it in a
   * supported JavaScript type ? »), ce qui rendait ce module intestable hors navigateur. L'ArrayBuffer
   * est compris partout — un type portable plutôt qu'un type qui n'existe bien que dans le navigateur.
   */
  recupererContenu?: (url: string) => Promise<ArrayBuffer>;
  /** Appelé après chaque document traité (réussi ou non) — pour l'affichage de la progression. */
  onProgression?: (traites: number, total: number) => void;
}

async function recupererParDefaut(url: string): Promise<ArrayBuffer> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
  return await reponse.arrayBuffer();
}

function messageDe(incident: unknown): string {
  return incident instanceof Error ? incident.message : String(incident);
}

/**
 * Construit l'archive. Les fichiers sont traités UN PAR UN, séquentiellement.
 *
 * ⚠️ SÉQUENTIEL EXPRÈS, ne pas « optimiser » en parallèle : chaque URL signée est un accès au bucket,
 * et une rafale de dizaines de requêtes simultanées est exactement ce qui déclenche une limitation
 * côté serveur — on perdrait des fichiers pour gagner quelques secondes. Même raisonnement que les
 * envois séquentiels de `lib/envoiJustificatifsEnAttente.ts`.
 */
export async function construireArchive(documents: LigneDocument[], options: OptionsArchive): Promise<ResultatArchive> {
  const recupererContenu = options.recupererContenu ?? recupererParDefaut;
  const zip = new JSZip();
  const cheminsPris = new Set<string>();
  const echecs: EchecArchive[] = [];
  let nombreInclus = 0;

  for (const [index, document] of documents.entries()) {
    try {
      const resultatUrl = await options.obtenirUrl(document);
      if ("erreur" in resultatUrl) {
        echecs.push({ nomFichier: document.nomFichier, motif: resultatUrl.erreur });
      } else {
        const contenu = await recupererContenu(resultatUrl.url);
        // ⚠️ `new Uint8Array(...)` N'EST PAS DÉCORATIF. JSZip identifie ce qu'on lui donne par
        // `instanceof`, et un `ArrayBuffer` fabriqué dans un autre contexte JavaScript (Node contre
        // jsdom sous Vitest, un worker en production) échoue à ce test : JSZip lève alors
        // « Is it in a supported JavaScript type ? ». Reconstruire la vue ICI la crée dans le contexte
        // de ce module, donc reconnaissable à coup sûr. Coût nul (aucune copie des octets).
        // `cheminUnique` empêche deux « facture.pdf » de la même catégorie de s'écraser (devoir n°1).
        zip.file(cheminUnique(cheminDansArchive(document), cheminsPris), new Uint8Array(contenu));
        nombreInclus += 1;
      }
    } catch (incident: unknown) {
      echecs.push({ nomFichier: document.nomFichier, motif: messageDe(incident) });
    }
    options.onProgression?.(index + 1, documents.length);
  }

  // La vérité voyage AVEC l'archive : un zip incomplet doit le dire lui-même, pas seulement l'écran
  // qui l'a produit (et qui sera fermé depuis longtemps quand quelqu'un l'ouvrira).
  if (echecs.length > 0) {
    const lignes = [
      "Cette archive est INCOMPLÈTE.",
      "",
      `${echecs.length} document(s) n'ont pas pu être récupérés au moment de sa création :`,
      "",
      ...echecs.map((e) => `  · ${e.nomFichier} — ${e.motif}`),
      "",
      "Ils existent toujours dans Cadence : relance le téléchargement groupé depuis « Mon dossier ».",
    ];
    zip.file("_FICHIERS-MANQUANTS.txt", lignes.join("\n"));
  }

  const archive = await zip.generateAsync({ type: "blob" });
  return { archive, nombreInclus, echecs };
}

/** Nom de fichier de l'archive : `cadence-dossier-<horodatage>.zip`, ou suffixé par le groupe. */
export function nomArchive(horodatage: string, groupe?: string): string {
  const suffixe = groupe ? `-${groupe.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}` : "";
  return `cadence-dossier${suffixe}-${horodatage}.zip`;
}
