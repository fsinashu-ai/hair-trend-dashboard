-- Phase 11: ad CSV import tables.
create table if not exists public.ad_csv_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  platform text not null,
  import_type text not null,
  file_name text not null,
  file_hash text not null,
  period_start date not null,
  period_end date not null,
  report_month date not null,
  comparison_label text not null default '',
  row_count integer not null default 0,
  valid_row_count integer not null default 0,
  invalid_row_count integer not null default 0,
  warning_count integer not null default 0,
  total_cost numeric(14,2) not null default 0,
  total_impressions bigint not null default 0,
  total_clicks bigint not null default 0,
  total_conversions numeric(14,4) not null default 0,
  average_ctr numeric(10,8) not null default 0,
  average_cpc numeric(14,4) not null default 0,
  average_cpa numeric(14,4) not null default 0,
  status text not null default 'preview',
  error_message text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_csv_imports_platform_check check (
    platform in ('google', 'meta', 'instagram', 'facebook', 'line', 'other')
  ),
  constraint ad_csv_imports_import_type_check check (
    import_type in ('campaign', 'ad_group', 'ad', 'keyword', 'search_term', 'daily', 'unknown')
  ),
  constraint ad_csv_imports_status_check check (
    status in ('preview', 'imported', 'failed')
  ),
  constraint ad_csv_imports_period_check check (period_end >= period_start)
);

create table if not exists public.ad_csv_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  import_id uuid not null references public.ad_csv_imports(id) on delete cascade,
  platform text not null,
  row_type text not null,
  record_date date,
  campaign_name text,
  ad_group_name text,
  ad_name text,
  keyword text,
  search_term text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(10,8) not null default 0,
  cost numeric(14,2) not null default 0,
  conversions numeric(14,4) not null default 0,
  cpa numeric(14,4) not null default 0,
  cpc numeric(14,4) not null default 0,
  cpm numeric(14,4) not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  landing_page_views bigint not null default 0,
  final_url text,
  status text,
  device text,
  area text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ad_csv_rows_platform_check check (
    platform in ('google', 'meta', 'instagram', 'facebook', 'line', 'other')
  ),
  constraint ad_csv_rows_row_type_check check (
    row_type in ('campaign', 'ad_group', 'ad', 'keyword', 'search_term', 'daily', 'unknown')
  )
);

create index if not exists ad_csv_imports_user_period_idx on public.ad_csv_imports (user_id, period_end desc);
create index if not exists ad_csv_imports_duplicate_idx on public.ad_csv_imports (file_hash, file_name, platform, import_type, period_start, period_end, valid_row_count);
create index if not exists ad_csv_rows_import_idx on public.ad_csv_rows (import_id);
create index if not exists ad_csv_rows_campaign_idx on public.ad_csv_rows (campaign_name) where campaign_name is not null;
create index if not exists ad_csv_rows_keyword_idx on public.ad_csv_rows (keyword) where keyword is not null;
create index if not exists ad_csv_rows_search_term_idx on public.ad_csv_rows (search_term) where search_term is not null;

drop trigger if exists set_ad_csv_imports_updated_at on public.ad_csv_imports;
create trigger set_ad_csv_imports_updated_at before update on public.ad_csv_imports
for each row execute function public.set_updated_at();

alter table public.ad_csv_imports enable row level security;
alter table public.ad_csv_rows enable row level security;

revoke all on table public.ad_csv_imports, public.ad_csv_rows from anon;
grant select, insert, update, delete on table public.ad_csv_imports, public.ad_csv_rows to authenticated, service_role;

drop policy if exists "authenticated_ad_csv_imports_select" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_select" on public.ad_csv_imports for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_insert" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_insert" on public.ad_csv_imports for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_update" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_update" on public.ad_csv_imports for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_delete" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_delete" on public.ad_csv_imports for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "authenticated_ad_csv_rows_select" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_select" on public.ad_csv_rows for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_insert" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_insert" on public.ad_csv_rows for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_update" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_update" on public.ad_csv_rows for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_delete" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_delete" on public.ad_csv_rows for delete to authenticated
using ((select auth.uid()) = user_id);
