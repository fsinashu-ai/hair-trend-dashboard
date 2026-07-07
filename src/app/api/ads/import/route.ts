import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { adCsvConfig } from "@/config/adCsv";
import { parseAdCsv } from "@/lib/ads/adCsv";
import {
  fetchAdCsvImports,
  fetchAdCsvRows,
  saveAdCsvImport,
} from "@/lib/supabase/adCsv.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { AdCsvImportType, AdCsvPlatform } from "@/types/adCsv";

export const runtime = "nodejs";

const allowedPlatforms: AdCsvPlatform[] = [
  "google",
  "meta",
  "instagram",
  "facebook",
  "line",
  "other",
];

const allowedTypes: AdCsvImportType[] = [
  "campaign",
  "ad_group",
  "ad",
  "keyword",
  "search_term",
  "daily",
  "unknown",
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

function decodeCsv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("shift_jis", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("CSVの文字コードを読み取れませんでした。UTF-8、UTF-8 BOM付き、またはShift_JISのCSVを選んでください。");
    }
  }
}

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ imports: [], rowsByImport: {}, storageMode: "local" });
  }

  try {
    const imports = (await fetchAdCsvImports()) ?? [];
    const url = new URL(request.url);
    const requestedId = url.searchParams.get("importId");
    const selected = requestedId
      ? imports.find((item) => item.id === requestedId)
      : imports[0];
    const previous = selected
      ? imports.find(
          (item) =>
            item.id !== selected.id &&
            item.platform === selected.platform &&
            item.importType === selected.importType &&
            item.periodEnd < selected.periodEnd,
        )
      : undefined;
    const rowImportIds = [selected?.id, previous?.id].filter(
      (value): value is string => Boolean(value),
    );
    const rowsByImport = await fetchAdCsvRows(rowImportIds);

    return NextResponse.json({
      imports,
      rowsByImport: rowsByImport ?? {},
      storageMode: "supabase",
    });
  } catch (error) {
    console.error("[ad-csv] history load failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告CSV履歴を読み込めませんでした。Supabaseのテーブル設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const action = formText(formData, "action", 20) === "import" ? "import" : "preview";
    const platformValue = formText(formData, "platform", 30);
    const importTypeValue = formText(formData, "importType", 30);
    const platform = allowedPlatforms.includes(platformValue as AdCsvPlatform)
      ? (platformValue as AdCsvPlatform)
      : "other";
    const requestedType = allowedTypes.includes(importTypeValue as AdCsvImportType)
      ? (importTypeValue as AdCsvImportType)
      : "unknown";
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
    if (file.size > adCsvConfig.maxFileBytes) {
      return NextResponse.json({ error: "CSVファイルは5MB以内にしてください。" }, { status: 413 });
    }
    if (!validateDate(periodStart) || !validateDate(periodEnd) || !validateReportMonth(reportMonth)) {
      return NextResponse.json({ error: "開始日、終了日、集計月を入力してください。" }, { status: 400 });
    }
    if (periodEnd < periodStart) {
      return NextResponse.json({ error: "終了日は開始日以降にしてください。" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const contentHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    const csvText = decodeCsv(buffer);
    const preview = parseAdCsv({
      contentHash,
      csvText,
      fileName: file.name,
      includeRows: action === "import",
      platform,
      requestedType,
    });

    if (preview.validRowCount === 0) {
      return NextResponse.json(
        { error: "取り込める正常行がありません。列名と数値を確認してください。", preview },
        { status: 422 },
      );
    }

    if (action === "preview") {
      return NextResponse.json({
        preview,
        storageMode: isServerSupabaseConfigured() ? "supabase" : "local",
      });
    }

    if (!isServerSupabaseConfigured()) {
      return NextResponse.json({
        item: null,
        preview,
        storageMode: "local",
      });
    }

    const result = await saveAdCsvImport(preview, {
      comparisonLabel,
      importType: preview.detectedType,
      memo,
      periodEnd,
      periodStart,
      platform,
      reportMonth,
    });

    if (result?.duplicate) {
      return NextResponse.json(
        {
          duplicate: result.duplicate,
          error: "同じ内容・期間・媒体・種別の広告CSVがすでに登録されています。既存データは変更していません。",
          preview,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ item: result?.item, preview, storageMode: "supabase" });
  } catch (error) {
    console.error("[ad-csv] import failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "広告CSVを処理できませんでした。" },
      { status: 400 },
    );
  }
}
