import type {
  BlogRewriteSuggestion,
  ExistingBlogArticle,
  ExistingBlogArticleInput,
  ExistingBlogMetrics,
  ExistingBlogSourceType,
  ExistingBlogStatus,
} from "@/types/existingBlog";

export const existingBlogStatuses: ExistingBlogStatus[] = [
  "published",
  "needs_rewrite",
  "rewriting",
  "updated",
  "archived",
];

export const existingBlogStatusLabels: Record<ExistingBlogStatus, string> = {
  archived: "保管",
  needs_rewrite: "リライト候補",
  published: "公開中",
  rewriting: "リライト中",
  updated: "更新済み",
};

export const existingBlogSourceTypes: ExistingBlogSourceType[] = [
  "manual",
  "csv",
  "sitemap",
];

export const existingBlogSourceLabels: Record<ExistingBlogSourceType, string> = {
  csv: "CSV",
  manual: "手入力",
  sitemap: "サイトマップ",
};

export function normalizeBlogUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/^https?:\/\/www\./, "https://").replace(/\/$/, "");
  }
}

export function toStringList(value: string | string[]) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((item) => item.trim()).filter(Boolean)),
    ).slice(0, 12);
  }

  return Array.from(
    new Set(
      value
        .split(/[,\n、]/)
        .map((item) => item.replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function stringListToLines(values: string[]) {
  return values.join("\n");
}

export function normalizeExistingBlogStatus(value: string) {
  return existingBlogStatuses.includes(value as ExistingBlogStatus)
    ? (value as ExistingBlogStatus)
    : "published";
}

export function normalizeExistingBlogSourceType(value: string) {
  return existingBlogSourceTypes.includes(value as ExistingBlogSourceType)
    ? (value as ExistingBlogSourceType)
    : "manual";
}

export function createEmptyExistingBlogInput(): ExistingBlogArticleInput {
  return {
    canonicalUrl: "",
    category: "髪質改善",
    lastUpdatedAt: "",
    memo: "",
    publishedAt: "",
    secondaryKeywords: [],
    sourceType: "manual",
    status: "published",
    targetKeyword: "",
    title: "",
    url: "",
  };
}

export function createLocalExistingBlogArticle(
  input: ExistingBlogArticleInput,
): ExistingBlogArticle {
  const now = new Date().toISOString();
  const normalizedUrl = normalizeBlogUrl(input.canonicalUrl || input.url);

  return {
    ...input,
    canonicalUrl: input.canonicalUrl || input.url,
    createdAt: now,
    id: `existing-blog-${Date.now()}`,
    lastCheckedAt: "",
    normalizedUrl,
    updatedAt: now,
  };
}

export function getMetricSignal(metrics?: ExistingBlogMetrics) {
  if (!metrics || metrics.signal === "no_data") {
    return {
      label: "データなし",
      tone: "neutral" as const,
    };
  }
  if (metrics.signal === "low_ctr") {
    return { label: "CTR改善", tone: "warning" as const };
  }
  if (metrics.signal === "low_position") {
    return { label: "順位改善", tone: "warning" as const };
  }
  if (metrics.signal === "zero_click") {
    return { label: "クリック0", tone: "danger" as const };
  }
  return { label: "良好", tone: "success" as const };
}

export function createMockRewriteSuggestion(
  article: Pick<
    ExistingBlogArticle,
    "title" | "targetKeyword" | "category" | "memo"
  >,
): BlogRewriteSuggestion {
  const keyword = article.targetKeyword || "松江 髪質改善";

  return {
    cautionNotes: [
      "実際の施術事例や価格は、公開前に店舗の内容と照合してください。",
      "効果を断定せず、個人差がある表現に整えてください。",
    ],
    ctaSuggestion:
      "本気で髪を綺麗にしたい方は、まずはLINEから髪のお悩みをご相談ください。",
    faqSuggestions: [
      {
        answer:
          "髪の状態や過去の施術履歴によって変わります。まずはカウンセリングで状態を確認するのがおすすめです。",
        question: "髪質改善と縮毛矯正はどちらを選べばいいですか？",
      },
      {
        answer:
          "自宅ケアだけで難しい場合もあります。サロンで状態を見ながら、無理のない方法を一緒に決めていきます。",
        question: "パサつきや広がりは自宅ケアだけで良くなりますか？",
      },
    ],
    generatedAt: new Date().toISOString(),
    internalLinkSuggestions: [
      "https://ef-mayke-s.com/",
      "https://www.ef-mayke-s.com/blog_toppage/",
    ],
    model: "mock",
    priority: "high",
    provider: "mock",
    providerLabel: "モック分析",
    rewriteReason:
      "Search Consoleのクリック率や順位を確認しながら、髪質改善・縮毛矯正・大人女性の悩みに寄り添う内容へ更新すると効果が出やすいです。",
    suggestedHeadings: [
      `${keyword}で悩む方が最初に知っておきたいこと`,
      "うねり・広がり・パサつきが起こる主な原因",
      "ef.mayke`sで大切にしているカウンセリング",
      "施術後のホームケアと次回来店の目安",
      "よくある質問",
    ],
    suggestedMetaDescription:
      `${keyword}でお悩みの方へ。松江市の髪質改善・ストレート特化サロンef.mayke\`sが、うねりや広がりへの考え方をやさしく解説します。`.slice(
        0,
        155,
      ),
    suggestedTitle:
      article.title ||
      `${keyword}で悩む大人女性へ｜髪質改善サロンが伝えたいこと`,
    summary:
      "既存記事を、検索意図に答える構成・LINE相談への自然な導線・FAQ追加の3点で整える提案です。",
  };
}
