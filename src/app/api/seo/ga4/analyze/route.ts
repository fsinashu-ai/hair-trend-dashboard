import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { GeminiServiceError } from "@/lib/ai/server";
import { ga4MockAnalysis } from "@/data/ga4";
import { generateGa4Analysis } from "@/lib/ga4/analysis.server";
import {
  compareGa4Periods,
  createGa4BasicAnalysis,
  summarizeGa4Rows,
} from "@/lib/ga4/metrics";
import {
  fetchGa4Imports,
  fetchGa4Rows,
  findReusableGa4Analysis,
  saveGa4Analysis,
} from "@/lib/supabase/ga4.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { Ga4Analysis, Ga4Import, Ga4Row } from "@/types/ga4";

export const runtime = "nodejs";

type AnalyzeRequest = {
  importId?: string;
  currentImport?: Ga4Import;
  rows?: Ga4Row[];
  previousRows?: Ga4Row[];
};

const responseCache = new Map<string, { expiresAt: number; analysis: Ga4Analysis }>();

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
    let previousRows = safeRows(body.previousRows);

    if (isServerSupabaseConfigured() && importId) {
      const imports = (await fetchGa4Imports()) ?? [];
      currentImport = imports.find((item) => item.id === importId);
      const activeImport = currentImport;
      const previous = activeImport
        ? imports.find(
            (item) =>
              item.id !== activeImport.id &&
              item.periodEnd < activeImport.periodEnd,
          )
        : undefined;
      const rowGroups =
        (await fetchGa4Rows(
          [currentImport?.id, previous?.id].filter(
            (value): value is string => Boolean(value),
          ),
        )) ?? {};
      rows = currentImport ? rowGroups[currentImport.id] ?? [] : [];
      previousRows = previous ? rowGroups[previous.id] ?? [] : [];
    }

    if (!currentImport || rows.length === 0) {
      return NextResponse.json(
        { error: "分析するGA4データがありません。" },
        { status: 400 },
      );
    }

    const metrics = summarizeGa4Rows(rows);
    const comparison = compareGa4Periods(
      rows,
      previousRows,
      currentImport.comparisonLabel || "前回期間",
    );
    const basic = createGa4BasicAnalysis(rows);
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          basic,
          contentHash: currentImport.contentHash,
          metrics,
          previousCount: previousRows.length,
        }),
      )
      .digest("hex");

    if (isServerSupabaseConfigured() && importId) {
      const reusable = await findReusableGa4Analysis(importId, inputHash);
      if (reusable) {
        return NextResponse.json({ analysis: reusable, basic, comparison, metrics, reused: true });
      }
    } else {
      const cached = responseCache.get(inputHash);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json({ analysis: cached.analysis, basic, comparison, metrics, reused: true });
      }
    }

    let analysis: Ga4Analysis;
    let fallbackCode = "";
    try {
      analysis = await generateGa4Analysis({
        basic,
        comparison,
        metrics,
        periodLabel: `${currentImport.periodStart}〜${currentImport.periodEnd}`,
      });
    } catch (error) {
      fallbackCode =
        error instanceof GeminiServiceError ? error.code : "analysis_failed";
      console.warn("[ga4] Gemini fallback", { errorType: fallbackCode });
      analysis = { ...ga4MockAnalysis, analyzedAt: new Date().toISOString() };
    }

    responseCache.set(inputHash, {
      analysis,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    if (isServerSupabaseConfigured() && importId) {
      await saveGa4Analysis({
        analysis,
        comparison,
        importId,
        inputHash,
        metrics,
        reportMonth: currentImport.reportMonth,
      });
    }

    return NextResponse.json({
      analysis,
      basic,
      comparison,
      fallbackCode: fallbackCode || undefined,
      metrics,
      reused: false,
    });
  } catch (error) {
    console.error("[ga4] analysis failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "GA4分析を完了できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
