// État vide du tableau de bord (compte neuf, aucun contrat). Purement
// présentationnel : aucune prop de date/profil, donc aucune hypothèse sur
// la date anniversaire ne peut s'y glisser — que le profil connaisse sa
// date anniversaire ou ait coché "je ne sais pas", ce composant est
// strictement identique.
interface DashboardVideProps {
  onAllerVersContrats: () => void;
}

export function DashboardVide({ onAllerVersContrats }: DashboardVideProps) {
  return (
    <div className="bg-surface border border-line rounded-hero p-10 text-center space-y-4">
      <span className="inline-block w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-teal" aria-hidden />
      <div className="space-y-1.5">
        <h2 className="font-display text-xl font-semibold tracking-tight">Ajoute ton premier contrat</h2>
        <p className="text-sm text-muted max-w-[420px] mx-auto">
          Cadence a besoin d'au moins un contrat pour estimer où tu en es. Direction l'onglet Contrats pour commencer.
        </p>
      </div>
      <button onClick={onAllerVersContrats} className="bg-mint text-bg font-medium rounded-lg px-5 py-2.5 inline-block">
        Ajouter un contrat →
      </button>
    </div>
  );
}
