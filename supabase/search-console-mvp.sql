-- Google Search Console CSV import and Gemini SEO analysis MVP.
-- Run once in Supabase SQL Editor after the existing schema.

begin;

create table if not exists public.seo_search_console_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  import_type text not null,
  file_name text not null,
  period_start date not null,
  period_end date not null,
  report_month date not null,
  comparison_label text not null default '',
  memo text not null default '',
  row_count integer not null default 0,
  excluded_row_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'preview',
  error_message text not null default '',
  content_hash text not null,
  total_clicks bigint not null default 0,
  total_impressions bigint not null default 0,
  average_ctr numeric(10, 8) not null default 0,
  average_position numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_sc_import_type_check check (import_type in ('query', 'page', 'device', 'country', 'date')),
  constraint seo_sc_import_status_check check (status in ('preview', 'imported', 'analyzed', 'failed')),
  constraint seo_sc_import_period_check check (period_end >= period_start),
  constraint seo_sc_import_counts_check check (row_count >= 0 and excluded_row_count >= 0 and warning_count >= 0),
  constraint seo_sc_import_metrics_check check (total_clicks >= 0 and total_impressions >= 0 and average_ctr >= 0 and average_ctr <= 1 and average_position >= 0)
);

create table if not exists public.seo_search_console_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  import_id uuid not null references public.seo_search_console_imports(id) on delete cascade,
  row_type text not null,
  query text,
  page_url text,
  device text,
  country text,
  record_date date,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric(10, 8) not null default 0,
  position numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  constraint seo_sc_row_type_check check (row_type in ('query', 'page', 'device', 'country', 'date')),
  constraint seo_sc_row_metrics_check check (clicks >= 0 and impressions >= 0 and ctr >= 0 and ctr <= 1 and position >= 0),
  constraint seo_sc_row_subject_check check (
    nullif(query, '') is not null or nullif(page_url, '') is not null or
    nullif(device, '') is not null or nullif(country, '') is not null or record_date is not null
  )
);

alter table public.seo_reports add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.seo_reports add column if not exists search_console_import_id uuid references public.seo_search_console_imports(id) on delete set null;
alter table public.seo_reports add column if not exists comparison jsonb not null default '{}'::jsonb;
alter table public.seo_reports add column if not exists analysis_json jsonb not null default '{}'::jsonb;
alter table public.seo_reports add column if not exists positive_points text[] not null default '{}';
alter table public.seo_reports add column if not exists negative_points text[] not null default '{}';
alter table public.seo_reports add column if not exists priority_keywords jsonb not null default '[]'::jsonb;
alter table public.seo_reports add column if not exists priority_pages jsonb not null default '[]'::jsonb;
alter table public.seo_reports add column if not exists new_article_ideas jsonb not null default '[]'::jsonb;
alter table public.seo_reports add column if not exists generated_by text not null default 'manual';
alter table public.seo_reports add column if not exists ai_model text not null default '';
alter table public.seo_reports add column if not exists input_hash text not null default '';
alter table public.seo_reports add column if not exists analyzed_at timestamptz;

alter table public.seo_tasks add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.seo_tasks add column if not exists reason text not null default '';
alter table public.seo_tasks add column if not exists source_search_console_import_id uuid references public.seo_search_console_imports(id) on delete set null;
alter table public.blog_posts add column if not exists source_search_console_import_id uuid references public.seo_search_console_imports(id) on delete set null;

update public.seo_reports set generated_by = 'manual'
where generated_by is null or generated_by not in ('gemini', 'mock', 'manual');
alter table public.seo_reports drop constraint if exists seo_reports_generated_by_check;
alter table public.seo_reports add constraint seo_reports_generated_by_check
check (generated_by in ('gemini', 'mock', 'manual'));

create index if not exists seo_sc_imports_user_period_idx on public.seo_search_console_imports (user_id, period_end desc);
create index if not exists seo_sc_imports_hash_idx on public.seo_search_console_imports (content_hash, import_type, period_start, period_end);
create index if not exists seo_sc_rows_import_idx on public.seo_search_console_rows (import_id);
create index if not exists seo_sc_rows_query_idx on public.seo_search_console_rows (query) where query is not null;
create index if not exists seo_sc_rows_page_idx on public.seo_search_console_rows (page_url) where page_url is not null;
create index if not exists seo_reports_sc_import_idx on public.seo_reports (search_console_import_id, created_at desc);
create index if not exists seo_tasks_sc_import_idx on public.seo_tasks (source_search_console_import_id);

drop trigger if exists set_seo_sc_imports_updated_at on public.seo_search_console_imports;
create trigger set_seo_sc_imports_updated_at before update on public.seo_search_console_imports
for each row execute function public.set_updated_at();

alter table public.seo_search_console_imports enable row level security;
alter table public.seo_search_console_rows enable row level security;

revoke all on table public.seo_search_console_imports, public.seo_search_console_rows from anon;
grant select, insert, update, delete on table public.seo_search_console_imports, public.seo_search_console_rows to authenticated, service_role;

drop policy if exists "authenticated_seo_sc_imports_own" on public.seo_search_console_imports;
create policy "authenticated_seo_sc_imports_own" on public.seo_search_console_imports
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_sc_rows_own" on public.seo_search_console_rows;
create policy "authenticated_seo_sc_rows_own" on public.seo_search_console_rows
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_reports_all" on public.seo_reports;
drop policy if exists "authenticated_seo_reports_select" on public.seo_reports;
drop policy if exists "authenticated_seo_reports_insert" on public.seo_reports;
drop policy if exists "authenticated_seo_reports_update" on public.seo_reports;
drop policy if exists "authenticated_seo_reports_delete" on public.seo_reports;
create policy "authenticated_seo_reports_select" on public.seo_reports for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
create policy "authenticated_seo_reports_insert" on public.seo_reports for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "authenticated_seo_reports_update" on public.seo_reports for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "authenticated_seo_reports_delete" on public.seo_reports for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_tasks_all" on public.seo_tasks;
drop policy if exists "authenticated_seo_tasks_select" on public.seo_tasks;
drop policy if exists "authenticated_seo_tasks_insert" on public.seo_tasks;
drop policy if exists "authenticated_seo_tasks_update" on public.seo_tasks;
drop policy if exists "authenticated_seo_tasks_delete" on public.seo_tasks;
create policy "authenticated_seo_tasks_select" on public.seo_tasks for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
create policy "authenticated_seo_tasks_insert" on public.seo_tasks for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "authenticated_seo_tasks_update" on public.seo_tasks for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "authenticated_seo_tasks_delete" on public.seo_tasks for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
