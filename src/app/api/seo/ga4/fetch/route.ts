import { NextResponse } from "next/server";
import {
  createDefaultGa4FetchRange,
  fetchGa4DataApiPreview,
  validateGa4DateRange,
} from "@/lib/ga4/dataApi.server";
import { saveGa4Import } from "@/lib/supabase/ga4.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import { isAppRequestAuthorized } from "@/lib/security/appAccess.server";

export const runtime = "nodejs";
export const maxDuration = 60;

type FetchBody = {
  comparisonLabel?: string;
  endDate?: string;
  memo?: string;
  propertyName?: string;
  reportMonth?: string;
  startDate?: string;
};

function cronSecretMatches(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function isCronRequestAuthorized(request: Request) {
  return cronSecretMatches(request);
}

function isManualRequestAuthorized(request: Request) {
  return cronSecretMatches(request) || isAppRequestAuthorized(request);
}

function trimText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function createRangeFromBody(body: FetchBody) {
  const defaults = createDefaultGa4FetchRange();
  return {
    endDate: trimText(body.endDate, 10) || defaults.endDate,
    reportMonth: trimText(body.reportMonth, 7) || defaults.reportMonth,
    startDate: trimText(body.startDate, 10) || defaults.startDate,
  };
}

async function runFetch({
  comparisonLabel,
  dateRange,
  memo,
  propertyName,
}: {
  comparisonLabel: string;
  dateRange: ReturnType<typeof createDefaultGa4FetchRange>;
  memo: string;
  propertyName: string;
}) {
  const rangeError = validateGa4DateRange(dateRange);

  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const preview = await fetchGa4DataApiPreview(dateRange);

  if (preview.validRowCount === 0) {
    return NextResponse.json(
      {
        error: "GA4 Data APIから取り込める行がありませんでした。期間とGA4権限を確認してください。",
        preview,
      },
      { status: 422 },
    );
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({
      item: null,
      preview,
      storageMode: "local",
    });
  }

  const result = await saveGa4Import(preview, {
    comparisonLabel,
    memo,
    periodEnd: dateRange.endDate,
    periodStart: dateRange.startDate,
    propertyName,
    reportMonth: dateRange.reportMonth,
  });

  if (result?.duplicate) {
    return NextResponse.json(
      {
        duplicate: result.duplicate,
        error: "同じ内容・期間のGA4 APIデータがすでに登録されています。既存データは変更していません。",
        preview,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    item: result?.item ?? null,
    preview,
    storageMode: "supabase",
  });
}

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const dateRange = createDefaultGa4FetchRange();

    return await runFetch({
      comparisonLabel: "前月",
      dateRange,
      memo: "Vercel CronでGA4 Data APIから自動取得しました。",
      propertyName: "ef-mayke-s.com",
    });
  } catch (error) {
    console.error("[ga4-data-api] cron fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GA4 Data APIの自動取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isManualRequestAuthorized(request)) {
    return NextResponse.json({ error: "アプリのパスワード認証が必要です。" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as FetchBody;
    const dateRange = createRangeFromBody(body);

    return await runFetch({
      comparisonLabel: trimText(body.comparisonLabel, 100) || "前月",
      dateRange,
      memo: trimText(body.memo, 1000) || "GA4 Data APIから手動取得しました。",
      propertyName: trimText(body.propertyName, 100) || "ef-mayke-s.com",
    });
  } catch (error) {
    console.error("[ga4-data-api] manual fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GA4 Data APIの取得に失敗しました。",
      },
      { status: 400 },
    );
  }
}
