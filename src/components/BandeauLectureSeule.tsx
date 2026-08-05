/**
 * PHASE 5 — LE BANDEAU DU SERVEUR MUET.
 *
 * Benoît a choisi le PALIER GRATUIT le 05/08/2026, en connaissance de cause : un projet Supabase
 * gratuit est mis en pause après 7 jours d'inactivité. Il a aussi choisi que Cadence s'ouvre quand
 * même, en lecture seule, plutôt que de refuser de démarrer. Ce bandeau est ce qui rend ce choix
 * tenable, et il porte deux responsabilités que rien d'autre dans l'app n'assume :
 *
 * 1. **DIRE QUE LES CHIFFRES PEUVENT ÊTRE EN RETARD.** Ils viennent de la dernière copie déposée dans
 *    ce navigateur. Si une saisie a eu lieu ailleurs depuis, elle n'est pas là. Afficher un décompte
 *    d'heures sans cette réserve serait exactement le « chiffre faux » que le devoir n°2 interdit —
 *    d'autant que Benoît lit ces chiffres pour savoir où il en est de ses 507 heures.
 *
 * 2. **DONNER LA PROCÉDURE, PAS SEULEMENT LE SYMPTÔME.** Une pause n'est pas une perte : le projet se
 *    restaure d'un clic depuis le tableau de bord Supabase. Sans cette phrase, une indisponibilité de
 *    quelques secondes à réparer ressemble à une catastrophe.
 *
 * Non refermable, comme le bandeau d'échec d'écriture : ce n'est pas une information d'ambiance.
 */

import { useState } from "react";

interface BandeauLectureSeuleProps {
  /** Message technique brut du serveur — affiché tel quel dans le détail, jamais reformulé. */
  message: string;
  onExporter: () => void;
  /**
   * Réinterroge le serveur. Pas de drapeau « en cours » : dès que la tentative démarre, l'app repasse
   * en interrogation et CE BANDEAU DISPARAÎT — sa disparition est le retour visuel. Une prop `enCours`
   * ne pourrait jamais valoir `true` ici, et un paramètre qui ne peut pas être vrai finit par être cru.
   */
  onReessayer: () => void;
}

export function BandeauLectureSeule({ message, onExporter, onReessayer }: BandeauLectureSeuleProps) {
  const [detailOuvert, setDetailOuvert] = useState(false);

  return (
    <div role="alert" className="bg-amber/15 text-amber px-6 py-3 text-sm">
      <p>
        <strong className="font-medium">Lecture seule : le serveur ne répond pas.</strong> Tu peux consulter, mais rien ne peut être enregistré — aucune saisie ne sera conservée. Les
        chiffres affichés viennent de la dernière copie déposée dans ce navigateur : ils peuvent être en retard sur le serveur.
      </p>
      <p className="mt-2 text-xs opacity-90">
        La cause la plus probable est une <strong className="font-medium">mise en pause après 7 jours sans activité</strong> (c'est le fonctionnement du palier gratuit). Ce n'est pas
        une perte de données : ouvre le tableau de bord Supabase et clique sur <strong className="font-medium">Restore</strong> — le projet redémarre avec tout son contenu. Sinon,
        c'est la connexion réseau.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <button type="button" onClick={onReessayer} className="bg-amber text-bg font-medium rounded-lg px-3 py-1.5 text-xs">
          Réessayer
        </button>
        <button type="button" onClick={onExporter} className="underline text-xs">
          Télécharger la copie de ce navigateur
        </button>
        <button type="button" onClick={() => setDetailOuvert((v) => !v)} className="underline text-xs">
          {detailOuvert ? "Masquer" : "Voir"} le détail technique
        </button>
      </div>
      {detailOuvert && <p className="mt-2 text-xs font-mono opacity-80 break-words">{message}</p>}
    </div>
  );
}
