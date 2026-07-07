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
  value,
}: {
  helper: string;
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50"
      href={href}
    >
      <p className="text-sm font-semibold text-stone-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{helper}</p>
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
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
        setTone(data.summary.sourceMode === "supabase" ? "success" : "warning");
        setMessage(
          data.summary.sourceMode === "supabase"
            ? "Supabaseに保存された最新データを集約しています。"
            : "データ不足のため、サンプルを含めて表示しています。",
        );
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
        helper: `${summary.seo.impressions.toLocaleString("ja-JP")}表示 / CTR ${formatPercent(summary.seo.ctr)} / 平均順位 ${summary.seo.averagePosition.toFixed(1)}`,
        href: "/seo/search-console",
        label: "今月のSEO状況",
        value: `${formatNumber(summary.seo.clicks)}クリック`,
      },
      {
        helper: `${formatNumber(summary.ad.clicks)}クリック / CTR ${formatPercent(summary.ad.ctr)} / CPA ${formatYen(summary.ad.cpa)}`,
        href: "/ads/imports",
        label: "広告状況",
        value: formatYen(summary.ad.cost),
      },
      {
        helper: `下書き ${summary.blog.draftCount} / 公開 ${summary.blog.publishedCount}`,
        href: "/blog",
        label: "ブログ状況",
        value: `${formatNumber(summary.blog.totalCount)}記事`,
      },
      {
        helper: `予約クリック ${formatNumber(summary.line.reservationClicks)} / CV ${formatNumber(summary.line.conversions)}`,
        href: "/seo/ga4",
        label: "LINE導線",
        value: `${formatNumber(summary.line.lineClicks)}クリック`,
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
          <Badge tone={summary.sourceMode === "supabase" ? "success" : "warning"}>
            {summary.sourceMode === "supabase" ? "実データ" : "サンプル含む"}
          </Badge>
        ) : null}
      </div>

      <StatusMessage tone={tone}>{message}</StatusMessage>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard
                helper={metric.helper}
                href={metric.href}
                key={metric.label}
                label={metric.label}
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
                <p>SEO: {summary.seo.sourceLabel}</p>
                <p>広告: {summary.ad.sourceLabel}</p>
                <p>LINE: {summary.line.sourceLabel}</p>
                <p>
                  最新ブログ: {summary.blog.latestTitle || "未登録"}
                </p>
              </div>
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

          <div className="grid gap-3 sm:grid-cols-3">
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
