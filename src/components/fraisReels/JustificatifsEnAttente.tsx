// Compteur + envoi des justificatifs encore stockés dans ce navigateur.
//
// Décisions de Benoît du 04/08/2026 : destination Google Drive (IndexedDB refusé), file d'attente
// VISIBLE en cas d'échec d'envoi, et migration de l'existant sur bouton explicite avec compte-rendu.
//
// ⚠️ Un seul bouton pour les deux usages, et c'est voulu : « migrer mes anciens justificatifs » et
// « réessayer ceux qui n'ont pas pu partir » sont la MÊME opération — envoyer vers Drive tout ce qui est
// encore local (cf. lib/envoiJustificatifsEnAttente.ts). En faire deux boutons obligerait à distinguer
// deux états qui n'existent pas dans les données.
//
// Ce composant ne décide rien et ne calcule rien : il affiche l'état, appelle la logique pure, et rend
// compte. Le compte-rendu nomme les fichiers restés en arrière — un « 3 échecs » nu n'aide personne.
import { useState } from "react";
import type { Depense } from "../../types/fraisReels";
import { formaterTaille } from "../../lib/capaciteStockage";
import { envoyerJustificatifsLocaux, justificatifsEnAttente, poidsJustificatifsEnAttente, type CompteRenduEnvoi } from "../../lib/envoiJustificatifsEnAttente";
import { getToken } from "../../lib/googleDriveAuth";
import { uploaderJustificatif } from "../../lib/googleDriveStorage";

interface JustificatifsEnAttenteProps {
  depenses: Depense[];
  driveConnecte: boolean;
  /** Remplace la liste entière — l'envoi met à jour plusieurs dépenses d'un coup. */
  onRemplacerDepenses: (depenses: Depense[]) => void;
}

export function JustificatifsEnAttente({ depenses, driveConnecte, onRemplacerDepenses }: JustificatifsEnAttenteProps) {
  const [enCours, setEnCours] = useState(false);
  const [compteRendu, setCompteRendu] = useState<CompteRenduEnvoi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const enAttente = justificatifsEnAttente(depenses);
  const poids = poidsJustificatifsEnAttente(depenses);

  // Rien en attente : on n'affiche rien du tout. Un bloc « 0 justificatif en attente » serait du bruit
  // permanent — et pour la grande majorité des exercices, il n'y aura jamais rien à envoyer.
  if (enAttente.length === 0) return null;

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    setCompteRendu(null);
    const token = getToken();
    if (token === null) {
      // Dire la vraie raison : ce n'est pas un échec d'envoi, c'est une absence d'autorisation.
      setErreur("Connecte Google Drive d'abord — l'autorisation d'accès a expiré ou n'a jamais été donnée.");
      setEnCours(false);
      return;
    }
    const resultat = await envoyerJustificatifsLocaux(depenses, (fichier, annee) => uploaderJustificatif(token, fichier, annee));
    // Écrit même en cas d'échec partiel : les fichiers qui SONT partis doivent être enregistrés comme
    // tels, sinon un second essai les renverrait en doublon sur Drive.
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
        C'est ce qui remplit le stockage de ce navigateur — de loin le plus gros poste. Les envoyer sur ton Google Drive libère cette place, et les met à l'abri d'un vidage de navigateur.
      </p>

      {driveConnecte ? (
        <button type="button" onClick={envoyer} disabled={enCours} className="px-4 py-2 rounded-lg bg-mint text-bg font-medium text-sm disabled:opacity-50">
          {enCours ? "Envoi en cours…" : `Envoyer ${enAttente.length > 1 ? "ces justificatifs" : "ce justificatif"} vers Google Drive`}
        </button>
      ) : (
        <p className="text-xs text-muted">Connecte Google Drive ci-dessous pour pouvoir les envoyer.</p>
      )}

      {erreur && <p className="text-sm text-red">{erreur}</p>}

      {compteRendu && (
        <div className="text-sm space-y-1" role="status">
          {compteRendu.envoyes > 0 && (
            <p className="text-mint">
              {compteRendu.envoyes} justificatif{compteRendu.envoyes > 1 ? "s" : ""} envoyé{compteRendu.envoyes > 1 ? "s" : ""} sur Google Drive.
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
