import { NextResponse } from "next/server";
import {
  createDefaultSearchConsoleFetchRange,
  fetchSearchConsoleApiPreviews,
  isSearchConsoleDataApiConfigured,
  SearchConsoleApiError,
  validateSearchConsoleDateRange,
} from "@/lib/searchConsole/dataApi.server";
import { saveSearchConsoleImport } from "@/lib/supabase/searchConsole.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import { isAppRequestAuthorized } from "@/lib/security/appAccess.server";

export const runtime = "nodejs";
export const maxDuration = 60;

type FetchBody = {
  comparisonLabel?: string;
  dimensions?: string[];
  endDate?: string;
  memo?: string;
  reportMonth?: string;
  startDate?: string;
};

function cronSecretMatches(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function isManualRequestAuthorized(request: Request) {
  return cronSecretMatches(request) || isAppRequestAuthorized(request);
}

function trimText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function createRangeFromBody(body: FetchBody) {
  const defaults = createDefaultSearchConsoleFetchRange();
  const startDate = trimText(body.startDate, 10) || defaults.startDate;
  const endDate = trimText(body.endDate, 10) || defaults.endDate;
  return {
    endDate,
    reportMonth: trimText(body.reportMonth, 7) || startDate.slice(0, 7),
    startDate,
  };
}

function getDimensions(body: FetchBody) {
  const allowed = new Set(["query", "page"]);
  const dimensions = Array.isArray(body.dimensions)
    ? body.dimensions.filter((value): value is "query" | "page" => allowed.has(value))
    : [];
  return dimensions.length > 0 ? [...new Set(dimensions)] : undefined;
}

function errorResponse(error: unknown, fallbackStatus = 500) {
  if (error instanceof SearchConsoleApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Search Console APIの取得に失敗しました。",
    },
    { status: fallbackStatus },
  );
}

async function runFetch(body: FetchBody) {
  const dateRange = createRangeFromBody(body);
  const rangeError = validateSearchConsoleDateRange(dateRange);
  if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });

  if (!isSearchConsoleDataApiConfigured()) {
    return NextResponse.json(
      { error: "Search Console APIのサイトURLとGoogleサービスアカウントを設定してください。" },
      { status: 503 },
    );
  }
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Search Console APIの自動取得にはSupabaseサーバー設定が必要です。" },
      { status: 503 },
    );
  }

  const previews = await fetchSearchConsoleApiPreviews({
    dimensions: getDimensions(body),
    endDate: dateRange.endDate,
    startDate: dateRange.startDate,
  });

  if (previews.some((preview) => preview.validRowCount === 0)) {
    return NextResponse.json(
      {
        error: "指定期間のSearch Console APIデータがありません。期間とプロパティを確認してください。",
        previews,
      },
      { status: 422 },
    );
  }

  const saved = [];
  for (const preview of previews) {
    const result = await saveSearchConsoleImport(preview, {
      comparisonLabel: trimText(body.comparisonLabel, 100) || "前月",
      memo: trimText(body.memo, 1_000) || "Search Console APIから取得",
      periodEnd: dateRange.endDate,
      periodStart: dateRange.startDate,
      reportMonth: dateRange.reportMonth,
      searchType: "web",
      source: "search_console_api",
      sourceProperty: process.env.SEARCH_CONSOLE_SITE_URL?.trim() || "",
    });
    saved.push({
      duplicate: Boolean(result?.duplicate),
      item: result?.item ?? null,
      rowCount: preview.validRowCount,
      type: preview.detectedType,
    });
  }

  return NextResponse.json({
    ok: true,
    periodEnd: dateRange.endDate,
    periodStart: dateRange.startDate,
    previews,
    results: saved,
    siteUrl: process.env.SEARCH_CONSOLE_SITE_URL?.trim() || "",
    storageMode: "supabase",
  });
}

export async function GET(request: Request) {
  if (!cronSecretMatches(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    return await runFetch({});
  } catch (error) {
    console.error("[search-console-api] cron fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      status: error instanceof SearchConsoleApiError ? error.status : undefined,
    });
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isManualRequestAuthorized(request)) {
    return NextResponse.json({ error: "アプリ認証が必要です。" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as FetchBody;
    return await runFetch(body);
  } catch (error) {
    console.error("[search-console-api] manual fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
      status: error instanceof SearchConsoleApiError ? error.status : undefined,
    });
    return errorResponse(error, 400);
  }
}
