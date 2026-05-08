import { getSupabaseClient } from "@/lib/supabase/client";
import type { Trend, TrendCategory } from "@/types/trend";

type TrendLinkRow = {
  id: string;
  url: string;
  title: string;
  category: string;
  memo: string | null;
  registered_at: string | null;
  tags?: string[] | null;
};

export type NewTrendLink = {
  url: string;
  title: string;
  category: TrendCategory;
  memo: string;
  registeredAt?: string;
  tags?: string[];
};

function toCategory(value: string): TrendCategory {
  if (
    value === "ショート" ||
    value === "ボブ" ||
    value === "レイヤー" ||
    value === "韓国ヘア"
  ) {
    return "レディース";
  }

  if (value === "SNS集客") {
    return "SNS投稿";
  }

  if (
    value === "レディース" ||
    value === "メンズ" ||
    value === "カラー" ||
    value === "パーマ" ||
    value === "髪質改善" ||
    value === "白髪ぼかし" ||
    value === "SNS投稿" ||
    value === "SNS運用" ||
    value === "カウンセリング" ||
    value === "店販" ||
    value === "自社サイト" ||
    value === "Instagram" ||
    value === "ヘアカタログ" ||
    value === "ヘアカラー" ||
    value === "美容ディーラー" ||
    value === "Pinterest" ||
    value === "海外トレンド" ||
    value === "YouTube"
  ) {
    return value;
  }

  return "レディース";
}

function toTrend(row: TrendLinkRow): Trend {
  const registeredAt = row.registered_at ?? new Date().toISOString().slice(0, 10);
  const category = toCategory(row.category);

  return {
    id: row.id,
    title: row.title,
    summary: row.memo ?? "",
    category,
    sourceName: "Supabase",
    url: row.url,
    publishedAt: registeredAt,
    registeredAt,
    keywords: [category],
    tags: row.tags?.length ? row.tags : [`#${category}`],
    memo: row.memo ?? "",
    heat: "中",
  };
}

export async function fetchTrendLinksFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_links")
    .select("id,url,title,category,memo,registered_at,tags")
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []).map((row) => toTrend(row as TrendLinkRow));
  }

  const fallback = await supabase
    .from("trend_links")
    .select("id,url,title,category,memo,registered_at")
    .order("created_at", { ascending: false });

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? []).map((row) => toTrend(row as TrendLinkRow));
}

export async function createTrendLinkInSupabase(trend: NewTrendLink) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_links")
    .insert({
      url: trend.url,
      title: trend.title,
      category: trend.category,
      memo: trend.memo,
      registered_at: trend.registeredAt,
      tags: trend.tags ?? [],
    })
    .select("id,url,title,category,memo,registered_at,tags")
    .single();

  if (!error) {
    return toTrend(data as TrendLinkRow);
  }

  const fallback = await supabase
    .from("trend_links")
    .insert({
      url: trend.url,
      title: trend.title,
      category: trend.category,
      memo: trend.memo,
      registered_at: trend.registeredAt,
    })
    .select("id,url,title,category,memo,registered_at")
    .single();

  if (fallback.error) {
    throw fallback.error;
  }

  return toTrend(fallback.data as TrendLinkRow);
}

export async function deleteTrendLinkFromSupabase(trendId: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("trend_links").delete().eq("id", trendId);

  if (error) {
    throw error;
  }

  return true;
}

export async function restoreTrendLinksToSupabase(
  trends: Trend[],
  options: { replaceExisting: boolean },
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  if (options.replaceExisting) {
    const { error } = await supabase
      .from("trend_links")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      throw error;
    }
  }

  if (trends.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("trend_links")
    .insert(
      trends.map((trend) => ({
        category: trend.category,
        memo: trend.memo || trend.summary,
        registered_at: trend.registeredAt || trend.publishedAt,
        tags: trend.tags,
        title: trend.title,
        url: trend.url,
      })),
    )
    .select("id,url,title,category,memo,registered_at,tags");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toTrend(row as TrendLinkRow));
}
