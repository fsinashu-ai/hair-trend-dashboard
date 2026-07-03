-- SEO and ads assistant MVP tables for ef.mayke`s.
-- Run this file in the Supabase SQL Editor after the main schema.

begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  intent text not null default '',
  priority text not null default 'medium',
  target_page text not null default '',
  status text not null default 'tracking',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_keywords_priority_check check (priority in ('high', 'medium', 'low'))
);

create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  page_title text not null,
  page_url text not null,
  target_keyword text not null default '',
  current_issue text not null default '',
  suggested_action text not null default '',
  cta_memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  summary text not null default '',
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric(7, 4) not null default 0,
  average_position numeric(7, 2) not null default 0,
  ai_analysis text not null default '',
  next_actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_reports_metrics_check check (
    clicks >= 0 and impressions >= 0 and ctr >= 0 and average_position >= 0
  )
);

create table if not exists public.seo_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task_type text not null default 'other',
  priority text not null default 'medium',
  status text not null default 'todo',
  related_keyword text not null default '',
  related_page_url text not null default '',
  due_date date,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_tasks_priority_check check (priority in ('high', 'medium', 'low')),
  constraint seo_tasks_status_check check (status in ('todo', 'doing', 'done', 'hold'))
);

create table if not exists public.ad_campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  platform text not null,
  purpose text not null default '',
  target_area text not null default '',
  budget_memo text not null default '',
  offer text not null default '',
  landing_page_url text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  platform text not null,
  campaign_name text not null,
  cost numeric(12, 2) not null default 0,
  clicks bigint not null default 0,
  conversions bigint not null default 0,
  cpa numeric(12, 2) not null default 0,
  ai_analysis text not null default '',
  next_actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_reports_metrics_check check (
    cost >= 0 and clicks >= 0 and conversions >= 0 and cpa >= 0
  )
);

create index if not exists seo_keywords_priority_idx
on public.seo_keywords (priority);
create index if not exists seo_keywords_status_idx
on public.seo_keywords (status);
create index if not exists seo_pages_target_keyword_idx
on public.seo_pages (target_keyword);
create index if not exists seo_reports_month_idx
on public.seo_reports (report_month desc);
create index if not exists seo_tasks_status_due_date_idx
on public.seo_tasks (status, due_date);
create index if not exists ad_campaign_notes_platform_idx
on public.ad_campaign_notes (platform);
create index if not exists ad_reports_month_platform_idx
on public.ad_reports (report_month desc, platform);

drop trigger if exists set_seo_keywords_updated_at on public.seo_keywords;
create trigger set_seo_keywords_updated_at
before update on public.seo_keywords
for each row execute function public.set_updated_at();

drop trigger if exists set_seo_pages_updated_at on public.seo_pages;
create trigger set_seo_pages_updated_at
before update on public.seo_pages
for each row execute function public.set_updated_at();

drop trigger if exists set_seo_reports_updated_at on public.seo_reports;
create trigger set_seo_reports_updated_at
before update on public.seo_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_seo_tasks_updated_at on public.seo_tasks;
create trigger set_seo_tasks_updated_at
before update on public.seo_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_ad_campaign_notes_updated_at on public.ad_campaign_notes;
create trigger set_ad_campaign_notes_updated_at
before update on public.ad_campaign_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_ad_reports_updated_at on public.ad_reports;
create trigger set_ad_reports_updated_at
before update on public.ad_reports
for each row execute function public.set_updated_at();

alter table public.seo_keywords enable row level security;
alter table public.seo_pages enable row level security;
alter table public.seo_reports enable row level security;
alter table public.seo_tasks enable row level security;
alter table public.ad_campaign_notes enable row level security;
alter table public.ad_reports enable row level security;

grant usage on schema public to authenticated, service_role;
revoke all on table
  public.seo_keywords,
  public.seo_pages,
  public.seo_reports,
  public.seo_tasks,
  public.ad_campaign_notes,
  public.ad_reports
from anon;
grant select, insert, update, delete on table
  public.seo_keywords,
  public.seo_pages,
  public.seo_reports,
  public.seo_tasks,
  public.ad_campaign_notes,
  public.ad_reports
to authenticated, service_role;

drop policy if exists "authenticated_seo_keywords_all" on public.seo_keywords;
create policy "authenticated_seo_keywords_all"
on public.seo_keywords for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_seo_pages_all" on public.seo_pages;
create policy "authenticated_seo_pages_all"
on public.seo_pages for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_seo_reports_all" on public.seo_reports;
create policy "authenticated_seo_reports_all"
on public.seo_reports for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_seo_tasks_all" on public.seo_tasks;
create policy "authenticated_seo_tasks_all"
on public.seo_tasks for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_ad_campaign_notes_all" on public.ad_campaign_notes;
create policy "authenticated_ad_campaign_notes_all"
on public.ad_campaign_notes for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_ad_reports_all" on public.ad_reports;
create policy "authenticated_ad_reports_all"
on public.ad_reports for all to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

commit;
