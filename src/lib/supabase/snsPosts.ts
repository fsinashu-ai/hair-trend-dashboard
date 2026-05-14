import { getSupabaseClient } from "@/lib/supabase/client";
import type { NewSnsPost, SnsPost, SnsType } from "@/types/snsPost";
import type { TrendCategory } from "@/types/trend";

type SnsPostRow = {
  id: string;
  sns_type: string;
  url: string;
  title: string;
  memo: string | null;
  category: string;
  tags: string[] | null;
  ai_summary: string | null;
  post_idea: string | null;
  counseling_idea: string | null;
  saved_at: string | null;
  created_at?: string;
  updated_at?: string;
};

function toSnsType(value: string): SnsType {
  if (
    value === "Instagram" ||
    value === "YouTube" ||
    value === "Pinterest" ||
    value === "TikTok" ||
    value === "X" ||
    value === "Other"
  ) {
    return value;
  }

  return "Other";
}

function toTrendCategory(value: string): TrendCategory {
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

  return "SNS投稿";
}

function toSnsPost(row: SnsPostRow): SnsPost {
  const category = toTrendCategory(row.category);

  return {
    id: row.id,
    snsType: toSnsType(row.sns_type),
    url: row.url,
    title: row.title,
    memo: row.memo ?? "",
    category,
    tags: row.tags?.length ? row.tags : [`#${category}`],
    aiSummary: row.ai_summary ?? "",
    postIdea: row.post_idea ?? "",
    counselingIdea: row.counseling_idea ?? "",
    savedAt: row.saved_at ?? new Date().toISOString().slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchSnsPostsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("sns_posts")
    .select(
      "id,sns_type,url,title,memo,category,tags,ai_summary,post_idea,counseling_idea,saved_at,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toSnsPost(row as SnsPostRow));
}

export async function createSnsPostInSupabase(post: NewSnsPost) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("sns_posts")
    .insert({
      ai_summary: post.aiSummary,
      category: post.category,
      counseling_idea: post.counselingIdea,
      memo: post.memo,
      post_idea: post.postIdea,
      saved_at: post.savedAt,
      sns_type: post.snsType,
      tags: post.tags,
      title: post.title,
      url: post.url,
    })
    .select(
      "id,sns_type,url,title,memo,category,tags,ai_summary,post_idea,counseling_idea,saved_at,created_at,updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return toSnsPost(data as SnsPostRow);
}

export async function deleteSnsPostFromSupabase(postId: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("sns_posts").delete().eq("id", postId);

  if (error) {
    throw error;
  }

  return true;
}
