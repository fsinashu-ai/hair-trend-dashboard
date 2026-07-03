import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import type {
  SearchConsoleCsvPreview,
  SearchConsoleImport,
  SearchConsoleMetrics,
  SearchConsoleRow,
  SearchConsoleSeoAnalysis,
  SearchConsoleTaskSuggestion,
} from "@/types/searchConsole";

type ImportMetadata = {
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
};

type ImportRow = {
  id: string;
  import_type: SearchConsoleImport["importType"];
  file_name: string;
  period_start: string;
  period_end: string;
  report_month: string;
  comparison_label: string | null;
  memo: string | null;
  row_count: number;
  excluded_row_count: number;
  warning_count: number;
  status: SearchConsoleImport["status"];
  error_message: string | null;
  content_hash: string;
  total_clicks: number;
  total_impressions: number;
  average_ctr: number;
  average_position: number;
  created_at: string;
  updated_at: string;
};

type DataRow = {
  id: string;
  import_id: string;
  row_type: SearchConsoleRow["rowType"];
  query: string | null;
  page_url: string | null;
  device: string | null;
  country: string | null;
  record_date: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function toImport(row: ImportRow): SearchConsoleImport {
  return {
    comparisonLabel: row.comparison_label ?? "",
    contentHash: row.content_hash,
    createdAt: row.created_at,
    errorMessage: row.error_message ?? "",
    excludedRowCount: row.excluded_row_count,
    fileName: row.file_name,
    id: row.id,
    importType: row.import_type,
    memo: row.memo ?? "",
    metrics: {
      averagePosition: Number(row.average_position),
      clicks: Number(row.total_clicks),
      ctr: Number(row.average_ctr),
      impressions: Number(row.total_impressions),
      pageCount: row.import_type === "page" ? row.row_count : 0,
      queryCount: row.import_type === "query" ? row.row_count : 0,
    },
    periodEnd: row.period_end,
    periodStart: row.period_start,
    reportMonth: row.report_month,
    rowCount: row.row_count,
    status: row.status,
    updatedAt: row.updated_at,
    warningCount: row.warning_count,
  };
}

function toDataRow(row: DataRow): SearchConsoleRow {
  return {
    clicks: Number(row.clicks),
    country: row.country ?? "",
    ctr: Number(row.ctr),
    device: row.device ?? "",
    id: row.id,
    importId: row.import_id,
    impressions: Number(row.impressions),
    pageUrl: row.page_url ?? "",
    position: Number(row.position),
    query: row.query ?? "",
    recordDate: row.record_date ?? "",
    rowType: row.row_type,
  };
}

function metricsToColumns(metrics: SearchConsoleMetrics) {
  return {
    average_ctr: metrics.ctr,
    average_position: metrics.averagePosition,
    total_clicks: metrics.clicks,
    total_impressions: metrics.impressions,
  };
}

export async function findDuplicateSearchConsoleImport(
  preview: SearchConsoleCsvPreview,
  metadata: ImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("seo_search_console_imports")
    .select("*")
    .eq("content_hash", preview.contentHash)
    .eq("import_type", preview.detectedType)
    .eq("period_start", metadata.periodStart)
    .eq("period_end", metadata.periodEnd)
    .eq("row_count", preview.validRowCount)
    .maybeSingle();

  if (error) throw error;
  return data ? toImport(data as ImportRow) : null;
}

export async function saveSearchConsoleImport(
  preview: SearchConsoleCsvPreview,
  metadata: ImportMetadata,
) {
  const supabase = getServerSupabaseClient();
  const rows = preview.rows ?? [];
  if (!supabase) return null;

  const duplicate = await findDuplicateSearchConsoleImport(preview, metadata);
  if (duplicate) return { duplicate, item: null };
  const reportMonth = /^\d{4}-\d{2}$/.test(metadata.reportMonth)
    ? `${metadata.reportMonth}-01`
    : metadata.reportMonth;

  const { data: importData, error: importError } = await supabase
    .from("seo_search_console_imports")
    .insert({
      ...metricsToColumns(preview.metrics),
      comparison_label: metadata.comparisonLabel,
      content_hash: preview.contentHash,
      error_message: "",
      excluded_row_count: preview.excludedRowCount,
      file_name: preview.fileName,
      import_type: preview.detectedType,
      memo: metadata.memo,
      period_end: metadata.periodEnd,
      period_start: metadata.periodStart,
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
        clicks: row.clicks,
        country: row.country || null,
        ctr: row.ctr,
        device: row.device || null,
        import_id: importId,
        impressions: row.impressions,
        page_url: row.pageUrl || null,
        position: row.position,
        query: row.query || null,
        record_date: row.recordDate || null,
        row_type: row.rowType,
        user_id: null,
      }));
      const { error } = await supabase
        .from("seo_search_console_rows")
        .insert(batch);
      if (error) throw error;
    }

    const { data, error } = await supabase
      .from("seo_search_console_imports")
      .update({ status: "imported" })
      .eq("id", importId)
      .select("*")
      .single();
    if (error) throw error;
    return { duplicate: null, item: toImport(data as ImportRow) };
  } catch (error) {
    await supabase
      .from("seo_search_console_imports")
      .update({
        error_message: "行データの保存に失敗しました。",
        status: "failed",
      })
      .eq("id", importId);
    throw error;
  }
}

export async function fetchSearchConsoleImports(limit = 24) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_search_console_imports")
    .select("*")
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toImport(row as ImportRow));
}

export async function fetchSearchConsoleRows(importIds: string[]) {
  const supabase = getServerSupabaseClient();
  if (!supabase || importIds.length === 0) return null;
  const { data, error } = await supabase
    .from("seo_search_console_rows")
    .select("*")
    .in("import_id", importIds)
    .limit(40_000);
  if (error) throw error;

  return (data ?? []).reduce<Record<string, SearchConsoleRow[]>>((groups, row) => {
    const item = toDataRow(row as DataRow);
    groups[item.importId as string] = [...(groups[item.importId as string] ?? []), item];
    return groups;
  }, {});
}

export async function fetchSavedSearchConsoleAnalysis(importId: string) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_reports")
    .select("analysis_json")
    .eq("search_console_import_id", importId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.analysis_json as SearchConsoleSeoAnalysis | undefined;
}

export async function fetchSearchConsoleAnalyses(importIds: string[]) {
  const supabase = getServerSupabaseClient();
  if (!supabase || importIds.length === 0) return null;
  const { data, error } = await supabase
    .from("seo_reports")
    .select("search_console_import_id,analysis_json,created_at")
    .in("search_console_import_id", importIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).reduce<Record<string, SearchConsoleSeoAnalysis>>(
    (items, row) => {
      const importId = String(row.search_console_import_id ?? "");
      if (importId && !items[importId] && row.analysis_json) {
        items[importId] = row.analysis_json as SearchConsoleSeoAnalysis;
      }
      return items;
    },
    {},
  );
}

export async function findReusableSearchConsoleAnalysis(
  importId: string,
  inputHash: string,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_reports")
    .select("analysis_json")
    .eq("search_console_import_id", importId)
    .eq("input_hash", inputHash)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.analysis_json as SearchConsoleSeoAnalysis | undefined) ?? null;
}

export async function saveSearchConsoleAnalysis({
  analysis,
  comparison,
  importId,
  inputHash,
  metrics,
  reportMonth,
}: {
  analysis: SearchConsoleSeoAnalysis;
  comparison: unknown;
  importId: string;
  inputHash: string;
  metrics: SearchConsoleMetrics;
  reportMonth: string;
}) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  const reportDate = /^\d{4}-\d{2}$/.test(reportMonth)
    ? `${reportMonth}-01`
    : reportMonth;
  const { error } = await supabase.from("seo_reports").insert({
    ai_analysis: analysis.summary,
    ai_model: analysis.model,
    analysis_json: analysis,
    analyzed_at: analysis.analyzedAt,
    average_position: metrics.averagePosition,
    clicks: metrics.clicks,
    comparison,
    ctr: metrics.ctr,
    generated_by: analysis.provider,
    impressions: metrics.impressions,
    input_hash: inputHash,
    negative_points: analysis.negativePoints,
    new_article_ideas: analysis.newArticleIdeas,
    next_actions: analysis.monthlyTasks.map((task) => task.title),
    positive_points: analysis.positivePoints,
    priority_keywords: analysis.priorityKeywords,
    priority_pages: analysis.priorityPages,
    report_month: reportDate,
    search_console_import_id: importId,
    summary: analysis.summary,
    user_id: null,
  });
  if (error) throw error;

  await supabase
    .from("seo_search_console_imports")
    .update({ status: "analyzed" })
    .eq("id", importId);
  return true;
}

export async function createSeoTaskFromSuggestion({
  dueDate,
  importId,
  suggestion,
}: {
  dueDate: string;
  importId: string;
  suggestion: SearchConsoleTaskSuggestion;
}) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data: existing, error: findError } = await supabase
    .from("seo_tasks")
    .select("id")
    .eq("title", suggestion.title)
    .eq("related_keyword", suggestion.keyword ?? "")
    .eq("related_page_url", suggestion.pageUrl ?? "")
    .eq("source_search_console_import_id", importId)
    .limit(1);
  if (findError) throw findError;
  if ((existing ?? []).length > 0) return { duplicate: true };

  const { error } = await supabase.from("seo_tasks").insert({
    due_date: dueDate || null,
    memo: suggestion.reason,
    priority: suggestion.priority,
    reason: suggestion.reason,
    related_keyword: suggestion.keyword ?? "",
    related_page_url: suggestion.pageUrl ?? "",
    source_search_console_import_id: importId,
    status: "todo",
    task_type: suggestion.taskType,
    title: suggestion.title,
    user_id: null,
  });
  if (error) throw error;
  return { duplicate: false };
}

export async function fetchSeoTasks(importId?: string) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;
  let query = supabase
    .from("seo_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (importId) query = query.eq("source_search_console_import_id", importId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    dueDate: row.due_date ?? "",
    id: String(row.id),
    memo: row.memo ?? "",
    priority: row.priority,
    reason: row.reason ?? "",
    relatedKeyword: row.related_keyword ?? "",
    relatedPageUrl: row.related_page_url ?? "",
    sourceSearchConsoleImportId: row.source_search_console_import_id ?? "",
    status: row.status,
    taskType: row.task_type,
    title: row.title,
  }));
}
