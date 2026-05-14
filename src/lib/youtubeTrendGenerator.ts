import { defaultYoutubeTrendKeywords } from "@/config/youtubeTrendKeywords";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import type { TrendCategory } from "@/types/trend";
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

function createVideoMap(videos: YoutubeSearchVideo[]) {
  return new Map(videos.map((video) => [video.url, video] as const));
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

      return {
        category,
        channelTitle: video.channelTitle,
        memo,
        publishedAt: video.publishedAt,
        registered_at:
          typeof record.registered_at === "string" && record.registered_at.trim()
            ? record.registered_at.trim()
            : today(),
        tags: toTags(record.tags, [category, video.keyword]),
        thumbnail: video.thumbnail,
        title,
        url,
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
    memo: createFallbackMemo(video),
    publishedAt: video.publishedAt,
    registered_at: today(),
    tags: Array.from(new Set(["YouTube", video.keyword, "動画", "SNS運用"])),
    thumbnail: video.thumbnail,
    title: video.title,
    url: video.url,
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
      memo: `${keyword}のYouTube周回サンプルです。YOUTUBE_API_KEYを設定すると、公式YouTube Data APIから実際の動画を検索します。`,
      publishedAt: today(),
      registered_at: today(),
      tags: ["YouTube", keyword, "動画", "トレンド"],
      thumbnail: "",
      title: `${keyword}の新着動画チェック`,
      url: `https://www.youtube.com/watch?v=mock-hair-trend-${index + 1}`,
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
      maxOutputTokens: 2200,
      systemInstruction: [
        "あなたは美容師向けのYouTubeトレンド分類アシスタントです。",
        "入力は公式YouTube Data APIで取得した動画メタデータだけです。SNSスクレイピングや本文の自動取得は行いません。",
        "美容師が投稿ネタ、カウンセリング、店販、メニュー提案に使いやすい形へ分類してください。",
        salonContext,
      ].join("\n\n"),
      prompt: [
        "以下のYouTube動画候補を美容師向けに分類し、必ずJSON配列だけで返してください。",
        `カテゴリ候補: ${youtubeTrendCategories.join("、")}`,
        `登録済みキーワード: ${existingKeywords.join("、") || "未登録"}`,
        `登録日: ${today()}`,
        "各要素のキー: title, url, category, memo, tags, registered_at",
        "urlは入力された動画URLをそのまま使ってください。",
        "memoには、動画チャンネル名・投稿日・サロンでの活用方法を自然な日本語で含めてください。",
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
