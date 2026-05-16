"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type { Trend } from "@/types/trend";
import type {
  YoutubeAutoGenerateResponse,
  YoutubeGeneratedTrend,
  YoutubeTrendRangeDays,
} from "@/types/youtubeTrend";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type YouTubeTrendGeneratorProps = {
  onGenerated: (trends: Trend[]) => void;
};

function toTrend(trend: YoutubeGeneratedTrend, index: number): Trend {
  return {
    category: trend.category,
    heat: "中",
    id: `youtube-${trend.registered_at}-${index}-${trend.url}`,
    keywords: trend.tags.length > 0 ? trend.tags : [trend.category],
    memo: trend.memo,
    publishedAt: trend.publishedAt?.slice(0, 10) || trend.registered_at,
    registeredAt: trend.registered_at,
    sourceName: trend.channelTitle ?? "YouTube周回",
    summary: trend.memo,
    tags: trend.tags,
    title: trend.title,
    url: trend.url,
  };
}

export function YouTubeTrendGenerator({
  onGenerated,
}: YouTubeTrendGeneratorProps) {
  const [rangeDays, setRangeDays] = useState<YoutubeTrendRangeDays>(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState(
    "登録キーワードをもとに、公式YouTube Data APIで新着動画を探せます。",
  );
  const [result, setResult] = useState<YoutubeAutoGenerateResponse | null>(null);

  async function getResponseErrorMessage(response: Response) {
    try {
      const data = (await response.json()) as { error?: string };
      return data.error ?? "YouTube周回に失敗しました。";
    } catch {
      return "YouTube周回に失敗しました。";
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setStatusTone("info");
    setMessage("YouTube Data APIで動画を検索し、AIで分類しています。");

    try {
      const response = await fetch("/api/youtube/auto-generate", {
        body: JSON.stringify({ rangeDays }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      const data = (await response.json()) as YoutubeAutoGenerateResponse;
      const displayTrends =
        data.savedTrends.length > 0 ? data.savedTrends : data.trends;

      setResult(data);
      onGenerated(displayTrends.map((trend, index) => toTrend(trend, index)));
      setStatusTone(data.savedCount > 0 ? "success" : "warning");
      setMessage(
        data.savedCount > 0
          ? `${data.providerLabel}でYouTube動画を${data.savedCount}件保存しました。`
          : `${data.providerLabel}で確認しました。保存できる新規候補がないか、Supabase/APIキーが未設定です。`,
      );
    } catch (error) {
      setResult(null);
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "YouTube周回に失敗しました。YOUTUBE_API_KEY、Supabase設定、AI設定を確認してください。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-lg border border-red-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            YouTube周回
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            登録キーワードで美容師向け動画を検索し、重複しない候補をトレンド一覧へ保存します。公式APIのみ使用します。
          </p>
        </div>
        <Badge tone="warning">公式API</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          検索期間
          <select
            className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
            onChange={(event) =>
              setRangeDays(Number(event.target.value) as YoutubeTrendRangeDays)
            }
            value={rangeDays}
          >
            <option value={7}>過去7日</option>
            <option value={30}>過去30日</option>
          </select>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isGenerating}
            onClick={handleGenerate}
            type="button"
          >
            {isGenerating ? "YouTube周回中" : "YouTube周回"}
          </button>
          <p className="text-xs leading-5 text-stone-500">
            1キーワード最大5件、1回最大30件までに制限し、重複URLや近いタイトルは保存しません。
          </p>
        </div>
      </div>

      <div className="mt-4">
        <StatusMessage isLoading={isGenerating} tone={statusTone}>
          {message}
        </StatusMessage>
      </div>

      {result ? (
        <div className="mt-4 rounded-md bg-stone-50 p-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">検索 {result.videoCount}件</Badge>
            <Badge tone="success">候補 {result.generatedCount}件</Badge>
            <Badge tone={result.savedCount > 0 ? "success" : "neutral"}>
              保存 {result.savedCount}件
            </Badge>
            <Badge tone="neutral">残り {result.remainingDailySlots}件</Badge>
            <Badge tone="neutral">{result.providerLabel}</Badge>
          </div>
          {result.searchedKeywords.length > 0 ? (
            <p className="mt-3 text-xs leading-5 text-stone-600">
              検索キーワード: {result.searchedKeywords.join("、")}
            </p>
          ) : null}
          {result.warnings.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-xs leading-5 text-stone-600">
              {result.warnings.map((warning) => (
                <li key={warning}>・{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
