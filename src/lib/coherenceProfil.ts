import { z } from "zod";
import type { Profil } from "../types";
import { dateIsoEstValide } from "./dateJourMoisAnnee";

export interface ResultatCoherenceProfil {
  coherent: boolean;
  raison?: string;
}

type ChampsCoherence = Pick<Profil, "dateNaissance" | "situation" | "dateAnniversaire" | "dateAnniversairePrecedente" | "ouvertureDroits">;

/**
 * Règle de cohérence transversale entre les champs modifiables du profil (Onboarding + édition
 * post-onboarding, §11.A). Pièges identifiés :
 * - une réadmission sans date anniversaire connue — periodeReference.ts ferait alors tourner
 *   l'extension de réadmission sur une fenêtre fictive "se terminant aujourd'hui", produisant un
 *   seuil ajusté plausible mais faux (devoir n°2). Une première admission sans date est saine (cas
 *   déjà géré par le moteur) ; une première admission AVEC une date renseignée l'est aussi (le
 *   moteur se fie à la présence de la date, pas à `situation`) — aucune autre combinaison n'est
 *   donc bloquée ici.
 * - `dateAnniversaire` antérieure ou égale à `dateAnniversairePrecedente` — signalé par Benoît le
 *   07/08/2026 : cycles.ts calcule le cycle en cours par soustraction calendaire depuis
 *   `dateAnniversaire`, sans jamais comparer ses bornes à `dateAnniversairePrecedente` ; une
 *   inversion des deux dates (typo, ou champs remplis dans le mauvais ordre) produirait un cycle en
 *   cours de durée négative ou nulle, jamais détecté avant ce garde-fou.
 * - `ouvertureDroits.dateLimiteIndemnisation` antérieure ou égale à `dateOuverture` — signalé par
 *   un cas réel (2026-07-26) : une faute de frappe sur l'année de l'une ou l'autre date
 *   (ex. "2017" au lieu de "2027") fait s'effondrer silencieusement toute la série mensuelle
 *   (calculerSerieDepuisContrats, engine/indemnisationMensuelle.ts, plafonne moisFin en dessous du
 *   point de départ) — jamais un tableau vide sans explication (devoir n°2).
 * - `dateNaissance` avec une année malformée (ex. "19994-06-09", import JSON corrompu) — bloqué à
 *   la saisie normale par `DateNaissanceInput.tsx` (année à 4 chiffres max), mais un JSON importé
 *   ne passe jamais par ce composant. Sans ce garde-fou, `ageAuJour` (engine/dateUtils.ts, via
 *   date-fns `differenceInYears`) renvoie `NaN`, et `NaN >= 50` valant `false`, le plafond
 *   enseignement retombe silencieusement sur 70 h (<50 ans) quel que soit l'âge réel — vérifié
 *   concrètement avant ce correctif, jamais supposé (devoir n°2).
 */
export function validerCoherenceProfil(profil: ChampsCoherence): ResultatCoherenceProfil {
  if (!profil.dateNaissance) {
    return { coherent: false, raison: "La date de naissance est obligatoire." };
  }
  if (!dateIsoEstValide(profil.dateNaissance)) {
    return {
      coherent: false,
      raison: "La date de naissance n'est pas une date valide (année à 4 chiffres, jour et mois réellement existants).",
    };
  }
  if (profil.situation === "readmission" && !profil.dateAnniversaire) {
    return {
      coherent: false,
      raison: "Une réadmission nécessite une date anniversaire connue. Renseigne-la, ou repasse en « Première admission » si tu ne la connais pas encore.",
    };
  }
  if (profil.dateAnniversaire && profil.dateAnniversairePrecedente && profil.dateAnniversaire <= profil.dateAnniversairePrecedente) {
    return {
      coherent: false,
      raison: "Ta date anniversaire (fin de tes derniers droits ouverts) doit être postérieure à la date de fin de ta période de droits précédente — vérifie qu'aucune des deux années n'a été mal saisie.",
    };
  }
  const ouverture = profil.ouvertureDroits;
  if (ouverture?.dateLimiteIndemnisation && ouverture.dateLimiteIndemnisation <= ouverture.dateOuverture) {
    return {
      coherent: false,
      raison: "La date limite de ton indemnisation doit être postérieure à la date d'ouverture de tes droits — vérifie qu'aucune des deux années n'a été mal saisie.",
    };
  }
  return { coherent: true };
}

/**
 * Schéma de FORME pure (Zod), sans la règle de cohérence — réservé à la LECTURE d'un profil déjà
 * enregistré (storage/localStorageAdapter.ts, `chargerDonnees`, appelé à chaque ouverture de
 * l'app). Volontairement permissif sur la cohérence : un profil déjà stocké AVANT l'ajout d'une
 * nouvelle règle de cohérence (ex. `dateLimiteIndemnisation` après `dateOuverture`, ajoutée le
 * 2026-07-26) ne doit JAMAIS se mettre à échouer au chargement — ce serait un profil qui a
 * strictement le même contenu qu'avant, mais que l'app afficherait soudain comme vide/onboarding
 * (`chargerDonnees` retombe sur `donneesVides` si le parse Zod échoue), un faux "perte de données"
 * qui violerait le devoir sacré n°1 alors qu'aucune donnée n'a réellement disparu. La cohérence
 * ne doit bloquer qu'à l'ÉCRITURE (cf. `profilSchema` ci-dessous), jamais rétroactivement à la
 * lecture d'un profil existant.
 */
export const profilSchemaForme = z.object({
  dateNaissance: z.string(),
  dateAnniversaire: z.string(),
  situation: z.enum(["premiere_admission", "readmission"]),
  alsaceMoselle: z.boolean().optional(),
  baremeCSG: z.enum(["normal", "reduit"]).optional(),
  activiteHorsAnnexe10: z.boolean().optional(), // déprécié, cf. types/index.ts — jamais écrit, lu en repli seulement
  regimeDeclare: z.enum(["annexe10_pur", "mixte", "inconnu"]).optional(),
  dateAnniversairePrecedente: z.string().optional(), // réadmission uniquement, jamais bloquant si absent
  dureeDroitsMois: z.union([z.literal(12), z.literal(6)]).optional(), // connue à l'ouverture, jamais déduite de l'historique — franchise salaires
  salairesHorsAnnexe10PRA: z.number().nullable().optional(), // franchise salaires, cf. engine/indemnisationMensuelle.ts
  ajReelleHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number() })).optional(), // cf. types/index.ts
  historiqueOuvertureDroits: z.array(z.object({ dateOuverture: z.string(), dateEcheance: z.string() })).optional(), // cf. types/index.ts
  ouvertureDroits: z
    .object({
      dateOuverture: z.string(),
      franchiseCPTotale: z.number(),
      delaiAttenteInitial: z.number(),
      tauxPrelevementSourceHistorique: z.array(z.object({ dateEffet: z.string(), valeur: z.number() })).optional(), // historique de taux PAS, cf. types/index.ts
      dateLimiteIndemnisation: z.string().optional(), // fin de la période d'indemnisation, cf. types/index.ts
      // Franchise salaires totale DÉCLARÉE (jours), cf. types/index.ts. Optionnel : absent =
      // inconnu, 0 = aucune franchise notifiée — deux états distincts, jamais confondus. Aucune
      // migration requise pour un profil enregistré avant l'ajout de ce champ (devoir sacré n°1).
      franchiseSalairesTotale: z.number().min(0).optional(),
    })
    .optional(),
});

/**
 * Schéma de forme + COHÉRENCE (Zod) d'un Profil — réservé aux portes d'ÉCRITURE :
 * `validerProfilPourEcriture` ci-dessous (édition en mémoire, App.tsx) ET
 * storage/localStorageAdapter.ts (`importerJSON`, une action explicite de l'utilisateur, jamais un
 * simple chargement de page). Le .refine() réutilise `validerCoherenceProfil` : la règle n'est
 * écrite qu'une fois, elle s'applique donc aux deux portes à la fois — sinon un JSON importé (le
 * tien, ou celui d'un ami en retour d'usage, cf. SPEC §11.A) pourrait réinjecter un profil
 * incohérent que ni l'onboarding ni l'édition n'auraient jamais laissé naître. Ne JAMAIS utiliser
 * ce schéma pour la lecture d'un profil déjà stocké (`chargerDonnees`) — cf. `profilSchemaForme`.
 */
export const profilSchema = profilSchemaForme.refine((p) => validerCoherenceProfil(p).coherent, (p) => ({ message: validerCoherenceProfil(p).raison ?? "Profil incohérent." }));

export type ResultatEcritureProfil = { ok: true; profil: Profil } | { ok: false; erreur: string };

/**
 * Point d'entrée unique pour toute écriture de profil en mémoire (App.tsx modifierProfil) : forme
 * (Zod) puis cohérence, jamais l'un sans l'autre. Devoir n°1 tenu par construction : tant que ceci
 * n'a pas renvoyé { ok: true }, l'appelant ne doit jamais persister — l'ancien profil valide reste
 * donc en place, sans qu'aucune sauvegarde de secours distincte ne soit nécessaire.
 */
export function validerProfilPourEcriture(candidat: unknown): ResultatEcritureProfil {
  const resultat = profilSchema.safeParse(candidat);
  if (!resultat.success) {
    return { ok: false, erreur: resultat.error.issues[0]?.message ?? "Profil invalide." };
  }
  return { ok: true, profil: resultat.data };
}
