import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { searchConsoleConfig } from "@/config/searchConsole";
import { parseSearchConsoleCsv } from "@/lib/searchConsole/csv";
import {
  fetchSearchConsoleAnalyses,
  fetchSearchConsoleImports,
  fetchSearchConsoleRows,
  saveSearchConsoleImport,
} from "@/lib/supabase/searchConsole.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { SearchConsoleImportType } from "@/types/searchConsole";

export const runtime = "nodejs";

const allowedTypes: SearchConsoleImportType[] = [
  "query",
  "page",
  "device",
  "country",
  "date",
];

function formText(formData: FormData, name: string, maxLength = 500) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateReportMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) || /^\d{4}-\d{2}-01$/.test(value);
}

function decodeUtf8(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error("UTF-8形式のCSVを選択してください。");
  }
}

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ analysesByImport: {}, imports: [], rowsByImport: {}, storageMode: "local" });
  }

  try {
    const imports = (await fetchSearchConsoleImports()) ?? [];
    const url = new URL(request.url);
    const requestedId = url.searchParams.get("importId");
    const selected = requestedId
      ? imports.find((item) => item.id === requestedId)
      : imports[0];
    const previous = selected
      ? imports.find(
          (item) =>
            item.id !== selected.id &&
            item.importType === selected.importType &&
            item.periodEnd < selected.periodEnd,
        )
      : undefined;
    const rowImportIds = [selected?.id, previous?.id].filter(
      (value): value is string => Boolean(value),
    );
    const [rowsByImport, analysesByImport] = await Promise.all([
      fetchSearchConsoleRows(rowImportIds),
      fetchSearchConsoleAnalyses(imports.map((item) => item.id)),
    ]);

    return NextResponse.json({
      analysesByImport: analysesByImport ?? {},
      imports,
      rowsByImport: rowsByImport ?? {},
      storageMode: "supabase",
    });
  } catch (error) {
    console.error("[search-console] history load failed", {
      message: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Search Console履歴を読み込めませんでした。Supabase設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const action = formText(formData, "action", 20) === "import" ? "import" : "preview";
    const requestedTypeValue = formText(formData, "importType", 20);
    const requestedType = allowedTypes.includes(requestedTypeValue as SearchConsoleImportType)
      ? (requestedTypeValue as SearchConsoleImportType)
      : "query";
    const periodStart = formText(formData, "periodStart", 10);
    const periodEnd = formText(formData, "periodEnd", 10);
    const reportMonth = formText(formData, "reportMonth", 10);
    const comparisonLabel = formText(formData, "comparisonLabel", 100);
    const memo = formText(formData, "memo", 1000);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "CSV形式のファイルだけ取り込めます。" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "空のCSVファイルは取り込めません。" }, { status: 400 });
    }
    if (file.size > searchConsoleConfig.maxFileBytes) {
      return NextResponse.json({ error: "CSVファイルは5MB以下にしてください。" }, { status: 413 });
    }
    if (
      !validateDate(periodStart) ||
      !validateDate(periodEnd) ||
      !validateReportMonth(reportMonth)
    ) {
      return NextResponse.json({ error: "開始日、終了日、集計月を入力してください。" }, { status: 400 });
    }
    if (periodEnd < periodStart) {
      return NextResponse.json({ error: "終了日は開始日以降にしてください。" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const contentHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    const csvText = decodeUtf8(buffer);
    const preview = parseSearchConsoleCsv({
      contentHash,
      csvText,
      fileName: file.name,
      includeRows: action === "import",
      requestedType,
    });

    if (preview.validRowCount === 0) {
      return NextResponse.json(
        { error: "取り込める正常行がありません。列名と数値を確認してください。", preview },
        { status: 422 },
      );
    }

    if (action === "preview") {
      return NextResponse.json({ preview, storageMode: isServerSupabaseConfigured() ? "supabase" : "local" });
    }

    if (!isServerSupabaseConfigured()) {
      return NextResponse.json({
        item: null,
        preview,
        storageMode: "local",
      });
    }

    const result = await saveSearchConsoleImport(preview, {
      comparisonLabel,
      memo,
      periodEnd,
      periodStart,
      reportMonth,
    });

    if (result?.duplicate) {
      return NextResponse.json(
        {
          duplicate: result.duplicate,
          error: "同じ内容・期間・種別のCSVがすでに登録されています。既存データは変更していません。",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ item: result?.item, preview, storageMode: "supabase" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSVを処理できませんでした。";
    console.error("[search-console] import failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

