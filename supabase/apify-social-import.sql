-- Apify/n8n social import additions.
-- Run this after the main schema.sql if your social_posts table already exists.

alter table public.social_posts add column if not exists source_name text not null default '';
alter table public.social_posts add column if not exists account_name text not null default '';
alter table public.social_posts add column if not exists handle text not null default '';
alter table public.social_posts add column if not exists external_id text not null default '';
alter table public.social_posts add column if not exists like_count integer;
alter table public.social_posts add column if not exists comment_count integer;
alter table public.social_posts add column if not exists play_count integer;
alter table public.social_posts add column if not exists share_count integer;
alter table public.social_posts add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.social_posts drop constraint if exists social_posts_like_count_check;
alter table public.social_posts add constraint social_posts_like_count_check
check (like_count is null or like_count >= 0);

alter table public.social_posts drop constraint if exists social_posts_comment_count_check;
alter table public.social_posts add constraint social_posts_comment_count_check
check (comment_count is null or comment_count >= 0);

alter table public.social_posts drop constraint if exists social_posts_play_count_check;
alter table public.social_posts add constraint social_posts_play_count_check
check (play_count is null or play_count >= 0);

alter table public.social_posts drop constraint if exists social_posts_share_count_check;
alter table public.social_posts add constraint social_posts_share_count_check
check (share_count is null or share_count >= 0);

create index if not exists social_posts_source_name_idx
on public.social_posts (source_name);

create index if not exists social_posts_handle_idx
on public.social_posts (handle);

create index if not exists social_posts_external_id_idx
on public.social_posts (external_id);
