import type { YoutubeSearchVideo } from "@/types/youtubeTrend";

const youtubeSearchEndpoint = "https://www.googleapis.com/youtube/v3/search";

type YoutubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
    title?: string;
  };
};

type YoutubeSearchResponse = {
  items?: YoutubeSearchItem[];
};

export function isYoutubeApiConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

function getPublishedAfter(rangeDays: number) {
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - rangeDays);
  return publishedAfter.toISOString();
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

export function getYoutubeDailyVideoLimit(fallback: number) {
  return Math.min(
    30,
    toPositiveInteger(process.env.YOUTUBE_DAILY_VIDEO_LIMIT, fallback),
  );
}

export function getYoutubeKeywordLimit(fallback: number) {
  return Math.min(
    6,
    toPositiveInteger(process.env.YOUTUBE_KEYWORD_LIMIT, fallback),
  );
}

export function getYoutubeRunVideoLimit(fallback: number) {
  return Math.min(
    30,
    toPositiveInteger(process.env.YOUTUBE_RUN_VIDEO_LIMIT, fallback),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function toYoutubeVideo(item: YoutubeSearchItem, keyword: string) {
  const videoId = item.id?.videoId;
  const title = item.snippet?.title;

  if (!videoId || !title) {
    return null;
  }

  return {
    channelTitle: item.snippet?.channelTitle ?? "YouTube",
    id: videoId,
    keyword,
    publishedAt: item.snippet?.publishedAt ?? "",
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
    title: decodeHtmlEntities(title),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  } satisfies YoutubeSearchVideo;
}

export async function searchYoutubeVideosForKeywords({
  keywords,
  maxResultsPerKeyword,
  rangeDays,
}: {
  keywords: string[];
  maxResultsPerKeyword: number;
  rangeDays: number;
}) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured.");
  }

  const warnings: string[] = [];
  const videoMap = new Map<string, YoutubeSearchVideo>();
  const publishedAfter = getPublishedAfter(rangeDays);
  const safeMaxResultsPerKeyword = Math.min(
    5,
    Math.max(1, Math.floor(maxResultsPerKeyword)),
  );

  for (const keyword of keywords) {
    const params = new URLSearchParams({
      fields:
        "items(id/videoId,snippet/title,snippet/channelTitle,snippet/publishedAt,snippet/thumbnails/default/url,snippet/thumbnails/medium/url,snippet/thumbnails/high/url)",
      key: apiKey,
      maxResults: String(safeMaxResultsPerKeyword),
      order: "date",
      part: "snippet",
      publishedAfter,
      q: keyword,
      regionCode: "JP",
      relevanceLanguage: "ja",
      safeSearch: "moderate",
      type: "video",
    });

    try {
      const response = await fetch(`${youtubeSearchEndpoint}?${params}`);

      if (!response.ok) {
        warnings.push(`YouTube検索に失敗しました: ${keyword}`);
        continue;
      }

      const data = (await response.json()) as YoutubeSearchResponse;

      (data.items ?? []).forEach((item) => {
        const video = toYoutubeVideo(item, keyword);

        if (video && !videoMap.has(video.url)) {
          videoMap.set(video.url, video);
        }
      });
    } catch {
      warnings.push(`YouTube検索中にエラーが発生しました: ${keyword}`);
    }
  }

  return {
    videos: Array.from(videoMap.values()),
    warnings,
  };
}
