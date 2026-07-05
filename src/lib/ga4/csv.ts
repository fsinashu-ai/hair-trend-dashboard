import Papa from "papaparse";
import { ga4Config } from "@/config/ga4";
import { summarizeGa4Rows } from "@/lib/ga4/metrics";
import type { Ga4CsvIssue, Ga4CsvPreview, Ga4Row } from "@/types/ga4";

const columnAliases = {
  averageEngagementSeconds: [
    "平均エンゲージメント時間",
    "ユーザーあたりの平均エンゲージメント時間",
    "average engagement time",
    "average engagement time per session",
  ],
  channelGroup: [
    "セッションのデフォルト チャネル グループ",
    "デフォルト チャネル グループ",
    "session default channel group",
    "default channel group",
  ],
  conversions: ["キーイベント", "コンバージョン", "key events", "conversions"],
  date: ["日付", "date"],
  deviceCategory: ["デバイス カテゴリ", "device category"],
  engagementRate: ["エンゲージメント率", "engagement rate"],
  eventName: ["イベント名", "event name"],
  landingPage: [
    "ランディング ページ + クエリ文字列",
    "ランディング ページ",
    "landing page + query string",
    "landing page",
    "ページパスとスクリーン クラス",
    "page path and screen class",
  ],
  lineClicks: ["lineクリック", "line クリック", "line_click", "line clicks"],
  pageTitle: ["ページ タイトル", "ページタイトル", "page title"],
  reservationClicks: [
    "予約クリック",
    "予約ボタンクリック",
    "reservation_click",
    "reservation clicks",
  ],
  sessions: ["セッション", "sessions"],
  sourceMedium: [
    "セッションの参照元 / メディア",
    "参照元 / メディア",
    "session source / medium",
    "source / medium",
  ],
  users: ["ユーザー", "アクティブ ユーザー", "users", "active users"],
  views: ["表示回数", "閲覧数", "views", "screen page views"],
} as const;

type CanonicalColumn = keyof typeof columnAliases;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function createColumnMap(headers: string[]) {
  return Object.fromEntries(
    Object.entries(columnAliases).map(([key, aliases]) => [
      key,
      findColumn(headers, aliases),
    ]),
  ) as Record<CanonicalColumn, string | undefined>;
}

function parseNonNegativeNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseRatio(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return 0;
  const hasPercent = text.endsWith("%");
  const number = Number(text.replace(/%$/, "").trim());
  if (!Number.isFinite(number) || number < 0) return 0;
  return hasPercent || number > 1 ? number / 100 : number;
}

function parseDurationSeconds(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d+:\d{2}:\d{2}$/.test(text)) {
    const [hours, minutes, seconds] = text.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (/^\d+:\d{2}$/.test(text)) {
    const [minutes, seconds] = text.split(":").map(Number);
    return minutes * 60 + seconds;
  }
  const normalized = text.replace(/秒/g, "").replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseDate(value: string) {
  const normalized = value.trim().replace(/\//g, "-");
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized) ? normalized : "";
}

function toSafeFileName(value: string) {
  const leafName = value.split(/[\\/]/).pop() ?? "ga4.csv";
  return leafName.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 200);
}

function get(record: Record<string, string>, column: string | undefined) {
  return column ? String(record[column] ?? "").trim() : "";
}

function inferEventClicks(eventName: string, conversions: number) {
  const normalized = eventName.toLowerCase();
  return {
    lineClicks:
      normalized.includes("line") || normalized.includes("ライン")
        ? Math.max(conversions, 1)
        : 0,
    reservationClicks:
      normalized.includes("reserve") ||
      normalized.includes("reservation") ||
      normalized.includes("予約")
        ? Math.max(conversions, 1)
        : 0,
  };
}

export function parseGa4Csv({
  contentHash,
  csvText,
  fileName,
  includeRows = false,
}: {
  contentHash: string;
  csvText: string;
  fileName: string;
  includeRows?: boolean;
}): Ga4CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const sourceColumns = parsed.meta.fields ?? [];
  const columns = createColumnMap(sourceColumns);
  const issues: Ga4CsvIssue[] = parsed.errors.map((error) => ({
    message: error.message,
    rowNumber: (error.row ?? 0) + 2,
    severity: "error",
  }));
  const parserErrorRows = new Set(parsed.errors.map((error) => (error.row ?? 0) + 2));
  const hasDimension = Boolean(
    columns.landingPage ||
      columns.pageTitle ||
      columns.sourceMedium ||
      columns.channelGroup ||
      columns.eventName ||
      columns.date ||
      columns.deviceCategory,
  );
  const hasMetric = Boolean(
    columns.users ||
      columns.sessions ||
      columns.views ||
      columns.engagementRate ||
      columns.conversions,
  );

  if (!hasDimension) {
    throw new Error("GA4のディメンション列を認識できません。ページ、流入元、イベント名、日付などを含むCSVを選択してください。");
  }
  if (!hasMetric) {
    throw new Error("GA4の指標列を認識できません。ユーザー、セッション、表示回数、キーイベントなどを含むCSVを選択してください。");
  }

  const rows: Ga4Row[] = [];
  parsed.data.slice(0, ga4Config.maxImportRows).forEach((record, index) => {
    const rowNumber = index + 2;
    if (parserErrorRows.has(rowNumber)) return;

    const eventName = get(record, columns.eventName);
    const conversions = Math.round(parseNonNegativeNumber(get(record, columns.conversions)));
    const inferredClicks = inferEventClicks(eventName, conversions);
    const row: Ga4Row = {
      averageEngagementSeconds: parseDurationSeconds(
        get(record, columns.averageEngagementSeconds),
      ),
      channelGroup: get(record, columns.channelGroup),
      conversions,
      deviceCategory: get(record, columns.deviceCategory),
      engagementRate: parseRatio(get(record, columns.engagementRate)),
      eventName,
      landingPage: get(record, columns.landingPage),
      lineClicks:
        Math.round(parseNonNegativeNumber(get(record, columns.lineClicks))) ||
        inferredClicks.lineClicks,
      pageTitle: get(record, columns.pageTitle),
      recordDate: parseDate(get(record, columns.date)),
      reservationClicks:
        Math.round(parseNonNegativeNumber(get(record, columns.reservationClicks))) ||
        inferredClicks.reservationClicks,
      sessions: Math.round(parseNonNegativeNumber(get(record, columns.sessions))),
      sourceMedium: get(record, columns.sourceMedium),
      users: Math.round(parseNonNegativeNumber(get(record, columns.users))),
      views: Math.round(parseNonNegativeNumber(get(record, columns.views))),
    };

    const key =
      row.landingPage ||
      row.pageTitle ||
      row.sourceMedium ||
      row.channelGroup ||
      row.eventName ||
      row.recordDate ||
      row.deviceCategory;
    const metricTotal =
      row.users +
      row.sessions +
      row.views +
      row.lineClicks +
      row.reservationClicks +
      row.conversions;

    if (!key || metricTotal === 0) {
      issues.push({
        message: "対象値または指標が空のため除外しました",
        rowNumber,
        severity: "error",
      });
      return;
    }

    rows.push(row);
  });

  if (parsed.data.length > ga4Config.maxImportRows) {
    issues.push({
      message: `最大${ga4Config.maxImportRows.toLocaleString("ja-JP")}行まで取り込めます`,
      rowNumber: ga4Config.maxImportRows + 2,
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
    errorCount,
    excludedRowCount: parsed.data.length - rows.length,
    fileName: toSafeFileName(fileName),
    issues: issues.slice(0, 100),
    metrics: summarizeGa4Rows(rows),
    previewRows: rows.slice(0, ga4Config.previewRowLimit),
    recognizedColumns,
    rows: includeRows ? rows : undefined,
    sourceColumns,
    totalRowCount: parsed.data.length,
    validRowCount: rows.length,
    warningCount,
  };
}
