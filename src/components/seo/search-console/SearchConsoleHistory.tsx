"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { useSearchConsoleDataset } from "@/components/seo/search-console/useSearchConsoleDataset";

const typeLabels = {
  query: "検索クエリ",
  page: "ページ",
  device: "デバイス",
  country: "国",
  date: "日付",
} as const;

export function SearchConsoleHistory() {
  const { dataset, isLoading, message, storageMode } = useSearchConsoleDataset();

  return (
    <div className="space-y-4 pb-10">
      <StatusMessage isLoading={isLoading} tone={storageMode === "demo" ? "warning" : "info"}>{message}</StatusMessage>
      {dataset.imports.map((item) => {
        const analysis = dataset.analysesByImport[item.id];
        return (
          <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs text-stone-500">{new Date(item.createdAt).toLocaleString("ja-JP")}</p><h2 className="mt-1 text-lg font-semibold text-stone-950">{item.periodStart}〜{item.periodEnd}</h2><p className="mt-1 break-words text-sm text-stone-600">{item.fileName}</p></div>
              <div className="flex gap-2"><Badge tone="info">{typeLabels[item.importType]}</Badge><Badge tone={analysis ? "success" : "neutral"}>{analysis ? analysis.providerLabel : "未分析"}</Badge></div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="行数" value={`${item.rowCount}件`} />
              <Metric label="クリック" value={item.metrics.clicks.toLocaleString("ja-JP")} />
              <Metric label="表示回数" value={item.metrics.impressions.toLocaleString("ja-JP")} />
              <Metric label="CTR" value={`${(item.metrics.ctr * 100).toFixed(2)}%`} />
              <Metric label="平均順位" value={item.metrics.averagePosition.toFixed(1)} />
            </dl>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-stone-950 px-3 text-sm font-semibold text-white" href={`/seo/search-console?importId=${encodeURIComponent(item.id)}`}>詳細を見る</Link>
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700" href={`/seo/search-console?importId=${encodeURIComponent(item.id)}#gemini-analysis`}>{analysis ? "再分析する" : "分析する"}</Link>
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700" href={`/seo/search-console?importId=${encodeURIComponent(item.id)}`}>前月と比較</Link>
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700" href={`/seo/search-console?importId=${encodeURIComponent(item.id)}#gemini-analysis`}>ブログ案を見る</Link>
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700" href={`/seo/tasks?importId=${encodeURIComponent(item.id)}`}>SEOタスクを見る</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-teal-500 pl-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold text-stone-950">{value}</dd></div>;
}
