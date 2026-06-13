import type { TrendSource } from "@/config/trendSources";
import type { TrendSourceRssStatus } from "@/types/trendSource";

export const MAX_RSS_ARTICLES_PER_SOURCE = 5;

const RSS_TIMEOUT_MS = 7_000;
const MAX_RSS_BYTES = 2_000_000;
const RECENT_DAYS = 30;

export type RssArticle = {
  title: string;
  url: string;
  sourceName: string;
  categoryHint: string;
  publishedAt?: string;
  summary?: string;
};

export type RssSourceResult = {
  sourceId?: string;
  sourceName: string;
  status: TrendSourceRssStatus;
  rssUrl: string | null;
  articleCount: number;
  error: string;
  consecutiveFailures: number;
};

export type RssFetchResult = {
  articles: RssArticle[];
  errors: string[];
  sourceResults: RssSourceResult[];
};

type FeedResponse = {
  xml: string;
  url: string;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(item: string, tagName: string) {
  const match = item.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );

  return match ? decodeXml(match[1]) : "";
}

function getAtomLink(item: string) {
  const alternateMatch = item.match(
    /<link[^>]+rel=[#']alternate["'][^>]+href=[#']([^#']+)[#'][^>]*>/i,
  );
  const hrefMatch = item.match(/<link[^>]+href=[#']([^#']+)[#'][^>]*>/i);

  return alternateMatch
    ? decodeXml(alternateMatch[1])
    : hrefMatch
      ? decodeXml(hrefMatch[1])
      : "";
}

function isFeedXml(xml: string) {
  const head = xml.slice(0, 2_000);

  return /<(rss|feed|rdf:RDF)(\s|>)/i.test(head);
}

function isLikelyFeedUrl(url: string) {
  return /(?:feed|rss|atom|\.xml)(?:\/|$|\?)/i.test(url);
}

function buildFeedCandidates(siteUrl: string, explicitRssUrl?: string) {
  const candidates: string[] = [];

  if (explicitRssUrl) {
    candidates.push(explicitRssUrl);
  }

  try {
    const parsed = new URL(siteUrl);
    const origin = parsed.origin;
    const base = siteUrl.replace(/\/+$/, "");

    if (isLikelyFeedUrl(siteUrl)) {
      candidates.push(siteUrl);
    }

    candidates.push(
      `${base}/feed/`,
      `${base}/feed`,
      `${origin}/feed/`,
      `${origin}/feed`,
      `${origin}/rss.xml`,
      `${origin}/feed.xml`,
      `${origin}/atom.xml`,
      `${origin}/index.xml`,
      `${origin}/feed/rss`,
    );
  } catch {
    return explicitRssUrl ? [explicitRssUrl] : [];
  }

  return Array.from(new Set(candidates)).slice(0, 10);
}

async function fetchFeed(candidateUrl: string): Promise<FeedResponse | null> {
  const response = await fetch(candidateUrl, {
    cache: "no-store",
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "User-Agent": "hair-trend-dashboard/1.0 RSS checker",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(RSS_TIMEOUT_MS),
  });

  if (!response.ok) {
    return null;
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");

  if (contentLength > MAX_RSS_BYTES) {
    return null;
  }

  const xml = (await response.text()).slice(0, MAX_RSS_BYTES);

  if (!isFeedXml(xml)) {
    return null;
  }

  return {
    url: response.url || candidateUrl,
    xml,
  };
}

export async function discoverRssFeed(
  siteUrl: string,
  explicitRssUrl?: string,
): Promise<FeedResponse | null> {
  for (const candidate of buildFeedCandidates(siteUrl, explicitRssUrl)) {
    try {
      const feed = await fetchFeed(candidate);

      if (feed) {
        return feed;
      }
    } catch {
      // RSS候補が取れない場合は次の候補を試します。HTML本文は解析しません。
    }
  }

  return null;
}

export function normalizeArticleUrl(value: string) {
  try {
    const url = new URL(value);
    const trackingKeys = Array.from(url.searchParams.keys()).filter(
      (key) =>
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "yclid"].includes(key.toLowerCase()),
    );

    trackingKeys.forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    url.searchParams.sort();

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

function parsePublishedAt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function sortRecentArticles(articles: RssArticle[]) {
  const recentThreshold = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1_000;

  return [...articles].sort((first, second) => {
    const firstTimestamp = parsePublishedAt(first.publishedAt);
    const secondTimestamp = parsePublishedAt(second.publishedAt);
    const firstIsRecent =
      firstTimestamp !== null && firstTimestamp >= recentThreshold;
    const secondIsRecent =
      secondTimestamp !== null && secondTimestamp >= recentThreshold;

    if (firstIsRecent !== secondIsRecent) {
      return firstIsRecent ? -1 : 1;
    }

    return (secondTimestamp ?? 0) - (firstTimestamp ?? 0);
  });
}

function parseFeed(xml: string, source: TrendSource) {
  const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  const entryMatches = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map(
    (match) => match[0],
  );
  const items = itemMatches.length > 0 ? itemMatches : entryMatches;
  const seenUrls = new Set<string>();

  const articles = items
    .map((item): RssArticle | null => {
      const title = getTagValue(item, "title");
      const url =
        getTagValue(item, "link") ||
        getTagValue(item, "guid") ||
        getAtomLink(item);
      const summary =
        getTagValue(item, "description") ||
        getTagValue(item, "summary") ||
        getTagValue(item, "content");
      const publishedAt =
        getTagValue(item, "pubDate") ||
        getTagValue(item, "published") ||
        getTagValue(item, "updated");

      if (!title || !url) {
        return null;
      }

      const normalizedUrl = normalizeArticleUrl(url);

      if (seenUrls.has(normalizedUrl)) {
        return null;
      }

      seenUrls.add(normalizedUrl);

      return {
        categoryHint: source.categoryHint,
        publishedAt,
        sourceName: source.name,
        summary,
        title,
        url,
      };
    })
    .filter((article): article is RssArticle => article !== null);

  return sortRecentArticles(articles).slice(0, MAX_RSS_ARTICLES_PER_SOURCE);
}

export async function fetchRssArticles(
  sources: TrendSource[],
): Promise<RssFetchResult> {
  const articles: RssArticle[] = [];
  const errors: string[] = [];
  const sourceResults: RssSourceResult[] = [];

  for (const source of sources) {
    if (!source.enabled) {
      continue;
    }

    const feed = await discoverRssFeed(source.url, source.rssUrl);

    if (!feed) {
      const error = `${source.name}: 公開RSSを確認できませんでした。手動参照として残します。`;
      errors.push(error);
      sourceResults.push({
        articleCount: 0,
        consecutiveFailures: (source.failureCount ?? 0) + 1,
        error,
        rssUrl: source.rssUrl ?? null,
        sourceId: source.id,
        sourceName: source.name,
        status: source.rssUrl ? "error" : "unavailable",
      });
      continue;
    }

    const sourceArticles = parseFeed(feed.xml, source);
    articles.push(...sourceArticles);
    sourceResults.push({
      articleCount: sourceArticles.length,
      consecutiveFailures: 0,
      error: "",
      rssUrl: feed.url,
      sourceId: source.id,
      sourceName: source.name,
      status: "available",
    });
  }

  const uniqueArticles = Array.from(
    new Map(
      articles.map((article) => [normalizeArticleUrl(article.url), article]),
    ).values(),
  );

  return {
    articles: uniqueArticles,
    errors,
    sourceResults,
  };
}
