-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Phase 1 de la refonte Supabase — schéma complet et isolation entre utilisateurs.
--
-- DÉCISION STRUCTURANTE (option B, validée par Benoît le 04/08/2026) : les données de l'app sont
-- stockées en **JSONB, une ligne par utilisateur**, et NON éclatées en colonnes relationnelles.
-- Le motif n'est pas la paresse, c'est le devoir n°1. La forme des données ne change pas d'un octet,
-- donc :
--   · le schéma Zod de src/storage/localStorageAdapter.ts reste EXACTEMENT le validateur qu'il est
--     aujourd'hui — en particulier le schéma de LECTURE, qu'aucune règle nouvelle ne doit durcir ;
--   · `chargerDonnees` / `sauvegarderDonnees` gardent leur signature (déjà asynchrones et déjà
--     porteuses d'un résultat ok/échec depuis le point 2) : on remplace un getItem par un select ;
--   · la migration des 62 contrats devient « lire le JSON local, écrire une ligne », vérifiable d'un
--     coup d'œil et réversible — au lieu d'une correspondance champ par champ où une seule erreur
--     perd des données en silence.
-- L'option relationnelle reste atteignable plus tard, table par table, SANS nouvelle migration des
-- données. Ce qu'on abandonne en échange, et qu'il faut savoir : pas de requête SQL fine sur un
-- contrat isolé, et deux appareils qui écrivent en même temps écrasent la ligne entière (le dernier
-- gagne). Sans conséquence à un utilisateur par ligne ; à revoir si le multi-appareil arrive.
--
-- ⚠️ CE FICHIER NE SUFFIT PAS À PROUVER L'ISOLATION. Écrire « RLS activé » ne protège rien : il faut
-- l'EXÉCUTER contre un vrai projet. C'est le rôle de scripts/verifier-rls.mjs, dont la sortie est la
-- seule preuve recevable. Tant que ce script n'a pas tourné en vert, ne PAS écrire que la phase 1
-- est validée.
--
-- ⚠️⚠️ NON VÉRIFIÉ AU 04/08/2026 — CE SQL N'A JAMAIS ÉTÉ EXÉCUTÉ, NI MÊME ANALYSÉ.
-- La machine de développement n'a ni Docker (donc pas de `supabase start`) ni Postgres local (pas de
-- `psql`) : vérifié le 04/08/2026. Il n'existe donc AUCUNE garantie que ce fichier passe du premier
-- coup — une faute de frappe, un ordre de création erroné ou une fonction absente ne se verront qu'à
-- la première application. Ce n'est pas une raison de s'en méfier au point de ne pas l'appliquer,
-- c'est une raison de l'appliquer EN LE REGARDANT : la première exécution est le vrai test, et une
-- erreur à ce moment-là est sans danger (aucune donnée n'existe encore, et la migration est
-- encadrée par begin/commit — elle passe en entier ou pas du tout).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── Horodatage tenu par le serveur, pas par le client ────────────────────────────────────────────
-- Pourquoi un trigger et non une valeur envoyée par l'app : `maj_le` sert à départager deux
-- écritures. Une date fournie par le client peut être fausse (horloge décalée, appareil trafiqué),
-- et on ne veut pas avoir à décider laquelle des deux croire.
create or replace function public.tenir_maj_le()
returns trigger
language plpgsql
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. Les données principales — équivalent de la clé `cadence:v1:donnees`
--    (profil, contrats, périodes assimilées, solde de départ, exercices gelés)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.donnees_utilisateur (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  donnees jsonb not null,
  -- Sert à DÉTECTER un changement de forme à la lecture au lieu de le découvrir en cassant.
  -- Aucun code ne doit « migrer silencieusement » sur la base de ce champ sans décision explicite.
  version_schema integer not null default 1,
  maj_le timestamptz not null default now(),
  -- Purement informatif (diagnostic « quel appareil a écrit en dernier ») — jamais une clé de
  -- décision : ce serait un second endroit où la vérité pourrait mentir.
  maj_par_appareil text
);

create trigger donnees_utilisateur_maj_le
  before update on public.donnees_utilisateur
  for each row execute function public.tenir_maj_le();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. La copie de sécurité — équivalent de `cadence:v1:donnees.backup`
--    Une seule copie par utilisateur, exactement comme aujourd'hui. Elle doit SURVIVRE à la
--    refonte, pas disparaître avec elle (devoir n°1).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.donnees_sauvegarde (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  donnees jsonb not null,
  cree_le timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. La quarantaine — équivalent de `cadence:v1:donnees.illisible`
--    Plusieurs lignes possibles (une par lecture ratée), contrairement aux deux tables ci-dessus.
--    ⚠️ Cadence ne purge JAMAIS la quarantaine d'elle-même, même pour se débloquer : c'est un filet,
--    et le point 2 a déjà tranché que sa suppression se fait sur clic explicite de l'utilisateur.
--    `brut` est du texte, pas du jsonb : par définition ce contenu n'est pas du JSON valide.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.donnees_quarantaine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brut text not null,
  motif text,
  cree_le timestamptz not null default now()
);

create index donnees_quarantaine_user_idx on public.donnees_quarantaine (user_id, cree_le desc);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. Frais réels — équivalent de `cadence_frais_reels_<annee>`, UNE LIGNE PAR ANNÉE FISCALE
--    La clé locale est suffixée par l'année : il y en a donc plusieurs (2025, 2026…). En oublier une
--    à la migration = perdre un exercice entier, en silence.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.frais_reels (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  annee_fiscale integer not null,
  donnees jsonb not null,
  maj_le timestamptz not null default now(),
  primary key (user_id, annee_fiscale)
);

create trigger frais_reels_maj_le
  before update on public.frais_reels
  for each row execute function public.tenir_maj_le();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. Biens amortis — équivalent de `cadence_frais_reels_biens_amortis`
--    ⚠️ DÉLIBÉRÉMENT NON suffixée par l'année, exactement comme la clé locale : l'annuité d'un bien
--    court sur plusieurs exercices (5 ans pour un instrument). La découper par année serait une
--    erreur de modèle, pas une simplification.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.biens_amortis (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  donnees jsonb not null,
  maj_le timestamptz not null default now()
);

create trigger biens_amortis_maj_le
  before update on public.biens_amortis
  for each row execute function public.tenir_maj_le();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. Identité déclarative — équivalent de `cadence_identite_declarative`
--    Clé séparée dans le localStorage, donc table séparée ici : la fusionner avec les données
--    principales serait un changement de modèle non demandé.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.identite_declarative (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  donnees jsonb not null,
  maj_le timestamptz not null default now()
);

create trigger identite_declarative_maj_le
  before update on public.identite_declarative
  for each row execute function public.tenir_maj_le();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 7. Documents — le chantier d'origine (phase 6)
--
-- LES DEUX AXES, validés par Benoît le 04/08/2026 : `type_document` classe TOUS les documents ;
-- `categorie_frais` ne concerne QUE les justificatifs de frais. La taxonomie SNAM-CGT (A, B, C1…C9,
-- D — cf. src/types/fraisReels.ts et components/fraisReels/categorieLabels.ts) est celle des frais
-- professionnels : un AEM, une notification ARE, un relevé de situation ou une déclaration fiscale
-- n'appartient à AUCUNE de ces catégories, et les y ranger de force serait inventer une
-- classification. La contrainte ci-dessous impose la règle À L'ÉCRITURE — jamais à la lecture.
--
-- Le CONTENU du fichier ne vit PAS ici : il va dans Supabase Storage (bucket privé), et cette table
-- n'en porte que le chemin. Mettre du base64 dans une colonne reproduirait le défaut corrigé au
-- point 2 : lire la liste ne doit pas coûter le contenu.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type_document text not null check (
    type_document in ('aem_bulletin', 'notification_are', 'releve_situation', 'declaration_fiscale', 'justificatif_frais')
  ),
  categorie_frais text check (
    categorie_frais in ('A', 'B', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'D')
  ),
  annee_fiscale integer not null,
  -- Chemin dans le bucket. Commence TOUJOURS par l'identifiant de l'utilisateur : c'est ce que la
  -- politique RLS de storage.objects sait vérifier (cf. plus bas).
  chemin_stockage text not null,
  nom_fichier text not null,
  taille_octets bigint not null check (taille_octets > 0),
  mime text not null,
  date_document date,
  notes text,
  cree_le timestamptz not null default now(),

  -- La règle des deux axes, tenue par la base et non par la discipline de l'appelant.
  constraint categorie_frais_reservee_aux_justificatifs check (
    (type_document = 'justificatif_frais' and categorie_frais is not null)
    or (type_document <> 'justificatif_frais' and categorie_frais is null)
  ),
  -- Un même chemin ne peut pas désigner deux lignes : sinon supprimer l'une laisserait l'autre
  -- pointer vers un fichier disparu, et l'écran afficherait un document qui n'existe plus.
  constraint chemin_stockage_unique unique (chemin_stockage)
);

create index documents_user_annee_idx on public.documents (user_id, annee_fiscale, type_document);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ISOLATION — Row Level Security sur les SEPT tables
--
-- Comment ça marche, en une phrase : la règle est posée sur la TABLE, pas sur l'application. Postgres
-- ajoute lui-même « …et seulement si cette ligne appartient à celui qui demande » à chaque requête —
-- même si l'app oublie de le préciser, même si l'app est modifiée, même si quelqu'un appelle l'API
-- directement avec la clé publique.
--
-- POURQUOI `auth.uid() is not null and auth.uid() = user_id` ET PAS SEULEMENT L'ÉGALITÉ :
-- sans session, `auth.uid()` vaut NULL, et `null = user_id` est FAUX en SQL — l'accès serait donc
-- refusé, mais silencieusement et pour une raison illisible. La condition explicite rend le refus
-- franc et diagnosticable.
--
-- ⚠️ CE QUE RLS NE FAIT PAS : la clé `service_role` CONTOURNE ces politiques par conception. Elle ne
-- doit JAMAIS être exposée au navigateur, et surtout jamais nommée `VITE_*` (Vite inline littéralement
-- toute variable `VITE_*` dans le bundle public — c'est le piège déjà documenté pour MISTRAL_API_KEY
-- dans .env.example). Conséquence à assumer et à écrire dans le consentement : le titulaire du compte
-- Supabase PEUT techniquement lire les documents de tous les testeurs. RLS les protège les uns des
-- autres, pas de lui.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

alter table public.donnees_utilisateur   enable row level security;
alter table public.donnees_sauvegarde    enable row level security;
alter table public.donnees_quarantaine   enable row level security;
alter table public.frais_reels           enable row level security;
alter table public.biens_amortis         enable row level security;
alter table public.identite_declarative  enable row level security;
alter table public.documents             enable row level security;

-- Quatre politiques par table, ÉCRITES UNE PAR UNE et non générées par une boucle. Le choix est
-- délibéré : une politique de sécurité doit être lisible telle quelle par qui audite, sans exécuter
-- mentalement un `format()`. Le prix de ce choix est réel — 28 énoncés, donc un risque de
-- copier-coller (une table qui recevrait la politique d'une autre). Ce risque n'est pas laissé à la
-- relecture : scripts/verifier-rls.mjs exerce LES SEPT tables une par une, précisément pour qu'une
-- erreur de recopie soit trouvée par l'exécution et non par l'œil.

create policy donnees_utilisateur_lire      on public.donnees_utilisateur for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_utilisateur_inserer   on public.donnees_utilisateur for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_utilisateur_modifier  on public.donnees_utilisateur for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_utilisateur_supprimer on public.donnees_utilisateur for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy donnees_sauvegarde_lire      on public.donnees_sauvegarde for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_sauvegarde_inserer   on public.donnees_sauvegarde for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_sauvegarde_modifier  on public.donnees_sauvegarde for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_sauvegarde_supprimer on public.donnees_sauvegarde for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy donnees_quarantaine_lire      on public.donnees_quarantaine for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_quarantaine_inserer   on public.donnees_quarantaine for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_quarantaine_modifier  on public.donnees_quarantaine for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy donnees_quarantaine_supprimer on public.donnees_quarantaine for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy frais_reels_lire      on public.frais_reels for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy frais_reels_inserer   on public.frais_reels for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy frais_reels_modifier  on public.frais_reels for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy frais_reels_supprimer on public.frais_reels for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy biens_amortis_lire      on public.biens_amortis for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy biens_amortis_inserer   on public.biens_amortis for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy biens_amortis_modifier  on public.biens_amortis for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy biens_amortis_supprimer on public.biens_amortis for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy identite_declarative_lire      on public.identite_declarative for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy identite_declarative_inserer   on public.identite_declarative for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy identite_declarative_modifier  on public.identite_declarative for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy identite_declarative_supprimer on public.identite_declarative for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

create policy documents_lire      on public.documents for select to authenticated using (auth.uid() is not null and auth.uid() = user_id);
create policy documents_inserer   on public.documents for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id);
create policy documents_modifier  on public.documents for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id);
create policy documents_supprimer on public.documents for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- STOCKAGE DES FICHIERS — bucket PRIVÉ, un dossier par utilisateur
--
-- `public = false` : aucun fichier n'est accessible par URL devinable. L'accès passe par une URL
-- signée à durée limitée, délivrée seulement si les politiques ci-dessous le permettent.
--
-- Convention de chemin : <user_id>/<annee>/<type>/<uuid>-<nom>. L'identifiant en PREMIER segment,
-- parce que c'est exactement ce que `storage.foldername(name)[1]` sait lire — la sécurité doit être
-- vérifiable par la base, pas déduite du reste du chemin.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('justificatifs', 'justificatifs', false)
on conflict (id) do nothing;

create policy justificatifs_lire on storage.objects
  for select to authenticated
  using (
    bucket_id = 'justificatifs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy justificatifs_deposer on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'justificatifs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy justificatifs_remplacer on storage.objects
  for update to authenticated
  using (
    bucket_id = 'justificatifs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy justificatifs_supprimer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'justificatifs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
