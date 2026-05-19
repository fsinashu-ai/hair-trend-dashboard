import {
  normalizeBlogCategory,
  normalizeBlogStatus,
} from "@/lib/blog";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { BlogPost, BlogPostInput } from "@/types/blog";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  target_keyword: string | null;
  meta_description: string | null;
  excerpt: string | null;
  content: string | null;
  status: string | null;
  tags: string[] | null;
  related_trend_ids: string[] | null;
  related_sns_post_ids: string[] | null;
  related_youtube_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

const blogSelectFields =
  "id,title,slug,category,target_keyword,meta_description,excerpt,content,status,tags,related_trend_ids,related_sns_post_ids,related_youtube_urls,created_at,updated_at";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toBlogPost(row: BlogPostRow): BlogPost {
  return {
    category: normalizeBlogCategory(row.category),
    content: row.content ?? "",
    createdAt: row.created_at,
    excerpt: row.excerpt ?? "",
    id: row.id,
    metaDescription: row.meta_description ?? "",
    relatedSnsPostIds: row.related_sns_post_ids ?? [],
    relatedTrendIds: row.related_trend_ids ?? [],
    relatedYoutubeUrls: row.related_youtube_urls ?? [],
    slug: row.slug,
    status: normalizeBlogStatus(row.status ?? "draft"),
    tags: row.tags ?? [],
    targetKeyword: row.target_keyword ?? "",
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function toBlogRow(input: BlogPostInput) {
  return {
    category: input.category,
    content: input.content,
    excerpt: input.excerpt,
    meta_description: input.metaDescription,
    related_sns_post_ids: input.relatedSnsPostIds.filter((id) =>
      uuidPattern.test(id),
    ),
    related_trend_ids: input.relatedTrendIds.filter((id) =>
      uuidPattern.test(id),
    ),
    related_youtube_urls: input.relatedYoutubeUrls,
    slug: input.slug,
    status: input.status,
    tags: input.tags,
    target_keyword: input.targetKeyword,
    title: input.title,
  };
}

export async function fetchBlogPostsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .select(blogSelectFields)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toBlogPost(row as BlogPostRow));
}

export async function createBlogPostInSupabase(input: BlogPostInput) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(toBlogRow(input))
    .select(blogSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return toBlogPost(data as BlogPostRow);
}

export async function updateBlogPostInSupabase(
  id: string,
  input: BlogPostInput,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .update(toBlogRow(input))
    .eq("id", id)
    .select(blogSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return toBlogPost(data as BlogPostRow);
}

export async function deleteBlogPostFromSupabase(id: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);

  if (error) {
    throw error;
  }

  return true;
}

export async function restoreBlogPostsToSupabase(
  posts: BlogPost[],
  options: { replaceExisting: boolean },
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  if (options.replaceExisting) {
    const { error } = await supabase
      .from("blog_posts")
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
    .from("blog_posts")
    .insert(posts.map((post) => toBlogRow(post)))
    .select(blogSelectFields);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toBlogPost(row as BlogPostRow));
}
