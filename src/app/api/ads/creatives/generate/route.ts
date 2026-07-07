import { NextResponse } from "next/server";
import {
  generateAdCreative,
  sanitizeAdCreativeInput,
} from "@/lib/ads/adCreativeGenerator.server";
import { GeminiServiceError } from "@/lib/ai/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > 24_000) {
    return NextResponse.json(
      { error: "入力内容が長すぎます。メモや課題を短くして再度お試しください。" },
      { status: 413 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const input = sanitizeAdCreativeInput(body);

    if (!input.campaignName.trim()) {
      return NextResponse.json(
        { error: "キャンペーン名を入力してください。" },
        { status: 400 },
      );
    }

    const response = await generateAdCreative(input);
    return NextResponse.json(response);
  } catch (error) {
    const status =
      error instanceof GeminiServiceError && error.code === "input_too_long"
        ? 413
        : 500;
    console.error("[ad-creative] generate failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告案を生成できませんでした。入力内容を確認して再度お試しください。" },
      { status },
    );
  }
}
