import { fetchAdCsvImports, fetchAdCsvRows } from "@/lib/supabase/adCsv.server";
import { fetchGa4Imports, fetchGa4Rows } from "@/lib/supabase/ga4.server";
import {
  fetchSearchConsoleImports,
  fetchSearchConsoleRows,
} from "@/lib/supabase/searchConsole.server";
import type { AdCsvImport, AdCsvRow } from "@/types/adCsv";
import type { Ga4Import, Ga4Row } from "@/types/ga4";
import type {
  IntegratedAdMetrics,
  IntegratedGa4Metrics,
  IntegratedPage,
  IntegratedSearchConsoleMetrics,
  PageIntegrationSourceStatus,
  PageIntegrationSummary,
} from "@/types/pageIntegration";
import type { SearchConsoleImport, SearchConsoleRow } from "@/types/searchConsole";

type PageAccumulator = {
  ads: {
    clicks: number;
    conversions: number;
    cost: number;
    impressions: number;
  };
  ga4: {
    conversions: number;
    lineClicks: number;
    reservationClicks: number;
    sessions: number;
    users: number;
    views: number;
  };
  pagePath: string;
  pageTitle: string;
  searchConsole: {
    clicks: number;
    impressions: number;
    positionWeightedTotal: number;
  };
};

function safePeriod(periodStart: string, periodEnd: string) {
  return periodStart && periodEnd ? `${periodStart}〜${periodEnd}` : "未取得";
}

function sourceStatus(label: string, periodStart: string, periodEnd: string, updatedAt: string, detail: string): PageIntegrationSourceStatus {
  return {
    detail,
    label,
    period: safePeriod(periodStart, periodEnd),
    updatedAt,
  };
}

function isUsableImport<T extends { status: string }>(item: T) {
  return item.status !== "failed";
}

function latestSearchConsoleImport(imports: SearchConsoleImport[]) {
  return imports.filter(isUsableImport).find((item) => item.importType === "page") ?? imports.filter(isUsableImport)[0] ?? null;
}

function latestImport<T extends { periodEnd: string; updatedAt: string; status: string }>(imports: T[]) {
  return [...imports].filter(isUsableImport).sort((first, second) => {
    const periodDiff = second.periodEnd.localeCompare(first.periodEnd);
    return periodDiff || second.updatedAt.localeCompare(first.updatedAt);
  })[0] ?? null;
}

function normalizePagePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "(not set)" || trimmed === "未取得") return "";

  try {
    const url = new URL(trimmed, "https://ef-mayke-s.com");
    const path = url.pathname || "/";
    return path === "/" ? "/" : path.replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "") || "/";
  }
}

function createAccumulator(pagePath: string): PageAccumulator {
  return {
    ads: { clicks: 0, conversions: 0, cost: 0, impressions: 0 },
    ga4: { conversions: 0, lineClicks: 0, reservationClicks: 0, sessions: 0, users: 0, views: 0 },
    pagePath,
    pageTitle: "",
    searchConsole: { clicks: 0, impressions: 0, positionWeightedTotal: 0 },
  };
}

function getAccumulator(pages: Map<string, PageAccumulator>, value: string) {
  const pagePath = normalizePagePath(value);
  if (!pagePath) return null;
  const existing = pages.get(pagePath);
  if (existing) return existing;
  const created = createAccumulator(pagePath);
  pages.set(pagePath, created);
  return created;
}

function addSearchConsoleRows(pages: Map<string, PageAccumulator>, rows: SearchConsoleRow[]) {
  rows.forEach((row) => {
    const page = getAccumulator(pages, row.pageUrl);
    if (!page) return;
    page.searchConsole.clicks += row.clicks;
    page.searchConsole.impressions += row.impressions;
    page.searchConsole.positionWeightedTotal += row.position * row.impressions;
  });
}

function addGa4Rows(pages: Map<string, PageAccumulator>, rows: Ga4Row[]) {
  rows.forEach((row) => {
    const page = getAccumulator(pages, row.landingPage);
    if (!page) return;
    page.pageTitle = page.pageTitle || row.pageTitle;
    page.ga4.conversions += row.conversions;
    page.ga4.lineClicks += row.lineClicks;
    page.ga4.reservationClicks += row.reservationClicks;
    page.ga4.sessions += row.sessions;
    page.ga4.users += row.users;
    page.ga4.views += row.views;
  });
}

function addAdRows(pages: Map<string, PageAccumulator>, rows: AdCsvRow[]) {
  rows.forEach((row) => {
    const page = getAccumulator(pages, row.finalUrl);
    if (!page) return;
    page.ads.clicks += row.clicks;
    page.ads.conversions += row.conversions;
    page.ads.cost += row.cost;
    page.ads.impressions += row.impressions;
  });
}

function toSearchConsoleMetrics(value: PageAccumulator["searchConsole"]): IntegratedSearchConsoleMetrics | null {
  if (value.impressions === 0 && value.clicks === 0) return null;
  return {
    clicks: value.clicks,
    ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
    impressions: value.impressions,
    position: value.impressions > 0 ? value.positionWeightedTotal / value.impressions : 0,
  };
}

function toGa4Metrics(value: PageAccumulator["ga4"]): IntegratedGa4Metrics | null {
  const hasData = value.users + value.sessions + value.views + value.conversions + value.lineClicks + value.reservationClicks > 0;
  return hasData ? value : null;
}

function toAdMetrics(value: PageAccumulator["ads"]): IntegratedAdMetrics | null {
  if (value.impressions === 0 && value.clicks === 0 && value.cost === 0) return null;
  return {
    clicks: value.clicks,
    conversions: value.conversions,
    cost: value.cost,
    cpa: value.conversions > 0 ? value.cost / value.conversions : 0,
    ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
    impressions: value.impressions,
  };
}

function priorityForPage(
  searchConsole: IntegratedSearchConsoleMetrics | null,
  ga4: IntegratedGa4Metrics | null,
  ads: IntegratedAdMetrics | null,
) {
  if (
    (searchConsole && searchConsole.impressions >= 100 && searchConsole.ctr < 0.02) ||
    (ga4 && ga4.sessions >= 20 && ga4.lineClicks + ga4.reservationClicks + ga4.conversions === 0) ||
    (ads && ads.clicks >= 20 && ads.conversions === 0)
  ) return "high" as const;
  if (searchConsole || ga4 || ads) return "medium" as const;
  return "low" as const;
}

function reasonForPage(
  searchConsole: IntegratedSearchConsoleMetrics | null,
  ga4: IntegratedGa4Metrics | null,
  ads: IntegratedAdMetrics | null,
) {
  const reasons: string[] = [];
  if (searchConsole?.impressions && searchConsole.ctr < 0.02) reasons.push("検索表示に対してCTRが低い");
  if (ga4 && ga4.sessions >= 20 && ga4.lineClicks + ga4.reservationClicks + ga4.conversions === 0) reasons.push("閲覧はあるが相談・予約行動が未確認");
  if (ads && ads.clicks >= 20 && ads.conversions === 0) reasons.push("広告クリックはあるがCVが未確認");
  return reasons.length ? reasons.join(" / ") : "複数データの状況を確認するページ";
}

function toIntegratedPage(page: PageAccumulator): IntegratedPage {
  const searchConsole = toSearchConsoleMetrics(page.searchConsole);
  const ga4 = toGa4Metrics(page.ga4);
  const ads = toAdMetrics(page.ads);
  return {
    ads,
    ga4,
    pagePath: page.pagePath,
    pageTitle: page.pageTitle,
    priority: priorityForPage(searchConsole, ga4, ads),
    reason: reasonForPage(searchConsole, ga4, ads),
    searchConsole,
  };
}

async function safe<T>(callback: () => Promise<T>, fallback: T) {
  try {
    return await callback();
  } catch (error) {
    console.warn("[page-integration] source unavailable", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  }
}

function sourceLabelForAdImport(item: AdCsvImport) {
  return item.fileName.startsWith("google-ads-api-")
    ? "Google Ads API（読み取り専用）"
    : `広告CSV / ${item.fileName}`;
}

function sourceLabelForGa4Import(item: Ga4Import) {
  return item.fileName.startsWith("ga4-data-api-")
    ? "Google Analytics Data API"
    : `GA4 CSV / ${item.fileName}`;
}

export async function createPageIntegrationSummary(): Promise<PageIntegrationSummary> {
  const [searchConsoleImports, ga4Imports, adImports] = await Promise.all([
    safe(() => fetchSearchConsoleImports(24), null),
    safe(() => fetchGa4Imports(24), null),
    safe(() => fetchAdCsvImports(24), null),
  ]);
  const searchConsoleImport = latestSearchConsoleImport(searchConsoleImports ?? []);
  const ga4Import = latestImport(ga4Imports ?? []);
  const adImport = latestImport(adImports ?? []);
  const [searchConsoleRows, ga4Rows, adRows] = await Promise.all([
    searchConsoleImport
      ? safe(async () => (await fetchSearchConsoleRows([searchConsoleImport.id]))?.[searchConsoleImport.id] ?? [], [])
      : Promise.resolve([]),
    ga4Import
      ? safe(async () => (await fetchGa4Rows([ga4Import.id]))?.[ga4Import.id] ?? [], [])
      : Promise.resolve([]),
    adImport
      ? safe(async () => (await fetchAdCsvRows([adImport.id]))?.[adImport.id] ?? [], [])
      : Promise.resolve([]),
  ]);
  const pages = new Map<string, PageAccumulator>();
  addSearchConsoleRows(pages, searchConsoleRows);
  addGa4Rows(pages, ga4Rows);
  addAdRows(pages, adRows);
  const rows = [...pages.values()]
    .map(toIntegratedPage)
    .sort((first, second) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[first.priority] - priorityOrder[second.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const firstSignal = (first.searchConsole?.impressions ?? 0) + (first.ga4?.sessions ?? 0) + (first.ads?.clicks ?? 0);
      const secondSignal = (second.searchConsole?.impressions ?? 0) + (second.ga4?.sessions ?? 0) + (second.ads?.clicks ?? 0);
      return secondSignal - firstSignal;
    })
    .slice(0, 100);

  return {
    pagesWithAds: rows.filter((row) => row.ads).length,
    pagesWithGa4: rows.filter((row) => row.ga4).length,
    pagesWithSearchConsole: rows.filter((row) => row.searchConsole).length,
    rows,
    sources: {
      ads: adImport
        ? sourceStatus(sourceLabelForAdImport(adImport), adImport.periodStart, adImport.periodEnd, adImport.updatedAt, `${adImport.validRowCount}行`)
        : null,
      ga4: ga4Import
        ? sourceStatus(sourceLabelForGa4Import(ga4Import), ga4Import.periodStart, ga4Import.periodEnd, ga4Import.updatedAt, `${ga4Import.rowCount}行`)
        : null,
      searchConsole: searchConsoleImport
        ? sourceStatus(`Search Console CSV / ${searchConsoleImport.fileName}`, searchConsoleImport.periodStart, searchConsoleImport.periodEnd, searchConsoleImport.updatedAt, `${searchConsoleImport.rowCount}行・${searchConsoleImport.importType}`)
        : null,
    },
    totalAdConversions: rows.reduce((total, row) => total + (row.ads?.conversions ?? 0), 0),
    totalAdCost: rows.reduce((total, row) => total + (row.ads?.cost ?? 0), 0),
    totalGa4Sessions: rows.reduce((total, row) => total + (row.ga4?.sessions ?? 0), 0),
    totalSearchClicks: rows.reduce((total, row) => total + (row.searchConsole?.clicks ?? 0), 0),
  };
}
