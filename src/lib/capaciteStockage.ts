// Point 2 de docs/critique_2026-08-03.md, part manquante : savoir AVANT d'écrire si ça va tenir, et
// pouvoir dire ce qui occupe la place. Aucune règle métier ici, uniquement de la mesure.
//
// POURQUOI CE FICHIER EXISTE. Le filet posé le 03/08 attrape l'échec d'écriture APRÈS coup : il dit
// « ça n'a pas été enregistré », ce qui est déjà l'essentiel (devoir n°1), mais ne dit ni pourquoi, ni
// ce qui remplit le stockage, ni comment faire de la place. Or la cause de saturation est identifiée
// et mesurée (04/08/2026) : les justificatifs de dépenses sont stockés **en base64 dans le
// localStorage** (`justificatifData`, types/fraisReels.ts), avec une limite de 5 Mo par FICHIER —
// et le base64 gonfle de +33 %, donc un justificatif de 5 Mo occupe ~6,7 Mo à lui seul. À côté, les
// 62 contrats réels de Benoît pèsent 23 Ko. La saturation ne viendra jamais des contrats.
// (Le chantier de fond — sortir les justificatifs vers Google Workspace ou une base en plan payant,
// décision de Benoît le 04/08/2026, IndexedDB écarté — est SÉPARÉ. Ce fichier est le filet d'attente.)
//
// CE QUI EST MESURÉ, ET CE QUI NE PEUT PAS L'ÊTRE. L'occupation est exactement mesurable : c'est la
// somme des longueurs de clés et de valeurs. Le PLAFOND, non : aucun navigateur ne l'expose de façon
// fiable pour le localStorage (`navigator.storage.estimate()` renvoie le quota de TOUTE l'origine,
// toutes technologies confondues, et le localStorage a son propre sous-plafond). D'où le choix
// suivant, qui est tout le sujet de ce fichier :
//
//   ❌ ne JAMAIS prédire la saturation à partir d'un seuil deviné (« au-delà de 4 Mo, attention »).
//      Ce serait afficher un avertissement qu'aucune mesure ne soutient — un faux avertissement est
//      un faux affichage (devoir n°2), et le projet en a déjà supprimé un pour ce motif exact
//      (bannière « Règles à vérifier », point 13).
//   ✅ ESSAYER pour de vrai, sur une clé temporaire, puis nettoyer. Si l'écriture d'essai échoue,
//      la place manque : c'est un fait constaté, pas une extrapolation.
export interface OccupationCle {
  cle: string;
  octets: number;
}

export interface OccupationStockage {
  totalOctets: number;
  /** Clés triées de la plus volumineuse à la plus légère : l'ordre dans lequel on veut les montrer. */
  parCle: OccupationCle[];
}

/**
 * Interface minimale d'un stockage — permet de tester ces fonctions sans DOM ni jsdom (le reste du
 * moteur est testé de la même manière : des fonctions pures, un faux objet en entrée).
 */
export type StockageMesurable = Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key">;

/**
 * Occupation réelle du stockage, clé par clé. Ne lève jamais : un stockage inaccessible (navigation
 * privée verrouillée) renvoie une occupation vide plutôt que de faire tomber l'écran qui l'affiche —
 * cet écran est justement celui qu'on voit quand tout va mal.
 *
 * L'unité est le caractère JavaScript, pas l'octet UTF-8 : c'est l'unité dans laquelle les navigateurs
 * comptent leur propre quota de localStorage (chaque caractère y occupe 2 octets, la conversion serait
 * donc trompeuse dans les deux sens). Le nom `octets` est conservé parce que c'est ce que l'utilisateur
 * lit, et l'ordre de grandeur est le bon.
 */
export function mesurerOccupation(stockage: StockageMesurable): OccupationStockage {
  const parCle: OccupationCle[] = [];
  try {
    for (let i = 0; i < stockage.length; i += 1) {
      const cle = stockage.key(i);
      if (cle === null) continue;
      const valeur = stockage.getItem(cle) ?? "";
      parCle.push({ cle, octets: cle.length + valeur.length });
    }
  } catch {
    return { totalOctets: 0, parCle: [] };
  }
  parCle.sort((a, b) => b.octets - a.octets);
  return { totalOctets: parCle.reduce((t, c) => t + c.octets, 0), parCle };
}

/** Clé d'essai, retirée systématiquement — jamais laissée derrière, même si l'essai échoue. */
const CLE_ESSAI = "cadence:v1:__essai_capacite__";

/**
 * `true` si une charge de cette taille tient ENCORE dans le stockage, constaté en l'écrivant vraiment
 * puis en la retirant.
 *
 * ⚠️ À n'utiliser que pour une charge réellement ADDITIONNELLE — un nouveau justificatif, typiquement.
 * Ne PAS s'en servir avant de réécrire une clé existante : l'essai réclame la place totale de la
 * nouvelle valeur alors que la réécriture ne consomme que la différence, et il refuserait donc une
 * écriture qui aurait tenu. Refuser à tort, c'est mentir aussi.
 *
 * `sauvegarderDonnees` (storage/localStorageAdapter.ts) n'utilise donc PAS cette fonction : elle
 * tente l'écriture et rapporte l'échec, ce qui ne peut jamais produire de refus injustifié.
 */
export function chargeAdditionnelleTiendrait(charge: string, stockage: StockageMesurable): boolean {
  try {
    stockage.setItem(CLE_ESSAI, charge);
    return true;
  } catch {
    return false;
  } finally {
    try {
      stockage.removeItem(CLE_ESSAI);
    } catch {
      // Rien à faire de plus : si même le retrait échoue, l'essai n'a de toute façon pas été écrit.
    }
  }
}

/** Taille lisible par un humain, à une décimale à partir du Ko (« 6,7 Mo », « 23,1 Ko », « 512 o »). */
export function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1).replace(".", ",")} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
