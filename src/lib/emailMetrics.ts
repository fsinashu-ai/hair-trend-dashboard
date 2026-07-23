import emailMonthlyMetrics from "@/data/emailMonthlyMetrics.json";
import type {
  EmailMetricMonthSummary,
  EmailMetricsAnalysisContext,
} from "@/types/emailMetrics";

type NullableNumber = number | null;

type EmailAdRow = {
  month: string;
  platform: string;
  impressions: NullableNumber;
  clicks: NullableNumber;
  reportedConversions: NullableNumber;
  adjustedConversions: NullableNumber;
  costYen: NullableNumber;
  note: string | null;
};

type EmailTrafficRow = {
  month: string;
  siteMetricValue: NullableNumber;
  siteMetricType: string | null;
  direct: NullableNumber;
  organicSearch: NullableNumber;
  paidSearch: NullableNumber;
  searchConsoleImpressions: NullableNumber;
  searchConsoleClicks: NullableNumber;
  lineLinkClicks: NullableNumber;
  lineFriendAdds: NullableNumber;
  netFriendAdds: NullableNumber;
  actualResponse: string | null;
  dataQualityNote: string | null;
};

type EmailMetricsDataset = {
  source: {
    title: string;
    periodStart: string;
    periodEnd: string;
  };
  ads: EmailAdRow[];
  traffic: EmailTrafficRow[];
};

const dataset = emailMonthlyMetrics as EmailMetricsDataset;

function sumKnown(values: NullableNumber[]) {
  const reported = values.filter((value): value is number => value !== null);
  return reported.length > 0
    ? reported.reduce((total, value) => total + value, 0)
    : null;
}

function monthFromDate(value?: string) {
  return typeof value === "string" && /^\d{4}-\d{2}/.test(value)
    ? value.slice(0, 7)
    : "";
}

function createMonthSummary(traffic: EmailTrafficRow): EmailMetricMonthSummary {
  const ads = dataset.ads.filter((row) => row.month === traffic.month);
  return {
    month: traffic.month,
    siteMetricValue: traffic.siteMetricValue,
    siteMetricType: traffic.siteMetricType,
    direct: traffic.direct,
    organicSearch: traffic.organicSearch,
    paidSearch: traffic.paidSearch,
    searchConsoleImpressions: traffic.searchConsoleImpressions,
    searchConsoleClicks: traffic.searchConsoleClicks,
    lineLinkClicks: traffic.lineLinkClicks,
    lineFriendAdds: traffic.lineFriendAdds,
    netFriendAdds: traffic.netFriendAdds,
    adImpressions: sumKnown(ads.map((row) => row.impressions)),
    adClicks: sumKnown(ads.map((row) => row.clicks)),
    adReportedConversions: sumKnown(
      ads.map((row) => row.reportedConversions),
    ),
    adAdjustedConversions: sumKnown(
      ads.map((row) => row.adjustedConversions),
    ),
    adCostYen: sumKnown(ads.map((row) => row.costYen)),
    adPlatforms: [...new Set(ads.map((row) => row.platform))],
    actualResponse: traffic.actualResponse,
    dataQualityNotes: [
      traffic.dataQualityNote,
      ...ads.map((row) => row.note),
    ].filter((note): note is string => Boolean(note)),
  };
}

const monthSummaries = dataset.traffic.map(createMonthSummary);

export function getEmailMetricMonths() {
  return monthSummaries;
}

export function getEmailMetricsAnalysisContext(
  periodStart?: string,
  periodEnd?: string,
  fallbackMonthCount = 6,
): EmailMetricsAnalysisContext {
  const startMonth = monthFromDate(periodStart);
  const endMonth = monthFromDate(periodEnd);
  const matching =
    startMonth && endMonth
      ? monthSummaries.filter(
          (item) => item.month >= startMonth && item.month <= endMonth,
        )
      : [];
  const usesRequestedPeriod = matching.length > 0;
  const selected = (usesRequestedPeriod
    ? matching
    : monthSummaries.slice(-fallbackMonthCount)
  ).slice(-12);

  return {
    source: dataset.source.title,
    role: "GA4・広告・Search Consoleの不足を照合する補完資料。各サービスの実績値へ自動加算しない。",
    sourcePeriod: `${dataset.source.periodStart}〜${dataset.source.periodEnd}`,
    requestedPeriod:
      startMonth && endMonth ? `${startMonth}〜${endMonth}` : "指定なし",
    matchingMode: usesRequestedPeriod
      ? "requested_period"
      : "latest_available",
    months: selected,
    interpretationRules: [
      "空欄は未記載・未確定を表し、0として扱わない。明記された0とは区別する。",
      "サイト人数/PVは月によりページビュー・ユーザー・新規ユーザーなど定義が異なるため、指標種別とセットで読む。",
      "報告CVは主にLINEリンク等のタップで、予約件数とは一致しない。",
      "LINEリンク、友だち追加、相談、予約は別の指標として扱う。",
      "GA4や広告APIと期間・定義が重なる可能性があるため、合算せず差異の確認と傾向判断にだけ使う。",
    ],
  };
}
