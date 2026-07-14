import { fetchAdCsvImports } from "@/lib/supabase/adCsv.server";
import { fetchAdCreatives } from "@/lib/supabase/adCreatives.server";
import { createPageIntegrationSummary } from "@/lib/dashboard/pageIntegration.server";
import { fetchGa4Analyses, fetchGa4Imports } from "@/lib/supabase/ga4.server";
import {
  fetchSearchConsoleAnalyses,
  fetchSearchConsoleImports,
  fetchSeoTasks,
} from "@/lib/supabase/searchConsole.server";
import {
  getServerSupabaseClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/serverClient";
import { dummyBlogPosts } from "@/data/dummyBlogPosts";
import { dummyGa4Dataset, ga4MockAnalysis } from "@/data/ga4";
import {
  dummyAdReports,
  dummySeoReports,
  dummySeoTasks,
  seoMockAnalysis,
} from "@/data/seoAds";
import type { BlogStatus } from "@/types/blog";
import type {
  DashboardTaskItem,
  FinalMarketingDashboardSummary,
} from "@/types/marketingDashboard";
import type { PageIntegrationSummary } from "@/types/pageIntegration";
import type { SeoPriority, SeoTask } from "@/types/seoAds";

type BlogStatusCounts = {
  draftCount: number;
  latestTitle: string;
  publishedCount: number;
  readyCount: number;
  totalCount: number;
};

const completedStatuses = new Set([
  "done",
  "completed",
  "published",
  "完了",
  "対応済み",
  "公開済み",
]);

const actionableCreativeStatuses = new Set(["draft", "reviewing", "approved"]);

function yen(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function priorityRank(priority: SeoPriority) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function normalizeTaskPriority(value: string): SeoPriority {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function toTaskItem(task: SeoTask, source = "SEOタスク"): DashboardTaskItem {
  return {
    href: "/seo/tasks",
    label: task.title,
    priority: normalizeTaskPriority(task.priority),
    source,
  };
}

function uniqueTasks(items: DashboardTaskItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}:${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickActionTasks(tasks: SeoTask[]) {
  return tasks
    .filter((task) => !completedStatuses.has(task.status))
    .sort((first, second) => {
      const priorityDiff =
        priorityRank(normalizeTaskPriority(first.priority)) -
        priorityRank(normalizeTaskPriority(second.priority));
      if (priorityDiff !== 0) return priorityDiff;
      return (first.dueDate || "9999-12-31").localeCompare(
        second.dueDate || "9999-12-31",
      );
    })
    .map((task) => toTaskItem(task));
}

async function fetchBlogStatusCounts(): Promise<BlogStatusCounts | null> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("title,status,updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    status: BlogStatus | string | null;
    title: string | null;
    updated_at: string;
  }>;

  return {
    draftCount: rows.filter((row) => row.status === "draft").length,
    latestTitle: rows[0]?.title ?? "",
    publishedCount: rows.filter((row) => row.status === "published").length,
    readyCount: rows.filter((row) => row.status === "ready").length,
    totalCount: rows.length,
  };
}

function createDummyBlogStatusCounts(): BlogStatusCounts {
  return {
    draftCount: dummyBlogPosts.filter((post) => post.status === "draft").length,
    latestTitle: dummyBlogPosts[0]?.title ?? "",
    publishedCount: dummyBlogPosts.filter((post) => post.status === "published")
      .length,
    readyCount: dummyBlogPosts.filter((post) => post.status === "ready").length,
    totalCount: dummyBlogPosts.length,
  };
}

function createEmptyBlogStatusCounts(): BlogStatusCounts {
  return {
    draftCount: 0,
    latestTitle: "",
    publishedCount: 0,
    readyCount: 0,
    totalCount: 0,
  };
}

async function safe<T>(fallback: T, callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    console.warn("[final-dashboard] data fallback", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  }
}

export async function createFinalMarketingDashboardSummary(): Promise<FinalMarketingDashboardSummary> {
  const usesSupabase = isServerSupabaseConfigured();
  const [
    searchConsoleImports,
    ga4Imports,
    adImports,
    seoTasks,
    blogCounts,
    pageIntegration,
  ] = await Promise.all([
    safe(null, () => fetchSearchConsoleImports(2)),
    safe(null, () => fetchGa4Imports(2)),
    safe(null, () => fetchAdCsvImports(2)),
    safe(null, () => fetchSeoTasks()),
    safe(null, () => fetchBlogStatusCounts()),
    safe<PageIntegrationSummary | null>(null, () => createPageIntegrationSummary()),
  ]);

  const latestSearchConsole = searchConsoleImports?.[0];
  const latestGa4 = ga4Imports?.[0];
  const latestAdImport = adImports?.[0];
  const [searchConsoleAnalyses, ga4Analyses, adCreatives] = await Promise.all([
    latestSearchConsole
      ? safe(null, () => fetchSearchConsoleAnalyses([latestSearchConsole.id]))
      : Promise.resolve(null),
    latestGa4
      ? safe(null, () => fetchGa4Analyses([latestGa4.id]))
      : Promise.resolve(null),
    safe(null, () => fetchAdCreatives()),
  ]);

  const latestSeoAnalysis = latestSearchConsole
    ? searchConsoleAnalyses?.[latestSearchConsole.id]
    : null;
  const latestGa4Analysis = latestGa4 ? ga4Analyses?.[latestGa4.id] : null;
  const fallbackAdTotals = dummyAdReports.reduce(
    (totals, report) => ({
      clicks: totals.clicks + report.clicks,
      conversions: totals.conversions + report.conversions,
      cost: totals.cost + report.cost,
      impressions: totals.impressions + report.impressions,
    }),
    { clicks: 0, conversions: 0, cost: 0, impressions: 0 },
  );
  const adMetrics = latestAdImport?.metrics ??
    (usesSupabase
      ? {
          averageCpa: 0,
          averageCpc: 0,
          averageCtr: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalCost: 0,
          totalImpressions: 0,
        }
      : {
          averageCpa:
            fallbackAdTotals.conversions > 0
              ? fallbackAdTotals.cost / fallbackAdTotals.conversions
              : 0,
          averageCpc:
            fallbackAdTotals.clicks > 0
              ? fallbackAdTotals.cost / fallbackAdTotals.clicks
              : 0,
          averageCtr:
            fallbackAdTotals.impressions > 0
              ? fallbackAdTotals.clicks / fallbackAdTotals.impressions
              : 0,
          totalClicks: fallbackAdTotals.clicks,
          totalConversions: fallbackAdTotals.conversions,
          totalCost: fallbackAdTotals.cost,
          totalImpressions: fallbackAdTotals.impressions,
        });
  const seoReport = dummySeoReports[0];
  const ga4Metrics = latestGa4?.metrics ??
    (usesSupabase
      ? {
          averageEngagementSeconds: 0,
          conversions: 0,
          engagementRate: 0,
          landingPageCount: 0,
          lineClicks: 0,
          reservationClicks: 0,
          sessions: 0,
          sourceCount: 0,
          users: 0,
          views: 0,
        }
      : dummyGa4Dataset.imports[0].metrics);
  const taskItems = seoTasks
    ? pickActionTasks(seoTasks)
    : usesSupabase
      ? []
      : pickActionTasks(dummySeoTasks);
  const analysisTasks = [
    ...(latestSeoAnalysis?.monthlyTasks ?? []),
    ...(latestGa4Analysis?.monthlyTasks ??
      (usesSupabase ? [] : ga4MockAnalysis.monthlyTasks)),
  ].map((task) => ({
    href: "/seo/tasks",
    label: task.title,
    priority: normalizeTaskPriority(task.priority),
    source: "Gemini提案",
  }));
  const adAction =
    (adCreatives ?? []).some((creative) =>
      actionableCreativeStatuses.has(creative.status),
    )
      ? [
          {
            href: "/ads/creatives",
            label: "生成済み広告案を確認して、使う広告文を選ぶ",
            priority: "medium" as const,
            source: "広告案",
          },
        ]
      : !usesSupabase
        ? [
          {
            href: "/ads/creatives",
            label: "LINE相談につながる広告案を1つ作る",
            priority: "medium" as const,
            source: "広告案",
          },
          ]
        : [];
  const pageIntegrationCard = {
    highPriorityPages:
      pageIntegration?.rows.filter((row) => row.priority === "high").length ?? 0,
    pageCount: pageIntegration?.rows.length ?? 0,
    pagesWithAllSources:
      pageIntegration?.rows.filter(
        (row) => Boolean(row.searchConsole && row.ga4 && row.ads),
      ).length ?? 0,
    sourceLabel:
      [
        pageIntegration?.sources.searchConsole,
        pageIntegration?.sources.ga4,
        pageIntegration?.sources.ads,
      ]
        .filter((source): source is NonNullable<typeof source> => Boolean(source))
        .map((source) => `${source.label} / ${source.period}`)
        .join(" / ") || "未取り込み・データ待ち",
  };
  const pageIntegrationActions: DashboardTaskItem[] =
    pageIntegrationCard.highPriorityPages > 0
      ? [
          {
            href: "/seo/integrated",
            label: `高優先のページ統合候補を確認する（${pageIntegrationCard.highPriorityPages}件）`,
            priority: "high",
            source: "ページ統合",
          },
        ]
      : [];
  const unfinishedTasks = uniqueTasks([
    ...taskItems,
    ...analysisTasks,
    ...adAction,
    ...pageIntegrationActions,
  ]);
  const todayActions = uniqueTasks([
    ...unfinishedTasks.filter((task) => task.priority === "high"),
    {
      href: "/quality-check",
      label: "公開前のブログ・広告文をAI品質チェックに通す",
      priority: "high",
      source: "品質確認",
    },
    {
      href: "/seo/ga4",
      label: "LINE導線の弱いページを1つ確認する",
      priority: "medium",
      source: "LINE導線",
    },
    ...(pageIntegrationCard.pageCount > 0
      ? [
          {
            href: "/seo/integrated",
            label: "検索・閲覧・広告を同じページで確認する",
            priority: "medium" as const,
            source: "ページ統合",
          },
        ]
      : []),
  ]).slice(0, 5);
  const monthlyActions = uniqueTasks([
    ...analysisTasks,
    ...taskItems,
    {
      href: "/blog",
      label: "髪質改善・縮毛矯正の下書きを1本完成させる",
      priority: "high",
      source: "ブログ",
    },
    {
      href: "/ads/imports",
      label: "広告費・CV・CPAを月次で確認する",
      priority: "medium",
      source: "広告",
    },
    {
      href: "/seo/integrated",
      label:
        pageIntegrationCard.pageCount > 0
          ? "ページ単位で検索・閲覧・広告を照合する"
          : "Search Console・GA4・広告を取り込んでページ統合分析を確認する",
      priority: "medium",
      source: "ページ統合",
    },
  ]).slice(0, 7);
  const geminiReview =
    latestSeoAnalysis?.summary ||
    latestGa4Analysis?.summary ||
    (usesSupabase
      ? "Gemini分析はまだありません。集計データを取り込んで分析を実行してください。"
      : seoReport.aiAnalysis || seoMockAnalysis);
  const hasAnyRealData = Boolean(
    latestSearchConsole || latestGa4 || latestAdImport || blogCounts,
  );
  const hasAllPrimaryData = Boolean(
    latestSearchConsole && latestGa4 && latestAdImport && blogCounts,
  );
  const blogStatus = blogCounts ??
    (usesSupabase ? createEmptyBlogStatusCounts() : createDummyBlogStatusCounts());

  return {
    ad: {
      clicks: adMetrics.totalClicks,
      conversions: adMetrics.totalConversions,
      cost: yen(adMetrics.totalCost),
      cpa: yen(adMetrics.averageCpa),
      ctr: adMetrics.averageCtr,
      hasData: Boolean(latestAdImport) || !usesSupabase,
      impressions: adMetrics.totalImpressions,
      sourceLabel: latestAdImport
        ? `${latestAdImport.platform} / ${latestAdImport.periodStart}〜${latestAdImport.periodEnd}`
        : usesSupabase
          ? "未取り込み"
          : "確認用サンプル広告",
    },
    blog: {
      ...blogStatus,
      hasData: Boolean(blogCounts) || !usesSupabase,
      sourceLabel: blogCounts
        ? "保存済みブログ記事"
        : usesSupabase
          ? "未取り込み"
          : "確認用サンプルブログ",
    },
    generatedAt: new Date().toISOString(),
    geminiReview,
    line: {
      conversions: ga4Metrics.conversions,
      hasData: Boolean(latestGa4) || !usesSupabase,
      lineClicks: ga4Metrics.lineClicks,
      reservationClicks: ga4Metrics.reservationClicks,
      sourceLabel: latestGa4
        ? `${latestGa4.periodStart}〜${latestGa4.periodEnd}`
        : usesSupabase
          ? "未取り込み"
          : "確認用サンプルGA4",
    },
    pageIntegration: pageIntegrationCard,
    monthlyActions,
    seo: {
      averagePosition:
        latestSearchConsole?.metrics.averagePosition ??
        (usesSupabase ? 0 : seoReport.averagePosition),
      clicks: latestSearchConsole?.metrics.clicks ??
        (usesSupabase ? 0 : seoReport.clicks),
      ctr: latestSearchConsole?.metrics.ctr ??
        (usesSupabase ? 0 : seoReport.ctr / 100),
      hasData: Boolean(latestSearchConsole) || !usesSupabase,
      impressions:
        latestSearchConsole?.metrics.impressions ??
        (usesSupabase ? 0 : seoReport.impressions),
      sourceLabel: latestSearchConsole
        ? `${latestSearchConsole.periodStart}〜${latestSearchConsole.periodEnd}`
        : usesSupabase
          ? "未取り込み"
          : "確認用サンプルSEOレポート",
    },
    sourceMode: !usesSupabase
      ? "sample"
      : !hasAnyRealData
        ? "empty"
        : hasAllPrimaryData
          ? "supabase"
          : "mixed",
    todayActions,
    unfinishedTasks: unfinishedTasks.slice(0, 6),
  };
}
