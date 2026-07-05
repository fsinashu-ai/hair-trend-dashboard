import Link from "next/link";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { Badge } from "@/components/ui/Badge";
import {
  dummySeoKeywords,
  dummySeoPages,
  dummySeoReports,
  dummySeoTasks,
  seoMockAnalysis,
} from "@/data/seoAds";
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

export function SeoDashboard() {
  const report = dummySeoReports[0];
  const metrics = [
    { label: "今月のクリック数", value: report.clicks.toLocaleString("ja-JP") },
    { label: "今月の表示回数", value: report.impressions.toLocaleString("ja-JP") },
    { label: "平均CTR", value: `${report.ctr.toFixed(2)}%` },
    { label: "平均掲載順位", value: report.averagePosition.toFixed(1) },
  ];

  return (
    <div className="space-y-6 pb-10">
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
          <h2 className="text-lg font-semibold text-sky-950">GA4 CSV分析</h2>
          <p className="mt-1 text-sm leading-6 text-sky-900">アクセス後の行動、LINEクリック、予約導線、ページ改善候補を確認できます。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-sky-700 px-3 text-sm font-semibold text-white" href="/seo/ga4">GA4分析を見る</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white" href="/seo/conversions">CV分析を見る</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800" href="/seo/ga4/import">GA4 CSVを取り込む</Link>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <h2 className="text-lg font-semibold text-stone-950">優先キーワード</h2>
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
            <h2 className="text-lg font-semibold text-stone-950">改善すべきページ</h2>
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
        <h2 className="mb-3 text-lg font-semibold text-stone-950">今月やるSEOタスク</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {dummySeoTasks.map((task) => (
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
          tasks: dummySeoTasks,
        }}
        fallbackText={seoMockAnalysis}
        scope="seo"
      />
    </div>
  );
}
