import Papa from "papaparse";
import { adCsvColumnAliases, adCsvConfig } from "@/config/adCsv";
import { summarizeAdCsvRows } from "@/lib/ads/adCsvAnalysis";
import type {
  AdCsvImportType,
  AdCsvIssue,
  AdCsvPlatform,
  AdCsvPreview,
  AdCsvRow,
} from "@/types/adCsv";

type CanonicalColumn = keyof typeof adCsvColumnAliases;
type ColumnMap = Record<CanonicalColumn, string | undefined>;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function createColumnMap(headers: string[]): ColumnMap {
  return Object.fromEntries(
    Object.entries(adCsvColumnAliases).map(([key, aliases]) => [
      key,
      findColumn(headers, aliases),
    ]),
  ) as ColumnMap;
}

function valueOf(record: Record<string, string>, column?: string) {
  return column ? String(record[column] ?? "").trim() : "";
}

function toSafeFileName(value: string) {
  const leafName = value.split(/[\\/]/).pop() ?? "ad-report.csv";
  return leafName.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 200);
}

function parseDate(value: string) {
  const text = value.trim().replace(/\//g, "-");
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseNumberLike(value: unknown, options: { allowPercent?: boolean; kind?: "money" | "count" | "ratio" } = {}) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "—") return 0;
  const hasPercent = raw.includes("%");
  const cleaned = raw
    .replace(/[¥￥円]/g, "")
    .replace(/\bJPY\b/gi, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();
  if (!cleaned) return 0;
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0) return null;
  if (options.kind === "ratio" || options.allowPercent) {
    if (hasPercent || number > 1) return number / 100;
    return number;
  }
  return number;
}

function parseMetric({
  column,
  kind,
  issues,
  label,
  record,
  rowNumber,
}: {
  column?: string;
  kind: "count" | "money" | "ratio";
  issues: string[];
  label: string;
  record: Record<string, string>;
  rowNumber: number;
}) {
  const raw = valueOf(record, column);
  const parsed = parseNumberLike(raw, { allowPercent: kind === "ratio", kind });
  if (parsed === null) {
    issues.push(`${label}を数値として読み取れませんでした（${rowNumber}行目）`);
    return 0;
  }
  return parsed;
}

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function detectImportType(headers: string[], requestedType: AdCsvImportType) {
  if (requestedType !== "unknown") return requestedType;
  const columns = createColumnMap(headers);
  if (columns.recordDate) return "daily";
  if (columns.searchTerm) return "search_term";
  if (columns.keyword) return "keyword";
  if (columns.adName) return "ad";
  if (columns.adGroupName) return "ad_group";
  if (columns.campaignName) return "campaign";
  return "unknown";
}

function createRow({
  columns,
  detectedType,
  issues,
  platform,
  record,
  rowNumber,
}: {
  columns: ColumnMap;
  detectedType: AdCsvImportType;
  issues: string[];
  platform: AdCsvPlatform;
  record: Record<string, string>;
  rowNumber: number;
}): AdCsvRow {
  const impressions = Math.round(parseMetric({ column: columns.impressions, issues, kind: "count", label: "表示回数", record, rowNumber }));
  const clicks = Math.round(parseMetric({ column: columns.clicks, issues, kind: "count", label: "クリック数", record, rowNumber }));
  const cost = parseMetric({ column: columns.cost, issues, kind: "money", label: "費用", record, rowNumber });
  const conversions = parseMetric({ column: columns.conversions, issues, kind: "count", label: "コンバージョン", record, rowNumber });
  const parsedCtr = parseMetric({ column: columns.ctr, issues, kind: "ratio", label: "CTR", record, rowNumber });
  const cpa = parseMetric({ column: columns.cpa, issues, kind: "money", label: "CPA", record, rowNumber });
  const cpc = parseMetric({ column: columns.cpc, issues, kind: "money", label: "CPC", record, rowNumber });
  const cpm = parseMetric({ column: columns.cpm, issues, kind: "money", label: "CPM", record, rowNumber });
  const reach = Math.round(parseMetric({ column: columns.reach, issues, kind: "count", label: "リーチ", record, rowNumber }));
  const linkClicks = Math.round(parseMetric({ column: columns.linkClicks, issues, kind: "count", label: "リンククリック", record, rowNumber }));
  const landingPageViews = Math.round(parseMetric({ column: columns.landingPageViews, issues, kind: "count", label: "ランディングページビュー", record, rowNumber }));
  const finalUrl = valueOf(record, columns.finalUrl);

  if (!isValidUrl(finalUrl)) {
    issues.push(`LP URLの形式が正しくありません（${rowNumber}行目）`);
  }

  return {
    adGroupName: valueOf(record, columns.adGroupName),
    adName: valueOf(record, columns.adName),
    area: valueOf(record, columns.area),
    campaignName: valueOf(record, columns.campaignName),
    clicks,
    conversions,
    cost,
    cpa: cpa || (conversions > 0 ? cost / conversions : 0),
    cpc: cpc || (clicks > 0 ? cost / clicks : 0),
    cpm: cpm || (impressions > 0 ? (cost / impressions) * 1000 : 0),
    ctr: parsedCtr || (impressions > 0 ? clicks / impressions : 0),
    device: valueOf(record, columns.device),
    finalUrl,
    impressions,
    keyword: valueOf(record, columns.keyword),
    landingPageViews,
    linkClicks,
    platform,
    rawData: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, String(value ?? "").slice(0, 1000)]),
    ),
    reach,
    recordDate: parseDate(valueOf(record, columns.recordDate)),
    rowType: detectedType,
    searchTerm: valueOf(record, columns.searchTerm),
    status: valueOf(record, columns.status),
  };
}

function hasSubject(row: AdCsvRow) {
  return Boolean(
    row.recordDate ||
      row.campaignName ||
      row.adGroupName ||
      row.adName ||
      row.keyword ||
      row.searchTerm,
  );
}

function hasRecognizedMetrics(columns: ColumnMap) {
  return Boolean(
    columns.impressions ||
      columns.clicks ||
      columns.ctr ||
      columns.cost ||
      columns.conversions ||
      columns.cpa ||
      columns.cpc ||
      columns.cpm,
  );
}

export function parseAdCsv({
  contentHash,
  csvText,
  fileName,
  includeRows = false,
  platform,
  requestedType,
}: {
  contentHash: string;
  csvText: string;
  fileName: string;
  includeRows?: boolean;
  platform: AdCsvPlatform;
  requestedType: AdCsvImportType;
}): AdCsvPreview {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const sourceColumns = parsed.meta.fields ?? [];
  const columns = createColumnMap(sourceColumns);
  const detectedType = detectImportType(sourceColumns, requestedType);
  const issues: AdCsvIssue[] = parsed.errors.map((error) => ({
    message: error.message,
    rowNumber: (error.row ?? 0) + 2,
    severity: "error",
  }));
  const parserErrorRows = new Set(parsed.errors.map((error) => (error.row ?? 0) + 2));

  if (sourceColumns.length === 0) {
    throw new Error("CSVの列名を読み取れませんでした。1行目に見出しがあるCSVを選んでください。");
  }
  if (!hasRecognizedMetrics(columns)) {
    throw new Error("表示回数、クリック数、CTR、費用、コンバージョンなどの広告指標列が見つかりません。");
  }
  if (![columns.campaignName, columns.adGroupName, columns.adName, columns.keyword, columns.searchTerm, columns.recordDate].some(Boolean)) {
    throw new Error("キャンペーン名、広告名、キーワード、検索語句、日付などの対象列が見つかりません。");
  }

  if (parsed.data.length > adCsvConfig.maxImportRows) {
    issues.push({
      message: `最大${adCsvConfig.maxImportRows.toLocaleString("ja-JP")}行まで取り込みます。超過分は除外しました。`,
      rowNumber: adCsvConfig.maxImportRows + 2,
      severity: "warning",
    });
  }

  const rows: AdCsvRow[] = [];

  parsed.data.slice(0, adCsvConfig.maxImportRows).forEach((record, index) => {
    const rowNumber = index + 2;
    if (parserErrorRows.has(rowNumber)) return;
    const rowIssues: string[] = [];
    const row = createRow({ columns, detectedType, issues: rowIssues, platform, record, rowNumber });

    if (!hasSubject(row)) rowIssues.push("キャンペーン名、広告名、キーワード、検索語句、日付のいずれかが必要です。");
    if (row.rowType === "daily" && !row.recordDate) rowIssues.push("日別データとして扱うには日付列が必要です。");

    if (rowIssues.length > 0) {
      issues.push({ message: rowIssues.join(" / "), rowNumber, severity: "error" });
      return;
    }

    rows.push(row);
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const recognizedColumns = Object.entries(columns)
    .filter((entry): entry is [CanonicalColumn, string] => Boolean(entry[1]))
    .map(([canonical, source]) => `${source} → ${canonical}`);

  return {
    contentHash,
    detectedType,
    errorCount,
    fileName: toSafeFileName(fileName),
    invalidRowCount: parsed.data.length - rows.length,
    issues: issues.slice(0, 150),
    metrics: summarizeAdCsvRows(rows),
    platform,
    previewRows: rows.slice(0, adCsvConfig.previewRowLimit),
    recognizedColumns,
    requestedType,
    rows: includeRows ? rows : undefined,
    sourceColumns,
    totalRowCount: parsed.data.length,
    validRowCount: rows.length,
    warningCount,
  };
}
