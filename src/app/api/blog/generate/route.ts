import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GeminiServiceError,
  generateGeminiJson,
  getGeminiModel,
  isGeminiConfigured,
} from "@/lib/ai/server";
import {
  blogCategories,
  createMockBlogArticle,
  createSlug,
  lineCtaButtonText,
  lineCtaText,
} from "@/lib/blog";
import {
  createWordPressHtmlServer,
  htmlToEditableContent,
  sanitizeBlogHtmlServer,
} from "@/lib/blogHtml.server";
import { getSalonPromptContext, salonProfile } from "@/lib/salonProfile";
import type {
  BlogArticleType,
  BlogCategory,
  BlogConcern,
  BlogFaq,
  BlogGenerateRequest,
  BlogGenerateResponse,
  BlogHeading,
  BlogLength,
  BlogTargetAge,
} from "@/types/blog";

export const runtime = "nodejs";

const maxRequestCharacters = 24_000;
const cacheLifetimeMs = 5 * 60 * 1000;
const maxCacheEntries = 50;

const targetAges: BlogTargetAge[] = ["20代", "30代", "40代", "50代", "60代"];
const concerns: BlogConcern[] = [
  "くせ毛",
  "パサつき",
  "広がり",
  "白髪",
  "ダメージ",
  "まとまらない",
];
const articleTypes: BlogArticleType[] = [
  "SEO記事",
  "お悩み解決記事",
  "Before/After紹介記事",
  "メニュー紹介記事",
  "季節提案記事",
  "Instagram投稿からブログ化",
];
const lengths: BlogLength[] = ["800文字", "1200文字", "2000文字", "3000文字"];

type GeminiBlogPayload = {
  targetKeyword?: unknown;
  secondaryKeywords?: unknown;
  searchIntent?: unknown;
  targetAudience?: unknown;
  readerProblems?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  summary?: unknown;
  category?: unknown;
  slug?: unknown;
  headings?: unknown;
  bodyHtml?: unknown;
  beforeAfterCaptions?: unknown;
  internalLinkSuggestions?: unknown;
  faq?: unknown;
  ctaText?: unknown;
  ctaUrl?: unknown;
  trendSummary?: unknown;
  blogValue?: unknown;
  salonRelevance?: unknown;
};

type CacheEntry = {
  expiresAt: number;
  response: BlogGenerateResponse;
};

const responseCache = new Map<string, CacheEntry>();

const blogResponseSchema = {
  type: "object",
  properties: {
    targetKeyword: { type: "string" },
    secondaryKeywords: { type: "array", items: { type: "string" } },
    searchIntent: { type: "string" },
    targetAudience: { type: "string" },
    readerProblems: { type: "array", items: { type: "string" } },
    title: { type: "string" },
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    summary: { type: "string" },
    category: { type: "string", enum: blogCategories },
    slug: { type: "string" },
    headings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["h2"] },
          text: { type: "string" },
          children: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["h3"] },
                text: { type: "string" },
              },
              required: ["level", "text"],
            },
          },
        },
        required: ["level", "text", "children"],
      },
    },
    bodyHtml: { type: "string" },
    beforeAfterCaptions: { type: "array", items: { type: "string" } },
    internalLinkSuggestions: { type: "array", items: { type: "string" } },
    faq: {
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
    ctaText: { type: "string" },
    ctaUrl: { type: "string" },
    trendSummary: { type: "string" },
    blogValue: { type: "string" },
    salonRelevance: { type: "string" },
  },
  required: [
    "targetKeyword",
    "secondaryKeywords",
    "searchIntent",
    "targetAudience",
    "readerProblems",
    "title",
    "metaTitle",
    "metaDescription",
    "summary",
    "category",
    "slug",
    "headings",
    "bodyHtml",
    "beforeAfterCaptions",
    "internalLinkSuggestions",
    "faq",
    "ctaText",
    "ctaUrl",
    "trendSummary",
    "blogValue",
    "salonRelevance",
  ],
};

function getOption<T extends string>(value: unknown, options: T[], fallback: T) {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}

function safeString(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function safeStringArray(
  value: unknown,
  maxItems = 8,
  maxItemLength = 240,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.replace(/^#/, "").trim().slice(0, maxItemLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function sanitizeRequest(value: unknown): BlogGenerateRequest {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    articleSummary: safeString(record.articleSummary, 800),
    articleType: getOption(record.articleType, articleTypes, "SEO記事"),
    concern: getOption(record.concern, concerns, "パサつき"),
    length: getOption(record.length, lengths, "1200文字"),
    mainKeyword: safeString(record.mainKeyword, 120, "松江 髪質改善"),
    preferredTitle: safeString(record.preferredTitle, 120),
    readerProblems: safeStringArray(record.readerProblems, 8, 180),
    referenceMemos: safeStringArray(record.referenceMemos, 5, 600),
    referenceTitles: safeStringArray(record.referenceTitles, 5, 200),
    searchIntent: safeString(record.searchIntent, 600),
    secondaryKeywords: safeStringArray(record.secondaryKeywords, 10, 100),
    sourcePriority: safeString(record.sourcePriority, 30),
    sourceSeoKeywordId: safeString(record.sourceSeoKeywordId, 100),
    sourceSearchConsoleImportId: safeString(
      record.sourceSearchConsoleImportId,
      100,
    ),
    sourceTargetPage: safeString(record.sourceTargetPage, 500),
    sourceTrendId: safeString(record.sourceTrendId, 100),
    targetAge: getOption(record.targetAge, targetAges, "40代"),
    targetAudience: safeString(record.targetAudience, 400),
  };
}

function toHeadings(value: unknown, fallback: BlogHeading[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const headings = value
    .map((item): BlogHeading | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const text = safeString(record.text, 140);

      if (!text) {
        return null;
      }

      const children = Array.isArray(record.children)
        ? record.children
            .map((child) => {
              if (typeof child !== "object" || child === null) {
                return null;
              }

              const childText = safeString(
                (child as Record<string, unknown>).text,
                140,
              );
              return childText
                ? ({ level: "h3", text: childText } as const)
                : null;
            })
            .filter((child): child is { level: "h3"; text: string } => Boolean(child))
            .slice(0, 5)
        : [];

      return { children, level: "h2", text };
    })
    .filter((item): item is BlogHeading => Boolean(item))
    .slice(0, 12);

  return headings.length ? headings : fallback;
}

function toFaq(value: unknown, fallback: BlogFaq[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const faq = value
    .map((item): BlogFaq | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const question = safeString(record.question, 180);
      const answer = safeString(record.answer, 600);
      return question && answer ? { answer, question } : null;
    })
    .filter((item): item is BlogFaq => Boolean(item))
    .slice(0, 8);

  return faq.length ? faq : fallback;
}

function toCategory(value: unknown, fallback: BlogCategory) {
  return typeof value === "string" && blogCategories.includes(value as BlogCategory)
    ? (value as BlogCategory)
    : fallback;
}

function toGeneratedBlog(
  value: GeminiBlogPayload,
  request: BlogGenerateRequest,
  model: string,
): BlogGenerateResponse {
  const fallback = createMockBlogArticle(request);
  const targetKeyword = safeString(value.targetKeyword, 120, request.mainKeyword);
  const title = safeString(value.title, 120, fallback.title);
  const articleSummary = safeString(value.summary, 800, fallback.articleSummary);
  const bodyHtml = sanitizeBlogHtmlServer(
    safeString(value.bodyHtml, 60_000, fallback.bodyHtml),
  );
  const ctaText = safeString(value.ctaText, 120, lineCtaButtonText);
  const wordpressHtml = createWordPressHtmlServer(bodyHtml, ctaText);
  const secondaryKeywords = safeStringArray(value.secondaryKeywords, 10, 100);
  const beforeAfterCaptions = safeStringArray(value.beforeAfterCaptions, 4, 300);

  return {
    aiModel: model,
    articleSummary,
    beforeAfterCaption:
      beforeAfterCaptions[0] ?? fallback.beforeAfterCaption,
    beforeAfterCaptions: beforeAfterCaptions.length
      ? beforeAfterCaptions
      : fallback.beforeAfterCaptions,
    blogValue: safeString(value.blogValue, 600, fallback.blogValue),
    bodyHtml,
    category: toCategory(value.category, fallback.category),
    content: htmlToEditableContent(bodyHtml) || fallback.content,
    ctaText,
    ctaUrl: salonProfile.ctaUrl,
    excerpt: articleSummary.slice(0, 240),
    faq: toFaq(value.faq, fallback.faq),
    generatedBy: "gemini",
    generationMode: "gemini",
    generationNotice: "GeminiでSEOブログ下書きを生成しました。",
    headings: toHeadings(value.headings, fallback.headings),
    instagramCaption: `${title}\n\n${articleSummary}`.slice(0, 900),
    internalLinkSuggestions: safeStringArray(
      value.internalLinkSuggestions,
      8,
      500,
    ),
    lineCta: lineCtaText,
    metaDescription: safeString(
      value.metaDescription,
      160,
      fallback.metaDescription,
    ),
    metaTitle: safeString(value.metaTitle, 60, `${title} | ef.mayke\`s`),
    providerLabel: "Gemini API",
    readerProblems: safeStringArray(value.readerProblems, 8, 180),
    relatedSnsPostIds: [],
    relatedTrendIds: request.sourceTrendId ? [request.sourceTrendId] : [],
    relatedYoutubeUrls: [],
    salonRelevance: safeString(
      value.salonRelevance,
      600,
      fallback.salonRelevance,
    ),
    searchIntent: safeString(value.searchIntent, 600, fallback.searchIntent),
    secondaryKeywords: secondaryKeywords.length
      ? secondaryKeywords
      : fallback.secondaryKeywords,
    slug: createSlug(safeString(value.slug, 160, targetKeyword)),
    sourceSeoKeywordId: request.sourceSeoKeywordId ?? "",
    sourceSearchConsoleImportId:
      request.sourceSearchConsoleImportId ?? "",
    status: "draft",
    tags: Array.from(
      new Set([targetKeyword, ...secondaryKeywords, "髪質改善", "松江市美容室"]),
    ).slice(0, 12),
    targetAudience: safeString(
      value.targetAudience,
      400,
      fallback.targetAudience,
    ),
    targetKeyword,
    title,
    trendSummary: safeString(
      value.trendSummary,
      600,
      fallback.trendSummary,
    ),
    wordpressHtml,
  };
}

function getOutputTokens(length: BlogLength) {
  if (length === "3000文字") return 7600;
  if (length === "2000文字") return 6200;
  if (length === "800文字") return 3200;
  return 4400;
}

function getCacheKey(request: BlogGenerateRequest) {
  return createHash("sha256")
    .update(JSON.stringify({ model: getGeminiModel(), request }))
    .digest("hex");
}

function getCachedResponse(key: string) {
  const cached = responseCache.get(key);

  if (!cached || cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return cached.response;
}

function saveCachedResponse(key: string, response: BlogGenerateResponse) {
  if (responseCache.size >= maxCacheEntries) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }

  responseCache.set(key, {
    expiresAt: Date.now() + cacheLifetimeMs,
    response,
  });
}

function getFallbackNotice(error: unknown) {
  if (!(error instanceof GeminiServiceError)) {
    return "AI生成を完了できなかったため、確認用のサンプル記事を表示しています。";
  }

  if (error.code === "invalid_key") {
    return "AIとの接続を確認できなかったため、確認用のサンプル記事を表示しています。";
  }
  if (error.code === "rate_limited") {
    return "AIが混み合っているため、確認用のサンプル記事を表示しています。少し時間をおいて再度お試しください。";
  }
  if (error.code === "timeout") {
    return "AIの応答に時間がかかったため、確認用のサンプル記事を表示しています。";
  }
  if (error.code === "invalid_json" || error.code === "empty_response") {
    return "AIの回答を読み取れなかったため、確認用のサンプル記事を表示しています。";
  }

  return "AI生成を完了できなかったため、確認用のサンプル記事を表示しています。";
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > maxRequestCharacters * 2) {
    return NextResponse.json(
      { error: "入力内容が長すぎます。参考情報を短くしてもう一度お試しください。" },
      { status: 413 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const serializedBody = JSON.stringify(body);

  if (serializedBody.length > maxRequestCharacters) {
    return NextResponse.json(
      { error: "入力内容が長すぎます。参考情報を短くしてもう一度お試しください。" },
      { status: 413 },
    );
  }

  const blogRequest = sanitizeRequest(body);
  const cacheKey = getCacheKey(blogRequest);
  const cached = getCachedResponse(cacheKey);

  if (cached) {
    console.info("[blog-generate] cache hit", { model: cached.aiModel });
    return NextResponse.json({
      ...cached,
      generationNotice: `${cached.generationNotice ?? "記事を生成しました。"} 同じ入力の直近結果を再利用しました。`,
    });
  }

  if (!isGeminiConfigured()) {
    const mock = {
      ...createMockBlogArticle(blogRequest),
      generationNotice: "確認用のサンプル記事を生成しました。",
    };
    saveCachedResponse(cacheKey, mock);
    return NextResponse.json(mock);
  }

  try {
    const result = await generateGeminiJson<GeminiBlogPayload>({
      feature: "seo-blog-generation",
      maxOutputTokens: getOutputTokens(blogRequest.length),
      responseJsonSchema: blogResponseSchema,
      systemInstruction: [
        "あなたは美容師の専門性と読者への誠実さを重視する、日本語のSEO編集者です。",
        getSalonPromptContext(),
        "売り込みすぎず、大人女性に丁寧でやさしく語りかけてください。",
        "キーワードや地域名を不自然に繰り返さず、検索意図へ具体的に答えてください。",
        "他サイトの文章、架空の口コミ、架空の施術事例、未提供メニューを作らないでください。",
        "医療的な断定、必ず治る・絶対に改善するなどの表現は禁止です。個人差がある内容には注意書きを添えてください。",
        "本文HTMLはh2、h3、h4、p、ul、ol、li、strong、blockquoteのみを基本とし、script、iframe、style、イベント属性を含めないでください。",
        `CTAは「${lineCtaButtonText}」、URLは${salonProfile.ctaUrl}だけを使用してください。`,
      ].join("\n\n"),
      prompt: [
        "以下の情報をもとに、ef.mayke`sのお客様へ役立つSEOブログ下書きをJSONで1件作成してください。",
        `対策キーワード: ${blogRequest.mainKeyword}`,
        `補助キーワード: ${blogRequest.secondaryKeywords?.join("、") || "自然に提案"}`,
        `検索意図: ${blogRequest.searchIntent || "キーワードから推定"}`,
        `想定読者: ${blogRequest.targetAudience || `${blogRequest.targetAge}の大人女性`}`,
        `読者の悩み: ${blogRequest.readerProblems?.join("、") || blogRequest.concern}`,
        `記事タイプ: ${blogRequest.articleType}`,
        `文字数目安: ${blogRequest.length}`,
        `希望タイトル: ${blogRequest.preferredTitle || "なし"}`,
        `記事概要: ${blogRequest.articleSummary || "なし"}`,
        `元情報タイトル: ${blogRequest.referenceTitles?.join(" / ") || "なし"}`,
        `元情報の要点: ${blogRequest.referenceMemos?.join(" / ") || "なし"}`,
        `SEO優先度: ${blogRequest.sourcePriority || "未設定"}`,
        `対象ページ: ${blogRequest.sourceTargetPage || "未設定"}`,
        "構成は読者の悩み、原因、自宅ケアの限界、美容室でできること、カウンセリング、施術方針、Before／After位置、ホームケア、FAQ、LINE案内を基本にし、テーマに合わせて自然に調整してください。",
        "Before／Afterは実例を捏造せず、画像を入れる場所と安全なキャプション案だけを作ってください。",
        "内部リンクはef-mayke-s.com配下または相対URLだけを提案してください。",
      ].join("\n"),
    });
    const response = toGeneratedBlog(result.value, blogRequest, result.model);
    saveCachedResponse(cacheKey, response);
    return NextResponse.json(response);
  } catch (error) {
    const code = error instanceof GeminiServiceError ? error.code : "unexpected";
    console.warn("[blog-generate] using mock fallback", { code });
    const mock = {
      ...createMockBlogArticle(blogRequest),
      generationNotice: getFallbackNotice(error),
    };
    saveCachedResponse(cacheKey, mock);
    return NextResponse.json(mock);
  }
}
