import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import {
  detectSocialType,
  getTitleSimilarity,
  normalizeSocialUrl,
} from "@/lib/social/url";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createSocialPostInSupabase } from "@/lib/supabase/socialPosts";
import {
  fetchSocialSourcesFromSupabase,
  updateSocialSourceInSupabase,
} from "@/lib/supabase/socialSources";
import {
  createSocialImportRun,
  findSocialImportRunByIdempotency,
  updateSocialImportRun,
} from "@/lib/supabase/socialImportRuns";
import { snsTrendCategories } from "@/lib/sns";
import type { SnsType } from "@/types/snsPost";
import type {
  NewSocialPost,
  SocialClassification,
  SocialClassificationStatus,
  SocialSource,
} from "@/types/social";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

export const runtime = "nodejs";

const maxImportItems = 50;
const freeImportItemLimit = 30;
const defaultAiLimit = 10;
const freeAiLimit = 3;
const maxRequestBodyBytes = 4 * 1024 * 1024;

type ImportBudgetMode = "free" | "standard";

type ImportRequest = {
  actorId?: unknown;
  actorRunId?: unknown;
  aiLimit?: unknown;
  budgetMode?: unknown;
  datasetId?: unknown;
  dryRun?: unknown;
  idempotencyKey?: unknown;
  items?: unknown[];
  maxItems?: unknown;
  provider?: unknown;
  posts?: unknown[];
  requestId?: unknown;
  results?: unknown[];
  skipAi?: unknown;
  sourceName?: unknown;
};

type NormalizedImportItem = {
  accountName: string;
  canonicalUrl: string;
  commentCount?: number;
  description: string;
  externalId: string;
  handle: string;
  importKey: string;
  likeCount?: number;
  ogImageUrl: string;
  playCount?: number;
  publishedAt?: string;
  payloadHash: string;
  rawPayload: Record<string, unknown>;
  shareCount?: number;
  snsType: SnsType;
  sourceName: string;
  tags: string[];
  title: string;
  url: string;
};

type ImportResult = {
  reason?: string;
  savedId?: string;
  snsType?: SnsType;
  status: "duplicate" | "error" | "preview" | "saved" | "skipped";
  title?: string;
  url?: string;
};

type ClassificationOutcome = {
  classification: SocialClassification;
  error?: string;
  model?: string;
  provider: string;
  status: SocialClassificationStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeCompare(value: string, expectedValue: string) {
  const maxLength = Math.max(value.length, expectedValue.length);
  let mismatch = value.length === expectedValue.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |=
      (value.charCodeAt(index) || 0) ^ (expectedValue.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function isAuthorized(request: Request) {
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-automation-secret") ?? "";

  return (
    safeCompare(authorization, `Bearer ${secret}`) ||
    safeCompare(headerSecret, secret)
  );
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[key];
  }, source);
}

function pickString(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function pickNumber(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const parsedValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/,/g, ""))
          : Number.NaN;

    if (Number.isFinite(parsedValue) && parsedValue >= 0) {
      return Math.round(parsedValue);
    }
  }

  return undefined;
}

function cleanText(value: string, maxLength = 1_000) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanHandle(value: string) {
  const normalized = value.trim().replace(/^@+/, "");

  if (!normalized) {
    return "";
  }

  return `@${normalized}`.slice(0, 120);
}

function detectSnsTypeFromText(source: Record<string, unknown>, url: string): SnsType {
  const declaredType = pickString(source, [
    "snsType",
    "sns_type",
    "platform",
    "type",
    "provider",
  ]).toLowerCase();
  const urlType = detectSocialType(url);

  // The canonical URL is authoritative when it belongs to a known SNS domain.
  // This prevents a malformed actor field such as platform=Instagram from
  // being stored as Instagram when the URL is actually a TikTok post.
  if (urlType !== "Other") {
    return urlType;
  }

  if (declaredType.includes("instagram")) {
    return "Instagram";
  }

  if (declaredType.includes("tiktok")) {
    return "TikTok";
  }

  if (declaredType.includes("youtube")) {
    return "YouTube";
  }

  if (declaredType.includes("pinterest")) {
    return "Pinterest";
  }

  if (declaredType === "x" || declaredType.includes("twitter")) {
    return "X";
  }

  return "Other";
}

function extractUrl(source: Record<string, unknown>) {
  const directUrl = pickString(source, [
    "url",
    "canonicalUrl",
    "canonical_url",
    "postUrl",
    "post_url",
    "webVideoUrl",
    "videoUrl",
    "shareUrl",
    "inputUrl",
    "input_url",
    "permalink",
    "link",
  ]);

  if (directUrl) {
    return directUrl;
  }

  const shortCode = pickString(source, ["shortCode", "shortcode", "code"]);

  if (shortCode) {
    return `https://www.instagram.com/p/${shortCode}`;
  }

  return "";
}

function extractTags(source: Record<string, unknown>, description: string) {
  const rawTags = getNestedValue(source, "hashtags") ?? getNestedValue(source, "tags");
  const tags = new Set<string>();

  if (Array.isArray(rawTags)) {
    rawTags.forEach((tag) => {
      if (typeof tag === "string" || typeof tag === "number") {
        const normalized = String(tag).replace(/^#/, "").trim();

        if (normalized) {
          tags.add(`#${normalized}`);
        }
      }
    });
  }

  for (const match of description.matchAll(/#[\p{L}\p{N}_]+/gu)) {
    tags.add(match[0]);
  }

  return Array.from(tags).slice(0, 12);
}

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, 600);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizePayload(item, depth + 1));
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) =>
        !/(authorization|cookie|password|secret|token|api[_-]?key|email|phone)/i.test(
          key,
        ),
      )
      .slice(0, 40)
      .map(([key, item]) => [key, sanitizePayload(item, depth + 1)])
      .filter(([, item]) => typeof item !== "undefined"),
  );
}

function createPayloadHash(payload: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function normalizeImportKey(
  provider: string,
  snsType: SnsType,
  externalId: string,
  canonicalUrl: string,
) {
  return `${provider}:${snsType}:${externalId || canonicalUrl}`
    .toLowerCase()
    .slice(0, 500);
}

function normalizePublishedAt(value: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function normalizeImportItem(
  item: unknown,
  defaultSourceName: string,
  provider: string,
): NormalizedImportItem | null {
  if (!isRecord(item)) {
    return null;
  }

  const rawUrl = extractUrl(item);

  if (!rawUrl) {
    return null;
  }

  let url: string;

  try {
    url = normalizeSocialUrl(rawUrl);
  } catch {
    return null;
  }

  const canonicalUrl =
    (() => {
      const rawCanonicalUrl = pickString(item, ["canonicalUrl", "canonical_url"]);

      if (!rawCanonicalUrl) {
        return url;
      }

      try {
        return normalizeSocialUrl(rawCanonicalUrl);
      } catch {
        return url;
      }
    })();
  const description = cleanText(
    pickString(item, [
      "caption",
      "text",
      "description",
      "desc",
      "title",
      "videoDescription",
    ]),
    2_000,
  );
  const accountName = cleanText(
    pickString(item, [
      "accountName",
      "account_name",
      "ownerFullName",
      "owner.fullName",
      "authorMeta.nickName",
      "authorName",
      "author_name",
      "username",
      "ownerUsername",
    ]),
    160,
  );
  const handle = cleanHandle(
    pickString(item, [
      "handle",
      "username",
      "ownerUsername",
      "owner.username",
      "authorMeta.name",
      "authorUniqueId",
    ]),
  );
  const snsType = detectSnsTypeFromText(item, url);
  const rawPayload = (sanitizePayload(item) ?? {}) as Record<string, unknown>;
  const externalId = pickString(item, [
    "id",
    "postId",
    "post_id",
    "videoId",
    "video_id",
    "shortCode",
    "shortcode",
    "code",
  ]).slice(0, 160);
  const title =
    cleanText(
      pickString(item, ["title", "headline", "name"]) ||
        description ||
        `${snsType} post${handle ? ` by ${handle}` : ""}`,
      300,
    ) || `${snsType} post`;

  return {
    accountName,
    canonicalUrl,
    commentCount: pickNumber(item, [
      "commentCount",
      "commentsCount",
      "comment_count",
      "comment_count_total",
    ]),
    description,
    externalId,
    handle,
    importKey: normalizeImportKey(provider, snsType, externalId, canonicalUrl),
    likeCount: pickNumber(item, [
      "likeCount",
      "likesCount",
      "likes",
      "diggCount",
      "like_count",
    ]),
    ogImageUrl: pickString(item, [
      "thumbnailUrl",
      "thumbnail_url",
      "displayUrl",
      "display_url",
      "coverUrl",
      "cover",
      "image",
      "imageUrl",
    ]),
    playCount: pickNumber(item, [
      "playCount",
      "plays",
      "videoPlayCount",
      "videoViewCount",
      "viewCount",
      "views",
    ]),
    publishedAt: normalizePublishedAt(
      pickString(item, [
        "publishedAt",
        "published_at",
        "timestamp",
        "takenAt",
        "taken_at",
        "createTimeISO",
        "createTime",
      ]),
    ),
    payloadHash: createPayloadHash(rawPayload),
    rawPayload,
    shareCount: pickNumber(item, ["shareCount", "shares", "share_count"]),
    snsType,
    sourceName:
      cleanText(
        pickString(item, ["sourceName", "source_name", "actorName"]) ||
          defaultSourceName,
        160,
      ) || "Apify",
    tags: extractTags(item, description),
    title,
    url,
  };
}

function extractItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  for (const key of ["items", "posts", "results", "data", "datasetItems"]) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [body];
}

function normalizeCategory(value: unknown, fallback: TrendCategory) {
  return snsTrendCategories.find((category) => category === value) ?? fallback;
}

function normalizeRelevance(value: unknown): SalonRelevance {
  return value === "高" || value === "中" || value === "低" ? value : "中";
}

function normalizeTags(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tags = Array.from(
    new Set(
      value
        .map((tag) => String(tag).replace(/^#/, "").trim())
        .filter(Boolean)
        .map((tag) => `#${tag}`),
    ),
  ).slice(0, 12);

  return tags.length > 0 ? tags : fallback;
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new Error("JSON object was not found.");
  }

  return cleaned.slice(start, end + 1);
}

function fallbackClassification(item: NormalizedImportItem): SocialClassification {
  const text = `${item.title} ${item.description} ${item.tags.join(" ")}`;
  const highKeywords = [
    "髪質改善",
    "縮毛矯正",
    "くせ毛",
    "パサつき",
    "艶髪",
    "白髪",
    "白髪ぼかし",
    "大人女性",
    "ストレート",
  ];
  const relevance: SalonRelevance = highKeywords.some((keyword) =>
    text.includes(keyword),
  )
    ? "高"
    : item.snsType === "Instagram" || item.snsType === "TikTok"
      ? "中"
      : "低";
  const category: TrendCategory = text.includes("白髪")
    ? "白髪ぼかし"
    : text.includes("カラー")
      ? "カラー"
      : text.includes("パーマ")
        ? "パーマ"
        : text.includes("髪質改善") ||
            text.includes("縮毛矯正") ||
            text.includes("くせ毛")
          ? "髪質改善"
          : item.snsType === "Instagram"
            ? "Instagram"
            : "SNS投稿";
  const tags = Array.from(
    new Set([
      ...item.tags,
      `#${category}`,
      item.snsType === "TikTok" ? "#TikTok" : `#${item.snsType}`,
    ]),
  ).slice(0, 12);

  return {
    blogIdea: `${item.title}をもとに、髪質や年代、サロンでの提案方法を整理したブログ下書きを作れます。`,
    category,
    counselingIdea:
      "お客様に見せる参考例として使い、髪質、履歴、普段の扱いやすさに合わせて再現できる範囲を説明します。",
    instagramPostIdea: `${item.title}\n\n気になるデザインは、髪質やダメージ履歴に合わせて調整することが大切です。保存してカウンセリング時の参考にしてください。`,
    providerLabel: "モック分類",
    relevance,
    summary:
      item.description ||
      `${item.snsType}から取り込んだ投稿候補です。美容師向けの投稿ネタ、ブログ、接客提案に使えるか確認してください。`,
    tags,
    trendName: item.title,
  };
}

async function classifyItem(
  item: NormalizedImportItem,
  shouldUseAi: boolean,
): Promise<ClassificationOutcome> {
  const fallback = fallbackClassification(item);

  if (!shouldUseAi) {
    return {
      classification: fallback,
      provider: fallback.providerLabel,
      status: "mock",
    };
  }

  try {
    const result = await generateAiText({
      maxOutputTokens: 1_400,
      systemInstruction: [
        "あなたは美容師向けSNSトレンドを整理する日本語アシスタントです。",
        "InstagramやTikTokの投稿候補を、サロンの発信、ブログ、接客提案に使いやすい形へ分類してください。",
        "本文や画像を転載するのではなく、入力されたタイトル、説明文、URL、反応数、タグだけを材料にしてください。",
        "ef.mayke`sは髪質改善、縮毛矯正、くせ毛、パサつき改善、白髪ぼかし、大人女性向け提案との関連度を重視します。",
        getSalonPromptContext(),
      ].join("\n\n"),
      prompt: [
        `SNS: ${item.snsType}`,
        `URL: ${item.url}`,
        `タイトル: ${item.title}`,
        `説明: ${item.description || "なし"}`,
        `アカウント: ${item.accountName || item.handle || "不明"}`,
        `反応数: likes=${item.likeCount ?? 0}, comments=${item.commentCount ?? 0}, plays=${item.playCount ?? 0}, shares=${item.shareCount ?? 0}`,
        `タグ: ${item.tags.join("、") || "なし"}`,
        `カテゴリ候補: ${snsTrendCategories.join("、")}`,
        "次のJSONオブジェクトだけを返してください。",
        JSON.stringify({
          blog_idea: "ブログ記事案",
          category: "髪質改善",
          counseling_idea: "カウンセリングでの使い方",
          instagram_post_idea: "Instagram投稿案",
          relevance: "高",
          summary: "短い要約",
          tags: ["#髪質改善", "#艶髪"],
          trend_name: "トレンド名",
        }),
      ].join("\n"),
    });
    const parsed = JSON.parse(extractJsonObject(result.text)) as Record<
      string,
      unknown
    >;

    return {
      classification: {
        blogIdea:
          typeof parsed.blog_idea === "string" && parsed.blog_idea.trim()
            ? parsed.blog_idea.trim()
            : fallback.blogIdea,
        category: normalizeCategory(parsed.category, fallback.category),
        counselingIdea:
          typeof parsed.counseling_idea === "string" &&
          parsed.counseling_idea.trim()
            ? parsed.counseling_idea.trim()
            : fallback.counselingIdea,
        instagramPostIdea:
          typeof parsed.instagram_post_idea === "string" &&
          parsed.instagram_post_idea.trim()
            ? parsed.instagram_post_idea.trim()
            : fallback.instagramPostIdea,
        providerLabel: result.providerLabel,
        relevance: normalizeRelevance(parsed.relevance),
        summary:
          typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : fallback.summary,
        tags: normalizeTags(parsed.tags, fallback.tags),
        trendName:
          typeof parsed.trend_name === "string" && parsed.trend_name.trim()
            ? parsed.trend_name.trim()
            : fallback.trendName,
      },
      model: result.model,
      provider: result.providerLabel,
      status: "gemini",
    };
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "classification_failed";

    return {
      classification: fallback,
      error: errorCode,
      provider: "Gemini fallback",
      status: "fallback",
    };
  }
}

function toSocialPostInput(
  item: NormalizedImportItem,
  outcome: ClassificationOutcome,
  context: {
    actorId?: string;
    actorRunId?: string;
    classifiedAt: string;
    datasetId?: string;
    importRunId?: string;
    provider: string;
    sourceId?: string;
  },
): NewSocialPost {
  const classification = outcome.classification;

  return {
    actorId: context.actorId,
    accountName: item.accountName,
    aiSummary: classification.summary,
    blogIdea: classification.blogIdea,
    canonicalUrl: item.canonicalUrl,
    category: classification.category,
    commentCount: item.commentCount,
    counselingIdea: classification.counselingIdea,
    description: item.description,
    classificationError: outcome.error,
    classificationModel: outcome.model,
    classificationProvider: outcome.provider,
    classificationStatus: outcome.status,
    classifiedAt: context.classifiedAt,
    datasetId: context.datasetId,
    externalId: item.externalId,
    handle: item.handle,
    importedAt: new Date().toISOString(),
    importKey: item.importKey,
    importRunId: context.importRunId,
    instagramPostIdea: classification.instagramPostIdea,
    isFavorite: false,
    likeCount: item.likeCount,
    ogImageUrl: item.ogImageUrl,
    payloadHash: item.payloadHash,
    playCount: item.playCount,
    publishedAt: item.publishedAt,
    rawPayload: item.rawPayload,
    relevance: classification.relevance,
    reviewStatus: "未確認",
    shareCount: item.shareCount,
    snsType: item.snsType,
    sourceName: item.sourceName,
    sourceId: context.sourceId,
    tags: classification.tags,
    title: classification.trendName || item.title,
    url: item.url,
    actorRunId: context.actorRunId,
    provider: context.provider,
  };
}

function getOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Expected a string option.");
  }

  const normalized = cleanText(value, maxLength);
  return normalized || undefined;
}

function getBooleanOption(value: unknown, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new Error("Boolean options must be JSON booleans.");
  }

  return value;
}

function normalizeSourceHandle(value: string | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function matchesSocialSource(source: SocialSource, item: NormalizedImportItem) {
  if (source.snsType !== item.snsType) {
    return false;
  }

  const itemHandle = normalizeSourceHandle(item.handle);
  const sourceHandle = normalizeSourceHandle(source.handle);

  if (itemHandle && sourceHandle && itemHandle === sourceHandle) {
    return true;
  }

  try {
    return normalizeSocialUrl(source.profileUrl) ===
      normalizeSocialUrl(item.url);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!process.env.AUTOMATION_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json(
      { error: "AUTOMATION_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Automation webhook authorization failed." },
      { status: 401 },
    );
  }

  let body: ImportRequest | unknown[];

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }

    const rawBody = await request.arrayBuffer();

    if (rawBody.byteLength > maxRequestBodyBytes) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }

    body = JSON.parse(new TextDecoder().decode(rawBody)) as
      | ImportRequest
      | unknown[];
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const requestOptions = isRecord(body) ? (body as ImportRequest) : {};
  let sourceName: string;
  let provider: string;
  let actorId: string | undefined;
  let actorRunId: string | undefined;
  let datasetId: string | undefined;
  let requestId: string | undefined;
  let idempotencyKey: string | undefined;
  let dryRun: boolean;
  let skipAi: boolean;
  let aiLimit: number;
  let budgetMode: ImportBudgetMode;
  let itemLimit: number;

  try {
    sourceName = getOptionalString(requestOptions.sourceName, 160) ?? "Apify";
    provider = getOptionalString(requestOptions.provider, 80) ?? "Apify";
    actorId = getOptionalString(requestOptions.actorId, 160);
    actorRunId = getOptionalString(requestOptions.actorRunId, 160);
    datasetId = getOptionalString(requestOptions.datasetId, 160);
    requestId = getOptionalString(
      requestOptions.requestId ?? request.headers.get("x-request-id"),
      200,
    );
    idempotencyKey = getOptionalString(
      requestOptions.idempotencyKey ?? request.headers.get("idempotency-key"),
      200,
    );
    dryRun = getBooleanOption(requestOptions.dryRun);
    skipAi = getBooleanOption(requestOptions.skipAi);

    const normalizedBudgetMode =
      getOptionalString(requestOptions.budgetMode, 20)?.toLowerCase() ??
      "standard";

    if (normalizedBudgetMode !== "free" && normalizedBudgetMode !== "standard") {
      throw new Error('budgetMode must be "free" or "standard".');
    }

    budgetMode = normalizedBudgetMode;

    const rawMaxItems = requestOptions.maxItems;

    if (
      rawMaxItems !== undefined &&
      (typeof rawMaxItems !== "number" ||
        !Number.isInteger(rawMaxItems) ||
        !Number.isFinite(rawMaxItems) ||
        rawMaxItems < 1 ||
        rawMaxItems > maxImportItems)
    ) {
      throw new Error(`maxItems must be an integer between 1 and ${maxImportItems}.`);
    }

    itemLimit = Math.min(
      maxImportItems,
      rawMaxItems === undefined
        ? budgetMode === "free"
          ? freeImportItemLimit
          : maxImportItems
        : rawMaxItems,
    );

    const rawAiLimit = requestOptions.aiLimit;

    if (
      rawAiLimit !== undefined &&
      (typeof rawAiLimit !== "number" ||
        !Number.isInteger(rawAiLimit) ||
        !Number.isFinite(rawAiLimit))
    ) {
      throw new Error("aiLimit must be an integer.");
    }

    aiLimit = Math.max(
      0,
      Math.min(
        budgetMode === "free" ? freeAiLimit : defaultAiLimit,
        rawAiLimit === undefined
          ? budgetMode === "free"
            ? freeAiLimit
            : defaultAiLimit
          : rawAiLimit,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request options.",
      },
      { status: 400 },
    );
  }

  const rawItems = extractItems(body);
  const importItems = rawItems.slice(0, itemLimit);
  const truncatedCount = Math.max(0, rawItems.length - importItems.length);
  const importedItems = importItems
    .map((item) => normalizeImportItem(item, sourceName, provider));
  const candidates = importedItems.filter(
    (item): item is NormalizedImportItem => Boolean(item),
  );

  const skippedCount = importItems.length - candidates.length;
  const supabase = getSupabaseClient();
  let importRunId: string | undefined;

  if (supabase && idempotencyKey) {
    try {
      const previousRun = await findSocialImportRunByIdempotency(
        provider,
        idempotencyKey,
      );

      if (previousRun) {
        return NextResponse.json({
          duplicateRun: true,
          runId: previousRun.id,
          status: previousRun.status,
        });
      }
    } catch (error) {
      console.warn("[social-import] idempotency lookup skipped", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  if (supabase) {
    try {
      const run = await createSocialImportRun({
        actorId,
        actorRunId,
        aiClassifiedCount: 0,
        datasetId,
        duplicateCount: 0,
        errorCount: 0,
        idempotencyKey,
        normalizedCount: 0,
        provider,
        receivedCount: rawItems.length,
        requestId,
        savedCount: 0,
        skippedCount: skippedCount + truncatedCount,
        sourceMatchedCount: 0,
        sourceName,
        startedAt: new Date().toISOString(),
        status: "running",
      });
      importRunId = run?.id;
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";

      if (errorCode === "23505" && idempotencyKey) {
        try {
          const previousRun = await findSocialImportRunByIdempotency(
            provider,
            idempotencyKey,
          );

          if (previousRun) {
            return NextResponse.json({
              duplicateRun: true,
              runId: previousRun.id,
              status: previousRun.status,
            });
          }
        } catch (lookupError) {
          console.warn("[social-import] duplicate run lookup failed", {
            error:
              lookupError instanceof Error ? lookupError.name : "unknown",
          });
        }
      }

      console.warn("[social-import] run ledger unavailable", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  const finishRun = async (changes: {
    aiClassifiedCount: number;
    duplicateCount: number;
    errorCount: number;
    errorSummary?: string;
    normalizedCount: number;
    savedCount: number;
    skippedCount: number;
    sourceMatchedCount: number;
    status:
      | "failed"
      | "no_items"
      | "partial"
      | "preview"
      | "success";
  }) => {
    if (!importRunId) {
      return;
    }

    try {
      await updateSocialImportRun(importRunId, {
        ...changes,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[social-import] run ledger update failed", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  };

  if (candidates.length === 0) {
    await finishRun({
      aiClassifiedCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      normalizedCount: 0,
      savedCount: 0,
      skippedCount: skippedCount + truncatedCount,
      sourceMatchedCount: 0,
      status: "no_items",
    });

    return NextResponse.json(
      {
        aiLimit,
        budgetMode,
        error:
          "No importable social posts were found. Send items with url/postUrl/webVideoUrl and title/caption/description.",
        receivedCount: rawItems.length,
        runId: importRunId,
        skippedCount,
        itemLimit,
        truncatedCount,
      },
      { status: 400 },
    );
  }

  let socialSources: SocialSource[] = [];

  if (supabase) {
    try {
      socialSources = (await fetchSocialSourcesFromSupabase()) ?? [];
    } catch (error) {
      console.warn("[social-import] social source lookup skipped", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  const existingUrls = new Set<string>();
  const existingCanonicalUrls = new Set<string>();
  const existingImportKeys = new Set<string>();
  const results: ImportResult[] = [];

  if (supabase) {
    const urls = Array.from(new Set(candidates.map((item) => item.url)));
    const canonicalUrls = Array.from(
      new Set(candidates.map((item) => item.canonicalUrl)),
    );
    const importKeys = Array.from(
      new Set(candidates.map((item) => item.importKey)),
    );

    const urlRows = urls.length
      ? await supabase.from("social_posts").select("url").in("url", urls)
      : { data: [], error: null };
    const canonicalRows = canonicalUrls.length
      ? await supabase
          .from("social_posts")
          .select("canonical_url")
          .in("canonical_url", canonicalUrls)
      : { data: [], error: null };
    const importKeyRows = importKeys.length
      ? await supabase
          .from("social_posts")
          .select("import_key")
          .in("import_key", importKeys)
      : { data: [], error: null };

    const missingImportKeyColumn = importKeyRows.error?.code === "42703";

    if (urlRows.error || canonicalRows.error || (importKeyRows.error && !missingImportKeyColumn)) {
      await finishRun({
        aiClassifiedCount: 0,
        duplicateCount: 0,
        errorCount: 1,
        errorSummary: "Could not read existing social_posts.",
        normalizedCount: candidates.length,
        savedCount: 0,
        skippedCount: skippedCount + truncatedCount,
        sourceMatchedCount: 0,
        status: "failed",
      });
      return NextResponse.json(
        {
          error:
            "Could not read existing social_posts. Check Supabase settings and schema.sql.",
          runId: importRunId,
        },
        { status: 500 },
      );
    }

    (urlRows.data ?? []).forEach((row) => {
      if (typeof row.url === "string") {
        existingUrls.add(row.url.toLowerCase());
      }
    });
    (canonicalRows.data ?? []).forEach((row) => {
      if (typeof row.canonical_url === "string") {
        existingCanonicalUrls.add(row.canonical_url.toLowerCase());
      }
    });
    (importKeyRows.data ?? []).forEach((row) => {
      if (typeof row.import_key === "string") {
        existingImportKeys.add(row.import_key.toLowerCase());
      }
    });
  }

  const batchUrls = new Set<string>();
  const batchCanonicalUrls = new Set<string>();
  const batchImportKeys = new Set<string>();
  const batchTitles: string[] = [];
  let savedCount = 0;
  let duplicateCount = 0;
  let previewCount = 0;
  let errorCount = 0;
  let aiClassifiedCount = 0;
  let sourceMatchedCount = 0;
  let aiUsed = 0;
  const matchedSourceIds = new Set<string>();

  for (const item of candidates) {
    const normalizedUrl = item.url.toLowerCase();
    const normalizedCanonicalUrl = item.canonicalUrl.toLowerCase();
    const normalizedImportKey = item.importKey.toLowerCase();
    const isDuplicateUrl =
      existingUrls.has(normalizedUrl) ||
      existingCanonicalUrls.has(normalizedCanonicalUrl) ||
      existingImportKeys.has(normalizedImportKey) ||
      batchUrls.has(normalizedUrl) ||
      batchCanonicalUrls.has(normalizedCanonicalUrl) ||
      batchImportKeys.has(normalizedImportKey);
    const similarTitle = batchTitles.find(
      (title) => getTitleSimilarity(title, item.title) >= 0.92,
    );

    if (isDuplicateUrl || similarTitle) {
      duplicateCount += 1;
      results.push({
        reason: isDuplicateUrl
          ? "URL, canonical URL, or import key already exists."
          : "A very similar title already exists.",
        snsType: item.snsType,
        status: "duplicate",
        title: item.title,
        url: item.url,
      });
      continue;
    }

    const matchedSource = socialSources.find((source) =>
      matchesSocialSource(source, item),
    );

    if (matchedSource) {
      sourceMatchedCount += 1;
      matchedSourceIds.add(matchedSource.id);
    }

    const shouldUseAi =
      !skipAi && aiUsed < aiLimit && Boolean(process.env.GEMINI_API_KEY?.trim());
    if (shouldUseAi) {
      aiUsed += 1;
      aiClassifiedCount += 1;
    }
    const classification = await classifyItem(item, shouldUseAi);
    const outcome: ClassificationOutcome = skipAi
      ? { ...classification, provider: "AI未実行", status: "not_requested" }
      : classification;
    const input = toSocialPostInput(item, outcome, {
      actorId,
      actorRunId,
      classifiedAt: new Date().toISOString(),
      datasetId,
      importRunId,
      provider,
      sourceId: matchedSource?.id,
    });

    if (dryRun || !supabase) {
      previewCount += 1;
      results.push({
        reason: dryRun
          ? "Dry run only. Nothing was saved."
          : "Supabase is not configured. Preview only.",
        snsType: item.snsType,
        status: "preview",
        title: input.title,
        url: item.url,
      });
      batchUrls.add(normalizedUrl);
      batchCanonicalUrls.add(normalizedCanonicalUrl);
      batchImportKeys.add(normalizedImportKey);
      batchTitles.push(input.title);
      continue;
    }

    try {
      const savedPost = await createSocialPostInSupabase(input);

      savedCount += savedPost ? 1 : 0;
      results.push({
        savedId: savedPost?.id,
        snsType: item.snsType,
        status: savedPost ? "saved" : "preview",
        title: input.title,
        url: item.url,
      });
      existingUrls.add(normalizedUrl);
      existingCanonicalUrls.add(normalizedCanonicalUrl);
      existingImportKeys.add(normalizedImportKey);
      batchUrls.add(normalizedUrl);
      batchCanonicalUrls.add(normalizedCanonicalUrl);
      batchImportKeys.add(normalizedImportKey);
      batchTitles.push(input.title);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";

      if (message.includes("duplicate") || message.includes("23505")) {
        duplicateCount += 1;
        results.push({
          reason: "Supabase rejected a duplicate URL.",
          snsType: item.snsType,
          status: "duplicate",
          title: input.title,
          url: item.url,
        });
      } else {
        errorCount += 1;
        results.push({
          reason: "保存に失敗しました。実行履歴とサーバーログを確認してください。",
          snsType: item.snsType,
          status: "error",
          title: input.title,
          url: item.url,
        });
      }
    }
  }

  await Promise.all(
    Array.from(matchedSourceIds).map(async (sourceId) => {
      try {
        await updateSocialSourceInSupabase(sourceId, {
          lastCheckedAt: new Date().toISOString(),
          lastError: "",
        });
      } catch (error) {
        console.warn("[social-import] source status update failed", {
          error: error instanceof Error ? error.name : "unknown",
          sourceId,
        });
      }
    }),
  );

  const runStatus = errorCount > 0
    ? savedCount > 0
      ? "partial"
      : "failed"
    : dryRun
      ? "preview"
      : "success";

  await finishRun({
    aiClassifiedCount,
    duplicateCount,
    errorCount,
    errorSummary: errorCount > 0 ? `${errorCount}件の保存に失敗しました。` : undefined,
    normalizedCount: candidates.length,
    savedCount,
    skippedCount: skippedCount + truncatedCount,
    sourceMatchedCount,
    status: runStatus,
  });

  return NextResponse.json({
    aiClassifiedCount,
    actorId,
    actorRunId,
    aiLimit,
    budgetMode,
    duplicateCount,
    datasetId,
    errorCount,
    importedCount: candidates.length,
    itemLimit,
    normalizedCount: candidates.length,
    mode: supabase && !dryRun ? "saved" : "preview",
    previewCount,
    provider,
    receivedCount: rawItems.length,
    results,
    runId: importRunId,
    savedCount,
    skippedCount,
    sourceMatchedCount,
    truncatedCount,
  });
}
