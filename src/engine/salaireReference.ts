// Salaire de référence (SR), nombre d'heures travaillées (NHT) et salaire
// aménagé (SAR) — les grandeurs qui alimentent LE MONTANT de l'ARE.
//
// Rappel du piège (cf. decompteHeures.ts) : SR et NHT excluent TOTALEMENT
// l'enseignement et la formation, y compris leurs salaires. Ne jamais
// réutiliser le total "heuresPour507" ici.
import type { Contrat, PeriodeAssimilee, Profil, SalaireReferenceResultat } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { dansIntervalle, diffJours, joursChevauchement } from "./dateUtils";
import { calculerDecompteHeures, type Fenetre } from "./decompteHeures";

/** Types de périodes assimilées ouvrant droit à l'aménagement du SAR (§6.3 du prompt produit) — pas suspension_contrat ni accident_travail, qui n'y sont pas mentionnés explicitement. */
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

  const joursPeriodeAssimileesRetenues = periodes
    .filter((p) => TYPES_OUVRANT_SAR.has(p.type))
    .reduce((total, p) => total + joursChevauchement(p.dateDebut, p.dateFin, fenetre.dateDebut, fenetre.dateFin), 0);

  const joursPeriodeReference = diffJours(fenetre.dateDebut, fenetre.dateFin) + 1;
  const denominateurSAR = joursPeriodeReference - joursPeriodeAssimileesRetenues;

  const sar = joursPeriodeAssimileesRetenues > 0 && denominateurSAR > 0 ? (sr / denominateurSAR) * joursPeriodeReference : null;

  return { sr, nht, sar, joursPeriodeAssimileesRetenues };
}
