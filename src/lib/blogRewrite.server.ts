import {
  GeminiServiceError,
  generateGeminiJson,
  isGeminiConfigured,
} from "@/lib/ai/server";
import { createMockRewriteSuggestion } from "@/lib/existingBlog";
import { getSalonPromptContext, salonProfile } from "@/lib/salonProfile";
import type {
  BlogRewriteSuggestion,
  ExistingBlogArticle,
} from "@/types/existingBlog";

type GeminiRewritePayload = {
  summary?: unknown;
  rewriteReason?: unknown;
  suggestedTitle?: unknown;
  suggestedMetaDescription?: unknown;
  suggestedHeadings?: unknown;
  faqSuggestions?: unknown;
  internalLinkSuggestions?: unknown;
  ctaSuggestion?: unknown;
  cautionNotes?: unknown;
  priority?: unknown;
};

const rewriteResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    rewriteReason: { type: "string" },
    suggestedTitle: { type: "string" },
    suggestedMetaDescription: { type: "string" },
    suggestedHeadings: { type: "array", items: { type: "string" } },
    faqSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
    internalLinkSuggestions: { type: "array", items: { type: "string" } },
    ctaSuggestion: { type: "string" },
    cautionNotes: { type: "array", items: { type: "string" } },
    priority: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "summary",
    "rewriteReason",
    "suggestedTitle",
    "suggestedMetaDescription",
    "suggestedHeadings",
    "faqSuggestions",
    "internalLinkSuggestions",
    "ctaSuggestion",
    "cautionNotes",
    "priority",
  ],
};

function safeString(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function safeStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxItemLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function safeFaq(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const question = safeString(record.question, 180);
      const answer = safeString(record.answer, 500);
      return question && answer ? { answer, question } : null;
    })
    .filter((item): item is { question: string; answer: string } =>
      Boolean(item),
    )
    .slice(0, 6);
}

function normalizePriority(value: unknown): "high" | "medium" | "low" {
  if (value === "high" || value === "low") return value;
  return "medium";
}

function toSuggestion(
  value: GeminiRewritePayload,
  article: ExistingBlogArticle,
  model: string,
): BlogRewriteSuggestion {
  const fallback = createMockRewriteSuggestion(article);
  const faqSuggestions = safeFaq(value.faqSuggestions);

  return {
    cautionNotes: safeStringArray(value.cautionNotes, 8, 300).length
      ? safeStringArray(value.cautionNotes, 8, 300)
      : fallback.cautionNotes,
    ctaSuggestion: safeString(
      value.ctaSuggestion,
      300,
      fallback.ctaSuggestion,
    ),
    faqSuggestions: faqSuggestions.length
      ? faqSuggestions
      : fallback.faqSuggestions,
    generatedAt: new Date().toISOString(),
    internalLinkSuggestions: safeStringArray(
      value.internalLinkSuggestions,
      8,
      500,
    ).length
      ? safeStringArray(value.internalLinkSuggestions, 8, 500)
      : fallback.internalLinkSuggestions,
    model,
    priority: normalizePriority(value.priority),
    provider: "gemini",
    providerLabel: "Gemini API",
    rewriteReason: safeString(
      value.rewriteReason,
      900,
      fallback.rewriteReason,
    ),
    suggestedHeadings: safeStringArray(value.suggestedHeadings, 10, 160)
      .length
      ? safeStringArray(value.suggestedHeadings, 10, 160)
      : fallback.suggestedHeadings,
    suggestedMetaDescription: safeString(
      value.suggestedMetaDescription,
      160,
      fallback.suggestedMetaDescription,
    ),
    suggestedTitle: safeString(
      value.suggestedTitle,
      120,
      fallback.suggestedTitle,
    ),
    summary: safeString(value.summary, 900, fallback.summary),
  };
}

export async function generateBlogRewriteSuggestion(
  article: ExistingBlogArticle,
) {
  if (!isGeminiConfigured()) {
    return createMockRewriteSuggestion(article);
  }

  try {
    const result = await generateGeminiJson<GeminiRewritePayload>({
      feature: "existing-blog-rewrite",
      maxOutputTokens: 2600,
      responseJsonSchema: rewriteResponseSchema,
      systemInstruction: [
        "あなたは美容室のSEOリライト担当です。公開済みブログを、読者に役立つ内容へ安全に改善します。",
        getSalonPromptContext(),
        "実在しないメニュー、価格、口コミ、施術事例は作らないでください。",
        "効果を断定せず、個人差がある内容には注意を入れてください。",
        "WordPressへ自動投稿せず、人が確認して直せる提案だけを返してください。",
      ].join("\n\n"),
      prompt: [
        "次の公開済みブログについて、ef.mayke`s向けのリライト提案をJSONだけで返してください。",
        `店舗名: ${salonProfile.name}`,
        `記事タイトル: ${article.title}`,
        `URL: ${article.url}`,
        `カテゴリ: ${article.category}`,
        `対策キーワード: ${article.targetKeyword || "未設定"}`,
        `補助キーワード: ${article.secondaryKeywords.join("、") || "未設定"}`,
        `公開日: ${article.publishedAt || "未設定"}`,
        `更新日: ${article.lastUpdatedAt || "未設定"}`,
        `メモ: ${article.memo || "未設定"}`,
        article.metrics
          ? [
              "Search Console指標:",
              `期間: ${article.metrics.periodLabel}`,
              `クリック: ${article.metrics.clicks}`,
              `表示回数: ${article.metrics.impressions}`,
              `CTR: ${(article.metrics.ctr * 100).toFixed(2)}%`,
              `平均掲載順位: ${article.metrics.position.toFixed(1)}`,
              `改善シグナル: ${article.metrics.signal}`,
            ].join("\n")
          : "Search Console指標: 未取得",
        "提案には、タイトル改善、メタディスクリプション改善、見出し改善、FAQ追加、内部リンク、LINE相談CTA、注意点を含めてください。",
      ].join("\n\n"),
    });

    return toSuggestion(result.value, article, result.model);
  } catch (error) {
    const fallback = createMockRewriteSuggestion(article);
    const code = error instanceof GeminiServiceError ? error.code : "unknown";
    console.warn("[blog-rewrite] using mock fallback", { code });
    return {
      ...fallback,
      cautionNotes: [
        ...fallback.cautionNotes,
        "AI提案の生成に失敗したため、確認用のモック提案を表示しています。",
      ],
    };
  }
}
