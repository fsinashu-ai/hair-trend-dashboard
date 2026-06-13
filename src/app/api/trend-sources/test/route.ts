import { NextResponse } from "next/server";
import { fetchRssArticles } from "@/lib/rss";
import type { TrendSource } from "@/config/trendSources";
import type { TrendSourceType } from "@/types/trendSource";

export const runtime = "nodejs";

type TestRequest = {
  category?: string;
  consecutiveFailures?: number;
  rssUrl?: string | null;
  title?: string;
  url?: string;
  sourceType?: TrendSourceType;
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as TestRequest;
  const title = body.title?.trim() || "取得元";
  const url = body.url?.trim() ?? "";
  const sourceType = body.sourceType ?? "RSS";

  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: "URL形式を確認してください。" },
      { status: 400 },
    );
  }

  const source: TrendSource = {
    categoryHint: body.category?.trim() || "髪質改善",
    enabled: true,
    failureCount: Math.max(0, body.consecutiveFailures ?? 0),
    name: title,
    note: "取得テスト",
    priority: "high",
    rssUrl: body.rssUrl?.trim() || undefined,
    sourceType,
    type: body.rssUrl || sourceType === "RSS" ? "rss" : "manual-url",
    url,
  };
  const result = await fetchRssArticles([source]);
  const sourceResult = result.sourceResults[0];

  if (result.articles.length === 0) {
    return NextResponse.json({
      message:
        "公開RSSを確認できませんでした。HTML本文は取得せず、手動参照URLとして残します。",
      rssUrl: sourceResult?.rssUrl ?? null,
      rssStatus: sourceResult?.status ?? "unavailable",
      sampleCount: 0,
      samples: [],
      warnings: result.errors,
      consecutiveFailures:
        sourceResult?.consecutiveFailures ??
        Math.max(0, body.consecutiveFailures ?? 0) + 1,
    });
  }

  return NextResponse.json({
    message: `公開RSSを確認できました。1回の取得は最大5記事です。`,
    rssUrl: sourceResult?.rssUrl ?? null,
    rssStatus: sourceResult?.status ?? "available",
    sampleCount: result.articles.length,
    samples: result.articles.slice(0, 3),
    warnings: result.errors,
    consecutiveFailures: 0,
  });
}
