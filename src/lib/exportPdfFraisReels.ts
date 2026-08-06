// src/lib/exportPdfFraisReels.ts
//
// Génération du PDF du dossier "frais réels" (Q5).
// Client-side uniquement, zéro serveur. Librairie : jsPDF.
// `genererPdfFraisReels` est 100% pure (zéro window / document) et testable.
// `telechargerPdfFraisReels` est le seul wrapper qui touche au navigateur.

import { jsPDF } from 'jspdf';
import type { ResultatFraisReels } from '../types/fraisReels';
import type { RetourCalculerAmortissementsAnnee } from '../engine/fraisReels/calculerAmortissementsAnnee';
import type { ResultatFraisKilometriques } from '../engine/fraisReels/calculerFraisKilometriques';

// ─────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ─────────────────────────────────────────────────────────────────────────

export interface ProfilDeclarant {
  nom: string;
  prenom: string;
  adresse?: string;
  profession: string;
  revenuImposable: number; // base R pour A et B
  anneeImposition: number; // ex. 2025
}

// ⚠️ 'drive' A DISPARU au commit 6 de la phase 6 (05/08/2026, retrait de Google Drive) — remplacé
// par 'serveur' (Supabase Storage). Sans conséquence sur d'anciens PDF déjà générés : ce module ne
// LIT jamais un export passé, il en régénère un neuf à chaque appel depuis l'état courant des dépenses.
export type SourceJustificatif = 'serveur' | 'local';

export interface JustificatifFraisReels {
  depenseId: string;
  libelle: string; // ex. "Billet SNCF Paris-Lyon 14/03/2025"
  categorie: string; // ex. "C2"
  montant: number;
  reference: string; // nom de fichier (tronqué si > 80 car.)
  source: SourceJustificatif;
}

export interface FraisKilometriquesDossier {
  c1?: ResultatFraisKilometriques & { descriptif: string };
  c2?: ResultatFraisKilometriques & { descriptif: string };
}

export interface DossierFraisReels {
  profil: ProfilDeclarant;
  resultat: ResultatFraisReels;
  // Texte prêt à copier-coller (cf. engine/fraisReels.ts, genererTexteDeclaration) — fourni par
  // l'appelant plutôt que recalculé ici : sa génération dépend de ConfigFraisReels (mode
  // forfait/réel de A et B), que ce module de présentation n'a pas besoin de connaître.
  texteDeclaration: string;
  // optionnels — présents uniquement si l'utilisateur a ces modules actifs
  amortissements?: RetourCalculerAmortissementsAnnee;
  fraisKm?: FraisKilometriquesDossier;
  // Justificatifs par dépense — liste fournie par le layer storage (liens uniquement,
  // jamais les fichiers eux-mêmes : cf. décision "liens Drive uniquement")
  justificatifs: JustificatifFraisReels[];
  dateGeneration: string; // ISO
}

// ─────────────────────────────────────────────────────────────────────────
// Constantes de mise en page
// ─────────────────────────────────────────────────────────────────────────

const MARGE_GAUCHE = 15;
const MARGE_DROITE = 195; // A4 = 210mm de large
const HAUT_PAGE = 20;
const BAS_PAGE_UTILE = 275; // au-delà, on saute de page (pied de page réservé en dessous)

const MENTION_GENERATION = (dateFr: string) =>
  `Document généré le ${dateFr} par Cadence · Données traitées 100 % localement`;
const MENTION_SOURCE =
  'Source réglementaire : SNAM-CGT mars 2026 / BOFIP BOI-RSA-BASE-30-50-30-20170621';

// ─────────────────────────────────────────────────────────────────────────
// Assainissement du texte — POINT DE PASSAGE UNIQUE vers le PDF
// ─────────────────────────────────────────────────────────────────────────
//
// jsPDF, avec les polices standard (Helvetica, Courier), encode le texte en **WinAnsiEncoding**
// (cp1252). Tout caractère hors de ce répertoire corrompt la ligne entière où il apparaît — pas
// seulement le caractère lui-même. Sont représentables : l'ASCII imprimable, le Latin-1
// (é, à, ç, ·, ×…) et les extras cp1252 (€, —, ', …) ; ne le sont PAS les flèches, pictogrammes,
// emoji et espaces typographiques.
//
// Plutôt que de corriger au cas par cas, TOUT texte transite par `nettoyerPourPdf` via `ecrire()`
// ci-dessous. C'est indispensable : une partie des chaînes vient de modules qui ne connaissent pas
// cette contrainte (`descriptifFraisKm` produit une espace fine insécable via `toLocaleString`,
// cf. lib/fraisKilometriquesUi.ts) ou de saisies libres de l'utilisateur (désignation d'un bien,
// description d'une dépense, identité), qui peuvent contenir n'importe quoi.
//
// ⚠️ Ne jamais appeler `doc.text()` directement : passer par `ecrire()`.

/** Équivalents lisibles pour les caractères hors cp1252 rencontrés ou plausibles. */
const REMPLACEMENTS_PDF: ReadonlyArray<readonly [RegExp, string]> = [
  [/[     ]/g, ' '], // espaces fine / insécable étroite -> espace ASCII
  [/‑/g, '-'], // trait d'union insécable
  [/−/g, '-'], // signe moins mathématique
  [/↔/g, '<->'],
  [/→/g, '->'],
  [/←/g, '<-'],
  [/[↗↘↖↙]/g, ''], // flèches obliques : purement décoratives
  [/⚠️?/g, '[!]'],
  [/[✅✓✔]️?/g, '[ok]'],
  [/[❌✗✘]️?/g, '[x]'],
  [/⏳️?/g, '[...]'], // ⏳, présent dans les tableaux de suivi de l'utilisateur
];

// Répertoire cp1252 : ASCII imprimable + Latin-1 + les 27 extras de la plage 0x80-0x9F.
const EXTRAS_CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const MOTIF_HORS_CP1252 = `[^\\u0020-\\u007E\\u00A0-\\u00FF${EXTRAS_CP1252}]`;

/**
 * Rend une chaîne sûre pour les polices standard de jsPDF. Les accents et la ponctuation française
 * sont PRÉSERVÉS (ils sont dans cp1252) ; seuls les caractères non représentables sont traduits.
 * Filet de sécurité final : décomposition Unicode (ā -> a), puis `?` en dernier recours — on
 * signale la perte plutôt que de supprimer silencieusement du texte d'un document fiscal.
 */
export function nettoyerPourPdf(valeur: string): string {
  let texte = valeur;
  for (const [motif, remplacement] of REMPLACEMENTS_PDF) texte = texte.replace(motif, remplacement);

  return texte.replace(new RegExp(MOTIF_HORS_CP1252, 'gu'), (caractere) => {
    const deplie = caractere.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return deplie !== '' && !new RegExp(MOTIF_HORS_CP1252, 'u').test(deplie) ? deplie : '?';
  });
}

/** Unique porte de sortie vers `doc.text` : toute chaîne y est assainie. */
function ecrire(doc: jsPDF, contenu: string, x: number, y: number, options?: { align: 'right' }): void {
  // Seul appel légitime à `doc.text` du fichier.
  doc.text(nettoyerPourPdf(contenu), x, y, options);
}

// ─────────────────────────────────────────────────────────────────────────
// Petits formatteurs (aucune dépendance externe)
// ─────────────────────────────────────────────────────────────────────────

function formatEuro(montant: number): string {
  // `toLocaleString('fr-FR')` sépare les milliers par une espace fine insécable (U+202F), hors
  // cp1252 : tout montant >= 1000 corromprait la ligne. Ramenée à une espace ASCII à la source,
  // en plus du filet de `nettoyerPourPdf`.
  const montantFormate = montant
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[   ]/g, ' ');
  return `${montantFormate} €`;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const jj = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const aaaa = d.getUTCFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

function formatMoisAnneeFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${mm}/${d.getUTCFullYear()}`;
}

/** Slug basique : enlève accents et caractères spéciaux, garde des tirets. */
function slug(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nom de fichier du PDF téléchargé : frais-reels-[annee]-[NOM]-[PRENOM].pdf */
export function nomFichierPdf(dossier: DossierFraisReels): string {
  const { nom, prenom, anneeImposition } = dossier.profil;
  return `frais-reels-${anneeImposition}-${slug(nom)}-${slug(prenom)}.pdf`;
}

// ─────────────────────────────────────────────────────────────────────────
// Lignes du formulaire (miroir SNAM-CGT)
// ─────────────────────────────────────────────────────────────────────────

interface LigneFormulaire {
  code: string;
  libelle: string;
  montant: number;
}

function lignesFormulaire(resultat: ResultatFraisReels): LigneFormulaire[] {
  const montantC = (categorie: string): number => resultat.montantC[categorie] ?? 0;
  return [
    { code: 'A', libelle: 'Frais instrument(s)/formation/médicaux — 14 % de R', montant: resultat.montantA },
    { code: 'B', libelle: 'Frais vestimentaires, représentation… — 5 % de R', montant: resultat.montantB },
    { code: 'C1', libelle: 'Transport domicile <-> travail', montant: montantC('C1') },
    { code: 'C2', libelle: 'Autres frais de transport', montant: montantC('C2') },
    { code: 'C3', libelle: 'Frais supplémentaires de repas sur le lieu de travail', montant: montantC('C3') },
    { code: 'C4', libelle: 'Frais de repas et d’hébergement en déplacement', montant: montantC('C4') },
    { code: 'C5', libelle: 'Frais de formation et de documentation', montant: montantC('C5') },
    { code: 'C6', libelle: 'Frais de local professionnel', montant: montantC('C6') },
    { code: 'C7', libelle: 'Matériel, mobilier et fournitures', montant: montantC('C7') },
    { code: 'C8', libelle: 'Cotisations professionnelles', montant: montantC('C8') },
    { code: 'C9', libelle: 'Autres frais', montant: montantC('C9') },
    { code: 'D', libelle: 'Frais pour recherche d’emploi', montant: montantC('D') },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Construction du PDF
// ─────────────────────────────────────────────────────────────────────────

function ajouterPageRecapitulatif(doc: jsPDF, dossier: DossierFraisReels): void {
  const { profil, resultat } = dossier;
  let y = HAUT_PAGE;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  ecrire(doc,`ÉTAT DÉTAILLÉ DES FRAIS PROFESSIONNELS — ${profil.anneeImposition}`, MARGE_GAUCHE, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  ecrire(doc,`Nom : ${profil.nom} ${profil.prenom}`, MARGE_GAUCHE, y);
  ecrire(doc,`Profession : ${profil.profession}`, 120, y);
  y += 6;
  ecrire(doc,`Adresse : ${profil.adresse ?? '—'}`, MARGE_GAUCHE, y);
  ecrire(doc,`Revenu imposable : ${formatEuro(profil.revenuImposable)}`, 120, y);
  y += 10;

  doc.setDrawColor(180);
  doc.line(MARGE_GAUCHE, y, MARGE_DROITE, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  ecrire(doc,'Nature des frais', MARGE_GAUCHE, y);
  ecrire(doc,'Montant', MARGE_DROITE, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(180);
  doc.line(MARGE_GAUCHE, y, MARGE_DROITE, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  for (const ligne of lignesFormulaire(resultat)) {
    ecrire(doc,`${ligne.code}. ${ligne.libelle}`, MARGE_GAUCHE, y);
    ecrire(doc,formatEuro(ligne.montant), MARGE_DROITE, y, { align: 'right' });
    y += 6;
  }

  y += 2;
  doc.setDrawColor(60);
  doc.line(MARGE_GAUCHE, y, MARGE_DROITE, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  ecrire(doc,'TOTAL DES FRAIS DÉDUITS', MARGE_GAUCHE, y);
  ecrire(doc,formatEuro(resultat.totalFraisReels), MARGE_DROITE, y, { align: 'right' });
}

function aBesoinPageDetails(dossier: DossierFraisReels): boolean {
  return (
    (dossier.amortissements?.biensEnCours?.length ?? 0) > 0 ||
    Boolean(dossier.fraisKm?.c1) ||
    Boolean(dossier.fraisKm?.c2) ||
    dossier.justificatifs.length > 0
  );
}

function ajouterPageDetails(doc: jsPDF, dossier: DossierFraisReels): void {
  let y = HAUT_PAGE;

  const biensEnCoursDetail = (dossier.amortissements?.detail ?? []).filter((d) => !d.resultat.horsScope);
  if (biensEnCoursDetail.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    ecrire(doc,'PLAN D’AMORTISSEMENT — BIENS EN COURS', MARGE_GAUCHE, y);
    y += 7;
    doc.setFontSize(9);
    ecrire(doc,'Bien', MARGE_GAUCHE, y);
    ecrire(doc,'Achat', 90, y);
    ecrire(doc,'Durée', 115, y);
    ecrire(doc,'Annuité', 140, y);
    ecrire(doc,'Fin', 165, y);
    ecrire(doc,'Reste', MARGE_DROITE, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    for (const { bien, resultat } of biensEnCoursDetail) {
      if (y > BAS_PAGE_UTILE) {
        doc.addPage();
        y = HAUT_PAGE;
      }
      ecrire(doc,bien.designation, MARGE_GAUCHE, y);
      ecrire(doc,formatMoisAnneeFr(bien.dateAchat), 90, y);
      ecrire(doc,`${bien.dureeAns} ans`, 115, y);
      ecrire(doc,formatEuro(resultat.annuiteDeductible), 140, y);
      ecrire(doc,String(resultat.anneeFin), 165, y);
      ecrire(doc,formatEuro(resultat.resteAAmortir), MARGE_DROITE, y, { align: 'right' });
      y += 6;
    }
    y += 6;
  }

  const { c1, c2 } = dossier.fraisKm ?? {};
  if (c1 || c2) {
    if (y > BAS_PAGE_UTILE - 20) {
      doc.addPage();
      y = HAUT_PAGE;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    ecrire(doc,'DÉTAIL KILOMÉTRIQUE', MARGE_GAUCHE, y);
    y += 7;
    doc.setFontSize(9);

    if (c1) {
      doc.setFont('helvetica', 'normal');
      ecrire(doc, `C1 — Domicile <-> travail : ${c1.descriptif}`, MARGE_GAUCHE, y);
      y += 5;
      ecrire(doc,`KM retenus : ${c1.kmRetenus} km   |   Montant : ${formatEuro(c1.montantDeductible)}`, MARGE_GAUCHE, y);
      y += 5;
      if (c1.plafonneA40km) {
        ecrire(doc, '[!] Distance > 40 km — plafonnée à 40 km aller', MARGE_GAUCHE, y);
        y += 5;
      }
      y += 2;
    }
    if (c2) {
      ecrire(doc,`C2 — Autres trajets : ${c2.descriptif}`, MARGE_GAUCHE, y);
      y += 5;
      ecrire(doc,`KM retenus : ${c2.kmRetenus} km   |   Montant : ${formatEuro(c2.montantDeductible)}`, MARGE_GAUCHE, y);
      y += 5;
      if (c2.plafonneA40km) {
        ecrire(doc, '[!] Distance > 40 km — plafonnée à 40 km aller', MARGE_GAUCHE, y);
        y += 5;
      }
    }
    y += 6;
  }

  if (dossier.justificatifs.length > 0) {
    if (y > BAS_PAGE_UTILE - 20) {
      doc.addPage();
      y = HAUT_PAGE;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    ecrire(doc,'JUSTIFICATIFS À TENIR À DISPOSITION DU FISC', MARGE_GAUCHE, y);
    y += 7;
    doc.setFontSize(9);
    ecrire(doc,'Réf.', MARGE_GAUCHE, y);
    ecrire(doc,'Libellé', 35, y);
    ecrire(doc,'Catég.', 125, y);
    ecrire(doc,'Montant', 145, y);
    ecrire(doc,'Source', MARGE_DROITE, y, { align: 'right' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    dossier.justificatifs.forEach((j, i) => {
      if (y > BAS_PAGE_UTILE) {
        doc.addPage();
        y = HAUT_PAGE;
      }
      const reference = j.reference.length > 80 ? `${j.reference.slice(0, 77)}...` : j.reference;
      ecrire(doc,String(i + 1).padStart(3, '0'), MARGE_GAUCHE, y);
      ecrire(doc,j.libelle, 35, y);
      ecrire(doc,j.categorie, 125, y);
      ecrire(doc,formatEuro(j.montant), 145, y);
      // Pas de flèche « lien externe » ici : un PDF imprimé n'est pas cliquable, et la référence
      // complète figure déjà sur la ligne juste en dessous.
      ecrire(doc, j.source === 'serveur' ? 'Serveur' : 'Local', MARGE_DROITE, y, { align: 'right' });
      y += 5;
      doc.setFontSize(7);
      doc.setTextColor(120);
      ecrire(doc,reference, 35, y);
      doc.setTextColor(0);
      doc.setFontSize(9);
      y += 5;
    });

    y += 4;
    const annee = dossier.profil.anneeImposition;
    doc.setFontSize(9);
    ecrire(doc,`Délai de conservation : jusqu'au 31/12/${annee + 3}`, MARGE_GAUCHE, y);
  }
}

function ajouterPageTexteDeclaration(doc: jsPDF, dossier: DossierFraisReels): void {
  let y = HAUT_PAGE;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  ecrire(doc,'TEXTE À COPIER-COLLER DANS LA CASE DE DÉCLARATION EN LIGNE', MARGE_GAUCHE, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  ecrire(doc,'(case "Détail des frais réels" sur impots.gouv.fr)', MARGE_GAUCHE, y);
  y += 8;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  const largeurUtile = MARGE_DROITE - MARGE_GAUCHE;
  // Assaini AVANT le découpage : les largeurs sont mesurées sur le texte réellement écrit, et les
  // lignes produites repassent de toute façon par `ecrire()`.
  const lignes: string[] = doc.splitTextToSize(nettoyerPourPdf(dossier.texteDeclaration ?? ''), largeurUtile);
  for (const ligne of lignes) {
    if (y > BAS_PAGE_UTILE) {
      doc.addPage();
      y = HAUT_PAGE;
    }
    ecrire(doc,ligne, MARGE_GAUCHE, y);
    y += 5;
  }
}

function ajouterPiedDePage(doc: jsPDF, dossier: DossierFraisReels): void {
  const dateFr = formatDateFr(dossier.dateGeneration);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130);
  ecrire(doc,MENTION_GENERATION(dateFr), MARGE_GAUCHE, 288);
  ecrire(doc,MENTION_SOURCE, MARGE_GAUCHE, 292);
  doc.setTextColor(0);
}

/**
 * Génère le PDF en mémoire. Fonction pure, testable : ne touche ni à
 * `window` ni à `document`.
 */
export function genererPdfFraisReels(dossier: DossierFraisReels): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  ajouterPageRecapitulatif(doc, dossier);

  if (aBesoinPageDetails(dossier)) {
    doc.addPage();
    ajouterPageDetails(doc, dossier);
  }

  doc.addPage();
  ajouterPageTexteDeclaration(doc, dossier);

  const nbPages = doc.getNumberOfPages();
  for (let i = 1; i <= nbPages; i++) {
    doc.setPage(i);
    ajouterPiedDePage(doc, dossier);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Déclenche le téléchargement du PDF dans le navigateur.
 * Seule fonction du fichier qui touche à `window` / `document` — non testée
 * en Vitest (pas de DOM).
 */
export function telechargerPdfFraisReels(dossier: DossierFraisReels): void {
  const octets = genererPdfFraisReels(dossier);
  const nomFichier = nomFichierPdf(dossier);
  const blob = new Blob([octets as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
