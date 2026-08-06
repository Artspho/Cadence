// Compteur + envoi des justificatifs encore stockés dans ce navigateur.
//
// Décisions de Benoît du 04/08/2026 : file d'attente VISIBLE en cas d'échec d'envoi, et migration de
// l'existant sur bouton explicite avec compte-rendu. ⚠️ Destination Google Drive RETIRÉE au commit 6
// de la phase 6 (05/08/2026) : c'est désormais Supabase Storage, la même destination que tous les
// autres justificatifs de l'app — et le compte étant obligatoire, il n'y a plus de "connecte Drive
// d'abord" à gérer : l'`uploader` est toujours utilisable.
//
// ⚠️ Un seul bouton pour les deux usages, et c'est voulu : « migrer mes anciens justificatifs » et
// « réessayer ceux qui n'ont pas pu partir » sont la MÊME opération — envoyer vers le serveur tout ce
// qui est encore local (cf. lib/envoiJustificatifsEnAttente.ts). En faire deux boutons obligerait à
// distinguer deux états qui n'existent pas dans les données.
//
// Ce composant ne décide rien et ne calcule rien : il affiche l'état, appelle la logique pure, et rend
// compte. Le compte-rendu nomme les fichiers restés en arrière — un « 3 échecs » nu n'aide personne.
import { useState } from "react";
import type { Depense } from "../../types/fraisReels";
import { formaterTaille } from "../../lib/capaciteStockage";
import { envoyerJustificatifsLocaux, justificatifsEnAttente, poidsJustificatifsEnAttente, type Uploader, type CompteRenduEnvoi } from "../../lib/envoiJustificatifsEnAttente";

interface JustificatifsEnAttenteProps {
  depenses: Depense[];
  uploader: Uploader;
  /** Remplace la liste entière — l'envoi met à jour plusieurs dépenses d'un coup. */
  onRemplacerDepenses: (depenses: Depense[]) => void;
}

export function JustificatifsEnAttente({ depenses, uploader, onRemplacerDepenses }: JustificatifsEnAttenteProps) {
  const [enCours, setEnCours] = useState(false);
  const [compteRendu, setCompteRendu] = useState<CompteRenduEnvoi | null>(null);

  const enAttente = justificatifsEnAttente(depenses);
  const poids = poidsJustificatifsEnAttente(depenses);

  // Rien en attente : on n'affiche rien du tout. Un bloc « 0 justificatif en attente » serait du bruit
  // permanent — et pour la grande majorité des exercices, il n'y aura jamais rien à envoyer.
  if (enAttente.length === 0) return null;

  async function envoyer() {
    setEnCours(true);
    setCompteRendu(null);
    const resultat = await envoyerJustificatifsLocaux(depenses, uploader);
    // Écrit même en cas d'échec partiel : les fichiers qui SONT partis doivent être enregistrés comme
    // tels, sinon un second essai les renverrait en doublon.
    onRemplacerDepenses(resultat.depenses);
    setCompteRendu(resultat);
    setEnCours(false);
  }

  return (
    <div className="border border-amber/40 bg-amber/5 rounded-lg p-4 space-y-3">
      <p className="text-sm text-ink">
        <strong className="font-medium">
          {enAttente.length} justificatif{enAttente.length > 1 ? "s" : ""} encore stocké{enAttente.length > 1 ? "s" : ""} dans ce navigateur
        </strong>{" "}
        <span className="text-muted">({formaterTaille(poids)}).</span>
      </p>
      <p className="text-xs text-muted">
        C'est ce qui remplit le stockage de ce navigateur — de loin le plus gros poste. Les envoyer sur le serveur libère cette place, et les met à l'abri d'un vidage de navigateur.
      </p>

      <button type="button" onClick={envoyer} disabled={enCours} className="px-4 py-2 rounded-lg bg-mint text-bg font-medium text-sm disabled:opacity-50">
        {enCours ? "Envoi en cours…" : `Envoyer ${enAttente.length > 1 ? "ces justificatifs" : "ce justificatif"} sur le serveur`}
      </button>

      {compteRendu && (
        <div className="text-sm space-y-1" role="status">
          {compteRendu.envoyes > 0 && (
            <p className="text-mint">
              {compteRendu.envoyes} justificatif{compteRendu.envoyes > 1 ? "s" : ""} envoyé{compteRendu.envoyes > 1 ? "s" : ""} sur le serveur.
            </p>
          )}
          {compteRendu.echecs > 0 && (
            <p className="text-amber">
              {compteRendu.echecs} n'{compteRendu.echecs > 1 ? "ont" : "a"} pas pu partir et {compteRendu.echecs > 1 ? "restent" : "reste"} dans ce navigateur — rien n'est perdu, tu peux
              réessayer : {compteRendu.nomsEnEchec.join(", ")}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
