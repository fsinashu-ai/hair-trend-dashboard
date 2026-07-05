import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { GeminiServiceError } from "@/lib/ai/server";
import { conversionMockAnalysis } from "@/data/conversions";
import { generateConversionAnalysis } from "@/lib/conversions/analysis.server";
import { createConversionOverview } from "@/lib/conversions/metrics";
import { fetchGa4Imports, fetchGa4Rows } from "@/lib/supabase/ga4.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { ConversionAnalysis } from "@/types/conversions";
import type { Ga4Import, Ga4Row } from "@/types/ga4";

export const runtime = "nodejs";

type AnalyzeRequest = {
  importId?: string;
  currentImport?: Ga4Import;
  rows?: Ga4Row[];
};

const responseCache = new Map<string, { expiresAt: number; analysis: ConversionAnalysis }>();

function safeRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Ga4Row => Boolean(row && typeof row === "object"))
    .slice(0, 20_000);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const importId = typeof body.importId === "string" ? body.importId.slice(0, 100) : "";

  try {
    let currentImport = body.currentImport;
    let rows = safeRows(body.rows);

    if (isServerSupabaseConfigured() && importId) {
      const imports = (await fetchGa4Imports()) ?? [];
      currentImport = imports.find((item) => item.id === importId);
      const rowGroups =
        (await fetchGa4Rows(currentImport?.id ? [currentImport.id] : [])) ?? {};
      rows = currentImport ? rowGroups[currentImport.id] ?? [] : [];
    }

    if (!currentImport || rows.length === 0) {
      return NextResponse.json(
        { error: "分析できるGA4データがありません。先にGA4 CSVを取り込んでください。" },
        { status: 400 },
      );
    }

    const overview = createConversionOverview(rows);
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          contentHash: currentImport.contentHash,
          metrics: overview.metrics,
          opportunities: overview.opportunities,
          topConverters: overview.topConverters.slice(0, 12).map((item) => item.key),
        }),
      )
      .digest("hex");

    const cached = responseCache.get(inputHash);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ analysis: cached.analysis, overview, reused: true });
    }

    let analysis: ConversionAnalysis;
    let fallbackCode = "";
    try {
      analysis = await generateConversionAnalysis({
        overview,
        periodLabel: `${currentImport.periodStart}〜${currentImport.periodEnd}`,
      });
    } catch (error) {
      fallbackCode =
        error instanceof GeminiServiceError ? error.code : "analysis_failed";
      console.warn("[conversions] Gemini fallback", { errorType: fallbackCode });
      analysis = { ...conversionMockAnalysis, analyzedAt: new Date().toISOString() };
    }

    responseCache.set(inputHash, {
      analysis,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return NextResponse.json({
      analysis,
      fallbackCode: fallbackCode || undefined,
      overview,
      reused: false,
    });
  } catch (error) {
    console.error("[conversions] analysis failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "コンバージョン分析を完了できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
