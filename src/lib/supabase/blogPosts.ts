import {
  normalizeBlogCategory,
  normalizeBlogGeneratedBy,
  normalizeBlogStatus,
  withBlogSeoDefaults,
} from "@/lib/blog";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  BlogFaq,
  BlogHeading,
  BlogPost,
  BlogPostInput,
} from "@/types/blog";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  target_keyword: string | null;
  secondary_keywords: string[] | null;
  search_intent: string | null;
  target_audience: string | null;
  reader_problems: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  article_summary: string | null;
  excerpt: string | null;
  content: string | null;
  headings: unknown;
  body_html: string | null;
  wordpress_html: string | null;
  before_after_captions: string[] | null;
  internal_link_suggestions: string[] | null;
  faq: unknown;
  cta_text: string | null;
  cta_url: string | null;
  source_seo_keyword_id: string | null;
  source_search_console_import_id: string | null;
  generated_by: string | null;
  ai_model: string | null;
  status: string | null;
  tags: string[] | null;
  related_trend_ids: string[] | null;
  related_sns_post_ids: string[] | null;
  related_youtube_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

const blogSelectFields = [
  "id",
  "title",
  "slug",
  "category",
  "target_keyword",
  "secondary_keywords",
  "search_intent",
  "target_audience",
  "reader_problems",
  "meta_title",
  "meta_description",
  "article_summary",
  "excerpt",
  "content",
  "headings",
  "body_html",
  "wordpress_html",
  "before_after_captions",
  "internal_link_suggestions",
  "faq",
  "cta_text",
  "cta_url",
  "source_seo_keyword_id",
  "source_search_console_import_id",
  "generated_by",
  "ai_model",
  "status",
  "tags",
  "related_trend_ids",
  "related_sns_post_ids",
  "related_youtube_urls",
  "created_at",
  "updated_at",
].join(",");
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toHeadings(value: unknown): BlogHeading[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): BlogHeading | null => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      if (typeof record.text !== "string" || !record.text.trim()) return null;
      const children = Array.isArray(record.children)
        ? record.children
            .map((child) => {
              if (typeof child !== "object" || child === null) return null;
              const text = (child as Record<string, unknown>).text;
              return typeof text === "string" && text.trim()
                ? ({ level: "h3", text: text.trim() } as const)
                : null;
            })
            .filter((child): child is { level: "h3"; text: string } => Boolean(child))
        : [];
      return { children, level: "h2", text: record.text.trim() };
    })
    .filter((item): item is BlogHeading => Boolean(item));
}

function toFaq(value: unknown): BlogFaq[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): BlogFaq | null => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const question = typeof record.question === "string" ? record.question.trim() : "";
      const answer = typeof record.answer === "string" ? record.answer.trim() : "";
      return question && answer ? { answer, question } : null;
    })
    .filter((item): item is BlogFaq => Boolean(item));
}

function toBlogPost(row: BlogPostRow): BlogPost {
  return withBlogSeoDefaults({
    aiModel: row.ai_model ?? "",
    articleSummary: row.article_summary ?? "",
    beforeAfterCaptions: row.before_after_captions ?? [],
    bodyHtml: row.body_html ?? "",
    category: normalizeBlogCategory(row.category),
    content: row.content ?? "",
    createdAt: row.created_at,
    ctaText: row.cta_text ?? "",
    ctaUrl: row.cta_url ?? "",
    excerpt: row.excerpt ?? "",
    faq: toFaq(row.faq),
    generatedBy: normalizeBlogGeneratedBy(row.generated_by ?? "manual"),
    headings: toHeadings(row.headings),
    id: row.id,
    internalLinkSuggestions: row.internal_link_suggestions ?? [],
    metaDescription: row.meta_description ?? "",
    metaTitle: row.meta_title ?? "",
    readerProblems: row.reader_problems ?? [],
    relatedSnsPostIds: row.related_sns_post_ids ?? [],
    relatedTrendIds: row.related_trend_ids ?? [],
    relatedYoutubeUrls: row.related_youtube_urls ?? [],
    searchIntent: row.search_intent ?? "",
    secondaryKeywords: row.secondary_keywords ?? [],
    slug: row.slug,
    sourceSeoKeywordId: row.source_seo_keyword_id ?? "",
    sourceSearchConsoleImportId:
      row.source_search_console_import_id ?? "",
    status: normalizeBlogStatus(row.status ?? "draft"),
    tags: row.tags ?? [],
    targetAudience: row.target_audience ?? "",
    targetKeyword: row.target_keyword ?? "",
    title: row.title,
    updatedAt: row.updated_at,
    wordpressHtml: row.wordpress_html ?? "",
  });
}

function toBlogRow(input: BlogPostInput) {
  const blog = withBlogSeoDefaults(input);

  return {
    ai_model: blog.aiModel,
    article_summary: blog.articleSummary,
    before_after_captions: blog.beforeAfterCaptions,
    body_html: blog.bodyHtml,
    category: blog.category,
    content: blog.content,
    cta_text: blog.ctaText,
    cta_url: blog.ctaUrl,
    excerpt: blog.excerpt,
    faq: blog.faq,
    generated_by: normalizeBlogGeneratedBy(blog.generatedBy),
    headings: blog.headings,
    internal_link_suggestions: blog.internalLinkSuggestions,
    meta_description: blog.metaDescription,
    meta_title: blog.metaTitle,
    reader_problems: blog.readerProblems,
    related_sns_post_ids: blog.relatedSnsPostIds.filter((id) => uuidPattern.test(id)),
    related_trend_ids: blog.relatedTrendIds.filter((id) => uuidPattern.test(id)),
    related_youtube_urls: blog.relatedYoutubeUrls,
    search_intent: blog.searchIntent,
    secondary_keywords: blog.secondaryKeywords,
    slug: blog.slug,
    source_seo_keyword_id: blog.sourceSeoKeywordId,
    source_search_console_import_id: uuidPattern.test(
      blog.sourceSearchConsoleImportId,
    )
      ? blog.sourceSearchConsoleImportId
      : null,
    status: blog.status,
    tags: blog.tags,
    target_audience: blog.targetAudience,
    target_keyword: blog.targetKeyword,
    title: blog.title,
    wordpress_html: blog.wordpressHtml,
  };
}

export async function fetchBlogPostsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .select(blogSelectFields)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) =>
    toBlogPost(row as unknown as BlogPostRow),
  );
}

export async function createBlogPostInSupabase(input: BlogPostInput) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(toBlogRow(input))
    .select(blogSelectFields)
    .single();

  if (error) throw error;
  return toBlogPost(data as unknown as BlogPostRow);
}

export async function updateBlogPostInSupabase(id: string, input: BlogPostInput) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .update(toBlogRow(input))
    .eq("id", id)
    .select(blogSelectFields)
    .single();

  if (error) throw error;
  return toBlogPost(data as unknown as BlogPostRow);
}

export async function deleteBlogPostFromSupabase(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function restoreBlogPostsToSupabase(
  posts: BlogPost[],
  options: { replaceExisting: boolean },
) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  if (options.replaceExisting) {
    const { error } = await supabase
      .from("blog_posts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }

  if (posts.length === 0) return [];

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(posts.map((post) => toBlogRow(post)))
    .select(blogSelectFields);

  if (error) throw error;
  return (data ?? []).map((row) =>
    toBlogPost(row as unknown as BlogPostRow),
  );
}
