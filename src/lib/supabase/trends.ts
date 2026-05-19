import { getSupabaseClient } from "@/lib/supabase/client";
import type { SalonRelevance, Trend, TrendCategory } from "@/types/trend";

type TrendLinkRow = {
  id: string;
  url: string;
  title: string;
  category: string;
  memo: string | null;
  registered_at: string | null;
  tags?: string[] | null;
  youtube_summary?: string | null;
  stylist_points?: string | null;
  instagram_idea?: string | null;
  reel_script?: string | null;
  counseling_idea?: string | null;
  salon_relevance?: string | null;
};

export type NewTrendLink = {
  url: string;
  title: string;
  category: TrendCategory;
  memo: string;
  registeredAt?: string;
  tags?: string[];
  youtubeSummary?: string;
  stylistPoints?: string;
  instagramIdea?: string;
  reelScript?: string;
  counselingIdea?: string;
  salonRelevance?: SalonRelevance;
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
  const salonRelevance =
    row.salon_relevance === "高" ||
    row.salon_relevance === "中" ||
    row.salon_relevance === "低"
      ? row.salon_relevance
      : undefined;
  const youtubeSummary = row.youtube_summary?.trim() || undefined;

  return {
    id: row.id,
    title: row.title,
    summary: youtubeSummary ?? row.memo ?? "",
    category,
    sourceName: "Supabase",
    url: row.url,
    publishedAt: registeredAt,
    registeredAt,
    keywords: [category],
    tags: row.tags?.length ? row.tags : [`#${category}`],
    memo: row.memo ?? "",
    heat: "中",
    youtubeSummary,
    stylistPoints: row.stylist_points?.trim() || undefined,
    instagramIdea: row.instagram_idea?.trim() || undefined,
    reelScript: row.reel_script?.trim() || undefined,
    counselingIdea: row.counseling_idea?.trim() || undefined,
    salonRelevance,
  };
}

export async function fetchTrendLinksFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trend_links")
    .select(
      "id,url,title,category,memo,registered_at,tags,youtube_summary,stylist_points,instagram_idea,reel_script,counseling_idea,salon_relevance",
    )
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
      youtube_summary: trend.youtubeSummary ?? "",
      stylist_points: trend.stylistPoints ?? "",
      instagram_idea: trend.instagramIdea ?? "",
      reel_script: trend.reelScript ?? "",
      counseling_idea: trend.counselingIdea ?? "",
      salon_relevance: trend.salonRelevance ?? "中",
    })
    .select(
      "id,url,title,category,memo,registered_at,tags,youtube_summary,stylist_points,instagram_idea,reel_script,counseling_idea,salon_relevance",
    )
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
        youtube_summary: trend.youtubeSummary ?? "",
        stylist_points: trend.stylistPoints ?? "",
        instagram_idea: trend.instagramIdea ?? "",
        reel_script: trend.reelScript ?? "",
        counseling_idea: trend.counselingIdea ?? "",
        salon_relevance: trend.salonRelevance ?? "中",
      })),
    )
    .select(
      "id,url,title,category,memo,registered_at,tags,youtube_summary,stylist_points,instagram_idea,reel_script,counseling_idea,salon_relevance",
    );

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toTrend(row as TrendLinkRow));
}
