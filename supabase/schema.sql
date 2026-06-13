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
alter table public.trend_links add column if not exists youtube_summary text not null default '';
alter table public.trend_links add column if not exists stylist_points text not null default '';
alter table public.trend_links add column if not exists instagram_idea text not null default '';
alter table public.trend_links add column if not exists reel_script text not null default '';
alter table public.trend_links add column if not exists counseling_idea text not null default '';
alter table public.trend_links add column if not exists salon_relevance text not null default '中';
update public.trend_links
set salon_relevance = '中'
where salon_relevance is null or salon_relevance not in ('高', '中', '低');
alter table public.trend_links drop constraint if exists trend_links_salon_relevance_check;
alter table public.trend_links add constraint trend_links_salon_relevance_check
check (salon_relevance in ('高', '中', '低'));

delete from public.trend_links as duplicate
using public.trend_links as original
where duplicate.url = original.url
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

create unique index if not exists trend_links_url_unique_idx
on public.trend_links (url);

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
  category text not null default '美容業界ニュース',
  priority text not null default 'medium',
  is_active boolean not null default false,
  memo text not null default '',
  rss_url text,
  rss_status text not null default 'unchecked',
  consecutive_failures integer not null default 0,
  last_error text not null default '',
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trend_sources add column if not exists source_type text not null default 'RSS';
alter table public.trend_sources add column if not exists is_active boolean not null default true;
alter table public.trend_sources add column if not exists category text not null default '美容業界ニュース';
alter table public.trend_sources add column if not exists priority text not null default 'medium';
alter table public.trend_sources add column if not exists memo text not null default '';
alter table public.trend_sources add column if not exists rss_url text;
alter table public.trend_sources add column if not exists rss_status text not null default 'unchecked';
alter table public.trend_sources add column if not exists consecutive_failures integer not null default 0;
alter table public.trend_sources add column if not exists last_error text not null default '';
alter table public.trend_sources add column if not exists last_fetched_at timestamptz;
alter table public.trend_sources alter column source_type set default 'RSS';
alter table public.trend_sources alter column is_active set default false;
alter table public.trend_sources alter column priority set default 'medium';
alter table public.trend_sources alter column rss_status set default 'unchecked';
update public.trend_sources
set source_type = 'RSS'
where source_type is null
  or source_type not in ('RSS', '公式サイト', '自社サイト', 'メーカー', '美容ディーラー', '美容メディア');
update public.trend_sources
set priority = 'medium'
where priority is null or priority not in ('high', 'medium', 'low');
update public.trend_sources
set rss_status = 'unchecked'
where rss_status is null
  or rss_status not in ('unchecked', 'available', 'unavailable', 'error');
update public.trend_sources
set consecutive_failures = 0
where consecutive_failures is null or consecutive_failures < 0;
alter table public.trend_sources drop constraint if exists trend_sources_source_type_check;
alter table public.trend_sources add constraint trend_sources_source_type_check
check (source_type in ('RSS', '公式サイト', '自社サイト', 'メーカー', '美容ディーラー', '美容メディア'));
alter table public.trend_sources drop constraint if exists trend_sources_priority_check;
alter table public.trend_sources add constraint trend_sources_priority_check
check (priority in ('high', 'medium', 'low'));
alter table public.trend_sources drop constraint if exists trend_sources_rss_status_check;
alter table public.trend_sources add constraint trend_sources_rss_status_check
check (rss_status in ('unchecked', 'available', 'unavailable', 'error'));
alter table public.trend_sources drop constraint if exists trend_sources_failures_check;
alter table public.trend_sources add constraint trend_sources_failures_check
check (consecutive_failures >= 0);

delete from public.trend_sources as duplicate
using public.trend_sources as original
where duplicate.url = original.url
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

create unique index if not exists trend_sources_url_unique_idx
on public.trend_sources (url);

insert into public.trend_sources (
  title,
  url,
  source_type,
  category,
  priority,
  memo,
  is_active,
  rss_url,
  rss_status
)
values
  (
    'ef.mayke`s 自社ブログ',
    'https://www.ef-mayke-s.com/blog_toppage/',
    '自社サイト',
    '自社サイト',
    'high',
    '髪質改善・縮毛矯正・くせ毛・パサつき改善の自社発信を最優先で確認します。',
    true,
    'https://www.ef-mayke-s.com/blog-feed.xml',
    'available'
  ),
  (
    'Beautopia',
    'https://www.beautopia.jp/',
    '美容メディア',
    '美容業界ニュース',
    'high',
    '美容業界のニュース、サロン動向、メーカー情報の確認に使います。',
    true,
    'https://www.beautopia.jp/feed/',
    'available'
  ),
  (
    'KAMIU',
    'https://kamiu.jp/',
    '美容メディア',
    '美容業界ニュース',
    'high',
    '美容師・美容室向けの業界ニュースや経営情報を確認します。',
    true,
    'https://kamiu.jp/feed/',
    'available'
  ),
  (
    'BeautyTech.jp',
    'https://beautytech.jp/',
    '美容メディア',
    '美容業界ニュース',
    'medium',
    '美容業界のテクノロジー、DX、顧客体験の動向を確認します。',
    false,
    null,
    'unchecked'
  ),
  (
    'WWDJAPAN BEAUTY',
    'https://www.wwdjapan.com/category/beauty',
    '美容メディア',
    '美容業界ニュース',
    'high',
    'ビューティー市場、ブランド、商品トレンドの確認に使います。',
    true,
    'https://www.wwdjapan.com/category/beauty/feed',
    'available'
  ),
  (
    'FASHIONSNAP BEAUTY',
    'https://www.fashionsnap.com/beauty/',
    '美容メディア',
    '美容業界ニュース',
    'medium',
    '美容・ファッション業界の新商品や市場ニュースを確認します。',
    false,
    'https://www.fashionsnap.com/rss.xml',
    'available'
  ),
  (
    'PR TIMES 美容サロン',
    'https://prtimes.jp/topics/keywords/美容サロン',
    '美容メディア',
    '美容業界ニュース',
    'low',
    '美容サロン関連の公式発表を確認します。RSSが見つからない場合は手動参照のみです。',
    false,
    null,
    'unchecked'
  ),
  (
    'HOT PEPPER Beauty Magazine',
    'https://beauty.hotpepper.jp/magazine/',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'high',
    '一般のお客様が検索している髪型やヘアケア特集を確認します。',
    true,
    null,
    'unchecked'
  ),
  (
    'HOT PEPPER Beauty ヘアカタログ',
    'https://beauty.hotpepper.jp/catalog/',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'high',
    'ショート、ボブ、レイヤーなど国内の人気スタイルを確認します。',
    true,
    null,
    'unchecked'
  ),
  (
    'MAQUIA ヘアカタログ',
    'https://maquia.hpplus.jp/catalog/hair/',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'medium',
    '大人女性向けのヘアスタイル、カラー、ケア提案を確認します。',
    false,
    null,
    'unchecked'
  ),
  (
    'minimo room',
    'https://minimodel.jp/room/hair',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'medium',
    '若年層を含むヘアデザインや美容師発信の傾向を確認します。',
    false,
    null,
    'unchecked'
  ),
  (
    '美的 ヘア',
    'https://www.biteki.com/hair',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'high',
    '大人女性向けヘア、髪悩み、ホームケア、店販提案に活用します。',
    true,
    'https://www.biteki.com/feed/',
    'available'
  ),
  (
    'FASHIONSNAP ヘアカタログ',
    'https://www.fashionsnap.com/beauty/inside/hair-catalogue/',
    '美容メディア',
    'ヘアスタイル・トレンド',
    'medium',
    '感度の高いヘアデザインやビューティービジュアルを確認します。',
    false,
    'https://www.fashionsnap.com/rss.xml',
    'available'
  ),
  (
    'HOT PEPPER Beauty Academy',
    'https://hba.beauty.hotpepper.jp/',
    '公式サイト',
    'サロン経営・市場データ',
    'high',
    '美容室経営、集客、顧客動向、スタッフ教育の参考にします。',
    true,
    'https://hba.beauty.hotpepper.jp/feed/',
    'available'
  ),
  (
    '美容センサス',
    'https://hba.beauty.hotpepper.jp/search/search_cat/census/',
    '公式サイト',
    'サロン経営・市場データ',
    'high',
    '年代別の美容行動や市場データを松江市の集客提案に活用します。',
    true,
    'https://hba.beauty.hotpepper.jp/search/search_cat/census/feed/',
    'available'
  ),
  (
    'アリミノ',
    'https://www.arimino.co.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'カラー、パーマ、スタイリング、サロン向け新商品の情報を確認します。',
    false,
    'https://www.arimino.co.jp/feed/',
    'available'
  ),
  (
    'ナプラ',
    'https://www.napla.co.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'ヘアカラー、ケア、スタイリング商品の提案材料を確認します。',
    false,
    'https://www.napla.co.jp/feed/',
    'available'
  ),
  (
    'フィヨーレ',
    'https://www.fiole.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'カラー、ヘアケア、サロン専売品の新着情報を確認します。',
    false,
    null,
    'unchecked'
  ),
  (
    'ミルボン',
    'https://www.milbon.co.jp/',
    'メーカー',
    'メーカー',
    'high',
    '髪質改善、ホームケア、店販、サロン市場情報を確認します。',
    true,
    null,
    'unchecked'
  ),
  (
    'デミ コスメティクス',
    'https://www.demi.nicca.co.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'ヘアケア、頭皮ケア、カラー、店販提案の情報を確認します。',
    false,
    null,
    'unchecked'
  ),
  (
    'ルベル',
    'https://www.lebel.co.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'サロン向けヘアケア、カラー、教育情報を確認します。',
    false,
    'https://www.lebel.co.jp/feed/',
    'available'
  ),
  (
    '資生堂プロフェッショナル',
    'https://www.shiseido-professional.com/ja',
    'メーカー',
    'メーカー',
    'high',
    '大人女性向けケア、カラー、サロン専売商品の情報を確認します。',
    true,
    null,
    'unchecked'
  ),
  (
    'hoyu 公式ニュース',
    'https://www.hoyu.co.jp/',
    'メーカー',
    'メーカー',
    'medium',
    'ヘアカラーの新色、商品、研究情報を確認します。',
    false,
    'https://www.hoyu.co.jp/news/rss.xml',
    'available'
  ),
  (
    'Allure Hair',
    'https://www.allure.com/hair-ideas',
    '美容メディア',
    '海外トレンド',
    'high',
    '海外のヘアスタイル、カラー、ヘアケアのトレンドを確認します。',
    true,
    'https://www.allure.com/feed/rss',
    'available'
  ),
  (
    'Vogue Beauty',
    'https://www.vogue.com/beauty',
    '美容メディア',
    '海外トレンド',
    'high',
    '海外の上品なビューティー、ヘア、カラー傾向を確認します。',
    true,
    'https://www.vogue.com/feed/rss',
    'available'
  ),
  (
    'Harper''s Bazaar Hair',
    'https://www.harpersbazaar.com/beauty/hair/',
    '美容メディア',
    '海外トレンド',
    'medium',
    '大人女性向けの海外ヘアスタイルやケア情報を確認します。',
    false,
    'https://www.harpersbazaar.com/rss/beauty.xml',
    'available'
  ),
  (
    'Behindthechair.com',
    'https://behindthechair.com/',
    '美容メディア',
    '海外トレンド',
    'medium',
    '海外美容師の技術、カラー、サロンワーク事例を確認します。RSS未確認時は手動参照のみです。',
    false,
    null,
    'unchecked'
  )
on conflict (url) do update
set
  source_type = excluded.source_type,
  category = excluded.category,
  priority = excluded.priority,
  rss_url = coalesce(public.trend_sources.rss_url, excluded.rss_url),
  rss_status = case
    when excluded.rss_url is not null then 'available'
    else public.trend_sources.rss_status
  end;

create table if not exists public.sns_posts (
  id uuid primary key default gen_random_uuid(),
  sns_type text not null default 'Other',
  url text not null,
  title text not nul,
  memo text not null default '',
  category text not null default 'SNS投稽',
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

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  category text not null,
  target_keyword text not null default '',
  meta_description text not null default '',
  excerpt text not null default '',
  content text not null default '',
  status text not null default 'draft',
  tags text[] not null default '{}',
  related_trend_ids uuid[] not null default '{}',
  related_sns_post_ids uuid[] not null default '{}',
  related_youtube_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts add column if not exists target_keyword text not null default '';
alter table public.blog_posts add column if not exists meta_description text not null default '';
alter table public.blog_posts add column if not exists excerpt text not null default '';
alter table public.blog_posts add column if not exists content text not null default '';
alter table public.blog_posts add column if not exists status text not null default 'draft';
alter table public.blog_posts add column if not exists tags text[] not null default '{}';
alter table public.blog_posts add column if not exists related_trend_ids uuid[] not null default '{}';
alter table public.blog_posts add column if not exists related_sns_post_ids uuid[] not null default '{}';
alter table public.blog_posts add column if not exists related_youtube_urls text[] not null default '{}';
alter table public.blog_posts alter column status set default 'draft';
update public.blog_posts
set status = 'draft'
where status is null or status not in ('idea', 'draft', 'ready', 'published');
alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts add constraint blog_posts_status_check
check (status in ('idea', 'draft', 'ready', 'published'));

create index if not exists keywords_name_idx on public.keywords (name);
create index if not exists keywords_category_idx on public.keywords (category);
create index if not exists trend_links_category_idx on public.trend_links (category);
create index if not exists trend_links_registered_at_idx on public.trend_links (registered_at desc);
create index if not exists trend_links_salon_relevance_idx on public.trend_links (salon_relevance);
create index if not exists ai_outputs_created_at_idx on public.ai_outputs (created_at desc);
create index if not exists trend_sources_is_active_idx on public.trend_sources (is_active);
create index if not exists trend_sources_source_type_idx on public.trend_sources (source_type);
create index if not exists trend_sources_category_idx on public.trend_sources (category);
create index if not exists trend_sources_priority_idx on public.trend_sources (priority);
create index if not exists trend_sources_rss_status_idx on public.trend_sources (rss_status);
create index if not exists sns_posts_sns_type_idx on public.sns_posts (sns_type);
create index if not exists sns_posts_category_idx on public.sns_posts (category);
create index if not exists sns_posts_saved_at_idx on public.sns_posts (saved_at desc);
create index if not exists blog_posts_created_at_idx on public.blog_posts (created_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category);
create index if not exists blog_posts_status_idx on public.blog_posts (status);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

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

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_updated_at();

alter table public.keywords enable row level security;
alter table public.trend_links enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.trend_sources enable row level security;
alter table public.sns_posts enable row level security;
alter table public.blog_posts enable row level security;

-- Explicit Data API grants for Supabase projects created after May 30, 2026.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
on table
  public.keywords,
  public.trend_links,
  public.ai_outputs,
  public.trend_sources,
  public.sns_posts,
  public.blog_posts
to anon, authenticated, service_role;

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

drop policy if exists "personal_blog_posts_all" on public.blog_posts;
create policy "personal_blog_posts_all"
on public.blog_posts
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
