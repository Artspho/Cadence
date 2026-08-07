/**
 * Pied de page (07/08/2026) : le bandeau réglementaire (« Règles vérifiées le… ») et le lien de
 * feedback vivaient dans `TopBar.tsx`, juste sous le logo — à la demande de Benoît, une information
 * de bas de page n'a rien à faire en haut de l'écran. Rendu une seule fois par `App.tsx`, sous
 * `<main>`, pas par onglet : ce n'est pas un fait qui change avec la page consultée.
 */

import { franceTravailConfig } from "../config/franceTravailConfig";
import { EMAIL_FEEDBACK, construireLienFeedback } from "../config/contact";
import { formaterDateLisible } from "../lib/dateLisible";

export function PiedDePage() {
  return (
    <footer className="max-w-[1040px] mx-auto px-6 pb-24 md:pb-8 w-full flex items-center justify-between gap-3 flex-wrap">
      {/* Une seule date affichée, et c'est bien celle de la dernière vérification — plus
          `dateEntreeVigueur`, qui datait l'entrée en vigueur du SMIC et n'avait rien à faire derrière
          ce libellé (point 14). Chaque source porte sa propre date dans `meta.source`. */}
      <p className="text-[11px] flex items-center gap-1.5 text-faint">
        Règles vérifiées le {formaterDateLisible(franceTravailConfig.meta.dateDerniereVerification)} — {franceTravailConfig.meta.source}
      </p>
      {EMAIL_FEEDBACK && (
        <a href={construireLienFeedback(EMAIL_FEEDBACK)} className="text-[11px] text-faint hover:text-muted transition-colors shrink-0">
          Un avis ? Écris à {EMAIL_FEEDBACK}
        </a>
      )}
    </footer>
  );
}
