export type BlogStatus = "idea" | "draft" | "ready" | "published";
export type BlogGeneratedBy = "gemini" | "mock" | "manual";

export type BlogHeading = {
  level: "h2";
  text: string;
  children: Array<{
    level: "h3";
    text: string;
  }>;
};

export type BlogFaq = {
  question: string;
  answer: string;
};

export type SeoBlogFields = {
  articleSummary: string;
  secondaryKeywords: string[];
  searchIntent: string;
  targetAudience: string;
  readerProblems: string[];
  metaTitle: string;
  headings: BlogHeading[];
  bodyHtml: string;
  wordpressHtml: string;
  beforeAfterCaptions: string[];
  internalLinkSuggestions: string[];
  faq: BlogFaq[];
  ctaText: string;
  ctaUrl: string;
  sourceSeoKeywordId: string;
  sourceSearchConsoleImportId: string;
  generatedBy: BlogGeneratedBy;
  aiModel: string;
};

export type BlogCategory =
  | "髪質改善"
  | "縮毛矯正"
  | "白髪ぼかし"
  | "大人女性ヘア"
  | "ショート"
  | "ボブ"
  | "ヘアカラー"
  | "ホームケア"
  | "松江市美容室"
  | "SNS投稿ネタ";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: BlogCategory;
  targetKeyword: string;
  metaDescription: string;
  excerpt: string;
  content: string;
  status: BlogStatus;
  tags: string[];
  relatedTrendIds: string[];
  relatedSnsPostIds: string[];
  relatedYoutubeUrls: string[];
  createdAt: string;
  updatedAt: string;
} & Partial<SeoBlogFields>;

export type BlogPostInput = Omit<BlogPost, "id" | "createdAt" | "updatedAt">;

export type BlogArticleType =
  | "SEO記事"
  | "お悩み解決記事"
  | "Before/After紹介記事"
  | "メニュー紹介記事"
  | "季節提案記事"
  | "Instagram投稿からブログ化";

export type BlogTargetAge = "20代" | "30代" | "40代" | "50代" | "60代";

export type BlogConcern =
  | "くせ毛"
  | "パサつき"
  | "広がり"
  | "白髪"
  | "ダメージ"
  | "まとまらない";

export type BlogLength = "800文字" | "1200文字" | "2000文字" | "3000文字";

export type BlogGenerateRequest = {
  mainKeyword: string;
  targetAge: BlogTargetAge;
  concern: BlogConcern;
  articleType: BlogArticleType;
  length: BlogLength;
  referenceTitles?: string[];
  referenceMemos?: string[];
  secondaryKeywords?: string[];
  searchIntent?: string;
  targetAudience?: string;
  readerProblems?: string[];
  preferredTitle?: string;
  articleSummary?: string;
  sourceSeoKeywordId?: string;
  sourceSearchConsoleImportId?: string;
  sourceTrendId?: string;
  sourcePriority?: string;
  sourceTargetPage?: string;
};

export type BlogGenerateResponse = BlogPostInput & SeoBlogFields & {
  instagramCaption: string;
  beforeAfterCaption: string;
  lineCta: string;
  providerLabel: string;
  generationMode: "gemini" | "mock";
  generationNotice?: string;
  trendSummary: string;
  blogValue: string;
  salonRelevance: string;
};
