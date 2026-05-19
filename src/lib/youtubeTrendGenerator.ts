import { defaultYoutubeTrendKeywords } from "@/config/youtubeTrendKeywords";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import type { SalonRelevance, TrendCategory } from "@/types/trend";
import type {
  YoutubeGeneratedTrend,
  YoutubeSearchVideo,
} from "@/types/youtubeTrend";

const youtubeTrendCategories: TrendCategory[] = [
  "YouTube",
  "髪質改善",
  "白髪ぼかし",
  "ヘアカラー",
  "レディース",
  "メンズ",
  "パーマ",
  "店販",
  "カウンセリング",
  "SNS運用",
];
const salonRelevances: SalonRelevance[] = ["高", "中", "低"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function extractJsonArray(text: string) {
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
    return null;
  }

  return text.slice(firstBracket, lastBracket + 1);
}

function toCategory(value: unknown, fallback: TrendCategory): TrendCategory {
  return typeof value === "string" &&
    youtubeTrendCategories.includes(value as TrendCategory)
    ? (value as TrendCategory)
    : fallback;
}

function toTags(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);

  return tags.length > 0 ? Array.from(new Set(tags)).slice(0, 8) : fallback;
}

function toText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSalonRelevance(
  value: unknown,
  fallback: SalonRelevance,
): SalonRelevance {
  return typeof value === "string" &&
    salonRelevances.includes(value as SalonRelevance)
    ? (value as SalonRelevance)
    : fallback;
}

function createVideoMap(videos: YoutubeSearchVideo[]) {
  return new Map(videos.map((video) => [video.url, video] as const));
}

function inferSalonRelevance(video: YoutubeSearchVideo): SalonRelevance {
  const text = `${video.title} ${video.keyword}`.toLowerCase();

  if (
    text.includes("髪質改善") ||
    text.includes("縮毛矯正") ||
    text.includes("白髪") ||
    text.includes("くせ毛") ||
    text.includes("艶") ||
    text.includes("ツヤ") ||
    text.includes("ストレート")
  ) {
    return "高";
  }

  if (
    text.includes("ボブ") ||
    text.includes("ショート") ||
    text.includes("レイヤー") ||
    text.includes("カラー") ||
    text.includes("大人")
  ) {
    return "中";
  }

  return "低";
}

function createFallbackYoutubeSummary(video: YoutubeSearchVideo) {
  const publishedDate = video.publishedAt
    ? video.publishedAt.slice(0, 10)
    : "投稿日未取得";

  return `${video.channelTitle}の動画です。${video.keyword}を軸に、投稿日 ${publishedDate} の新着動画としてサロン提案の材料にできます。`;
}

function createFallbackStylistPoints(video: YoutubeSearchVideo) {
  return `${video.keyword}に興味があるお客様へ、悩み・仕上がり・自宅ケアをセットで説明する時の参考にできます。`;
}

function createFallbackInstagramIdea(video: YoutubeSearchVideo) {
  return `「${video.keyword}で迷っている方へ」という切り口で、ビフォー後の変化、向いている髪質、来店前の相談ポイントを短く投稿します。`;
}

function createFallbackReelScript(video: YoutubeSearchVideo) {
  return `冒頭: ${video.keyword}で悩むお客様へ。中盤: 仕上がりの変化と施術ポイント。最後: 保存してカウンセリングで相談してください。`;
}

function createFallbackCounselingIdea(video: YoutubeSearchVideo) {
  return `カウンセリングでは「今の髪の扱いにくさ」「理想の艶感」「朝のセット時間」を聞き、${video.keyword}の提案につなげます。`;
}

function normalizeAiTrends(
  value: unknown,
  videos: YoutubeSearchVideo[],
): YoutubeGeneratedTrend[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const videoMap = createVideoMap(videos);

  return value
    .map((item): YoutubeGeneratedTrend | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      const video = videoMap.get(url);

      if (!video) {
        return null;
      }

      const title =
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : video.title;
      const category = toCategory(record.category, "YouTube");
      const memo =
        typeof record.memo === "string" && record.memo.trim()
          ? record.memo.trim()
          : createFallbackMemo(video);
      const salonRelevance = toSalonRelevance(
        record.salon_relevance,
        inferSalonRelevance(video),
      );

      return {
        category,
        channelTitle: video.channelTitle,
        counseling_idea: toText(
          record.counseling_idea,
          createFallbackCounselingIdea(video),
        ),
        instagram_idea: toText(
          record.instagram_idea,
          createFallbackInstagramIdea(video),
        ),
        memo,
        publishedAt: video.publishedAt,
        reel_script: toText(record.reel_script, createFallbackReelScript(video)),
        registered_at:
          typeof record.registered_at === "string" && record.registered_at.trim()
            ? record.registered_at.trim()
            : today(),
        salon_relevance: salonRelevance,
        stylist_points: toText(
          record.stylist_points,
          createFallbackStylistPoints(video),
        ),
        tags: toTags(record.tags, [category, video.keyword]),
        thumbnail: video.thumbnail,
        title,
        url,
        youtube_summary: toText(
          record.youtube_summary,
          createFallbackYoutubeSummary(video),
        ),
      };
    })
    .filter((trend): trend is YoutubeGeneratedTrend => trend !== null);
}

function createFallbackMemo(video: YoutubeSearchVideo) {
  const publishedDate = video.publishedAt
    ? video.publishedAt.slice(0, 10)
    : "投稿日未取得";

  return `${video.channelTitle}のYouTube動画です。${video.keyword}に関心のあるお客様へのカウンセリング、投稿ネタ、メニュー提案の参考にできます。投稿日: ${publishedDate}`;
}

function createFallbackTrends(videos: YoutubeSearchVideo[]) {
  return videos.map((video) => ({
    category: "YouTube" as const,
    channelTitle: video.channelTitle,
    counseling_idea: createFallbackCounselingIdea(video),
    instagram_idea: createFallbackInstagramIdea(video),
    memo: createFallbackMemo(video),
    publishedAt: video.publishedAt,
    reel_script: createFallbackReelScript(video),
    registered_at: today(),
    salon_relevance: inferSalonRelevance(video),
    stylist_points: createFallbackStylistPoints(video),
    tags: Array.from(new Set(["YouTube", video.keyword, "動画", "SNS運用"])),
    thumbnail: video.thumbnail,
    title: video.title,
    url: video.url,
    youtube_summary: createFallbackYoutubeSummary(video),
  }));
}

export function createMockYoutubeTrendCandidates(
  existingUrls: Set<string>,
): YoutubeGeneratedTrend[] {
  return defaultYoutubeTrendKeywords
    .slice(0, 3)
    .map((keyword, index) => ({
      category: keyword.includes("集客") ? ("SNS運用" as const) : ("YouTube" as const),
      channelTitle: "モックYouTube",
      counseling_idea: `${keyword}を検討しているお客様に、現在の悩みと理想の仕上がりを聞いて提案へつなげます。`,
      instagram_idea: `${keyword}で悩むお客様向けに、変化が伝わる投稿ネタとして使えます。`,
      memo: `${keyword}のYouTube周回サンプルです。YOUTUBE_API_KEYを設定すると、公式YouTube Data APIから実際の動画を検索します。`,
      publishedAt: today(),
      reel_script: `冒頭で${keyword}の悩みを提示し、施術ポイント、仕上がり、予約導線の順に見せます。`,
      registered_at: today(),
      salon_relevance: inferSalonRelevance({
        channelTitle: "モックYouTube",
        id: `mock-${index + 1}`,
        keyword,
        publishedAt: today(),
        thumbnail: "",
        title: keyword,
        url: `https://www.youtube.com/watch?v=mock-hair-trend-${index + 1}`,
      }),
      stylist_points: `${keyword}をサロン提案、投稿、カウンセリングの切り口にできます。`,
      tags: ["YouTube", keyword, "動画", "トレンド"],
      thumbnail: "",
      title: `${keyword}の新着動画チェック`,
      url: `https://www.youtube.com/watch?v=mock-hair-trend-${index + 1}`,
      youtube_summary: `${keyword}に関するYouTube周回サンプルです。美容師が毎日のネタ出しに使いやすい形で表示しています。`,
    }))
    .filter((trend) => !existingUrls.has(trend.url));
}

export async function classifyYoutubeVideosForTrends({
  existingKeywords,
  videos,
}: {
  existingKeywords: string[];
  videos: YoutubeSearchVideo[];
}) {
  if (videos.length === 0) {
    return {
      providerLabel: "YouTube Data API",
      trends: [] as YoutubeGeneratedTrend[],
    };
  }

  try {
    const salonContext = getSalonPromptContext();
    const result = await generateAiText({
      maxOutputTokens: 4200,
      systemInstruction: [
        "あなたは美容師向けのYouTubeトレンド分類アシスタントです。",
        "入力は公式YouTube Data APIで取得した動画メタデータだけです。SNSスクレイピングや本文の自動取得は行いません。",
        "美容師が投稿ネタ、リール台本、カウンセリング、店販、メニュー提案に使いやすい形へ分類してください。",
        "ef.mayke`sは髪質改善、縮毛矯正、白髪ぼかし、くせ毛、パサつき改善、艶髪提案を重視します。",
        salonContext,
      ].join("\n\n"),
      prompt: [
        "以下のYouTube動画候補を美容師向けに分類し、必ずJSON配列だけで返してください。",
        `カテゴリ候補: ${youtubeTrendCategories.join("、")}`,
        `登録済みキーワード: ${existingKeywords.join("、") || "未登録"}`,
        `登録日: ${today()}`,
        "各要素のキー: title, url, category, memo, tags, registered_at, youtube_summary, stylist_points, instagram_idea, reel_script, counseling_idea, salon_relevance",
        "urlは入力された動画URLをそのまま使ってください。",
        "memoには、動画チャンネル名・投稿日・サロンでの活用方法を自然な日本語で含めてください。",
        "youtube_summaryは動画タイトルとメタデータだけから、美容師が理解しやすい要約にしてください。",
        "stylist_pointsは美容師向け活用ポイントを1〜2文で書いてください。",
        "instagram_ideaはInstagram投稿ネタを自然な日本語で書いてください。",
        "reel_scriptは短いリール台本案を、冒頭・中盤・最後が分かる形で書いてください。",
        "counseling_ideaはカウンセリングでのお客様への聞き方・説明への使い方を書いてください。",
        "salon_relevanceはef.mayke`sの髪質改善・縮毛矯正・白髪ぼかしとの関連度として、高・中・低のどれかにしてください。",
        "tagsは3〜6個、#なしの文字列配列にしてください。",
        JSON.stringify(videos, null, 2),
      ].join("\n"),
    });
    const jsonText = extractJsonArray(result.text);

    if (!jsonText) {
      throw new Error("AI returned non-JSON text.");
    }

    const trends = normalizeAiTrends(JSON.parse(jsonText), videos);

    return {
      providerLabel: `YouTube Data API + ${result.providerLabel}`,
      trends: trends.length > 0 ? trends : createFallbackTrends(videos),
    };
  } catch {
    return {
      providerLabel: "YouTube Data API + モック分類",
      trends: createFallbackTrends(videos),
    };
  }
}
