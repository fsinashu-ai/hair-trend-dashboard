import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import type {
  AdCsvImport,
  AdCsvImportMetadata,
  AdCsvMetrics,
  AdCsvPreview,
  AdCsvRow,
} from "@/types/adCsv";

type AdCsvImportRow = {
  id: string;
  platform: AdCsvImport["platform"];
  import_type: AdCsvImport["importType"];
  file_name: string;
  file_hash: string;
  period_start: string;
  period_end: string;
  report_month: string;
  comparison_label: string | null;
  row_count: number;
  valid_row_count: number;
  invalid_row_count: number;
  warning_count: number;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  average_cpa: number;
  status: AdCsvImport["status"];
  error_message: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type AdCsvDataRow = {
  id: string;
  import_id: string;
  platform: AdCsvRow["platform"];
  row_type: AdCsvRow["rowType"];
  record_date: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  ad_name: string | null;
  keyword: string | null;
  search_term: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  cpa: number;
  cpc: number;
  cpm: number;
  reach: number;
  link_clicks: number;
  landing_page_views: number;
  final_url: string | null;
  status: string | null;
  device: string | null;
  area: string | null;
  raw_data: Record<string, string> | null;
};

function toMetrics(row: AdCsvImportRow): AdCsvMetrics {
  return {
    averageCpa: Number(row.average_cpa),
    averageCpc: Number(row.average_cpc),
    averageCtr: Number(row.average_ctr),
    totalClicks: Number(row.total_clicks),
    totalConversions: Number(row.total_conversions),
    totalCost: Number(row.total_cost),
    totalImpressions: Number(row.total_impressions),
  };
}

function toImport(row: AdCsvImportRow): AdCsvImport {
  return {
    comparisonLabel: row.comparison_label ?? "",
    createdAt: row.created_at,
    errorMessage: row.error_message ?? "",
    fileHash: row.file_hash,
    fileName: row.file_name,
    id: row.id,
    importType: row.import_type,
    invalidRowCount: Number(row.invalid_row_count),
    memo: row.memo ?? "",
    metrics: toMetrics(row),
    periodEnd: row.period_end,
    periodStart: row.period_start,
    platform: row.platform,
    reportMonth: row.report_month,
    rowCount: Number(row.row_count),
    status: row.status,
    updatedAt: row.updated_at,
    validRowCount: Number(row.valid_row_count),
    warningCount: Number(row.warning_count),
  };
}

function toRow(row: AdCsvDataRow): AdCsvRow {
  return {
    adGroupName: row.ad_group_name ?? "",
    adName: row.ad_name ?? "",
    area: row.area ?? "",
    campaignName: row.campaign_name ?? "",
    clicks: Number(row.clicks),
    conversions: Number(row.conversions),
    cost: Number(row.cost),
    cpa: Number(row.cpa),
    cpc: Number(row.cpc),
    cpm: Number(row.cpm),
    ctr: Number(row.ctr),
    device: row.device ?? "",
    finalUrl: row.final_url ?? "",
    id: row.id,
    importId: row.import_id,
    impressions: Number(row.impressions),
    keyword: row.keyword ?? "",
    landingPageViews: Number(row.landing_page_views),
    linkClicks: Number(row.link_clicks),
    platform: row.platform,
    rawData: row.raw_data ?? {},
    reach: Number(row.reach),
    recordDate: row.record_date ?? "",
    rowType: row.row_type,
    searchTerm: row.search_term ?? "",
    status: row.status ?? "",
  };
}

function reportMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

function metricsToColumns(metrics: AdCsvMetrics) {
  return {
    average_cpa: metrics.averageCpa,
    average_cpc: metrics.averageCpc,
    average_ctr: metrics.averageCtr,
    total_clicks: metrics.totalClicks,
    total_conversions: metrics.totalConversions,
    total_cost: metrics.totalCost,
    total_impressions: metrics.totalImpressions,
  };
}

export async function findDuplicateAdCsvImport(
  preview: AdCsvPreview,
  metadata: AdCsvImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ad_csv_imports")
    .select("*")
    .eq("file_hash", preview.contentHash)
    .eq("file_name", preview.fileName)
    .eq("platform", metadata.platform)
    .eq("import_type", preview.detectedType)
    .eq("period_start", metadata.periodStart)
    .eq("period_end", metadata.periodEnd)
    .eq("valid_row_count", preview.validRowCount)
    .maybeSingle();

  if (error) throw error;
  return data ? toImport(data as AdCsvImportRow) : null;
}

export async function saveAdCsvImport(
  preview: AdCsvPreview,
  metadata: AdCsvImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  const rows = preview.rows ?? [];
  if (!supabase) return null;

  const duplicate = await findDuplicateAdCsvImport(preview, metadata);
  if (duplicate) return { duplicate, item: null };

  const { data: importData, error: importError } = await supabase
    .from("ad_csv_imports")
    .insert({
      ...metricsToColumns(preview.metrics),
      comparison_label: metadata.comparisonLabel,
      error_message: "",
      file_hash: preview.contentHash,
      file_name: preview.fileName,
      import_type: preview.detectedType,
      invalid_row_count: preview.invalidRowCount,
      memo: metadata.memo,
      period_end: metadata.periodEnd,
      period_start: metadata.periodStart,
      platform: metadata.platform,
      report_month: reportMonth(metadata.reportMonth),
      row_count: preview.totalRowCount,
      status: "preview",
      user_id: null,
      valid_row_count: preview.validRowCount,
      warning_count: preview.warningCount,
    })
    .select("*")
    .single();

  if (importError) throw importError;
  const importId = (importData as AdCsvImportRow).id;

  try {
    for (let index = 0; index < rows.length; index += 500) {
      const batch = rows.slice(index, index + 500).map((row) => ({
        ad_group_name: row.adGroupName || null,
        ad_name: row.adName || null,
        area: row.area || null,
        campaign_name: row.campaignName || null,
        clicks: row.clicks,
        conversions: row.conversions,
        cost: row.cost,
        cpa: row.cpa,
        cpc: row.cpc,
        cpm: row.cpm,
        ctr: row.ctr,
        device: row.device || null,
        final_url: row.finalUrl || null,
        import_id: importId,
        impressions: row.impressions,
        keyword: row.keyword || null,
        landing_page_views: row.landingPageViews,
        link_clicks: row.linkClicks,
        platform: row.platform,
        raw_data: row.rawData,
        reach: row.reach,
        record_date: row.recordDate || null,
        row_type: row.rowType,
        search_term: row.searchTerm || null,
        status: row.status || null,
        user_id: null,
      }));
      const { error } = await supabase.from("ad_csv_rows").insert(batch);
      if (error) throw error;
    }

    const { data, error } = await supabase
      .from("ad_csv_imports")
      .update({ status: "imported" })
      .eq("id", importId)
      .select("*")
      .single();
    if (error) throw error;
    return { duplicate: null, item: toImport(data as AdCsvImportRow) };
  } catch (error) {
    await supabase
      .from("ad_csv_imports")
      .update({
        error_message: "広告CSVの行データ保存に失敗しました。",
        status: "failed",
      })
      .eq("id", importId);
    throw error;
  }
}

export async function fetchAdCsvImports(limit = 24) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ad_csv_imports")
    .select("*")
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toImport(row as AdCsvImportRow));
}

export async function fetchAdCsvRows(importIds: string[]) {
  const supabase = getServerSupabaseClient();
  if (!supabase || importIds.length === 0) return null;

  const { data, error } = await supabase
    .from("ad_csv_rows")
    .select("*")
    .in("import_id", importIds)
    .limit(40_000);
  if (error) throw error;

  return (data ?? []).reduce<Record<string, AdCsvRow[]>>((groups, row) => {
    const item = toRow(row as AdCsvDataRow);
    groups[item.importId as string] = [...(groups[item.importId as string] ?? []), item];
    return groups;
  }, {});
}
