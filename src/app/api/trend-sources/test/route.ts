import { NextResponse } from "next/server";
import { fetchRssArticles } from "@/lib/rss";
import type { TrendSource } from "@/config/trendSources";
import type { TrendSourceType } from "@/types/trendSource";

export const runtime = "nodejs";

type TestRequest = {
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

  if (sourceType !== "RSS") {
    return NextResponse.json({
      message:
        "URL形式は有効です。RSS以外の取得元は、HTMLスクレイピングを行わず手動登録URLとして扱います。",
      sampleCount: 0,
      samples: [],
    });
  }

  const source: TrendSource = {
    categoryHint: "髪質改善",
    enabled: true,
    name: title,
    note: "取得テスト",
    type: "rss",
    url,
  };
  const result = await fetchRssArticles([source]);

  if (result.articles.length === 0) {
    return NextResponse.json({
      message:
        "RSS記事を取得できませんでした。RSS URLか、サイト側の公開状態を確認してください。",
      sampleCount: 0,
      samples: [],
      warnings: result.errors,
    });
  }

  return NextResponse.json({
    message: "RSS記事を取得できました。",
    sampleCount: result.articles.length,
    samples: result.articles.slice(0, 3),
    warnings: result.errors,
  });
}
