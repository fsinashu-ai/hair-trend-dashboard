import { NextResponse } from "next/server";
import {
  fetchGoogleAdsReport,
  getGoogleAdsConfigStatus,
} from "@/lib/ads/googleAds.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { AdCsvImportType } from "@/types/adCsv";

export const runtime = "nodejs";

const allowedTypes: AdCsvImportType[] = [
  "campaign",
  "ad_group",
  "ad",
  "keyword",
  "search_term",
  "daily",
];

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  return NextResponse.json({
    googleAds: getGoogleAdsConfigStatus(),
    storageMode: isServerSupabaseConfigured() ? "supabase" : "local",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const importTypeValue = safeString(body.importType, 30);
    const importType = allowedTypes.includes(importTypeValue as AdCsvImportType)
      ? (importTypeValue as AdCsvImportType)
      : "campaign";
    const periodStart = safeString(body.periodStart, 10);
    const periodEnd = safeString(body.periodEnd, 10);
    const reportMonth = safeString(body.reportMonth, 10);
    const comparisonLabel = safeString(body.comparisonLabel, 100);
    const memo = safeString(body.memo, 1000);

    const result = await fetchGoogleAdsReport({
      comparisonLabel,
      importType,
      memo,
      periodEnd,
      periodStart,
      reportMonth,
    });

    if (result.preview.validRowCount === 0) {
      return NextResponse.json({
        item: null,
        message: "Google広告APIから該当期間のデータは取得できましたが、行は0件でした。",
        preview: result.preview,
        storageMode: isServerSupabaseConfigured() ? "supabase" : "local",
      });
    }

    if (!isServerSupabaseConfigured()) {
      return NextResponse.json({
        item: null,
        preview: result.preview,
        storageMode: "local",
      });
    }

    const saved = await result.save();
    if (saved?.duplicate) {
      return NextResponse.json(
        {
          duplicate: saved.duplicate,
          error: "同じ期間・種別・内容のGoogle広告API取得データがすでに保存されています。既存データは変更していません。",
          preview: result.preview,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      item: saved?.item,
      preview: result.preview,
      storageMode: "supabase",
    });
  } catch (error) {
    console.error("[google-ads] fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Google広告APIの取得に失敗しました。",
      },
      { status: 400 },
    );
  }
}
