import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import {
  normalizeBlogUrl,
  normalizeExistingBlogSourceType,
  normalizeExistingBlogStatus,
} from "@/lib/existingBlog";
import type {
  BlogRewriteHistory,
  BlogRewriteSuggestion,
  ExistingBlogArticle,
  ExistingBlogArticleInput,
  ExistingBlogMetrics,
} from "@/types/existingBlog";

type ExistingBlogRow = {
  id: string;
  title: string;
  url: string;
  normalized_url: string;
  canonical_url: string | null;
  category: string;
  status: string;
  target_keyword: string | null;
  secondary_keywords: string[] | null;
  published_at: string | null;
  last_updated_at: string | null;
  source_type: string;
  memo: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type SearchConsolePageRow = {
  import_id: string;
  page_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  seo_search_console_imports?: {
    id: string;
    period_start: string;
    period_end: string;
  };
};

type RewriteHistoryRow = {
  id: string;
  article_id: string;
  source_search_console_import_id: string | null;
  suggestion_json: BlogRewriteSuggestion;
  status: "proposal" | "applied" | "dismissed";
  created_at: string;
  updated_at: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const articleSelectFields = [
  "id",
  "title",
  "url",
  "normalized_url",
  "canonical_url",
  "category",
  "status",
  "target_keyword",
  "secondary_keywords",
  "published_at",
  "last_updated_at",
  "source_type",
  "memo",
  "last_checked_at",
  "created_at",
  "updated_at",
].join(",");

function toArticle(row: ExistingBlogRow): ExistingBlogArticle {
  return {
    canonicalUrl: row.canonical_url ?? row.url,
    category: row.category,
    createdAt: row.created_at,
    id: row.id,
    lastCheckedAt: row.last_checked_at ?? "",
    lastUpdatedAt: row.last_updated_at ?? "",
    memo: row.memo ?? "",
    normalizedUrl: row.normalized_url,
    publishedAt: row.published_at ?? "",
    secondaryKeywords: row.secondary_keywords ?? [],
    sourceType: normalizeExistingBlogSourceType(row.source_type),
    status: normalizeExistingBlogStatus(row.status),
    targetKeyword: row.target_keyword ?? "",
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
  };
}

function toArticleRow(input: ExistingBlogArticleInput) {
  const normalizedUrl = normalizeBlogUrl(input.canonicalUrl || input.url);

  return {
    canonical_url: input.canonicalUrl || input.url,
    category: input.category.trim() || "髪質改善",
    last_updated_at: input.lastUpdatedAt || null,
    memo: input.memo,
    normalized_url: normalizedUrl,
    published_at: input.publishedAt || null,
    secondary_keywords: input.secondaryKeywords,
    source_type: normalizeExistingBlogSourceType(input.sourceType),
    status: normalizeExistingBlogStatus(input.status),
    target_keyword: input.targetKeyword,
    title: input.title.trim(),
    url: input.url.trim(),
    user_id: null,
  };
}

function getSignal(row: SearchConsolePageRow): ExistingBlogMetrics["signal"] {
  if (Number(row.clicks) === 0 && Number(row.impressions) >= 20) {
    return "zero_click";
  }
  if (Number(row.impressions) >= 100 && Number(row.ctr) < 0.015) {
    return "low_ctr";
  }
  if (Number(row.position) > 10 && Number(row.position) <= 30) {
    return "low_position";
  }
  return "healthy";
}

async function fetchLatestPageMetrics() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return new Map<string, ExistingBlogMetrics>();

  const { data, error } = await supabase
    .from("seo_search_console_rows")
    .select(
      "import_id,page_url,clicks,impressions,ctr,position,seo_search_console_imports(id,period_start,period_end)",
    )
    .eq("row_type", "page")
    .not("page_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error) throw error;

  const metricsByUrl = new Map<string, ExistingBlogMetrics>();
  for (const item of (data ?? []) as unknown as SearchConsolePageRow[]) {
    const key = normalizeBlogUrl(item.page_url ?? "");
    if (!key || metricsByUrl.has(key)) continue;

    const importInfo = item.seo_search_console_imports;
    metricsByUrl.set(key, {
      clicks: Number(item.clicks),
      ctr: Number(item.ctr),
      impressions: Number(item.impressions),
      latestImportId: importInfo?.id ?? item.import_id,
      periodLabel: importInfo
        ? `${importInfo.period_start} - ${importInfo.period_end}`
        : "",
      position: Number(item.position),
      signal: getSignal(item),
    });
  }

  return metricsByUrl;
}

export async function fetchExistingBlogArticles() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const [{ data, error }, metricsByUrl] = await Promise.all([
    supabase
      .from("published_blog_articles")
      .select(articleSelectFields)
      .order("updated_at", { ascending: false })
      .limit(200),
    fetchLatestPageMetrics(),
  ]);

  if (error) throw error;

  return ((data ?? []) as unknown as ExistingBlogRow[]).map((row) => {
    const article = toArticle(row);
    const metrics =
      metricsByUrl.get(article.normalizedUrl) ??
      metricsByUrl.get(normalizeBlogUrl(article.url)) ??
      metricsByUrl.get(normalizeBlogUrl(article.canonicalUrl));
    return metrics ? { ...article, metrics } : article;
  });
}

export async function createExistingBlogArticle(
  input: ExistingBlogArticleInput,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("published_blog_articles")
    .insert(toArticleRow(input))
    .select(articleSelectFields)
    .single();

  if (error) throw error;
  return toArticle(data as unknown as ExistingBlogRow);
}

export async function updateExistingBlogArticle(
  id: string,
  input: ExistingBlogArticleInput,
) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("published_blog_articles")
    .update(toArticleRow(input))
    .eq("id", id)
    .select(articleSelectFields)
    .single();

  if (error) throw error;
  return toArticle(data as unknown as ExistingBlogRow);
}

export async function deleteExistingBlogArticle(id: string) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("published_blog_articles")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

export async function saveBlogRewriteHistory({
  article,
  suggestion,
}: {
  article: ExistingBlogArticle;
  suggestion: BlogRewriteSuggestion;
}) {
  const supabase = getServerSupabaseClient();
  if (
    !supabase ||
    article.id.startsWith("dummy-") ||
    article.id.startsWith("existing-blog-") ||
    !isUuid(article.id)
  ) {
    return null;
  }

  const { data, error } = await supabase
    .from("blog_rewrite_histories")
    .insert({
      ai_model: suggestion.model,
      article_id: article.id,
      before_meta_description: "",
      before_title: article.title,
      generated_by: suggestion.provider,
      internal_link_suggestions: suggestion.internalLinkSuggestions,
      rewrite_reason: suggestion.rewriteReason,
      source_search_console_import_id:
        article.metrics?.latestImportId || null,
      status: "proposal",
      suggested_faq: suggestion.faqSuggestions,
      suggested_headings: suggestion.suggestedHeadings,
      suggested_meta_description: suggestion.suggestedMetaDescription,
      suggested_title: suggestion.suggestedTitle,
      suggestion_json: suggestion,
      user_id: null,
    })
    .select("id,article_id,source_search_console_import_id,suggestion_json,status,created_at,updated_at")
    .single();

  if (error) throw error;

  const row = data as unknown as RewriteHistoryRow;
  return {
    articleId: row.article_id,
    createdAt: row.created_at,
    id: row.id,
    sourceSearchConsoleImportId: row.source_search_console_import_id ?? "",
    status: row.status,
    suggestion: row.suggestion_json,
    updatedAt: row.updated_at,
  } satisfies BlogRewriteHistory;
}
