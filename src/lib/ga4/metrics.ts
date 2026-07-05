import { ga4Config } from "@/config/ga4";
import type {
  Ga4BasicAnalysis,
  Ga4Candidate,
  Ga4Comparison,
  Ga4MetricChange,
  Ga4Metrics,
  Ga4Row,
} from "@/types/ga4";

function rowKey(row: Ga4Row) {
  return (
    row.landingPage ||
    row.pageTitle ||
    row.sourceMedium ||
    row.channelGroup ||
    row.eventName ||
    row.recordDate ||
    row.deviceCategory
  );
}

export function summarizeGa4Rows(rows: Ga4Row[]): Ga4Metrics {
  const sessions = rows.reduce((sum, row) => sum + row.sessions, 0);
  const users = rows.reduce((sum, row) => sum + row.users, 0);
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const weightedEngagement = rows.reduce(
    (sum, row) => sum + row.engagementRate * Math.max(row.sessions, row.users, 1),
    0,
  );
  const weightedEngagementSeconds = rows.reduce(
    (sum, row) =>
      sum + row.averageEngagementSeconds * Math.max(row.sessions, row.users, 1),
    0,
  );
  const weight = rows.reduce(
    (sum, row) => sum + Math.max(row.sessions, row.users, 1),
    0,
  );

  return {
    averageEngagementSeconds: weight > 0 ? weightedEngagementSeconds / weight : 0,
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    engagementRate: weight > 0 ? weightedEngagement / weight : 0,
    landingPageCount: new Set(
      rows.map((row) => row.landingPage || row.pageTitle).filter(Boolean),
    ).size,
    lineClicks: rows.reduce((sum, row) => sum + row.lineClicks, 0),
    reservationClicks: rows.reduce((sum, row) => sum + row.reservationClicks, 0),
    sessions,
    sourceCount: new Set(
      rows.map((row) => row.sourceMedium || row.channelGroup).filter(Boolean),
    ).size,
    users,
    views,
  };
}

export function aggregateGa4Rows(rows: Ga4Row[]) {
  const groups = new Map<string, Ga4Row[]>();

  rows.forEach((row) => {
    const key = rowKey(row);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries()).map(([key, groupedRows]) => {
    const metrics = summarizeGa4Rows(groupedRows);
    const first = groupedRows[0];
    return {
      ...first,
      averageEngagementSeconds: metrics.averageEngagementSeconds,
      conversions: metrics.conversions,
      engagementRate: metrics.engagementRate,
      key,
      lineClicks: metrics.lineClicks,
      reservationClicks: metrics.reservationClicks,
      sessions: metrics.sessions,
      users: metrics.users,
      views: metrics.views,
    };
  });
}

function metricChange(current: number, previous: number): Ga4MetricChange {
  return {
    current,
    difference: current - previous,
    percentChange: previous === 0 ? null : ((current - previous) / previous) * 100,
    previous,
  };
}

export function compareGa4Periods(
  currentRows: Ga4Row[],
  previousRows: Ga4Row[],
  label = "前回期間",
): Ga4Comparison {
  const current = summarizeGa4Rows(currentRows);
  const previous = summarizeGa4Rows(previousRows);
  const currentConversionClicks = current.lineClicks + current.reservationClicks;
  const previousConversionClicks = previous.lineClicks + previous.reservationClicks;

  return {
    conversionClicks: metricChange(currentConversionClicks, previousConversionClicks),
    engagementRatePointChange:
      previousRows.length > 0
        ? (current.engagementRate - previous.engagementRate) * 100
        : 0,
    hasComparison: previousRows.length > 0,
    label,
    sessions: metricChange(current.sessions, previous.sessions),
    users: metricChange(current.users, previous.users),
    views: metricChange(current.views, previous.views),
  };
}

function toCandidate(
  row: Ga4Row & { key: string },
  category: Ga4Candidate["category"],
  reason: string,
): Ga4Candidate {
  return { ...row, category, reason };
}

export function createGa4BasicAnalysis(rows: Ga4Row[]): Ga4BasicAnalysis {
  const thresholds = ga4Config.thresholds;
  const limit = ga4Config.aiCandidateLimit;
  const aggregated = aggregateGa4Rows(rows);
  const byViews = [...aggregated].sort((a, b) => b.views - a.views);
  const byUsers = [...aggregated].sort((a, b) => b.users - a.users);
  const byConversions = [...aggregated].sort(
    (a, b) =>
      b.lineClicks +
      b.reservationClicks +
      b.conversions -
      (a.lineClicks + a.reservationClicks + a.conversions),
  );

  return {
    conversionPages: byConversions
      .filter((row) => row.lineClicks + row.reservationClicks + row.conversions > 0)
      .map((row) =>
        toCandidate(
          row,
          "conversion_page",
          `LINE・予約・キーイベント合計${row.lineClicks + row.reservationClicks + row.conversions}件`,
        ),
      )
      .slice(0, limit),
    highUsersNoConversion: byUsers
      .filter(
        (row) =>
          row.users >= thresholds.noConversionMinimumUsers &&
          row.lineClicks + row.reservationClicks + row.conversions === 0,
      )
      .map((row) =>
        toCandidate(
          row,
          "high_users_no_conversion",
          `ユーザー${row.users.toLocaleString("ja-JP")}人に対して相談・予約行動が未取得`,
        ),
      )
      .slice(0, limit),
    highViewsLowEngagement: byViews
      .filter(
        (row) =>
          row.views >= thresholds.pageMinimumViews &&
          row.engagementRate < thresholds.lowEngagementRate,
      )
      .map((row) =>
        toCandidate(
          row,
          "high_views_low_engagement",
          `表示${row.views.toLocaleString("ja-JP")}回、エンゲージメント率${(row.engagementRate * 100).toFixed(1)}%`,
        ),
      )
      .slice(0, limit),
    lineOpportunityPages: byUsers
      .filter(
        (row) =>
          row.users >= thresholds.lineOpportunityMinimumUsers &&
          row.lineClicks === 0 &&
          (row.landingPage || row.pageTitle),
      )
      .map((row) =>
        toCandidate(
          row,
          "line_opportunity",
          `ユーザー${row.users.toLocaleString("ja-JP")}人でLINEクリック0件`,
        ),
      )
      .slice(0, limit),
    topLandingPages: byViews
      .filter((row) => row.landingPage || row.pageTitle)
      .map((row) =>
        toCandidate(
          row,
          "top_landing_page",
          `表示${row.views.toLocaleString("ja-JP")}回、ユーザー${row.users.toLocaleString("ja-JP")}人`,
        ),
      )
      .slice(0, limit),
    topSources: byUsers
      .filter((row) => row.sourceMedium || row.channelGroup)
      .map((row) =>
        toCandidate(
          row,
          "top_source",
          `流入ユーザー${row.users.toLocaleString("ja-JP")}人`,
        ),
      )
      .slice(0, limit),
  };
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0秒";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
}
