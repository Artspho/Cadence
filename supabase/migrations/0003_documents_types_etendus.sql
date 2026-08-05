-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Phase 6 — extension de `type_document` (5 → 10 valeurs), AVANT tout code de stockage réel.
--
-- CONTEXTE. Cadence va cesser de jeter les documents déposés (canal IA, canal local, frais réels) et
-- les conserver réellement dans le bucket `justificatifs` + la table `documents` (migration 0001).
-- Le canal IA (`src/types/extraction.ts`, `typeDocumentDetecte`) reconnaît 9 types de documents ;
-- la contrainte posée en 0001 n'en couvre que 5. Sans cette extension, un document reconnu par l'IA
-- comme `attestation_cpam`, `justificatif_declaration` ou `attestation_taux_pas` n'aurait AUCUNE
-- case d'arrivée valide — l'insertion échouerait, et le fichier serait perdu pour l'utilisateur
-- (devoir sacré n°1). Validé avec Benoît le 05/08/2026, session 8, comme extension explicite de
-- l'arbitrage 7 (« les deux axes ») qu'il avait posé le 04/08/2026 — pas une décision prise seul.
--
-- LES 5 VALEURS AJOUTÉES, ET POURQUOI :
--  - `attestation_cpam`      : arrêt maladie, maternité, accident du travail. Déjà détectée par
--                              l'IA depuis le 01/08/2026 (`extraction.ts`), jamais eu de case ici.
--  - `justificatif_declaration` : le récapitulatif reçu après l'actualisation mensuelle. Idem.
--  - `attestation_taux_pas`  : attestation de taux de prélèvement à la source. Idem.
--  - `document_non_classe`   : l'IA n'a rien reconnu (`non_reconnu`), mais le fichier existe et doit
--                              quand même être gardé (devoir n°1) — JAMAIS choisi automatiquement,
--                              toujours par un sélecteur explicite affiché à l'utilisateur (même
--                              philosophie que le traitement de l'OCR illisible ailleurs dans Cadence).
--  - `planning_travail`      : planning de travail / feuille de route. AUCUNE détection IA ne le
--                              couvre ni ne le couvrira dans ce commit — toujours choisi à la main
--                              au dépôt. Prépare un chantier futur (remplissage automatique d'un
--                              agenda synchronisé), qui N'EST PAS construit ici : seul le stockage
--                              du document est couvert par cette migration et son code applicatif.
--
-- ⚠️ LA CONTRAINTE À REMPLACER EST ANONYME (déclarée en ligne dans la migration 0001 : `type_document
-- text not null check (type_document in (...))`), donc son nom a été choisi automatiquement par
-- Postgres — ne JAMAIS le deviner en dur dans un DROP CONSTRAINT, une session future pourrait tourner
-- contre un projet où ce nom diffère. Le bloc ci-dessous le retrouve dynamiquement, en ciblant
-- PRÉCISÉMENT la forme que Postgres donne à un `IN (...)` simple (`CHECK ((col = ANY (ARRAY[...])))`)
-- — et surtout PAS `categorie_frais_reservee_aux_justificatifs`, l'autre contrainte de cette table,
-- qui mentionne aussi `type_document` dans sa définition mais a une forme structurellement différente
-- (une contrainte NOMMÉE, à deux branches liées par OR). La confondre supprimerait la mauvaise règle.
-- Si aucune contrainte ne correspond à ce filtre, le bloc lève une exception explicite plutôt que de
-- continuer en silence : mieux vaut un échec bruyant au collage qu'une migration qui n'a rien fait.
--
-- ⚠️⚠️ NON VÉRIFIÉ AU 05/08/2026 — CE SQL N'A JAMAIS ÉTÉ EXÉCUTÉ, mêmes conditions qu'en 0001/0002
-- (pas de Docker ni Postgres local sur la machine de développement). À appliquer par Benoît dans
-- l'éditeur SQL de Supabase, en le regardant, puis à prouver par `npm run verifier:documents`
-- (commit suivant) avant de dire cette migration acquise.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  nom_contrainte text;
begin
  select con.conname into nom_contrainte
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'documents'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like 'CHECK ((type_document = ANY (ARRAY[%';

  if nom_contrainte is null then
    raise exception 'Contrainte CHECK de type_document introuvable sur public.documents — la migration 0001 a-t-elle bien été appliquée ? Arrêt volontaire plutôt que de continuer sans savoir quoi remplacer.';
  end if;

  execute format('alter table public.documents drop constraint %I', nom_contrainte);
end $$;

alter table public.documents add constraint documents_type_document_check check (
  type_document in (
    'aem_bulletin',
    'notification_are',
    'releve_situation',
    'declaration_fiscale',
    'justificatif_frais',
    'attestation_cpam',
    'justificatif_declaration',
    'attestation_taux_pas',
    'document_non_classe',
    'planning_travail'
  )
);

commit;
