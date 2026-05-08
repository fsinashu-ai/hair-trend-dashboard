import { getSupabaseClient } from "@/lib/supabase/client";
import type { Keyword, KeywordPriority } from "@/types/keyword";

type KeywordRow = {
  id: string;
  name: string;
  category: string;
  memo: string | null;
  use_count: number | null;
  priority: string | null;
};

function toPriority(value: string | null): KeywordPriority {
  if (value === "高" || value === "中" || value === "低") {
    return value;
  }

  return "中";
}

function toKeyword(row: KeywordRow): Keyword {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    memo: row.memo ?? "",
    useCount: row.use_count ?? 0,
    priority: toPriority(row.priority),
  };
}

export async function fetchKeywordsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("keywords")
    .select("id,name,category,memo,use_count,priority")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toKeyword(row as KeywordRow));
}

export async function createKeywordInSupabase(keyword: Omit<Keyword, "id">) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("keywords")
    .insert({
      name: keyword.name,
      category: keyword.category,
      memo: keyword.memo,
      use_count: keyword.useCount,
      priority: keyword.priority,
    })
    .select("id,name,category,memo,use_count,priority")
    .single();

  if (error) {
    throw error;
  }

  return toKeyword(data as KeywordRow);
}

export async function deleteKeywordFromSupabase(keywordId: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("keywords").delete().eq("id", keywordId);

  if (error) {
    throw error;
  }

  return true;
}

export async function restoreKeywordsToSupabase(
  keywords: Keyword[],
  options: { replaceExisting: boolean },
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  if (options.replaceExisting) {
    const { error } = await supabase
      .from("keywords")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      throw error;
    }
  }

  if (keywords.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("keywords")
    .insert(
      keywords.map((keyword) => ({
        category: keyword.category,
        memo: keyword.memo,
        name: keyword.name,
        priority: keyword.priority,
        use_count: keyword.useCount,
      })),
    )
    .select("id,name,category,memo,use_count,priority");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toKeyword(row as KeywordRow));
}
