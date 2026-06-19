import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { getTitleSimilarity, normalizeSocialUrl } from "@/lib/social/url";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createSocialPostInSupabase } from "@/lib/supabase/socialPosts";
import { snsTrendCategories } from "@/lib/sns";
import type { SnsType } from "@/types/snsPost";
import type { NewSocialPost, SocialClassification } from "@/types/social";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

export const runtime = "nodejs";

const maxImportItems = 50;
const defaultAiLimit = 10;

type ImportRequest = {
  aiLimit?: number;
  dryRun?: boolean;
  items?: unknown[];
  posts?: unknown[];
  results?: unknown[];
  skipAi?: boolean;
  sourceName?: string;
};

type NormalizedImportItem = {
  accountName: string;
  canonicalUrl: string;
  commentCount?: number;
  description: string;
  externalId: string;
  handle: string;
  likeCount?: number;
  ogImageUrl: string;
  playCount?: number;
  publishedAt?: string;
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

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("instagram.com")) {
      return "Instagram";
    }

    if (hostname.includes("tiktok.com")) {
      return "TikTok";
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "YouTube";
    }

    if (hostname.includes("pinterest.") || hostname.includes("pin.it")) {
      return "Pinterest";
    }

    if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
      return "X";
    }
  } catch {
    return "Other";
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
      .slice(0, 40)
      .map(([key, item]) => [key, sanitizePayload(item, depth + 1)])
      .filter(([, item]) => typeof item !== "undefined"),
  );
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
    externalId: pickString(item, [
      "id",
      "postId",
      "post_id",
      "videoId",
      "video_id",
      "shortCode",
      "shortcode",
      "code",
    ]).slice(0, 160),
    handle,
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
    rawPayload: (sanitizePayload(item) ?? {}) as Record<string, unknown>,
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
): Promise<SocialClassification> {
  const fallback = fallbackClassification(item);

  if (!shouldUseAi) {
    return fallback;
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
    };
  } catch {
    return fallback;
  }
}

function toSocialPostInput(
  item: NormalizedImportItem,
  classification: SocialClassification,
): NewSocialPost {
  return {
    accountName: item.accountName,
    aiSummary: classification.summary,
    blogIdea: classification.blogIdea,
    canonicalUrl: item.canonicalUrl,
    category: classification.category,
    commentCount: item.commentCount,
    counselingIdea: classification.counselingIdea,
    description: item.description,
    externalId: item.externalId,
    handle: item.handle,
    importedAt: new Date().toISOString(),
    instagramPostIdea: classification.instagramPostIdea,
    isFavorite: false,
    likeCount: item.likeCount,
    ogImageUrl: item.ogImageUrl,
    playCount: item.playCount,
    publishedAt: item.publishedAt,
    rawPayload: item.rawPayload,
    relevance: classification.relevance,
    reviewStatus: "未確認",
    shareCount: item.shareCount,
    snsType: item.snsType,
    sourceName: item.sourceName,
    tags: classification.tags,
    title: classification.trendName || item.title,
    url: item.url,
  };
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
    body = (await request.json()) as ImportRequest | unknown[];
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const requestOptions = isRecord(body) ? (body as ImportRequest) : {};
  const sourceName = requestOptions.sourceName?.trim() || "Apify";
  const dryRun = Boolean(requestOptions.dryRun);
  const skipAi = Boolean(requestOptions.skipAi);
  const aiLimit = Math.max(
    0,
    Math.min(defaultAiLimit, Math.floor(requestOptions.aiLimit ?? defaultAiLimit)),
  );
  const importedItems = extractItems(body)
    .slice(0, maxImportItems)
    .map((item) => normalizeImportItem(item, sourceName));
  const candidates = importedItems.filter(
    (item): item is NormalizedImportItem => Boolean(item),
  );

  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "No importable social posts were found. Send items with url/postUrl/webVideoUrl and title/caption/description.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();
  const existingUrls = new Set<string>();
  const existingCanonicalUrls = new Set<string>();
  const existingTitles: string[] = [];
  const results: ImportResult[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("social_posts")
      .select("url,canonical_url,title")
      .limit(10_000);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Could not read existing social_posts. Check Supabase settings and schema.sql.",
        },
        { status: 500 },
      );
    }

    (data ?? []).forEach((row) => {
      if (typeof row.url === "string") {
        existingUrls.add(row.url.toLowerCase());
      }

      if (typeof row.canonical_url === "string") {
        existingCanonicalUrls.add(row.canonical_url.toLowerCase());
      }

      if (typeof row.title === "string" && row.title.trim()) {
        existingTitles.push(row.title);
      }
    });
  }

  const batchUrls = new Set<string>();
  const batchCanonicalUrls = new Set<string>();
  const batchTitles: string[] = [];
  let savedCount = 0;
  let duplicateCount = 0;
  let previewCount = 0;
  let errorCount = 0;

  for (const [index, item] of candidates.entries()) {
    const normalizedUrl = item.url.toLowerCase();
    const normalizedCanonicalUrl = item.canonicalUrl.toLowerCase();
    const isDuplicateUrl =
      existingUrls.has(normalizedUrl) ||
      existingCanonicalUrls.has(normalizedCanonicalUrl) ||
      batchUrls.has(normalizedUrl) ||
      batchCanonicalUrls.has(normalizedCanonicalUrl);
    const similarTitle = [...existingTitles, ...batchTitles].find(
      (title) => getTitleSimilarity(title, item.title) >= 0.92,
    );

    if (isDuplicateUrl || similarTitle) {
      duplicateCount += 1;
      results.push({
        reason: isDuplicateUrl
          ? "URL or canonical URL already exists."
          : "A very similar title already exists.",
        snsType: item.snsType,
        status: "duplicate",
        title: item.title,
        url: item.url,
      });
      continue;
    }

    const classification = await classifyItem(item, !skipAi && index < aiLimit);
    const input = toSocialPostInput(item, classification);

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
      existingTitles.push(input.title);
      batchUrls.add(normalizedUrl);
      batchCanonicalUrls.add(normalizedCanonicalUrl);
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
          reason: message,
          snsType: item.snsType,
          status: "error",
          title: input.title,
          url: item.url,
        });
      }
    }
  }

  return NextResponse.json({
    duplicateCount,
    errorCount,
    importedCount: candidates.length,
    mode: supabase && !dryRun ? "saved" : "preview",
    previewCount,
    results,
    savedCount,
    skippedCount: importedItems.length - candidates.length,
  });
}
