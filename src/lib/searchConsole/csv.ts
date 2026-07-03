import Papa from "papaparse";
import { searchConsoleConfig } from "@/config/searchConsole";
import { summarizeSearchConsoleRows } from "@/lib/searchConsole/metrics";
import type {
  SearchConsoleCsvIssue,
  SearchConsoleCsvPreview,
  SearchConsoleImportType,
  SearchConsoleRow,
} from "@/types/searchConsole";

const columnAliases = {
  query: ["上位のクエリ", "クエリ", "top queries", "query"],
  page: ["上位のページ", "ページ", "top pages", "page"],
  device: ["デバイス", "device"],
  country: ["国", "country"],
  date: ["日付", "date"],
  clicks: ["クリック数", "clicks"],
  impressions: ["表示回数", "impressions"],
  ctr: ["ctr"],
  position: ["掲載順位", "position"],
} as const;

type CanonicalColumn = keyof typeof columnAliases;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function parseNonNegativeNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseSearchConsoleCtr(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  const hasPercentSign = text.endsWith("%");
  const number = Number(text.replace(/%$/, "").replace(/,/g, "").trim());
  if (!Number.isFinite(number) || number < 0) return null;
  const ratio = hasPercentSign || number > 1 ? number / 100 : number;
  return ratio <= 1 ? ratio : null;
}

function parseRecordDate(value: string) {
  const normalized = value.trim().replace(/\//g, "-");
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized) ? normalized : "";
}

function isValidPageUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function detectImportType(headers: string[], requestedType: SearchConsoleImportType) {
  const order: SearchConsoleImportType[] = ["query", "page", "device", "country", "date"];
  const detected = order.find((type) => findColumn(headers, columnAliases[type]));
  return detected ?? requestedType;
}

function createColumnMap(headers: string[]) {
  return Object.fromEntries(
    Object.entries(columnAliases).map(([key, aliases]) => [
      key,
      findColumn(headers, aliases),
    ]),
  ) as Record<CanonicalColumn, string | undefined>;
}

function getSubjectColumn(
  type: SearchConsoleImportType,
  columns: Record<CanonicalColumn, string | undefined>,
) {
  return columns[type];
}

function toSafeFileName(value: string) {
  const leafName = value.split(/[\\/]/).pop() ?? "search-console.csv";
  return leafName.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 200);
}

export function escapeCsvFormula(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function parseSearchConsoleCsv({
  contentHash,
  csvText,
  fileName,
  requestedType,
  includeRows = false,
}: {
  contentHash: string;
  csvText: string;
  fileName: string;
  requestedType: SearchConsoleImportType;
  includeRows?: boolean;
}): SearchConsoleCsvPreview {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const sourceColumns = parsed.meta.fields ?? [];
  const detectedType = detectImportType(sourceColumns, requestedType);
  const columns = createColumnMap(sourceColumns);
  const subjectColumn = getSubjectColumn(detectedType, columns);
  const issues: SearchConsoleCsvIssue[] = parsed.errors.map((error) => ({
    message: error.message,
    rowNumber: (error.row ?? 0) + 2,
    severity: "error",
  }));
  const rowsWithParserErrors = new Set(
    parsed.errors.map((error) => (error.row ?? 0) + 2),
  );
  const requiredColumns = [subjectColumn, columns.clicks, columns.impressions, columns.ctr, columns.position];

  if (requiredColumns.some((column) => !column)) {
    const missing = [
      !subjectColumn ? "データ列" : "",
      !columns.clicks ? "クリック数" : "",
      !columns.impressions ? "表示回数" : "",
      !columns.ctr ? "CTR" : "",
      !columns.position ? "掲載順位" : "",
    ].filter(Boolean);
    throw new Error(`必須列が不足しています: ${missing.join("、")}`);
  }

  if (detectedType !== requestedType) {
    issues.push({
      message: `選択は「${requestedType}」ですが、CSVは「${detectedType}」として認識しました`,
      rowNumber: 1,
      severity: "warning",
    });
  }

  const rows: SearchConsoleRow[] = [];
  parsed.data.slice(0, searchConsoleConfig.maxImportRows).forEach((record, index) => {
    const rowNumber = index + 2;
    if (rowsWithParserErrors.has(rowNumber)) return;

    const subject = String(record[subjectColumn as string] ?? "").trim();
    const clicks = parseNonNegativeNumber(record[columns.clicks as string]);
    const impressions = parseNonNegativeNumber(record[columns.impressions as string]);
    const ctr = parseSearchConsoleCtr(record[columns.ctr as string]);
    const position = parseNonNegativeNumber(record[columns.position as string]);
    const rowErrors = [
      !subject ? "対象値が空です" : "",
      clicks === null ? "クリック数が数値ではありません" : "",
      impressions === null ? "表示回数が数値ではありません" : "",
      ctr === null ? "CTRを数値変換できません" : "",
      position === null ? "掲載順位を数値変換できません" : "",
      detectedType === "page" && subject && !isValidPageUrl(subject)
        ? "ページURLの形式が正しくありません"
        : "",
    ].filter(Boolean);

    if (rowErrors.length > 0) {
      issues.push({ message: rowErrors.join("、"), rowNumber, severity: "error" });
      return;
    }

    const row: SearchConsoleRow = {
      clicks: Math.round(clicks as number),
      country: detectedType === "country" ? subject : "",
      ctr: ctr as number,
      device: detectedType === "device" ? subject : "",
      impressions: Math.round(impressions as number),
      pageUrl: detectedType === "page" ? subject : "",
      position: position as number,
      query: detectedType === "query" ? subject : "",
      recordDate: detectedType === "date" ? parseRecordDate(subject) : "",
      rowType: detectedType,
    };

    if (detectedType === "date" && !row.recordDate) {
      issues.push({ message: "日付形式を認識できません", rowNumber, severity: "error" });
      return;
    }

    rows.push(row);
  });

  if (parsed.data.length > searchConsoleConfig.maxImportRows) {
    issues.push({
      message: `最大${searchConsoleConfig.maxImportRows.toLocaleString("ja-JP")}行まで取り込めます`,
      rowNumber: searchConsoleConfig.maxImportRows + 2,
      severity: "warning",
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const recognizedColumns = Object.entries(columns)
    .filter((entry): entry is [CanonicalColumn, string] => Boolean(entry[1]))
    .map(([canonical, source]) => `${source} → ${canonical}`);

  return {
    contentHash,
    detectedType,
    errorCount,
    excludedRowCount: parsed.data.length - rows.length,
    fileName: toSafeFileName(fileName),
    issues: issues.slice(0, 100),
    metrics: summarizeSearchConsoleRows(rows),
    previewRows: rows.slice(0, searchConsoleConfig.previewRowLimit),
    recognizedColumns,
    requestedType,
    rows: includeRows ? rows : undefined,
    sourceColumns,
    totalRowCount: parsed.data.length,
    validRowCount: rows.length,
    warningCount,
  };
}
