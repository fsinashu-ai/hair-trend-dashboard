import { conversionThresholds } from "@/config/conversions";
import type {
  ConversionAggregateRow,
  ConversionMetrics,
  ConversionOpportunity,
  ConversionOverview,
} from "@/types/conversions";
import type { Ga4Row } from "@/types/ga4";

const emptyMetrics: ConversionMetrics = {
  conversionRate: 0,
  genericKeyEvents: 0,
  inquiryClicks: 0,
  instagramClicks: 0,
  keyEvents: 0,
  lineClicks: 0,
  mapClicks: 0,
  phoneClicks: 0,
  reservationClicks: 0,
  sessions: 0,
  totalActions: 0,
  users: 0,
  views: 0,
};

function includesAny(value: string, keywords: string[]) {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function inferClicks(row: Ga4Row) {
  const eventName = row.eventName || "";
  const base = Math.max(row.conversions, 0);
  return {
    inquiryClicks: includesAny(eventName, ["contact", "inquiry", "問い合わせ", "問合せ", "相談"])
      ? Math.max(base, 1)
      : 0,
    instagramClicks: includesAny(eventName, ["instagram", "insta", "インスタ"])
      ? Math.max(base, 1)
      : 0,
    mapClicks: includesAny(eventName, ["map", "maps", "マップ", "地図"])
      ? Math.max(base, 1)
      : 0,
    phoneClicks: includesAny(eventName, ["tel", "phone", "call", "電話"])
      ? Math.max(base, 1)
      : 0,
  };
}

export function summarizeConversionRows(rows: Ga4Row[]): ConversionMetrics {
  const totals = rows.reduce(
    (sum, row) => {
      const inferred = inferClicks(row);
      const knownClicks =
        row.lineClicks +
        row.reservationClicks +
        inferred.phoneClicks +
        inferred.instagramClicks +
        inferred.mapClicks +
        inferred.inquiryClicks;
      const genericKeyEvents = Math.max(row.conversions - knownClicks, 0);
      const totalActions = Math.max(row.conversions, knownClicks);

      return {
        conversionRate: 0,
        genericKeyEvents: sum.genericKeyEvents + genericKeyEvents,
        inquiryClicks: sum.inquiryClicks + inferred.inquiryClicks,
        instagramClicks: sum.instagramClicks + inferred.instagramClicks,
        keyEvents: sum.keyEvents + row.conversions,
        lineClicks: sum.lineClicks + row.lineClicks,
        mapClicks: sum.mapClicks + inferred.mapClicks,
        phoneClicks: sum.phoneClicks + inferred.phoneClicks,
        reservationClicks: sum.reservationClicks + row.reservationClicks,
        sessions: sum.sessions + row.sessions,
        totalActions: sum.totalActions + totalActions,
        users: sum.users + row.users,
        views: sum.views + row.views,
      };
    },
    { ...emptyMetrics },
  );

  return {
    ...totals,
    conversionRate:
      totals.sessions > 0 ? totals.totalActions / totals.sessions : 0,
  };
}

function weightedAverage(rows: Ga4Row[], key: "engagementRate" | "averageEngagementSeconds") {
  const weight = rows.reduce((sum, row) => sum + Math.max(row.sessions, row.users, 1), 0);
  if (weight === 0) return 0;
  return rows.reduce((sum, row) => sum + row[key] * Math.max(row.sessions, row.users, 1), 0) / weight;
}

function groupRows(
  rows: Ga4Row[],
  type: ConversionAggregateRow["type"],
  getKey: (row: Ga4Row) => string,
): ConversionAggregateRow[] {
  const groups = new Map<string, Ga4Row[]>();

  rows.forEach((row) => {
    const key = getKey(row).trim();
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, groupedRows]) => {
      const first = groupedRows[0];
      const metrics = summarizeConversionRows(groupedRows);
      return {
        averageEngagementSeconds: weightedAverage(groupedRows, "averageEngagementSeconds"),
        channelGroup: first.channelGroup,
        engagementRate: weightedAverage(groupedRows, "engagementRate"),
        eventName: first.eventName,
        key,
        label: key,
        landingPage: first.landingPage,
        metrics,
        pageTitle: first.pageTitle,
        sampleRows: groupedRows.slice(0, 3),
        sessions: metrics.sessions,
        sourceMedium: first.sourceMedium,
        type,
        users: metrics.users,
        views: metrics.views,
      };
    })
    .sort((a, b) => b.metrics.totalActions - a.metrics.totalActions || b.sessions - a.sessions);
}

function createOpportunity(
  item: ConversionAggregateRow,
  reason: string,
  recommendedAction: string,
  priority: ConversionOpportunity["priority"],
): ConversionOpportunity {
  return {
    conversionRate: item.metrics.conversionRate,
    key: item.key,
    label: item.label,
    pageUrl: item.landingPage || undefined,
    priority,
    reason,
    recommendedAction,
    sessions: item.sessions,
    sourceMedium: item.sourceMedium || item.channelGroup || undefined,
    target: item.type === "page" ? "page" : item.type === "channel" ? "channel" : "source",
    totalActions: item.metrics.totalActions,
    users: item.users,
    views: item.views,
  };
}

function findOpportunities(byPage: ConversionAggregateRow[], bySource: ConversionAggregateRow[]) {
  const pageOpportunities = byPage
    .filter(
      (item) =>
        item.sessions >= conversionThresholds.highTrafficNoActionSessions &&
        item.metrics.totalActions === 0,
    )
    .map((item) =>
      createOpportunity(
        item,
        "アクセスはあるのにLINE・予約などの成果が記録されていません。",
        "記事上部、FAQ下、記事末尾にLINE相談CTAを追加し、悩み別の相談文を入れます。",
        "high",
      ),
    );

  const lowRatePages = byPage
    .filter(
      (item) =>
        item.sessions >= conversionThresholds.lowConversionSessions &&
        item.metrics.totalActions > 0 &&
        item.metrics.conversionRate < conversionThresholds.lowConversionRate,
    )
    .map((item) =>
      createOpportunity(
        item,
        "成果は発生していますが、セッション数に対して割合が低めです。",
        "CTA文言、ボタン位置、内部リンク、スマホ表示を見直します。",
        "medium",
      ),
    );

  const sourceOpportunities = bySource
    .filter(
      (item) =>
        item.sessions >= conversionThresholds.highTrafficNoActionSessions &&
        item.metrics.totalActions === 0,
    )
    .map((item) =>
      createOpportunity(
        item,
        "流入はあるのに成果につながっていない流入元です。",
        "流入元に合わせて入口ページ、CTA、投稿内容のつながりを確認します。",
        "medium",
      ),
    );

  return [...pageOpportunities, ...lowRatePages, ...sourceOpportunities]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, conversionThresholds.topLimit);
}

export function createConversionOverview(rows: Ga4Row[]): ConversionOverview {
  const byPage = groupRows(
    rows,
    "page",
    (row) => row.landingPage || row.pageTitle,
  );
  const bySource = groupRows(
    rows,
    "source",
    (row) => row.sourceMedium || row.channelGroup,
  );
  const byChannel = groupRows(rows, "channel", (row) => row.channelGroup);
  const byEvent = groupRows(rows, "event", (row) => row.eventName);
  const topConverters = [...byPage, ...bySource]
    .filter((item) => item.metrics.totalActions > 0)
    .sort((a, b) => b.metrics.totalActions - a.metrics.totalActions)
    .slice(0, conversionThresholds.topLimit);

  return {
    byChannel,
    byEvent,
    byPage,
    bySource,
    metrics: summarizeConversionRows(rows),
    opportunities: findOpportunities(byPage, bySource),
    topConverters,
  };
}

export function formatConversionRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
