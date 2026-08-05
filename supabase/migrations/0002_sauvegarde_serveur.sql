-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Phase 5, dette ouverte depuis le commit D (05/08/2026, session 8) : `donnees_sauvegarde` existe
-- depuis la migration 0001 mais n'était alimentée par AUCUN code — un filet créé, jamais rempli.
--
-- CE QUE CE FICHIER FAIT, ET RIEN DE PLUS : à chaque écriture réussie sur `donnees_utilisateur`,
-- le contenu QUI EXISTAIT AVANT cette écriture (`old.donnees`) est recopié dans
-- `donnees_sauvegarde` — exactement le même principe que le filet local
-- (`cadence:v1:donnees.backup`, cf. `sauvegarderDonnees` dans `localStorageAdapter.ts`) : la copie
-- de secours porte la version PRÉCÉDENTE, jamais celle qu'on vient d'écrire.
--
-- ⚠️ POURQUOI UN TRIGGER CÔTÉ BASE, ET NON UN DEUXIÈME APPEL DEPUIS `ecrireEtatServeur` : le module
-- applicatif ne connaît jamais le contenu qu'il remplace (il n'a que le jeton `maj_le`), donc lui
-- faire porter cette responsabilité demanderait une lecture supplémentaire, avec sa propre fenêtre
-- de concurrence. Un trigger `BEFORE UPDATE` voit `OLD.donnees` dans la MÊME transaction que
-- l'écriture qu'il protège : aucune fenêtre où l'ancien contenu pourrait avoir changé entre la
-- lecture et la copie.
--
-- ⚠️ SEULEMENT `BEFORE UPDATE`, PAS `BEFORE INSERT` : une première écriture n'a rien à sauvegarder
-- (`OLD` n'existe pas pour un insert) — exactement comme `sauvegarderDonnees` ne touche la clé de
-- secours locale que si un contenu précédent existait déjà (`if (precedent !== null)`).
--
-- ⚠️ `cree_le` EST RÉÉCRIT EXPLICITEMENT DANS LA REQUÊTE, PAS LAISSÉ AU `DEFAULT now()` DE LA
-- COLONNE : ce défaut ne s'applique qu'À L'INSERT. Sans cette ligne, un `ON CONFLICT DO UPDATE`
-- laisserait `cree_le` à la date de la TOUTE PREMIÈRE sauvegarde alors que son contenu, lui,
-- change à chaque fois — une date périmée qui mentirait sur l'âge réel de la copie (devoir n°2).
-- C'est précisément ce que la dette ouverte au commit D avait identifié.
--
-- ⚠️ SÉCURITÉ INVOKER (le défaut, explicité ici pour que l'intention soit lisible) : le trigger
-- s'exécute avec les droits de la session qui a déclenché l'UPDATE, donc RLS s'applique EXACTEMENT
-- comme si l'utilisateur avait lui-même exécuté l'insertion dans `donnees_sauvegarde`. Comme il ne
-- peut déjà mettre à jour QUE sa propre ligne de `donnees_utilisateur` (RLS de la migration 0001),
-- `OLD.user_id` est nécessairement le sien : la politique `donnees_sauvegarde_inserer`
-- (`auth.uid() = user_id`) est donc toujours satisfaite. Aucune politique n'est ajoutée ni modifiée
-- ici — seuls une fonction et un trigger.
--
-- PREUVE ATTENDUE, PAS ENCORE FAITE : `npm run verifier:sauvegarde` (nouveau script, même patron que
-- `verifier-verrou.mjs`) exerce une vraie écriture contre le vrai projet et relit
-- `donnees_sauvegarde` pour confirmer qu'elle porte bien le contenu D'AVANT, jamais celui qu'on
-- vient d'écrire, et que `cree_le` avance à chaque sauvegarde. `npm run verifier:rls` reste à
-- relancer aussi, par prudence, après tout changement de schéma.
--
-- ⚠️⚠️ NON VÉRIFIÉ AU 05/08/2026 — CE SQL N'A JAMAIS ÉTÉ EXÉCUTÉ. Mêmes conditions qu'en 0001 (pas de
-- Docker ni Postgres local sur la machine de développement) : à appliquer dans l'éditeur SQL de
-- Supabase, en le regardant, puis à prouver avec les deux scripts ci-dessus avant de dire cette
-- dette soldée.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.sauvegarder_avant_maj()
returns trigger
language plpgsql
security invoker
as $$
begin
  insert into public.donnees_sauvegarde (user_id, donnees, cree_le)
  values (old.user_id, old.donnees, now())
  on conflict (user_id) do update set donnees = excluded.donnees, cree_le = excluded.cree_le;
  return new;
end;
$$;

create trigger donnees_utilisateur_sauvegarder_avant_maj
  before update on public.donnees_utilisateur
  for each row execute function public.sauvegarder_avant_maj();

commit;
