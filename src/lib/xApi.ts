import type { XSearchPost } from "@/types/xTrend";

const xRecentSearchEndpoint = "https://api.x.com/2/tweets/search/recent";

type XUser = {
  id: string;
  name?: string;
  username?: string;
};

type XTweet = {
  author_id?: string;
  created_at?: string;
  id: string;
  public_metrics?: {
    like_count?: number;
    quote_count?: number;
    reply_count?: number;
    retweet_count?: number;
  };
  text?: string;
};

type XSearchResponse = {
  data?: XTweet[];
  errors?: Array<{ detail?: string; title?: string }>;
  includes?: {
    users?: XUser[];
  };
};

export function isXApiConfigured() {
  return Boolean(process.env.X_BEARER_TOKEN?.trim());
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.floor(numberValue);
}

export function getXKeywordLimit(fallback: number) {
  return Math.min(5, toPositiveInteger(process.env.X_KEYWORD_LIMIT, fallback));
}

export function getXRunPostLimit(fallback: number) {
  return Math.min(20, toPositiveInteger(process.env.X_RUN_POST_LIMIT, fallback));
}

function buildSearchTerm(keyword: string) {
  const cleanedKeyword = keyword.replaceAll("\"", "").trim();

  if (!cleanedKeyword) {
    return "";
  }

  return /\s/.test(cleanedKeyword) ? `"${cleanedKeyword}"` : cleanedKeyword;
}

function buildXQuery(keyword: string) {
  const searchTerm = buildSearchTerm(keyword);

  return `${searchTerm} lang:ja -is:retweet -is:reply`;
}

function getXErrorMessage(status: number) {
  if (status === 401) {
    return "X_BEARER_TOKENが無効、または未承認です。";
  }

  if (status === 403) {
    return "X APIの権限またはプランでRecent Searchを利用できません。";
  }

  if (status === 429) {
    return "X APIの利用上限に達しました。時間を置いて再実行してください。";
  }

  return `X API検索に失敗しました。status: ${status}`;
}

function createUserMap(users: XUser[] | undefined) {
  return new Map((users ?? []).map((user) => [user.id, user] as const));
}

function toXPost(tweet: XTweet, keyword: string, userMap: Map<string, XUser>) {
  const text = tweet.text?.trim();

  if (!tweet.id || !text) {
    return null;
  }

  const user = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
  const username = user?.username ?? "i";
  const likeCount = tweet.public_metrics?.like_count ?? 0;
  const replyCount = tweet.public_metrics?.reply_count ?? 0;
  const repostCount = tweet.public_metrics?.retweet_count ?? 0;
  const quoteCount = tweet.public_metrics?.quote_count ?? 0;

  return {
    authorName: user?.name ?? "X",
    createdAt: tweet.created_at ?? "",
    engagementScore: likeCount + replyCount + repostCount + quoteCount,
    id: tweet.id,
    keyword,
    likeCount,
    replyCount,
    repostCount,
    text,
    url: `https://x.com/${username}/status/${tweet.id}`,
    username: `@${username}`,
  } satisfies XSearchPost;
}

export async function searchXPostsForKeywords({
  keywords,
  maxResultsPerKeyword,
}: {
  keywords: string[];
  maxResultsPerKeyword: number;
}) {
  const bearerToken = process.env.X_BEARER_TOKEN?.trim();

  if (!bearerToken) {
    throw new Error("X_BEARER_TOKEN is not configured.");
  }

  const postMap = new Map<string, XSearchPost>();
  const warnings: string[] = [];
  const safeMaxResultsPerKeyword = Math.min(
    5,
    Math.max(1, Math.floor(maxResultsPerKeyword)),
  );

  for (const keyword of keywords) {
    const query = buildXQuery(keyword);

    if (!query.trim()) {
      continue;
    }

    const params = new URLSearchParams({
      expansions: "author_id",
      max_results: "10",
      query,
      "tweet.fields": "author_id,created_at,public_metrics,lang",
      "user.fields": "name,username",
    });

    try {
      const response = await fetch(`${xRecentSearchEndpoint}?${params}`, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!response.ok) {
        warnings.push(`${keyword}: ${getXErrorMessage(response.status)}`);
        continue;
      }

      const data = (await response.json()) as XSearchResponse;
      const userMap = createUserMap(data.includes?.users);
      const posts = (data.data ?? [])
        .map((tweet) => toXPost(tweet, keyword, userMap))
        .filter((post): post is XSearchPost => post !== null)
        .slice(0, safeMaxResultsPerKeyword);

      posts.forEach((post) => {
        if (!postMap.has(post.url)) {
          postMap.set(post.url, post);
        }
      });

      if (data.errors?.length) {
        warnings.push(`${keyword}: X APIから一部警告が返りました。`);
      }
    } catch {
      warnings.push(`${keyword}: X API検索中にエラーが発生しました。`);
    }
  }

  return {
    posts: Array.from(postMap.values()),
    warnings,
  };
}
