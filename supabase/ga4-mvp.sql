-- Phase 7: GA4 CSV import and Gemini analysis MVP.
-- Run this in Supabase SQL Editor after the existing schema.

create table if not exists public.seo_ga4_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  file_name text not null,
  property_name text not null default '',
  period_start date not null,
  period_end date not null,
  report_month date not null,
  comparison_label text not null default '',
  memo text not null default '',
  row_count integer not null default 0,
  excluded_row_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'imported',
  error_message text not null default '',
  content_hash text not null default '',
  total_users integer not null default 0,
  total_sessions integer not null default 0,
  total_views integer not null default 0,
  average_engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  total_line_clicks integer not null default 0,
  total_reservation_clicks integer not null default 0,
  total_conversions integer not null default 0,
  landing_page_count integer not null default 0,
  source_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_ga4_import_status_check check (status in ('preview', 'imported', 'analyzed', 'failed')),
  constraint seo_ga4_import_period_check check (period_end >= period_start)
);

create table if not exists public.seo_ga4_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  import_id uuid not null references public.seo_ga4_imports(id) on delete cascade,
  landing_page text,
  page_title text,
  source_medium text,
  channel_group text,
  device_category text,
  event_name text,
  record_date date,
  users integer not null default 0,
  sessions integer not null default 0,
  views integer not null default 0,
  engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  line_clicks integer not null default 0,
  reservation_clicks integer not null default 0,
  conversions integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_ga4_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ga4_import_id uuid references public.seo_ga4_imports(id) on delete set null,
  report_month date not null,
  summary text not null default '',
  total_users integer not null default 0,
  total_sessions integer not null default 0,
  total_views integer not null default 0,
  average_engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  total_line_clicks integer not null default 0,
  total_reservation_clicks integer not null default 0,
  total_conversions integer not null default 0,
  ai_analysis text not null default '',
  analysis_json jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  next_actions text[] not null default '{}',
  generated_by text not null default 'mock',
  ai_model text not null default '',
  input_hash text not null default '',
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_ga4_reports_generated_by_check check (generated_by in ('gemini', 'mock', 'manual'))
);

create index if not exists seo_ga4_imports_user_period_idx on public.seo_ga4_imports (user_id, period_end desc);
create index if not exists seo_ga4_imports_hash_idx on public.seo_ga4_imports (content_hash, period_start, period_end);
create index if not exists seo_ga4_rows_import_idx on public.seo_ga4_rows (import_id);
create index if not exists seo_ga4_rows_landing_page_idx on public.seo_ga4_rows (landing_page) where landing_page is not null;
create index if not exists seo_ga4_rows_source_idx on public.seo_ga4_rows (source_medium) where source_medium is not null;
create index if not exists seo_ga4_reports_import_idx on public.seo_ga4_reports (ga4_import_id);
create index if not exists seo_ga4_reports_hash_idx on public.seo_ga4_reports (input_hash) where input_hash <> '';

drop trigger if exists set_seo_ga4_imports_updated_at on public.seo_ga4_imports;
create trigger set_seo_ga4_imports_updated_at before update on public.seo_ga4_imports
for each row execute function public.set_updated_at();

drop trigger if exists set_seo_ga4_reports_updated_at on public.seo_ga4_reports;
create trigger set_seo_ga4_reports_updated_at before update on public.seo_ga4_reports
for each row execute function public.set_updated_at();

alter table public.seo_ga4_imports enable row level security;
alter table public.seo_ga4_rows enable row level security;
alter table public.seo_ga4_reports enable row level security;

revoke all on table public.seo_ga4_imports, public.seo_ga4_rows, public.seo_ga4_reports from anon;
grant select, insert, update, delete on table public.seo_ga4_imports, public.seo_ga4_rows, public.seo_ga4_reports to authenticated, service_role;

drop policy if exists "authenticated_seo_ga4_imports_own" on public.seo_ga4_imports;
create policy "authenticated_seo_ga4_imports_own" on public.seo_ga4_imports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_ga4_rows_own" on public.seo_ga4_rows;
create policy "authenticated_seo_ga4_rows_own" on public.seo_ga4_rows
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_ga4_reports_own" on public.seo_ga4_reports;
create policy "authenticated_seo_ga4_reports_own" on public.seo_ga4_reports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
