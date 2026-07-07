import { fetchAdCsvImports } from "@/lib/supabase/adCsv.server";
import { fetchAdCreatives } from "@/lib/supabase/adCreatives.server";
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
  const [searchConsoleImports, ga4Imports, adImports, seoTasks, blogCounts] =
    await Promise.all([
      safe(null, () => fetchSearchConsoleImports(2)),
      safe(null, () => fetchGa4Imports(2)),
      safe(null, () => fetchAdCsvImports(2)),
      safe(null, () => fetchSeoTasks()),
      safe(null, () => fetchBlogStatusCounts()),
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
  const adMetrics = latestAdImport?.metrics ?? {
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
  };
  const seoReport = dummySeoReports[0];
  const ga4Import = latestGa4 ?? dummyGa4Dataset.imports[0];
  const taskItems = pickActionTasks(seoTasks?.length ? seoTasks : dummySeoTasks);
  const analysisTasks = [
    ...(latestSeoAnalysis?.monthlyTasks ?? []),
    ...(latestGa4Analysis?.monthlyTasks ?? ga4MockAnalysis.monthlyTasks),
  ].map((task) => ({
    href: "/seo/tasks",
    label: task.title,
    priority: normalizeTaskPriority(task.priority),
    source: "Gemini提案",
  }));
  const adAction =
    (adCreatives ?? []).filter((creative) => creative.status !== "used").length > 0
      ? [
          {
            href: "/ads/creatives",
            label: "生成済み広告案を確認して、使う広告文を選ぶ",
            priority: "medium" as const,
            source: "広告案",
          },
        ]
      : [
          {
            href: "/ads/creatives",
            label: "LINE相談につながる広告案を1つ作る",
            priority: "medium" as const,
            source: "広告案",
          },
        ];
  const unfinishedTasks = uniqueTasks([...taskItems, ...analysisTasks, ...adAction]);
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
  ]).slice(0, 7);
  const geminiReview =
    latestSeoAnalysis?.summary ||
    latestGa4Analysis?.summary ||
    seoReport.aiAnalysis ||
    seoMockAnalysis;

  return {
    ad: {
      clicks: adMetrics.totalClicks,
      conversions: adMetrics.totalConversions,
      cost: yen(adMetrics.totalCost),
      cpa: yen(adMetrics.averageCpa),
      ctr: adMetrics.averageCtr,
      impressions: adMetrics.totalImpressions,
      sourceLabel: latestAdImport
        ? `${latestAdImport.platform} / ${latestAdImport.periodStart}〜${latestAdImport.periodEnd}`
        : "サンプル広告レポート",
    },
    blog: blogCounts ?? createDummyBlogStatusCounts(),
    generatedAt: new Date().toISOString(),
    geminiReview,
    line: {
      conversions: ga4Import.metrics.conversions,
      lineClicks: ga4Import.metrics.lineClicks,
      reservationClicks: ga4Import.metrics.reservationClicks,
      sourceLabel: latestGa4
        ? `${latestGa4.periodStart}〜${latestGa4.periodEnd}`
        : "サンプルGA4",
    },
    monthlyActions,
    seo: {
      averagePosition:
        latestSearchConsole?.metrics.averagePosition ?? seoReport.averagePosition,
      clicks: latestSearchConsole?.metrics.clicks ?? seoReport.clicks,
      ctr: latestSearchConsole?.metrics.ctr ?? seoReport.ctr / 100,
      impressions:
        latestSearchConsole?.metrics.impressions ?? seoReport.impressions,
      sourceLabel: latestSearchConsole
        ? `${latestSearchConsole.periodStart}〜${latestSearchConsole.periodEnd}`
        : "サンプルSEOレポート",
    },
    sourceMode:
      usesSupabase &&
      Boolean(latestSearchConsole || latestGa4 || latestAdImport || blogCounts)
        ? "supabase"
        : "sample",
    todayActions,
    unfinishedTasks: unfinishedTasks.slice(0, 6),
  };
}
