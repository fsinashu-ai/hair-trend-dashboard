import { getSupabaseClient } from "@/lib/supabase/client";
import { snsTrendCategories } from "@/lib/sns";
import type { SnsType } from "@/types/snsPost";
import type { NewSocialPost, SocialPost } from "@/types/social";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

type SocialPostRow = {
  id: string;
  source_id: string | null;
  sns_type: string;
  url: string;
  canonical_url: string;
  title: string;
  description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  category: string;
  tags: string[] | null;
  ai_summary: string | null;
  relevance: string;
  instagram_post_idea: string | null;
  blog_idea: string | null;
  counseling_idea: string | null;
  imported_at: string;
  created_at?: string;
  updated_at?: string;
};

const selectFields =
  "id,source_id,sns_type,url,canonical_url,title,description,og_image_url,published_at,category,tags,ai_summary,relevance,instagram_post_idea,blog_idea,counseling_idea,imported_at,created_at,updated_at";

function toSnsType(value: string): SnsType {
  return value === "Instagram" ||
    value === "YouTube" ||
    value === "Pinterest" ||
    value === "TikTok" ||
    value === "X"
    ? value
    : "Other";
}

function toCategory(value: string): TrendCategory {
  return (
    snsTrendCategories.find((category) => category === value) ?? "SNS投稿"
  );
}

function toRelevance(value: string): SalonRelevance {
  return value === "高" || value === "中" || value === "低" ? value : "中";
}

function toSocialPost(row: SocialPostRow): SocialPost {
  return {
    aiSummary: row.ai_summary ?? "",
    blogIdea: row.blog_idea ?? "",
    canonicalUrl: row.canonical_url,
    category: toCategory(row.category),
    counselingIdea: row.counseling_idea ?? "",
    createdAt: row.created_at,
    description: row.description ?? "",
    id: row.id,
    importedAt: row.imported_at,
    instagramPostIdea: row.instagram_post_idea ?? "",
    ogImageUrl: row.og_image_url ?? "",
    publishedAt: row.published_at ?? undefined,
    relevance: toRelevance(row.relevance),
    snsType: toSnsType(row.sns_type),
    sourceId: row.source_id ?? undefined,
    tags: row.tags ?? [],
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
  };
}

function toRow(input: NewSocialPost) {
  return {
    ai_summary: input.aiSummary,
    blog_idea: input.blogIdea,
    canonical_url: input.canonicalUrl,
    category: input.category,
    counseling_idea: input.counselingIdea,
    description: input.description,
    imported_at: input.importedAt,
    instagram_post_idea: input.instagramPostIdea,
    og_image_url: input.ogImageUrl,
    published_at: input.publishedAt || null,
    relevance: input.relevance,
    sns_type: input.snsType,
    source_id: input.sourceId || null,
    tags: input.tags,
    title: input.title,
    url: input.url,
  };
}

export async function fetchSocialPostsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(selectFields)
    .order("imported_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toSocialPost(row as SocialPostRow));
}

export async function createSocialPostInSupabase(input: NewSocialPost) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .insert(toRow(input))
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return toSocialPost(data as SocialPostRow);
}

