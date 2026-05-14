import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { detectSnsTypeFromUrl, snsTrendCategories } from "@/lib/sns";
import type { SnsAiClassification, SnsType } from "@/types/snsPost";
import type { TrendCategory } from "@/types/trend";

export const runtime = "nodejs";

type AnalyzeSnsPostRequest = {
  snsType?: SnsType;
  url?: string;
  title?: string;
  memo?: string;
  category?: TrendCategory;
  tags?: string[];
};

type AnalyzeSnsPostResponse = SnsAiClassification & {
  providerLabel: string;
};

function normalizeCategory(value: string | undefined): TrendCategory {
  const category = snsTrendCategories.find((item) => item === value);

  return category ?? "SNS投稿";
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .slice(0, 8);
}

function pickString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON was not found.");
  }

  return cleaned.slice(start, end + 1);
}

function createMockClassification(
  body: AnalyzeSnsPostRequest,
): AnalyzeSnsPostResponse {
  const url = body.url?.trim() ?? "";
  const snsType = body.snsType ?? detectSnsTypeFromUrl(url);
  const category = normalizeCategory(body.category);
  const title = body.title?.trim() || `${snsType}で見つけた美容トレンド`;
  const baseTags = [
    ...normalizeTags(body.tags),
    `#${category}`,
    "#髪質改善",
    "#美容室",
  ];
  const tags = Array.from(new Set(baseTags)).slice(0, 8);

  return {
    counselingIdea:
      "お客様には、気になる仕上がりの雰囲気を確認しながら、髪質、履歴、普段の扱いやすさに合わせて提案します。写真や投稿は参考として使い、実際の髪の状態を見て無理のない方法を選びます。",
    category,
    instagramPostIdea:
      "最近気になるヘアトレンドを、サロンで取り入れやすい形に整理しました。髪の広がり、うねり、パサつきが気になる方は、今の髪質や履歴に合わせて一緒に相談しましょう。",
    memo:
      body.memo?.trim() ||
      "SNS投稿URLを手動登録し、美容師向けの投稿ネタやカウンセリング材料として使える内容です。",
    providerLabel: "モック分類",
    tags,
    trendName: title,
  };
}

function toClassification(
  data: Record<string, unknown>,
  fallback: AnalyzeSnsPostResponse,
): AnalyzeSnsPostResponse {
  const category = normalizeCategory(pickString(data.category));
  const tags = normalizeTags(data.tags);

  return {
    counselingIdea: pickString(data.counseling_idea) || fallback.counselingIdea,
    category,
    instagramPostIdea:
      pickString(data.instagram_post_idea) || fallback.instagramPostIdea,
    memo: pickString(data.memo) || fallback.memo,
    providerLabel: fallback.providerLabel,
    tags: tags.length > 0 ? tags : fallback.tags,
    trendName: pickString(data.trend_name) || fallback.trendName,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeSnsPostRequest;
  const url = body.url?.trim() ?? "";
  const snsType = body.snsType ?? detectSnsTypeFromUrl(url);
  const fallback = createMockClassification({ ...body, snsType });

  if (!url) {
    return NextResponse.json(
      { error: "SNS投稿URLを入力してください。" },
      { status: 400 },
    );
  }

  try {
    const result = await generateAiText({
      maxOutputTokens: 1800,
      systemInstruction: [
        "あなたは美容師向けにSNS投稿URLを整理する日本語アシスタントです。",
        "Instagram、TikTok、Xなどの非公式スクレイピングは禁止です。",
        "URL先の本文取得やHTML取得は行わず、ユーザーが手動入力したURL、タイトル、メモ、カテゴリ、タグだけを材料に分類してください。",
        "美容師が毎日の投稿、カウンセリング、サロン提案にそのまま使える自然な文章にしてください。",
        getSalonPromptContext(),
      ].join("\n\n"),
      prompt: [
        "次のSNS投稿登録情報を美容師向けに分類してください。",
        `SNS種別: ${snsType}`,
        `URL: ${url}`,
        `タイトル: ${body.title?.trim() || "未入力"}`,
        `メモ: ${body.memo?.trim() || "未入力"}`,
        `カテゴリ候補: ${snsTrendCategories.join("、")}`,
        `選択カテゴリ: ${body.category ?? "未選択"}`,
        `タグ: ${(body.tags ?? []).join("、") || "未入力"}`,
        "必ず次のJSONオブジェクトだけを返してください。説明文やコードブロックは不要です。",
        JSON.stringify({
          category: "髪質改善",
          counseling_idea: "カウンセリングでの活用例",
          instagram_post_idea: "Instagram投稿ネタ",
          memo: "美容師向けメモ",
          tags: ["#髪質改善", "#艶髪"],
          trend_name: "美容トレンド名",
        }),
      ].join("\n"),
    });
    const parsed = JSON.parse(extractJson(result.text)) as Record<string, unknown>;
    const classification = toClassification(parsed, {
      ...fallback,
      providerLabel: result.providerLabel,
    });

    return NextResponse.json(classification);
  } catch {
    return NextResponse.json(fallback);
  }
}
