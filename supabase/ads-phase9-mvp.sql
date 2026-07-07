-- Phase 9: manual ad management MVP additions.
-- Run this after supabase/seo-ads-mvp.sql if ad tables already exist.
-- This does not connect to Google Ads or Meta APIs and does not change budgets automatically.

begin;

alter table if exists public.ad_campaign_notes
  add column if not exists ad_group_name text not null default '',
  add column if not exists status text not null default 'planning',
  add column if not exists target_audience text not null default '',
  add column if not exists monthly_budget numeric(12, 2) not null default 0,
  add column if not exists daily_budget numeric(12, 2) not null default 0,
  add column if not exists creative_memo text not null default '';

alter table if exists public.ad_reports
  add column if not exists ad_group_name text not null default '',
  add column if not exists impressions bigint not null default 0,
  add column if not exists ctr numeric(7, 4) not null default 0,
  add column if not exists inquiries bigint not null default 0,
  add column if not exists reservations bigint not null default 0,
  add column if not exists target_area text not null default '',
  add column if not exists target_audience text not null default '',
  add column if not exists landing_page_url text not null default '',
  add column if not exists offer text not null default '',
  add column if not exists status text not null default 'reviewing';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ad_campaign_notes_phase9_budget_check'
      and conrelid = 'public.ad_campaign_notes'::regclass
  ) then
    alter table public.ad_campaign_notes
      add constraint ad_campaign_notes_phase9_budget_check
      check (monthly_budget >= 0 and daily_budget >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ad_reports_phase9_metrics_check'
      and conrelid = 'public.ad_reports'::regclass
  ) then
    alter table public.ad_reports
      add constraint ad_reports_phase9_metrics_check
      check (
        impressions >= 0
        and ctr >= 0
        and inquiries >= 0
        and reservations >= 0
      );
  end if;
end $$;

create index if not exists ad_campaign_notes_status_idx
on public.ad_campaign_notes (status);

create index if not exists ad_reports_status_idx
on public.ad_reports (status);

commit;
