import { NextResponse } from "next/server";
import {
  defaultYoutubeTrendKeywords,
  youtubeTrendSearchConfig,
} from "@/config/youtubeTrendKeywords";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  getYoutubeDailyVideoLimit,
  getYoutubeKeywordLimit,
  getYoutubeRunVideoLimit,
  isYoutubeApiConfigured,
  searchYoutubeVideosForKeywords,
} from "@/lib/youtube";
import {
  classifyYoutubeVideosForTrends,
  createMockYoutubeTrendCandidates,
} from "@/lib/youtubeTrendGenerator";
import type { TrendCategory } from "@/types/trend";
import type {
  YoutubeGeneratedTrend,
  YoutubeSearchVideo,
  YoutubeTrendRangeDays,
} from "@/types/youtubeTrend";

export const runtime = "nodejs";

type KeywordRow = {
  name: string;
  priority?: string | null;
  use_count?: number | null;
};

type TrendLinkRow = {
  url: string;
  title?: string | null;
  category?: string | null;
  counseling_idea?: string | null;
  instagram_idea?: string | null;
  memo?: string | null;
  reel_script?: string | null;
  registered_at?: string | null;
  salon_relevance?: string | null;
  stylist_points?: string | null;
  tags?: string[] | null;
  youtube_summary?: string | null;
};

type SnsPostRow = {
  url: string;
  title?: string | null;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "詳細不明";
  }

  const record = error as Record<string, unknown>;
  const message =
    typeof record.message === "string" ? record.message : "詳細不明";
  const code = typeof record.code === "string" ? ` code: ${record.code}` : "";

  return `${message}${code}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isYoutubeUrl(url: string) {
  return url.includes("youtube.com/") || url.includes("youtu.be/");
}

function normalizeTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[#\[\]【】（）()「」『』"'“”‘’|｜:：,，.。!！?？\-ー〜~_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleBigrams(title: string) {
  const compactTitle = normalizeTitle(title).replace(/\s+/g, "");

  if (!compactTitle) {
    return [];
  }

  if (compactTitle.length === 1) {
    return [compactTitle];
  }

  return Array.from({ length: compactTitle.length - 1 }, (_, index) =>
    compactTitle.slice(index, index + 2),
  );
}

function getTitleSimilarity(firstTitle: string, secondTitle: string) {
  const first = normalizeTitle(firstTitle);
  const second = normalizeTitle(secondTitle);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  if (
    Math.min(first.length, second.length) >= 10 &&
    (first.includes(second) || second.includes(first))
  ) {
    return 0.86;
  }

  const firstBigrams = new Set(toTitleBigrams(first));
  const secondBigrams = new Set(toTitleBigrams(second));

  if (firstBigrams.size === 0 || secondBigrams.size === 0) {
    return 0;
  }

  const intersectionSize = Array.from(firstBigrams).filter((bigram) =>
    secondBigrams.has(bigram),
  ).length;
  const unionSize = new Set([...firstBigrams, ...secondBigrams]).size;

  return intersectionSize / unionSize;
}

function isSimilarTitle(title: string, titles: string[]) {
  return titles.some(
    (existingTitle) => getTitleSimilarity(title, existingTitle) >= 0.78,
  );
}

function filterUniqueVideos({
  existingTitles,
  existingUrls,
  videos,
}: {
  existingTitles: string[];
  existingUrls: Set<string>;
  videos: YoutubeSearchVideo[];
}) {
  const acceptedTitles = [...existingTitles];
  const uniqueVideos: YoutubeSearchVideo[] = [];
  let excludedCount = 0;

  videos.forEach((video) => {
    if (existingUrls.has(video.url) || isSimilarTitle(video.title, acceptedTitles)) {
      excludedCount += 1;
      return;
    }

    uniqueVideos.push(video);
    acceptedTitles.push(video.title);
  });

  return {
    excludedCount,
    videos: uniqueVideos,
  };
}

function getRangeDays(value: unknown): YoutubeTrendRangeDays {
  return value === 30 ? 30 : 7;
}

async function readRequestOptions(request: Request) {
  try {
    const body = (await request.json()) as { rangeDays?: unknown };
    return {
      rangeDays: getRangeDays(body.rangeDays),
    };
  } catch {
    return {
      rangeDays: youtubeTrendSearchConfig.rangeDays as YoutubeTrendRangeDays,
    };
  }
}

function sortKeywordRows(rows: KeywordRow[]) {
  const priorityScore = {
    高: 3,
    中: 2,
    低: 1,
  } as const;

  return [...rows].sort((first, second) => {
    const useCountDiff = (second.use_count ?? 0) - (first.use_count ?? 0);

    if (useCountDiff !== 0) {
      return useCountDiff;
    }

    return (
      (priorityScore[second.priority as keyof typeof priorityScore] ?? 0) -
      (priorityScore[first.priority as keyof typeof priorityScore] ?? 0)
    );
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function buildSearchKeywords(rows: KeywordRow[], limit: number) {
  return uniqueStrings([
    ...sortKeywordRows(rows).map((row) => row.name),
    ...defaultYoutubeTrendKeywords,
  ]).slice(0, limit);
}

async function fetchBaseData() {
  const supabase = getSupabaseClient();
  const warnings: string[] = [];
  let keywordRows: KeywordRow[] = [];
  let existingUrls = new Set<string>();
  let existingTitles: string[] = [];
  let todayYoutubeCount = 0;

  if (!supabase) {
    warnings.push("Supabaseが未設定のため、保存せず生成結果だけ表示します。");
    return {
      existingKeywords: defaultYoutubeTrendKeywords,
      existingTitles,
      existingUrls,
      keywordRows,
      todayYoutubeCount,
      warnings,
    };
  }

  const [trendResult, keywordResult, snsResult] = await Promise.all([
    supabase.from("trend_links").select("url,title,category,registered_at"),
    supabase.from("keywords").select("name,priority,use_count"),
    supabase.from("sns_posts").select("url,title"),
  ]);

  if (trendResult.error) {
    warnings.push(
      `登録済みトレンドURLの取得に失敗しました。${getErrorMessage(trendResult.error)}`,
    );
  } else {
    const rows = (trendResult.data ?? []) as TrendLinkRow[];
    existingUrls = new Set(rows.map((row) => row.url).filter(Boolean));
    existingTitles = rows.map((row) => row.title ?? "").filter(Boolean);
    todayYoutubeCount = rows.filter(
      (row) =>
        Boolean(row.url) &&
        isYoutubeUrl(row.url) &&
        row.registered_at === today(),
    ).length;
  }

  if (keywordResult.error) {
    warnings.push(
      `登録済みキーワードの取得に失敗しました。初期キーワードを使います。${getErrorMessage(keywordResult.error)}`,
    );
  } else {
    keywordRows = (keywordResult.data ?? []) as KeywordRow[];
  }

  if (snsResult.error) {
    warnings.push(
      `登録済みSNS投稿URLの取得に失敗しました。${getErrorMessage(snsResult.error)}`,
    );
  } else {
    ((snsResult.data ?? []) as SnsPostRow[]).forEach((row) => {
      if (row.url) {
        existingUrls.add(row.url);
      }

      if (row.title) {
        existingTitles.push(row.title);
      }
    });
  }

  return {
    existingKeywords: buildSearchKeywords(keywordRows, 20),
    existingTitles,
    existingUrls,
    keywordRows,
    todayYoutubeCount,
    warnings,
  };
}

async function insertYoutubeTrends(trends: YoutubeGeneratedTrend[]) {
  const supabase = getSupabaseClient();

  if (!supabase || trends.length === 0) {
    return {
      savedCount: 0,
      savedTrends: [] as YoutubeGeneratedTrend[],
    };
  }

  const rows = trends.map((trend) => ({
    category: trend.category,
    counseling_idea: trend.counseling_idea,
    instagram_idea: trend.instagram_idea,
    memo: trend.memo,
    reel_script: trend.reel_script,
    registered_at: trend.registered_at,
    salon_relevance: trend.salon_relevance,
    stylist_points: trend.stylist_points,
    tags: trend.tags,
    title: trend.title,
    url: trend.url,
    youtube_summary: trend.youtube_summary,
  }));
  const { data, error } = await supabase
    .from("trend_links")
    .insert(rows)
    .select(
      "title,url,category,memo,registered_at,tags,youtube_summary,stylist_points,instagram_idea,reel_script,counseling_idea,salon_relevance",
    );

  if (!error) {
    return {
      savedCount: data?.length ?? 0,
      savedTrends: (data ?? []).map((row, index) =>
        toSavedYoutubeTrend(row as TrendLinkRow, trends[index]),
      ),
    };
  }

  const retryRows = trends.map((trend) => ({
    category: trend.category,
    memo: trend.memo,
    registered_at: trend.registered_at,
    title: trend.title,
    url: trend.url,
  }));
  const retry = await supabase
    .from("trend_links")
    .insert(retryRows)
    .select("title,url,category,memo,registered_at");

  if (retry.error) {
    throw retry.error;
  }

  return {
    savedCount: retry.data?.length ?? 0,
    savedTrends: (retry.data ?? []).map((row, index) =>
      toSavedYoutubeTrend(row as TrendLinkRow, trends[index]),
    ),
  };
}

function toSavedYoutubeTrend(
  row: TrendLinkRow,
  fallback?: YoutubeGeneratedTrend,
): YoutubeGeneratedTrend {
  return {
    category: (row.category as TrendCategory | undefined) ?? fallback?.category ?? "YouTube",
    channelTitle: fallback?.channelTitle,
    counseling_idea: row.counseling_idea ?? fallback?.counseling_idea ?? "",
    instagram_idea: row.instagram_idea ?? fallback?.instagram_idea ?? "",
    memo: row.memo ?? fallback?.memo ?? "",
    publishedAt: fallback?.publishedAt,
    reel_script: row.reel_script ?? fallback?.reel_script ?? "",
    registered_at: row.registered_at ?? fallback?.registered_at ?? today(),
    salon_relevance:
      row.salon_relevance === "高" ||
      row.salon_relevance === "中" ||
      row.salon_relevance === "低"
        ? row.salon_relevance
        : fallback?.salon_relevance ?? "中",
    stylist_points: row.stylist_points ?? fallback?.stylist_points ?? "",
    tags: row.tags?.length ? row.tags : fallback?.tags ?? [],
    thumbnail: fallback?.thumbnail,
    title: row.title ?? fallback?.title ?? "YouTubeトレンド",
    url: row.url,
    youtube_summary: row.youtube_summary ?? fallback?.youtube_summary ?? "",
  };
}

export async function POST(request: Request) {
  const { rangeDays } = await readRequestOptions(request);
  const dailyLimit = getYoutubeDailyVideoLimit(
    youtubeTrendSearchConfig.dailyVideoLimit,
  );
  const keywordLimit = getYoutubeKeywordLimit(youtubeTrendSearchConfig.keywordLimit);
  const maxResultsPerKeyword = youtubeTrendSearchConfig.maxResultsPerKeyword;
  const runVideoLimit = getYoutubeRunVideoLimit(
    youtubeTrendSearchConfig.runVideoLimit,
  );

  try {
    const baseData = await fetchBaseData();
    const warnings = [...baseData.warnings];
    const remainingDailySlots = Math.max(
      0,
      dailyLimit - baseData.todayYoutubeCount,
    );
    const searchedKeywords = buildSearchKeywords(baseData.keywordRows, keywordLimit);
    const remainingRunSlots = Math.min(remainingDailySlots, runVideoLimit);

    if (remainingDailySlots <= 0) {
      return NextResponse.json({
        dailyLimit,
        generatedCount: 0,
        providerLabel: "YouTube Data API",
        rangeDays,
        remainingDailySlots,
        savedCount: 0,
        savedTrends: [],
        searchedKeywords,
        trends: [],
        videoCount: 0,
        warnings: [
          ...warnings,
          `本日のYouTube保存上限 ${dailyLimit}件 に達しています。`,
        ],
      });
    }

    if (!isYoutubeApiConfigured()) {
      const mockTrends = createMockYoutubeTrendCandidates(baseData.existingUrls);

      return NextResponse.json({
        dailyLimit,
        generatedCount: mockTrends.length,
        providerLabel: "モック生成",
        rangeDays,
        remainingDailySlots,
        savedCount: 0,
        savedTrends: [],
        searchedKeywords,
        trends: mockTrends,
        videoCount: 0,
        warnings: [
          ...warnings,
          "YOUTUBE_API_KEYが未設定のため、公式YouTube検索は行わずサンプルだけ表示しています。",
        ],
      });
    }

    const searchResult = await searchYoutubeVideosForKeywords({
      keywords: searchedKeywords,
      maxResultsPerKeyword,
      rangeDays,
    });
    warnings.push(...searchResult.warnings);

    const filteredVideos = filterUniqueVideos({
      existingTitles: baseData.existingTitles,
      existingUrls: baseData.existingUrls,
      videos: searchResult.videos,
    });

    if (filteredVideos.excludedCount > 0) {
      warnings.push(
        `保存済みURLまたは近いタイトルの重複候補を${filteredVideos.excludedCount}件除外しました。`,
      );
    }

    const candidateVideos = filteredVideos.videos.slice(0, remainingRunSlots);

    if (candidateVideos.length === 0) {
      return NextResponse.json({
        dailyLimit,
        generatedCount: 0,
        providerLabel: "YouTube Data API",
        rangeDays,
        remainingDailySlots,
        savedCount: 0,
        savedTrends: [],
        searchedKeywords,
        trends: [],
        videoCount: searchResult.videos.length,
        warnings: [
          ...warnings,
          "新しく保存できるYouTube動画候補はありませんでした。",
        ],
      });
    }

    const generation = await classifyYoutubeVideosForTrends({
      existingKeywords: baseData.existingKeywords,
      videos: candidateVideos,
    });
    const uniqueTrends = generation.trends
      .filter((trend) => !baseData.existingUrls.has(trend.url))
      .slice(0, remainingRunSlots);
    let saved = {
      savedCount: 0,
      savedTrends: [] as YoutubeGeneratedTrend[],
    };

    try {
      saved = await insertYoutubeTrends(uniqueTrends);
    } catch (error) {
      warnings.push(
        `YouTube候補の生成はできましたが、Supabase保存に失敗しました。${getErrorMessage(error)}`,
      );
    }

    return NextResponse.json({
      dailyLimit,
      generatedCount: uniqueTrends.length,
      providerLabel: generation.providerLabel,
      rangeDays,
      remainingDailySlots: Math.max(0, remainingDailySlots - saved.savedCount),
      savedCount: saved.savedCount,
      savedTrends: saved.savedTrends,
      searchedKeywords,
      trends: uniqueTrends,
      videoCount: searchResult.videos.length,
      warnings,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "YouTube周回に失敗しました。YOUTUBE_API_KEY、AI設定、Vercel環境変数を確認してください。",
      },
      { status: 500 },
    );
  }
}
