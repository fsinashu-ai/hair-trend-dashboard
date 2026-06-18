import { NextResponse } from "next/server";
import {
  defaultXTrendKeywords,
  xTrendSearchConfig,
} from "@/config/xTrendKeywords";
import { getTitleSimilarity } from "@/lib/social/url";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createSocialPostInSupabase,
  fetchSocialPostsFromSupabase,
} from "@/lib/supabase/socialPosts";
import { fetchSocialSourcesFromSupabase } from "@/lib/supabase/socialSources";
import {
  getXKeywordLimit,
  getXRunPostLimit,
  isXApiConfigured,
  searchXPostsForKeywords,
} from "@/lib/xApi";
import {
  classifyXPostsForSocialInbox,
  createMockXSocialPosts,
} from "@/lib/xSocialGenerator";
import type { NewSocialPost, SocialPost } from "@/types/social";
import type { XGeneratedSocialPost, XSearchPost } from "@/types/xTrend";

export const runtime = "nodejs";

type KeywordRow = {
  name: string;
  priority?: string | null;
  use_count?: number | null;
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
    ...defaultXTrendKeywords,
  ]).slice(0, limit);
}

function isSimilarTitle(title: string, titles: string[]) {
  return titles.some(
    (existingTitle) => getTitleSimilarity(title, existingTitle) >= 0.78,
  );
}

function filterUniquePosts({
  existingTitles,
  existingUrls,
  posts,
}: {
  existingTitles: string[];
  existingUrls: Set<string>;
  posts: XSearchPost[];
}) {
  const acceptedTitles = [...existingTitles];
  const uniquePosts: XSearchPost[] = [];
  let excludedCount = 0;

  posts.forEach((post) => {
    const title = post.text.slice(0, 80);

    if (existingUrls.has(post.url) || isSimilarTitle(title, acceptedTitles)) {
      excludedCount += 1;
      return;
    }

    uniquePosts.push(post);
    acceptedTitles.push(title);
  });

  return {
    excludedCount,
    posts: uniquePosts,
  };
}

async function fetchBaseData(keywordLimit: number) {
  const supabase = getSupabaseClient();
  const warnings: string[] = [];
  let keywordRows: KeywordRow[] = [];
  let existingUrls = new Set<string>();
  let existingTitles: string[] = [];
  let sourceId: string | undefined;

  if (!supabase) {
    warnings.push("Supabaseが未設定のため、X候補は保存せず表示だけ行います。");
    return {
      existingKeywords: defaultXTrendKeywords.slice(0, keywordLimit),
      existingTitles,
      existingUrls,
      keywordRows,
      sourceId,
      warnings,
    };
  }

  const keywordResult = await supabase
    .from("keywords")
    .select("name,priority,use_count");

  if (keywordResult.error) {
    warnings.push(
      `登録済みキーワードの取得に失敗しました。初期キーワードを使います。${getErrorMessage(keywordResult.error)}`,
    );
  } else {
    keywordRows = (keywordResult.data ?? []) as KeywordRow[];
  }

  try {
    const postResult = await fetchSocialPostsFromSupabase();

    existingUrls = new Set(
      (postResult ?? [])
        .flatMap((post) => [post.url, post.canonicalUrl])
        .filter(Boolean),
    );
    existingTitles = (postResult ?? [])
      .map((post) => post.title)
      .filter(Boolean);
  } catch (error) {
    warnings.push(
      `登録済みSNS受信箱の取得に失敗しました。重複判定はURL中心で行います。${getErrorMessage(error)}`,
    );
  }

  try {
    const sourceResult = await fetchSocialSourcesFromSupabase();
    const xSource = (sourceResult ?? []).find(
      (source) => source.snsType === "X" && source.isActive,
    );
    sourceId = xSource?.id;
  } catch (error) {
    warnings.push(
      `X取得元の取得に失敗しました。source_idなしで保存します。${getErrorMessage(error)}`,
    );
  }

  return {
    existingKeywords: buildSearchKeywords(keywordRows, keywordLimit),
    existingTitles,
    existingUrls,
    keywordRows,
    sourceId,
    warnings,
  };
}

function toNewSocialPost(
  post: XGeneratedSocialPost,
  sourceId?: string,
): NewSocialPost {
  return {
    aiSummary: post.aiSummary,
    blogIdea: post.blogIdea,
    canonicalUrl: post.canonicalUrl,
    category: post.category,
    counselingIdea: post.counselingIdea,
    description: post.description,
    importedAt: post.importedAt,
    instagramPostIdea: post.instagramPostIdea,
    isFavorite: false,
    ogImageUrl: post.ogImageUrl,
    publishedAt: post.publishedAt,
    relevance: post.relevance,
    reviewStatus: "未確認",
    snsType: "X",
    sourceId,
    tags: post.tags,
    title: post.title,
    url: post.url,
  };
}

async function saveSocialPosts(
  posts: XGeneratedSocialPost[],
  sourceId?: string,
) {
  const savedPosts: SocialPost[] = [];
  const warnings: string[] = [];

  for (const post of posts) {
    try {
      const saved = await createSocialPostInSupabase(
        toNewSocialPost(post, sourceId),
      );

      if (saved) {
        savedPosts.push(saved);
      }
    } catch (error) {
      warnings.push(
        `${post.title}: Supabase保存に失敗しました。${getErrorMessage(error)}`,
      );
    }
  }

  return {
    savedPosts,
    warnings,
  };
}

export async function POST() {
  const keywordLimit = getXKeywordLimit(xTrendSearchConfig.keywordLimit);
  const runPostLimit = getXRunPostLimit(xTrendSearchConfig.runPostLimit);

  try {
    const baseData = await fetchBaseData(keywordLimit);
    const warnings = [...baseData.warnings];
    const searchedKeywords = buildSearchKeywords(baseData.keywordRows, keywordLimit);

    if (!isXApiConfigured()) {
      const mockPosts = createMockXSocialPosts(baseData.existingUrls);

      return NextResponse.json({
        generatedCount: mockPosts.length,
        posts: mockPosts,
        providerLabel: "モック生成",
        remainingRunSlots: runPostLimit,
        savedCount: 0,
        savedPosts: [],
        searchedKeywords,
        tweetCount: 0,
        warnings: [
          ...warnings,
          "X_BEARER_TOKENが未設定のため、公式X検索は行わずサンプルだけ表示しています。",
        ],
      });
    }

    const searchResult = await searchXPostsForKeywords({
      keywords: searchedKeywords,
      maxResultsPerKeyword: xTrendSearchConfig.maxResultsPerKeyword,
    });
    warnings.push(...searchResult.warnings);

    const filteredPosts = filterUniquePosts({
      existingTitles: baseData.existingTitles,
      existingUrls: baseData.existingUrls,
      posts: searchResult.posts,
    });

    if (filteredPosts.excludedCount > 0) {
      warnings.push(
        `保存済みURLまたは近いタイトルの重複候補を${filteredPosts.excludedCount}件除外しました。`,
      );
    }

    const targetPosts = filteredPosts.posts.slice(0, runPostLimit);

    if (targetPosts.length === 0) {
      return NextResponse.json({
        generatedCount: 0,
        posts: [],
        providerLabel: "X API",
        remainingRunSlots: runPostLimit,
        savedCount: 0,
        savedPosts: [],
        searchedKeywords,
        tweetCount: searchResult.posts.length,
        warnings: [
          ...warnings,
          "新しく保存できるX投稿候補はありませんでした。",
        ],
      });
    }

    const generation = await classifyXPostsForSocialInbox({
      existingKeywords: baseData.existingKeywords,
      posts: targetPosts,
    });
    const saveResult = await saveSocialPosts(generation.posts, baseData.sourceId);
    warnings.push(...saveResult.warnings);

    return NextResponse.json({
      generatedCount: generation.posts.length,
      posts: generation.posts,
      providerLabel: generation.providerLabel,
      remainingRunSlots: Math.max(0, runPostLimit - saveResult.savedPosts.length),
      savedCount: saveResult.savedPosts.length,
      savedPosts: saveResult.savedPosts,
      searchedKeywords,
      tweetCount: searchResult.posts.length,
      warnings,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "X巡回に失敗しました。X_BEARER_TOKEN、Supabase設定、AI設定を確認してください。",
      },
      { status: 500 },
    );
  }
}
