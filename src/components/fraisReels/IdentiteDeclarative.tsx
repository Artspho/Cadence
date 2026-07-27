// Identité déclarative + export PDF — les deux dans la même carte : le bouton dépend directement
// des champs juste au-dessus, ce qui rend le message « Renseigne ton identité ci-dessus » littéral.
// Aucun calcul ici : le dossier est assemblé par l'appelant (FraisReels.tsx), qui a déjà tout l'état
// sous la main ; ce composant ne fait qu'y injecter l'identité et déclencher le téléchargement.
import { useEffect, useState } from "react";
import {
  chargerIdentiteDeclarative,
  identiteComplete,
  identiteVide,
  sauvegarderIdentiteDeclarative,
  type IdentiteDeclarative as Identite,
} from "../../storage/identiteDeclarativeStorage";
import { telechargerPdfFraisReels, type DossierFraisReels } from "../../lib/exportPdfFraisReels";

interface IdentiteDeclarativeProps {
  /** Assemble le dossier complet à partir de l'état de l'onglet + l'identité saisie ici. */
  construireDossier: (identite: Identite) => DossierFraisReels;
}

export function IdentiteDeclarative({ construireDossier }: IdentiteDeclarativeProps) {
  const [identite, setIdentite] = useState<Identite>(identiteVide);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerIdentiteDeclarative().then(setIdentite);
  }, []);

  // Sauvegarde explicite à chaque modification (pas via un useEffect sur l'état) : évite d'écrire
  // une identité vide par-dessus la valeur stockée au premier rendu, avant la fin du chargement.
  function maj(champ: keyof Identite, valeur: string) {
    const suivante: Identite = { ...identite, [champ]: valeur };
    setIdentite(suivante);
    sauvegarderIdentiteDeclarative(suivante);
  }

  const complete = identiteComplete(identite);

  function exporter() {
    setErreur(null);
    try {
      telechargerPdfFraisReels(construireDossier(identite));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La génération du PDF a échoué.");
    }
  }

  const champ = (id: keyof Identite, label: string, options: { requis?: boolean; placeholder?: string } = {}) => (
    <div>
      <label className="block text-xs uppercase tracking-[.03em] text-muted mb-1" htmlFor={`identite-${id}`}>
        {label}
        {!options.requis && <span className="text-faint normal-case tracking-normal"> (optionnel)</span>}
      </label>
      <input
        id={`identite-${id}`}
        value={identite[id] ?? ""}
        onChange={(e) => maj(id, e.target.value)}
        placeholder={options.placeholder}
        className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2"
      />
    </div>
  );

  return (
    <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium mb-1">Identité déclarative</h2>
        <p className="text-sm text-muted">Figure en en-tête du PDF, comme sur le formulaire SNAM.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {champ("nom", "Nom", { requis: true, placeholder: "ZAHRA" })}
        {champ("prenom", "Prénom", { requis: true, placeholder: "Benoît" })}
        {champ("profession", "Profession", { requis: true, placeholder: "Musicien intermittent du spectacle" })}
        {champ("adresse", "Adresse", { placeholder: "12 rue des Artistes, 13001 Marseille" })}
      </div>

      <p className="text-xs text-faint bg-surface-2 border border-line rounded-lg px-3 py-2">
        Utilisé uniquement pour générer ton PDF. Jamais transmis, jamais inclus dans l'export JSON de test.
      </p>

      <div className="border-t border-line pt-4 space-y-2">
        <button
          type="button"
          onClick={exporter}
          disabled={!complete}
          className="bg-mint text-bg font-medium rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Télécharger le PDF
        </button>
        {!complete && <p className="text-xs text-amber">Renseigne ton identité ci-dessus pour générer le PDF.</p>}
        {erreur && <p className="text-sm text-red">{erreur}</p>}
      </div>
    </section>
  );
}
