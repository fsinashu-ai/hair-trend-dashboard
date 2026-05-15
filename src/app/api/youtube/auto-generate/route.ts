import { NextResponse } from "next/server";
import {
  defaultYoutubeTrendKeywords,
  youtubeTrendSearchConfig,
} from "@/config/youtubeTrendKeywords";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  getYoutubeDailyVideoLimit,
  getYoutubeKeywordLimit,
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
  category?: string | null;
  registered_at?: string | null;
};

type SnsPostRow = {
  url: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isYoutubeUrl(url: string) {
  return url.includes("youtube.com/") || url.includes("youtu.be/");
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
  let todayYoutubeCount = 0;

  if (!supabase) {
    warnings.push("Supabaseが未設定のため、保存せず生成結果だけ表示します。");
    return {
      existingKeywords: defaultYoutubeTrendKeywords,
      existingUrls,
      keywordRows,
      todayYoutubeCount,
      warnings,
    };
  }

  const [trendResult, keywordResult, snsResult] = await Promise.all([
    supabase.from("trend_links").select("url,category,registered_at"),
    supabase.from("keywords").select("name,priority,use_count"),
    supabase.from("sns_posts").select("url"),
  ]);

  if (trendResult.error) {
    warnings.push("登録済みトレンドURLの取得に失敗しました。");
  } else {
    const rows = (trendResult.data ?? []) as TrendLinkRow[];
    existingUrls = new Set(rows.map((row) => row.url).filter(Boolean));
    todayYoutubeCount = rows.filter(
      (row) =>
        Boolean(row.url) &&
        isYoutubeUrl(row.url) &&
        row.registered_at === today(),
    ).length;
  }

  if (keywordResult.error) {
    warnings.push("登録済みキーワードの取得に失敗しました。初期キーワードを使います。");
  } else {
    keywordRows = (keywordResult.data ?? []) as KeywordRow[];
  }

  if (snsResult.error) {
    warnings.push("登録済みSNS投稿URLの取得に失敗しました。");
  } else {
    ((snsResult.data ?? []) as SnsPostRow[]).forEach((row) => {
      if (row.url) {
        existingUrls.add(row.url);
      }
    });
  }

  return {
    existingKeywords: buildSearchKeywords(keywordRows, 20),
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
    memo: trend.memo,
    registered_at: trend.registered_at,
    tags: trend.tags,
    title: trend.title,
    url: trend.url,
  }));
  const { data, error } = await supabase
    .from("trend_links")
    .insert(rows)
    .select("title,url,category,memo,registered_at,tags");

  if (error) {
    throw error;
  }

  return {
    savedCount: data?.length ?? 0,
    savedTrends: (data ?? []).map((row) => ({
      category: row.category as TrendCategory,
      memo: row.memo,
      registered_at: row.registered_at,
      tags: row.tags ?? [],
      title: row.title,
      url: row.url,
    })) as YoutubeGeneratedTrend[],
  };
}

export async function POST(request: Request) {
  const { rangeDays } = await readRequestOptions(request);
  const dailyLimit = getYoutubeDailyVideoLimit(
    youtubeTrendSearchConfig.dailyVideoLimit,
  );
  const keywordLimit = getYoutubeKeywordLimit(youtubeTrendSearchConfig.keywordLimit);
  const maxResultsPerKeyword = youtubeTrendSearchConfig.maxResultsPerKeyword;

  try {
    const baseData = await fetchBaseData();
    const warnings = [...baseData.warnings];
    const remainingDailySlots = Math.max(
      0,
      dailyLimit - baseData.todayYoutubeCount,
    );
    const searchedKeywords = buildSearchKeywords(baseData.keywordRows, keywordLimit);

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

    const candidateVideos = searchResult.videos
      .filter((video) => !baseData.existingUrls.has(video.url))
      .slice(0, remainingDailySlots);

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
      .slice(0, remainingDailySlots);
    let saved = {
      savedCount: 0,
      savedTrends: [] as YoutubeGeneratedTrend[],
    };

    try {
      saved = await insertYoutubeTrends(uniqueTrends);
    } catch {
      warnings.push(
        "YouTube候補の生成はできましたが、Supabase保存に失敗しました。Supabase URL、anon key、RLS、schema.sqlを確認してください。",
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
