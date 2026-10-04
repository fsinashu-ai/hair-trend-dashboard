-- Apify/n8n import observability and idempotency additions.
-- Additive migration. Apply after the existing social import SQL.

create table if not exists public.social_import_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'Apify',
  source_name text not null default 'Apify',
  actor_id text,
  actor_run_id text,
  dataset_id text,
  request_id text,
  idempotency_key text,
  status text not null default 'running',
  received_count integer not null default 0,
  normalized_count integer not null default 0,
  saved_count integer not null default 0,
  duplicate_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  ai_classified_count integer not null default 0,
  source_matched_count integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_import_runs add column if not exists provider text not null default 'Apify';
alter table public.social_import_runs add column if not exists source_name text not null default 'Apify';
alter table public.social_import_runs add column if not exists actor_id text;
alter table public.social_import_runs add column if not exists actor_run_id text;
alter table public.social_import_runs add column if not exists dataset_id text;
alter table public.social_import_runs add column if not exists request_id text;
alter table public.social_import_runs add column if not exists idempotency_key text;
alter table public.social_import_runs add column if not exists status text not null default 'running';
alter table public.social_import_runs add column if not exists received_count integer not null default 0;
alter table public.social_import_runs add column if not exists normalized_count integer not null default 0;
alter table public.social_import_runs add column if not exists saved_count integer not null default 0;
alter table public.social_import_runs add column if not exists duplicate_count integer not null default 0;
alter table public.social_import_runs add column if not exists skipped_count integer not null default 0;
alter table public.social_import_runs add column if not exists error_count integer not null default 0;
alter table public.social_import_runs add column if not exists ai_classified_count integer not null default 0;
alter table public.social_import_runs add column if not exists source_matched_count integer not null default 0;
alter table public.social_import_runs add column if not exists error_summary text;
alter table public.social_import_runs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.social_import_runs add column if not exists started_at timestamptz not null default now();
alter table public.social_import_runs add column if not exists finished_at timestamptz;
alter table public.social_import_runs add column if not exists created_at timestamptz not null default now();
alter table public.social_import_runs add column if not exists updated_at timestamptz not null default now();

alter table public.social_posts add column if not exists provider text not null default '';
alter table public.social_posts add column if not exists actor_id text;
alter table public.social_posts add column if not exists actor_run_id text;
alter table public.social_posts add column if not exists dataset_id text;
alter table public.social_posts add column if not exists import_run_id uuid;
alter table public.social_posts add column if not exists import_key text;
alter table public.social_posts add column if not exists payload_hash text;
alter table public.social_posts add column if not exists classification_provider text;
alter table public.social_posts add column if not exists classification_model text;
alter table public.social_posts add column if not exists classification_status text;
alter table public.social_posts add column if not exists classification_error text;
alter table public.social_posts add column if not exists classified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_posts_import_run_id_fkey'
  ) then
    alter table public.social_posts
    add constraint social_posts_import_run_id_fkey
    foreign key (import_run_id)
    references public.social_import_runs(id)
    on delete set null;
  end if;
end
$$;

alter table public.social_import_runs drop constraint if exists social_import_runs_status_check;
alter table public.social_import_runs add constraint social_import_runs_status_check
check (status in ('running', 'success', 'partial', 'failed', 'no_items', 'preview'));

alter table public.social_import_runs drop constraint if exists social_import_runs_counts_check;
alter table public.social_import_runs add constraint social_import_runs_counts_check
check (
  received_count >= 0 and normalized_count >= 0 and saved_count >= 0
  and duplicate_count >= 0 and skipped_count >= 0 and error_count >= 0
  and ai_classified_count >= 0 and source_matched_count >= 0
);

create index if not exists social_import_runs_started_at_idx
on public.social_import_runs (started_at desc);

create index if not exists social_import_runs_status_idx
on public.social_import_runs (status, started_at desc);

create unique index if not exists social_import_runs_idempotency_uidx
on public.social_import_runs (provider, idempotency_key)
where idempotency_key is not null and idempotency_key <> '';

create index if not exists social_posts_import_run_id_idx
on public.social_posts (import_run_id);

create index if not exists social_posts_import_key_idx
on public.social_posts (import_key)
where import_key is not null and import_key <> '';

create unique index if not exists social_posts_import_key_uidx
on public.social_posts (import_key)
where import_key is not null and import_key <> '';

create index if not exists social_posts_classification_status_idx
on public.social_posts (classification_status, imported_at desc);

alter table public.social_import_runs enable row level security;

revoke all on table public.social_import_runs from anon, authenticated;
grant select, insert, update on table public.social_import_runs to service_role;
