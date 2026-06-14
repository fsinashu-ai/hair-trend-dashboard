import { NextResponse } from "next/server";
import {
  fetchSocialMetadata,
  SocialMetadataError,
} from "@/lib/social/metadata.server";

export const runtime = "nodejs";

type MetadataRequest = {
  url?: string;
  urls?: string[];
};

export async function POST(request: Request) {
  let body: MetadataRequest;

  try {
    body = (await request.json()) as MetadataRequest;
  } catch {
    return NextResponse.json(
      { error: "URL情報を読み取れませんでした。" },
      { status: 400 },
    );
  }

  const urls = Array.from(
    new Set(
      [...(body.urls ?? []), ...(body.url ? [body.url] : [])]
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  );

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "公開URLを入力してください。" },
      { status: 400 },
    );
  }

  if (urls.length > 10) {
    return NextResponse.json(
      { error: "1回に確認できるURLは最大10件です。" },
      { status: 400 },
    );
  }

  const results = [];

  for (const url of urls) {
    try {
      const metadata = await fetchSocialMetadata(url);
      results.push({ metadata, ok: true, url });
    } catch (error) {
      const message =
        error instanceof SocialMetadataError
          ? error.message
          : "メタデータを取得できませんでした。手動入力を利用してください。";
      const code =
        error instanceof SocialMetadataError ? error.code : "unavailable";

      results.push({ code, error: message, ok: false, url });
    }
  }

  return NextResponse.json({ results });
}

