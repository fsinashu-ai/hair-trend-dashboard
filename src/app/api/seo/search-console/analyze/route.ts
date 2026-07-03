import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { GeminiServiceError } from "@/lib/ai/server";
import { dummyBlogPosts } from "@/data/dummyBlogPosts";
import { dummySeoKeywords } from "@/data/seoAds";
import { searchConsoleMockAnalysis } from "@/data/searchConsole";
import { generateSearchConsoleAnalysis } from "@/lib/searchConsole/analysis.server";
import {
  compareSearchConsolePeriods,
  createSearchConsoleBasicAnalysis,
  summarizeSearchConsoleRows,
} from "@/lib/searchConsole/metrics";
import {
  fetchSearchConsoleImports,
  fetchSearchConsoleRows,
  findReusableSearchConsoleAnalysis,
  saveSearchConsoleAnalysis,
} from "@/lib/supabase/searchConsole.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type {
  SearchConsoleImport,
  SearchConsoleRow,
} from "@/types/searchConsole";

export const runtime = "nodejs";

type AnalyzeRequest = {
  importId?: string;
  currentImport?: SearchConsoleImport;
  rows?: SearchConsoleRow[];
  previousRows?: SearchConsoleRow[];
};

const responseCache = new Map<string, { expiresAt: number; analysis: typeof searchConsoleMockAnalysis }>();

function safeRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is SearchConsoleRow => Boolean(row && typeof row === "object"))
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
      const imports = (await fetchSearchConsoleImports()) ?? [];
      currentImport = imports.find((item) => item.id === importId);
      const previous = currentImport
        ? imports.find(
            (item) =>
              item.id !== currentImport?.id &&
              item.importType === currentImport?.importType &&
              item.periodEnd < currentImport.periodEnd,
          )
        : undefined;
      const rowGroups =
        (await fetchSearchConsoleRows(
          [currentImport?.id, previous?.id].filter(
            (value): value is string => Boolean(value),
          ),
        )) ?? {};
      rows = currentImport ? rowGroups[currentImport.id] ?? [] : [];
      previousRows = previous ? rowGroups[previous.id] ?? [] : [];
    }

    if (!currentImport || rows.length === 0) {
      return NextResponse.json(
        { error: "分析するSearch Consoleデータがありません。" },
        { status: 400 },
      );
    }

    const metrics = summarizeSearchConsoleRows(rows);
    const comparison = compareSearchConsolePeriods(
      rows,
      previousRows,
      currentImport.comparisonLabel || "前回期間",
    );
    const basic = createSearchConsoleBasicAnalysis(rows, previousRows);
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
      const reusable = await findReusableSearchConsoleAnalysis(importId, inputHash);
      if (reusable) {
        return NextResponse.json({ analysis: reusable, basic, comparison, metrics, reused: true });
      }
    } else {
      const cached = responseCache.get(inputHash);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json({ analysis: cached.analysis, basic, comparison, metrics, reused: true });
      }
    }

    let analysis;
    let fallbackCode = "";
    try {
      analysis = await generateSearchConsoleAnalysis({
        basic,
        blogSummaries: dummyBlogPosts.slice(0, 12).map((post) => ({
          excerpt: post.excerpt,
          targetKeyword: post.targetKeyword,
          title: post.title,
        })),
        comparison,
        metrics,
        periodLabel: `${currentImport.periodStart}〜${currentImport.periodEnd}`,
        seoKeywords: dummySeoKeywords.map((item) => ({
          intent: item.intent,
          keyword: item.keyword,
          targetPage: item.targetPage,
        })),
      });
    } catch (error) {
      fallbackCode =
        error instanceof GeminiServiceError ? error.code : "analysis_failed";
      console.warn("[search-console] Gemini fallback", {
        errorType: fallbackCode,
      });
      analysis = { ...searchConsoleMockAnalysis, analyzedAt: new Date().toISOString() };
    }

    responseCache.set(inputHash, {
      analysis,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    if (isServerSupabaseConfigured() && importId) {
      await saveSearchConsoleAnalysis({
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
    console.error("[search-console] analysis failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "SEO分析を完了できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
