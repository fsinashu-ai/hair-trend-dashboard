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

create table if not exists public.social_sources (
  id uuid primary key default gen_random_uuid(),
  sns_type text not null default 'Other',
  account_name text not null,
  handle text not null default '',
  profile_url text not null,
  category text not null default 'その他',
  source_mode text not null default 'manual_url',
  is_active boolean not null default true,
  priority text not null default 'medium',
  memo text not null default '',
  last_checked_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_sources add column if not exists sns_type text not null default 'Other';
alter table public.social_sources add column if not exists account_name text not null default '';
alter table public.social_sources add column if not exists handle text not null default '';
alter table public.social_sources add column if not exists profile_url text not null default '';
alter table public.social_sources add column if not exists category text not null default 'その他';
alter table public.social_sources add column if not exists source_mode text not null default 'manual_url';
alter table public.social_sources add column if not exists is_active boolean not null default true;
alter table public.social_sources add column if not exists priority text not null default 'medium';
alter table public.social_sources add column if not exists memo text not null default '';
alter table public.social_sources add column if not exists last_checked_at timestamptz;
alter table public.social_sources add column if not exists last_error text not null default '';
update public.social_sources
set sns_type = 'Other'
where sns_type is null or sns_type not in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other');
update public.social_sources
set source_mode = 'manual_url'
where source_mode is null
  or source_mode not in ('official_api', 'manual_url', 'metadata_only');
update public.social_sources
set priority = 'medium'
where priority is null or priority not in ('high', 'medium', 'low');
update public.social_sources
set category = 'その他'
where category is null
  or category not in (
    '自社Instagram',
    '髪質改善美容師',
    '縮毛矯正専門美容師',
    '白髪ぼかし美容師',
    '大人女性向け美容師',
    '美容メーカー公式',
    '美容ディーラー公式',
    '海外ヘアトレンド',
    'その他'
  );
alter table public.social_sources drop constraint if exists social_sources_sns_type_check;
alter table public.social_sources add constraint social_sources_sns_type_check
check (sns_type in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other'));
alter table public.social_sources drop constraint if exists social_sources_mode_check;
alter table public.social_sources add constraint social_sources_mode_check
check (source_mode in ('official_api', 'manual_url', 'metadata_only'));
alter table public.social_sources drop constraint if exists social_sources_priority_check;
alter table public.social_sources add constraint social_sources_priority_check
check (priority in ('high', 'medium', 'low'));
alter table public.social_sources drop constraint if exists social_sources_category_check;
alter table public.social_sources add constraint social_sources_category_check
check (
  category in (
    '自社Instagram',
    '髪質改善美容師',
    '縮毛矯正専門美容師',
    '白髪ぼかし美容師',
    '大人女性向け美容師',
    '美容メーカー公式',
    '美容ディーラー公式',
    '海外ヘアトレンド',
    'その他'
  )
);

delete from public.social_sources as duplicate
using public.social_sources as original
where duplicate.profile_url = original.profile_url
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

delete from public.social_sources as duplicate
using public.social_sources as original
where duplicate.handle <> ''
  and lower(duplicate.handle) = lower(original.handle)
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

create unique index if not exists social_sources_profile_url_unique_idx
on public.social_sources (profile_url);

create unique index if not exists social_sources_handle_unique_idx
on public.social_sources (lower(handle))
where handle <> '';

insert into public.social_sources (
  sns_type,
  account_name,
  profile_url,
  source_mode,
  is_active,
  priority,
  memo
)
values
  (
    'Instagram',
    'Instagram 手動登録',
    'https://www.instagram.com/',
    'manual_url',
    true,
    'high',
    '公式APIを使わない場合は、確認済みの公開投稿URLだけを登録します。'
  ),
  (
    'Pinterest',
    'Pinterest 公開URL',
    'https://www.pinterest.com/',
    'metadata_only',
    true,
    'medium',
    '取得できる公開メタデータだけを参考表示し、画像や本文は転載しません。'
  ),
  (
    'TikTok',
    'TikTok 手動登録',
    'https://www.tiktok.com/',
    'manual_url',
    true,
    'medium',
    '取得が拒否された場合は停止し、URL・タイトル・メモだけを手動登録します。'
  ),
  (
    'X',
    'X 手動登録',
    'https://x.com/',
    'manual_url',
    false,
    'low',
    '非公式スクレイピングは行わず、確認済みの公開投稿URLだけを扱います。'
  ),
  (
    'YouTube',
    'YouTube Data API',
    'https://www.youtube.com/',
    'official_api',
    true,
    'high',
    '自動検索は既存のYouTube Data API機能を利用します。'
  )
on conflict (profile_url) do update
set
  sns_type = excluded.sns_type,
  account_name = excluded.account_name,
  source_mode = excluded.source_mode,
  priority = excluded.priority,
  memo = excluded.memo;

insert into public.social_sources (
  sns_type,
  account_name,
  handle,
  profile_url,
  category,
  source_mode,
  is_active,
  priority,
  memo
)
values
  (
    'Instagram',
    'ef mayke''s',
    '@ef_maykes',
    'https://www.instagram.com/ef_maykes/',
    '自社Instagram',
    'manual_url',
    true,
    'high',
    'ef.mayke`sの投稿確認と改善に使う最優先アカウント。髪質改善・ストレート・くせ毛・艶髪の自社発信を整理します。'
  ),
  (
    'Instagram',
    '中本翔大',
    '@nakasyoex',
    'https://www.instagram.com/nakasyoex/',
    '髪質改善美容師',
    'manual_url',
    true,
    'high',
    '髪質改善の見せ方や施術説明を、ef.mayke`sの艶髪提案と投稿づくりの参考にします。'
  ),
  (
    'Instagram',
    '島野伊央汰',
    '@iota_shimano',
    'https://www.instagram.com/iota_shimano/',
    '髪質改善美容師',
    'manual_url',
    true,
    'high',
    '髪質改善の仕上がり表現やお客様への伝え方を、ef.mayke`sのカウンセリング改善に活用します。'
  ),
  (
    'Instagram',
    '長門政和',
    '@mnagato0724',
    'https://www.instagram.com/mnagato0724/',
    '縮毛矯正専門美容師',
    'manual_url',
    true,
    'high',
    '縮毛矯正の技術発信や薬剤・ダメージへの考え方を、ef.mayke`sのストレート提案の参考にします。'
  ),
  (
    'Instagram',
    '左近研人',
    '@sakon.kento_nex',
    'https://www.instagram.com/sakon.kento_nex/',
    '縮毛矯正専門美容師',
    'manual_url',
    true,
    'high',
    'くせ毛と縮毛矯正の専門的な発信を、ef.mayke`sの施術説明やブログテーマに活用します。'
  ),
  (
    'Instagram',
    'A・One',
    '@hair_clinic_aone',
    'https://www.instagram.com/hair_clinic_aone/',
    '縮毛矯正専門美容師',
    'manual_url',
    true,
    'high',
    'ヘアクリニック型の髪質改善・ストレート提案を、ef.mayke`sの専門性の見せ方に活用します。'
  ),
  (
    'Instagram',
    'Dears',
    '@dears.tuyagami',
    'https://www.instagram.com/dears.tuyagami/',
    '髪質改善美容師',
    'manual_url',
    true,
    'high',
    '艶髪と髪質改善のビジュアル・説明構成を、ef.mayke`sの大人女性向け発信の参考にします。'
  ),
  (
    'Instagram',
    '松田政也',
    '@good_by_graycolor_masayan',
    'https://www.instagram.com/good_by_graycolor_masayan/',
    '白髪ぼかし美容師',
    'manual_url',
    true,
    'high',
    '白髪ぼかしのデザインと説明を、ef.mayke`sの大人女性向けカラー提案に活用します。'
  ),
  (
    'Instagram',
    '金子圭介',
    '@keisuke_redeal_balayage',
    'https://www.instagram.com/keisuke_redeal_balayage/',
    '白髪ぼかし美容師',
    'manual_url',
    true,
    'high',
    '白髪ぼかしとバレイヤージュの表現を、ef.mayke`sの上品なカラー提案の参考にします。'
  ),
  (
    'Instagram',
    '伊熊奈美',
    '@namiikuma_hairista',
    'https://www.instagram.com/namiikuma_hairista/',
    '大人女性向け美容師',
    'manual_url',
    true,
    'high',
    '大人女性の髪悩みに寄り添う言葉選びを、ef.mayke`sのカウンセリングや記事づくりに活用します。'
  ),
  (
    'Instagram',
    '大野道寛',
    '@michi1011ohno',
    'https://www.instagram.com/michi1011ohno/',
    '大人女性向け美容師',
    'manual_url',
    true,
    'high',
    '大人女性向けヘアの提案や見せ方を、ef.mayke`sのショート・ボブ提案に活用します。'
  ),
  (
    'Instagram',
    '横井拓徹',
    '@yokkoi_beautician',
    'https://www.instagram.com/yokkoi_beautician/',
    '大人女性向け美容師',
    'manual_url',
    false,
    'medium',
    '大人女性向けのスタイル提案を、ef.mayke`sの髪質改善後のデザイン提案の参考にします。'
  ),
  (
    'Instagram',
    'くせ毛マイスター',
    '@kusegemeister',
    'https://www.instagram.com/kusegemeister/',
    '縮毛矯正専門美容師',
    'manual_url',
    true,
    'high',
    'くせ毛診断と扱い方の説明を、ef.mayke`sのくせ毛カウンセリングとホームケア提案に活用します。'
  ),
  (
    'Instagram',
    'ミルボン',
    '@milbon.japan',
    'https://www.instagram.com/milbon.japan/',
    '美容メーカー公式',
    'metadata_only',
    true,
    'high',
    'ヘアケア・店販・美容市場の公式情報を、ef.mayke`sの商品提案と季節記事に活用します。'
  ),
  (
    'Instagram',
    'ミルボン美容師向け',
    '@milbon.education',
    'https://www.instagram.com/milbon.education/',
    '美容メーカー公式',
    'metadata_only',
    false,
    'medium',
    '美容師向け技術・教育情報を、ef.mayke`sの技術整理や朝礼ネタの参考にします。'
  ),
  (
    'Instagram',
    'ミルボンカラー',
    '@milboncolor_official',
    'https://www.instagram.com/milboncolor_official/',
    '美容メーカー公式',
    'metadata_only',
    false,
    'medium',
    '公式カラー情報を、ef.mayke`sの艶カラー・白髪対応カラー提案の参考にします。'
  ),
  (
    'Instagram',
    'アリミノ',
    '@arimino_official',
    'https://www.instagram.com/arimino_official/',
    '美容メーカー公式',
    'metadata_only',
    false,
    'medium',
    '新商品やスタイリング情報を、ef.mayke`sのメニュー・店販提案の候補として確認します。'
  ),
  (
    'Instagram',
    'アリミノプロ',
    '@arimino_professional',
    'https://www.instagram.com/arimino_professional/',
    '美容メーカー公式',
    'metadata_only',
    false,
    'medium',
    '美容師向けの技術・商品情報を、ef.mayke`sのサロンワーク改善に活用します。'
  ),
  (
    'Instagram',
    'ナプラ',
    '@napla_official',
    'https://www.instagram.com/napla_official/',
    '美容メーカー公式',
    'metadata_only',
    false,
    'medium',
    'カラー・ヘアケア・スタイリングの公式情報を、ef.mayke`sの提案材料として確認します。'
  ),
  (
    'Instagram',
    'オージュア',
    '@aujua.official',
    'https://www.instagram.com/aujua.official/',
    '美容メーカー公式',
    'metadata_only',
    true,
    'high',
    '髪悩み別のケア情報を、ef.mayke`sの髪質改善後のホームケア・店販提案に活用します。'
  ),
  (
    'Instagram',
    'ガモウ広島',
    '@gamo_hiroshima',
    'https://www.instagram.com/gamo_hiroshima/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '中国地方のセミナー・商材情報を、松江市のef.mayke`sで導入を検討する材料にします。'
  ),
  (
    'Instagram',
    'ガモニュー',
    '@gamonew_official',
    'https://www.instagram.com/gamonew_official/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '美容業界の新商品・新着情報を、ef.mayke`sの店販やメニュー企画の参考にします。'
  ),
  (
    'Instagram',
    'ガモウセミナー',
    '@gamo_seminar',
    'https://www.instagram.com/gamo_seminar/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '美容師向けセミナー情報を、ef.mayke`sの技術学習とスタッフ共有の候補にします。'
  ),
  (
    'Instagram',
    'ガモウ関西',
    '@gamokansai',
    'https://www.instagram.com/gamokansai/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '関西圏の美容トレンド・イベント情報を、ef.mayke`sの情報収集の補助に使います。'
  ),
  (
    'Instagram',
    'ガモウ関西商材情報',
    '@gamokansai_gselect',
    'https://www.instagram.com/gamokansai_gselect/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    'サロン商材の新着情報を、ef.mayke`sの店販候補や施術商材の比較に活用します。'
  ),
  (
    'Instagram',
    'ミツイ東京',
    '@mitsui_tokyo',
    'https://www.instagram.com/mitsui_tokyo/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '美容商材・イベントの情報を、ef.mayke`sの新しい提案候補として確認します。'
  ),
  (
    'Instagram',
    'きくや美粧堂福岡',
    '@kikuya_fukuoka',
    'https://www.instagram.com/kikuya_fukuoka/',
    '美容ディーラー公式',
    'metadata_only',
    false,
    'medium',
    '九州エリアの美容商材・講習情報を、ef.mayke`sの業界動向確認に使います。'
  ),
  (
    'Instagram',
    'Behind The Chair',
    '@behindthechair_com',
    'https://www.instagram.com/behindthechair_com/',
    '海外ヘアトレンド',
    'metadata_only',
    true,
    'high',
    '海外美容師のカラー・カット・質感表現を、ef.mayke`sのトレンド提案や投稿構成に活用します。'
  ),
  (
    'Instagram',
    'MODERN SALON',
    '@modernsalon',
    'https://www.instagram.com/modernsalon/',
    '海外ヘアトレンド',
    'metadata_only',
    false,
    'medium',
    '海外サロンの技術・経営・商品動向を、ef.mayke`sの幅広い情報収集に使います。'
  ),
  (
    'Instagram',
    'Hairbrained',
    '@hairbrained_official',
    'https://www.instagram.com/hairbrained_official/',
    '海外ヘアトレンド',
    'metadata_only',
    false,
    'medium',
    '海外美容師コミュニティの技術表現を、ef.mayke`sのクリエイティブな投稿案に活用します。'
  ),
  (
    'Instagram',
    'Allure',
    '@allure',
    'https://www.instagram.com/allure/',
    '海外ヘアトレンド',
    'metadata_only',
    false,
    'medium',
    '海外の一般向け美容トレンドを、ef.mayke`sの大人女性向け提案へ自然に翻訳する材料にします。'
  )
on conflict (profile_url) do update
set
  sns_type = excluded.sns_type,
  account_name = excluded.account_name,
  handle = excluded.handle,
  category = excluded.category,
  source_mode = excluded.source_mode,
  priority = excluded.priority,
  memo = excluded.memo;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.social_sources(id) on delete set null,
  sns_type text not null default 'Other',
  url text not null,
  canonical_url text not null,
  title text not null,
  description text not null default '',
  og_image_url text not null default '',
  published_at timestamptz,
  category text not null default 'SNS投稿',
  tags text[] not null default '{}',
  ai_summary text not null default '',
  relevance text not null default '中',
  instagram_post_idea text not null default '',
  blog_idea text not null default '',
  counseling_idea text not null default '',
  source_name text not null default '',
  account_name text not null default '',
  handle text not null default '',
  external_id text not null default '',
  like_count integer,
  comment_count integer,
  play_count integer,
  share_count integer,
  raw_payload jsonb not null default '{}'::jsonb,
  review_status text not null default '未確認',
  is_favorite boolean not null default false,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_posts add column if not exists source_id uuid;
alter table public.social_posts add column if not exists sns_type text not null default 'Other';
alter table public.social_posts add column if not exists canonical_url text not null default '';
alter table public.social_posts add column if not exists description text not null default '';
alter table public.social_posts add column if not exists og_image_url text not null default '';
alter table public.social_posts add column if not exists published_at timestamptz;
alter table public.social_posts add column if not exists category text not null default 'SNS投稿';
alter table public.social_posts add column if not exists tags text[] not null default '{}';
alter table public.social_posts add column if not exists ai_summary text not null default '';
alter table public.social_posts add column if not exists relevance text not null default '中';
alter table public.social_posts add column if not exists instagram_post_idea text not null default '';
alter table public.social_posts add column if not exists blog_idea text not null default '';
alter table public.social_posts add column if not exists counseling_idea text not null default '';
alter table public.social_posts add column if not exists source_name text not null default '';
alter table public.social_posts add column if not exists account_name text not null default '';
alter table public.social_posts add column if not exists handle text not null default '';
alter table public.social_posts add column if not exists external_id text not null default '';
alter table public.social_posts add column if not exists like_count integer;
alter table public.social_posts add column if not exists comment_count integer;
alter table public.social_posts add column if not exists play_count integer;
alter table public.social_posts add column if not exists share_count integer;
alter table public.social_posts add column if not exists raw_payload jsonb not null default '{}'::jsonb;
alter table public.social_posts add column if not exists review_status text not null default '未確認';
alter table public.social_posts add column if not exists is_favorite boolean not null default false;
alter table public.social_posts add column if not exists imported_at timestamptz not null default now();
update public.social_posts
set canonical_url = url
where canonical_url is null or canonical_url = '';
update public.social_posts
set sns_type = 'Other'
where sns_type is null or sns_type not in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other');
update public.social_posts
set relevance = '中'
where relevance is null or relevance not in ('高', '中', '低');
update public.social_posts
set review_status = '未確認'
where review_status is null or review_status not in ('未確認', '採用', '保留', '不要');
alter table public.social_posts drop constraint if exists social_posts_sns_type_check;
alter table public.social_posts add constraint social_posts_sns_type_check
check (sns_type in ('Instagram', 'YouTube', 'Pinterest', 'TikTok', 'X', 'Other'));
alter table public.social_posts drop constraint if exists social_posts_relevance_check;
alter table public.social_posts add constraint social_posts_relevance_check
check (relevance in ('高', '中', '低'));
alter table public.social_posts drop constraint if exists social_posts_review_status_check;
alter table public.social_posts add constraint social_posts_review_status_check
check (review_status in ('未確認', '採用', '保留', '不要'));
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_posts_source_id_fkey'
  ) then
    alter table public.social_posts
    add constraint social_posts_source_id_fkey
    foreign key (source_id)
    references public.social_sources(id)
    on delete set null;
  end if;
end
$$;

delete from public.social_posts as duplicate
using public.social_posts as original
where duplicate.canonical_url = original.canonical_url
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

delete from public.social_posts as duplicate
using public.social_posts as original
where duplicate.url = original.url
  and (
    duplicate.created_at > original.created_at
    or (
      duplicate.created_at = original.created_at
      and duplicate.id > original.id
    )
  );

create unique index if not exists social_posts_canonical_url_unique_idx
on public.social_posts (canonical_url);

create unique index if not exists social_posts_url_unique_idx
on public.social_posts (url);

create index if not exists social_posts_review_status_idx
on public.social_posts (review_status, imported_at desc);

create index if not exists social_posts_favorite_idx
on public.social_posts (is_favorite, imported_at desc);

create index if not exists social_posts_source_name_idx
on public.social_posts (source_name);

create index if not exists social_posts_handle_idx
on public.social_posts (handle);

create index if not exists social_posts_external_id_idx
on public.social_posts (external_id);

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
create index if not exists social_sources_sns_type_idx on public.social_sources (sns_type);
create index if not exists social_sources_is_active_idx on public.social_sources (is_active);
create index if not exists social_sources_priority_idx on public.social_sources (priority);
create index if not exists social_posts_sns_type_idx on public.social_posts (sns_type);
create index if not exists social_posts_category_idx on public.social_posts (category);
create index if not exists social_posts_relevance_idx on public.social_posts (relevance);
create index if not exists social_posts_imported_at_idx on public.social_posts (imported_at desc);
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

drop trigger if exists set_social_sources_updated_at on public.social_sources;
create trigger set_social_sources_updated_at
before update on public.social_sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_social_posts_updated_at on public.social_posts;
create trigger set_social_posts_updated_at
before update on public.social_posts
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
alter table public.social_sources enable row level security;
alter table public.social_posts enable row level security;
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
  public.social_sources,
  public.social_posts,
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

drop policy if exists "personal_social_sources_all" on public.social_sources;
create policy "personal_social_sources_all"
on public.social_sources
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "personal_social_posts_all" on public.social_posts;
create policy "personal_social_posts_all"
on public.social_posts
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

-- SEO and ads assistant MVP tables.
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
  ad_group_name text not null default '',
  platform text not null,
  purpose text not null default '',
  status text not null default 'planning',
  target_area text not null default '',
  target_audience text not null default '',
  monthly_budget numeric(12, 2) not null default 0,
  daily_budget numeric(12, 2) not null default 0,
  budget_memo text not null default '',
  offer text not null default '',
  creative_memo text not null default '',
  landing_page_url text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_notes_budget_check check (
    monthly_budget >= 0 and daily_budget >= 0
  )
);

create table if not exists public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  platform text not null,
  campaign_name text not null,
  ad_group_name text not null default '',
  cost numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(7, 4) not null default 0,
  inquiries bigint not null default 0,
  reservations bigint not null default 0,
  conversions bigint not null default 0,
  cpa numeric(12, 2) not null default 0,
  target_area text not null default '',
  target_audience text not null default '',
  landing_page_url text not null default '',
  offer text not null default '',
  status text not null default 'reviewing',
  ai_analysis text not null default '',
  next_actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_reports_metrics_check check (
    cost >= 0
    and impressions >= 0
    and clicks >= 0
    and ctr >= 0
    and inquiries >= 0
    and reservations >= 0
    and conversions >= 0
    and cpa >= 0
  )
);

create index if not exists seo_keywords_priority_idx on public.seo_keywords (priority);
create index if not exists seo_keywords_status_idx on public.seo_keywords (status);
create index if not exists seo_pages_target_keyword_idx on public.seo_pages (target_keyword);
create index if not exists seo_reports_month_idx on public.seo_reports (report_month desc);
create index if not exists seo_tasks_status_due_date_idx on public.seo_tasks (status, due_date);
create index if not exists ad_campaign_notes_platform_idx on public.ad_campaign_notes (platform);
create index if not exists ad_campaign_notes_status_idx on public.ad_campaign_notes (status);
create index if not exists ad_reports_month_platform_idx on public.ad_reports (report_month desc, platform);
create index if not exists ad_reports_status_idx on public.ad_reports (status);

drop trigger if exists set_seo_keywords_updated_at on public.seo_keywords;
create trigger set_seo_keywords_updated_at before update on public.seo_keywords
for each row execute function public.set_updated_at();
drop trigger if exists set_seo_pages_updated_at on public.seo_pages;
create trigger set_seo_pages_updated_at before update on public.seo_pages
for each row execute function public.set_updated_at();
drop trigger if exists set_seo_reports_updated_at on public.seo_reports;
create trigger set_seo_reports_updated_at before update on public.seo_reports
for each row execute function public.set_updated_at();
drop trigger if exists set_seo_tasks_updated_at on public.seo_tasks;
create trigger set_seo_tasks_updated_at before update on public.seo_tasks
for each row execute function public.set_updated_at();
drop trigger if exists set_ad_campaign_notes_updated_at on public.ad_campaign_notes;
create trigger set_ad_campaign_notes_updated_at before update on public.ad_campaign_notes
for each row execute function public.set_updated_at();
drop trigger if exists set_ad_reports_updated_at on public.ad_reports;
create trigger set_ad_reports_updated_at before update on public.ad_reports
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
create policy "authenticated_seo_keywords_all" on public.seo_keywords
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_seo_pages_all" on public.seo_pages;
create policy "authenticated_seo_pages_all" on public.seo_pages
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_seo_reports_all" on public.seo_reports;
create policy "authenticated_seo_reports_all" on public.seo_reports
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_seo_tasks_all" on public.seo_tasks;
create policy "authenticated_seo_tasks_all" on public.seo_tasks
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_ad_campaign_notes_all" on public.ad_campaign_notes;
create policy "authenticated_ad_campaign_notes_all" on public.ad_campaign_notes
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_ad_reports_all" on public.ad_reports;
create policy "authenticated_ad_reports_all" on public.ad_reports
for all to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

-- Gemini SEO blog fields. Existing blog_posts rows keep working with defaults.
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

create index if not exists blog_posts_generated_by_idx on public.blog_posts (generated_by);
create index if not exists blog_posts_source_seo_keyword_id_idx
on public.blog_posts (source_seo_keyword_id)
where source_seo_keyword_id <> '';

-- Google Search Console CSV import and Gemini SEO analysis MVP.
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

-- Phase 6: existing published blog management and rewrite history.
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

-- Phase 7: GA4 CSV import and Gemini analysis MVP.
create table if not exists public.seo_ga4_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  file_name text not null,
  property_name text not null default '',
  period_start date not null,
  period_end date not null,
  report_month date not null,
  comparison_label text not null default '',
  memo text not null default '',
  row_count integer not null default 0,
  excluded_row_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'imported',
  error_message text not null default '',
  content_hash text not null default '',
  total_users integer not null default 0,
  total_sessions integer not null default 0,
  total_views integer not null default 0,
  average_engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  total_line_clicks integer not null default 0,
  total_reservation_clicks integer not null default 0,
  total_conversions integer not null default 0,
  landing_page_count integer not null default 0,
  source_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_ga4_import_status_check check (status in ('preview', 'imported', 'analyzed', 'failed')),
  constraint seo_ga4_import_period_check check (period_end >= period_start)
);

create table if not exists public.seo_ga4_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  import_id uuid not null references public.seo_ga4_imports(id) on delete cascade,
  landing_page text,
  page_title text,
  source_medium text,
  channel_group text,
  device_category text,
  event_name text,
  record_date date,
  users integer not null default 0,
  sessions integer not null default 0,
  views integer not null default 0,
  engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  line_clicks integer not null default 0,
  reservation_clicks integer not null default 0,
  conversions integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_ga4_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ga4_import_id uuid references public.seo_ga4_imports(id) on delete set null,
  report_month date not null,
  summary text not null default '',
  total_users integer not null default 0,
  total_sessions integer not null default 0,
  total_views integer not null default 0,
  average_engagement_rate numeric not null default 0,
  average_engagement_seconds numeric not null default 0,
  total_line_clicks integer not null default 0,
  total_reservation_clicks integer not null default 0,
  total_conversions integer not null default 0,
  ai_analysis text not null default '',
  analysis_json jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  next_actions text[] not null default '{}',
  generated_by text not null default 'mock',
  ai_model text not null default '',
  input_hash text not null default '',
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_ga4_reports_generated_by_check check (generated_by in ('gemini', 'mock', 'manual'))
);

create index if not exists seo_ga4_imports_user_period_idx on public.seo_ga4_imports (user_id, period_end desc);
create index if not exists seo_ga4_imports_hash_idx on public.seo_ga4_imports (content_hash, period_start, period_end);
create index if not exists seo_ga4_rows_import_idx on public.seo_ga4_rows (import_id);
create index if not exists seo_ga4_rows_landing_page_idx on public.seo_ga4_rows (landing_page) where landing_page is not null;
create index if not exists seo_ga4_rows_source_idx on public.seo_ga4_rows (source_medium) where source_medium is not null;
create index if not exists seo_ga4_reports_import_idx on public.seo_ga4_reports (ga4_import_id);
create index if not exists seo_ga4_reports_hash_idx on public.seo_ga4_reports (input_hash) where input_hash <> '';

drop trigger if exists set_seo_ga4_imports_updated_at on public.seo_ga4_imports;
create trigger set_seo_ga4_imports_updated_at before update on public.seo_ga4_imports
for each row execute function public.set_updated_at();

drop trigger if exists set_seo_ga4_reports_updated_at on public.seo_ga4_reports;
create trigger set_seo_ga4_reports_updated_at before update on public.seo_ga4_reports
for each row execute function public.set_updated_at();

alter table public.seo_ga4_imports enable row level security;
alter table public.seo_ga4_rows enable row level security;
alter table public.seo_ga4_reports enable row level security;

revoke all on table public.seo_ga4_imports, public.seo_ga4_rows, public.seo_ga4_reports from anon;
grant select, insert, update, delete on table public.seo_ga4_imports, public.seo_ga4_rows, public.seo_ga4_reports to authenticated, service_role;

drop policy if exists "authenticated_seo_ga4_imports_own" on public.seo_ga4_imports;
create policy "authenticated_seo_ga4_imports_own" on public.seo_ga4_imports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_ga4_rows_own" on public.seo_ga4_rows;
create policy "authenticated_seo_ga4_rows_own" on public.seo_ga4_rows
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "authenticated_seo_ga4_reports_own" on public.seo_ga4_reports;
create policy "authenticated_seo_ga4_reports_own" on public.seo_ga4_reports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Phase 10: Gemini ad creative generation.
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

create index if not exists ad_creatives_user_updated_idx on public.ad_creatives (user_id, updated_at desc);
create index if not exists ad_creatives_status_idx on public.ad_creatives (status);
create index if not exists ad_creatives_platform_idx on public.ad_creatives (platform);

drop trigger if exists set_ad_creatives_updated_at on public.ad_creatives;
create trigger set_ad_creatives_updated_at before update on public.ad_creatives
for each row execute function public.set_updated_at();

alter table public.ad_creatives enable row level security;
revoke all on table public.ad_creatives from anon;
grant select, insert, update, delete on table public.ad_creatives to authenticated, service_role;

drop policy if exists "authenticated_ad_creatives_select" on public.ad_creatives;
create policy "authenticated_ad_creatives_select" on public.ad_creatives for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_creatives_insert" on public.ad_creatives;
create policy "authenticated_ad_creatives_insert" on public.ad_creatives for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_creatives_update" on public.ad_creatives;
create policy "authenticated_ad_creatives_update" on public.ad_creatives for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_creatives_delete" on public.ad_creatives;
create policy "authenticated_ad_creatives_delete" on public.ad_creatives for delete to authenticated
using ((select auth.uid()) = user_id);

-- Phase 11: ad CSV import tables.
create table if not exists public.ad_csv_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  platform text not null,
  import_type text not null,
  file_name text not null,
  file_hash text not null,
  period_start date not null,
  period_end date not null,
  report_month date not null,
  comparison_label text not null default '',
  row_count integer not null default 0,
  valid_row_count integer not null default 0,
  invalid_row_count integer not null default 0,
  warning_count integer not null default 0,
  total_cost numeric(14,2) not null default 0,
  total_impressions bigint not null default 0,
  total_clicks bigint not null default 0,
  total_conversions numeric(14,4) not null default 0,
  average_ctr numeric(10,8) not null default 0,
  average_cpc numeric(14,4) not null default 0,
  average_cpa numeric(14,4) not null default 0,
  status text not null default 'preview',
  error_message text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_csv_imports_platform_check check (
    platform in ('google', 'meta', 'instagram', 'facebook', 'line', 'other')
  ),
  constraint ad_csv_imports_import_type_check check (
    import_type in ('campaign', 'ad_group', 'ad', 'keyword', 'search_term', 'daily', 'unknown')
  ),
  constraint ad_csv_imports_status_check check (
    status in ('preview', 'imported', 'failed')
  ),
  constraint ad_csv_imports_period_check check (period_end >= period_start)
);

create table if not exists public.ad_csv_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  import_id uuid not null references public.ad_csv_imports(id) on delete cascade,
  platform text not null,
  row_type text not null,
  record_date date,
  campaign_name text,
  ad_group_name text,
  ad_name text,
  keyword text,
  search_term text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(10,8) not null default 0,
  cost numeric(14,2) not null default 0,
  conversions numeric(14,4) not null default 0,
  cpa numeric(14,4) not null default 0,
  cpc numeric(14,4) not null default 0,
  cpm numeric(14,4) not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  landing_page_views bigint not null default 0,
  final_url text,
  status text,
  device text,
  area text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ad_csv_rows_platform_check check (
    platform in ('google', 'meta', 'instagram', 'facebook', 'line', 'other')
  ),
  constraint ad_csv_rows_row_type_check check (
    row_type in ('campaign', 'ad_group', 'ad', 'keyword', 'search_term', 'daily', 'unknown')
  )
);

create index if not exists ad_csv_imports_user_period_idx on public.ad_csv_imports (user_id, period_end desc);
create index if not exists ad_csv_imports_duplicate_idx on public.ad_csv_imports (file_hash, file_name, platform, import_type, period_start, period_end, valid_row_count);
create index if not exists ad_csv_rows_import_idx on public.ad_csv_rows (import_id);
create index if not exists ad_csv_rows_campaign_idx on public.ad_csv_rows (campaign_name) where campaign_name is not null;
create index if not exists ad_csv_rows_keyword_idx on public.ad_csv_rows (keyword) where keyword is not null;
create index if not exists ad_csv_rows_search_term_idx on public.ad_csv_rows (search_term) where search_term is not null;

drop trigger if exists set_ad_csv_imports_updated_at on public.ad_csv_imports;
create trigger set_ad_csv_imports_updated_at before update on public.ad_csv_imports
for each row execute function public.set_updated_at();

alter table public.ad_csv_imports enable row level security;
alter table public.ad_csv_rows enable row level security;

revoke all on table public.ad_csv_imports, public.ad_csv_rows from anon;
grant select, insert, update, delete on table public.ad_csv_imports, public.ad_csv_rows to authenticated, service_role;

drop policy if exists "authenticated_ad_csv_imports_select" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_select" on public.ad_csv_imports for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_insert" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_insert" on public.ad_csv_imports for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_update" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_update" on public.ad_csv_imports for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_imports_delete" on public.ad_csv_imports;
create policy "authenticated_ad_csv_imports_delete" on public.ad_csv_imports for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "authenticated_ad_csv_rows_select" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_select" on public.ad_csv_rows for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_insert" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_insert" on public.ad_csv_rows for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_update" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_update" on public.ad_csv_rows for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "authenticated_ad_csv_rows_delete" on public.ad_csv_rows;
create policy "authenticated_ad_csv_rows_delete" on public.ad_csv_rows for delete to authenticated
using ((select auth.uid()) = user_id);
