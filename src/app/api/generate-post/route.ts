import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";

export const runtime = "nodejs";

type GeneratePostType =
  | "morning-brief"
  | "instagram-caption"
  | "reel-script"
  | "customer-explanation"
  | "next-visit"
  | "retail-product"
  | "blog-article"
  | "trend-explanation"
  | "salon-menu"
  | "weekly-summary";

type AgeGroup = "20代" | "30代" | "40代" | "50代";
type GenderTarget = "女性" | "男性";
type WritingTone = "上品" | "カジュアル";
type LengthOption = "短め" | "標準" | "長め";

type GeneratePostRequest = {
  type?: GeneratePostType;
  label?: string;
  trendTitles?: string[];
  keywords?: string[];
  ageGroup?: AgeGroup;
  genderTarget?: GenderTarget;
  writingTone?: WritingTone;
  length?: LengthOption;
};

const outputSettings: Record<
  GeneratePostType,
  { postType: string; theme: string; instruction: string }
> = {
  "instagram-caption": {
    postType: "Instagram投稿文",
    theme: "Instagram投稿文案",
    instruction:
      "Instagram投稿文を作成してください。冒頭で悩みや憧れに触れ、仕上がりの魅力、相談への一言を入れてください。改行を入れて読みやすくしてください。",
  },
  "reel-script": {
    postType: "リール動画台本",
    theme: "リール動画台本",
    instruction:
      "リール動画台本を作成してください。0〜3秒の冒頭フック、施術や仕上がりの見せ方、テロップ案、締めの一言を含めてください。",
  },
  "customer-explanation": {
    postType: "カウンセリング説明",
    theme: "カウンセリング説明",
    instruction:
      "カウンセリングでお客様に説明する文章を作成してください。専門用語を避け、メリット、注意点、仕上がりイメージを自然に伝えてください。",
  },
  "next-visit": {
    postType: "次回来店提案",
    theme: "次回来店提案",
    instruction:
      "次回来店提案を作成してください。来店目安、次回のおすすめ施術、ホームケアの一言を含め、押し売りに見えない自然な表現にしてください。",
  },
  "retail-product": {
    postType: "店販提案",
    theme: "店販提案",
    instruction:
      "店販提案を作成してください。お客様の悩みに寄り添い、商品を使う理由、使い方、期待できる変化を美容師らしく自然に説明してください。",
  },
  "blog-article": {
    postType: "ブログ記事",
    theme: "美容ブログ記事",
    instruction:
      "美容室ブログ記事を作成してください。タイトル案、導入文、見出し、本文、まとめを含め、来店前のお客様が安心して相談できる内容にしてください。SEOを意識しつつ、読み物として自然な文章にしてください。",
  },
  "morning-brief": {
    postType: "朝礼ネタ",
    theme: "朝礼ネタ",
    instruction:
      "サロン朝礼で使える短い話題を作成してください。今日の提案ポイント、スタッフ間で共有したい声かけ、お客様への一言を含めてください。",
  },
  "trend-explanation": {
    postType: "トレンド解説",
    theme: "トレンド解説",
    instruction:
      "美容トレンド解説を作成してください。なぜ注目されているか、どんなお客様に向くか、サロン提案への使い方を整理してください。",
  },
  "salon-menu": {
    postType: "サロンメニュー提案",
    theme: "サロンメニュー提案",
    instruction:
      "サロンメニュー提案を作成してください。メニュー名、内容、提案ポイントを含めてください。",
  },
  "weekly-summary": {
    postType: "トレンド解説",
    theme: "今週の美容トレンド",
    instruction:
      "今週の美容トレンド要約を作成してください。美容師が朝礼や投稿企画で使えるように、要点を3つ程度に整理してください。",
  },
};

function getRequestType(type: GeneratePostRequest["type"]): GeneratePostType {
  if (
    type === "morning-brief" ||
    type === "instagram-caption" ||
    type === "reel-script" ||
    type === "customer-explanation" ||
    type === "next-visit" ||
    type === "retail-product" ||
    type === "blog-article" ||
    type === "trend-explanation" ||
    type === "salon-menu" ||
    type === "weekly-summary"
  ) {
    return type;
  }

  return "instagram-caption";
}

function getAgeGroup(ageGroup: GeneratePostRequest["ageGroup"]): AgeGroup {
  return ageGroup === "20代" ||
    ageGroup === "30代" ||
    ageGroup === "40代" ||
    ageGroup === "50代"
    ? ageGroup
    : "30代";
}

function getGenderTarget(
  genderTarget: GeneratePostRequest["genderTarget"],
): GenderTarget {
  return genderTarget === "女性" || genderTarget === "男性"
    ? genderTarget
    : "女性";
}

function getWritingTone(tone: GeneratePostRequest["writingTone"]): WritingTone {
  return tone === "上品" || tone === "カジュアル" ? tone : "上品";
}

function getLength(length: GeneratePostRequest["length"]): LengthOption {
  return length === "短め" || length === "標準" || length === "長め"
    ? length
    : "標準";
}

function getLengthGuide(length: LengthOption, type: GeneratePostType) {
  if (type === "blog-article") {
    if (length === "短め") {
      return "ブログ本文は600〜900文字程度。タイトル案、導入文、見出し2つ、まとめを入れてください。";
    }

    if (length === "長め") {
      return "ブログ本文は1500〜2200文字程度。タイトル案、導入文、見出し4〜5つ、カウンセリングにつながるまとめまで丁寧に書いてください。途中で終わらせないでください。";
    }

    return "ブログ本文は1000〜1400文字程度。タイトル案、導入文、見出し3つ、まとめを入れてください。途中で終わらせないでください。";
  }

  if (length === "短め") {
    return "本文は120〜180文字程度。要点を絞り、必ず自然な締めの一文まで書いてください。";
  }

  if (length === "長め") {
    return "本文は350〜500文字程度。説明、提案、締めの一言まで丁寧に書き、途中で終わらせないでください。";
  }

  return "本文は220〜320文字程度。読みやすさと具体性を両立し、必ず最後まで完結させてください。";
}

function extractHashtags(text: string) {
  return Array.from(new Set(text.match(/#[\p{L}\p{N}_ー]+/gu) ?? [])).slice(
    0,
    12,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratePostRequest;
    const requestType = getRequestType(body.type);
    const settings = outputSettings[requestType];
    const trendTitles = body.trendTitles?.filter(Boolean) ?? [];
    const keywords = body.keywords?.filter(Boolean) ?? [];
    const ageGroup = getAgeGroup(body.ageGroup);
    const genderTarget = getGenderTarget(body.genderTarget);
    const writingTone = getWritingTone(body.writingTone);
    const length = getLength(body.length);
    const salonContext = getSalonPromptContext();

    const result = await generateAiText({
      systemInstruction:
        [
          "あなたは美容師向けの投稿企画を支援する日本語ライターです。SNSスクレイピングは行わず、入力された手動登録トレンドとキーワードだけを材料にします。美容師が実務でそのまま整えて使える、自然で押し売り感のない日本語にしてください。",
          "以下のサロン設定を必ず反映し、ef.mayke`sらしい髪質改善・くせ毛改善・艶髪提案につながる文章にしてください。",
          salonContext,
        ].join("\n\n"),
      prompt: [
        settings.instruction,
        "サロン設定をふまえ、髪質改善、ストレート、くせ毛、パサつき、艶髪、白髪ぼかしのいずれかに自然につながる場合は優先して反映してください。",
        `出力タイプ: ${settings.postType}`,
        `対象: ${ageGroup}${genderTarget}`,
        `文体: ${writingTone}`,
        `文字数: ${length}。${getLengthGuide(length, requestType)}`,
        `参照トレンド: ${trendTitles.join("、") || "未指定"}`,
        `使用キーワード: ${keywords.join("、") || "未指定"}`,
        "文章は途中で終わらせず、最後の一文まで完成させてください。",
        "見出しだけ、書き出しだけ、箇条書きの途中で終了する出力は禁止です。",
        "最後に必ず「以上です。」などの完結表現は入れず、自然な締めの文章で終えてください。",
        "最後に、本文とは別に「ハッシュタグ:」という行を作り、Instagramで使いやすいハッシュタグを8〜12個生成してください。",
        "ハッシュタグは美容室、髪質改善、地域名なしで使える一般的なものを中心にしてください。",
      ].join("\n"),
      maxOutputTokens:
        requestType === "blog-article"
          ? length === "長め"
            ? 4600
            : 3400
          : length === "長め"
            ? 2600
            : 2000,
    });
    const content = result.text.trim();

    if (!content) {
      return NextResponse.json(
        { error: "AI生成結果が空でした。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      theme: settings.theme,
      postType: settings.postType,
      tone: `${writingTone} / ${ageGroup}${genderTarget} / ${length}`,
      content,
      usedKeywords: keywords,
      hashtags: extractHashtags(content),
      createdAt: new Date().toISOString().slice(0, 10),
      provider: result.provider,
      providerLabel: result.providerLabel,
    });
  } catch {
    return NextResponse.json(
      { error: "Geminiで生成できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
