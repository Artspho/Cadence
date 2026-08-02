/**
 * Porte de sortie vers l'espace personnel France Travail — jamais une porte d'entrée.
 *
 * FranceConnect interdit explicitement les pop-ups et les iframes pendant une session de
 * connexion (l'utilisateur doit pouvoir vérifier lui-même le certificat SSL dans la barre
 * d'adresse) : ce composant ouvre donc de vrais nouveaux onglets (`window.open` avec
 * `noopener,noreferrer`, jamais une iframe ni une webview), rien de plus. L'utilisateur s'y
 * connecte avec ses propres identifiants, télécharge ce qui l'intéresse, puis revient importer
 * le document normalement (canal local ou canal IA, comme aujourd'hui).
 *
 * Deux destinations, chacune vérifiée par Benoît lui-même en se connectant (jamais déduites ni
 * devinées) : France Travail peut changer la structure de son site sans prévenir, contrairement à
 * la règle FranceConnect anti-iframe qui est stable et documentée — cf.
 * `docs/routine-mensuelle-veille.md` §6 pour la routine de vérification mensuelle de ces URLs.
 *
 * Fonctions pures sans props liées à `donnees`/`profil`, même discipline que
 * `construireLienFeedback` dans config/contact.ts : aucune donnée utilisateur ne peut transiter
 * par ce composant, il n'y a structurellement pas accès.
 */

const URL_MES_COURRIERS = "https://candidat.francetravail.fr/mescourriers/";
const URL_ACTUALISATION_DECLAREE = "https://candidat.francetravail.fr/actualisation-declaree/";

function ouvrirNouvelOnglet(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ouvrirMesCourriers(): void {
  ouvrirNouvelOnglet(URL_MES_COURRIERS);
}

export function ouvrirActualisationDeclaree(): void {
  ouvrirNouvelOnglet(URL_ACTUALISATION_DECLAREE);
}

export function OuvrirEspacePersonnelFT() {
  return (
    <div className="bg-surface-2 border border-line rounded-lg px-4 py-3 space-y-3">
      {/* Toujours visible, jamais juste un tooltip : su avant de cliquer, pas découvert après. */}
      <p className="text-xs text-faint leading-relaxed">
        Ouvre ton espace personnel dans un nouvel onglet (Cadence ne peut pas l'afficher ici, FranceConnect l'interdit pour ta sécurité). Télécharge le document qui t'intéresse, puis reviens ici
        pour l'importer.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <button
            onClick={ouvrirMesCourriers}
            className="w-full bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90"
          >
            Relevés &amp; courriers France Travail
          </button>
          <p className="text-xs text-faint leading-relaxed">Relevés de situation, notifications, déclaration fiscale.</p>
        </div>
        <div className="space-y-1">
          <button
            onClick={ouvrirActualisationDeclaree}
            className="w-full bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90"
          >
            Historique d'actualisation
          </button>
          <p className="text-xs text-faint leading-relaxed">Justificatifs après déclaration / actualisation mensuelle.</p>
        </div>
      </div>
    </div>
  );
}
