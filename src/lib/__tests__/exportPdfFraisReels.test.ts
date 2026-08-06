import { describe, it, expect } from 'vitest';
import {
  genererPdfFraisReels,
  nettoyerPourPdf,
  nomFichierPdf,
  type DossierFraisReels,
  type ProfilDeclarant,
} from '../exportPdfFraisReels';
import type { ResultatFraisReels } from '../../types/fraisReels';
import type { RetourCalculerAmortissementsAnnee } from '../../engine/fraisReels/calculerAmortissementsAnnee';

function profil(overrides: Partial<ProfilDeclarant> = {}): ProfilDeclarant {
  return {
    nom: 'Zahra',
    prenom: 'Benoît',
    adresse: '12 rue des Artistes, 13001 Marseille',
    profession: 'Musicien intermittent du spectacle',
    revenuImposable: 18000,
    anneeImposition: 2025,
    ...overrides,
  };
}

function resultat(overrides: Partial<ResultatFraisReels> = {}): ResultatFraisReels {
  return {
    baseR: 18000,
    montantA: 2520,
    montantB: 900,
    montantC: {},
    totalFraisReels: 3420,
    forfait10Pct: 1800,
    avantage: 1620,
    recommandation: 'frais_reels',
    depensesParCategorie: {},
    ...overrides,
  };
}

function dossierMinimal(overrides: Partial<DossierFraisReels> = {}): DossierFraisReels {
  return {
    profil: profil(),
    resultat: resultat(),
    texteDeclaration:
      'Frais professionnels déduits pour leur montant réel : A. 2 520,00 € — B. 900,00 € — Total 3 420,00 €.',
    justificatifs: [],
    dateGeneration: '2026-07-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('genererPdfFraisReels', () => {
  it('1. génère un Uint8Array non vide pour un dossier minimal', () => {
    const octets = genererPdfFraisReels(dossierMinimal());
    expect(octets).toBeInstanceOf(Uint8Array);
    expect(octets.length).toBeGreaterThan(0);
  });

  it('2. produit un PDF avec une signature %PDF valide', () => {
    const octets = genererPdfFraisReels(dossierMinimal());
    const entete = String.fromCharCode(...octets.slice(0, 4));
    expect(entete).toBe('%PDF');
  });

  it('3. fonctionne avec des amortissements fournis', () => {
    const amortissements: RetourCalculerAmortissementsAnnee = {
      totalDeductible: 240,
      detail: [
        {
          bien: {
            id: 'bien-1',
            designation: 'Violoncelle Jean Lot',
            categorie: 'instrument',
            prixHT: 1200,
            dateAchat: '2023-01-15',
            dureeAns: 5,
            tauxPro: 1,
          },
          resultat: {
            annuiteDeductible: 240,
            annuitePleine: 240,
            anneeDebut: 2023,
            anneeFin: 2027,
            estPremiereAnnee: false,
            estDerniereAnnee: false,
            horsScope: false,
            resteAAmortir: 480,
          },
        },
      ],
      biensFuturs: [],
      biensSoldes: [],
      biensEnCours: [
        {
          id: 'bien-1',
          designation: 'Violoncelle Jean Lot',
          categorie: 'instrument',
          prixHT: 1200,
          dateAchat: '2023-01-15',
          dureeAns: 5,
          tauxPro: 1,
        },
      ],
      aContinuerAnneeSuivante: [],
    };
    const dossier = dossierMinimal({ amortissements });
    const octets = genererPdfFraisReels(dossier);
    expect(octets.length).toBeGreaterThan(0);
  });

  it('4. fonctionne avec fraisKm.c1 plafonné à 40 km', () => {
    const dossier = dossierMinimal({
      fraisKm: {
        c1: {
          descriptif: 'Voiture 5CV, 9 120 km, 200 A/R',
          kmBruts: 9120,
          kmRetenus: 40,
          montantDeductible: 1234.5,
          plafonneA40km: true,
        },
      },
    });
    const octets = genererPdfFraisReels(dossier);
    expect(octets.length).toBeGreaterThan(0);
  });

  it("5. fonctionne avec des justificatifs source 'serveur' et 'local'", () => {
    const dossier = dossierMinimal({
      justificatifs: [
        {
          depenseId: 'dep-1',
          libelle: 'Billet SNCF Paris-Lyon 14/03/2025',
          categorie: 'C2',
          montant: 47.5,
          reference: 'billet-sncf.pdf',
          source: 'serveur',
        },
        {
          depenseId: 'dep-2',
          libelle: 'Facture luthier',
          categorie: 'C7',
          montant: 320,
          reference: 'facture-luthier-2025.pdf',
          source: 'local',
        },
      ],
    });
    const octets = genererPdfFraisReels(dossier);
    expect(octets.length).toBeGreaterThan(0);
  });

  it('6. nomFichierPdf inclut l’année d’imposition', () => {
    const dossier = dossierMinimal({ profil: profil({ anneeImposition: 2025 }) });
    expect(nomFichierPdf(dossier)).toContain('2025');
  });

  it('7. nomFichierPdf slugifie les accents et caractères spéciaux', () => {
    const dossier = dossierMinimal({ profil: profil({ prenom: 'Marie-Hélène' }) });
    const nom = nomFichierPdf(dossier);
    expect(nom).not.toMatch(/[éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]/);
    expect(nom).toMatch(/^frais-reels-2025-Zahra-Marie-Helene\.pdf$/);
  });

  it('8. fonctionne quand resultat.totalFraisReels === 0', () => {
    const dossier = dossierMinimal({
      resultat: resultat({ totalFraisReels: 0, montantA: 0, montantB: 0 }),
    });
    const octets = genererPdfFraisReels(dossier);
    expect(octets.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Encodage — jsPDF encode en WinAnsiEncoding (cf. nettoyerPourPdf) : un seul caractère hors cp1252
// corrompt la LIGNE ENTIÈRE où il apparaît. Ces tests lisent le contenu réellement écrit dans le
// PDF, là où les 8 tests ci-dessus ne vérifiaient que la taille du buffer et l'en-tête %PDF.
// ─────────────────────────────────────────────────────────────────────────

/** Les flux de texte de jsPDF ne sont pas compressés : un décodage latin1 les rend lisibles. */
function texteDuPdf(octets: Uint8Array): string {
  return new TextDecoder('latin1').decode(octets);
}

const CARACTERES_INTERDITS: ReadonlyArray<readonly [string, string]> = [
  [' ', 'espace fine insécable (séparateur de milliers de toLocaleString)'],
  [' ', 'espace fine'],
  ['↔', 'flèche bidirectionnelle ↔'],
  ['⚠', 'panneau d’avertissement ⚠'],
  ['↗', 'flèche oblique ↗'],
];

/** Vérifie l'absence des caractères interdits, décodés en latin1 ET en séquence d'octets UTF-8. */
function attendreAucunCaractereInterdit(octets: Uint8Array) {
  const texte = texteDuPdf(octets);
  const encodeur = new TextEncoder();
  for (const [caractere, description] of CARACTERES_INTERDITS) {
    const sequenceUtf8 = new TextDecoder('latin1').decode(encodeur.encode(caractere));
    expect(texte.includes(caractere), `${description} présent tel quel`).toBe(false);
    expect(texte.includes(sequenceUtf8), `${description} présent en séquence UTF-8`).toBe(false);
  }
}

describe('genererPdfFraisReels — encodage WinAnsi', () => {
  it('9. un montant >= 1000 € utilise une espace ASCII comme séparateur de milliers', () => {
    const dossier = dossierMinimal({
      resultat: resultat({ montantA: 3999.66, montantB: 1428.45, montantC: { C1: 1234.56 }, totalFraisReels: 6662.67 }),
      profil: profil({ revenuImposable: 28569 }),
    });
    const octets = genererPdfFraisReels(dossier);
    const texte = texteDuPdf(octets);

    expect(texte).toContain('1 234,56 €'); // espace ASCII (U+0020), pas U+202F
    expect(texte).toContain('6 662,67 €');
    expect(texte).toContain('28 569,00 €'); // ligne « Revenu imposable »
    attendreAucunCaractereInterdit(octets);
  });

  it('10. le plafonnement kilométrique s’écrit sans le pictogramme ⚠ (bug latent)', () => {
    const dossier = dossierMinimal({
      fraisKm: {
        c1: {
          descriptif: 'Voiture 5 CV, 9 120 km, 200 A/R',
          kmBruts: 9120,
          kmRetenus: 3200,
          montantDeductible: 1234.5,
          plafonneA40km: true,
        },
      },
    });
    const octets = genererPdfFraisReels(dossier);
    const texte = texteDuPdf(octets);

    expect(texte).toContain('[!] Distance > 40 km');
    attendreAucunCaractereInterdit(octets);
  });

  it('11. le libellé C1 n’utilise plus ↔', () => {
    const octets = genererPdfFraisReels(dossierMinimal());
    expect(texteDuPdf(octets)).toContain('Transport domicile <-> travail');
    attendreAucunCaractereInterdit(octets);
  });

  it('12. une espace fine venue d’un module tiers est neutralisée (descriptif de fraisKilometriquesUi)', () => {
    // `descriptifFraisKm` formate les km via toLocaleString('fr-FR') -> U+202F. Ce module ne connaît
    // pas la contrainte WinAnsi : c'est le point de passage unique du PDF qui doit l'absorber.
    const descriptifReel = `Voiture 5 CV, ${(9120).toLocaleString('fr-FR')} km, 200 A/R`;
    expect(descriptifReel).toContain(' '); // le module produit bien le caractère fautif

    const dossier = dossierMinimal({
      fraisKm: { c2: { descriptif: descriptifReel, kmBruts: 9120, kmRetenus: 9120, montantDeductible: 2000, plafonneA40km: false } },
    });
    const octets = genererPdfFraisReels(dossier);

    expect(texteDuPdf(octets)).toContain('9 120 km');
    attendreAucunCaractereInterdit(octets);
  });

  it('13. une saisie utilisateur exotique ne corrompt pas le PDF (désignation, description, identité)', () => {
    const dossier = dossierMinimal({
      profil: profil({ nom: 'Zahra ↗', profession: 'Musicien ⚠ intermittent', adresse: '12 rue des Artistes → Marseille' }),
      justificatifs: [
        { depenseId: 'd1', libelle: 'Facture ✅ luthier', categorie: 'C7', montant: 1320, reference: 'facture ⏳.pdf', source: 'local' },
      ],
      texteDeclaration: 'A - Frais ↔ instrument : 1 234,56 €',
    });
    const octets = genererPdfFraisReels(dossier);
    const texte = texteDuPdf(octets);

    // Assertions POSITIVES : jsPDF ne recrache pas les caractères non supportés tels quels (il les
    // mange en corrompant la ligne), donc vérifier leur seule absence ne prouverait rien. On exige
    // que la traduction lisible soit bien présente.
    expect(texte).toContain('Musicien [!] intermittent');
    expect(texte).toContain('Facture [ok] luthier');
    expect(texte).toContain('facture [...].pdf');
    expect(texte).toContain('A - Frais <-> instrument');
    expect(texte).toContain('12 rue des Artistes -> Marseille');
    attendreAucunCaractereInterdit(octets);
  });
});

describe('nettoyerPourPdf', () => {
  it('préserve les accents et la ponctuation française (ils sont dans cp1252)', () => {
    expect(nettoyerPourPdf('État détaillé — frais réels : 1 234,56 € · déjà validé')).toBe(
      'État détaillé — frais réels : 1 234,56 € · déjà validé',
    );
  });

  it('remplace les espaces typographiques par une espace ASCII', () => {
    expect(nettoyerPourPdf('9 120')).toBe('9 120');
    expect(nettoyerPourPdf('9 120')).toBe('9 120');
  });

  it('traduit les flèches et pictogrammes en équivalents lisibles', () => {
    expect(nettoyerPourPdf('domicile ↔ travail')).toBe('domicile <-> travail');
    expect(nettoyerPourPdf('⚠ attention')).toBe('[!] attention');
    expect(nettoyerPourPdf('⚠️ attention')).toBe('[!] attention'); // variante emoji (U+FE0F)
    expect(nettoyerPourPdf('Drive ↗')).toBe('Drive ');
    expect(nettoyerPourPdf('a → b')).toBe('a -> b');
    expect(nettoyerPourPdf('✅ ok')).toBe('[ok] ok');
  });

  it('replie les caractères décomposables plutôt que de les perdre', () => {
    expect(nettoyerPourPdf('Dvořák')).toBe('Dvorák');
  });

  it('remplace en dernier recours par « ? » plutôt que de supprimer silencieusement', () => {
    expect(nettoyerPourPdf('violoncelle 🎻')).toBe('violoncelle ?');
  });

  it('laisse une chaîne déjà sûre inchangée', () => {
    expect(nettoyerPourPdf('TOTAL FRAIS REELS : 6 662,67 EUR')).toBe('TOTAL FRAIS REELS : 6 662,67 EUR');
  });
});
