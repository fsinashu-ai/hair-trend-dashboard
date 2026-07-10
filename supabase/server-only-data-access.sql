-- Personal-use security hardening for existing projects.
-- Run this file in the Supabase SQL Editor only after the application containing
-- the /api/supabase proxy has been deployed and SUPABASE_SERVICE_ROLE_KEY and
-- APP_PASSWORD are configured in Vercel.

begin;

alter table public.keywords enable row level security;
alter table public.trend_links enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.trend_sources enable row level security;
alter table public.sns_posts enable row level security;
alter table public.social_sources enable row level security;
alter table public.social_posts enable row level security;
alter table public.blog_posts enable row level security;

revoke all on table
  public.keywords,
  public.trend_links,
  public.ai_outputs,
  public.trend_sources,
  public.sns_posts,
  public.social_sources,
  public.social_posts,
  public.blog_posts
from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete
on table
  public.keywords,
  public.trend_links,
  public.ai_outputs,
  public.trend_sources,
  public.sns_posts,
  public.social_sources,
  public.social_posts,
  public.blog_posts
to service_role;

drop policy if exists "mvp_keywords_all" on public.keywords;
drop policy if exists "personal_keywords_all" on public.keywords;
drop policy if exists "mvp_trend_links_all" on public.trend_links;
drop policy if exists "personal_trend_links_all" on public.trend_links;
drop policy if exists "mvp_ai_outputs_all" on public.ai_outputs;
drop policy if exists "personal_ai_outputs_all" on public.ai_outputs;
drop policy if exists "personal_trend_sources_all" on public.trend_sources;
drop policy if exists "personal_sns_posts_all" on public.sns_posts;
drop policy if exists "personal_social_sources_all" on public.social_sources;
drop policy if exists "personal_social_posts_all" on public.social_posts;
drop policy if exists "personal_blog_posts_all" on public.blog_posts;

drop policy if exists "mvp_hair_images_select" on storage.objects;
drop policy if exists "personal_hair_images_select" on storage.objects;
drop policy if exists "mvp_hair_images_insert" on storage.objects;
drop policy if exists "personal_hair_images_insert" on storage.objects;
drop policy if exists "mvp_hair_images_delete" on storage.objects;
drop policy if exists "personal_hair_images_delete" on storage.objects;
grant select, insert, update, delete on table storage.objects to service_role;

commit;
