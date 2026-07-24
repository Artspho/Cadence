// Découpe la carrière en exercices : des cycles de 12 mois calendaires entre
// deux dates anniversaire (cf. Historique.tsx). Sert aussi de base au suivi
// de l'ancienneté 5 ans / 2535 h utile à la clause de rattrapage.
//
// Simplification MVP : seule la date anniversaire ACTUELLE est connue (le
// modèle Profil ne conserve pas l'historique des ouvertures de droits
// précédentes). Les cycles passés sont donc reconstruits par soustraction
// calendaire de 12 mois successifs à partir de cette date, et non à partir
// des vraies dates d'ouverture de droits historiques (cf. §10, backlog V3).
import { addYears } from "date-fns";
import type { Contrat, Exercice, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, diffJours, toDate, toISO } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";
import { calculerSalaireReference } from "./salaireReference";
import { calculerAJBrute } from "./areBrute";
import { calculerAJNette, calculerSJR } from "./areNette";

const CYCLES_MAX = 10; // profondeur d'historique reconstruite (couvre largement les 5 ans de l'ancienneté)

export function decouperExercices(profil: Profil, contrats: Contrat[], periodes: PeriodeAssimilee[], config: FranceTravailConfig, dateDuJour: string): Exercice[] {
  if (!profil.dateAnniversaire) return []; // première admission : pas encore d'historique de cycles

  const toutesLesDates = [...contrats.map((c) => c.date), ...periodes.map((p) => p.dateDebut)];
  const earliestISO = toutesLesDates.length > 0 ? toutesLesDates.reduce((min, d) => (d < min ? d : min)) : profil.dateAnniversaire;

  const exercices: Exercice[] = [];

  for (let i = 0; i < CYCLES_MAX; i++) {
    const dateFin = toISO(addYears(toDate(profil.dateAnniversaire), -i));
    const dateDebut = ajouterJours(toISO(addYears(toDate(profil.dateAnniversaire), -(i + 1))), 1);

    if (i > 0 && dateFin < earliestISO) break; // plus de données pertinentes au-delà

    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut, dateFin });
    const cloture = diffJours(dateFin, dateDuJour) >= 0; // l'anniversaire de ce cycle est passé

    let ajBrute: number | undefined;
    let ajNette: number | undefined;
    if (cloture && decompte.total > 0) {
      const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, { dateDebut, dateFin });
      const resultatBrut = calculerAJBrute({ salaireRetenu: sar ?? sr, nht, config });
      ajBrute = resultatBrut.brut;
      const sjr = calculerSJR(sr, nht, config);
      ajNette = calculerAJNette(resultatBrut.brut, sjr, profil, config).net;
    }

    exercices.push({
      id: `exercice-${dateDebut}-${dateFin}`,
      dateDebut,
      dateAnniversaire: dateFin,
      heuresAtteintes: decompte.total,
      objectifAtteint: decompte.total >= config.seuilHeures,
      ajBrute,
      ajNette,
      cloture,
    });
  }

  return exercices;
}
