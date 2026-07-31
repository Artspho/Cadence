// Découpe la carrière en exercices : des cycles de 12 mois calendaires entre
// deux dates anniversaire (cf. Historique.tsx). Sert aussi de base au suivi
// de l'ancienneté 5 ans / 2535 h utile à la clause de rattrapage.
//
// Simplification MVP : seule la date anniversaire ACTUELLE est connue (le
// modèle Profil ne conserve pas l'historique COMPLET des ouvertures de droits
// précédentes — seule la toute dernière, `dateAnniversairePrecedente`, l'est).
// Les cycles PLUS anciens que celui-là (i >= 2) sont donc encore reconstruits
// par soustraction calendaire de 12 mois successifs, et non à partir des
// vraies dates d'ouverture de droits historiques (cf. §10, backlog V3).
//
// Bug réel corrigé le 31/07/2026 : pour le cycle immédiatement précédent
// (i===1), cette reconstruction calendaire fabriquait un cycle qui n'a parfois
// jamais existé — un renouvellement anticipé ou une extension de réadmission
// peut avoir raccourci ou allongé ce cycle-là, sans que ce soit visible dans
// une simple soustraction de 12 mois (cas réel : cycle réellement long de
// ~300 j, reconstruit à tort comme 365 j pleins, avec des heures et une AJ qui
// ne correspondent à rien de réel). Or `Profil.dateAnniversairePrecedente`
// porte EXACTEMENT la vraie borne dont ce cycle a besoin (la FCT qui l'a
// ouvert, cf. types/index.ts) — déjà saisie pour d'autres besoins (réadmission,
// cf. periodeReference.ts). Quand elle est connue, elle remplace la
// reconstruction calendaire pour ce seul cycle ; sinon, comportement inchangé
// (reconstruction calendaire, cas le plus courant où le cycle précédent a
// bien duré 12 mois pleins).
import { addYears } from "date-fns";
import type { Contrat, Exercice, PeriodeAssimilee, Profil } from "../types";
import type { FranceTravailConfig } from "../config/franceTravailConfig";
import { ajouterJours, diffJours, toDate, toISO } from "./dateUtils";
import { calculerDecompteHeures } from "./decompteHeures";
import { calculerSalaireReference } from "./salaireReference";
import { calculerAJBrute } from "./areBrute";
import { calculerAJNette, calculerSJM } from "./areNette";

const CYCLES_MAX = 10; // profondeur d'historique reconstruite (couvre largement les 5 ans de l'ancienneté)

export function decouperExercices(profil: Profil, contrats: Contrat[], periodes: PeriodeAssimilee[], config: FranceTravailConfig, dateDuJour: string): Exercice[] {
  if (!profil.dateAnniversaire) return []; // première admission : pas encore d'historique de cycles

  const toutesLesDates = [...contrats.map((c) => c.date), ...periodes.map((p) => p.dateDebut)];
  const earliestISO = toutesLesDates.length > 0 ? toutesLesDates.reduce((min, d) => (d < min ? d : min)) : profil.dateAnniversaire;

  const exercices: Exercice[] = [];

  for (let i = 0; i < CYCLES_MAX; i++) {
    const dateFin = toISO(addYears(toDate(profil.dateAnniversaire), -i));
    const borneReelleConnue = i === 1 && Boolean(profil.dateAnniversairePrecedente);
    const dateDebut = borneReelleConnue
      ? ajouterJours(profil.dateAnniversairePrecedente!, 1)
      : ajouterJours(toISO(addYears(toDate(profil.dateAnniversaire), -(i + 1))), 1);

    if (i > 0 && dateFin < earliestISO) break; // plus de données pertinentes au-delà

    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut, dateFin });
    const cloture = diffJours(dateFin, dateDuJour) >= 0; // l'anniversaire de ce cycle est passé

    let ajBrute: number | undefined;
    let ajNette: number | undefined;
    if (cloture && decompte.total > 0) {
      const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, { dateDebut, dateFin });
      const resultatBrut = calculerAJBrute({ salaireRetenu: sar ?? sr, nht, config });
      ajBrute = resultatBrut.brut;
      // Corrigé le 31/07/2026 (cf. App.tsx, même correctif) : SJM sur sar ?? sr, pas sur sr seul.
      const sjm = calculerSJM(sar ?? sr, nht, config);
      ajNette = calculerAJNette(resultatBrut.brut, sjm, profil, config).net;
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

/**
 * Fige les exercices clos pour qu'un import ultérieur ou une nouvelle FCT ne les recalcule plus
 * jamais (bug réel signalé le 31/07/2026 : `decouperExercices` recalculait TOUT à chaque rendu,
 * y compris les cycles déjà clos — un contrat ajouté après coup dans une période déjà close, ou un
 * simple changement de `Profil.dateAnniversaire`, changeait silencieusement l'AJ affichée pour un
 * cycle passé, cf. Historique.tsx).
 *
 * Fonction pure (aucun accès storage ici, cf. SPEC.md §12) : App.tsx lui passe la sortie fraîche de
 * `decouperExercices` et le figé déjà en storage (`DonneesApp.exercicesGeles`), et se charge lui-même
 * de persister `aGeler` (effet de bord, hors de ce module).
 *
 * Règles, dans l'ordre :
 * - déjà figé (id présent dans `exercicesGeles`) → on renvoie TOUJOURS la version figée, jamais la
 *   version fraîchement recalculée, même si elle diffère (c'est précisément ce que "figé" veut dire).
 * - pas encore figé mais `cloture` vient de passer à `true` → on garde la valeur fraîchement calculée
 *   pour l'affichage immédiat, ET on la place dans `aGeler` pour que l'appelant la persiste une fois
 *   pour toutes.
 * - pas clos → toujours la valeur fraîche, recalculée à chaque appel (comportement inchangé).
 */
export function fusionnerExercicesGeles(exercicesCalcules: Exercice[], exercicesGeles: Record<string, Exercice>): { exercices: Exercice[]; aGeler: Exercice[] } {
  const aGeler: Exercice[] = [];
  const exercices = exercicesCalcules.map((exercice) => {
    const gele = exercicesGeles[exercice.id];
    if (gele) return gele;
    if (exercice.cloture) aGeler.push(exercice);
    return exercice;
  });
  return { exercices, aGeler };
}
