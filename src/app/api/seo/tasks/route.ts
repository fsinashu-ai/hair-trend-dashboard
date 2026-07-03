import { NextResponse } from "next/server";
import { searchConsoleTaskTypes } from "@/config/searchConsole";
import {
  createSeoTaskFromSuggestion,
  fetchSeoTasks,
} from "@/lib/supabase/searchConsole.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { SearchConsoleTaskSuggestion } from "@/types/searchConsole";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ items: [], storageMode: "local" });
  }
  try {
    const importId = new URL(request.url).searchParams.get("importId") ?? undefined;
    return NextResponse.json({
      items: (await fetchSeoTasks(importId)) ?? [],
      storageMode: "supabase",
    });
  } catch {
    return NextResponse.json({ error: "SEOタスクを読み込めませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    dueDate?: string;
    importId?: string;
    suggestion?: Partial<SearchConsoleTaskSuggestion>;
  };
  const suggestion = body.suggestion;
  const importId = typeof body.importId === "string" ? body.importId.slice(0, 100) : "";

  if (!suggestion?.title || !importId) {
    return NextResponse.json({ error: "登録するSEOタスクを確認してください。" }, { status: 400 });
  }

  const taskType = searchConsoleTaskTypes.includes(
    suggestion.taskType as (typeof searchConsoleTaskTypes)[number],
  )
    ? String(suggestion.taskType)
    : "technical_check";
  const normalized: SearchConsoleTaskSuggestion = {
    keyword: String(suggestion.keyword ?? "").trim().slice(0, 120),
    pageUrl: String(suggestion.pageUrl ?? "").trim().slice(0, 500),
    priority:
      suggestion.priority === "high" || suggestion.priority === "low"
        ? suggestion.priority
        : "medium",
    reason: String(suggestion.reason ?? "").trim().slice(0, 1000),
    taskType,
    title: String(suggestion.title).trim().slice(0, 160),
  };

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ storageMode: "local", task: normalized });
  }

  try {
    const result = await createSeoTaskFromSuggestion({
      dueDate:
        typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
          ? body.dueDate
          : "",
      importId,
      suggestion: normalized,
    });
    return NextResponse.json({ duplicate: result?.duplicate ?? false, storageMode: "supabase" });
  } catch (error) {
    console.error("[seo-task] save failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "SEOタスクを保存できませんでした。" }, { status: 500 });
  }
}
