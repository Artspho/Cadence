// Extraction locale de bulletins de paie PDF (pdfjs-dist). Tout se passe
// dans le navigateur : aucune donnée ne quitte l'appareil.
//
// Rappel important affiché côté UI (ImportBulletins.tsx) : la pièce qui
// fait foi auprès de France Travail est l'AEM (Attestation Employeur
// Mensuelle), pas le bulletin de paie. Cet import sert uniquement au suivi
// personnel de l'utilisateur.
//
// Il n'existe aucun gabarit standard entre logiciels de paie : cette
// extraction est heuristique (regex) et DOIT toujours être revue par
// l'utilisateur avant enregistrement (cf. BulletinExtrait.confiance).
import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";
import type { BulletinExtrait, Contrat } from "../types";

GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

/** Extrait le texte brut d'un PDF, page par page, concaténé. */
async function extraireTexte(fichier: File): Promise<string> {
  const buffer = await fichier.arrayBuffer();
  const document_ = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= document_.numPages; i++) {
    const page = await document_.getPage(i);
    const contenu = await page.getTextContent();
    pages.push(contenu.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

const REGEX_MONTANT_BRUT = /(brut(?:\s+imposable)?|salaire\s+brut|total\s+brut)\D{0,20}([\d]{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})?)\s*€?/i;
const REGEX_DATE = /(\d{2})[\/.](\d{2})[\/.](\d{4})/;
const REGEX_CACHETS = /(\d+(?:[,.]\d+)?)\s*cachets?/i;
const REGEX_HEURES = /(\d+(?:[,.]\d+)?)\s*h(?:eures)?\b/i;

function parseMontantFr(brut: string): number {
  return parseFloat(brut.replace(/[ .](?=\d{3})/g, "").replace(",", "."));
}

function parseDateFr(jour: string, mois: string, annee: string): string {
  return `${annee}-${mois}-${jour}`;
}

/**
 * Extrait un pré-remplissage de contrat depuis un bulletin PDF. Ne renvoie
 * jamais un contrat "final" : le champ `confiance` doit guider une revue
 * humaine systématique avant tout enregistrement (cf. ImportBulletins.tsx).
 */
export async function extraireBulletin(fichier: File): Promise<BulletinExtrait> {
  const avertissements: string[] = [];
  let texteBrut = "";

  try {
    texteBrut = await extraireTexte(fichier);
  } catch (erreur) {
    avertissements.push("Impossible de lire le texte du PDF (fichier scanné/image ?). Saisie manuelle nécessaire.");
    return { champs: {}, confiance: {}, texteBrut: "", avertissements };
  }

  if (texteBrut.trim().length < 20) {
    avertissements.push("Le PDF ne contient pas de texte exploitable (probablement une image scannée). L'OCR n'est pas activé dans cette version — saisis le contrat manuellement.");
    return { champs: {}, confiance: {}, texteBrut, avertissements };
  }

  const champs: Partial<Contrat> = { source: "import_pdf", territoire: "france" };
  const confiance: Record<string, "haute" | "moyenne" | "faible"> = {};

  const matchMontant = texteBrut.match(REGEX_MONTANT_BRUT);
  if (matchMontant) {
    champs.salaireBrut = parseMontantFr(matchMontant[2]);
    confiance.salaireBrut = "moyenne";
  } else {
    avertissements.push("Montant brut illisible — à vérifier et compléter manuellement.");
  }

  const matchDate = texteBrut.match(REGEX_DATE);
  if (matchDate) {
    champs.date = parseDateFr(matchDate[1], matchDate[2], matchDate[3]);
    confiance.date = "faible"; // plusieurs dates possibles sur un bulletin (période, versement...) : à confirmer
    avertissements.push("Date détectée automatiquement : vérifie qu'il s'agit bien de la date de fin de contrat.");
  } else {
    avertissements.push("Aucune date reconnue — à saisir manuellement.");
  }

  const matchCachets = texteBrut.match(REGEX_CACHETS);
  const matchHeures = texteBrut.match(REGEX_HEURES);
  if (matchCachets) {
    champs.typeRemuneration = "cachet";
    champs.nbCachets = parseFloat(matchCachets[1].replace(",", "."));
    confiance.typeRemuneration = "moyenne";
    confiance.nbCachets = "moyenne";
  } else if (matchHeures) {
    champs.typeRemuneration = "heures";
    champs.nbHeures = parseFloat(matchHeures[1].replace(",", "."));
    confiance.typeRemuneration = "moyenne";
    confiance.nbHeures = "moyenne";
  } else {
    avertissements.push("Nature de la rémunération (cachets ou heures) non détectée — à choisir manuellement.");
  }

  const lignes = texteBrut.split("\n").filter((l) => l.trim().length > 0);
  if (lignes[0] && lignes[0].length < 80) {
    champs.employeur = lignes[0].trim();
    confiance.employeur = "faible";
  }

  champs.type = "artiste"; // valeur par défaut : l'utilisateur confirme ou change en revue
  confiance.type = "faible";

  return { champs, confiance, texteBrut, avertissements };
}
