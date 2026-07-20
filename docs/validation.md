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
| A — central   | A10 / … / … / ~600-700 h / SR confortable | | | | |
| B — 500 h     | A10 / … / … / 500 h / … (statut seul, FT ne rend rien <507 h) | | | | |
| B — 520 h     | A10 / … / … / 520 h / … | | | | |
| C — cachets   | A10 / … / … / majorité de cachets / … | | | | |

Verdict : ✅ concordant · ⚠️ écart à expliquer · ❌ bug à corriger
