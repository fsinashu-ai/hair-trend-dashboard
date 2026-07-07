import { createHash } from "node:crypto";
import { adCsvConfig } from "@/config/adCsv";
import { summarizeAdCsvRows } from "@/lib/ads/adCsvAnalysis";
import { saveAdCsvImport } from "@/lib/supabase/adCsv.server";
import type {
  AdCsvImportMetadata,
  AdCsvImportType,
  AdCsvPreview,
  AdCsvRow,
} from "@/types/adCsv";

type GoogleAdsConfig = {
  apiVersion: string;
  clientId: string;
  clientSecret: string;
  customerId: string;
  developerToken: string;
  loginCustomerId: string;
  refreshToken: string;
};

type GoogleAdsFetchInput = {
  importType: AdCsvImportType;
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
};

type GoogleAdsSearchStreamChunk = {
  results?: Array<Record<string, unknown>>;
};

const supportedReportTypes: AdCsvImportType[] = [
  "campaign",
  "ad_group",
  "ad",
  "keyword",
  "search_term",
  "daily",
];

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function normalizeCustomerId(value: string) {
  return value.replace(/\D/g, "");
}

function getGoogleAdsConfig(): GoogleAdsConfig {
  return {
    apiVersion: env("GOOGLE_ADS_API_VERSION") || "v24",
    clientId: env("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: env("GOOGLE_ADS_CLIENT_SECRET"),
    customerId: normalizeCustomerId(env("GOOGLE_ADS_CUSTOMER_ID")),
    developerToken: env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    loginCustomerId: normalizeCustomerId(env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
    refreshToken: env("GOOGLE_ADS_REFRESH_TOKEN"),
  };
}

export function getGoogleAdsConfigStatus() {
  const config = getGoogleAdsConfig();
  const missing = [
    !config.developerToken ? "GOOGLE_ADS_DEVELOPER_TOKEN" : "",
    !config.clientId ? "GOOGLE_ADS_CLIENT_ID" : "",
    !config.clientSecret ? "GOOGLE_ADS_CLIENT_SECRET" : "",
    !config.refreshToken ? "GOOGLE_ADS_REFRESH_TOKEN" : "",
    !config.customerId ? "GOOGLE_ADS_CUSTOMER_ID" : "",
  ].filter(Boolean);

  return {
    apiVersion: config.apiVersion,
    configured: missing.length === 0,
    customerIdSet: Boolean(config.customerId),
    loginCustomerIdSet: Boolean(config.loginCustomerId),
    missing,
  };
}

function validateDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateInput(input: GoogleAdsFetchInput) {
  if (!supportedReportTypes.includes(input.importType)) {
    throw new Error("Google広告APIで取得できる種別を選んでください。");
  }
  if (!validateDate(input.periodStart) || !validateDate(input.periodEnd)) {
    throw new Error("開始日と終了日を入力してください。");
  }
  if (input.periodEnd < input.periodStart) {
    throw new Error("終了日は開始日以降にしてください。");
  }
}

async function fetchAccessToken(config: GoogleAdsConfig) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Google広告APIのOAuth認証に失敗しました。client ID、client secret、refresh tokenを確認してください。");
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google広告APIのアクセストークンを取得できませんでした。");
  }
  return data.access_token;
}

function buildGoogleAdsQuery(input: GoogleAdsFetchInput) {
  const metrics = [
    "metrics.impressions",
    "metrics.clicks",
    "metrics.ctr",
    "metrics.cost_micros",
    "metrics.conversions",
    "metrics.average_cpc",
    "metrics.average_cpm",
  ];
  const period = `segments.date BETWEEN '${input.periodStart}' AND '${input.periodEnd}'`;
  const limit = adCsvConfig.maxImportRows;

  if (input.importType === "ad_group") {
    return `
      SELECT
        segments.date,
        campaign.name,
        ad_group.name,
        ad_group.status,
        ${metrics.join(",\n        ")}
      FROM ad_group
      WHERE ${period}
      ORDER BY segments.date DESC
      LIMIT ${limit}
    `;
  }

  if (input.importType === "ad") {
    return `
      SELECT
        segments.date,
        campaign.name,
        ad_group.name,
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ${metrics.join(",\n        ")}
      FROM ad_group_ad
      WHERE ${period}
      ORDER BY segments.date DESC
      LIMIT ${limit}
    `;
  }

  if (input.importType === "keyword") {
    return `
      SELECT
        segments.date,
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.status,
        ${metrics.join(",\n        ")}
      FROM keyword_view
      WHERE ${period}
      ORDER BY segments.date DESC
      LIMIT ${limit}
    `;
  }

  if (input.importType === "search_term") {
    return `
      SELECT
        segments.date,
        campaign.name,
        ad_group.name,
        search_term_view.search_term,
        ${metrics.join(",\n        ")}
      FROM search_term_view
      WHERE ${period}
      ORDER BY segments.date DESC
      LIMIT ${limit}
    `;
  }

  return `
    SELECT
      segments.date,
      campaign.name,
      campaign.status,
      ${metrics.join(",\n      ")}
    FROM campaign
    WHERE ${period}
    ORDER BY segments.date DESC
    LIMIT ${limit}
  `;
}

function nestedString(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return current === null || current === undefined ? "" : String(current);
}

function nestedNumber(source: Record<string, unknown>, path: string[]) {
  const value = nestedString(source, path);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function microsToCurrency(value: number) {
  return value > 0 ? value / 1_000_000 : 0;
}

function rowToAdCsvRow(row: Record<string, unknown>, rowType: AdCsvImportType): AdCsvRow {
  const campaignName = nestedString(row, ["campaign", "name"]);
  const adGroupName = nestedString(row, ["adGroup", "name"]);
  const adId = nestedString(row, ["adGroupAd", "ad", "id"]);
  const adName = nestedString(row, ["adGroupAd", "ad", "name"]) || (adId ? `Ad ${adId}` : "");
  const keyword = nestedString(row, ["adGroupCriterion", "keyword", "text"]);
  const searchTerm = nestedString(row, ["searchTermView", "searchTerm"]);
  const status =
    nestedString(row, ["adGroupAd", "status"]) ||
    nestedString(row, ["adGroupCriterion", "status"]) ||
    nestedString(row, ["adGroup", "status"]) ||
    nestedString(row, ["campaign", "status"]);
  const cost = microsToCurrency(nestedNumber(row, ["metrics", "costMicros"]));
  const clicks = nestedNumber(row, ["metrics", "clicks"]);
  const impressions = nestedNumber(row, ["metrics", "impressions"]);
  const conversions = nestedNumber(row, ["metrics", "conversions"]);
  const ctr = nestedNumber(row, ["metrics", "ctr"]) || (impressions > 0 ? clicks / impressions : 0);
  const cpc = microsToCurrency(nestedNumber(row, ["metrics", "averageCpc"])) || (clicks > 0 ? cost / clicks : 0);
  const cpm = microsToCurrency(nestedNumber(row, ["metrics", "averageCpm"])) || (impressions > 0 ? (cost / impressions) * 1000 : 0);
  const cpa = conversions > 0 ? cost / conversions : 0;

  return {
    adGroupName,
    adName,
    area: "",
    campaignName,
    clicks,
    conversions,
    cost,
    cpa,
    cpc,
    cpm,
    ctr,
    device: "",
    finalUrl: "",
    impressions,
    keyword,
    landingPageViews: 0,
    linkClicks: 0,
    platform: "google",
    rawData: Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const serialized = JSON.stringify(value ?? null);
        return [key, serialized.slice(0, 1000)];
      }),
    ),
    reach: 0,
    recordDate: nestedString(row, ["segments", "date"]),
    rowType,
    searchTerm,
    status,
  };
}

async function fetchGoogleAdsRows(input: GoogleAdsFetchInput, config: GoogleAdsConfig) {
  const accessToken = await fetchAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": config.developerToken,
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;

  const response = await fetch(
    `https://googleads.googleapis.com/${config.apiVersion}/customers/${config.customerId}/googleAds:searchStream`,
    {
      body: JSON.stringify({ query: buildGoogleAdsQuery(input) }),
      headers,
      method: "POST",
    },
  );

  if (!response.ok) {
    const status = response.status;
    throw new Error(`Google広告APIの取得に失敗しました。HTTP ${status}。customer ID、developer token、権限、API利用設定を確認してください。`);
  }

  const chunks = (await response.json()) as GoogleAdsSearchStreamChunk[];
  const rawRows = chunks.flatMap((chunk) => chunk.results ?? []);
  return rawRows.map((row) => rowToAdCsvRow(row, input.importType));
}

export async function fetchGoogleAdsReport(input: GoogleAdsFetchInput) {
  validateInput(input);
  const status = getGoogleAdsConfigStatus();
  if (!status.configured) {
    throw new Error(`Google広告APIの環境変数が不足しています: ${status.missing.join(", ")}`);
  }

  const config = getGoogleAdsConfig();
  const rows = await fetchGoogleAdsRows(input, config);
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ input, rows }))
    .digest("hex");
  const fileName = `google-ads-api-${input.importType}-${input.periodStart}_${input.periodEnd}.json`;
  const preview: AdCsvPreview = {
    contentHash,
    detectedType: input.importType,
    errorCount: 0,
    fileName,
    invalidRowCount: 0,
    issues: [],
    metrics: summarizeAdCsvRows(rows),
    platform: "google",
    previewRows: rows.slice(0, adCsvConfig.previewRowLimit),
    recognizedColumns: [
      "Google Ads API → campaign",
      "Google Ads API → ad_group",
      "Google Ads API → metrics",
      "Google Ads API → segments.date",
    ],
    requestedType: input.importType,
    rows,
    sourceColumns: ["Google Ads API searchStream"],
    totalRowCount: rows.length,
    validRowCount: rows.length,
    warningCount: 0,
  };

  return {
    preview,
    save: () =>
      saveAdCsvImport(preview, {
        comparisonLabel: input.comparisonLabel,
        importType: input.importType,
        memo: input.memo,
        periodEnd: input.periodEnd,
        periodStart: input.periodStart,
        platform: "google",
        reportMonth: input.reportMonth,
      } satisfies AdCsvImportMetadata),
  };
}
