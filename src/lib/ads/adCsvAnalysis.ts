import { adCsvConfig } from "@/config/adCsv";
import type {
  AdCsvBasicAnalysis,
  AdCsvComparison,
  AdCsvGroupSummary,
  AdCsvImprovementCandidate,
  AdCsvMetricChange,
  AdCsvMetrics,
  AdCsvRow,
} from "@/types/adCsv";

export function summarizeAdCsvRows(rows: AdCsvRow[]): AdCsvMetrics {
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const totalConversions = rows.reduce((sum, row) => sum + row.conversions, 0);

  return {
    averageCpa: totalConversions > 0 ? totalCost / totalConversions : 0,
    averageCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    totalClicks,
    totalConversions,
    totalCost,
    totalImpressions,
  };
}

function emptyGroup(key: string): AdCsvGroupSummary {
  return {
    averageCpa: 0,
    averageCpc: 0,
    averageCtr: 0,
    campaignName: "",
    adGroupName: "",
    adName: "",
    finalUrl: "",
    key,
    keyword: "",
    rowCount: 0,
    searchTerm: "",
    totalClicks: 0,
    totalConversions: 0,
    totalCost: 0,
    totalImpressions: 0,
  };
}

export function groupAdCsvRows(
  rows: AdCsvRow[],
  selector: (row: AdCsvRow) => string,
): AdCsvGroupSummary[] {
  const groups = new Map<string, AdCsvRow[]>();
  rows.forEach((row) => {
    const key = selector(row).trim();
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const first = groupRows[0];
      return {
        ...emptyGroup(key),
        ...summarizeAdCsvRows(groupRows),
        adGroupName: first.adGroupName,
        adName: first.adName,
        campaignName: first.campaignName,
        finalUrl: first.finalUrl,
        keyword: first.keyword,
        rowCount: groupRows.length,
        searchTerm: first.searchTerm,
      };
    })
    .sort((first, second) => second.totalCost - first.totalCost);
}

function metricChange(current: number, previous: number): AdCsvMetricChange {
  return {
    current,
    difference: current - previous,
    percentChange: previous === 0 ? null : ((current - previous) / previous) * 100,
    previous,
  };
}

export function compareAdCsvPeriods(
  currentRows: AdCsvRow[],
  previousRows: AdCsvRow[],
  label = "前回期間",
): AdCsvComparison {
  const current = summarizeAdCsvRows(currentRows);
  const previous = summarizeAdCsvRows(previousRows);
  const hasComparison = previousRows.length > 0;

  return {
    averageCpa: metricChange(current.averageCpa, previous.averageCpa),
    averageCpc: metricChange(current.averageCpc, previous.averageCpc),
    averageCtrPointChange: hasComparison ? (current.averageCtr - previous.averageCtr) * 100 : 0,
    hasComparison,
    label,
    totalClicks: metricChange(current.totalClicks, previous.totalClicks),
    totalConversions: metricChange(current.totalConversions, previous.totalConversions),
    totalCost: metricChange(current.totalCost, previous.totalCost),
    totalImpressions: metricChange(current.totalImpressions, previous.totalImpressions),
  };
}

function candidate(
  category: AdCsvImprovementCandidate["category"],
  group: AdCsvGroupSummary,
  reason: string,
): AdCsvImprovementCandidate {
  return {
    category,
    key: group.key,
    metrics: {
      averageCpa: group.averageCpa,
      averageCpc: group.averageCpc,
      averageCtr: group.averageCtr,
      totalClicks: group.totalClicks,
      totalConversions: group.totalConversions,
      totalCost: group.totalCost,
      totalImpressions: group.totalImpressions,
    },
    reason,
  };
}

function topByCost(groups: AdCsvGroupSummary[], count = 8) {
  return [...groups].sort((a, b) => b.totalCost - a.totalCost).slice(0, count);
}

export function createAdCsvBasicAnalysis(rows: AdCsvRow[]): AdCsvBasicAnalysis {
  const thresholds = adCsvConfig.thresholds;
  const campaignGroups = groupAdCsvRows(rows, (row) => row.campaignName);
  const adGroups = groupAdCsvRows(rows, (row) => row.adName || row.adGroupName || row.campaignName);
  const keywordGroups = groupAdCsvRows(rows, (row) => row.keyword);
  const searchTermGroups = groupAdCsvRows(rows, (row) => row.searchTerm);
  const dayGroups = groupAdCsvRows(rows, (row) => row.recordDate);
  const whole = summarizeAdCsvRows(rows);
  const averageDailyCost = dayGroups.length > 0
    ? dayGroups.reduce((sum, day) => sum + day.totalCost, 0) / dayGroups.length
    : 0;

  return {
    clicksNoConversionItems: adGroups
      .filter((group) => group.totalClicks >= thresholds.wastedClickMinimumClicks && group.totalConversions === 0)
      .map((group) =>
        candidate(
          "clicks_no_conversion",
          group,
          `クリックが${group.totalClicks.toLocaleString("ja-JP")}件ありますが、CVがありません。訴求やLP導線の確認候補です。`,
        ),
      )
      .slice(0, 10),
    conversionItems: [...campaignGroups, ...keywordGroups]
      .filter((group) => group.totalConversions > 0)
      .sort((a, b) => b.totalConversions - a.totalConversions)
      .map((group) =>
        candidate("has_conversion", group, `CVが${group.totalConversions.toLocaleString("ja-JP")}件あります。伸ばせる候補です。`),
      )
      .slice(0, 10),
    costSpikeDays: dayGroups
      .filter((group) => averageDailyCost > 0 && group.totalCost >= averageDailyCost * thresholds.costSpikeMultiplier)
      .map((group) =>
        candidate(
          "cost_spike",
          group,
          `平均日額の${thresholds.costSpikeMultiplier}倍以上の費用が出ています。配信設定や検索語句を確認してください。`,
        ),
      )
      .slice(0, 10),
    highClickCampaigns: [...campaignGroups]
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 8)
      .map((group) =>
        candidate("high_clicks", group, `クリック数が${group.totalClicks.toLocaleString("ja-JP")}件あります。CVとのつながりを確認します。`),
      ),
    highCostCampaigns: topByCost(campaignGroups)
      .map((group) =>
        candidate("high_cost", group, `広告費が${formatYen(group.totalCost)}です。成果とのバランス確認候補です。`),
      ),
    highCpaItems: campaignGroups
      .filter(
        (group) =>
          group.totalConversions > 0 &&
          group.averageCpa >= thresholds.targetCpa * thresholds.highCpaMultiplier,
      )
      .map((group) =>
        candidate("high_cpa", group, `CPAが${formatYen(group.averageCpa)}です。目標CPAより高めです。`),
      )
      .slice(0, 10),
    highCpcKeywords: keywordGroups
      .filter((group) => whole.averageCpc > 0 && group.averageCpc >= whole.averageCpc * thresholds.highCpcMultiplier)
      .map((group) =>
        candidate("high_cpc", group, `CPCが${formatYen(group.averageCpc)}で、全体平均より高めです。`),
      )
      .slice(0, 10),
    highImpressionsLowClicksItems: adGroups
      .filter(
        (group) =>
          group.totalImpressions >= thresholds.lowCtrMinimumImpressions &&
          group.totalClicks / Math.max(group.totalImpressions, 1) < thresholds.lowClickRate,
      )
      .map((group) =>
        candidate("impressions_low_clicks", group, `表示は多いですがクリック率が低めです。見出しや画像の改善候補です。`),
      )
      .slice(0, 10),
    lowCtrItems: adGroups
      .filter(
        (group) =>
          group.totalImpressions >= thresholds.lowCtrMinimumImpressions &&
          group.averageCtr < thresholds.lowCtr,
      )
      .map((group) =>
        candidate("low_ctr", group, `CTRが${formatPercent(group.averageCtr)}です。広告文やターゲットを見直す候補です。`),
      )
      .slice(0, 10),
    lpImprovementItems: adGroups
      .filter((group) => group.finalUrl && group.totalClicks >= thresholds.wastedClickMinimumClicks && group.totalConversions === 0)
      .map((group) =>
        candidate("lp_improvement", group, `クリックはありますがCVがありません。LPのファーストビューやLINE CTAを確認してください。`),
      )
      .slice(0, 10),
    negativeSearchTerms: searchTermGroups
      .filter((group) =>
        adCsvConfig.negativeTermSeeds.some((term) => group.key.includes(term)),
      )
      .map((group) =>
        candidate("negative_term", group, `「${group.key}」は除外候補語句を含みます。即除外ではなく内容確認用です。`),
      )
      .slice(0, 20),
  };
}

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
