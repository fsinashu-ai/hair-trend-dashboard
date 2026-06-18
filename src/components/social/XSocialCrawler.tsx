"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type { SocialPost } from "@/types/social";
import type {
  XAutoGenerateResponse,
  XGeneratedSocialPost,
} from "@/types/xTrend";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type XSocialCrawlerProps = {
  onPostsSaved: (posts: SocialPost[]) => void;
};

async function getResponseErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };

    return data.error ?? "X巡回に失敗しました。";
  } catch {
    return "X巡回に失敗しました。";
  }
}

function formatDateTime(value?: string) {
  if (!value) {
    return "投稿日未取得";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function relevanceTone(relevance: XGeneratedSocialPost["relevance"]) {
  if (relevance === "高") {
    return "success" as const;
  }

  if (relevance === "低") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function XSocialCrawler({ onPostsSaved }: XSocialCrawlerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<XAutoGenerateResponse | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState(
    "X公式APIのRecent Searchで、登録キーワードに近い公開投稿を確認します。",
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setStatusTone("info");
    setMessage("X公式APIで検索し、AIで美容師向けに分類しています。");

    try {
      const response = await fetch("/api/social/x/auto-generate", {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      const data = (await response.json()) as XAutoGenerateResponse;
      setResult(data);
      onPostsSaved(data.savedPosts);
      setStatusTone(data.savedCount > 0 ? "success" : "warning");
      setMessage(
        data.savedCount > 0
          ? `${data.providerLabel}でX投稿を${data.savedCount}件、SNS受信箱へ保存しました。`
          : `${data.providerLabel}で確認しました。保存できる新規候補がないか、X_BEARER_TOKEN/Supabaseが未設定です。`,
      );
    } catch (error) {
      setResult(null);
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "X巡回に失敗しました。X_BEARER_TOKEN、Supabase設定、AI設定を確認してください。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              X公式API巡回
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              登録キーワードをもとに、公式X APIで直近の公開投稿を検索します。
              取得した候補は「未確認」としてSNS受信箱へ入ります。
            </p>
          </div>
          <Badge tone="info">公式API</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:flex sm:items-center">
          <button
            className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isGenerating}
            onClick={handleGenerate}
            type="button"
          >
            {isGenerating ? "X巡回中" : "X巡回する"}
          </button>
          <p className="text-xs leading-5 text-stone-500">
            1キーワード最大5件、1回最大20件まで。非公式スクレイピングは行いません。
          </p>
        </div>

        <div className="mt-4">
          <StatusMessage isLoading={isGenerating} tone={statusTone}>
            {message}
          </StatusMessage>
        </div>
      </section>

      {result ? (
        <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">検索 {result.tweetCount}件</Badge>
            <Badge tone="success">候補 {result.generatedCount}件</Badge>
            <Badge tone={result.savedCount > 0 ? "success" : "neutral"}>
              保存 {result.savedCount}件
            </Badge>
            <Badge tone="neutral">残り {result.remainingRunSlots}件</Badge>
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

          {result.posts.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                description="保存済みURLや近いタイトルは除外します。キーワードを追加してから再実行すると候補が増える場合があります。"
                title="新しいX候補はありません"
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {result.posts.map((post) => (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4"
                  key={post.url}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">X</Badge>
                      <Badge tone="neutral">{post.category}</Badge>
                      <Badge tone={relevanceTone(post.relevance)}>
                        関連度 {post.relevance}
                      </Badge>
                      <Badge tone="neutral">反応 {post.engagementScore}</Badge>
                    </div>
                    <span className="text-xs text-stone-500">
                      {formatDateTime(post.publishedAt)}
                    </span>
                  </div>

                  <h3 className="mt-3 break-words text-base font-semibold leading-7 text-stone-950">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {post.aiSummary}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    {post.username} / キーワード: {post.keyword}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>

                  <a
                    className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 underline"
                    href={post.canonicalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    元投稿を確認
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
        X巡回にはVercelまたは.env.localの `X_BEARER_TOKEN` が必要です。
        取得するのは公式APIで許可された公開投稿の最小限の情報だけです。
      </section>
    </div>
  );
}
