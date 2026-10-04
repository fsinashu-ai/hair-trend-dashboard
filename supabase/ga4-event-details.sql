-- GA4のTOP/LP/電話タップ分離とイベント詳細保存。
-- 既存データを削除せず、必要な列だけを追加します。

alter table public.seo_ga4_imports
  add column if not exists total_lp_line_taps integer not null default 0,
  add column if not exists total_phone_taps integer not null default 0;

alter table public.seo_ga4_rows
  add column if not exists event_count integer not null default 0,
  add column if not exists page_path text,
  add column if not exists link_url text,
  add column if not exists link_text text,
  add column if not exists is_key_event boolean not null default false,
  add column if not exists lp_line_taps integer not null default 0,
  add column if not exists phone_taps integer not null default 0;

alter table public.seo_ga4_reports
  add column if not exists total_lp_line_taps integer not null default 0,
  add column if not exists total_phone_taps integer not null default 0;

create index if not exists seo_ga4_rows_page_path_idx
  on public.seo_ga4_rows (page_path)
  where page_path is not null;

create index if not exists seo_ga4_rows_event_date_idx
  on public.seo_ga4_rows (event_name, record_date)
  where event_name is not null;
