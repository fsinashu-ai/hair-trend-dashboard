import {
  trendSourcePriorities,
  trendSources,
  trendSourceTypes,
  type TrendSource,
} from "@/config/trendSources";
import { normalizeArticleUrl, type RssSourceResult } from "@/lib/rss";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  ManagedTrendSource,
  TrendSourcePriority,
  TrendSourceRssStatus,
  TrendSourceType,
} from "@/types/trendSource";

type TrendSourceRow = {
  id: string;
  title: string;
  url: string;
  source_type: string;
  category?: string | null;
  priority?: string | null;
  is_active: boolean;
  memo: string | null;
  rss_url?: string | null;
  rss_status?: string | null;
  consecutive_failures?: number | null;
  last_error?: string | null;
  last_fetched_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TrendSourceInput = {
  title: string;
  url: string;
  sourceType: TrendSourceType;
  category: string;
  priority: TrendSourcePriority;
  isActive: boolean;
  memo: string;
};

const fullSelect =
  "id,title,url,source_type,category,priority,is_active,memo,rss_url,rss_status,consecutive_failures,last_error,last_fetched_at,created_at,updated_at";
const legacySelect =
  "id,title,url,source_type,is_active,memo,last_fetched_at,created_at,updated_at";

function toSourceType(value: string): TrendSourceType {
  return trendSourceTypes.includes(value as TrendSourceType)
    ? (value as TrendSourceType)
    : "RSS";
}

function toPriority(value: string | null | undefined): TrendSourcePriority {
  return trendSourcePriorities.includes(value as TrendSourcePriority)
    ? (value as TrendSourcePriority)
    : "medium";
}

function toRssStatus(value: string | null | undefined): TrendSourceRssStatus {
  if (
    value === "available" ||
    value === "unavailable" ||
    value === "error"
  ) {
    return value;
  }

  return "unchecked";
}

function toManagedSource(row: TrendSourceRow): ManagedTrendSource {
  return {
    category: row.category?.trim() || "美容業界ニュース",
    consecutiveFailures: Math.max(0, row.consecutive_failures ?? 0),
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    lastError: row.last_error?.trim() || "",
    lastFetchedAt: row.last_fetched_at,
    memo: row.memo ?? "",
    priority: toPriority(row.priority),
    rssStatus: toRssStatus(row.rss_status),
    rssUrl: row.rss_url?.trim() || null,
    sourceType: toSourceType(row.source_type),
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
  };
}

function toInsertRow(source: TrendSourceInput) {
  return {
    category: source.category.trim() || "美容業界ニュース",
    is_active: source.isActive,
    memo: source.memo,
    priority: source.priority,
    source_type: source.sourceType,
    title: source.title.trim(),
    url: source.url.trim(),
  };
}

function toInitialRow(source: TrendSource) {
  return {
    category: source.categoryHint,
    consecutive_failures: 0,
    is_active: source.priority === "high",
    last_error: "",
    memo: source.note,
    priority: source.priority,
    rss_status: source.rssUrl ? "available" : "unchecked",
    rss_url: source.rssUrl ?? null,
    source_type: source.sourceType,
    title: source.name,
    url: source.url,
  };
}

function sortSources(sources: ManagedTrendSource[]) {
  const priorityScore: Record<TrendSourcePriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...sources].sort((first, second) => {
    const priorityDifference =
      priorityScore[second.priority] - priorityScore[first.priority];

    return priorityDifference || first.title.localeCompare(second.title, "ja");
  });
}

export function managedSourceToTrendSource(
  source: ManagedTrendSource,
): TrendSource {
  return {
    categoryHint: source.category,
    enabled: source.isActive,
    failureCount: source.consecutiveFailures,
    id: source.id,
    name: source.title,
    note: source.memo || `${source.sourceType}として登録された取得元です。`,
    priority: source.priority,
    rssStatus: source.rssStatus,
    rssUrl: source.rssUrl ?? undefined,
    sourceType: source.sourceType,
    type: source.rssUrl ? "rss" : "manual-url",
    url: source.url,
  };
}

export async function fetchTrendSourcesFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const result = await supabase.from("trend_sources").select(fullSelect);

  if (!result.error) {
    return sortSources(
      (result.data ?? []).map((row) =>
        toManagedSource(row as unknown as TrendSourceRow),
      ),
    );
  }

  const fallback = await supabase.from("trend_sources").select(legacySelect);

  if (fallback.error) {
    throw fallback.error;
  }

  return sortSources(
    (fallback.data ?? []).map((row) =>
      toManagedSource(row as unknown as TrendSourceRow),
    ),
  );
}

export async function syncInitialTrendSourcesToSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const existing = await supabase.from("trend_sources").select("url");

  if (existing.error) {
    throw existing.error;
  }

  const existingUrls = new Set(
    (existing.data ?? []).map((row) => normalizeArticleUrl(row.url)),
  );
  const missingSources = trendSources.filter(
    (source) => !existingUrls.has(normalizeArticleUrl(source.url)),
  );

  if (missingSources.length > 0) {
    const insert = await supabase
      .from("trend_sources")
      .insert(missingSources.map(toInitialRow));

    if (insert.error) {
      const legacyInsert = await supabase.from("trend_sources").insert(
        missingSources.map((source) => ({
          is_active: source.priority === "high",
          memo: source.note,
          source_type: source.sourceType,
          title: source.name,
          url: source.url,
        })),
      );

      if (legacyInsert.error) {
        throw insert.error;
      }
    }
  }

  return fetchTrendSourcesFromSupabase();
}

export async function createTrendSourceInSupabase(source: TrendSourceInput) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const existing = await supabase
    .from("trend_sources")
    .select("id")
    .eq("url", source.url.trim())
    .limit(1);

  if (existing.error) {
    throw existing.error;
  }

  if ((existing.data ?? []).length > 0) {
    throw new Error("このURLはすでに登録されています。");
  }

  const result = await supabase
    .from("trend_sources")
    .insert(toInsertRow(source))
    .select(fullSelect)
    .single();

  if (!result.error) {
    return toManagedSource(result.data as unknown as TrendSourceRow);
  }

  const fallback = await supabase
    .from("trend_sources")
    .insert({
      is_active: source.isActive,
      memo: source.memo,
      source_type: source.sourceType,
      title: source.title.trim(),
      url: source.url.trim(),
    })
    .select(legacySelect)
    .single();

  if (fallback.error) {
    throw fallback.error;
  }

  return toManagedSource(fallback.data as unknown as TrendSourceRow);
}

export async function updateTrendSourceInSupabase(
  id: string,
  source: TrendSourceInput,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const result = await supabase
    .from("trend_sources")
    .update(toInsertRow(source))
    .eq("id", id)
    .select(fullSelect)
    .single();

  if (!result.error) {
    return toManagedSource(result.data as unknown as TrendSourceRow);
  }

  const fallback = await supabase
    .from("trend_sources")
    .update({
      is_active: source.isActive,
      memo: source.memo,
      source_type: source.sourceType,
      title: source.title.trim(),
      url: source.url.trim(),
    })
    .eq("id", id)
    .select(legacySelect)
    .single();

  if (fallback.error) {
    throw fallback.error;
  }

  return toManagedSource(fallback.data as unknown as TrendSourceRow);
}

export async function updateTrendSourceFetchResultInSupabase(
  id: string,
  result: Pick<
    RssSourceResult,
    "rssUrl" | "status" | "consecutiveFailures" | "error"
  >,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();
  const update = await supabase
    .from("trend_sources")
    .update({
      consecutive_failures: result.consecutiveFailures,
      last_error: result.error,
      last_fetched_at: now,
      rss_status: result.status,
      rss_url: result.rssUrl,
    })
    .eq("id", id)
    .select(fullSelect)
    .single();

  if (!update.error) {
    return toManagedSource(update.data as unknown as TrendSourceRow);
  }

  const fallback = await supabase
    .from("trend_sources")
    .update({ last_fetched_at: now })
    .eq("id", id)
    .select(legacySelect)
    .single();

  if (fallback.error) {
    throw fallback.error;
  }

  return toManagedSource(fallback.data as unknown as TrendSourceRow);
}

export async function updateTrendSourceFetchResultsInSupabase(
  results: RssSourceResult[],
) {
  const saved: ManagedTrendSource[] = [];

  for (const result of results) {
    if (!result.sourceId || result.sourceId.startsWith("config-")) {
      continue;
    }

    try {
      const updated = await updateTrendSourceFetchResultInSupabase(
        result.sourceId,
        result,
      );

      if (updated) {
        saved.push(updated);
      }
    } catch {
      // 取得結果の保存失敗で、トレンド生成全体は止めません。
    }
  }

  return saved;
}

export async function fetchTrendSourcesForGeneration() {
  try {
    const managedSources = await syncInitialTrendSourcesToSupabase();

    if (!managedSources || managedSources.length === 0) {
      return trendSources.filter((source) => source.enabled);
    }

    return managedSources
      .filter((source) => source.isActive)
      .map((source) => managedSourceToTrendSource(source));
  } catch {
    return trendSources.filter((source) => source.enabled);
  }
}
