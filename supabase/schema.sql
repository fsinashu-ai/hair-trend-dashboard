-- Hair Trend Dashboard Supabase schema
-- Run this file in the Supabase SQL Editor.
-- This app is for personal/salon-internal use. Protect public deployments with APP_PASSWORD.

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

create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  memo text not null default '',
  use_count integer not null default 0,
  priority text not null default '中',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.keywords add column if not exists category text not null default 'レディース';
alter table public.keywords add column if not exists memo text not null default '';
alter table public.keywords add column if not exists use_count integer not null default 0;
alter table public.keywords add column if not exists priority text not null default '中';
alter table public.keywords alter column priority set default '中';
alter table public.keywords alter column use_count set default 0;
update public.keywords
set priority = '中'
where priority is null or priority not in ('高', '中', '低');
alter table public.keywords drop constraint if exists keywords_priority_check;
alter table public.keywords drop constraint if exists keywords_use_count_check;
alter table public.keywords add constraint keywords_priority_check check (priority in ('高', '中', '低'));
alter table public.keywords add constraint keywords_use_count_check check (use_count >= 0);

create table if not exists public.trend_links (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  category text not null,
  memo text not null default '',
  registered_at date not null default current_date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trend_links add column if not exists tags text[] not null default '{}';
alter table public.trend_links add column if not exists registered_at date not null default current_date;
alter table public.trend_links add column if not exists memo text not null default '';

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  post_type text not null,
  tone text not null,
  prompt text not null default '',
  content text not null,
  used_keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_outputs add column if not exists prompt text not null default '';
alter table public.ai_outputs add column if not exists used_keywords text[] not null default '{}';

create table if not exists public.trend_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  source_type text not null default 'RSS',
  is_active boolean not null default true,
  memo text not null default '',
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trend_sources add column if not exists source_type text not null default 'RSS';
alter table public.trend_sources add column if not exists is_active boolean not null default true;
alter table public.trend_sources add column if not exists memo text not null default '';
alter table public.trend_sources add column if not exists last_fetched_at timestamptz;
alter table public.trend_sources alter column source_type set default 'RSS';
update public.trend_sources
set source_type = 'RSS'
where source_type is null
  or source_type not in ('RSS', '公式サイト', '自社サイト', 'メーカー', '美容ディーラー', '美容メディア');
alter table public.trend_sources drop constraint if exists trend_sources_source_type_check;
alter table public.trend_sources add constraint trend_sources_source_type_check
check (source_type in ('RSS', '公式サイト', '自社サイト', 'メーカー', '美容ディーラー', '美容メディア'));

create table if not exists public.sns_posts (
  id uuid primary key default gen_random_uuid(),
  sns_type text not null default 'Other',
  url text not null,
  title text not null,
  memo text not null default '',
  category text not null default 'SNS投稿',
  tags text[] not null default '{}',
  ai_summary text not null default '',
  post_idea text not null default '',
  counseling_idea text not null default '',
  saved_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sns_posts add column if not exists sns_type text not null default 'Other';
alter table public.sns_posts add column if not exists memo text not null default '';
alter table public.sns_posts add column if not exists category text not null default 'SNS投稿';
alter table public.sns_posts add column if not exists tags text[] not null default '{}';
alter table public.sns_posts add column if not exists ai_summary text not null default '';
alter table public.sns_posts add column if not exists post_idea text not null default '';
alter table public.sns_posts add column if not exists counseling_idea text not null default '';
alter table public.sns_posts add column if not exists saved_at date not null default current_date;
alter table public.sns_posts alter column sns_type set default 'Other';
update public.sns_posts
set sns_type = 'Other'
where sns_type is null or sns_type not in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other');
alter table public.sns_posts drop constraint if exists sns_posts_sns_type_check;
alter table public.sns_posts add constraint sns_posts_sns_type_check
check (sns_type in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other'));

create index if not exists keywords_name_idx on public.keywords (name);
create index if not exists keywords_category_idx on public.keywords (category);
create index if not exists trend_links_category_idx on public.trend_links (category);
create index if not exists trend_links_registered_at_idx on public.trend_links (registered_at desc);
create index if not exists ai_outputs_created_at_idx on public.ai_outputs (created_at desc);
create index if not exists trend_sources_is_active_idx on public.trend_sources (is_active);
create index if not exists trend_sources_source_type_idx on public.trend_sources (source_type);
create index if not exists sns_posts_sns_type_idx on public.sns_posts (sns_type);
create index if not exists sns_posts_category_idx on public.sns_posts (category);
create index if not exists sns_posts_saved_at_idx on public.sns_posts (saved_at desc);

drop trigger if exists set_keywords_updated_at on public.keywords;
create trigger set_keywords_updated_at
before update on public.keywords
for each row
execute function public.set_updated_at();

drop trigger if exists set_trend_links_updated_at on public.trend_links;
create trigger set_trend_links_updated_at
before update on public.trend_links
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_outputs_updated_at on public.ai_outputs;
create trigger set_ai_outputs_updated_at
before update on public.ai_outputs
for each row
execute function public.set_updated_at();

drop trigger if exists set_trend_sources_updated_at on public.trend_sources;
create trigger set_trend_sources_updated_at
before update on public.trend_sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_sns_posts_updated_at on public.sns_posts;
create trigger set_sns_posts_updated_at
before update on public.sns_posts
for each row
execute function public.set_updated_at();

alter table public.keywords enable row level security;
alter table public.trend_links enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.trend_sources enable row level security;
alter table public.sns_posts enable row level security;

-- Personal-use policies:
-- The current app uses the public anon key from the browser, so these policies allow
-- anon/authenticated clients to read and write the app tables.
-- For Vercel/public URLs, set APP_PASSWORD so the app, API routes, and static JS are
-- protected before the anon key can be read.
-- For multi-user production, replace these policies with Supabase Auth user-specific rules.
drop policy if exists "mvp_keywords_all" on public.keywords;
drop policy if exists "personal_keywords_all" on public.keywords;
create policy "personal_keywords_all"
on public.keywords
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_trend_links_all" on public.trend_links;
drop policy if exists "personal_trend_links_all" on public.trend_links;
create policy "personal_trend_links_all"
on public.trend_links
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_ai_outputs_all" on public.ai_outputs;
drop policy if exists "personal_ai_outputs_all" on public.ai_outputs;
create policy "personal_ai_outputs_all"
on public.ai_outputs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "personal_trend_sources_all" on public.trend_sources;
create policy "personal_trend_sources_all"
on public.trend_sources
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "personal_sns_posts_all" on public.sns_posts;
create policy "personal_sns_posts_all"
on public.sns_posts
for all
to anon, authenticated
using (true)
with check (true);

-- Storage bucket for uploaded hair images.
-- The bucket is private for personal use. The app only needs upload/delete access.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hair-images',
  'hair-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mvp_hair_images_select" on storage.objects;
drop policy if exists "personal_hair_images_select" on storage.objects;

drop policy if exists "mvp_hair_images_insert" on storage.objects;
drop policy if exists "personal_hair_images_insert" on storage.objects;
create policy "personal_hair_images_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'hair-images');

drop policy if exists "mvp_hair_images_delete" on storage.objects;
drop policy if exists "personal_hair_images_delete" on storage.objects;
create policy "personal_hair_images_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'hair-images');
