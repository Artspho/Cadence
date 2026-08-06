// Petit indicateur animé, pour les attentes de plusieurs secondes (extraction pdfjs, appel IA) qui
// n'affichaient jusqu'ici qu'un texte statique — au premier coup d'œil indistinguable d'un plantage.
export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-line border-t-mint ${className}`} aria-hidden="true" />;
}
