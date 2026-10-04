-- Search Console API source metadata.
-- Run after the existing Search Console tables are available.
begin;

alter table public.seo_search_console_imports
  add column if not exists source text not null default 'csv';

alter table public.seo_search_console_imports
  add column if not exists source_property text;

alter table public.seo_search_console_imports
  add column if not exists search_type text not null default 'web';

alter table public.seo_search_console_imports
  drop constraint if exists seo_sc_import_source_check;

alter table public.seo_search_console_imports
  add constraint seo_sc_import_source_check
  check (source in ('csv', 'search_console_api'));

create index if not exists seo_sc_imports_source_period_idx
on public.seo_search_console_imports (source, period_end desc);

commit;
