"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type {
  DashboardTaskItem,
  FinalMarketingDashboardSummary,
} from "@/types/marketingDashboard";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

function formatNumber(value: number) {
  return value.toLocaleString("ja-JP");
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatCpa(value: number) {
  return value > 0 ? formatYen(value) : "算出不可";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceModeLabel(
  sourceMode: FinalMarketingDashboardSummary["sourceMode"],
) {
  if (sourceMode === "supabase") return "実データ";
  if (sourceMode === "mixed") return "一部未取り込み";
  if (sourceMode === "empty") return "データ待ち";
  return "確認用サンプル";
}

function sourceModeTone(
  sourceMode: FinalMarketingDashboardSummary["sourceMode"],
) {
  if (sourceMode === "supabase") return "success";
  if (sourceMode === "empty") return "info";
  return "warning";
}

function sourceModeMessage(
  sourceMode: FinalMarketingDashboardSummary["sourceMode"],
) {
  if (sourceMode === "supabase") {
    return "Supabaseに保存された最新データを集約しています。";
  }
  if (sourceMode === "mixed") {
    return "一部の指標が未取り込みです。各カードのデータ元を確認してください。";
  }
  if (sourceMode === "empty") {
    return "Supabaseに集計データがまだありません。Search Console、GA4、広告CSVの取り込みから始めてください。";
  }
  return "Supabase未設定のため、確認用サンプルを表示しています。";
}

function priorityLabel(priority: DashboardTaskItem["priority"]) {
  if (priority === "high") return "優先";
  if (priority === "medium") return "確認";
  return "低";
}

function priorityTone(priority: DashboardTaskItem["priority"]) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "neutral";
}

function MetricCard({
  helper,
  href,
  label,
  sourceLabel,
  value,
}: {
  helper: string;
  href: string;
  label: string;
  sourceLabel: string;
  value: string;
}) {
  return (
    <Link
      className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50"
      href={href}
    >
      <p className="break-words text-sm font-semibold text-stone-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{helper}</p>
      <p className="mt-2 break-words border-t border-stone-100 pt-2 text-xs leading-5 text-stone-500">
        データ元: {sourceLabel}
      </p>
    </Link>
  );
}

function TaskList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: DashboardTaskItem[];
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-stone-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <Link
          className="block rounded-md border border-stone-200 bg-white p-3 transition hover:border-teal-200 hover:bg-teal-50"
          href={item.href}
          key={`${item.label}-${index}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={priorityTone(item.priority)}>
              {priorityLabel(item.priority)}
            </Badge>
            <span className="text-xs font-semibold text-stone-500">
              {item.source}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-stone-950">
            {item.label}
          </p>
        </Link>
      ))}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="h-5 w-48 animate-pulse rounded bg-stone-100" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="h-28 animate-pulse rounded-lg bg-stone-100"
            key={index}
          />
        ))}
      </div>
    </section>
  );
}

export function FinalMarketingDashboard() {
  const [summary, setSummary] =
    useState<FinalMarketingDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tone, setTone] = useState<StatusTone>("info");
  const [message, setMessage] = useState("今月の集客状況を読み込んでいます。");

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/api/dashboard/monthly", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          error?: string;
          summary?: FinalMarketingDashboardSummary;
        };
        if (!response.ok || !data.summary) {
          throw new Error(data.error || "ダッシュボードを読み込めませんでした。");
        }
        if (!isMounted) return;
        setSummary(data.summary);
        setTone(sourceModeTone(data.summary.sourceMode));
        setMessage(sourceModeMessage(data.summary.sourceMode));
      } catch (error) {
        if (!isMounted) return;
        setTone("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "ダッシュボードを読み込めませんでした。",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        helper: summary.seo.hasData
          ? `${summary.seo.impressions.toLocaleString("ja-JP")}表示 / CTR ${formatPercent(summary.seo.ctr)} / 平均順位 ${summary.seo.averagePosition.toFixed(1)}`
          : "Search Consoleデータがまだありません",
        href: "/seo/search-console",
        label: "今月のSEO状況",
        sourceLabel: summary.seo.sourceLabel,
        value: summary.seo.hasData
          ? `${formatNumber(summary.seo.clicks)}クリック`
          : "未取得",
      },
      {
        helper: summary.ad.hasData
          ? `${formatNumber(summary.ad.clicks)}クリック / CTR ${formatPercent(summary.ad.ctr)} / CPA ${formatCpa(summary.ad.cpa)}`
          : "広告データがまだありません",
        href: "/ads/imports",
        label: "広告状況",
        sourceLabel: summary.ad.sourceLabel,
        value: summary.ad.hasData ? formatYen(summary.ad.cost) : "未取得",
      },
      {
        helper: summary.blog.hasData
          ? `下書き ${summary.blog.draftCount} / 公開 ${summary.blog.publishedCount}`
          : "ブログデータがまだありません",
        href: "/blog",
        label: "ブログ状況",
        sourceLabel: summary.blog.sourceLabel,
        value: summary.blog.hasData
          ? `${formatNumber(summary.blog.totalCount)}記事`
          : "未取得",
      },
      {
        helper: summary.line.hasData
          ? `予約クリック ${formatNumber(summary.line.reservationClicks)} / キーイベント ${formatNumber(summary.line.conversions)}`
          : "GA4データがまだありません",
        href: "/seo/ga4",
        label: "LINE導線",
        sourceLabel: summary.line.sourceLabel,
        value: summary.line.hasData
          ? `${formatNumber(summary.line.lineClicks)} LINEクリック`
          : "未取得",
      },
      {
        helper: `高優先 ${summary.pageIntegration.highPriorityPages}件 / 3媒体一致 ${summary.pageIntegration.pagesWithAllSources}件`,
        href: "/seo/integrated",
        label: "ページ統合分析",
        sourceLabel: summary.pageIntegration.sourceLabel,
        value: `${formatNumber(summary.pageIntegration.pageCount)}ページ`,
      },
    ];
  }, [summary]);

  if (isLoading) return <SkeletonDashboard />;

  return (
    <section className="mb-6 space-y-5 rounded-lg border border-teal-200 bg-teal-50/60 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">
            集客ダッシュボード
          </p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">
            今月の状況と次にやること
          </h2>
        </div>
        {summary ? (
          <Badge tone={sourceModeTone(summary.sourceMode)}>
            {sourceModeLabel(summary.sourceMode)}
          </Badge>
        ) : null}
      </div>

      <StatusMessage tone={tone}>{message}</StatusMessage>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard
                helper={metric.helper}
                href={metric.href}
                key={metric.label}
                label={metric.label}
                sourceLabel={metric.sourceLabel}
                value={metric.value}
              />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-stone-950">Geminiの総評</h3>
                <Badge tone="info">最新分析</Badge>
              </div>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {summary.geminiReview}
              </p>
              <div className="mt-4 grid gap-2 text-xs text-stone-500 sm:grid-cols-2">
                <p className="break-words">SEO: {summary.seo.sourceLabel}</p>
                <p className="break-words">広告: {summary.ad.sourceLabel}</p>
                <p className="break-words">LINE: {summary.line.sourceLabel}</p>
                <p className="break-words">統合: {summary.pageIntegration.sourceLabel}</p>
                <p className="break-words">
                  最新ブログ: {summary.blog.latestTitle || "未登録"}
                </p>
              </div>
              <p className="mt-3 text-xs text-stone-500">
                画面を集計した時刻: {formatDateTime(summary.generatedAt)}
              </p>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-stone-950">未完了タスク</h3>
                <Badge tone={summary.unfinishedTasks.length ? "warning" : "success"}>
                  {summary.unfinishedTasks.length}件
                </Badge>
              </div>
              <div className="mt-3">
                <TaskList
                  emptyText="未完了タスクはありません。"
                  items={summary.unfinishedTasks}
                />
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-stone-950">ページ統合分析</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  検索流入、サイト内行動、広告結果をページ単位で照合し、改善の優先順位を確認します。
                </p>
              </div>
              <Badge
                tone={summary.pageIntegration.highPriorityPages ? "danger" : "info"}
              >
                高優先 {summary.pageIntegration.highPriorityPages}件
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
              <span>対象 {formatNumber(summary.pageIntegration.pageCount)}ページ</span>
              <span>3媒体のデータが揃うページ {formatNumber(summary.pageIntegration.pagesWithAllSources)}件</span>
            </div>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-md border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
              href="/seo/integrated"
            >
              ページ別に確認
            </Link>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h3 className="font-semibold text-stone-950">今日やること</h3>
              <div className="mt-3">
                <TaskList
                  emptyText="今日やることはありません。"
                  items={summary.todayActions}
                />
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h3 className="font-semibold text-stone-950">今月やること</h3>
              <div className="mt-3">
                <TaskList
                  emptyText="今月やることはありません。"
                  items={summary.monthlyActions}
                />
              </div>
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              className="min-h-11 rounded-md bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800"
              href="/seo/search-console"
            >
              SEO分析を見る
            </Link>
            <Link
              className="min-h-11 rounded-md border border-teal-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-800 hover:bg-teal-50"
              href="/ads/imports"
            >
              広告集計を見る
            </Link>
            <Link
              className="min-h-11 rounded-md border border-teal-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-800 hover:bg-teal-50"
              href="/seo/integrated"
            >
              ページ統合分析
            </Link>
            <Link
              className="min-h-11 rounded-md border border-stone-300 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
              href="/quality-check"
            >
              公開前チェック
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
