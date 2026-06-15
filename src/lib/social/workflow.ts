import {
  createSlug,
  lineCtaText,
  normalizeBlogCategory,
} from "@/lib/blog";
import type { BlogPostInput } from "@/types/blog";
import type { SocialPost } from "@/types/social";
import type { Trend } from "@/types/trend";

export function createTrendFromSocialPost(post: SocialPost): Trend {
  const registeredAt = post.importedAt.slice(0, 10);

  return {
    category: post.category,
    heat: "中",
    id: `social-trend-${post.id}-${Date.now()}`,
    keywords: post.tags.map((tag) => tag.replace(/^#/, "")).slice(0, 8),
    memo: post.aiSummary,
    publishedAt: post.publishedAt?.slice(0, 10) || registeredAt,
    registeredAt,
    salonRelevance: post.relevance,
    sourceName: post.snsType,
    summary: post.aiSummary,
    tags: post.tags,
    title: post.title,
    url: post.canonicalUrl,
  };
}

export function createBlogDraftFromSocialPost(
  post: SocialPost,
): BlogPostInput {
  const tags = post.tags
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
  const targetKeyword = tags[0] ?? post.category;
  const summary = post.aiSummary.trim() || post.description.trim();

  return {
    category: normalizeBlogCategory(post.category),
    content: [
      summary,
      "## 参考にしたトレンド",
      `${post.title}\n${post.canonicalUrl}`,
      "## 美容師向けの活用ポイント",
      post.blogIdea,
      "## カウンセリングでの活用",
      post.counselingIdea,
      "## まとめ",
      lineCtaText,
    ]
      .filter(Boolean)
      .join("\n\n"),
    excerpt: summary.slice(0, 180),
    metaDescription: summary.slice(0, 120),
    relatedSnsPostIds: [post.id],
    relatedTrendIds: [],
    relatedYoutubeUrls:
      post.snsType === "YouTube" ? [post.canonicalUrl] : [],
    slug: createSlug(`${targetKeyword}-${post.title}`),
    status: "draft",
    tags: tags.slice(0, 12),
    targetKeyword,
    title: `${post.title}｜美容師向け解説`,
  };
}
