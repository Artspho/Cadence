// Plomberie d'aide contextuelle de l'onglet Frais pro — UI pure, zéro calcul, zéro dépendance
// externe. L'icône est le caractère « ⓘ », dans la continuité des icônes déjà utilisées dans le
// projet (⚠ AmortissementBiens/FraisKilometriques, ▲ AlertCenter, ● StatutBadge).
//
// Deux composants, un seul et même idiome d'accessibilité (bouton natif + aria-expanded +
// aria-controls, jamais un déclenchement au survol seul) :
//   - AidePopover     : bulle flottante par ligne de frais (A/B/C1-C9/D).
//   - EncartDepliable : encart inline replié/déplié (texte d'intro en haut de l'onglet).
import { useEffect, useId, useRef, useState } from "react";
import type { ExplicationFraisReels } from "../../content/explicationsFraisReels";

const CLASSES_ICONE =
  "inline-flex items-center justify-center w-4 h-4 rounded-full text-[11px] leading-none text-muted " +
  "hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:text-ink transition-colors";

interface AidePopoverProps {
  explication: ExplicationFraisReels;
  /** Repris dans l'aria-label du déclencheur — ex. « C1 » : « Aide sur C1 ». */
  libelleCourt: string;
}

/**
 * Bulle d'aide déclenchée au clic OU à la prise de focus clavier (jamais au survol seul, qui
 * exclurait la navigation au clavier et le tactile). Se ferme au clic à l'extérieur, à la touche
 * Échap (le focus revient alors au déclencheur), ou quand le focus quitte l'ensemble
 * déclencheur + bulle — ce qui garantit au passage qu'une seule bulle reste ouverte à la fois.
 */
export function AidePopover({ explication, libelleCourt }: AidePopoverProps) {
  const [ouvert, setOuvert] = useState(false);
  const idBulle = useId();
  const conteneur = useRef<HTMLSpanElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    function auPointeur(e: PointerEvent) {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    }
    function auClavier(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOuvert(false);
      declencheur.current?.focus();
    }

    document.addEventListener("pointerdown", auPointeur);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("pointerdown", auPointeur);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  return (
    <span
      ref={conteneur}
      className="relative inline-block align-middle"
      // Le focus peut légitimement passer du déclencheur à la bulle (texte sélectionnable) : on ne
      // referme que si la nouvelle cible sort de l'ensemble.
      onBlur={(e) => {
        if (!conteneur.current?.contains(e.relatedTarget as Node | null)) setOuvert(false);
      }}
    >
      <button
        ref={declencheur}
        type="button"
        aria-expanded={ouvert}
        aria-controls={idBulle}
        aria-label={`Aide sur ${libelleCourt}`}
        className={CLASSES_ICONE}
        onClick={() => setOuvert((o) => !o)}
        onFocus={() => setOuvert(true)}
      >
        <span aria-hidden>ⓘ</span>
      </button>

      {/* Visibilité pilotée par la CLASSE (`block`/`hidden`), pas seulement par l'attribut `hidden` :
          une utilitaire Tailwind `display` l'emporte sur la règle `[hidden] { display: none }` de la
          feuille de style du navigateur, ce qui laisserait la bulle affichée en permanence. */}
      <span
        id={idBulle}
        role="note"
        hidden={!ouvert}
        className={`absolute left-0 top-full mt-1.5 z-40 w-[min(24rem,80vw)] bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 shadow-lg text-left ${ouvert ? "block" : "hidden"}`}
      >
        <span className="block text-xs font-medium text-ink mb-1">{explication.titre}</span>
        <span className="block text-xs text-muted leading-relaxed">{explication.texte}</span>
      </span>
    </span>
  );
}

interface EncartDepliableProps {
  explication: ExplicationFraisReels;
}

/**
 * Encart inline replié par défaut. Même idiome que `AidePopover` (bouton natif, aria-expanded,
 * aria-controls) mais sans fermeture au clic extérieur ni Échap : le contenu s'insère dans le flux
 * plutôt que de flotter au-dessus, il n'y a donc rien à « écarter ».
 */
export function EncartDepliable({ explication }: EncartDepliableProps) {
  const [ouvert, setOuvert] = useState(false);
  const idContenu = useId();

  return (
    <section className="bg-surface-2 border border-line rounded-lg">
      <h2>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idContenu}
          onClick={() => setOuvert((o) => !o)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint rounded-lg"
        >
          <span aria-hidden className="text-muted text-[11px]">
            ⓘ
          </span>
          <span className="font-medium">{explication.titre}</span>
          <span aria-hidden className={`ml-auto text-muted text-xs transition-transform ${ouvert ? "rotate-90" : ""}`}>
            ▸
          </span>
        </button>
      </h2>
      <div id={idContenu} hidden={!ouvert} className="px-4 pb-3 -mt-0.5">
        <p className="text-xs text-muted leading-relaxed">{explication.texte}</p>
      </div>
    </section>
  );
}
