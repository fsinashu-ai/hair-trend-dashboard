import { getSupabaseClient } from "@/lib/supabase/client";
import type { GeneratedPost } from "@/types/generatedPost";

type AiOutputRow = {
  content: string;
  created_at: string | null;
  id: string;
  post_type: string;
  tone: string;
  theme: string;
  used_keywords: string[] | null;
};

function toGeneratedPost(row: AiOutputRow): GeneratedPost {
  return {
    content: row.content,
    createdAt: row.created_at ?? new Date().toISOString().slice(0, 10),
    id: row.id,
    postType: row.post_type,
    theme: row.theme,
    tone: row.tone,
    usedKeywords: row.used_keywords ?? [],
  };
}

export async function fetchAiOutputsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_outputs")
    .select("id,theme,post_type,tone,content,used_keywords,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toGeneratedPost(row as AiOutputRow));
}

export async function restoreAiOutputsToSupabase(
  posts: GeneratedPost[],
  options: { replaceExisting: boolean },
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  if (options.replaceExisting) {
    const { error } = await supabase
      .from("ai_outputs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      throw error;
    }
  }

  if (posts.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("ai_outputs")
    .insert(
      posts.map((post) => ({
        content: post.content,
        prompt: "バックアップ復元",
        post_type: post.postType,
        theme: post.theme,
        tone: post.tone,
        used_keywords: post.usedKeywords,
      })),
    )
    .select("id,theme,post_type,tone,content,used_keywords,created_at");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toGeneratedPost(row as AiOutputRow));
}
