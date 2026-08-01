# Routine mensuelle — Veille réglementaire & documents

Objectif : ne jamais rater une revalorisation, une réforme, ou un document officiel
important. À faire une fois par mois (voir case à cocher en bas pour fixer le jour).

---

## 1. SNAM-CGT — actualités et frais réels

- [ ] Consulter le site SNAM-CGT (musiciens) pour toute actu sur les conventions
      collectives, revalorisations de cachets minimums, ou mise à jour du guide
      « Frais professionnels » (le document actuel dans le projet date de mars 2026).
- [ ] Vérifier si une nouvelle version du guide frais réels a été publiée (changement
      de forfaits 14%/5%, nouvelles catégories de frais admises).
- [ ] Si mise à jour : la signaler pour adapter le skill `frais-reels-musicien` du
      projet si besoin.

**Source** : site snam-cgt.org (rubrique frais professionnels / actualités)

---

## 2. Impôts — barèmes et taux applicables

- [ ] Vérifier le taux de prélèvement à la source (PAS) applicable sur
      impots.gouv.fr → espace particulier → gérer mon prélèvement à la source.
      (Changement possible après chaque déclaration annuelle ou modulation.)
- [ ] Vérifier si le barème de l'impôt sur le revenu a changé (généralement figé
      pour l'année, revu en loi de finances — à surveiller surtout en
      décembre/janvier).
- [ ] Vérifier le BOFIP frais réels artistes musiciens si une doctrine a été mise
      à jour : BOI-RSA-BASE-30-50-30-30 sur bofip.impots.gouv.fr.
- [ ] Vérifier le plafond de déduction des frais réels (145 550 € de rémunération,
      seuil mentionné dans le guide SNAM) — confirmer qu'il n'a pas changé.

**Source** : impots.gouv.fr, bofip.impots.gouv.fr

---

## 3. France Travail / Unédic — règles de calcul ARE (Annexe 10)

Point le plus sensible pour Cadence : toute valeur ici alimente
`franceTravailConfig.ts`.

- [ ] SMIC horaire brut (revalorisé au 1er janvier, et en cours d'année si
      inflation > 2%, ex. juin 2026) — vérifier sur info.gouv.fr ou
      service-public.gouv.fr.
- [ ] PMSS / PASS (revalorisé au 1er janvier uniquement, stable le reste de
      l'année) — vérifier sur urssaf.fr ou legisocial.fr.
- [ ] Allocation journalière minimale (AJ min, actuellement 31,96 €) — vérifier
      sur la page France Travail « Culture et Spectacle » ou le document Unédic
      « Paramètres utiles » (mis à jour périodiquement, chercher la version la
      plus récente, pas un blog tiers — plusieurs sites tiers reproduisent une
      coquille à 31,36 €, ne pas s'y fier).
- [ ] Allocation plancher (44 € Annexe 10) et plafond (174,80 €) — vérifier sur
      le Guide France Travail « Intermittents du spectacle » (édition la plus
      récente disponible sur francetravail.fr).
- [ ] Vérifier si une nouvelle convention d'assurance chômage a été signée ou
      renégociée (change potentiellement toute la formule A+B+C, pas seulement
      les montants) — chercher « nouvelle convention assurance chômage
      intermittents » + année en cours.
- [ ] Vérifier si le Guide France Travail a une édition plus récente que celle
      actuellement sourcée dans le projet (mars 2026) — comparer la date en
      page de garde du PDF avec celle citée dans `franceTravailConfig.ts`.

**Sources** : francetravail.fr (rubrique Spectacle), unedic.org (publications),
service-public.gouv.fr, info.gouv.fr

**Si une valeur a changé** : mettre à jour `franceTravailConfig.ts`
(`meta.version`, `dateEntreeVigueur`, `valableJusquau`), puis rejouer tous les
cas de `docs/validation.md` contre le simulateur officiel France Travail avant
de considérer le changement terminé.

---

## 4. Documents personnels à ne pas manquer

Check-list pour ne perdre aucune pièce officielle du mois :

- [ ] **Relevé de situation** France Travail du mois (téléchargé depuis l'espace
      personnel, section « Mes courriers reçus »).
- [ ] **Justificatif après déclaration** du mois (attestation mensuelle
      d'actualisation).
- [ ] Toute **notification** exceptionnelle reçue (admission, réadmission,
      demande de documents complémentaires, décision suite à réclamation).
- [ ] Bulletins de paie / AEM du mois reçus de chaque employeur — vérifier
      qu'aucun contrat du mois n'a de pièce manquante.
- [ ] Une fois par an (janvier/février) : **déclaration fiscale annuelle**
      France Travail (récapitulatif annuel des relevés) — à conserver sans
      limite de durée, sert de justificatif retraite.
- [ ] Ranger/archiver les PDF téléchargés dans le dossier du projet (comme les
      fichiers déjà présents) pour garder l'historique complet — utile aussi
      pour la comparaison Cadence vs réel (backlog « Vérifier données réelles »).

---

## 5. Vérifications annuelles uniquement (à ne pas refaire chaque mois)

- Revalorisation SMIC/PMSS du **1er janvier** — case à part, à ne pas oublier
  même si rien ne semble avoir bougé en cours d'année.
- Barème impôt sur le revenu (loi de finances, généralement fin d'année /
  janvier).
- Renouvellement de la convention d'assurance chômage (pas annuel, mais à
  surveiller en fin de convention connue).

---

## Fréquence et déclenchement

- [ ] **Jour fixé** : ________________ (à préciser — ex. le 5 de chaque mois,
  après réception du relevé de situation)
- [ ] Rappel créé sur : ☐ Google Calendar ☐ Todoist ☐ les deux

---

*Dernière mise à jour de cette routine : 01/08/2026 (première version).*
