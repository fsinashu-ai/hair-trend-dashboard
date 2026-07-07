import { createHash } from "node:crypto";
import {
  GeminiServiceError,
  generateGeminiJson,
  getGeminiModel,
  isGeminiConfigured,
} from "@/lib/ai/server";
import { getSalonPromptContext, salonProfile } from "@/lib/salonProfile";
import type {
  AdCreative,
  AdCreativeContent,
  AdCreativeGenerateResponse,
  AdCreativeInput,
} from "@/types/adCreative";

const maxRequestCharacters = 10_000;

const adCreativeSchema = {
  type: "object",
  properties: {
    platform: { type: "string" },
    campaignName: { type: "string" },
    objective: { type: "string" },
    targetArea: { type: "string" },
    targetAudience: { type: "string" },
    mainAppeal: { type: "string" },
    googleSearchAds: {
      type: "object",
      properties: {
        headlines: { type: "array", items: { type: "string" } },
        descriptions: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
        negativeKeywords: { type: "array", items: { type: "string" } },
      },
      required: ["headlines", "descriptions", "keywords", "negativeKeywords"],
    },
    instagramAds: {
      type: "object",
      properties: {
        shortCopies: { type: "array", items: { type: "string" } },
        bodyCopies: { type: "array", items: { type: "string" } },
        storyCopies: { type: "array", items: { type: "string" } },
        reelIdeas: { type: "array", items: { type: "string" } },
        imageIdeas: { type: "array", items: { type: "string" } },
      },
      required: ["shortCopies", "bodyCopies", "storyCopies", "reelIdeas", "imageIdeas"],
    },
    facebookAds: {
      type: "object",
      properties: {
        headlines: { type: "array", items: { type: "string" } },
        bodyCopies: { type: "array", items: { type: "string" } },
        descriptions: { type: "array", items: { type: "string" } },
      },
      required: ["headlines", "bodyCopies", "descriptions"],
    },
    ctaSuggestions: { type: "array", items: { type: "string" } },
    lpImprovementSuggestions: { type: "array", items: { type: "string" } },
    abTestIdeas: { type: "array", items: { type: "string" } },
    cautionExpressions: { type: "array", items: { type: "string" } },
    recommendedMetrics: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: [
    "platform",
    "campaignName",
    "objective",
    "targetArea",
    "targetAudience",
    "mainAppeal",
    "googleSearchAds",
    "instagramAds",
    "facebookAds",
    "ctaSuggestions",
    "lpImprovementSuggestions",
    "abTestIdeas",
    "cautionExpressions",
    "recommendedMetrics",
    "summary",
  ],
};

function toStringList(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function sanitizeAdCreativeInput(value: unknown): AdCreativeInput {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    budgetMemo: normalizeString(record.budgetMemo).slice(0, 500),
    campaignId: normalizeString(record.campaignId).slice(0, 100),
    campaignName: normalizeString(record.campaignName, "松江市 髪質改善 広告").slice(0, 120),
    currentIssue: normalizeString(record.currentIssue).slice(0, 800),
    desiredCta: normalizeString(record.desiredCta, salonProfile.ctaText).slice(0, 80),
    inputKeywords: toStringList(record.inputKeywords, 20),
    landingPageUrl: normalizeString(record.landingPageUrl, "https://ef-mayke-s.com/").slice(0, 700),
    mainAppeal: normalizeString(record.mainAppeal, "髪質改善・縮毛矯正のLINE相談").slice(0, 160),
    memo: normalizeString(record.memo).slice(0, 1000),
    objective: normalizeString(record.objective, "LINE相談を増やす").slice(0, 80),
    platform: normalizeString(record.platform, "Google検索広告").slice(0, 60),
    targetArea: normalizeString(record.targetArea, "松江市と周辺地域").slice(0, 120),
    targetAudience: normalizeString(
      record.targetAudience,
      "40代以降の、うねり・広がりに悩む大人女性",
    ).slice(0, 240),
    tone: normalizeString(record.tone, "丁寧で上品").slice(0, 80),
  };
}

function normalizeContent(value: unknown, input: AdCreativeInput): AdCreativeContent {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const google = record.googleSearchAds as Record<string, unknown> | undefined;
  const instagram = record.instagramAds as Record<string, unknown> | undefined;
  const facebook = record.facebookAds as Record<string, unknown> | undefined;

  return {
    abTestIdeas: toStringList(record.abTestIdeas, 10),
    campaignName: normalizeString(record.campaignName, input.campaignName),
    cautionExpressions: toStringList(record.cautionExpressions, 12),
    ctaSuggestions: toStringList(record.ctaSuggestions, 10),
    facebookAds: {
      bodyCopies: toStringList(facebook?.bodyCopies, 8),
      descriptions: toStringList(facebook?.descriptions, 8),
      headlines: toStringList(facebook?.headlines, 8),
    },
    googleSearchAds: {
      descriptions: toStringList(google?.descriptions, 12),
      headlines: toStringList(google?.headlines, 15),
      keywords: toStringList(google?.keywords, 20),
      negativeKeywords: toStringList(google?.negativeKeywords, 20),
    },
    instagramAds: {
      bodyCopies: toStringList(instagram?.bodyCopies, 8),
      imageIdeas: toStringList(instagram?.imageIdeas, 8),
      reelIdeas: toStringList(instagram?.reelIdeas, 8),
      shortCopies: toStringList(instagram?.shortCopies, 8),
      storyCopies: toStringList(instagram?.storyCopies, 8),
    },
    lpImprovementSuggestions: toStringList(record.lpImprovementSuggestions, 12),
    mainAppeal: normalizeString(record.mainAppeal, input.mainAppeal),
    objective: normalizeString(record.objective, input.objective),
    platform: normalizeString(record.platform, input.platform),
    recommendedMetrics: toStringList(record.recommendedMetrics, 12),
    summary: normalizeString(
      record.summary,
      "広告案を作成しました。実際の配信前に表現、LP、予約導線を人が確認してください。",
    ),
    targetArea: normalizeString(record.targetArea, input.targetArea),
    targetAudience: normalizeString(record.targetAudience, input.targetAudience),
  };
}

function createAdCreative({
  content,
  input,
  mode,
  model,
}: {
  content: AdCreativeContent;
  input: AdCreativeInput;
  mode: "gemini" | "mock";
  model: string;
}): AdCreative {
  const now = new Date().toISOString();
  const idHash = createHash("sha1")
    .update(`${now}:${input.campaignName}:${input.platform}`)
    .digest("hex")
    .slice(0, 10);

  return {
    ...input,
    abTestIdeas: content.abTestIdeas,
    aiModel: model,
    aiProvider: mode,
    cautionExpressions: content.cautionExpressions,
    createdAt: now,
    ctaSuggestions: content.ctaSuggestions,
    facebookCopies: [
      ...content.facebookAds.headlines,
      ...content.facebookAds.bodyCopies,
      ...content.facebookAds.descriptions,
    ],
    generatedContent: content,
    googleDescriptions: content.googleSearchAds.descriptions,
    googleHeadlines: content.googleSearchAds.headlines,
    id: `ad-creative-${idHash}`,
    instagramCopies: [
      ...content.instagramAds.shortCopies,
      ...content.instagramAds.bodyCopies,
      ...content.instagramAds.storyCopies,
    ],
    lpSuggestions: content.lpImprovementSuggestions,
    negativeKeywords: content.googleSearchAds.negativeKeywords,
    status: "draft",
    updatedAt: now,
  };
}

export function createMockAdCreative(input: AdCreativeInput): AdCreativeGenerateResponse {
  const content: AdCreativeContent = {
    abTestIdeas: [
      "悩み訴求と店舗特徴訴求でクリック率を比較",
      "LINE相談CTAをファーストビューと記事下で比較",
      "40代女性向けコピーとくせ毛特化コピーを比較",
    ],
    campaignName: input.campaignName,
    cautionExpressions: [
      "必ず改善する",
      "絶対に綺麗になる",
      "一度で完全に改善",
      "地域No.1など根拠のない表現",
      "実在しない口コミや価格",
    ],
    ctaSuggestions: [
      "LINEで相談・予約する",
      "髪の状態をLINEで相談する",
      "まずは髪のお悩みを相談する",
    ],
    facebookAds: {
      bodyCopies: [
        "髪のうねりや広がりが気になり始めた大人女性へ。ef.mayke`sでは、髪の状態を丁寧に見ながら、髪質改善やストレート施術をご提案しています。",
      ],
      descriptions: [
        "松江市で髪質改善・縮毛矯正を相談したい方へ。",
        "1日3組限定の完全予約制サロンです。",
      ],
      headlines: [
        "松江で髪質改善を相談",
        "大人女性の髪悩みに寄り添う",
        "LINEで髪のお悩み相談",
      ],
    },
    googleSearchAds: {
      descriptions: [
        "髪の状態に合わせて丁寧にカウンセリング。松江市で髪質改善や縮毛矯正を検討中の方は、まずはLINEでご相談ください。",
        "1日3組限定の完全予約制サロン。うねり・広がり・パサつきに悩む大人女性の髪を丁寧にサポートします。",
      ],
      headlines: [
        "松江で髪質改善を相談するなら",
        "うねり・広がりに悩む大人女性へ",
        "髪質改善とストレートに特化",
        "LINEで髪のお悩み相談受付中",
        "本気で綺麗になりたいあなたへ",
      ],
      keywords: [
        "松江 髪質改善",
        "松江 縮毛矯正",
        "松江市 美容室 髪質改善",
        "くせ毛 相談 松江",
      ],
      negativeKeywords: ["安い", "激安", "無料", "セルフ", "自宅", "市販", "求人", "学校"],
    },
    instagramAds: {
      bodyCopies: [
        "髪のうねりや広がりで、毎朝のスタイリングが大変になっていませんか？\n\nef.mayke`sでは、髪の状態を丁寧に見ながら、髪質改善やストレート施術をご提案しています。\n\n本気で髪を綺麗にしたい方は、まずはLINEでお気軽にご相談ください。",
      ],
      imageIdeas: [
        "艶感が分かる後ろ姿のBefore/Afterと短い悩みコピー",
        "カウンセリング中の手元と髪の状態チェック",
        "LINE相談への導線を入れたシンプルな1枚画像",
      ],
      reelIdeas: [
        "朝の広がりの悩みから、カウンセリング、仕上がりの艶感までを短く見せる",
        "髪質改善前に確認するポイントを美容師目線で3つ紹介する",
      ],
      shortCopies: [
        "松江で髪質改善を相談したい大人女性へ",
        "うねり・広がりをまずはLINEで相談",
        "本気で綺麗になりたいあなたへ",
      ],
      storyCopies: [
        "髪の広がり、LINEで相談できます",
        "髪質改善・縮毛矯正のご相談はこちら",
      ],
    },
    lpImprovementSuggestions: [
      "ファーストビューに「松江で髪質改善・縮毛矯正を相談したい方へ」を追加",
      "Before／After画像の近くにLINE相談ボタンを設置",
      "40代女性向けの悩み別説明を追加",
      "施術の流れを分かりやすく追加",
      "よくある質問をLP下部に追加",
    ],
    mainAppeal: input.mainAppeal,
    objective: input.objective,
    platform: input.platform,
    recommendedMetrics: ["表示回数", "クリック率", "LINE相談数", "予約数", "CPA"],
    summary:
      "松江市の大人女性に向けて、髪質改善・縮毛矯正の相談導線を強める広告案です。",
    targetArea: input.targetArea,
    targetAudience: input.targetAudience,
  };

  return {
    creative: createAdCreative({
      content,
      input,
      mode: "mock",
      model: "mock",
    }),
    generationMode: "mock",
    notice: "Gemini未設定または利用不可のため、確認用のモック広告案を表示しています。",
    providerLabel: "モック生成",
  };
}

function getFallbackNotice(error: unknown) {
  if (!(error instanceof GeminiServiceError)) {
    return "Geminiで生成できなかったため、確認用のモック広告案を表示しています。";
  }
  if (error.code === "invalid_key") return "Gemini APIキーを確認できなかったため、モック広告案を表示しています。";
  if (error.code === "rate_limited") return "Geminiの利用上限に達したため、モック広告案を表示しています。";
  if (error.code === "timeout") return "Geminiの応答に時間がかかったため、モック広告案を表示しています。";
  if (error.code === "invalid_json" || error.code === "empty_response") {
    return "Geminiの回答を読み取れなかったため、モック広告案を表示しています。";
  }
  return "Geminiで生成できなかったため、確認用のモック広告案を表示しています。";
}

export async function generateAdCreative(
  input: AdCreativeInput,
): Promise<AdCreativeGenerateResponse> {
  const serialized = JSON.stringify(input);
  if (serialized.length > maxRequestCharacters) {
    throw new GeminiServiceError("input_too_long", "Ad creative input is too long.");
  }

  if (!isGeminiConfigured()) return createMockAdCreative(input);

  try {
    const result = await generateGeminiJson<Record<string, unknown>>({
      feature: "ad-creative-generation",
      maxOutputTokens: 4200,
      responseJsonSchema: adCreativeSchema,
      systemInstruction: [
        "あなたは美容室ef.mayke`sの広告文を作る日本語マーケティング担当者です。",
        getSalonPromptContext(),
        "広告の自動出稿、停止、予算変更、入札変更は絶対に行わず、人が確認して使う広告案だけを作ってください。",
        "OpenAI APIやGoogle広告API、Meta広告APIとの連携は想定しないでください。",
        "必ず改善する、絶対に綺麗になる、必ず治る、100％効果がある、一度で完全に改善、地域No.1、架空の口コミ、架空の価格、未提供メニューを作らないでください。",
        "推奨表現は、個人差があります、髪の状態に合わせて提案します、まずはLINEでご相談ください、丁寧なカウンセリングを大切にしています、です。",
      ].join("\n\n"),
      prompt: [
        "以下の入力をもとに、広告媒体ごとの広告案をJSONだけで作成してください。",
        "Google検索広告は見出し30文字目安、説明文90文字目安です。長くなる場合も目安で警告対象になるよう短めにしてください。",
        "Instagram広告は自然な美容師の文章にし、売り込みすぎないでください。",
        "LP改善案、除外キーワード、A/Bテスト案、注意表現、次に確認する指標も含めてください。",
        `入力: ${serialized}`,
      ].join("\n\n"),
    });
    const content = normalizeContent(result.value, input);
    return {
      creative: createAdCreative({
        content,
        input,
        mode: "gemini",
        model: result.model,
      }),
      generationMode: "gemini",
      notice: "Geminiで広告案を生成しました。",
      providerLabel: result.providerLabel,
    };
  } catch (error) {
    console.warn("[ad-creative] Gemini fallback", {
      errorType: error instanceof GeminiServiceError ? error.code : "unknown",
    });
    return {
      ...createMockAdCreative(input),
      notice: getFallbackNotice(error),
    };
  }
}

export function getCurrentGeminiModelLabel() {
  return isGeminiConfigured() ? getGeminiModel() : "mock";
}
