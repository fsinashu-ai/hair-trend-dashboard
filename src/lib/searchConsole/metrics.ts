import { searchConsoleConfig } from "@/config/searchConsole";
import type {
  SearchConsoleBasicAnalysis,
  SearchConsoleCandidate,
  SearchConsoleComparison,
  SearchConsoleImportType,
  SearchConsoleMetricChange,
  SearchConsoleMetrics,
  SearchConsoleRow,
} from "@/types/searchConsole";

function getRowKey(row: SearchConsoleRow) {
  return row.query || row.pageUrl || row.device || row.country || row.recordDate;
}

export function summarizeSearchConsoleRows(
  rows: SearchConsoleRow[],
): SearchConsoleMetrics {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * Math.max(row.impressions, 1),
    0,
  );
  const positionWeight = rows.reduce(
    (sum, row) => sum + Math.max(row.impressions, 1),
    0,
  );

  return {
    averagePosition: positionWeight > 0 ? weightedPosition / positionWeight : 0,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    impressions,
    pageCount: new Set(rows.map((row) => row.pageUrl).filter(Boolean)).size,
    queryCount: new Set(rows.map((row) => row.query).filter(Boolean)).size,
  };
}

export function aggregateSearchConsoleRows(rows: SearchConsoleRow[]) {
  const groups = new Map<string, SearchConsoleRow[]>();

  rows.forEach((row) => {
    const key = getRowKey(row);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries()).map(([key, groupedRows]) => {
    const metrics = summarizeSearchConsoleRows(groupedRows);
    const first = groupedRows[0];
    return {
      ...first,
      clicks: metrics.clicks,
      ctr: metrics.ctr,
      impressions: metrics.impressions,
      position: metrics.averagePosition,
      key,
    };
  });
}

function createMetricChange(current: number, previous: number): SearchConsoleMetricChange {
  return {
    current,
    difference: current - previous,
    percentChange: previous === 0 ? null : ((current - previous) / previous) * 100,
    previous,
  };
}

export function compareSearchConsolePeriods(
  currentRows: SearchConsoleRow[],
  previousRows: SearchConsoleRow[],
  label = "前回期間",
): SearchConsoleComparison {
  const current = summarizeSearchConsoleRows(currentRows);
  const previous = summarizeSearchConsoleRows(previousRows);
  const hasComparison = previousRows.length > 0;

  return {
    clicks: createMetricChange(current.clicks, previous.clicks),
    ctrPointChange: hasComparison ? (current.ctr - previous.ctr) * 100 : 0,
    hasComparison,
    impressions: createMetricChange(current.impressions, previous.impressions),
    label,
    positionImprovement: hasComparison
      ? previous.averagePosition - current.averagePosition
      : 0,
  };
}

function toCandidate(
  row: SearchConsoleRow & { key: string },
  category: SearchConsoleCandidate["category"],
  reason: string,
): SearchConsoleCandidate {
  return { ...row, category, reason };
}

function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

export function createSearchConsoleBasicAnalysis(
  currentRows: SearchConsoleRow[],
  previousRows: SearchConsoleRow[] = [],
): SearchConsoleBasicAnalysis {
  const limit = searchConsoleConfig.aiCandidateLimit;
  const thresholds = searchConsoleConfig.thresholds;
  const current = aggregateSearchConsoleRows(currentRows);
  const previousMap = new Map(
    aggregateSearchConsoleRows(previousRows).map((row) => [row.key, row]),
  );
  const byImpressions = [...current].sort(
    (first, second) => second.impressions - first.impressions,
  );

  const highImpressionsLowCtr = byImpressions
    .filter(
      (row) =>
        row.impressions >= thresholds.lowCtrMinimumImpressions &&
        row.ctr < thresholds.lowCtr,
    )
    .map((row) =>
      toCandidate(
        row,
        "low_ctr",
        `表示${row.impressions.toLocaleString("ja-JP")}回に対しCTR${(row.ctr * 100).toFixed(2)}%`,
      ),
    )
    .slice(0, limit);

  const createPositionCandidates = (
    range: { min: number; max: number },
    category: SearchConsoleCandidate["category"],
    reason: string,
  ) =>
    byImpressions
      .filter((row) => inRange(row.position, range))
      .map((row) => toCandidate(row, category, `${reason}（${row.position.toFixed(1)}位）`))
      .slice(0, limit);

  const changed = current.flatMap((row) => {
    const previous = previousMap.get(row.key);
    return previous ? [{ current: row, previous }] : [];
  });

  return {
    clicksDown: changed
      .filter(({ current: row, previous }) => row.clicks < previous.clicks)
      .sort((a, b) => a.current.clicks - a.previous.clicks - (b.current.clicks - b.previous.clicks))
      .map(({ current: row, previous }) =>
        toCandidate(row, "clicks_down", `クリックが${previous.clicks}件から${row.clicks}件へ減少`),
      )
      .slice(0, limit),
    highImpressionsLowCtr,
    impressionsUp: changed
      .filter(({ current: row, previous }) => row.impressions > previous.impressions)
      .sort((a, b) => b.current.impressions - b.previous.impressions - (a.current.impressions - a.previous.impressions))
      .map(({ current: row, previous }) =>
        toCandidate(
          row,
          "impressions_up",
          `表示回数が${previous.impressions}回から${row.impressions}回へ増加`,
        ),
      )
      .slice(0, limit),
    improvementPages: byImpressions
      .filter(
        (row) =>
          row.rowType === "page" &&
          (row.ctr < thresholds.lowCtr || row.position >= thresholds.positionElevenToTwenty.min),
      )
      .map((row) =>
        toCandidate(row, "page_opportunity", "表示機会に対してCTRまたは掲載順位に改善余地があります"),
      )
      .slice(0, limit),
    positionDown: changed
      .filter(({ current: row, previous }) => row.position > previous.position)
      .sort((a, b) => b.current.position - b.previous.position - (a.current.position - a.previous.position))
      .map(({ current: row, previous }) =>
        toCandidate(
          row,
          "position_down",
          `${previous.position.toFixed(1)}位から${row.position.toFixed(1)}位へ低下`,
        ),
      )
      .slice(0, limit),
    positionElevenToTwenty: createPositionCandidates(
      thresholds.positionElevenToTwenty,
      "position_11_20",
      "リライト優先候補",
    ),
    positionFourToTen: createPositionCandidates(
      thresholds.positionFourToTen,
      "position_4_10",
      "タイトル・説明文の改善候補",
    ),
    positionTwentyOneToThirty: createPositionCandidates(
      thresholds.positionTwentyOneToThirty,
      "position_21_30",
      "記事強化候補",
    ),
    positionUp: changed
      .filter(({ current: row, previous }) => row.position < previous.position)
      .sort((a, b) => b.previous.position - b.current.position - (a.previous.position - a.current.position))
      .map(({ current: row, previous }) =>
        toCandidate(
          row,
          "position_up",
          `${previous.position.toFixed(1)}位から${row.position.toFixed(1)}位へ改善`,
        ),
      )
      .slice(0, limit),
    topKeywords: byImpressions.filter((row) => row.rowType === "query").slice(0, limit),
    topPages: byImpressions.filter((row) => row.rowType === "page").slice(0, limit),
    zeroClickHighImpressions: byImpressions
      .filter(
        (row) =>
          row.clicks === 0 &&
          row.impressions >= thresholds.zeroClickMinimumImpressions,
      )
      .map((row) =>
        toCandidate(row, "zero_click", `表示${row.impressions.toLocaleString("ja-JP")}回でクリック0件`),
      )
      .slice(0, limit),
  };
}

export function findPreviousImportRows({
  currentImportId,
  currentType,
  imports,
  rowsByImport,
}: {
  currentImportId: string;
  currentType: SearchConsoleImportType;
  imports: Array<{ id: string; importType: SearchConsoleImportType; periodEnd: string }>;
  rowsByImport: Record<string, SearchConsoleRow[]>;
}) {
  const currentIndex = imports.findIndex((item) => item.id === currentImportId);
  const previous = imports
    .slice(currentIndex + 1)
    .find((item) => item.importType === currentType);
  return previous ? rowsByImport[previous.id] ?? [] : [];
}

