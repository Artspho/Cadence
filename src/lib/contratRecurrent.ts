// Génération d'un contrat récurrent d'enseignement (CDD hebdomadaire répétitif sur
// l'année scolaire) : matérialise un Contrat "enseignement" par mois inclus, plutôt
// que de faire dépendre engine/cycles.ts et decompteHeures.ts d'une notion de série.
// Option retenue (cf. docs/reprise.md) : les contrats générés sont des contrats
// normaux et indépendants dès leur création, seulement tagués `recurrenceId` +
// `source: "recurrent"` pour permettre à ContractList.tsx de les regrouper/les
// supprimer ensemble. engine/ n'a besoin d'aucune modification.
import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import type { Contrat } from "../types";

export interface ParametresContratRecurrent {
  employeur: string;
  moisDebut: string; // "YYYY-MM"
  moisFin: string; // "YYYY-MM", inclus
  moisExclus: string[]; // "YYYY-MM" à exclure (vacances, etc.)
  nbHeuresParMois: number;
  salaireBrutParMois: number;
  etablissementAgree: boolean;
  enRapportAvecMetier: boolean;
}

/**
 * Un contrat par mois de [moisDebut, moisFin] hors moisExclus, daté du dernier jour
 * du mois (cohérent avec la convention `Contrat.date` = date de fin de contrat).
 * Si moisFin est avant moisDebut, ou si tous les mois de la plage sont exclus,
 * retourne un tableau vide plutôt que de planter — c'est au formulaire appelant de
 * refuser la soumission dans ce cas (jamais 0 contrat généré silencieusement).
 */
export function genererContratsRecurrents(params: ParametresContratRecurrent, genererId: () => string = () => crypto.randomUUID()): Contrat[] {
  const { employeur, moisDebut, moisFin, moisExclus, nbHeuresParMois, salaireBrutParMois, etablissementAgree, enRapportAvecMetier } = params;
  const exclus = new Set(moisExclus);
  const recurrenceId = genererId();
  const contrats: Contrat[] = [];

  const fin = parseISO(`${moisFin}-01`);
  let curseur = parseISO(`${moisDebut}-01`);
  while (curseur.getTime() <= fin.getTime()) {
    const cle = format(curseur, "yyyy-MM");
    if (!exclus.has(cle)) {
      contrats.push({
        id: genererId(),
        dateDebut: format(curseur, "yyyy-MM-dd"), // premier jour du mois — engagement mensuel complet
        date: format(endOfMonth(curseur), "yyyy-MM-dd"),
        type: "enseignement",
        typeRemuneration: "heures",
        territoire: "france",
        nbHeures: nbHeuresParMois,
        salaireBrut: salaireBrutParMois,
        employeur,
        etablissementAgree,
        enRapportAvecMetier,
        source: "recurrent",
        recurrenceId,
      });
    }
    curseur = addMonths(curseur, 1);
  }

  return contrats;
}

/** Liste des mois ("YYYY-MM") couverts par [moisDebut, moisFin], pour l'aperçu du formulaire (choix des mois à exclure). Vide si moisFin < moisDebut. */
export function listeMoisDeLaPlage(moisDebut: string, moisFin: string): string[] {
  const fin = parseISO(`${moisFin}-01`);
  const mois: string[] = [];
  let curseur = parseISO(`${moisDebut}-01`);
  while (curseur.getTime() <= fin.getTime()) {
    mois.push(format(curseur, "yyyy-MM"));
    curseur = addMonths(curseur, 1);
  }
  return mois;
}
