// Aide purement présentationnelle pour le barème kilométrique (C1/C2, cf. spec §4/§7). Aucune
// règle de calcul ni valeur réglementaire ici : les tranches viennent de FranceTravailConfig
// (lues telles quelles) et les montants viennent de calculerFraisKilometriques (moteur déjà
// validé, cf. engine/fraisReels/calculerFraisKilometriques.ts, 11 tests) — ce module ne fait que
// dériver des libellés d'affichage et assembler le résultat pour l'export PDF.
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { calculerFraisKilometriques, type ParamsFraisKilometriques, type ResultatFraisKilometriques, type TypeVehicule } from "../engine/fraisReels/calculerFraisKilometriques";
import type { FraisKilometriquesDossier } from "./exportPdfFraisReels";

export const LIBELLE_VEHICULE: Record<TypeVehicule, string> = {
  voiture: "Voiture",
  moto: "Moto",
  cyclomoteur: "Cyclomoteur",
};

export interface OptionPuissanceFiscale {
  cvMax: number;
  libelle: string;
}

/**
 * Tranches de puissance fiscale telles que définies dans le barème existant (aucune tranche
 * inventée ici, seul le libellé est dérivé) — le cyclomoteur n'a pas de puissance fiscale (un
 * seul jeu de coefficients dans le barème), d'où le tableau vide.
 */
export function optionsPuissanceFiscale(type: TypeVehicule, ftConfig: FranceTravailConfig): OptionPuissanceFiscale[] {
  if (type === "cyclomoteur") return [];
  const lignes = type === "voiture" ? ftConfig.fraisReels.baremesKilometriques.voiture.lignes : ftConfig.fraisReels.baremesKilometriques.moto.lignes;
  return lignes.map((ligne, i) => {
    const borneBasse = i === 0 ? 1 : lignes[i - 1].cvMax + 1;
    const estDerniere = i === lignes.length - 1;
    const libelle = estDerniere ? `${borneBasse} CV et plus` : borneBasse === ligne.cvMax ? `${ligne.cvMax} CV` : `${borneBasse}-${ligne.cvMax} CV`;
    return { cvMax: ligne.cvMax, libelle };
  });
}

/**
 * La question "choix personnel" (C1 uniquement, cf. spec §4/Q3) ne se pose que si la distance
 * dépasse le plafond : en-deçà, calculerFraisKilometriques n'entre jamais dans la branche de
 * plafonnement, la question n'a donc aucun effet et ne doit pas être posée.
 */
export function afficherQuestionChoixPersonnel(distanceDomicileTravail: number, ftConfig: FranceTravailConfig): boolean {
  return distanceDomicileTravail > ftConfig.fraisReels.baremesKilometriques.plafondC1AllerKm;
}

function libelleVehiculeDescriptif(vehicule: ParamsFraisKilometriques["vehicule"]): string {
  const base = LIBELLE_VEHICULE[vehicule.type];
  const puissance = vehicule.type !== "cyclomoteur" && vehicule.puissanceFiscale ? ` ${vehicule.puissanceFiscale} CV` : "";
  const electrique = vehicule.type === "voiture" && vehicule.motorisation === "electrique" ? " électrique" : "";
  return `${base}${puissance}${electrique}`;
}

/**
 * Texte prêt pour le PDF (cf. exportPdfFraisReels.ts, champ `descriptif` de
 * `ResultatFraisKilometriques & { descriptif }`) — dérivé uniquement des saisies utilisateur et
 * du résultat moteur (`kmBruts`), aucun montant recalculé ici.
 */
export function descriptifFraisKm(params: ParamsFraisKilometriques, resultat: ResultatFraisKilometriques): string {
  const km = resultat.kmBruts.toLocaleString("fr-FR");
  if (params.trajet.mode === "c1") {
    return `${libelleVehiculeDescriptif(params.vehicule)}, ${km} km, ${params.trajet.nombreAR} A/R`;
  }
  return `${libelleVehiculeDescriptif(params.vehicule)}, ${km} km`;
}

/**
 * Construit `dossier.fraisKm` (cf. exportPdfFraisReels.ts) à partir des saisies persistées
 * (`ConfigFraisReels.fraisKm`) — un bloc que l'utilisateur n'a pas activé reste absent du
 * dossier, jamais un `ResultatFraisKilometriques` à zéro.
 */
export function construireFraisKmDossier(
  saisies: { c1?: ParamsFraisKilometriques; c2?: ParamsFraisKilometriques } | undefined,
  ftConfig: FranceTravailConfig,
): FraisKilometriquesDossier | undefined {
  if (!saisies || (!saisies.c1 && !saisies.c2)) return undefined;

  const dossier: FraisKilometriquesDossier = {};
  if (saisies.c1) {
    const resultat = calculerFraisKilometriques(saisies.c1, ftConfig);
    dossier.c1 = { ...resultat, descriptif: descriptifFraisKm(saisies.c1, resultat) };
  }
  if (saisies.c2) {
    const resultat = calculerFraisKilometriques(saisies.c2, ftConfig);
    dossier.c2 = { ...resultat, descriptif: descriptifFraisKm(saisies.c2, resultat) };
  }
  return dossier;
}
