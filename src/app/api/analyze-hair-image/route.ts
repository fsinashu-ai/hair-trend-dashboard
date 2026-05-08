import { NextResponse } from "next/server";
import { analyzeAiImage } from "@/lib/ai/server";
import type { HairImageAnalysisResult } from "@/types/hairImageAnalysis";

export const runtime = "nodejs";

const maxImageSize = 8 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const categoryCandidates = [
  "レディース",
  "メンズ",
  "カラー",
  "パーマ",
  "髪質改善",
  "白髪ぼかし",
  "SNS投稿",
  "SNS運用",
  "カウンセリング",
  "店販",
  "自社サイト",
  "Instagram",
  "ヘアカタログ",
  "ヘアカラー",
  "美容ディーラー",
  "Pinterest",
  "海外トレンド",
  "YouTube",
];

function extractJson(text: string) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return strings.length > 0 ? strings : fallback;
}

function toStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeAnalysis(value: unknown): HairImageAnalysisResult {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    estimatedCategory: toStringValue(data.estimatedCategory, "レディース"),
    styleClassification: toStringValue(
      data.styleClassification,
      "画像から見える長さ、シルエット、毛流れをもとにしたヘアスタイル分類です。",
    ),
    bobShortLayerJudgement: toStringValue(
      data.bobShortLayerJudgement,
      "ボブ、ショート、レイヤーの要素は画像だけでは断定せず、シルエットを見て補助的に判断してください。",
    ),
    grayBlendingJudgement: toStringValue(
      data.grayBlendingJudgement,
      "白髪ぼかしは画像だけでは断定しにくいため、明るさ、ハイライト、白髪量はカウンセリングで確認してください。",
    ),
    confidence: toStringValue(data.confidence, "中"),
    features: toStringArray(data.features, [
      "髪型の長さ、シルエット、質感をもとに分析しました。",
    ]),
    glossDescription: toStringValue(
      data.glossDescription,
      "光の当たり方をふまえ、艶感やまとまりの見え方を説明できます。",
    ),
    tags: toStringArray(data.tags, ["#ヘアスタイル", "#美容室", "#髪型提案"]),
    snsDescription: toStringValue(
      data.snsDescription,
      "ヘアスタイルの雰囲気や扱いやすさが伝わるように、来店前のお客様にも分かりやすい説明を添えて投稿しましょう。",
    ),
    reelDescription: toStringValue(
      data.reelDescription,
      "リールでは、Beforeの悩み、仕上がりの艶、毛流れが分かる角度を短く見せる構成がおすすめです。",
    ),
    menuSuggestion: toStringValue(
      data.menuSuggestion,
      "カット、カラー、トリートメントを組み合わせた提案が向いています。",
    ),
    customerExplanation: toStringValue(
      data.customerExplanation,
      "写真の印象をもとに、長さや毛流れ、まとまりやすさを確認して提案します。",
    ),
    caution: toStringValue(
      data.caution,
      "画像だけの推定です。実際の髪質、履歴、ダメージ状態はカウンセリングで確認してください。",
    ),
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "分析する画像を選択してください。" },
        { status: 400 },
      );
    }

    if (!allowedImageTypes.includes(image.type)) {
      return NextResponse.json(
        { error: "JPEG、PNG、WebP形式の画像を選択してください。" },
        { status: 400 },
      );
    }

    if (image.size > maxImageSize) {
      return NextResponse.json(
        { error: "画像サイズは8MB以下にしてください。" },
        { status: 400 },
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");

    const result = await analyzeAiImage({
      systemInstruction:
        "あなたは美容師向けのヘアスタイル分析アシスタントです。SNSスクレイピングは禁止です。入力された画像だけを見て、人物の個人特定、年齢、性別などのセンシティブな推測は避けてください。美容師が接客、投稿、リール企画で自然に使える日本語で、髪型の見た目、質感、提案につながる要素だけを分析してください。",
      prompt: [
        "ヘア画像を分析し、JSONだけで返してください。",
        `推定カテゴリは次から1つ選んでください: ${categoryCandidates.join("、")}`,
        "JSONのキー: estimatedCategory, styleClassification, bobShortLayerJudgement, grayBlendingJudgement, confidence, features, glossDescription, tags, snsDescription, reelDescription, menuSuggestion, customerExplanation, caution",
        "styleClassificationには、見える範囲でヘアスタイル分類を書いてください。",
        "bobShortLayerJudgementには、ボブ、ショート、レイヤーのどれに近いか、または複合かを美容師向けに自然に書いてください。",
        "grayBlendingJudgementには、白髪ぼかし要素が見えるか、見えないか、判断保留かを、断定しすぎず書いてください。",
        "featuresは4〜7個、tagsは6〜10個にしてください。",
        "glossDescriptionには、艶感、まとまり、光の見え方を説明してください。",
        "snsDescriptionはInstagram投稿下書きに使える自然な文章にしてください。",
        "reelDescriptionは、リール動画の見せ方、冒頭フック、テロップ案、締めの一言が分かる文章にしてください。",
        "customerExplanationは、お客様にカウンセリングで伝えるやさしい説明にしてください。",
        "画像だけでは断定できない髪質、履歴、白髪量、ダメージ状態は必ずcautionで補足してください。",
      ].join("\n"),
      imageBase64,
      maxOutputTokens: 1600,
      mimeType: image.type,
    });

    const jsonText = extractJson(result.text);

    if (!jsonText) {
      return NextResponse.json(
        { error: "AI分析結果を読み取れませんでした。" },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(jsonText) as unknown;

    return NextResponse.json({
      ...normalizeAnalysis(parsed),
      provider: result.provider,
      providerLabel: result.providerLabel,
    });
  } catch {
    return NextResponse.json(
      { error: "ヘア画像のAI分析に失敗しました。画像、AI_PROVIDER、APIキーを確認してください。" },
      { status: 500 },
    );
  }
}
