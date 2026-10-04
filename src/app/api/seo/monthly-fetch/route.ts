import { NextResponse } from "next/server";
import {
  createDefaultGa4FetchRange,
  fetchGa4DataApiPreview,
  isGa4DataApiConfigured,
} from "@/lib/ga4/dataApi.server";
import {
  createDefaultSearchConsoleFetchRange,
  fetchSearchConsoleApiPreviews,
  getSearchConsoleSiteUrl,
  isSearchConsoleDataApiConfigured,
} from "@/lib/searchConsole/dataApi.server";
import { saveGa4Import } from "@/lib/supabase/ga4.server";
import { saveSearchConsoleImport } from "@/lib/supabase/searchConsole.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";
export const maxDuration = 60;

function cronSecretMatches(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function runGa4MonthlyFetch() {
  const dateRange = createDefaultGa4FetchRange();
  if (!isGa4DataApiConfigured()) return { status: "skipped", reason: "GA4 API未設定" } as const;

  const preview = await fetchGa4DataApiPreview(dateRange);
  if (preview.validRowCount === 0) return { status: "empty", rowCount: 0 } as const;

  const result = await saveGa4Import(preview, {
    comparisonLabel: "前月",
    memo: "月次CronでGA4 Data APIから取得",
    periodEnd: dateRange.endDate,
    periodStart: dateRange.startDate,
    propertyName: "ef-mayke-s.com",
    reportMonth: dateRange.reportMonth,
  });
  return {
    duplicate: Boolean(result?.duplicate),
    rowCount: preview.validRowCount,
    status: "saved",
  } as const;
}

async function runSearchConsoleMonthlyFetch() {
  const dateRange = createDefaultSearchConsoleFetchRange();
  if (!isSearchConsoleDataApiConfigured()) {
    return { status: "skipped", reason: "Search Console API未設定" } as const;
  }

  const previews = await fetchSearchConsoleApiPreviews({
    dimensions: ["query", "page"],
    endDate: dateRange.endDate,
    startDate: dateRange.startDate,
  });
  const results = [];
  for (const preview of previews) {
    if (preview.validRowCount === 0) {
      results.push({ rowCount: 0, status: "empty", type: preview.detectedType });
      continue;
    }
    const result = await saveSearchConsoleImport(preview, {
      comparisonLabel: "前月",
      memo: "月次CronでSearch Console APIから取得",
      periodEnd: dateRange.endDate,
      periodStart: dateRange.startDate,
      reportMonth: dateRange.reportMonth,
      searchType: "web",
      source: "search_console_api",
      sourceProperty: getSearchConsoleSiteUrl(),
    });
    results.push({
      duplicate: Boolean(result?.duplicate),
      rowCount: preview.validRowCount,
      status: "saved",
      type: preview.detectedType,
    });
  }
  return { results, status: "saved" } as const;
}

export async function GET(request: Request) {
  if (!cronSecretMatches(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "月次SEO取得にはSupabaseサーバー設定が必要です。" },
      { status: 503 },
    );
  }

  const [ga4Result, searchConsoleResult] = await Promise.allSettled([
    runGa4MonthlyFetch(),
    runSearchConsoleMonthlyFetch(),
  ]);
  const results = {
    ga4:
      ga4Result.status === "fulfilled"
        ? ga4Result.value
        : { error: ga4Result.reason instanceof Error ? ga4Result.reason.message : "GA4取得に失敗しました。", status: "failed" },
    searchConsole:
      searchConsoleResult.status === "fulfilled"
        ? searchConsoleResult.value
        : { error: searchConsoleResult.reason instanceof Error ? searchConsoleResult.reason.message : "Search Console取得に失敗しました。", status: "failed" },
  };
  const hasFailure = [ga4Result, searchConsoleResult].some((result) => result.status === "rejected");

  if (hasFailure) {
    console.error("[seo-monthly-fetch] one or more sources failed", {
      ga4: ga4Result.status,
      searchConsole: searchConsoleResult.status,
    });
  }
  return NextResponse.json({ ok: !hasFailure, results }, { status: hasFailure ? 500 : 200 });
}
