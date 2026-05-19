import { NextResponse } from "next/server";
import {
  blogCategories,
  createMockBlogArticle,
  createSlug,
  lineCtaText,
} from "@/lib/blog";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import type {
  BlogArticleType,
  BlogCategory,
  BlogConcern,
  BlogGenerateRequest,
  BlogGenerateResponse,
  BlogLength,
  BlogTargetAge,
} from "@/types/blog";

export const runtime = "nodejs";

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

type AiBlogResponse = {
  title?: string;
  slug?: string;
  category?: string;
  target_keyword?: string;
  meta_description?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  instagram_caption?: string;
  before_after_caption?: string;
  line_cta?: string;
};

function getOption<T extends string>(value: unknown, options: T[], fallback: T) {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);
}

function sanitizeRequest(value: unknown): BlogGenerateRequest {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const mainKeyword =
    typeof record.mainKeyword === "string" && record.mainKeyword.trim()
      ? record.mainKeyword.trim()
      : "髪質改善";

  return {
    articleType: getOption(record.articleType, articleTypes, "SEO記事"),
    concern: getOption(record.concern, concerns, "パサつき"),
    length: getOption(record.length, lengths, "1200文字"),
    mainKeyword,
    referenceMemos: toStringArray(record.referenceMemos),
    referenceTitles: toStringArray(record.referenceTitles),
    targetAge: getOption(record.targetAge, targetAges, "40代"),
  };
}

function extractJsonObject(text: string) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function toBlogCategory(value: unknown, keyword: string): BlogCategory {
  if (typeof value === "string" && blogCategories.includes(value as BlogCategory)) {
    return value as BlogCategory;
  }

  if (keyword.includes("縮毛") || keyword.includes("ストレート")) {
    return "縮毛矯正";
  }

  if (keyword.includes("白髪")) {
    return "白髪ぼかし";
  }

  if (keyword.includes("松江")) {
    return "松江市美容室";
  }

  return "髪質改善";
}

function toGeneratedBlog(
  value: AiBlogResponse,
  request: BlogGenerateRequest,
  providerLabel: string,
): BlogGenerateResponse {
  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : `${request.mainKeyword}で悩む大人女性へ。松江市の美容室が伝えたいこと`;
  const category = toBlogCategory(value.category, request.mainKeyword);
  const content =
    typeof value.content === "string" && value.content.trim()
      ? value.content.trim()
      : createMockBlogArticle(request).content;

  return {
    beforeAfterCaption:
      typeof value.before_after_caption === "string"
        ? value.before_after_caption.trim()
        : `${request.mainKeyword}のBefore/After紹介に使えるキャプションです。`,
    category,
    content,
    excerpt:
      typeof value.excerpt === "string" && value.excerpt.trim()
        ? value.excerpt.trim()
        : `${request.mainKeyword}で悩む大人女性へ向けた美容室ブログです。`,
    instagramCaption:
      typeof value.instagram_caption === "string"
        ? value.instagram_caption.trim()
        : `${request.mainKeyword}で悩む方へ。髪の状態を見ながら一緒に整えていきましょう。`,
    lineCta:
      typeof value.line_cta === "string" && value.line_cta.trim()
        ? value.line_cta.trim()
        : lineCtaText,
    metaDescription:
      typeof value.meta_description === "string" && value.meta_description.trim()
        ? value.meta_description.trim().slice(0, 160)
        : `松江市で${request.mainKeyword}を考えている方へ。髪質改善・縮毛矯正・白髪ぼかしを美容室目線でやさしく解説します。`,
    providerLabel,
    relatedSnsPostIds: [],
    relatedTrendIds: [],
    relatedYoutubeUrls: [],
    slug:
      typeof value.slug === "string" && value.slug.trim()
        ? createSlug(value.slug)
        : createSlug(`${request.mainKeyword}-matsue-hair-salon`),
    status: "draft",
    tags: toStringArray(value.tags).length
      ? toStringArray(value.tags)
      : [request.mainKeyword, "髪質改善", "松江市美容室"],
    targetKeyword:
      typeof value.target_keyword === "string" && value.target_keyword.trim()
        ? value.target_keyword.trim()
        : request.mainKeyword,
    title,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const blogRequest = sanitizeRequest(body);

  try {
    const salonContext = getSalonPromptContext();
    const result = await generateAiText({
      maxOutputTokens:
        blogRequest.length === "3000文字"
          ? 7200
          : blogRequest.length === "2000文字"
            ? 5600
            : 3600,
      systemInstruction: [
        "あなたは美容室SEOブログを書く日本語ライターです。",
        "ef.mayke`sの個人利用・サロン内利用向け下書きを作ります。WordPressへ直接投稿はしません。",
        "売り込みすぎず、丁寧でやさしく、大人女性向けに自然な文章にしてください。",
        "髪質改善、縮毛矯正、白髪ぼかし、くせ毛、パサつき改善、艶髪、松江市の美容室SEOを自然に反映してください。",
        salonContext,
      ].join("\n\n"),
      prompt: [
        "以下の条件でSEOブログ記事の下書きを作成し、必ずJSONオブジェクトだけで返してください。",
        "キー: title, slug, category, target_keyword, meta_description, excerpt, content, tags, instagram_caption, before_after_caption, line_cta",
        `カテゴリ候補: ${blogCategories.join("、")}`,
        `メインキーワード: ${blogRequest.mainKeyword}`,
        `ターゲット: ${blogRequest.targetAge}`,
        `悩み: ${blogRequest.concern}`,
        `記事タイプ: ${blogRequest.articleType}`,
        `文字数目安: ${blogRequest.length}`,
        `参考タイトル: ${blogRequest.referenceTitles?.join("、") || "なし"}`,
        `参考メモ: ${blogRequest.referenceMemos?.join(" / ") || "なし"}`,
        "contentはMarkdown風に、導入文、## h2、### h3、本文、まとめを含めてください。",
        `CTA文は必ず「${lineCtaText}」を使ってください。`,
        "LINEリンク: https://lin.ee/jjqQEFX",
        "WordPressに貼り付けやすいように、見出しと段落が分かる文章にしてください。",
      ].join("\n"),
    });
    const jsonText = extractJsonObject(result.text);

    if (!jsonText) {
      throw new Error("AI returned non-JSON text.");
    }

    return NextResponse.json(
      toGeneratedBlog(JSON.parse(jsonText) as AiBlogResponse, blogRequest, result.providerLabel),
    );
  } catch {
    return NextResponse.json(createMockBlogArticle(blogRequest));
  }
}
