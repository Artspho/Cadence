// Découpe la carrière en exercices : des cycles de 12 mois calendaires entre
// deux dates anniversaire (cf. Historique.tsx). Sert aussi de base au suivi
// de l'ancienneté 5 ans / 2535 h utile à la clause de rattrapage.
//
// Simplification MVP historique (allégée le 07/08/2026, cf. juste en dessous) :
// à l'origine, seule la date anniversaire ACTUELLE était connue, et les cycles
// plus anciens (i >= 2) étaient TOUJOURS reconstruits par soustraction
// calendaire de 12 mois successifs plutôt qu'à partir des vraies dates
// d'ouverture de droits historiques (« backlog V3 »). Reste vrai pour tout
// profil sans `historiqueOuvertureDroits` renseigné.
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
//
// Élargi le 07/08/2026 (idée de Benoît) : `Profil.historiqueOuvertureDroits`
// (tableau optionnel, additif) peut désormais couvrir N'IMPORTE QUEL cycle
// passé, pas seulement le précédent — chaque entrée porte SES DEUX bornes
// (`dateOuverture`/`dateEcheance`), jamais déduites d'une soustraction. Une
// entrée qui couvre le même cycle que `dateAnniversairePrecedente` prend le
// pas sur ce repli legacy (plus précise : deux bornes réelles au lieu d'une
// borne + une soustraction d'un an). Absent = comportement bit-à-bit
// identique à avant ce champ (`entreeReelle` toujours `undefined`).
// `Exercice.borneReelle` distingue les deux cas pour l'écran (Historique.tsx),
// qui doit le dire plutôt que de laisser un chiffre approximé sans réserve
// (devoir n°2).
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

  // Le plus récent d'abord (i=1 = le cycle juste avant l'actuel = la 1ère entrée), cf. commentaire
  // de tête. `.sort` sur une copie : jamais de mutation du tableau du profil.
  const historique = [...(profil.historiqueOuvertureDroits ?? [])].sort((a, b) => b.dateEcheance.localeCompare(a.dateEcheance));

  const exercices: Exercice[] = [];

  for (let i = 0; i < CYCLES_MAX; i++) {
    const entreeReelle = i >= 1 ? historique[i - 1] : undefined;
    const repliLegacyConnu = i === 1 && Boolean(profil.dateAnniversairePrecedente);
    const borneReelle = i === 0 || entreeReelle !== undefined || repliLegacyConnu;

    const dateFin = entreeReelle ? entreeReelle.dateEcheance : toISO(addYears(toDate(profil.dateAnniversaire), -i));
    const dateDebut = entreeReelle
      ? entreeReelle.dateOuverture
      : repliLegacyConnu
        ? ajouterJours(profil.dateAnniversairePrecedente!, 1)
        : ajouterJours(toISO(addYears(toDate(profil.dateAnniversaire), -(i + 1))), 1);

    if (i > 0 && dateFin < earliestISO) break; // plus de données pertinentes au-delà

    const decompte = calculerDecompteHeures(contrats, periodes, profil, config, { dateDebut, dateFin });
    const cloture = diffJours(dateFin, dateDuJour) >= 0; // l'anniversaire de ce cycle est passé

    let ajBrute: number | undefined;
    let ajNette: number | undefined;
    if (cloture && decompte.total > 0) {
      const { sr, sar, nht } = calculerSalaireReference(contrats, periodes, profil, config, { dateDebut, dateFin });
      // dateEffet = `dateFin`, la date anniversaire de CE cycle : c'est la FCT qui a ouvert le droit
      // dont on recalcule l'AJ ici, donc la date qui décide du plafond applicable. Un cycle de 2024
      // doit être borné par le plafond de 2024, pas par celui d'aujourd'hui (cf. plafondAreUtils.ts).
      const resultatBrut = calculerAJBrute({ salaireRetenu: sar ?? sr, nht, config, dateEffet: dateFin });
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
      borneReelle,
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
