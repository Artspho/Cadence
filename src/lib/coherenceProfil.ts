import { z } from "zod";
import type { Profil } from "../types";

export interface ResultatCoherenceProfil {
  coherent: boolean;
  raison?: string;
}

type ChampsCoherence = Pick<Profil, "dateNaissance" | "situation" | "dateAnniversaire">;

/**
 * Règle de cohérence transversale entre les 3 champs modifiables du profil (Onboarding + édition
 * post-onboarding, §11.A). Le seul piège identifié : une réadmission sans date anniversaire
 * connue — periodeReference.ts ferait alors tourner l'extension de réadmission sur une fenêtre
 * fictive "se terminant aujourd'hui", produisant un seuil ajusté plausible mais faux (devoir n°2).
 * Une première admission sans date est saine (cas déjà géré par le moteur) ; une première
 * admission AVEC une date renseignée l'est aussi (le moteur se fie à la présence de la date, pas
 * à `situation`) — aucune autre combinaison n'est donc bloquée ici.
 */
export function validerCoherenceProfil(profil: ChampsCoherence): ResultatCoherenceProfil {
  if (!profil.dateNaissance) {
    return { coherent: false, raison: "La date de naissance est obligatoire." };
  }
  if (profil.situation === "readmission" && !profil.dateAnniversaire) {
    return {
      coherent: false,
      raison: "Une réadmission nécessite une date anniversaire connue. Renseigne-la, ou repasse en « Première admission » si tu ne la connais pas encore.",
    };
  }
  return { coherent: true };
}

/**
 * Schéma de forme (Zod) d'un Profil — unique définition, réutilisée par
 * storage/localStorageAdapter.ts (import/export JSON, 3e porte d'écriture) ET par
 * validerProfilPourEcriture ci-dessous (édition en mémoire, App.tsx). Le .refine() réutilise
 * validerCoherenceProfil : la règle n'est écrite qu'une fois, elle s'applique donc aux deux portes
 * à la fois — sinon un JSON importé (le tien, ou celui d'un ami en retour d'usage, cf. SPEC §11.A)
 * pourrait réinjecter un profil réadmission-sans-date que ni l'onboarding ni l'édition n'auraient
 * jamais laissé naître.
 */
export const profilSchema = z
  .object({
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
    ouvertureDroits: z
      .object({
        dateOuverture: z.string(),
        franchiseCPTotale: z.number(),
        delaiAttenteInitial: z.number(),
      })
      .optional(),
  })
  .refine((p) => validerCoherenceProfil(p).coherent, (p) => ({ message: validerCoherenceProfil(p).raison ?? "Profil incohérent." }));

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
