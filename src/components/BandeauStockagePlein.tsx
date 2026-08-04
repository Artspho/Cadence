// Point 2 de docs/critique_2026-08-03.md — le bandeau d'échec d'écriture, rendu ACTIONNABLE.
//
// Ce qu'il était avant (filet du 03/08) : un bandeau rouge non refermable disant « tes dernières
// modifications n'ont PAS été enregistrées », renvoyant à un bouton « Exporter mes données » situé
// ailleurs dans la page. C'était déjà l'essentiel — l'échec ne disparaissait plus en silence.
//
// Ce qui manquait, et que la fiche du point 2 énumère : l'export de secours à portée immédiate, et le
// sort des copies de secours. Ce composant ajoute donc, dans le bandeau lui-même :
//   1. un bouton d'export DIRECT (rien ne part sans un clic — décision par défaut, cf. plus bas) ;
//   2. l'occupation réelle du stockage, clé par clé, du plus gros au plus petit. C'est une MESURE
//      (somme des longueurs), jamais une prédiction : cf. lib/capaciteStockage.ts, qui explique
//      pourquoi aucun seuil deviné n'est affiché ici ;
//   3. la suppression de la copie de quarantaine, sur clic explicite seulement.
//
// ⚠️ DÉCISIONS PAR DÉFAUT, à changer si Benoît tranche autrement — elles ont été prises faute de
// réponse le 04/08/2026, en retenant chaque fois l'option qui ne détruit rien et ne surprend pas :
//   - export MANUEL (bouton) et non téléchargement automatique : l'app ne dépose jamais un fichier
//     dans les téléchargements sans qu'on le lui demande, et un échec d'écriture peut se répéter à
//     chaque frappe — l'automatique en ferait une pluie de fichiers ;
//   - quarantaine PROPOSÉE à la suppression, jamais purgée d'office (cf. supprimerQuarantaine).
import { useState } from "react";
import { formaterTaille, mesurerOccupation } from "../lib/capaciteStockage";
import { CLE_QUARANTAINE, CLE_SAUVEGARDE, CLE_STOCKAGE, supprimerQuarantaine } from "../storage/localStorageAdapter";

interface BandeauStockagePleinProps {
  /** Message brut du navigateur (`QuotaExceededError : …`) — affiché tel quel, jamais reformulé. */
  erreur: string;
  onExporter: () => void;
}

/**
 * Nombre de clés détaillées avant résumé. Six : de quoi voir les gros postes sans transformer un
 * bandeau d'urgence en inventaire. Constaté à l'écran le 04/08/2026 — un stockage saturé peut compter
 * 85 clés, et la liste complète rendait le bandeau illisible.
 */
const MAX_CLES_DETAILLEES = 6;

/** Ce que chaque clé de Cadence contient, en français — pour ne pas afficher des noms techniques nus. */
const LIBELLES_CLES: Record<string, string> = {
  [CLE_STOCKAGE]: "tes données actuelles",
  [CLE_SAUVEGARDE]: "copie de secours automatique (version précédente)",
  [CLE_QUARANTAINE]: "copie mise de côté lors d'un « repartir de zéro »",
};

export function BandeauStockagePlein({ erreur, onExporter }: BandeauStockagePleinProps) {
  const [detailOuvert, setDetailOuvert] = useState(false);
  // Mesuré à chaque rendu plutôt que mémoïsé : après une suppression de quarantaine, le détail doit
  // montrer la place réellement libérée, pas une valeur figée à l'apparition du bandeau.
  const [rafraichissement, setRafraichissement] = useState(0);
  const occupation = mesurerOccupation(window.localStorage);
  const quarantaine = occupation.parCle.find((c) => c.cle === CLE_QUARANTAINE);
  // Les plus grosses seulement : c'est sur elles qu'on peut agir, et un bandeau d'urgence doit se lire
  // d'un coup d'œil. Le reste est résumé en une ligne chiffrée juste en dessous, jamais escamoté.
  const clesMontrees = occupation.parCle.slice(0, MAX_CLES_DETAILLEES);
  const clesRestantes = occupation.parCle.slice(MAX_CLES_DETAILLEES);

  return (
    <div role="alert" className="bg-red/15 text-red px-6 py-3 text-sm" data-rafraichissement={rafraichissement}>
      <p>
        <strong className="font-medium">Tes dernières modifications n'ont PAS été enregistrées.</strong> Le stockage de ce navigateur a refusé l'écriture ({erreur}). Exporte tes données
        maintenant : c'est le seul geste qui les met à l'abri.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" onClick={onExporter} className="bg-red text-bg font-medium rounded-lg px-3 py-1.5 text-xs">
          Télécharger ma sauvegarde maintenant
        </button>
        <button type="button" onClick={() => setDetailOuvert((v) => !v)} className="underline text-xs">
          {detailOuvert ? "Masquer" : "Voir"} ce qui occupe la place ({formaterTaille(occupation.totalOctets)})
        </button>
      </div>

      {detailOuvert && (
        <div className="mt-3 space-y-2">
          <ul className="text-xs space-y-1">
            {clesMontrees.map((c) => (
              <li key={c.cle} className="flex items-baseline gap-2">
                <span className="tabular-nums font-medium">{formaterTaille(c.octets)}</span>
                <span className="opacity-80">{LIBELLES_CLES[c.cle] ?? c.cle}</span>
              </li>
            ))}
            {/* Jamais de troncature muette : le nombre de clés non listées ET leur poids total sont dits.
                Sans cette ligne, un stockage à 50 Mo réparti sur 85 clés (constaté à l'écran le
                04/08/2026) donnerait une liste illisible OU un détail qui ment par omission. */}
            {clesRestantes.length > 0 && (
              <li className="flex items-baseline gap-2 opacity-80">
                <span className="tabular-nums font-medium">{formaterTaille(clesRestantes.reduce((t, c) => t + c.octets, 0))}</span>
                <span>
                  {clesRestantes.length} autre{clesRestantes.length > 1 ? "s" : ""} entrée{clesRestantes.length > 1 ? "s" : ""} de ce navigateur
                </span>
              </li>
            )}
          </ul>
          <p className="text-xs opacity-80">
            Ce sont les justificatifs de dépenses qui pèsent le plus lourd : ils sont enregistrés en entier dans ce navigateur. En supprimer quelques-uns, sur des dépenses anciennes, libère
            beaucoup de place.
          </p>
          {quarantaine !== undefined && (
            <div className="text-xs">
              <p className="mb-1">
                Une copie mise de côté lors d'un « repartir de zéro » occupe {formaterTaille(quarantaine.octets)}. Cadence ne la supprime jamais d'elle-même — vérifie que tu n'en as plus
                besoin avant de le faire.
              </p>
              <button
                type="button"
                onClick={() => {
                  supprimerQuarantaine();
                  setRafraichissement((v) => v + 1);
                }}
                className="underline"
              >
                Supprimer cette copie et libérer {formaterTaille(quarantaine.octets)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
