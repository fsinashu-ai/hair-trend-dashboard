import { NextResponse } from "next/server";
import { fetchGoogleAdsReport } from "@/lib/ads/googleAds.server";
import { safeCompare } from "@/lib/security/appAccess.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";
export const maxDuration = 60;

function previousMonth(date = new Date()) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const periodStart = first.toISOString().slice(0, 10);
  return {
    periodStart,
    periodEnd: last.toISOString().slice(0, 10),
    reportMonth: periodStart.slice(0, 7),
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeCompare(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  const { periodStart, periodEnd, reportMonth } = previousMonth();
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, periodStart, periodEnd, rowCount: 0, saveStatus: "failed", warnings: ["保存先の設定がありません。"] },
      { status: 503 },
    );
  }

  let rowCount = 0;
  try {
    const result = await fetchGoogleAdsReport({
      comparisonLabel: "前月",
      importType: "campaign",
      memo: "月次CronでGoogle広告APIから取得",
      periodEnd,
      periodStart,
      reportMonth,
    });
    rowCount = result.preview.validRowCount;
    const warnings = result.preview.warningCount > 0 ? ["取得行数が上限に達した可能性があります。"] : [];
    if (rowCount === 0) {
      warnings.push("取得行数は0件でした。");
    }

    const saved = await result.save();
    if (!saved || !saved.version) throw new Error("Save unavailable");

    return NextResponse.json({
      ok: true,
      periodStart,
      periodEnd,
      rowCount,
      saveStatus: saved.version,
      warnings,
    });
  } catch {
    console.error("[google-ads-monthly-fetch] failed");
    return NextResponse.json(
      { ok: false, periodStart, periodEnd, rowCount, saveStatus: "failed", warnings: ["Google広告の取得または保存に失敗しました。"] },
      { status: 500 },
    );
  }
}
