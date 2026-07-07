import { NextResponse } from "next/server";
import {
  checkAiQuality,
  sanitizeQualityCheckRequest,
} from "@/lib/quality/aiQualityCheck.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    const input = sanitizeQualityCheckRequest(body);

    if (!input.content.trim()) {
      return NextResponse.json(
        { error: "チェックする本文を入力してください。" },
        { status: 400 },
      );
    }

    const result = await checkAiQuality(input);

    return NextResponse.json({ result });
  } catch (error) {
    console.warn("[quality-check] failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });

    return NextResponse.json(
      { error: "AI品質チェックに失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
