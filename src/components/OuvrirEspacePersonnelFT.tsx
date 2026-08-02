/**
 * Porte de sortie vers l'espace personnel France Travail — jamais une porte d'entrée.
 *
 * FranceConnect interdit explicitement les pop-ups et les iframes pendant une session de
 * connexion (l'utilisateur doit pouvoir vérifier lui-même le certificat SSL dans la barre
 * d'adresse) : ce composant ouvre donc un vrai nouvel onglet (`window.open` avec
 * `noopener,noreferrer`, jamais une iframe ni une webview), rien de plus. L'utilisateur s'y
 * connecte avec ses propres identifiants, télécharge ce qui l'intéresse, puis revient importer
 * le document normalement (canal local ou canal IA, comme aujourd'hui).
 *
 * Fonction pure sans props liées à `donnees`/`profil`, même discipline que
 * `construireLienFeedback` dans config/contact.ts : aucune donnée utilisateur ne peut transiter
 * par ce composant, il n'y a structurellement pas accès.
 */

const URL_ESPACE_PERSONNEL_FT = "https://candidat.francetravail.fr/espacepersonnel/";

export function ouvrirEspacePersonnelFT(): void {
  window.open(URL_ESPACE_PERSONNEL_FT, "_blank", "noopener,noreferrer");
}

export function OuvrirEspacePersonnelFT() {
  return (
    <div className="bg-surface-2 border border-line rounded-lg px-4 py-3 space-y-2">
      <button onClick={ouvrirEspacePersonnelFT} className="bg-mint text-bg font-medium rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90">
        Récupérer un document sur France Travail
      </button>
      {/* Toujours visible, jamais juste un tooltip : su avant de cliquer, pas découvert après. */}
      <p className="text-xs text-faint leading-relaxed">
        Ouvre ton espace personnel dans un nouvel onglet (Cadence ne peut pas l'afficher ici, FranceConnect l'interdit pour ta sécurité). Cherche dans « Mes échanges avec France Travail » →
        « Mes courriers reçus », télécharge le document, puis reviens ici pour l'importer.
      </p>
    </div>
  );
}
