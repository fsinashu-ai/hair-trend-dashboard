-- Existing blog_posts extension for Gemini SEO blog drafts.
-- Run this file once in the Supabase SQL Editor.

alter table public.blog_posts add column if not exists secondary_keywords text[] not null default '{}';
alter table public.blog_posts add column if not exists search_intent text not null default '';
alter table public.blog_posts add column if not exists target_audience text not null default '';
alter table public.blog_posts add column if not exists reader_problems text[] not null default '{}';
alter table public.blog_posts add column if not exists meta_title text not null default '';
alter table public.blog_posts add column if not exists article_summary text not null default '';
alter table public.blog_posts add column if not exists headings jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists body_html text not null default '';
alter table public.blog_posts add column if not exists wordpress_html text not null default '';
alter table public.blog_posts add column if not exists before_after_captions text[] not null default '{}';
alter table public.blog_posts add column if not exists internal_link_suggestions text[] not null default '{}';
alter table public.blog_posts add column if not exists faq jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists cta_text text not null default '';
alter table public.blog_posts add column if not exists cta_url text not null default 'https://lin.ee/jjqQEFX';
alter table public.blog_posts add column if not exists source_seo_keyword_id text not null default '';
alter table public.blog_posts add column if not exists generated_by text not null default 'manual';
alter table public.blog_posts add column if not exists ai_model text not null default '';

update public.blog_posts
set generated_by = 'manual'
where generated_by is null or generated_by not in ('gemini', 'mock', 'manual');

alter table public.blog_posts drop constraint if exists blog_posts_generated_by_check;
alter table public.blog_posts add constraint blog_posts_generated_by_check
check (generated_by in ('gemini', 'mock', 'manual'));

create index if not exists blog_posts_generated_by_idx
on public.blog_posts (generated_by);

create index if not exists blog_posts_source_seo_keyword_id_idx
on public.blog_posts (source_seo_keyword_id)
where source_seo_keyword_id <> '';
