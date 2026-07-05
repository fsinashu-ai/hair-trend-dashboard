import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import type {
  Ga4Analysis,
  Ga4CsvPreview,
  Ga4Import,
  Ga4Metrics,
  Ga4Row,
} from "@/types/ga4";

type ImportMetadata = {
  propertyName: string;
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
};

type ImportRow = {
  id: string;
  file_name: string;
  property_name: string | null;
  period_start: string;
  period_end: string;
  report_month: string;
  comparison_label: string | null;
  memo: string | null;
  row_count: number;
  excluded_row_count: number;
  warning_count: number;
  status: Ga4Import["status"];
  error_message: string | null;
  content_hash: string;
  total_users: number;
  total_sessions: number;
  total_views: number;
  average_engagement_rate: number;
  average_engagement_seconds: number;
  total_line_clicks: number;
  total_reservation_clicks: number;
  total_conversions: number;
  landing_page_count: number;
  source_count: number;
  created_at: string;
  updated_at: string;
};

type DataRow = {
  id: string;
  import_id: string;
  landing_page: string | null;
  page_title: string | null;
  source_medium: string | null;
  channel_group: string | null;
  device_category: string | null;
  event_name: string | null;
  record_date: string | null;
  users: number;
  sessions: number;
  views: number;
  engagement_rate: number;
  average_engagement_seconds: number;
  line_clicks: number;
  reservation_clicks: number;
  conversions: number;
};

function toImport(row: ImportRow): Ga4Import {
  return {
    comparisonLabel: row.comparison_label ?? "",
    contentHash: row.content_hash,
    createdAt: row.created_at,
    errorMessage: row.error_message ?? "",
    excludedRowCount: row.excluded_row_count,
    fileName: row.file_name,
    id: row.id,
    memo: row.memo ?? "",
    metrics: {
      averageEngagementSeconds: Number(row.average_engagement_seconds),
      conversions: Number(row.total_conversions),
      engagementRate: Number(row.average_engagement_rate),
      landingPageCount: Number(row.landing_page_count),
      lineClicks: Number(row.total_line_clicks),
      reservationClicks: Number(row.total_reservation_clicks),
      sessions: Number(row.total_sessions),
      sourceCount: Number(row.source_count),
      users: Number(row.total_users),
      views: Number(row.total_views),
    },
    periodEnd: row.period_end,
    periodStart: row.period_start,
    propertyName: row.property_name ?? "",
    reportMonth: row.report_month,
    rowCount: row.row_count,
    status: row.status,
    updatedAt: row.updated_at,
    warningCount: row.warning_count,
  };
}

function toDataRow(row: DataRow): Ga4Row {
  return {
    averageEngagementSeconds: Number(row.average_engagement_seconds),
    channelGroup: row.channel_group ?? "",
    conversions: Number(row.conversions),
    deviceCategory: row.device_category ?? "",
    engagementRate: Number(row.engagement_rate),
    eventName: row.event_name ?? "",
    id: row.id,
    importId: row.import_id,
    landingPage: row.landing_page ?? "",
    lineClicks: Number(row.line_clicks),
    pageTitle: row.page_title ?? "",
    recordDate: row.record_date ?? "",
    reservationClicks: Number(row.reservation_clicks),
    sessions: Number(row.sessions),
    sourceMedium: row.source_medium ?? "",
    users: Number(row.users),
    views: Number(row.views),
  };
}

function metricsToColumns(metrics: Ga4Metrics) {
  return {
    average_engagement_rate: metrics.engagementRate,
    average_engagement_seconds: metrics.averageEngagementSeconds,
    landing_page_count: metrics.landingPageCount,
    source_count: metrics.sourceCount,
    total_conversions: metrics.conversions,
    total_line_clicks: metrics.lineClicks,
    total_reservation_clicks: metrics.reservationClicks,
    total_sessions: metrics.sessions,
    total_users: metrics.users,
    total_views: metrics.views,
  };
}

export async function findDuplicateGa4Import(
  preview: Ga4CsvPreview,
  metadata: ImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_ga4_imports")
    .select("*")
    .eq("content_hash", preview.contentHash)
    .eq("period_start", metadata.periodStart)
    .eq("period_end", metadata.periodEnd)
    .eq("row_count", preview.validRowCount)
    .maybeSingle();
  if (error) throw error;
  return data ? toImport(data as ImportRow) : null;
}

export async function saveGa4Import(
  preview: Ga4CsvPreview,
  metadata: ImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  const rows = preview.rows ?? [];
  if (!supabase) return null;

  const duplicate = await findDuplicateGa4Import(preview, metadata);
  if (duplicate) return { duplicate, item: null };
  const reportMonth = /^\d{4}-\d{2}$/.test(metadata.reportMonth)
    ? `${metadata.reportMonth}-01`
    : metadata.reportMonth;

  const { data: importData, error: importError } = await supabase
    .from("seo_ga4_imports")
    .insert({
      ...metricsToColumns(preview.metrics),
      comparison_label: metadata.comparisonLabel,
      content_hash: preview.contentHash,
      error_message: "",
      excluded_row_count: preview.excludedRowCount,
      file_name: preview.fileName,
      memo: metadata.memo,
      period_end: metadata.periodEnd,
      period_start: metadata.periodStart,
      property_name: metadata.propertyName,
      report_month: reportMonth,
      row_count: preview.validRowCount,
      status: "preview",
      user_id: null,
      warning_count: preview.warningCount,
    })
    .select("*")
    .single();
  if (importError) throw importError;
  const importId = (importData as ImportRow).id;

  try {
    for (let index = 0; index < rows.length; index += 500) {
      const batch = rows.slice(index, index + 500).map((row) => ({
        average_engagement_seconds: row.averageEngagementSeconds,
        channel_group: row.channelGroup || null,
        conversions: row.conversions,
        device_category: row.deviceCategory || null,
        engagement_rate: row.engagementRate,
        event_name: row.eventName || null,
        import_id: importId,
        landing_page: row.landingPage || null,
        line_clicks: row.lineClicks,
        page_title: row.pageTitle || null,
        record_date: row.recordDate || null,
        reservation_clicks: row.reservationClicks,
        sessions: row.sessions,
        source_medium: row.sourceMedium || null,
        user_id: null,
        users: row.users,
        views: row.views,
      }));
      const { error } = await supabase.from("seo_ga4_rows").insert(batch);
      if (error) throw error;
    }

    const { data, error } = await supabase
      .from("seo_ga4_imports")
      .update({ status: "imported" })
      .eq("id", importId)
      .select("*")
      .single();
    if (error) throw error;
    return { duplicate: null, item: toImport(data as ImportRow) };
  } catch (error) {
    await supabase
      .from("seo_ga4_imports")
      .update({
        error_message: "GA4行データの保存に失敗しました。",
        status: "failed",
      })
      .eq("id", importId);
    throw error;
  }
}

export async function fetchGa4Imports(limit = 24) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_ga4_imports")
    .select("*")
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toImport(row as ImportRow));
}

export async function fetchGa4Rows(importIds: string[]) {
  const supabase = getServerSupabaseClient();
  if (!supabase || importIds.length === 0) return null;
  const { data, error } = await supabase
    .from("seo_ga4_rows")
    .select("*")
    .in("import_id", importIds)
    .limit(40_000);
  if (error) throw error;
  return (data ?? []).reduce<Record<string, Ga4Row[]>>((groups, row) => {
    const item = toDataRow(row as DataRow);
    groups[item.importId as string] = [
      ...(groups[item.importId as string] ?? []),
      item,
    ];
    return groups;
  }, {});
}

export async function fetchGa4Analyses(importIds: string[]) {
  const supabase = getServerSupabaseClient();
  if (!supabase || importIds.length === 0) return null;
  const { data, error } = await supabase
    .from("seo_ga4_reports")
    .select("ga4_import_id,analysis_json,created_at")
    .in("ga4_import_id", importIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).reduce<Record<string, Ga4Analysis>>((items, row) => {
    const importId = String(row.ga4_import_id ?? "");
    if (importId && !items[importId] && row.analysis_json) {
      items[importId] = row.analysis_json as Ga4Analysis;
    }
    return items;
  }, {});
}

export async function findReusableGa4Analysis(importId: string, inputHash: string) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_ga4_reports")
    .select("analysis_json")
    .eq("ga4_import_id", importId)
    .eq("input_hash", inputHash)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.analysis_json as Ga4Analysis | undefined) ?? null;
}

export async function saveGa4Analysis({
  analysis,
  comparison,
  importId,
  inputHash,
  metrics,
  reportMonth,
}: {
  analysis: Ga4Analysis;
  comparison: unknown;
  importId: string;
  inputHash: string;
  metrics: Ga4Metrics;
  reportMonth: string;
}) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const reportDate = /^\d{4}-\d{2}$/.test(reportMonth)
    ? `${reportMonth}-01`
    : reportMonth;
  const { error } = await supabase.from("seo_ga4_reports").insert({
    ai_analysis: analysis.summary,
    ai_model: analysis.model,
    analysis_json: analysis,
    analyzed_at: analysis.analyzedAt,
    average_engagement_rate: metrics.engagementRate,
    average_engagement_seconds: metrics.averageEngagementSeconds,
    comparison,
    generated_by: analysis.provider,
    ga4_import_id: importId,
    input_hash: inputHash,
    next_actions: analysis.nextActions,
    report_month: reportDate,
    summary: analysis.summary,
    total_conversions: metrics.conversions,
    total_line_clicks: metrics.lineClicks,
    total_reservation_clicks: metrics.reservationClicks,
    total_sessions: metrics.sessions,
    total_users: metrics.users,
    total_views: metrics.views,
    user_id: null,
  });
  if (error) throw error;

  await supabase
    .from("seo_ga4_imports")
    .update({ status: "analyzed" })
    .eq("id", importId);
  return true;
}
