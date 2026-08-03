// Écran de secours affiché à la place de TOUTE l'application quand le contenu stocké n'a pas pu
// être lu (cf. storage/localStorageAdapter.ts, `ResultatChargement` statut "illisible").
//
// Règle qui gouverne cet écran : une lecture qui échoue ne doit JAMAIS déclencher d'écriture
// (correctif du 03/08/2026, point 🔴 n°1 de docs/critique_2026-08-03.md). Tant que cet écran est
// affiché, l'app n'écrit rien — et le seul bouton qui en a le droit est délibérément le plus
// difficile à atteindre des trois.
//
// Ordre d'apparition volontaire, du plus sûr au plus destructeur :
//   1. télécharger le contenu brut (aucun effet de bord),
//   2. restaurer la version précédente (réversible : la copie de secours reste en place),
//   3. repartir de zéro (irréversible) — gaté par une case à cocher décochée par défaut.
import { useState } from "react";
import type { DonneesApp } from "../storage/localStorageAdapter";

interface EcranDonneesIllisiblesProps {
  brut: string | null;
  detail: string;
  sauvegarde: DonneesApp | null;
  onRestaurer: () => void;
  onRepartirDeZero: () => void;
}

function telechargerBrut(brut: string) {
  // Nom horodaté : deux tentatives de sauvegarde ne s'écrasent pas dans le dossier de téléchargement.
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const url = URL.createObjectURL(new Blob([brut], { type: "application/json" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `cadence-donnees-illisibles-${horodatage}.json`;
  lien.click();
  URL.revokeObjectURL(url);
}

export function EcranDonneesIllisibles({ brut, detail, sauvegarde, onRestaurer, onRepartirDeZero }: EcranDonneesIllisiblesProps) {
  const [misALAbri, setMisALAbri] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-ink px-6 py-10">
      <div className="max-w-[720px] mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium">Tes données n'ont pas pu être lues</h1>
          {/* Le premier message doit désamorcer la panique ET dire la vérité : rien n'a été touché.
              C'est précisément ce que l'ancien comportement ne pouvait pas affirmer. */}
          <p className="text-sm text-muted mt-2">
            Cadence s'est arrêtée avant de toucher à quoi que ce soit. <strong className="text-ink font-medium">Rien n'a été effacé</strong> : le contenu enregistré sur cet appareil est
            toujours là, intact, tel qu'il était. L'application ne réécrira rien tant que tu n'auras pas choisi ci-dessous.
          </p>
        </div>

        {brut !== null && (
          <div className="bg-surface border border-line rounded-card p-5 space-y-3">
            <h2 className="font-display text-lg font-medium">1. Mets tes données à l'abri</h2>
            <p className="text-sm text-muted">
              Ce contenu est souvent récupérable à la main. Télécharge-le <strong className="text-ink font-medium">avant toute autre manipulation</strong>, ou copie-le depuis la zone
              ci-dessous.
            </p>
            <button onClick={() => telechargerBrut(brut)} className="bg-mint text-bg font-medium rounded-lg px-4 py-2.5 text-sm">
              Télécharger le fichier brut
            </button>
            <textarea
              aria-label="Contenu brut enregistré sur cet appareil"
              readOnly
              value={brut}
              rows={8}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-muted"
            />
          </div>
        )}

        {brut === null && (
          <div className="bg-surface border border-line rounded-card p-5">
            <p className="text-sm text-muted">
              Le stockage de ce navigateur est inaccessible (navigation privée, ou réglages qui bloquent le stockage local). Il n'y a rien à télécharger : Cadence n'a pas pu lire quoi que ce
              soit. Essaie dans une fenêtre normale, ou avec un autre navigateur, avant de repartir de zéro.
            </p>
          </div>
        )}

        <details className="bg-surface border border-line rounded-card">
          <summary className="cursor-pointer select-none list-none px-5 py-3 text-sm text-muted flex items-center gap-2">
            <span aria-hidden="true">▸</span>
            Détail technique (utile si tu demandes de l'aide)
          </summary>
          <p className="px-5 pb-4 text-xs font-mono text-faint break-words">{detail}</p>
        </details>

        {sauvegarde !== null && (
          <div className="bg-surface border border-line rounded-card p-5 space-y-3">
            <h2 className="font-display text-lg font-medium">2. Restaurer la version précédente</h2>
            <p className="text-sm text-muted">
              Cadence garde une copie de l'état qui précédait le dernier enregistrement, et cette copie est lisible. La restaurer te ramène à cet état : tu perdrais uniquement ce qui a été
              saisi depuis. Le contenu actuel reste téléchargeable ci-dessus.
            </p>
            <p className="text-sm">
              Elle contient <strong className="font-medium">{sauvegarde.contrats.length}</strong> contrat{sauvegarde.contrats.length > 1 ? "s" : ""} et{" "}
              {sauvegarde.profil ? "un profil renseigné" : "aucun profil"}.
            </p>
            <button onClick={onRestaurer} className="bg-surface-2 border border-line-strong text-ink font-medium rounded-lg px-4 py-2.5 text-sm">
              Restaurer la version précédente
            </button>
          </div>
        )}

        {/* Seule action irréversible de tout l'écran — friction volontaire, au même titre que les
            autres gestes sensibles du projet. La case reste décochée par défaut : cocher est un
            geste conscient, pas un réflexe. */}
        <div className="bg-surface border border-red/30 rounded-card p-5 space-y-3">
          <h2 className="font-display text-lg font-medium text-red">{sauvegarde !== null ? "3." : "2."} Repartir de zéro</h2>
          <p className="text-sm text-muted">
            Cadence redémarre vide. Le contenu illisible est mis de côté dans le navigateur plutôt que supprimé, mais ne compte pas dessus : télécharge-le d'abord.
          </p>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={misALAbri} onChange={(e) => setMisALAbri(e.target.checked)} className="mt-0.5" />
            <span>J'ai mis mes données à l'abri (fichier téléchargé ou contenu copié).</span>
          </label>
          <button
            onClick={onRepartirDeZero}
            disabled={!misALAbri}
            className="bg-red/15 text-red font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Repartir de zéro
          </button>
        </div>
      </div>
    </div>
  );
}
