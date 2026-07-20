// Écran unique affiché à la place de tout statut/montant dès qu'un profil a
// signalé une activité hors Annexe 10 (garde-fou "situation mixte", §11.A du
// SPEC). Volontairement le SEUL rendu possible dans ce cas — jamais une
// version grisée à côté d'un chiffre, qui resterait un signal ambigu.
export function AvertissementHorsPerimetre() {
  return (
    <div className="bg-surface border border-amber/30 rounded-hero p-8 max-w-[640px] mx-auto text-center space-y-4">
      <span className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-amber/15 text-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
        Hors périmètre
      </span>
      <h2 className="font-display text-xl font-semibold tracking-tight">Ton profil sort de ce que Cadence sait calculer</h2>
      <p className="text-sm text-muted leading-relaxed">
        Cadence est conçu pour les artistes relevant uniquement de l'Annexe 10. Dès qu'il y a aussi du travail technique (Annexe 8) ou un emploi au régime
        général, les règles de calcul changent d'une façon que Cadence ne modélise pas — les estimations pourraient être fausses, on préfère ne pas t'en
        montrer.
      </p>
      <p className="text-sm text-ink font-medium">→ Pour une estimation fiable de tes droits, rapproche-toi de ton conseiller France Travail.</p>
    </div>
  );
}
