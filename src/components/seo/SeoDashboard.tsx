import Link from "next/link";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { DataScopePanel } from "@/components/marketing/DataScopePanel";
import { Badge } from "@/components/ui/Badge";
import {
  dummySeoKeywords,
  dummySeoPages,
  dummySeoReports,
  dummySeoTasks,
  seoMockAnalysis,
} from "@/data/seoAds";
import { fetchGa4Imports } from "@/lib/supabase/ga4.server";
import {
  fetchSearchConsoleImports,
  fetchSeoTasks,
} from "@/lib/supabase/searchConsole.server";
import type { Ga4Import } from "@/types/ga4";
import type { SearchConsoleImport } from "@/types/searchConsole";
import type { SeoPriority } from "@/types/seoAds";

const priorityLabels: Record<SeoPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const priorityTones: Record<SeoPriority, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

type SeoDashboardData = {
  ga4Import: Ga4Import | null;
  searchConsoleImport: SearchConsoleImport | null;
  tasks: typeof dummySeoTasks;
};

async function loadSeoDashboardData(): Promise<SeoDashboardData> {
  const [searchConsoleResult, ga4Result, tasksResult] = await Promise.allSettled([
    fetchSearchConsoleImports(1),
    fetchGa4Imports(1),
    fetchSeoTasks(),
  ]);
  const searchConsoleImports =
    searchConsoleResult.status === "fulfilled" ? searchConsoleResult.value : null;
  const ga4Imports = ga4Result.status === "fulfilled" ? ga4Result.value : null;
  const savedTasks = tasksResult.status === "fulfilled" ? tasksResult.value : null;

  return {
    ga4Import: ga4Imports?.[0] ?? null,
    searchConsoleImport: searchConsoleImports?.[0] ?? null,
    tasks: savedTasks?.length ? savedTasks : dummySeoTasks,
  };
}

function formatPeriod(periodStart: string, periodEnd: string) {
  return `${periodStart}〜${periodEnd}`;
}

function formatGa4Source(ga4Import: Ga4Import) {
  return ga4Import.fileName.startsWith("ga4-data-api-")
    ? "Google Analytics Data API"
    : `GA4 CSV / ${ga4Import.fileName}`;
}

export async function SeoDashboard() {
  const { ga4Import, searchConsoleImport, tasks } =
    await loadSeoDashboardData();
  const sampleReport = dummySeoReports[0];
  const report = searchConsoleImport
    ? {
        ...sampleReport,
        clicks: searchConsoleImport.metrics.clicks,
        impressions: searchConsoleImport.metrics.impressions,
        ctr: searchConsoleImport.metrics.ctr * 100,
        averagePosition: searchConsoleImport.metrics.averagePosition,
      }
    : sampleReport;
  const hasSearchConsoleData = Boolean(searchConsoleImport);
  const hasSavedTasks = tasks !== dummySeoTasks;
  const metrics = [
    {
      label: hasSearchConsoleData ? "クリック数" : "参考クリック数",
      value: report.clicks.toLocaleString("ja-JP"),
    },
    {
      label: hasSearchConsoleData ? "表示回数" : "参考表示回数",
      value: report.impressions.toLocaleString("ja-JP"),
    },
    {
      label: hasSearchConsoleData ? "平均CTR" : "参考CTR",
      value: `${report.ctr.toFixed(2)}%`,
    },
    {
      label: hasSearchConsoleData ? "平均掲載順位" : "参考掲載順位",
      value: report.averagePosition.toFixed(1),
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <DataScopePanel
        collected={[
          "クリック数・表示回数・CTR・平均掲載順位",
          "選択したSearch Console取り込みの対象期間と種別",
          "取り込み済みデータがある場合は、その最新集計値",
        ]}
        description={
          hasSearchConsoleData
            ? "最新のSearch Console取り込みを優先して表示しています。対象期間とデータ種別を確認してから、数値を判断してください。"
            : "Search Consoleの取り込みがまだないため、参考値を表示しています。CSVを取り込むと最新の実績に切り替わります。"
        }
        href="/seo/search-console"
        limitations={[
          "Search Console APIとの直接連携は未対応です。CSVを取り込んだ分だけが分析対象です。",
          "対象期間やデータ種別が異なるCSVを取り込むと、別の取り込みデータとして扱われます。",
        ]}
        linkLabel="Search Consoleの詳細を見る"
        period={
          searchConsoleImport
            ? formatPeriod(searchConsoleImport.periodStart, searchConsoleImport.periodEnd)
            : undefined
        }
        sourceKind={hasSearchConsoleData ? "csv" : "sample"}
        sourceLabel={
          searchConsoleImport
            ? `Search Console CSV / ${searchConsoleImport.fileName}`
            : "Search Console未取り込み・参考データ"
        }
        updatedAt={searchConsoleImport?.updatedAt}
      />

      <DataScopePanel
        collected={[
          "ユーザー・セッション・表示回数・エンゲージメント",
          "ランディングページと流入元・メディア",
          "計測されている場合のLINEクリック・予約クリック・キーイベント",
        ]}
        description={
          ga4Import
            ? "最新のGA4データを、Search Consoleとは別のサイト内行動データとして表示しています。"
            : "GA4の取り込みがまだないため、この画面ではサイト内行動の実績を表示していません。"
        }
        href="/seo/ga4"
        limitations={[
          "LINE・予約クリックは、GA4側で対応するイベントが正しく計測されている場合だけ確認できます。",
          "GA4の未取り込み期間や、設定されていないイベントは集計できません。",
        ]}
        linkLabel="GA4の詳細を見る"
        period={ga4Import ? formatPeriod(ga4Import.periodStart, ga4Import.periodEnd) : undefined}
        sourceKind={
          ga4Import
            ? ga4Import.fileName.startsWith("ga4-data-api-")
              ? "api"
              : "csv"
            : "sample"
        }
        sourceLabel={ga4Import ? formatGa4Source(ga4Import) : "GA4未取り込み"}
        updatedAt={ga4Import?.updatedAt}
        title="サイト内行動データ"
      />

      <section className="flex flex-col gap-4 border-y border-teal-200 bg-teal-50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-teal-950">Search Console CSV分析</h2>
          <p className="mt-1 text-sm leading-6 text-teal-900">検索データを取り込み、CTR・順位・改善候補を実データで確認できます。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white" href="/seo/search-console">分析を見る</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-teal-300 bg-white px-3 text-sm font-semibold text-teal-800" href="/seo/search-console/import">CSVを取り込む</Link>
        </div>
      </section>
      <section className="flex flex-col gap-4 border-y border-sky-200 bg-sky-50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-sky-950">GA4分析</h2>
          <p className="mt-1 text-sm leading-6 text-sky-900">CSVまたは公式Data APIで取得した、アクセス後の行動、LINEクリック、予約導線、ページ改善候補を確認できます。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-sky-700 px-3 text-sm font-semibold text-white" href="/seo/ga4">GA4分析を見る</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white" href="/seo/conversions">CV分析を見る</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800" href="/seo/ga4/import">GA4 CSVを取り込む</Link>
        </div>
      </section>

      {ga4Import ? (
        <section className="rounded-lg border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">最新GA4実績</h2>
              <p className="mt-1 text-sm text-stone-500">
                {formatPeriod(ga4Import.periodStart, ga4Import.periodEnd)} / {formatGa4Source(ga4Import)}
              </p>
            </div>
            <Badge tone="success">実データ</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <MetricCard label="ユーザー" value={ga4Import.metrics.users.toLocaleString("ja-JP")} />
            <MetricCard label="セッション" value={ga4Import.metrics.sessions.toLocaleString("ja-JP")} />
            <MetricCard label="表示回数" value={ga4Import.metrics.views.toLocaleString("ja-JP")} />
            <MetricCard label="LINEクリック" value={ga4Import.metrics.lineClicks.toLocaleString("ja-JP")} />
            <MetricCard label="予約クリック" value={ga4Import.metrics.reservationClicks.toLocaleString("ja-JP")} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-4">
          <Badge tone={hasSearchConsoleData ? "success" : "warning"}>
            {hasSearchConsoleData ? "Search Console実績" : "参考データ"}
          </Badge>
          <p className="mt-2 text-sm text-stone-600">
            {hasSearchConsoleData
              ? "最新のSearch Console取り込みをもとに表示しています。詳しい候補や期間比較は分析画面で確認してください。"
              : "Search Consoleの実績を表示するには、CSV取り込みが必要です。現在の数値は参考値です。"}
          </p>
        </div>
        {metrics.map((metric) => (
          <article
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm font-medium text-stone-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-stone-950">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">優先キーワード（管理用）</h2>
            <Link className="text-sm font-semibold text-teal-700" href="/seo/keywords">
              すべて見る
            </Link>
          </div>
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white shadow-sm">
            {dummySeoKeywords.slice(0, 4).map((item) => (
              <article className="p-4" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-stone-950">{item.keyword}</h3>
                  <Badge tone={priorityTones[item.priority]}>
                    優先度 {priorityLabels[item.priority]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.intent}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">改善すべきページ（管理用）</h2>
            <Link className="text-sm font-semibold text-teal-700" href="/seo/pages">
              すべて見る
            </Link>
          </div>
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white shadow-sm">
            {dummySeoPages.map((page) => (
              <article className="p-4" key={page.id}>
                <h3 className="font-semibold text-stone-950">{page.pageTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-rose-700">{page.currentIssue}</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  改善案: {page.suggestedAction}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-stone-950">今月やるSEOタスク</h2>
          <Badge tone={hasSavedTasks ? "success" : "warning"}>
            {hasSavedTasks ? "Supabase保存" : "参考タスク"}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {tasks.map((task) => (
            <article
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              key={task.id}
            >
              <div className="flex flex-wrap gap-2">
                <Badge tone={priorityTones[task.priority]}>
                  優先度 {priorityLabels[task.priority]}
                </Badge>
                <Badge>{task.status}</Badge>
              </div>
              <h3 className="mt-3 font-semibold leading-6 text-stone-950">{task.title}</h3>
              <p className="mt-2 text-sm text-stone-500">期限: {task.dueDate}</p>
            </article>
          ))}
        </div>
      </section>

      <AiAnalysisPanel
        context={{
          keywords: dummySeoKeywords,
          pages: dummySeoPages,
          report,
          tasks,
          sources: {
            ga4: ga4Import
              ? {
                  period: formatPeriod(ga4Import.periodStart, ga4Import.periodEnd),
                  source: formatGa4Source(ga4Import),
                  metrics: ga4Import.metrics,
                }
              : null,
            searchConsole: searchConsoleImport
              ? {
                  fileName: searchConsoleImport.fileName,
                  importType: searchConsoleImport.importType,
                  period: formatPeriod(searchConsoleImport.periodStart, searchConsoleImport.periodEnd),
                  metrics: searchConsoleImport.metrics,
                }
              : null,
          },
        }}
        fallbackText={seoMockAnalysis}
        isUsingRealData={Boolean(searchConsoleImport || ga4Import)}
        scope="seo"
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md bg-stone-50 p-3">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-950">{value}</p>
    </article>
  );
}
