import { createHash } from "node:crypto";
import { searchConsoleConfig } from "@/config/searchConsole";
import { getGoogleServiceAccountAccessToken, isGoogleServiceAccountConfigured } from "@/lib/google/serviceAccount.server";
import type { SearchConsoleCsvPreview, SearchConsoleImportType, SearchConsoleRow } from "@/types/searchConsole";

const searchConsoleScope = "https://www.googleapis.com/auth/webmasters.readonly";
const apiBaseUrl = "https://www.googleapis.com/webmasters/v3";
const searchType = "web";
const queryDimensions: Array<"query" | "page"> = ["query", "page"];

type SearchConsoleApiRow = {
  clicks?: number;
  ctr?: number;
  impressions?: number;
  keys?: string[];
  position?: number;
};

type SearchConsoleApiResponse = {
  rows?: SearchConsoleApiRow[];
};

export type SearchConsoleSiteEntry = {
  permissionLevel?: string;
  siteUrl: string;
};

export class SearchConsoleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason = "unknown",
  ) {
    super(message);
    this.name = "SearchConsoleApiError";
  }
}

function trimText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toFiniteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function apiErrorMessage(status: number) {
  if (status === 401) return "Google Search Console APIの認証に失敗しました。";
  if (status === 403) return "Search Consoleプロパティの閲覧権限がありません。";
  if (status === 404) return "Search Consoleプロパティが見つかりません。";
  if (status === 429) return "Search Console APIの利用上限に達しました。時間を空けて再実行してください。";
  if (status >= 500) return "Google Search Console APIが一時的に利用できません。";
  return "Search Console APIの取得に失敗しました。設定と対象期間を確認してください。";
}

function getApiSiteUrl() {
  return trimText(process.env.SEARCH_CONSOLE_SITE_URL, 500);
}

export function getSearchConsoleSiteUrl() {
  return getApiSiteUrl();
}

export function isSearchConsoleDataApiConfigured() {
  return Boolean(getApiSiteUrl() && isGoogleServiceAccountConfigured());
}

export function createDefaultSearchConsoleFetchRange(date = new Date()) {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const startDate = targetMonth.toISOString().slice(0, 10);
  const endDate = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  return { endDate, reportMonth: startDate.slice(0, 7), startDate };
}

export function validateSearchConsoleDateRange({ endDate, startDate }: { endDate: string; startDate: string }) {
  const normalizedStart = normalizeDate(startDate);
  const normalizedEnd = normalizeDate(endDate);
  if (!normalizedStart || !normalizedEnd) {
    return "Search Consoleの開始日と終了日はYYYY-MM-DD形式で指定してください。";
  }
  if (normalizedEnd < normalizedStart) {
    return "Search Consoleの終了日は開始日以降にしてください。";
  }
  return "";
}

async function requestJson<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: { errors?: Array<{ reason?: string }> };
  };

  if (response.ok) return json;

  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    return requestJson(url, init, attempt + 1);
  }

  throw new SearchConsoleApiError(
    apiErrorMessage(response.status),
    response.status,
    json.error?.errors?.[0]?.reason || "unknown",
  );
}

async function getSearchConsoleToken() {
  try {
    return await getGoogleServiceAccountAccessToken(searchConsoleScope);
  } catch {
    throw new SearchConsoleApiError(
      "Google Search Console APIの認証設定を確認してください。",
      401,
      "authentication",
    );
  }
}

export async function listAccessibleSearchConsoleSites() {
  const token = await getSearchConsoleToken();
  const response = await requestJson<{ siteEntry?: SearchConsoleSiteEntry[] }>(
    `${apiBaseUrl}/sites`,
    {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    },
  );
  return response.siteEntry ?? [];
}

async function fetchRows({
  dimension,
  endDate,
  startDate,
  token,
}: {
  dimension: "query" | "page";
  endDate: string;
  startDate: string;
  token: string;
}) {
  const siteUrl = getApiSiteUrl();
  if (!siteUrl) throw new SearchConsoleApiError("SEARCH_CONSOLE_SITE_URLが未設定です。", 400, "configuration");

  const url = `${apiBaseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const rows: SearchConsoleApiRow[] = [];
  const rowLimit = searchConsoleConfig.searchConsoleApiRowLimit;

  for (let page = 0; page < searchConsoleConfig.searchConsoleApiMaxPages; page += 1) {
    const response = await requestJson<SearchConsoleApiResponse>(url, {
      body: JSON.stringify({
        dataState: "final",
        dimensions: [dimension],
        endDate,
        rowLimit,
        startDate,
        startRow: page * rowLimit,
        type: searchType,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const pageRows = response.rows ?? [];
    rows.push(...pageRows);
    if (pageRows.length === 0) return rows;
  }

  throw new SearchConsoleApiError(
    "Search Console APIのページング上限に達しました。対象期間を短くして再実行してください。",
    413,
    "pagination_limit",
  );
}

function toSearchConsoleRows(apiRows: SearchConsoleApiRow[], dimension: "query" | "page") {
  const rows: SearchConsoleRow[] = [];
  const issues: SearchConsoleCsvPreview["issues"] = [];

  apiRows.forEach((apiRow, index) => {
    const key = trimText(apiRow.keys?.[0], 2_000);
    if (!key) {
      issues.push({
        message: "APIレスポンスに検索クエリまたはページURLがありません。",
        rowNumber: index + 1,
        severity: "warning",
      });
      return;
    }

    const metrics = {
      clicks: toFiniteNonNegative(apiRow.clicks),
      ctr: Math.min(toFiniteNonNegative(apiRow.ctr), 1),
      impressions: toFiniteNonNegative(apiRow.impressions),
      position: toFiniteNonNegative(apiRow.position),
    };
    rows.push({
      clicks: metrics.clicks,
      country: "",
      ctr: metrics.ctr,
      device: "",
      pageUrl: dimension === "page" ? key : "",
      position: metrics.position,
      query: dimension === "query" ? key : "",
      recordDate: "",
      rowType: dimension,
      impressions: metrics.impressions,
    });
  });

  return { issues, rows };
}

function summarizeRows(rows: SearchConsoleRow[]) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    averagePosition: impressions > 0 ? weightedPosition / impressions : 0,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    impressions,
    pageCount: rows.filter((row) => row.rowType === "page").length,
    queryCount: rows.filter((row) => row.rowType === "query").length,
  };
}

export async function fetchSearchConsoleApiPreview({
  dimension,
  endDate,
  startDate,
}: {
  dimension: "query" | "page";
  endDate: string;
  startDate: string;
}): Promise<SearchConsoleCsvPreview> {
  const rangeError = validateSearchConsoleDateRange({ endDate, startDate });
  if (rangeError) throw new SearchConsoleApiError(rangeError, 400, "invalid_range");
  if (!isSearchConsoleDataApiConfigured()) {
    throw new SearchConsoleApiError(
      "Search Console APIの環境変数を設定してください。",
      503,
      "configuration",
    );
  }

  const token = await getSearchConsoleToken();
  const apiRows = await fetchRows({ dimension, endDate, startDate, token });
  const converted = toSearchConsoleRows(apiRows, dimension);
  const rows = converted.rows;
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ dimension, endDate, rows, siteUrl: getApiSiteUrl(), startDate, type: searchType }))
    .digest("hex");
  const detectedType: SearchConsoleImportType = dimension;

  return {
    contentHash,
    detectedType,
    errorCount: 0,
    excludedRowCount: apiRows.length - rows.length,
    fileName: `search-console-api-${dimension}-${startDate}_${endDate}.json`,
    issues: converted.issues,
    metrics: summarizeRows(rows),
    previewRows: rows.slice(0, searchConsoleConfig.previewRowLimit),
    recognizedColumns: [dimension, "clicks", "impressions", "ctr", "position"],
    requestedType: dimension,
    rows,
    sourceColumns: ["keys[0]", "clicks", "impressions", "ctr", "position"],
    totalRowCount: apiRows.length,
    validRowCount: rows.length,
    warningCount: converted.issues.length,
  };
}

export async function fetchSearchConsoleApiPreviews({
  dimensions = queryDimensions,
  endDate,
  startDate,
}: {
  dimensions?: Array<"query" | "page">;
  endDate: string;
  startDate: string;
}) {
  const uniqueDimensions = [...new Set(dimensions)].filter((dimension) => queryDimensions.includes(dimension));
  if (uniqueDimensions.length === 0) {
    throw new SearchConsoleApiError("取得するSearch Consoleの種別を指定してください。", 400, "invalid_dimension");
  }
  return Promise.all(
    uniqueDimensions.map((dimension) => fetchSearchConsoleApiPreview({ dimension, endDate, startDate })),
  );
}
