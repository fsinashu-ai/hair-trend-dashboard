"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { backupStorageKeys } from "@/lib/backup/localStorage";
import type { Trend } from "@/types/trend";

type TrendCardProps = {
  isDeleting?: boolean;
  trend: Trend;
  onDelete?: (id: string) => void;
};

const heatTone = {
  高: "danger",
  中: "warning",
  低: "neutral",
} as const;
const relevanceTone = {
  高: "success",
  中: "warning",
  低: "neutral",
} as const;

const visibleKeywordCount = 6;
const recentTrendsStorageKey = backupStorageKeys.recentTrends;

function saveRecentTrend(trend: Trend) {
  if (typeof window === "undefined") {
    return;
  }

  const recentTrend = {
    category: trend.category,
    heat: trend.heat,
    id: trend.id,
    title: trend.title,
    viewedAt: new Date().toISOString(),
  };

  try {
    const savedRecentTrends = JSON.parse(
      window.localStorage.getItem(recentTrendsStorageKey) ?? "[]",
    ) as typeof recentTrend[];
    const nextRecentTrends = [
      recentTrend,
      ...savedRecentTrends.filter((item) => item.id !== trend.id),
    ].slice(0, 5);

    window.localStorage.setItem(
      recentTrendsStorageKey,
      JSON.stringify(nextRecentTrends),
    );
  } catch {
    window.localStorage.setItem(recentTrendsStorageKey, JSON.stringify([recentTrend]));
  }
}

function createBlogHrefFromTrend(trend: Trend) {
  const params = new URLSearchParams({
    category: trend.category,
    keyword: trend.keywords[0] ?? trend.category,
    title: trend.title,
    trendId: trend.id,
    url: trend.url,
  });

  if (trend.url.includes("youtube")) {
    params.set("youtubeUrl", trend.url);
  }

  return `/blog?${params.toString()}`;
}

export function TrendCard({
  isDeleting = false,
  trend,
  onDelete,
}: TrendCardProps) {
  const visibleKeywords = trend.keywords.slice(0, visibleKeywordCount);
  const hiddenKeywordCount = trend.keywords.length - visibleKeywords.length;
  const youtubeInsightItems = [
    { label: "動画AI要約", value: trend.youtubeSummary },
    { label: "美容師向け活用ポイント", value: trend.stylistPoints },
    { label: "Instagram投稿ネタ", value: trend.instagramIdea },
    { label: "リール台本案", value: trend.reelScript },
    { label: "カウンセリングでの使い方", value: trend.counselingIdea },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{trend.category}</Badge>
            <Badge tone={heatTone[trend.heat]}>人気 {trend.heat}</Badge>
            {trend.salonRelevance ? (
              <Badge tone={relevanceTone[trend.salonRelevance]}>
                ef.mayke`s関連度 {trend.salonRelevance}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            投稿日 {trend.publishedAt} / 登録日 {trend.registeredAt}
          </p>
        </div>
        {onDelete ? (
          <button
            className="min-h-9 shrink-0 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            disabled={isDeleting}
            onClick={() => onDelete(trend.id)}
            type="button"
          >
            {isDeleting ? "削除中" : "削除"}
          </button>
        ) : null}
      </div>

      <h2 className="mt-4 break-words text-lg font-semibold leading-7 text-stone-950">
        {trend.title}
      </h2>
      <p className="mt-2 break-words text-sm leading-6 text-stone-600">
        {trend.summary}
      </p>

      {youtubeInsightItems.length > 0 ? (
        <div className="mt-5 rounded-md border border-teal-100 bg-teal-50/60 p-3">
          <p className="text-xs font-semibold text-teal-900">
            YouTube活用メモ
          </p>
          <div className="mt-3 grid gap-3">
            {youtubeInsightItems.map((item) => (
              <div key={item.label}>
                <p className="text-xs font-semibold text-stone-500">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-stone-800">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-md bg-stone-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-stone-500">
            キーワード {trend.keywords.length}個
          </p>
          <span className="text-xs text-stone-500">{trend.sourceName}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {visibleKeywords.map((keyword) => (
            <Badge key={keyword} tone="neutral">
              {keyword}
            </Badge>
          ))}
          {hiddenKeywordCount > 0 ? (
            <Badge tone="neutral">+{hiddenKeywordCount}</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-stone-500">タグ</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {trend.tags.map((tag) => (
            <Badge key={tag} tone="info">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-stone-100 p-3 text-sm">
        <p className="text-xs font-semibold text-stone-500">サンプル説明</p>
        <p className="mt-2 break-words leading-6 text-stone-800">{trend.memo}</p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <a
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 sm:w-auto"
          href={trend.url}
          onClick={() => saveRecentTrend(trend)}
          rel="noreferrer"
          target="_blank"
        >
          登録リンクを開く
        </a>
        <Link
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:w-auto"
          href={createBlogHrefFromTrend(trend)}
        >
          ブログ化
        </Link>
      </div>
    </article>
  );
}
