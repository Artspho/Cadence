// Salaire de référence (SR), nombre d'heures travaillées (NHT) et salaire
// aménagé (SAR) — les grandeurs qui alimentent LE MONTANT de l'ARE.
//
// Rappel du piège (cf. decompteHeures.ts) : SR et NHT excluent TOTALEMENT
// l'enseignement et la formation, y compris leurs salaires. Ne jamais
// réutiliser le total "heuresPour507" ici.
import type { Contrat, PeriodeAssimilee, Profil, SalaireReferenceResultat } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { dansIntervalle, diffJours } from "./dateUtils";
import { calculerDecompteHeures, joursAssimilesHorsContrat, type Fenetre } from "./decompteHeures";

/**
 * Types de périodes assimilées ouvrant droit à l'aménagement du SAR.
 *
 * ✅ VÉRIFIÉ au guide France Travail (p. 11-12, relecture du 29/07/2026) : maternité, adoption et ALD
 * sont les **trois seuls** types qui aménagent le salaire de référence. L'exclusion de
 * `accident_travail` et de `suspension_contrat` n'est donc PAS une supposition faute de mention — le
 * guide les énumère limitativement. Ne pas réintroduire ces deux types « par symétrie ».
 */
const TYPES_OUVRANT_SAR = new Set(["maternite", "adoption", "ald"]);

export function calculerSalaireReference(
  contrats: Contrat[],
  periodes: PeriodeAssimilee[],
  profil: Profil,
  config: FranceTravailConfig,
  fenetre: Fenetre,
): SalaireReferenceResultat {
  const contratsRetenus = contrats.filter(
    (c) => dansIntervalle(c.date, fenetre.dateDebut, fenetre.dateFin) && c.type !== "enseignement" && c.type !== "formation",
  );
  const sr = contratsRetenus.reduce((total, c) => total + c.salaireBrut, 0);

  const decompte = calculerDecompteHeures(contrats, periodes, profil, config, fenetre);
  const nht = decompte.repartition.cachets + decompte.repartition.heuresScene + decompte.repartition.eee + decompte.repartition.ptp + decompte.repartition.assimilees;

  // MÊME EXCLUSION QUE LE DÉCOMPTE DES HEURES, et pour un motif encore plus direct : ici les jours de
  // période sont SOUSTRAITS du dénominateur. Compter un jour travaillé comme jour de période rétrécit
  // le dénominateur, donc GONFLE le SAR, donc l'allocation journalière — un faux montant, pas
  // seulement un faux compteur (corrigé le 29/07/2026, même cause racine que
  // `joursAssimilesHorsContrat`).
  //
  // Les contrats considérés sont ceux de la fenêtre TOUS TYPES CONFONDUS, enseignement inclus — et non
  // `contratsRetenus` qui les écarte. La question posée n'est pas « ce contrat alimente-t-il le SR ? »
  // mais « ce jour a-t-il été travaillé ? » : un jour de cours est un jour sous contrat, donc pas un
  // jour de période assimilée hors contrat, même si son salaire est exclu du SR.
  const contratsDeLaFenetre = contrats.filter((c) => dansIntervalle(c.date, fenetre.dateDebut, fenetre.dateFin));
  const joursPeriodeAssimileesRetenues = periodes
    .filter((p) => TYPES_OUVRANT_SAR.has(p.type))
    .reduce((total, p) => total + joursAssimilesHorsContrat(p, fenetre, contratsDeLaFenetre), 0);

  const joursPeriodeReference = diffJours(fenetre.dateDebut, fenetre.dateFin) + 1;
  const denominateurSAR = joursPeriodeReference - joursPeriodeAssimileesRetenues;

  const sar = joursPeriodeAssimileesRetenues > 0 && denominateurSAR > 0 ? (sr / denominateurSAR) * joursPeriodeReference : null;

  return { sr, nht, sar, joursPeriodeAssimileesRetenues };
}
