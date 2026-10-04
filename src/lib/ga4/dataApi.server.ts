import { createHash } from "node:crypto";
import { ga4Config } from "@/config/ga4";
import {
  getGoogleServiceAccountAccessToken,
  isGoogleServiceAccountConfigured,
} from "@/lib/google/serviceAccount.server";
import {
  classifyGa4Event,
  countGa4RowActions,
  isAutomaticMeasurementEvent,
  lpLineEventName,
  lpLinePagePath,
} from "@/lib/ga4/events";
import { summarizeGa4Rows } from "@/lib/ga4/metrics";
import type { Ga4CsvIssue, Ga4CsvPreview, Ga4Row } from "@/types/ga4";

type Ga4DataApiConfig = {
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
function readServiceAccountConfig(): Ga4DataApiConfig | null {
  const jsonValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue) as Partial<{
        property_id: string;
      }>;
      const propertyId = normalizePropertyId(
        process.env.GA4_PROPERTY_ID || parsed.property_id || "",
      );
      if (isGoogleServiceAccountConfigured() && propertyId) return { propertyId };
    } catch {
      return null;
    }
  }

  const propertyId = normalizePropertyId(process.env.GA4_PROPERTY_ID || "");

  if (!isGoogleServiceAccountConfigured() || !propertyId) return null;

  return { propertyId };
}

function normalizePropertyId(value: string) {
  return value.trim().replace(/^properties\//, "");
}

export function isGa4DataApiConfigured() {
  return Boolean(readServiceAccountConfig());
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
      "date",
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

function eventReportSpec(
  conversionMetricName: Ga4MetricSet["conversionMetricName"],
  includeLinkDimensions = true,
) {
  return {
    dimensions: [
      "date",
      "eventName",
      "unifiedPagePathScreen",
      ...(includeLinkDimensions ? ["linkUrl", "linkText"] : []),
      "isKeyEvent",
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

async function runEventSpecWithFallbackMetrics(
  config: Ga4DataApiConfig,
  token: string,
  dateRange: Pick<Ga4DateRange, "endDate" | "startDate">,
  includeLinkDimensions: boolean,
) {
  try {
    return {
      conversionMetricName: "keyEvents" as const,
      response: await runReport(
        config,
        token,
        dateRange,
        eventReportSpec("keyEvents", includeLinkDimensions),
      ),
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
        eventReportSpec("conversions", includeLinkDimensions),
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
      ...(await runEventSpecWithFallbackMetrics(config, token, dateRange, true)),
      includesLinkDimensions: true,
    };
  } catch {
    return {
      ...(await runEventSpecWithFallbackMetrics(config, token, dateRange, false)),
      includesLinkDimensions: false,
    };
  }
}

function normalizeGa4Date(value: string) {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
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
      eventCount: 0,
      eventName: "",
      isKeyEvent: false,
      landingPage: getDimensionValue(
        row,
        dimensionHeaders,
        "landingPagePlusQueryString",
      ),
      lineClicks: 0,
      linkText: "",
      linkUrl: "",
      lpLineTaps: 0,
      pagePath: "",
      pageTitle: "",
      phoneTaps: 0,
      recordDate: normalizeGa4Date(
        getDimensionValue(row, dimensionHeaders, "date"),
      ),
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
      const linkUrl = getDimensionValue(row, dimensionHeaders, "linkUrl");
      const reportedPagePath = getDimensionValue(
        row,
        dimensionHeaders,
        "unifiedPagePathScreen",
      );
      const pagePath =
        reportedPagePath ||
        (eventName === lpLineEventName ? lpLinePagePath : "");
      const inferredClicks = classifyGa4Event({ eventCount, eventName, linkUrl });

      return {
        averageEngagementSeconds: 0,
        channelGroup: "",
        conversions: isAutomaticMeasurementEvent(eventName) ? 0 : keyEventCount,
        deviceCategory: "",
        engagementRate: 0,
        eventCount,
        eventName,
        isKeyEvent:
          getDimensionValue(row, dimensionHeaders, "isKeyEvent").toLowerCase() ===
          "true",
        landingPage: pagePath,
        lineClicks: inferredClicks.lineClicks,
        linkText: getDimensionValue(row, dimensionHeaders, "linkText"),
        linkUrl,
        lpLineTaps: inferredClicks.lpLineTaps,
        pagePath,
        pageTitle: "",
        phoneTaps: inferredClicks.phoneTaps,
        recordDate: normalizeGa4Date(
          getDimensionValue(row, dimensionHeaders, "date"),
        ),
        reservationClicks: inferredClicks.reservationClicks,
        sessions: 0,
        sourceMedium: "",
        users: 0,
        views: 0,
      };
    })
    .filter((row) => {
      const hasDimension = Boolean(row.eventName || row.pagePath || row.linkUrl);
      const hasMetric = countGa4RowActions(row) > 0;
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

  const token = await getGoogleServiceAccountAccessToken(analyticsScope);
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
  const eventIncludesLinkDimensions = Boolean(
    eventResult.response &&
      "includesLinkDimensions" in eventResult &&
      eventResult.includesLinkDimensions,
  );
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

  if (
    eventResult.response &&
    "includesLinkDimensions" in eventResult &&
    !eventResult.includesLinkDimensions
  ) {
    issues.push({
      message:
        "GA4のリンクURL・リンク文言ディメンションに互換性がなかったため、イベント名・発生ページ・キーイベント状態だけを保存しました。",
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
      "date → recordDate",
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
            "unifiedPagePathScreen → pagePath",
            ...(eventIncludesLinkDimensions
              ? ["linkUrl → linkUrl", "linkText → linkText"]
              : []),
            "isKeyEvent → isKeyEvent",
            "eventCount → lineClicks / lpLineTaps / phoneTaps / reservationClicks",
            `${eventResult.conversionMetricName} → conversions`,
          ]
        : []),
    ],
    rows,
    sourceColumns: [
      "landingPagePlusQueryString",
      "date",
      "sessionSourceMedium",
      "sessionDefaultChannelGroup",
      "totalUsers",
      "sessions",
      "screenPageViews",
      "engagementRate",
      "averageSessionDuration",
      trafficResult.conversionMetricName,
      ...(eventRows.length > 0
        ? [
            "date",
            "eventName",
            "unifiedPagePathScreen",
            ...(eventIncludesLinkDimensions ? ["linkUrl", "linkText"] : []),
            "isKeyEvent",
            "eventCount",
            eventResult.conversionMetricName,
          ]
        : []),
    ],
    totalRowCount: rowCount,
    validRowCount: rows.length,
    warningCount,
  } satisfies Ga4CsvPreview;
}
