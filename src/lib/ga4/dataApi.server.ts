import { createHash, createSign } from "node:crypto";
import { ga4Config } from "@/config/ga4";
import { summarizeGa4Rows } from "@/lib/ga4/metrics";
import type { Ga4CsvIssue, Ga4CsvPreview, Ga4Row } from "@/types/ga4";

type Ga4DataApiConfig = {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
};

type Ga4DateRange = {
  endDate: string;
  reportMonth: string;
  startDate: string;
};

type Ga4MetricSet = {
  conversionMetricName: "keyEvents" | "conversions";
};

type Ga4ReportSpec = {
  dimensions: string[];
  metrics: string[];
  orderByMetricName: string;
};

type Ga4RunReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4RunReportResponse = {
  dimensionHeaders?: Array<{ name?: string }>;
  error?: { message?: string; status?: string };
  metricHeaders?: Array<{ name?: string }>;
  rowCount?: number;
  rows?: Ga4RunReportRow[];
};

const analyticsScope = "https://www.googleapis.com/auth/analytics.readonly";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readServiceAccountConfig(): Ga4DataApiConfig | null {
  const jsonValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue) as Partial<{
        client_email: string;
        private_key: string;
        property_id: string;
      }>;
      const propertyId = normalizePropertyId(
        process.env.GA4_PROPERTY_ID || parsed.property_id || "",
      );
      if (parsed.client_email && parsed.private_key && propertyId) {
        return {
          clientEmail: parsed.client_email,
          privateKey: normalizePrivateKey(parsed.private_key),
          propertyId,
        };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "";
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "",
  );
  const propertyId = normalizePropertyId(process.env.GA4_PROPERTY_ID || "");

  if (!clientEmail || !privateKey || !propertyId) return null;

  return { clientEmail, privateKey, propertyId };
}

function normalizePrivateKey(value: string) {
  return value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n");
}

function normalizePropertyId(value: string) {
  return value.trim().replace(/^properties\//, "");
}

export function isGa4DataApiConfigured() {
  return Boolean(readServiceAccountConfig());
}

async function getAccessToken(config: Ga4DataApiConfig) {
  const now = Math.floor(Date.now() / 1000);

  if (tokenCache && tokenCache.expiresAt - 60 > now) {
    return tokenCache.accessToken;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64Url(
    JSON.stringify({
      aud: oauthTokenUrl,
      exp: now + 3600,
      iat: now,
      iss: config.clientEmail,
      scope: analyticsScope,
    }),
  );
  const signingInput = `${header}.${claimSet}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(config.privateKey);
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const body = new URLSearchParams({
    assertion,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
  });
  const response = await fetch(oauthTokenUrl, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const json = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    expires_in?: number;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(
      `Google認証に失敗しました。サービスアカウントのメール、秘密鍵、GA4権限を確認してください。`,
    );
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };

  return json.access_token;
}

function getMetricValue(
  row: Ga4RunReportRow,
  headers: string[],
  metricName: string,
) {
  const index = headers.indexOf(metricName);
  if (index === -1) return 0;
  const value = row.metricValues?.[index]?.value ?? "";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function getDimensionValue(
  row: Ga4RunReportRow,
  headers: string[],
  dimensionName: string,
) {
  const index = headers.indexOf(dimensionName);
  if (index === -1) return "";
  const value = row.dimensionValues?.[index]?.value?.trim() ?? "";
  return value === "(not set)" ? "" : value;
}

async function runReport(
  config: Ga4DataApiConfig,
  token: string,
  dateRange: Pick<Ga4DateRange, "endDate" | "startDate">,
  spec: Ga4ReportSpec,
) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      body: JSON.stringify({
        dateRanges: [
          {
            endDate: dateRange.endDate,
            startDate: dateRange.startDate,
          },
        ],
        dimensions: spec.dimensions.map((name) => ({ name })),
        limit: String(Math.min(ga4Config.maxImportRows, 20_000)),
        metrics: spec.metrics.map((name) => ({ name })),
        orderBys: [
          {
            desc: true,
            metric: { metricName: spec.orderByMetricName },
          },
        ],
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const json = (await response.json()) as Ga4RunReportResponse;

  if (!response.ok) {
    throw new Error(json.error?.message || "GA4 Data APIの取得に失敗しました。");
  }

  return json;
}

function trafficReportSpec(conversionMetricName: Ga4MetricSet["conversionMetricName"]) {
  return {
    dimensions: [
      "landingPagePlusQueryString",
      "sessionSourceMedium",
      "sessionDefaultChannelGroup",
    ],
    metrics: [
      "totalUsers",
      "sessions",
      "screenPageViews",
      "engagementRate",
      "averageSessionDuration",
      conversionMetricName,
    ],
    orderByMetricName: "sessions",
  } satisfies Ga4ReportSpec;
}

function eventReportSpec(conversionMetricName: Ga4MetricSet["conversionMetricName"]) {
  return {
    dimensions: [
      "eventName",
      "landingPagePlusQueryString",
      "sessionSourceMedium",
      "sessionDefaultChannelGroup",
    ],
    metrics: ["eventCount", conversionMetricName],
    orderByMetricName: "eventCount",
  } satisfies Ga4ReportSpec;
}

async function runTrafficReportWithFallbackMetrics(
  config: Ga4DataApiConfig,
  token: string,
  dateRange: Pick<Ga4DateRange, "endDate" | "startDate">,
) {
  try {
    return {
      conversionMetricName: "keyEvents" as const,
      response: await runReport(config, token, dateRange, trafficReportSpec("keyEvents")),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("keyEvents")) {
      throw error;
    }

    return {
      conversionMetricName: "conversions" as const,
      response: await runReport(
        config,
        token,
        dateRange,
        trafficReportSpec("conversions"),
      ),
    };
  }
}

async function runEventReportWithFallbackMetrics(
  config: Ga4DataApiConfig,
  token: string,
  dateRange: Pick<Ga4DateRange, "endDate" | "startDate">,
) {
  try {
    return {
      conversionMetricName: "keyEvents" as const,
      response: await runReport(config, token, dateRange, eventReportSpec("keyEvents")),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("keyEvents")) {
      throw error;
    }

    return {
      conversionMetricName: "conversions" as const,
      response: await runReport(
        config,
        token,
        dateRange,
        eventReportSpec("conversions"),
      ),
    };
  }
}

function inferEventClicks(eventName: string, keyEventCount: number, eventCount: number) {
  const normalized = eventName.toLowerCase();
  const clickCount = Math.round(Math.max(keyEventCount, eventCount));

  return {
    lineClicks:
      normalized.includes("line") || normalized.includes("ライン")
        ? Math.max(clickCount, 1)
        : 0,
    reservationClicks:
      normalized.includes("reserve") ||
      normalized.includes("reservation") ||
      normalized.includes("booking") ||
      normalized.includes("yoyaku") ||
      normalized.includes("予約")
        ? Math.max(clickCount, 1)
        : 0,
  };
}

function trafficResponseToRows(
  response: Ga4RunReportResponse,
  conversionMetricName: "keyEvents" | "conversions",
  includeConversions: boolean,
) {
  const dimensionHeaders =
    response.dimensionHeaders?.map((header) => header.name || "") ?? [];
  const metricHeaders =
    response.metricHeaders?.map((header) => header.name || "") ?? [];

  return (response.rows ?? [])
    .map<Ga4Row>((row) => ({
      averageEngagementSeconds: getMetricValue(
        row,
        metricHeaders,
        "averageSessionDuration",
      ),
      channelGroup: getDimensionValue(
        row,
        dimensionHeaders,
        "sessionDefaultChannelGroup",
      ),
      conversions: includeConversions
        ? Math.round(getMetricValue(row, metricHeaders, conversionMetricName))
        : 0,
      deviceCategory: "",
      engagementRate: getMetricValue(row, metricHeaders, "engagementRate"),
      eventName: "",
      landingPage: getDimensionValue(
        row,
        dimensionHeaders,
        "landingPagePlusQueryString",
      ),
      lineClicks: 0,
      pageTitle: "",
      recordDate: "",
      reservationClicks: 0,
      sessions: Math.round(getMetricValue(row, metricHeaders, "sessions")),
      sourceMedium: getDimensionValue(
        row,
        dimensionHeaders,
        "sessionSourceMedium",
      ),
      users: Math.round(getMetricValue(row, metricHeaders, "totalUsers")),
      views: Math.round(getMetricValue(row, metricHeaders, "screenPageViews")),
    }))
    .filter((row) => {
      const hasDimension = Boolean(row.landingPage || row.sourceMedium || row.channelGroup);
      const hasMetric = row.users + row.sessions + row.views + row.conversions > 0;
      return hasDimension && hasMetric;
    });
}

function eventResponseToRows(
  response: Ga4RunReportResponse,
  conversionMetricName: "keyEvents" | "conversions",
) {
  const dimensionHeaders =
    response.dimensionHeaders?.map((header) => header.name || "") ?? [];
  const metricHeaders =
    response.metricHeaders?.map((header) => header.name || "") ?? [];

  return (response.rows ?? [])
    .map<Ga4Row>((row) => {
      const eventName = getDimensionValue(row, dimensionHeaders, "eventName");
      const keyEventCount = Math.round(
        getMetricValue(row, metricHeaders, conversionMetricName),
      );
      const eventCount = Math.round(getMetricValue(row, metricHeaders, "eventCount"));
      const inferredClicks = inferEventClicks(eventName, keyEventCount, eventCount);

      return {
        averageEngagementSeconds: 0,
        channelGroup: getDimensionValue(
          row,
          dimensionHeaders,
          "sessionDefaultChannelGroup",
        ),
        conversions: keyEventCount,
        deviceCategory: "",
        engagementRate: 0,
        eventName,
        landingPage: getDimensionValue(
          row,
          dimensionHeaders,
          "landingPagePlusQueryString",
        ),
        lineClicks: inferredClicks.lineClicks,
        pageTitle: "",
        recordDate: "",
        reservationClicks: inferredClicks.reservationClicks,
        sessions: 0,
        sourceMedium: getDimensionValue(
          row,
          dimensionHeaders,
          "sessionSourceMedium",
        ),
        users: 0,
        views: 0,
      };
    })
    .filter((row) => {
      const hasDimension = Boolean(row.eventName || row.landingPage || row.sourceMedium);
      const hasMetric = row.conversions + row.lineClicks + row.reservationClicks > 0;
      return hasDimension && hasMetric;
    });
}

function createIssues(rows: Ga4Row[], rowCount: number): Ga4CsvIssue[] {
  const issues: Ga4CsvIssue[] = [];

  if (rowCount > rows.length) {
    issues.push({
      message: "空行または指標が0の行を除外しました",
      rowNumber: rows.length + 1,
      severity: "warning",
    });
  }

  if (rowCount >= ga4Config.maxImportRows) {
    issues.push({
      message: `上限${ga4Config.maxImportRows.toLocaleString("ja-JP")}行まで取得しました`,
      rowNumber: ga4Config.maxImportRows,
      severity: "warning",
    });
  }

  return issues;
}

export function createDefaultGa4FetchRange(date = new Date()): Ga4DateRange {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const startDate = targetMonth.toISOString().slice(0, 10);
  const endDate = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  const reportMonth = startDate.slice(0, 7);

  return { endDate, reportMonth, startDate };
}

export function validateGa4DateRange({
  endDate,
  reportMonth,
  startDate,
}: Ga4DateRange) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    !/^\d{4}-\d{2}$/.test(reportMonth)
  ) {
    return "開始日、終了日、集計月を正しい形式で入力してください。";
  }

  if (endDate < startDate) {
    return "終了日は開始日以降にしてください。";
  }

  return "";
}

export async function fetchGa4DataApiPreview(dateRange: Ga4DateRange) {
  const config = readServiceAccountConfig();

  if (!config) {
    throw new Error(
      "GA4 Data APIの環境変数が未設定です。GA4_PROPERTY_ID、GOOGLE_SERVICE_ACCOUNT_EMAIL、GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEYを確認してください。",
    );
  }

  const token = await getAccessToken(config);
  const trafficResult = await runTrafficReportWithFallbackMetrics(
    config,
    token,
    dateRange,
  );
  const eventResult = await runEventReportWithFallbackMetrics(
    config,
    token,
    dateRange,
  ).catch((error) => ({
    conversionMetricName: trafficResult.conversionMetricName,
    errorMessage:
      error instanceof Error
        ? error.message
        : "イベント名別データを取得できませんでした。",
    response: null,
  }));
  const eventRows = eventResult.response
    ? eventResponseToRows(
        eventResult.response,
        eventResult.conversionMetricName,
      )
    : [];
  const trafficRows = trafficResponseToRows(
    trafficResult.response,
    trafficResult.conversionMetricName,
    eventRows.length === 0,
  );
  const rows = [...trafficRows, ...eventRows];
  const rowCount =
    (trafficResult.response.rowCount ?? trafficRows.length) +
    (eventResult.response?.rowCount ?? eventRows.length);
  const issues = createIssues(rows, rowCount);

  if ("errorMessage" in eventResult && eventResult.errorMessage) {
    issues.push({
      message: `イベント名別データは取得できませんでした。ページ・流入元データだけ保存します。${eventResult.errorMessage}`,
      rowNumber: trafficRows.length + 1,
      severity: "warning",
    });
  }

  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        dateRange,
        propertyId: config.propertyId,
        rows,
        source: "ga4-data-api",
      }),
    )
    .digest("hex");

  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return {
    contentHash,
    errorCount,
    excludedRowCount: Math.max(rowCount - rows.length, 0),
    fileName: `ga4-data-api-${dateRange.startDate}_${dateRange.endDate}.csv`,
    issues,
    metrics: summarizeGa4Rows(rows),
    previewRows: rows.slice(0, ga4Config.previewRowLimit),
    recognizedColumns: [
      "landingPagePlusQueryString → landingPage",
      "sessionSourceMedium → sourceMedium",
      "sessionDefaultChannelGroup → channelGroup",
      "totalUsers → users",
      "sessions → sessions",
      "screenPageViews → views",
      "engagementRate → engagementRate",
      "averageSessionDuration → averageEngagementSeconds",
      `${trafficResult.conversionMetricName} → conversions`,
      ...(eventRows.length > 0
        ? [
            "eventName → eventName",
            "eventCount → lineClicks / reservationClicks",
            `${eventResult.conversionMetricName} → conversions`,
          ]
        : []),
    ],
    rows,
    sourceColumns: [
      "landingPagePlusQueryString",
      "sessionSourceMedium",
      "sessionDefaultChannelGroup",
      "totalUsers",
      "sessions",
      "screenPageViews",
      "engagementRate",
      "averageSessionDuration",
      trafficResult.conversionMetricName,
      ...(eventRows.length > 0
        ? ["eventName", "eventCount", eventResult.conversionMetricName]
        : []),
    ],
    totalRowCount: rowCount,
    validRowCount: rows.length,
    warningCount,
  } satisfies Ga4CsvPreview;
}
