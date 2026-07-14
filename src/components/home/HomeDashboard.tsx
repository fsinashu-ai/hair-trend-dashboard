"use client";

import Link from "next/link";
import { FinalMarketingDashboard } from "@/components/home/FinalMarketingDashboard";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { GeneratedPostCard } from "@/components/post-generator/GeneratedPostCard";
import { PageHeader } from "@/components/sections/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyGeneratedPosts } from "@/data/dummyGeneratedPosts";
import { dummyTrends } from "@/data/dummyTrends";
import { backupStorageKeys } from "@/lib/backup/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchTrendLinksFromSupabase } from "@/lib/supabase/trends";
import type { GeneratedPost } from "@/types/generatedPost";
import type { Trend, TrendCategory, TrendHeat } from "@/types/trend";

type RecentTrend = {
  category: string;
  heat: TrendHeat;
  id: string;
  title: string;
  viewedAt: string;
};

type QuickGenerateType =
  | "instagram-caption"
  | "reel-script"
  | "customer-explanation"
  | "next-visit"
  | "blog-article"
  | "morning-brief";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";
type HomeTrendSource = "loading" | "supabase" | "sample" | "empty" | "error";

const recentTrendsStorageKey = backupStorageKeys.recentTrends;

const favoriteLinks = [
  {
    href: "/trends",
    label: "トレンド一覧",
    note: "登録リンクを見る",
  },
  {
    href: "/post-generator",
    label: "投稿ネタ生成",
    note: "細かく条件指定",
  },
  {
    href: "/image-analysis",
    label: "画像分析",
    note: "仕上がり説明に",
  },
  {
    href: "/backup",
    label: "バックアップ",
    note: "月末の保存",
  },
];

const quickGenerateButtons: Array<{
  label: string;
  shortLabel: string;
  type: QuickGenerateType;
}> = [
  { label: "Instagram投稿文", shortLabel: "投稿文", type: "instagram-caption" },
  { label: "リール動画台本", shortLabel: "リール", type: "reel-script" },
  {
    label: "カウンセリング説明",
    shortLabel: "説明",
    type: "customer-explanation",
  },
  { label: "次回来店提案", shortLabel: "次回", type: "next-visit" },
  { label: "ブログ記事", shortLabel: "ブログ", type: "blog-article" },
  { label: "朝礼ネタ", shortLabel: "朝礼", type: "morning-brief" },
];

const heatScore = {
  高: 3,
  中: 2,
  低: 1,
} as const;

function getTodayLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    day: "numeric",
    month: "long",
    weekday: "short",
    year: "numeric",
  }).format(new Date());
}

function getRecommendedTrend(trends: Trend[]) {
  return [...trends].sort((firstTrend, secondTrend) => {
    const heatDiff = heatScore[secondTrend.heat] - heatScore[firstTrend.heat];

    if (heatDiff !== 0) {
      return heatDiff;
    }

    return secondTrend.publishedAt.localeCompare(firstTrend.publishedAt);
  })[0];
}

function createMockPost(type: QuickGenerateType, trend: Trend): GeneratedPost {
  const outputMap = {
    "instagram-caption": {
      postType: "Instagram投稿文",
      tone: "上品 / 30代女性 / 標準",
      content: `${trend.title}\n\n${trend.summary}\n\n朝の扱いやすさや髪のまとまりを大切にしたい方へ。今の髪質や履歴に合わせて、無理なく続けられる提案をします。気になる方はカウンセリングでご相談ください。`,
      hashtags: ["#髪質改善", "#艶髪", "#美容室", `#${trend.category}`],
    },
    "reel-script": {
      postType: "リール動画台本",
      tone: "カジュアル / 30代女性 / 標準",
      content: `0〜3秒: 「${trend.category}で印象を整えたい方へ」\n\n4〜8秒: Beforeや悩みが分かる部分を見せる\n\n9〜15秒: 施術中や仕上がりの艶、毛流れを見せる\n\n16〜22秒: Afterをゆっくり見せる\n\n締め: 「髪質やライフスタイルに合わせてご提案します」`,
      hashtags: ["#リール動画", "#美容師", "#ヘアスタイル", `#${trend.category}`],
    },
    "customer-explanation": {
      postType: "カウンセリング説明",
      tone: "上品 / 30代女性 / 標準",
      content: `${trend.title}は、仕上がりの見た目だけでなく、毎日の扱いやすさも考えて提案したい内容です。${trend.memo} 髪質やこれまでの施術履歴を確認しながら、無理のない方法を一緒に決めていきましょう。`,
      hashtags: ["#カウンセリング", "#髪質改善", "#ヘアケア", `#${trend.category}`],
    },
    "next-visit": {
      postType: "次回来店提案",
      tone: "上品 / 30代女性 / 標準",
      content: `今日の仕上がりを保つなら、次回は6〜8週間後を目安に見せていただくのがおすすめです。${trend.category}の状態を確認しながら、毛先のメンテナンスやケアを一緒に考えましょう。`,
      hashtags: ["#次回予約", "#メンテナンス", "#艶髪", `#${trend.category}`],
    },
    "blog-article": {
      postType: "ブログ記事",
      tone: "上品 / 30代女性 / 標準",
      content: `タイトル案: ${trend.title}をサロンで提案するときに大切なこと\n\n${trend.summary}\n\nブログでは、まずお客様が感じやすい悩みに触れ、そのあとに髪質や履歴を確認する大切さを伝えると読みやすくなります。\n\nef.mayke\`sでは、${trend.keywords.slice(0, 3).join("、")}を手がかりに、無理のない施術やホームケアを一緒に考えていきます。気になる方は、今の髪の状態を見ながらカウンセリングでご相談ください。`,
      hashtags: ["#美容室ブログ", "#髪質改善", "#艶髪", `#${trend.category}`],
    },
    "morning-brief": {
      postType: "朝礼ネタ",
      tone: "短く共有",
      content: `今日の共有テーマは「${trend.category}の提案」です。\n\nお客様にはまず悩みを聞き、${trend.keywords.slice(0, 3).join("、")}を軸に分かりやすく説明しましょう。仕上げでは、明日からの扱いやすさを一言添えると再来店につながります。`,
      hashtags: ["#朝礼ネタ", "#サロンワーク", "#美容師", `#${trend.category}`],
    },
  } satisfies Record<
    QuickGenerateType,
    Omit<GeneratedPost, "createdAt" | "id" | "theme" | "usedKeywords">
  >;

  const output = outputMap[type];

  return {
    id: `home-${type}-${Date.now()}`,
    theme: trend.category,
    postType: output.postType,
    tone: output.tone,
    content: output.content,
    usedKeywords: trend.keywords.slice(0, 5),
    hashtags: output.hashtags,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

function parseRecentTrends(value: string) {
  try {
    const parsed = JSON.parse(value) as RecentTrend[];

    return parsed.filter(
      (trend) => trend.id && trend.title && trend.category && trend.viewedAt,
    );
  } catch {
    return [];
  }
}

function getRecentTrendsSnapshot() {
  if (typeof window === "undefined") {
    return "[]";
  }

  return window.localStorage.getItem(recentTrendsStorageKey) ?? "[]";
}

function subscribeToRecentTrends(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

export function HomeDashboard() {
  const supabaseEnabled = isSupabaseConfigured();
  const [trends, setTrends] = useState<Trend[]>(() =>
    supabaseEnabled ? [] : dummyTrends,
  );
  const [trendSource, setTrendSource] = useState<HomeTrendSource>(
    supabaseEnabled ? "loading" : "sample",
  );
  const [trendLoadError, setTrendLoadError] = useState<string | null>(null);
  const recentTrendsSnapshot = useSyncExternalStore(
    subscribeToRecentTrends,
    getRecentTrendsSnapshot,
    () => "[]",
  );
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState(
    "朝の投稿、接客説明、朝礼ネタをすぐ作れます。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadTrends() {
      try {
        const supabaseTrends = await fetchTrendLinksFromSupabase();

        if (!isMounted) return;

        if (supabaseTrends && supabaseTrends.length > 0) {
          setTrends(supabaseTrends);
          setTrendSource("supabase");
          setTrendLoadError(null);
        } else {
          setTrends([]);
          setTrendSource("empty");
          setTrendLoadError(null);
        }
      } catch {
        if (!isMounted) return;

        setTrends([]);
        setTrendSource("error");
        setTrendLoadError(
          "トレンドを読み込めませんでした。設定とSupabaseの接続を確認してください。",
        );
      }
    }

    void loadTrends();

    return () => {
      isMounted = false;
    };
  }, [supabaseEnabled]);

  const displayedTrends = trendSource === "sample" ? dummyTrends : trends;
  const recommendedTrend = useMemo(
    () => getRecommendedTrend(displayedTrends),
    [displayedTrends],
  );

  const recentTrends = useMemo(
    () => parseRecentTrends(recentTrendsSnapshot),
    [recentTrendsSnapshot],
  );

  const fallbackRecentTrends = useMemo(
    () =>
      dummyTrends.slice(0, 4).map((trend) => ({
        category: trend.category,
        heat: trend.heat,
        id: trend.id,
        title: trend.title,
        viewedAt: trend.publishedAt,
      })),
    [],
  );
  const displayedRecentTrends =
    recentTrends.length > 0
      ? recentTrends.slice(0, 4)
      : trendSource === "sample"
        ? fallbackRecentTrends
        : [];

  const todayPostIdea =
    generatedPost ?? (trendSource === "sample" ? dummyGeneratedPosts[0] : null);

  const popularCategories = useMemo(() => {
    const categoryCounts = new Map<TrendCategory, number>();

    displayedTrends.forEach((trend) => {
      categoryCounts.set(trend.category, (categoryCounts.get(trend.category) ?? 0) + 1);
    });

    return Array.from(categoryCounts.entries())
      .sort((firstCategory, secondCategory) => secondCategory[1] - firstCategory[1])
      .slice(0, 8);
  }, [displayedTrends]);

  async function handleQuickGenerate(type: QuickGenerateType) {
    if (!recommendedTrend) {
      setStatusTone("warning");
      setMessage("トレンドが登録されていないため、先にトレンドを登録してください。");
      return;
    }

    setIsGenerating(true);
    setStatusTone("info");
    setMessage("AI生成中です。");

    try {
      const response = await fetch("/api/generate-post", {
        body: JSON.stringify({
          ageGroup: "30代",
          genderTarget: "女性",
          keywords: recommendedTrend.keywords.slice(0, 7),
          label: type,
          length: "標準",
          trendTitles: [recommendedTrend.title],
          type,
          writingTone: "上品",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate on home.");
      }

      const data = (await response.json()) as Omit<GeneratedPost, "id"> & {
        providerLabel?: string;
      };
      setGeneratedPost({
        id: `home-${type}-${data.createdAt}`,
        ...data,
      });
      setStatusTone("success");
      setMessage(`${data.providerLabel ?? "AI API"}で生成しました。`);
    } catch {
      setGeneratedPost(createMockPost(type, recommendedTrend));
      setStatusTone("warning");
      setMessage(
        "AI APIで生成できなかったため、朝用のモックレスポンスを表示しています。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="pb-24 pt-5 sm:pb-8 sm:pt-6">
      <PageHeader
        eyebrow={getTodayLabel()}
        title="朝すぐ使えるサロンホーム"
        description="今日見る情報と、すぐ作る文章だけを前に出しました。スマホでも片手で押しやすい毎日用のホームです。"
      />

      {trendSource === "loading" ? (
        <StatusMessage isLoading tone="info">
          Supabaseからホーム用のトレンドを読み込んでいます。
        </StatusMessage>
      ) : null}

      {trendSource === "error" ? (
        <StatusMessage tone="error">
          {trendLoadError ?? "トレンドを読み込めませんでした。"}
        </StatusMessage>
      ) : null}

      {trendSource === "sample" ? (
        <StatusMessage tone="warning">
          Supabase未設定のため、ホームでは確認用サンプルを表示しています。
        </StatusMessage>
      ) : null}

      <FinalMarketingDashboard />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
          {recommendedTrend ? (
            <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                今日のおすすめトレンド
              </p>
              <h2 className="mt-2 text-xl font-semibold leading-8 text-stone-950">
                {recommendedTrend.title}
              </h2>
            </div>
            <Badge tone="success">{recommendedTrend.category}</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {recommendedTrend.summary}
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
            {recommendedTrend.keywords.slice(0, 6).map((keyword) => (
              <Link
                className="shrink-0 rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                href={`/trends?keyword=${encodeURIComponent(keyword)}`}
                key={keyword}
              >
                {keyword}
              </Link>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button href="/trends" variant="primary">
              記事を見る
            </Button>
            <Button href="/post-generator" variant="secondary">
              細かく生成
            </Button>
          </div>
            </>
          ) : (
            <EmptyState
              description={
                trendSource === "empty"
                  ? "トレンド一覧からURLを登録するか、自動生成を実行すると表示されます。"
                  : "トレンドを取得できたあと、今日のおすすめがここに表示されます。"
              }
              title={
                trendSource === "empty"
                  ? "おすすめトレンドはまだありません"
                  : "おすすめトレンドを確認できません"
              }
            />
          )}
        </article>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">
              ワンクリックAI生成
            </h2>
            <Badge tone="neutral">朝用</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickGenerateButtons.map((button) => (
              <button
                className="min-h-14 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                disabled={isGenerating || !recommendedTrend}
                key={button.type}
                onClick={() => handleQuickGenerate(button.type)}
                type="button"
              >
                <span className="block sm:hidden">
                  {isGenerating ? "生成中" : button.shortLabel}
                </span>
                <span className="hidden sm:block">
                  {isGenerating ? "生成中" : button.label}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <StatusMessage isLoading={isGenerating} tone={statusTone}>
              {message}
            </StatusMessage>
          </div>
        </section>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">
              今日の投稿ネタ
            </h2>
            <Badge tone={generatedPost ? "success" : "neutral"}>
              {generatedPost ? "生成済み" : "サンプル"}
            </Badge>
          </div>
          {todayPostIdea ? (
            <GeneratedPostCard post={todayPostIdea} />
          ) : (
            <EmptyState
              description="ワンクリックAI生成を押すと、今日使える投稿ネタがここに表示されます。"
              title="投稿ネタはまだありません"
            />
          )}
        </section>

        <div className="grid content-start gap-6">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">
                最近見た記事
              </h2>
              <Badge tone={recentTrends.length > 0 ? "success" : "neutral"}>
                {recentTrends.length > 0 ? "保存済み" : "サンプル"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {displayedRecentTrends.map((trend) => (
                <Link
                  className="rounded-md border border-stone-200 p-3 transition hover:border-teal-200 hover:bg-stone-50"
                  href={`/trends?keyword=${encodeURIComponent(trend.category)}`}
                  key={trend.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-stone-950">
                        {trend.title}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {trend.category} / 人気 {trend.heat}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">見る</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-stone-950">お気に入り</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {favoriteLinks.map((favorite) => (
                <Link
                  className="min-h-20 rounded-md border border-stone-200 p-3 transition hover:border-teal-200 hover:bg-teal-50"
                  href={favorite.href}
                  key={favorite.href}
                >
                  <p className="text-sm font-semibold text-stone-950">
                    {favorite.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    {favorite.note}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950">人気カテゴリ</h2>
          <Button href="/trends" variant="secondary">
            一覧
          </Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          {popularCategories.map(([category, count]) => (
            <Link
              className="min-h-11 shrink-0 rounded-md bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800 ring-1 ring-stone-200 hover:bg-teal-50 hover:text-teal-800"
              href={`/trends?keyword=${encodeURIComponent(category)}`}
              key={category}
            >
              {category}
              <span className="ml-2 text-xs font-medium text-stone-500">
                {count}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
