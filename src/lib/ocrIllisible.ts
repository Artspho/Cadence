/**
 * Distingue un échec technique de lecture (OCR vide) d'un document normalement lu mais sans donnée
 * exploitable (`non_reconnu` / 0 proposition légitime). Trouvé le 30/07/2026 : un bulletin GHS-
 * sPAIEctacle envoyé en production a produit un texte OCR vide côté Mistral, mais l'app l'a affiché
 * exactement comme un document lu normalement sans rien à en tirer — l'utilisateur n'a aucun moyen
 * de distinguer les deux, alors que la bonne action est différente (réessayer avec un export PDF
 * différent, pas ressaisir manuellement en croyant le document sans intérêt).
 *
 * Forme de `pages` : réponse de l'endpoint Mistral OCR (`/v1/ocr`), `response.pages[].markdown`
 * porte le texte brut extrait par page (confirmé contre la doc officielle Mistral, 01/08/2026 —
 * https://docs.mistral.ai/studio-api/document-processing/basic_ocr). ⚠️ Ce que fait ce champ
 * précisément sur un document illisible (chaîne vide ? absent ? un placeholder ?) N'EST PAS
 * documenté par Mistral et N'A PAS pu être reproduit ici (pas d'accès à l'appel qui a échoué le
 * 30/07, ni trace conservée de la réponse brute) — cf. CLAUDE.md pour le détail de ce qui a été
 * vérifié vs déduit. Le seuil ci-dessous est donc une valeur prudente, non calibrée sur un vrai cas,
 * à resserrer ou desserrer si un futur échec réel le contredit.
 *
 * Volontairement permissif sur toute forme inattendue de `pages` (absent, pas un tableau, vide) :
 * ne JAMAIS transformer une incertitude sur la forme de la réponse en faux blocage d'un document
 * qui aurait pu être lu correctement — cf. devoir n°2, un faux échec est aussi trompeur qu'un faux
 * succès.
 */
export function texteOcrIllisible(pages: unknown, seuilCaracteres = 20): boolean {
  if (!Array.isArray(pages) || pages.length === 0) return false;

  const totalCaracteres = pages.reduce((total: number, page: unknown) => {
    const markdown = typeof page === "object" && page !== null && "markdown" in page ? (page as { markdown: unknown }).markdown : "";
    return total + (typeof markdown === "string" ? markdown.trim().length : 0);
  }, 0);

  return totalCaracteres < seuilCaracteres;
}
