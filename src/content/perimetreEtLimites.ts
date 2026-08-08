/**
 * Texte partagé entre « Mon profil » et l'onglet « Paramètres, Sources & Mentions » (refonte UI,
 * 07/08/2026) — une seule source, pour ne jamais risquer une divergence entre les deux endroits où
 * ce texte apparaît (même principe que `content/mentionsLegales.ts`).
 *
 * ⚠️ CORRECTION APPORTÉE EN EXTRAYANT CE TEXTE : la première puce des limites structurelles disait
 * encore « Toutes les données sont en localStorage : cache vidé ou changement d'appareil = perte de
 * la saisie » — vrai avant la refonte Supabase, FAUX depuis (contrats et profil sont sur le serveur
 * depuis la phase 5, un compte est obligatoire depuis le 05/08/2026, cf. `Compte.tsx`). Reformulée
 * pour rester vraie, devoir sacré n°2 — jamais un texte rassurant à tort, ni un texte alarmiste à
 * tort sur une garantie qui existe désormais.
 */

export const PERIMETRE_MVP: string[] = [
  "Annexe 10 uniquement. Pas d'arbitrage Annexe 8 ni régime général (article 65).",
  "Estimation, pas décision. Les montants sont indicatifs ; France Travail seul fait foi.",
  "Le suivi des jours réellement indemnisés mois par mois est disponible (onglet « Revenus mensuels »), calculé automatiquement depuis tes contrats et l'ouverture de tes droits (renseignée dans « Mon indemnisation en cours »). La franchise salaires et le plafond de cumul (118 % du PMSS) ne sont pas calculés.",
  "Dépôt de document assisté, pas magique : extraction locale ou par IA, revue avant enregistrement, non garantie exacte.",
];

export const LIMITES_STRUCTURELLES: string[] = [
  "Tes contrats et ton profil sont enregistrés sur le serveur (Supabase) : c'est lui qui fait référence, retrouvable depuis n'importe quel appareil une fois connecté. Tes frais réels et ton identité déclarative, eux, restent uniquement dans ce navigateur — pense à les exporter (JSON) si tu changes d'appareil.",
  "La projection est linéaire : elle ignore la saisonnalité (festivals l'été, creux ensuite) et peut rassurer à tort.",
  "Risque de faux « feu vert » : des heures oubliées ou un cas hors périmètre peuvent afficher un statut rassurant à tort.",
  "Les profils mixtes (Annexe 10 + Annexe 8 + régime général) reposent sur ton propre signalement (section « Mon profil ») : rien n'est déduit automatiquement de tes contrats.",
  "Les alertes sont calculées à l'ouverture de l'app, pas envoyées de façon proactive (pas de backend de notification).",
  "La franchise salaires est calculée selon la formule officielle (guide France Travail, page 14). Si tu n'as eu que des contrats Annexe 10, le calcul est complet. Si tu avais aussi des contrats hors spectacle, renseigne le champ « Salaires hors Annexe 10 sur la période de référence » (section « Mon profil ») pour affiner.",
];
