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

  // Trop-perçu — un texte par état de `RisqueTropPercu` (engine/renouvellementAnticipe.ts). Le
  // booléen d'origine n'avait que deux rendus : bandeau rouge, ou RIEN. Ce « rien » se lisait comme
  // « pas de risque » alors qu'il couvrait aussi « Cadence ne sait pas » — faux feu vert (devoir
  // sacré n°2), corrigé le 03/08/2026 : l'état `indetermine` a désormais son propre message, et
  // seul `ecarte` (les DEUX franchises prouvées épuisées) autorise le silence.
  tropPercu: {
    avere:
      "⚠ Risque de trop-perçu : une franchise de ton droit actuel n'était pas encore épuisée à cette date. France Travail peut te réclamer un trop-perçu — montant non chiffré par Cadence, vérifie sur simucalcul.pole-emploi-services.fr ou directement auprès de France Travail.",
    // Un message par raison : « on ne sait pas » n'est utile que si on dit POURQUOI on ne sait pas.
    indetermine: {
      franchise_salaires_non_calculee:
        "Risque de trop-perçu indéterminé : ta franchise congés payés semble épuisée à cette date, mais une franchise salaires peut aussi rester due — Cadence ne la calcule pas encore, elle ne peut donc pas conclure. Ce n'est pas « aucun risque » : vérifie sur simucalcul.pole-emploi-services.fr ou auprès de France Travail.",
      simulation_mensuelle_impossible:
        "Risque de trop-perçu indéterminé : Cadence n'a pas pu simuler la consommation de tes franchises depuis l'ouverture de ton droit actuel (paramètres d'ouverture manquants dans « Mon indemnisation en cours »). Ce n'est pas « aucun risque » : complète ces informations, ou vérifie directement auprès de France Travail.",
      historique_mensuel_insuffisant:
        "Risque de trop-perçu indéterminé : la date choisie est trop proche de l'ouverture de ton droit actuel pour que Cadence puisse constater un mois complet de consommation des franchises. Ce n'est pas « aucun risque » : vérifie sur simucalcul.pole-emploi-services.fr ou auprès de France Travail.",
    },
  },

  // Rappel permanent du cadre de l'outil (jamais une démarche réelle) — cf. règle #11.B du SPEC :
  // l'interface de demande elle-même reste hors périmètre tant que la comparaison n'était pas
  // sourcée et validée, ce qui est désormais fait (cf. docs/validation.md).
  simulationSeulement:
    "Cette comparaison est une simulation, pas une demande. Pour effectuer réellement un renouvellement anticipé, utilise ton espace personnel France Travail.",
  libelleLienEspacePersonnel: "Aller sur mon espace personnel France Travail →",
  urlEspacePersonnel: "https://candidat.pole-emploi.fr/espacepersonnel/",
} as const;
