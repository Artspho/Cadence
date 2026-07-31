// Textes du module « Renouvellement anticipé » (réadmission sur demande expresse). Source unique
// pour ne jamais reformuler la même mise en garde différemment entre deux endroits de l'écran
// (même principe que content/contradictionHorsA10.ts).
//
// F1/F2/F3 (cf. prompt produit du 31/07/2026, §4) sont volontairement de simples chaînes
// statiques : ni Cadence ni ce module n'ont de donnée fiable pour transformer l'un de ces trois
// points en un calcul (aucun champ « attestation employeur reçue » sur Contrat, formule de la
// franchise salaires non câblée pour un droit non encore ouvert, et le trop-perçu du mois de
// transition dépend d'une date de traitement France Travail que Cadence ne connaît pas). Un
// avertissement toujours affiché reste honnête ; une case cochée automatiquement à tort ne le
// serait pas (devoir sacré n°2).
export const RENOUVELLEMENT_ANTICIPE = {
  // F1 — précondition, affichée près de la saisie de la FCT retenue. Volontairement jamais
  // transformée en blocage automatique : Cadence n'a aucun champ indiquant qu'une attestation
  // employeur a été reçue pour un contrat (cf. types/index.ts, Contrat), un blocage se fonderait
  // donc sur une donnée qu'on n'a pas — seul un rappel textuel est honnête ici.
  attestationRequise:
    "Ta dernière fin de contrat doit être justifiée (attestation employeur reçue par France Travail) avant de pouvoir demander ce réexamen. Si ce n'est pas encore le cas, la simulation ci-dessous reste indicative mais ta demande réelle pourrait être refusée ou retardée.",

  // F2 — jamais un 0 qui laisserait croire qu'il n'y a pas de franchise salaires (devoir sacré n°2) :
  // ce module ne calcule pas la franchise salaires du nouveau droit (formule qui suppose un SR/SJM
  // déjà consolidés à l'ouverture réelle des droits, cf. engine/indemnisationMensuelle.ts), donc le
  // silence serait trompeur. Toujours affiché, jamais conditionnel.
  franchiseSalairesNonFiabilisee:
    "Une franchise salaires peut aussi s'appliquer sur ce nouveau droit. Son montant n'est pas encore fiabilisé dans Cadence pour un renouvellement anticipé — vérifie-le sur simucalcul.pole-emploi-services.fr ou directement auprès de France Travail.",

  // F3 — texte d'accompagnement de l'écran, jamais un calcul : le trop-perçu du mois de transition
  // dépend de la date à laquelle France Travail traite effectivement la demande, une donnée que
  // Cadence ne connaît pas et ne peut pas deviner.
  troPPercuMoisTransition:
    "Le mois où bascule ton droit peut donner lieu à un trop-perçu ponctuel si tu t'actualises avant que France Travail ait traité ta demande de renouvellement anticipé. Cadence ne peut pas le chiffrer à l'avance.",

  // Rappel permanent du cadre de l'outil (jamais une démarche réelle) — cf. règle #11.B du SPEC :
  // l'interface de demande elle-même reste hors périmètre tant que la comparaison n'était pas
  // sourcée et validée, ce qui est désormais fait (cf. docs/validation.md).
  simulationSeulement:
    "Cette comparaison est une simulation, pas une demande. Pour effectuer réellement un renouvellement anticipé, utilise ton espace personnel France Travail.",
  libelleLienEspacePersonnel: "Aller sur mon espace personnel France Travail →",
  urlEspacePersonnel: "https://candidat.pole-emploi.fr/espacepersonnel/",
} as const;
