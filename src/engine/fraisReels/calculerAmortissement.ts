// Amortissement linéaire d'un bien professionnel (catégorie C7, cf. spec §7) — moteur pur, zéro
// React. Source : document SNAM-CGT « Frais professionnels » (mars 2026) / BOFIP
// BOI-RSA-BASE-30-50-30-20170621.
//
// `seuilAmortissementHT` est reçu en paramètre (jamais en dur ici) : le cas ≤ seuil (déduction
// intégrale, pas d'amortissement) est géré ailleurs dans l'appelant ; cette fonction se contente
// de refuser explicitement ce cas plutôt que de produire un résultat silencieusement faux.
export interface ParamsAmortissement {
  prixHT: number;
  dateAchat: string; // ISO "YYYY-MM-DD"
  dureeAns: number; // fourni par l'appelant, jamais deviné ici
  anneeImposition: number; // ex. 2025 pour la déclaration faite en 2026
  tauxPro?: number; // défaut 1.0
}

export interface ResultatAmortissement {
  annuiteDeductible: number; // montant à reporter dans C7
  annuitePleine: number; // avant prorata et tauxPro
  anneeDebut: number;
  anneeFin: number; // anneeDebut + dureeAns - 1
  estPremiereAnnee: boolean;
  estDerniereAnnee: boolean;
  horsScope: boolean; // true si anneeImposition hors [anneeDebut, anneeFin]
  resteAAmortir: number; // prixHT − cumul déduit jusqu'à anneeImposition incluse
}

const arrondi = (valeur: number): number => Math.round(valeur * 100) / 100;

export function calculerAmortissement(params: ParamsAmortissement, seuilAmortissementHT: number): ResultatAmortissement {
  const { prixHT, dateAchat, dureeAns, anneeImposition } = params;
  const tauxPro = params.tauxPro ?? 1.0;

  if (prixHT <= seuilAmortissementHT) {
    throw new Error(`calculerAmortissement : prixHT (${prixHT} €) ≤ ${seuilAmortissementHT} € — déduction intégrale, pas d'amortissement (cas géré ailleurs).`);
  }

  const anneeDebut = Number(dateAchat.slice(0, 4));
  const moisAchat = Number(dateAchat.slice(5, 7));
  const anneeFin = anneeDebut + dureeAns - 1;

  const annuitePleine = prixHT / dureeAns;
  // Mois d'achat compté entier (cf. spec) : achat en juillet (mois 7) -> 6 mois restants (juil. à déc.).
  const moisRestantsAn1 = 13 - moisAchat;
  const annuiteAn1Pleine = (annuitePleine * moisRestantsAn1) / 12;

  const horsScope = anneeImposition < anneeDebut || anneeImposition > anneeFin;
  if (horsScope) {
    return {
      annuiteDeductible: 0,
      annuitePleine: arrondi(annuitePleine),
      anneeDebut,
      anneeFin,
      estPremiereAnnee: false,
      estDerniereAnnee: false,
      horsScope: true,
      resteAAmortir: 0,
    };
  }

  const estPremiereAnnee = anneeImposition === anneeDebut;
  const estDerniereAnnee = anneeImposition === anneeFin;

  // Cumul ARRONDI (pas brut) des annuités des années strictement antérieures à anneeImposition :
  // chaque année passée a réellement été déclarée à un montant arrondi au centime, c'est CE cumul
  // qui doit servir de base au solde de la dernière année — la méthode des arrondis cumulés (round
  // chaque part, jamais la somme brute) garantit que la somme des montants réellement retournés sur
  // toute la durée vaut prixHT exactement au centime près (cf. tests, prixHT non multiple exact de
  // dureeAns).
  let cumulAnneesPrecedentes = 0;
  for (let annee = anneeDebut; annee < anneeImposition; annee++) {
    cumulAnneesPrecedentes += arrondi(annee === anneeDebut ? annuiteAn1Pleine : annuitePleine);
  }

  // Priorité dernière année > première année : si dureeAns = 1 (anneeDebut = anneeFin), le solde
  // couvre la totalité de prixHT, sans prorata — il n'y a pas d'année suivante pour absorber le reste.
  const annuiteAnneeCourante = estDerniereAnnee ? arrondi(prixHT - cumulAnneesPrecedentes) : arrondi(estPremiereAnnee ? annuiteAn1Pleine : annuitePleine);

  return {
    annuiteDeductible: arrondi(annuiteAnneeCourante * tauxPro),
    annuitePleine: arrondi(annuitePleine),
    anneeDebut,
    anneeFin,
    estPremiereAnnee,
    estDerniereAnnee,
    horsScope: false,
    resteAAmortir: arrondi(prixHT - (cumulAnneesPrecedentes + annuiteAnneeCourante)),
  };
}
