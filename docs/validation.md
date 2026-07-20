# docs/validation.md — Validation des chiffres de Cadence

Objet : prouver que le calcul colle à la réalité, en comparant les sorties de
Cadence à une source qui fait autorité. C'est la vérification qui compte le plus,
bien au-delà des tests unitaires.

## Source de vérité (par ordre de confiance)

1. Notification officielle France Travail — le plus fort : teste aussi les heures
   RÉELLEMENT retenues par FT (un contrat non déclaré, une heure requalifiée…).
2. Simulateur officiel France Travail (simucalcul.pole-emploi-services.fr) —
   suffisant pour valider la formule de calcul.

On ne compare JAMAIS Cadence à une estimation personnelle : deux estimations qui
s'accordent ne prouvent rien (elles peuvent se tromper de la même façon).

## Règles de comparaison

- Brut à brut : le simulateur rend une AJ brute → ne pas comparer au net.
- Zone centrale obligatoire : SR ni très bas ni très haut. Tant que
  `smicHoraireBrut` et `pmssMensuel` sont à `null`, tout cas plancher/plafond
  donnera un écart NORMAL (repli config), PAS un bug.
- Mêmes entrées, même définition : SR = brut AVANT abattement.
- Tolérance : écart ≤ 0,50 €/jour = arrondi, OK. Au-delà → enquête.
- Preuve : capture d'écran datée du simulateur (l'outil peut évoluer).
- Règle absolue : un faux « vert » ou un faux « Bloqué » → on arrête tout.

## Cas testés

| Cas | Entrées (annexe / situation / période / heures / SR brut) | FT : AJ brute + durée | Cadence : AJ brute + durée | Écart | Verdict |
|-----|-----------------------------------------------------------|-----------------------|----------------------------|-------|---------|
| Réel #1 — notification FT du 03/02/2026 | A10 / réadmission / période 24/03/2025→17/01/2026 (~299 j, pas d'allongement) / 710 h / SR 9229,35 € brut avant abattement | 53,81 € net (durée non communiquée) | 55,02 € brut → 53,81 € net (durée non exercée dans ce test) | 0,00 € | ✅ concordant |
| B — 500 h     | A10 / … / … / 500 h / … (statut seul, FT ne rend rien <507 h) | | | | |
| B — 520 h     | A10 / … / … / 520 h / … | | | | |
| C — cachets   | A10 / … / … / majorité de cachets / … | | | | |

Verdict : ✅ concordant · ⚠️ écart à expliquer · ❌ bug à corriger

**Note sur le cas Réel #1** : chemin de calcul exercé = A + B + C (formule standard, pas de
période allongée) → SJM → palier retraite complémentaire seule (31,96 € < AJ brute ≤ 60 €,
donc pas de CSG/CRDS sur ce cas). Cohérence croisée vérifiée sur le régime Alsace-Moselle : le
calcul sans cotisation locale tombe pile sur le net réel (53,81 €), celui avec cotisation locale
donne 51,86 € — confirme que ce profil n'est pas Alsace-Moselle. La branche CSG/CRDS (AJ brute
> 60 €) reste à éprouver sur un futur cas réel, tout comme la formule réadmission allongée.
