import Papa from "papaparse";
import { ga4Config } from "@/config/ga4";
import {
  classifyGa4Event,
  isAutomaticMeasurementEvent,
  lpLineEventName,
  lpLinePagePath,
} from "@/lib/ga4/events";
import { summarizeGa4Rows } from "@/lib/ga4/metrics";
import type { Ga4CsvIssue, Ga4CsvPreview, Ga4Row } from "@/types/ga4";

const columnAliases = {
  averageEngagementSeconds: [
    "平均エンゲージメント時間",
    "ユーザーあたりの平均エンゲージメント時間",
    "セッションあたりの平均エンゲージメント時間",
    "アクティブ ユーザーあたりの平均エンゲージメント時間",
    "average engagement time",
    "average engagement time per session",
  ],
  channelGroup: [
    "セッションのデフォルト チャネル グループ",
    "セッションのメインのチャネル グループ（デフォルト チャネル グループ）",
    "ユーザーの最初のメインのチャネル グループ（デフォルト チャネル グループ）",
    "デフォルト チャネル グループ",
    "session default channel group",
    "first user default channel group",
    "default channel group",
  ],
  conversions: ["キーイベント", "コンバージョン", "key events", "conversions"],
  date: ["日付", "date"],
  deviceCategory: ["デバイス カテゴリ", "device category"],
  engagementRate: ["エンゲージメント率", "engagement rate"],
  eventCount: ["イベント数", "event count"],
  eventName: ["イベント名", "event name"],
  isKeyEvent: ["キーイベントに指定", "キーイベントか", "is key event", "isKeyEvent"],
  landingPage: [
    "ランディング ページ + クエリ文字列",
    "ランディング ページ",
    "landing page + query string",
    "landing page",
  ],
  lineClicks: ["lineクリック", "line クリック", "line_click", "line clicks"],
  linkText: ["リンクテキスト", "link text", "linkText"],
  linkUrl: ["リンク先URL", "リンク URL", "link url", "linkUrl"],
  lpLineTaps: ["LINEタップ", "LINE_click_ad", "lp line taps"],
  pagePath: [
    "ページパスとスクリーン クラス",
    "統合されたページパスとスクリーン クラス",
    "page path and screen class",
    "unified page path screen",
    "unifiedPagePathScreen",
  ],
  pageTitle: ["ページ タイトル", "ページタイトル", "page title"],
  phoneTaps: ["電話タップ", "電話クリック", "phone taps", "phone clicks"],
  reservationClicks: [
    "予約クリック",
    "予約ボタンクリック",
    "reservation_click",
    "reservation clicks",
  ],
  sessions: ["セッション", "sessions"],
  sourceMedium: [
    "セッションの参照元 / メディア",
    "セッションの参照元",
    "セッションのメディア",
    "セッションのキャンペーン",
    "セッションの参照元プラットフォーム",
    "参照元 / メディア",
    "session source / medium",
    "session source",
    "session medium",
    "session campaign",
    "session source platform",
    "source / medium",
  ],
  users: [
    "ユーザー",
    "アクティブ ユーザー",
    "総ユーザー数",
    "新規ユーザー数",
    "users",
    "active users",
    "total users",
    "new users",
  ],
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

function parseBoolean(value: string) {
  return ["1", "true", "yes", "はい"].includes(value.trim().toLowerCase());
}

function toSafeFileName(value: string) {
  const leafName = value.split(/[\\/]/).pop() ?? "ga4.csv";
  return leafName.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 200);
}

function stripGa4ExportPreamble(csvText: string) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.replace(/^\uFEFF/, "").trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
  return headerIndex >= 0 ? lines.slice(headerIndex).join("\n") : csvText;
}

function get(record: Record<string, string>, column: string | undefined) {
  return column ? String(record[column] ?? "").trim() : "";
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
  const normalizedCsvText = stripGa4ExportPreamble(csvText);
  const parsed = Papa.parse<Record<string, string>>(normalizedCsvText, {
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
      columns.pagePath ||
      columns.linkUrl ||
      columns.date ||
      columns.deviceCategory,
  );
  const hasMetric = Boolean(
    columns.users ||
      columns.sessions ||
      columns.views ||
      columns.engagementRate ||
      columns.eventCount ||
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
    const reportedConversions = Math.round(
      parseNonNegativeNumber(get(record, columns.conversions)),
    );
    const eventCount = Math.round(
      parseNonNegativeNumber(get(record, columns.eventCount)),
    );
    const linkUrl = get(record, columns.linkUrl);
    const actionCount = Math.max(eventCount, reportedConversions);
    const inferredClicks = classifyGa4Event({
      eventCount: actionCount,
      eventName,
      linkUrl,
    });
    const explicitLineClicks = Math.round(
      parseNonNegativeNumber(get(record, columns.lineClicks)),
    );
    const explicitLpLineTaps = Math.round(
      parseNonNegativeNumber(get(record, columns.lpLineTaps)),
    );
    const conversions = isAutomaticMeasurementEvent(eventName)
      ? 0
      : reportedConversions;
    const row: Ga4Row = {
      averageEngagementSeconds: parseDurationSeconds(
        get(record, columns.averageEngagementSeconds),
      ),
      channelGroup: get(record, columns.channelGroup),
      conversions,
      deviceCategory: get(record, columns.deviceCategory),
      engagementRate: parseRatio(get(record, columns.engagementRate)),
      eventCount,
      eventName,
      isKeyEvent: parseBoolean(get(record, columns.isKeyEvent)),
      landingPage: get(record, columns.landingPage),
      lineClicks:
        inferredClicks.lineClicks ||
        (eventName && eventName !== "line_click" ? 0 : explicitLineClicks),
      linkText: get(record, columns.linkText),
      linkUrl,
      lpLineTaps:
        inferredClicks.lpLineTaps ||
        explicitLpLineTaps ||
        (eventName === lpLineEventName ? explicitLineClicks : 0),
      pagePath:
        get(record, columns.pagePath) ||
        (eventName === lpLineEventName ? lpLinePagePath : ""),
      pageTitle: get(record, columns.pageTitle),
      phoneTaps:
        Math.round(parseNonNegativeNumber(get(record, columns.phoneTaps))) ||
        inferredClicks.phoneTaps,
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
      row.pagePath ||
      row.linkUrl ||
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
      row.lpLineTaps +
      row.phoneTaps +
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
