-- Phase 10: Gemini ad creative generation.
-- This table stores generated ad copy proposals only.
-- It does not connect to Google Ads, Meta Ads, or change budgets automatically.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  campaign_id uuid,
  platform text not null default '',
  campaign_name text not null,
  objective text not null default '',
  target_area text not null default '',
  target_audience text not null default '',
  main_appeal text not null default '',
  input_keywords text[] not null default '{}',
  landing_page_url text not null default '',
  budget_memo text not null default '',
  current_issue text not null default '',
  desired_cta text not null default '',
  tone text not null default '',
  generated_content jsonb not null default '{}'::jsonb,
  google_headlines text[] not null default '{}',
  google_descriptions text[] not null default '{}',
  instagram_copies text[] not null default '{}',
  facebook_copies text[] not null default '{}',
  cta_suggestions text[] not null default '{}',
  lp_suggestions text[] not null default '{}',
  negative_keywords text[] not null default '{}',
  ab_test_ideas text[] not null default '{}',
  caution_expressions text[] not null default '{}',
  ai_provider text not null default 'gemini',
  ai_model text not null default '',
  status text not null default 'draft',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_creatives_status_check check (
    status in ('draft', 'reviewing', 'approved', 'used', 'archived')
  ),
  constraint ad_creatives_ai_provider_check check (
    ai_provider in ('gemini', 'mock', 'manual')
  )
);

create index if not exists ad_creatives_user_updated_idx
on public.ad_creatives (user_id, updated_at desc);

create index if not exists ad_creatives_status_idx
on public.ad_creatives (status);

create index if not exists ad_creatives_platform_idx
on public.ad_creatives (platform);

drop trigger if exists set_ad_creatives_updated_at on public.ad_creatives;
create trigger set_ad_creatives_updated_at
before update on public.ad_creatives
for each row execute function public.set_updated_at();

alter table public.ad_creatives enable row level security;

revoke all on table public.ad_creatives from anon;
grant select, insert, update, delete on table public.ad_creatives
to authenticated, service_role;

drop policy if exists "authenticated_ad_creatives_select" on public.ad_creatives;
create policy "authenticated_ad_creatives_select"
on public.ad_creatives for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "authenticated_ad_creatives_insert" on public.ad_creatives;
create policy "authenticated_ad_creatives_insert"
on public.ad_creatives for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_ad_creatives_update" on public.ad_creatives;
create policy "authenticated_ad_creatives_update"
on public.ad_creatives for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_ad_creatives_delete" on public.ad_creatives;
create policy "authenticated_ad_creatives_delete"
on public.ad_creatives for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
