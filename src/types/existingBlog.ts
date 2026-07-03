export type ExistingBlogStatus =
  | "published"
  | "needs_rewrite"
  | "rewriting"
  | "updated"
  | "archived";

export type ExistingBlogSourceType = "manual" | "csv" | "sitemap";

export type ExistingBlogMetrics = {
  latestImportId: string;
  periodLabel: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  signal:
    | "healthy"
    | "low_ctr"
    | "low_position"
    | "zero_click"
    | "no_data";
};

export type ExistingBlogArticle = {
  id: string;
  title: string;
  url: string;
  normalizedUrl: string;
  canonicalUrl: string;
  category: string;
  status: ExistingBlogStatus;
  targetKeyword: string;
  secondaryKeywords: string[];
  publishedAt: string;
  lastUpdatedAt: string;
  sourceType: ExistingBlogSourceType;
  memo: string;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
  metrics?: ExistingBlogMetrics;
};

export type ExistingBlogArticleInput = {
  title: string;
  url: string;
  canonicalUrl: string;
  category: string;
  status: ExistingBlogStatus;
  targetKeyword: string;
  secondaryKeywords: string[];
  publishedAt: string;
  lastUpdatedAt: string;
  sourceType: ExistingBlogSourceType;
  memo: string;
};

export type BlogRewriteSuggestion = {
  summary: string;
  rewriteReason: string;
  suggestedTitle: string;
  suggestedMetaDescription: string;
  suggestedHeadings: string[];
  faqSuggestions: Array<{ question: string; answer: string }>;
  internalLinkSuggestions: string[];
  ctaSuggestion: string;
  cautionNotes: string[];
  priority: "high" | "medium" | "low";
  provider: "gemini" | "mock";
  providerLabel: string;
  model: string;
  generatedAt: string;
};

export type BlogRewriteHistory = {
  id: string;
  articleId: string;
  sourceSearchConsoleImportId: string;
  suggestion: BlogRewriteSuggestion;
  status: "proposal" | "applied" | "dismissed";
  createdAt: string;
  updatedAt: string;
};
