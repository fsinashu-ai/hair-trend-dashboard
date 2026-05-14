"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AutoTrendGenerator } from "@/components/trends/AutoTrendGenerator";
import { TrendCard } from "@/components/trends/TrendCard";
import { YouTubeTrendGenerator } from "@/components/trends/YouTubeTrendGenerator";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyKeywords } from "@/data/dummyKeywords";
import { dummyTrends } from "@/data/dummyTrends";
import {
  readLocalBackupTrends,
  saveLocalBackupTrends,
} from "@/lib/backup/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createTrendLinkInSupabase,
  deleteTrendLinkFromSupabase,
  fetchTrendLinksFromSupabase,
} from "@/lib/supabase/trends";
import type { Trend, TrendCategory } from "@/types/trend";

const categoryOptions: TrendCategory[] = [
  "自社サイト",
  "Instagram",
  "ヘアカタログ",
  "髪質改善",
  "白髪ぼかし",
  "ヘアカラー",
  "店販",
  "美容ディーラー",
  "Pinterest",
  "海外トレンド",
  "YouTube",
  "カウンセリング",
  "SNS運用",
];
const supabaseEnabled = isSupabaseConfigured();

type TrendForm = {
  url: string;
  title: string;
  category: TrendCategory;
  memo: string;
};

type SortOption = "published-desc" | "published-asc" | "popular-desc";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const initialForm: TrendForm = {
  url: "",
  title: "",
  category: "自社サイト",
  memo: "",
};

const validTrendCategories: TrendCategory[] = [
  "レディース",
  "メンズ",
  "カラー",
  "パーマ",
  "髪質改善",
  "白髪ぼかし",
  "SNS投稿",
  "SNS運用",
  "カウンセリング",
  "店販",
  "自社サイト",
  "Instagram",
  "ヘアカタログ",
  "ヘアカラー",
  "美容ディーラー",
  "Pinterest",
  "海外トレンド",
  "YouTube",
];

const deprecatedDefaultTrendIds = new Set([
  "ef-maykes-own-site-straight",
  "ef-maykes-instagram-before-after",
  "ef-maykes-hair-catalog-smooth-long",
  "ef-maykes-hair-quality-menu",
  "ef-maykes-gray-blending-gloss",
  "ef-maykes-hair-color-transparent",
  "ef-maykes-product-home-care",
  "ef-maykes-dealer-treatment-info",
  "ef-maykes-pinterest-smooth-hair-board",
  "ef-maykes-overseas-sleek-hair",
]);

function normalizeTrendCategory(category: string): TrendCategory {
  if (
    category === "ショート" ||
    category === "ボブ" ||
    category === "レイヤー" ||
    category === "韓国ヘア"
  ) {
    return "レディース";
  }

  if (category === "SNS集客") {
    return "SNS運用";
  }

  if (
    category === "レディース" ||
    category === "メンズ" ||
    category === "カラー" ||
    category === "パーマ" ||
    category === "髪質改善" ||
    category === "白髪ぼかし" ||
    category === "SNS投稿" ||
    category === "SNS運用" ||
    category === "カウンセリング" ||
    category === "店販" ||
    category === "自社サイト" ||
    category === "Instagram" ||
    category === "ヘアカタログ" ||
    category === "ヘアカラー" ||
    category === "美容ディーラー" ||
    category === "Pinterest" ||
    category === "海外トレンド" ||
    category === "YouTube"
  ) {
    return category;
  }

  return "レディース";
}

function normalizeTrendMasters(trends: Trend[]) {
  return trends.map((trend) => ({
    ...trend,
    category: normalizeTrendCategory(trend.category),
    tags: trend.tags.map((tag) => (tag === "#SNS集客" ? "#SNS投稿" : tag)),
  }));
}

function getInitialTrends() {
  const savedTrends = readLocalBackupTrends();

  if (!savedTrends) {
    return dummyTrends;
  }

  const savedTrendMap = new Map(
    normalizeTrendMasters(savedTrends)
      .filter((trend) => !deprecatedDefaultTrendIds.has(trend.id))
      .map((trend) => [trend.id, trend] as const),
  );
  const newDefaultTrends = dummyTrends.filter(
    (trend) => !savedTrendMap.has(trend.id),
  );

  return [...newDefaultTrends, ...Array.from(savedTrendMap.values())];
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getTrendTime(trend: Trend) {
  return new Date(trend.publishedAt).getTime() || 0;
}

function getHeatScore(trend: Trend) {
  const heatScores = {
    高: 3,
    中: 2,
    低: 1,
  } as const;

  return heatScores[trend.heat];
}

function sortTrends(trends: Trend[], sortOption: SortOption) {
  return [...trends].sort((firstTrend, secondTrend) => {
    if (sortOption === "published-asc") {
      return getTrendTime(firstTrend) - getTrendTime(secondTrend);
    }

    if (sortOption === "popular-desc") {
      const heatDiff = getHeatScore(secondTrend) - getHeatScore(firstTrend);

      if (heatDiff !== 0) {
        return heatDiff;
      }

      return getTrendTime(secondTrend) - getTrendTime(firstTrend);
    }

    return getTrendTime(secondTrend) - getTrendTime(firstTrend);
  });
}

function trendMatches(trend: Trend, query: string) {
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) {
    return true;
  }

  return [
    trend.title,
    trend.category,
    trend.memo,
    trend.summary,
    ...trend.keywords,
    ...trend.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(lowerQuery);
}

function TrendLoadingCards() {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {["loading-trend-1", "loading-trend-2", "loading-trend-3", "loading-trend-4"].map(
        (item) => (
          <div
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
            key={item}
          >
            <div className="flex gap-2">
              <div className="h-6 w-20 animate-pulse rounded-md bg-stone-100" />
              <div className="h-6 w-24 animate-pulse rounded-md bg-stone-100" />
            </div>
            <div className="mt-5 h-6 w-4/5 animate-pulse rounded-md bg-stone-100" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-md bg-stone-100" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-stone-100" />
            <div className="mt-5 flex flex-wrap gap-2">
              <div className="h-6 w-16 animate-pulse rounded-md bg-stone-100" />
              <div className="h-6 w-20 animate-pulse rounded-md bg-stone-100" />
              <div className="h-6 w-14 animate-pulse rounded-md bg-stone-100" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export function TrendManager() {
  const searchParams = useSearchParams();
  const [trends, setTrends] = useState<Trend[]>(() =>
    supabaseEnabled ? [] : getInitialTrends(),
  );
  const [form, setForm] = useState<TrendForm>(initialForm);
  const [searchText, setSearchText] = useState(
    () => searchParams.get("keyword") ?? "",
  );
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [selectedSort, setSelectedSort] =
    useState<SortOption>("published-desc");
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTrendId, setDeletingTrendId] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "Supabaseから読み込み中です。"
      : "環境変数が未設定のため、ダミーデータで動作しています。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadTrends() {
      try {
        const supabaseTrends = await fetchTrendLinksFromSupabase();

        if (!isMounted) {
          return;
        }

        if (supabaseTrends && supabaseTrends.length > 0) {
          setTrends(supabaseTrends);
          setStatusTone("success");
          setMessage("Supabaseに保存されているトレンドを表示しています。");
        } else {
          setTrends(dummyTrends);
          setStatusTone("warning");
          setMessage(
            "Supabaseにトレンドがまだないため、初期データを表示しています。",
          );
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setTrends(dummyTrends);
        setStatusTone("warning");
        setMessage("Supabaseから読み込めなかったため、ダミーデータを表示しています。");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTrends();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (supabaseEnabled) {
      return;
    }

    saveLocalBackupTrends(trends);
  }, [trends]);

  const categories = useMemo(
    () => [
      "すべて",
      ...Array.from(
        new Set([
          ...categoryOptions,
          ...trends
            .map((trend) => trend.category)
            .filter((category) => validTrendCategories.includes(category)),
        ]),
      ),
    ],
    [trends],
  );

  const categoryCounts = useMemo(
    () =>
      categories
        .filter((category): category is TrendCategory => category !== "すべて")
        .map((category) => ({
        category,
        count: trends.filter((trend) => trend.category === category).length,
      })),
    [categories, trends],
  );

  const categoryCountMap = useMemo(
    () =>
      new Map(
        categoryCounts.map((item) => [item.category, item.count] as const),
      ),
    [categoryCounts],
  );

  const filteredTrends = useMemo(() => {
    const matchedTrends = trends.filter((trend) => {
        const matchesCategory =
          selectedCategory === "すべて" || trend.category === selectedCategory;
        return matchesCategory && trendMatches(trend, searchText);
    });

    return sortTrends(matchedTrends, selectedSort);
  }, [trends, searchText, selectedCategory, selectedSort]);

  const selectedCategoryCount =
    selectedCategory === "すべて"
      ? trends.length
      : trends.filter((trend) => trend.category === selectedCategory).length;
  const hasActiveFilter =
    Boolean(searchText.trim()) ||
    selectedCategory !== "すべて" ||
    selectedSort !== "published-desc";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    const url = form.url.trim();
    const memo = form.memo.trim();

    if (!title || !url || !memo) {
      setStatusTone("warning");
      setMessage("URL、タイトル、メモを入力してください。");
      return;
    }

    setIsSaving(true);
    setStatusTone("info");
    setMessage("トレンドを保存しています。");

    try {
      if (supabaseEnabled) {
        const savedTrend = await createTrendLinkInSupabase({
          title,
          url,
          memo,
          category: form.category,
        });

        if (savedTrend) {
          setTrends((currentTrends) => [savedTrend, ...currentTrends]);
          setStatusTone("success");
          setMessage("Supabaseにトレンドを保存しました。");
        } else {
          setStatusTone("warning");
          setMessage("保存先が未設定のため、この画面内だけで追加します。");
        }
      } else {
        const today = getToday();
        setTrends((currentTrends) => [
          {
            id: `${title}-${currentTrends.length + 1}`,
            title,
            summary: memo,
            category: form.category,
            sourceName: "ダミー登録",
            url,
            publishedAt: today,
            registeredAt: today,
            keywords: [form.category],
            tags: [`#${form.category}`],
            memo,
            heat: "中",
          },
          ...currentTrends,
        ]);
        setStatusTone("warning");
        setMessage("環境変数が未設定のため、この端末に保存しました。");
      }

      setForm(initialForm);
    } catch {
      setStatusTone("error");
      setMessage("トレンドの保存に失敗しました。Supabase設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(trendId: string) {
    setDeletingTrendId(trendId);
    setStatusTone("info");
    setMessage("トレンドを削除しています。");

    try {
      if (supabaseEnabled) {
        await deleteTrendLinkFromSupabase(trendId);
        setStatusTone("success");
        setMessage("Supabaseからトレンドを削除しました。");
      } else {
        setStatusTone("warning");
        setMessage("環境変数が未設定のため、この端末のデータから削除しました。");
      }

      setTrends((currentTrends) =>
        currentTrends.filter((trend) => trend.id !== trendId),
      );
    } catch {
      setStatusTone("error");
      setMessage("トレンドの削除に失敗しました。Supabase設定を確認してください。");
    } finally {
      setDeletingTrendId(null);
    }
  }

  function handleAutoGenerated(generatedTrends: Trend[]) {
    if (generatedTrends.length === 0) {
      return;
    }

    setTrends((currentTrends) => {
      const currentUrls = new Set(currentTrends.map((trend) => trend.url));
      const nextTrends = generatedTrends.filter(
        (trend) => !currentUrls.has(trend.url),
      );

      return [...nextTrends, ...currentTrends];
    });
  }

  return (
    <>
      <AutoTrendGenerator onGenerated={handleAutoGenerated} />
      <div className="mt-4">
        <YouTubeTrendGenerator onGenerated={handleAutoGenerated} />
      </div>

      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">
          トレンドを登録
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              URL
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    url: event.target.value,
                  }))
                }
                placeholder="https://example.com/article"
                required
                type="url"
                value={form.url}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              タイトル
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    title: event.target.value,
                  }))
                }
                placeholder="例: 初夏に提案したいボブ"
                required
                type="text"
                value={form.title}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              カテゴリ
              <select
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    category: event.target.value as TrendCategory,
                  }))
                }
                value={form.category}
              >
                {categoryOptions.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium text-stone-700">
            メモ
            <textarea
              className="min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  memo: event.target.value,
                }))
              }
              placeholder="このトレンドをサロン提案や投稿にどう使うかを書きます"
              required
              value={form.memo}
            />
          </label>

          <button
            className="mt-4 min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={
              isSaving || !form.url.trim() || !form.title.trim() || !form.memo.trim()
            }
            type="submit"
          >
            {isSaving ? "保存中" : "登録する"}
          </button>
        </form>
      </section>

      <div className="mt-6">
        <StatusMessage isLoading={isLoading || isSaving || Boolean(deletingTrendId)} tone={statusTone}>
          {isLoading ? "トレンドを読み込んでいます。" : message}
        </StatusMessage>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              トレンド一覧
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              表示件数: {filteredTrends.length} / 登録件数: {trends.length}
              {selectedCategory !== "すべて"
                ? ` / ${selectedCategory}: ${selectedCategoryCount}`
                : ""}
            </p>
          </div>
          <Badge tone={supabaseEnabled ? "success" : "neutral"}>
            {supabaseEnabled ? "Supabase保存" : "端末保存"}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              キーワード検索
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="例: ボブ、艶髪、Instagram投稿"
                type="search"
                value={searchText}
              />
            </label>
            <div className="grid gap-2 text-sm font-medium text-stone-700">
              並び替え
              <select
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setSelectedSort(event.target.value as SortOption)
                }
                value={selectedSort}
              >
                <option value="published-desc">投稿日 新しい順</option>
                <option value="published-asc">投稿日 古い順</option>
                <option value="popular-desc">人気順</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-stone-700">
                カテゴリフィルター
              </p>
              {hasActiveFilter ? (
                <button
                  className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    setSearchText("");
                    setSelectedCategory("すべて");
                    setSelectedSort("published-desc");
                  }}
                  type="button"
                >
                  リセット
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                className={`min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
                  selectedCategory === category
                    ? "border-teal-700 bg-teal-50 text-teal-800"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
                <span className="ml-1 text-xs font-medium opacity-70">
                  {category === "すべて"
                    ? trends.length
                    : categoryCountMap.get(category as TrendCategory) ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md bg-stone-50 p-3">
            <p className="text-xs font-semibold text-stone-500">検索ヒント</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {dummyKeywords.map((keyword) => (
                <button
                  className="min-h-8 shrink-0 rounded-md bg-white px-2.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-100 hover:bg-sky-50"
                  key={keyword.id}
                  onClick={() => setSearchText(keyword.name)}
                  type="button"
                >
                  {keyword.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <TrendLoadingCards />
        ) : filteredTrends.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredTrends.map((trend) => (
              <TrendCard
                isDeleting={deletingTrendId === trend.id}
                key={trend.id}
                trend={trend}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              action={
                hasActiveFilter ? (
                  <button
                    className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                    onClick={() => {
                      setSearchText("");
                      setSelectedCategory("すべて");
                      setSelectedSort("published-desc");
                    }}
                    type="button"
                  >
                    条件をリセット
                  </button>
                ) : null
              }
              description={
                hasActiveFilter
                  ? "検索語句やカテゴリを変えると、別のトレンドが見つかるかもしれません。"
                  : "URL、タイトル、カテゴリ、メモを登録すると、ここに一覧で表示されます。"
              }
              title={
                hasActiveFilter
                  ? "条件に合うトレンドがありません"
                  : "トレンドはまだありません"
              }
            />
          </div>
        )}
      </section>
    </>
  );
}
