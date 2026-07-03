-- Phase 6: existing published blog management and rewrite history.
-- Run this file once in the Supabase SQL Editor.

begin;

create table if not exists public.published_blog_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  url text not null,
  normalized_url text not null,
  canonical_url text not null default '',
  category text not null default '髪質改善',
  status text not null default 'published',
  target_keyword text not null default '',
  secondary_keywords text[] not null default '{}',
  published_at date,
  last_updated_at date,
  source_type text not null default 'manual',
  memo text not null default '',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_blog_articles_status_check check (
    status in ('published', 'needs_rewrite', 'rewriting', 'updated', 'archived')
  ),
  constraint published_blog_articles_source_type_check check (
    source_type in ('manual', 'csv', 'sitemap')
  ),
  constraint published_blog_articles_url_check check (url ~* '^https?://'),
  constraint published_blog_articles_normalized_url_check check (normalized_url <> '')
);

create table if not exists public.blog_rewrite_histories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  article_id uuid not null references public.published_blog_articles(id) on delete cascade,
  source_search_console_import_id uuid references public.seo_search_console_imports(id) on delete set null,
  before_title text not null default '',
  before_meta_description text not null default '',
  suggested_title text not null default '',
  suggested_meta_description text not null default '',
  suggested_headings text[] not null default '{}',
  suggested_faq jsonb not null default '[]'::jsonb,
  internal_link_suggestions text[] not null default '{}',
  cta_suggestion text not null default '',
  rewrite_reason text not null default '',
  suggestion_json jsonb not null default '{}'::jsonb,
  generated_by text not null default 'gemini',
  ai_model text not null default '',
  status text not null default 'proposal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_rewrite_histories_generated_by_check check (
    generated_by in ('gemini', 'mock', 'manual')
  ),
  constraint blog_rewrite_histories_status_check check (
    status in ('proposal', 'applied', 'dismissed')
  )
);

create unique index if not exists published_blog_articles_normalized_url_uidx
on public.published_blog_articles (normalized_url);

create index if not exists published_blog_articles_user_status_idx
on public.published_blog_articles (user_id, status, updated_at desc);

create index if not exists published_blog_articles_target_keyword_idx
on public.published_blog_articles (target_keyword)
where target_keyword <> '';

create index if not exists blog_rewrite_histories_article_created_idx
on public.blog_rewrite_histories (article_id, created_at desc);

create index if not exists blog_rewrite_histories_user_created_idx
on public.blog_rewrite_histories (user_id, created_at desc);

drop trigger if exists set_published_blog_articles_updated_at on public.published_blog_articles;
create trigger set_published_blog_articles_updated_at
before update on public.published_blog_articles
for each row execute function public.set_updated_at();

drop trigger if exists set_blog_rewrite_histories_updated_at on public.blog_rewrite_histories;
create trigger set_blog_rewrite_histories_updated_at
before update on public.blog_rewrite_histories
for each row execute function public.set_updated_at();

alter table public.published_blog_articles enable row level security;
alter table public.blog_rewrite_histories enable row level security;

revoke all on table public.published_blog_articles, public.blog_rewrite_histories from anon;
grant select, insert, update, delete on table
  public.published_blog_articles,
  public.blog_rewrite_histories
to authenticated, service_role;

drop policy if exists "authenticated_published_blog_articles_own" on public.published_blog_articles;
create policy "authenticated_published_blog_articles_own"
on public.published_blog_articles
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_blog_rewrite_histories_own" on public.blog_rewrite_histories;
create policy "authenticated_blog_rewrite_histories_own"
on public.blog_rewrite_histories
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
