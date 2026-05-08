import { trendSources } from "@/config/trendSources";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TrendSource } from "@/config/trendSources";
import type { ManagedTrendSource, TrendSourceType } from "@/types/trendSource";

type TrendSourceRow = {
  id: string;
  title: string;
  url: string;
  source_type: string;
  is_active: boolean;
  memo: string | null;
  last_fetched_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TrendSourceInput = {
  title: string;
  url: string;
  sourceType: TrendSourceType;
  isActive: boolean;
  memo: string;
};

const sourceTypes: TrendSourceType[] = [
  "RSS",
  "公式サイト",
  "自社サイト",
  "メーカー",
  "美容ディーラー",
  "美容メディア",
];

function toSourceType(value: string): TrendSourceType {
  return sourceTypes.includes(value as TrendSourceType)
    ? (value as TrendSourceType)
    : "RSS";
}

function toManagedSource(row: TrendSourceRow): ManagedTrendSource {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    lastFetchedAt: row.last_fetched_at,
    memo: row.memo ?? "",
    sourceType: toSourceType(row.source_type),
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
  };
}

function getCategoryHint(sourceType: TrendSourceType) {
  if (sourceType === "メーカー") {
    return "ヘアカラー";
  }

  if (sourceType === "美容ディーラー") {
    return "美容ディーラー";
  }

  if (sourceType === "美容メディア") {
    return "店販";
  }

  if (sourceType === "自社サイト") {
    return "自社サイト";
  }

  return "髪質改善";
}

export function managedSourceToTrendSource(source: ManagedTrendSource): TrendSource {
  return {
    categoryHint: getCategoryHint(source.sourceType),
    enabled: source.isActive,
    id: source.id,
    name: source.title,
    note: source.memo || `${source.sourceType}として登録された取得元です。`,
    type: source.sourceType === "RSS" ? "rss" : "manual-url",
    url: source.url,
  };
}

export async function fetchTrendSourcesFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_sources")
    .select("id,title,url,source_type,is_active,memo,last_fetched_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toManagedSource(row as TrendSourceRow));
}

export async function createTrendSourceInSupabase(source: TrendSourceInput) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_sources")
    .insert({
      is_active: source.isActive,
      memo: source.memo,
      source_type: source.sourceType,
      title: source.title,
      url: source.url,
    })
    .select("id,title,url,source_type,is_active,memo,last_fetched_at,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return toManagedSource(data as TrendSourceRow);
}

export async function updateTrendSourceInSupabase(
  id: string,
  source: TrendSourceInput,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_sources")
    .update({
      is_active: source.isActive,
      memo: source.memo,
      source_type: source.sourceType,
      title: source.title,
      url: source.url,
    })
    .eq("id", id)
    .select("id,title,url,source_type,is_active,memo,last_fetched_at,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return toManagedSource(data as TrendSourceRow);
}

export async function updateTrendSourceFetchedAtInSupabase(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_sources")
    .update({
      last_fetched_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,title,url,source_type,is_active,memo,last_fetched_at,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return toManagedSource(data as TrendSourceRow);
}

export async function fetchTrendSourcesForGeneration() {
  try {
    const managedSources = await fetchTrendSourcesFromSupabase();

    if (!managedSources) {
      return trendSources;
    }

    return [
      ...trendSources,
      ...managedSources
        .filter((source) => source.isActive)
        .map((source) => managedSourceToTrendSource(source)),
    ];
  } catch {
    return trendSources;
  }
}
