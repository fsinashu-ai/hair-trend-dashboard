import type { TrendSource } from "@/config/trendSources";

export type RssArticle = {
  title: string;
  url: string;
  sourceName: string;
  categoryHint: string;
  publishedAt?: string;
  summary?: string;
};

export type RssFetchResult = {
  articles: RssArticle[];
  errors: string[];
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
    .trim();
}

function getTagValue(item: string, tagName: string) {
  const match = item.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));

  return match ? decodeXml(match[1]) : "";
}

function getAtomLink(item: string) {
  const hrefMatch = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);

  return hrefMatch ? decodeXml(hrefMatch[1]) : "";
}

function parseFeed(xml: string, source: TrendSource) {
  const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  const entryMatches = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map(
    (match) => match[0],
  );
  const items = itemMatches.length > 0 ? itemMatches : entryMatches;

  return items
    .map((item): RssArticle | null => {
      const title = getTagValue(item, "title");
      const url = getTagValue(item, "link") || getAtomLink(item);
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
}

export async function fetchRssArticles(sources: TrendSource[]): Promise<RssFetchResult> {
  const articles: RssArticle[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    if (!source.enabled || source.type !== "rss") {
      continue;
    }

    try {
      const response = await fetch(source.url, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        next: {
          revalidate: 0,
        },
      });

      if (!response.ok) {
        errors.push(`${source.name}: RSS取得に失敗しました。`);
        continue;
      }

      const xml = await response.text();
      articles.push(...parseFeed(xml, source));
    } catch {
      errors.push(`${source.name}: RSS取得中にエラーが発生しました。`);
    }
  }

  return {
    articles,
    errors,
  };
}
