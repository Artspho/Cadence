/**
 * Contrôles et préparation du fichier AVANT l'envoi au canal d'import assisté par IA.
 *
 * Périmètre volontairement étroit : on ne cherche PAS à comprendre le contenu du document (c'est le
 * travail de Mistral, et une pré-lecture locale ne ferait que produire un second avis, potentiellement
 * contradictoire). On vérifie seulement ce qui condamnerait l'envoi d'avance — mauvais format, fichier
 * vide, trop gros pour la plateforme. Refuser tôt et clairement vaut mieux qu'un échec obscur après
 * plusieurs secondes d'attente, ou qu'un document envoyé pour rien.
 *
 * `validerFichierPourEnvoiIA` est pure et testée. `lirePdfEnBase64` dépend de `FileReader` (API
 * navigateur) et n'est donc pas couverte par les tests, qui tournent en environnement `node` —
 * limite assumée, cf. la note dans `__tests__/fichierImportIA.test.ts`.
 */

/**
 * Plafond appliqué au PDF, en octets.
 *
 * D'où vient ce chiffre : le document part en base64 dans le corps de la requête, ce qui gonfle son
 * volume d'environ un tiers (4 octets encodés pour 3 octets réels). Le corps d'une fonction Vercel
 * Edge est plafonné aux alentours de 4 Mo, ce qui laisse à peu près 3 Mo de PDF réel. Au-delà, la
 * requête est rejetée par la plateforme AVANT d'atteindre notre code : sans ce contrôle, l'utilisateur
 * verrait un échec technique sans explication, après avoir attendu l'envoi complet.
 *
 * Marge volontairement conservatrice : mieux vaut refuser un document limite ici, avec un message
 * clair et une alternative, que le laisser partir et échouer côté plateforme.
 */
export const TAILLE_MAX_PDF_OCTETS = 3 * 1024 * 1024;

/** Les seules caractéristiques du fichier qui nous intéressent — testables sans vrai objet `File`. */
export interface FichierCandidat {
  name: string;
  type: string;
  size: number;
}

export type VerdictFichier = { ok: true } | { ok: false; erreur: string };

function enMegaoctets(octets: number): string {
  return (octets / (1024 * 1024)).toFixed(1).replace(".", ",");
}

/**
 * Certains systèmes et certains glisser-déposer ne renseignent pas le type MIME (`type` vide). Se
 * fier uniquement à `type` ferait alors refuser un PDF parfaitement valide ; se fier uniquement à
 * l'extension accepterait n'importe quoi de renommé. On accepte donc le type MIME explicite, ou
 * l'extension quand le type est absent — jamais l'extension contre un type qui dit autre chose.
 */
function estPdf({ name, type }: FichierCandidat): boolean {
  if (type === "application/pdf") return true;
  return type === "" && name.toLowerCase().endsWith(".pdf");
}

export function validerFichierPourEnvoiIA(fichier: FichierCandidat): VerdictFichier {
  if (!estPdf(fichier)) {
    return {
      ok: false,
      erreur: "Seuls les fichiers PDF peuvent être envoyés. Rien n'a été envoyé — choisis un PDF, ou saisis les informations à la main.",
    };
  }

  if (fichier.size === 0) {
    return {
      ok: false,
      erreur: "Ce fichier est vide (0 octet). Rien n'a été envoyé — vérifie le document, ou saisis les informations à la main.",
    };
  }

  if (fichier.size > TAILLE_MAX_PDF_OCTETS) {
    return {
      ok: false,
      erreur:
        `Ce PDF pèse ${enMegaoctets(fichier.size)} Mo, au-delà de la limite de ${enMegaoctets(TAILLE_MAX_PDF_OCTETS)} Mo ` +
        `que le service peut recevoir. Rien n'a été envoyé. Tu peux réduire le document (moins de pages, ou une numérisation ` +
        `moins lourde), ou saisir les informations à la main.`,
    };
  }

  return { ok: true };
}

/**
 * Convertit le PDF en base64 pour le corps de la requête.
 *
 * `readAsDataURL` plutôt qu'un parcours manuel de `ArrayBuffer` : la conversion octet par octet via
 * `String.fromCharCode(...octets)` dépasse la taille maximale de la pile d'appels sur un fichier de
 * plusieurs mégaoctets, et la version en tranches est du code à ne pas se tromper pour aucun gain.
 * `FileReader` fait ce travail nativement.
 *
 * Renvoie la charge base64 SEULE, sans le préfixe `data:application/pdf;base64,` — c'est ce
 * qu'attend `api/extract-document.ts`, qui reconstruit lui-même la data URI côté serveur.
 */
export function lirePdfEnBase64(fichier: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onerror = () =>
      rejeter(new Error("Ce fichier n'a pas pu être lu sur ton appareil. Rien n'a été envoyé — réessaie, ou saisis les informations à la main."));
    lecteur.onload = () => {
      const resultat = lecteur.result;
      if (typeof resultat !== "string") {
        rejeter(new Error("Ce fichier n'a pas pu être préparé pour l'envoi. Rien n'a été envoyé."));
        return;
      }
      // "data:application/pdf;base64,JVBERi0..." → on ne garde que ce qui suit la virgule.
      const separateur = resultat.indexOf(",");
      if (separateur === -1) {
        rejeter(new Error("Ce fichier n'a pas pu être préparé pour l'envoi. Rien n'a été envoyé."));
        return;
      }
      resoudre(resultat.slice(separateur + 1));
    };
    lecteur.readAsDataURL(fichier);
  });
}
