-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0004 — LA PREUVE DU CONSENTEMENT À LA POLITIQUE DE CONFIDENTIALITÉ
--
-- Demandé par Benoît le 06/08/2026 : « pour créer un compte il faut accepter la politique de
-- confidentialité, une seule fois suffit. Je veux que cette preuve soit stockée. »
--
-- `content/mentionsLegales.ts` déclare pour base légale « ton consentement, donné explicitement à
-- l'inscription ». Depuis le 06/08/2026 une case le recueille (`EcranConnexionObligatoire.tsx`) ;
-- cette table le CONSERVE, sans quoi la base légale déclarée reposait sur un geste dont il ne
-- restait aucune trace.
--
-- ⚠️ POURQUOI `accepte_le` EST FOURNI PAR LE CLIENT, ET PAS `default now()`. Au moment exact où la
-- case est cochée, AUCUNE SESSION N'EXISTE ENCORE (`signUp` avec confirmation par e-mail n'en ouvre
-- pas), donc RLS interdit d'écrire ici : `auth.uid()` est nul. L'instant du consentement est donc
-- confié à `signUp(options.data)` — Supabase l'écrit dans `raw_user_meta_data` au moment même de la
-- création du compte — puis recopié ici à la PREMIÈRE session (`storage/consentementStorage.ts`).
-- `enregistre_le`, lui, est l'heure du serveur au moment de la recopie : l'écart entre les deux dit
-- exactement combien de temps la confirmation par e-mail a pris. Ne pas remplacer `accepte_le` par
-- `now()` : ce serait dater le consentement du jour de la confirmation, donc écrire une date fausse.
--
-- ⚠️⚠️ AUCUNE POLITIQUE `update` NI `delete` — SEULE TABLE DU SCHÉMA DANS CE CAS, C'EST VOLONTAIRE.
-- Toutes les autres tables laissent l'utilisateur modifier et supprimer ses propres lignes : ce sont
-- SES données. Ici non : une preuve que la personne concernée peut réécrire ou effacer n'est pas une
-- preuve. Une ligne ne disparaît donc que par `on delete cascade`, quand le compte lui-même est
-- supprimé — ce qui est cohérent avec la politique affichée (« tu peux demander la suppression de
-- ton compte et de tes données »), et ne laisse pas de preuve orpheline derrière un compte effacé.
-- Si un jour une correction devient nécessaire, elle passe par le tableau de bord Supabase, jamais
-- par l'application.
--
-- `unique (user_id, version_texte)` plutôt qu'une clé primaire sur `user_id` seul : le jour où le
-- texte de la politique change, un NOUVEAU consentement doit pouvoir être recueilli et conservé À
-- CÔTÉ de l'ancien, sans écraser l'historique. « Une seule fois suffit » vaut pour UNE version du
-- texte, pas pour toutes les versions futures.
--
-- Idempotente (même principe que 0003) : peut être recollée sans dommage dans l'éditeur SQL.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.consentements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Quelle VERSION du texte a été acceptée (`VERSION_POLITIQUE`, content/mentionsLegales.ts).
  -- Sans elle, la preuve ne dirait pas à quoi la personne a consenti — donc ne prouverait rien.
  version_texte text not null,
  -- L'instant du consentement, tel que transmis à la création du compte (cf. l'avertissement).
  accepte_le timestamptz not null,
  -- L'instant de la recopie serveur, à la première session.
  enregistre_le timestamptz not null default now(),
  unique (user_id, version_texte)
);

alter table public.consentements enable row level security;

-- Lire : la personne concernée peut consulter son propre consentement (droit d'accès).
drop policy if exists consentements_lire on public.consentements;
create policy consentements_lire on public.consentements for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);

-- Insérer : uniquement pour soi-même.
drop policy if exists consentements_inserer on public.consentements;
create policy consentements_inserer on public.consentements for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);

-- PAS de `consentements_modifier`, PAS de `consentements_supprimer`. Voir l'avertissement en tête.
-- Si ces politiques existent (d'une exécution antérieure d'une version différente de ce fichier),
-- les retirer : leur présence viderait la table de son sens.
drop policy if exists consentements_modifier on public.consentements;
drop policy if exists consentements_supprimer on public.consentements;
