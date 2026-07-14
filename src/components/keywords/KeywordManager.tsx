"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeywordCard } from "@/components/keywords/KeywordCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyKeywords } from "@/data/dummyKeywords";
import {
  readLocalBackupKeywords,
  saveLocalBackupKeywords,
} from "@/lib/backup/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createKeywordInSupabase,
  deleteKeywordFromSupabase,
  fetchKeywordsFromSupabase,
} from "@/lib/supabase/keywords";
import type { Keyword, KeywordPriority } from "@/types/keyword";

const categoryOptions = [
  "レディース",
  "メンズ",
  "カラー",
  "パーマ",
  "髪質改善",
  "白髪ぼかし",
  "SNS投稿",
  "カウンセリング",
  "店販",
];
const priorityOptions: KeywordPriority[] = ["高", "中", "低"];
const supabaseEnabled = isSupabaseConfigured();

type KeywordForm = {
  name: string;
  category: string;
  priority: KeywordPriority;
  memo: string;
};

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const initialForm: KeywordForm = {
  name: "",
  category: "レディース",
  priority: "中",
  memo: "",
};

const deprecatedDefaultKeywordIds = new Set(["short-hair"]);

function mergeKeywordMasters(savedKeywords: Keyword[]) {
  const savedKeywordMap = new Map(
    savedKeywords
      .filter((keyword) => !deprecatedDefaultKeywordIds.has(keyword.id))
      .map((keyword) => [keyword.name, keyword] as const),
  );
  const mergedDefaultKeywords = dummyKeywords.map((defaultKeyword) => {
    const savedKeyword = savedKeywordMap.get(defaultKeyword.name);

    if (!savedKeyword) {
      return defaultKeyword;
    }

    savedKeywordMap.delete(defaultKeyword.name);

    return {
      ...defaultKeyword,
      id: savedKeyword.id || defaultKeyword.id,
      priority: savedKeyword.priority,
      useCount: Math.max(defaultKeyword.useCount, savedKeyword.useCount),
    };
  });

  return [...mergedDefaultKeywords, ...Array.from(savedKeywordMap.values())];
}

function getInitialKeywords() {
  const savedKeywords = readLocalBackupKeywords();

  return savedKeywords ? mergeKeywordMasters(savedKeywords) : dummyKeywords;
}

function keywordMatches(keyword: Keyword, query: string) {
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) {
    return true;
  }

  return [keyword.name, keyword.category, keyword.memo]
    .join(" ")
    .toLowerCase()
    .includes(lowerQuery);
}

export function KeywordManager() {
  const [keywords, setKeywords] = useState<Keyword[]>(() =>
    supabaseEnabled ? [] : getInitialKeywords(),
  );
  const [form, setForm] = useState<KeywordForm>(initialForm);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingKeywordId, setDeletingKeywordId] = useState<string | null>(null);
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

    async function loadKeywords() {
      try {
        const supabaseKeywords = await fetchKeywordsFromSupabase();

        if (!isMounted) {
          return;
        }

        setKeywords(supabaseKeywords ?? []);
        setStatusTone(supabaseKeywords?.length ? "success" : "warning");
        setMessage(
          supabaseKeywords?.length
            ? "Supabaseに保存されているキーワードを表示しています。"
            : "データ待ちです。キーワードを追加してください。",
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setKeywords([]);
        setStatusTone("error");
        setMessage("取得に失敗しました。再読み込みしても直らない場合はSupabase設定を確認してください。");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadKeywords();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (supabaseEnabled) {
      return;
    }

    saveLocalBackupKeywords(keywords);
  }, [keywords]);

  const categories = useMemo(
    () => [
      "すべて",
      ...Array.from(
        new Set([
          ...categoryOptions,
          ...keywords.map((keyword) => keyword.category),
        ]),
      ),
    ],
    [keywords],
  );

  const filteredKeywords = useMemo(
    () =>
      keywords.filter((keyword) => {
        const matchesCategory =
          selectedCategory === "すべて" || keyword.category === selectedCategory;
        return matchesCategory && keywordMatches(keyword, searchText);
      }),
    [keywords, searchText, selectedCategory],
  );

  const highPriorityCount = useMemo(
    () => keywords.filter((keyword) => keyword.priority === "高").length,
    [keywords],
  );

  const totalUseCount = useMemo(
    () => keywords.reduce((total, keyword) => total + keyword.useCount, 0),
    [keywords],
  );

  const hasActiveFilter = Boolean(searchText.trim()) || selectedCategory !== "すべて";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const keywordName = form.name.trim();
    const keywordCategory = form.category.trim();

    if (!keywordName || !keywordCategory) {
      setStatusTone("warning");
      setMessage("キーワード名とカテゴリを入力してください。");
      return;
    }

    const newKeywordWithoutId = {
      name: keywordName,
      category: keywordCategory,
      memo: form.memo.trim() || "メモはまだありません。",
      useCount: 0,
      priority: form.priority,
    };

    setIsSaving(true);
    setStatusTone("info");
    setMessage("キーワードを保存しています。");

    try {
      if (supabaseEnabled) {
        const savedKeyword = await createKeywordInSupabase(newKeywordWithoutId);

        if (savedKeyword) {
          setKeywords((currentKeywords) => [savedKeyword, ...currentKeywords]);
          setStatusTone("success");
          setMessage("Supabaseにキーワードを保存しました。");
        } else {
          setStatusTone("warning");
          setMessage("保存先が未設定のため、この画面内だけで追加します。");
        }
      } else {
        setKeywords((currentKeywords) => [
          {
            id: `${keywordName}-${currentKeywords.length + 1}`,
            ...newKeywordWithoutId,
          },
          ...currentKeywords,
        ]);
        setStatusTone("warning");
        setMessage("環境変数が未設定のため、この端末に保存しました。");
      }

      setForm(initialForm);
    } catch {
      setStatusTone("error");
      setMessage("キーワードの保存に失敗しました。Supabase設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(keywordId: string) {
    setDeletingKeywordId(keywordId);
    setStatusTone("info");
    setMessage("キーワードを削除しています。");

    try {
      if (supabaseEnabled) {
        await deleteKeywordFromSupabase(keywordId);
        setStatusTone("success");
        setMessage("Supabaseからキーワードを削除しました。");
      } else {
        setStatusTone("warning");
        setMessage("環境変数が未設定のため、この端末のデータから削除しました。");
      }

      setKeywords((currentKeywords) =>
        currentKeywords.filter((keyword) => keyword.id !== keywordId),
      );
    } catch {
      setStatusTone("error");
      setMessage("キーワードの削除に失敗しました。Supabase設定を確認してください。");
    } finally {
      setDeletingKeywordId(null);
    }
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">登録キーワード</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">
            {keywords.length}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">優先度 高</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">
            {highPriorityCount}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">合計利用回数</p>
          <p className="mt-3 text-3xl font-semibold text-stone-950">
            {totalUseCount}
          </p>
        </div>
      </section>

      <div className="mt-6">
        <StatusMessage isLoading={isLoading || isSaving || Boolean(deletingKeywordId)} tone={statusTone}>
          {isLoading ? "キーワードを読み込んでいます。" : message}
        </StatusMessage>
      </div>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">
          キーワードを追加
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px_160px]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              キーワード名
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder="例: 透明感カラー"
                type="text"
                value={form.name}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              カテゴリ
              <select
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    category: event.target.value,
                  }))
                }
                value={form.category}
              >
                {categoryOptions.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              優先度
              <select
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    priority: event.target.value as KeywordPriority,
                  }))
                }
                value={form.priority}
              >
                {priorityOptions.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-medium text-stone-700">
            メモ
            <textarea
              className="min-h-20 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  memo: event.target.value,
                }))
              }
              placeholder="どんな投稿や接客で使うかを書きます"
              value={form.memo}
            />
          </label>
          <button
            className="mt-4 min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isSaving || !form.name.trim() || !form.category.trim()}
            type="submit"
          >
            {isSaving ? "保存中" : "追加する"}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              登録済みキーワード
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              表示件数: {filteredKeywords.length}
            </p>
          </div>
          <Badge tone={supabaseEnabled ? "success" : "neutral"}>
            {supabaseEnabled ? "Supabase保存" : "端末保存"}
          </Badge>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            検索
            <input
              className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="キーワード名、カテゴリ、メモで検索"
              type="search"
              value={searchText}
            />
          </label>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
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
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5">
            <EmptyState
              description="Supabaseのデータを確認しています。少し待つと一覧が表示されます。"
              title="読み込み中です"
            />
          </div>
        ) : filteredKeywords.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredKeywords.map((keyword) => (
              <KeywordCard
                isDeleting={deletingKeywordId === keyword.id}
                key={keyword.id}
                keyword={keyword}
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
                    }}
                    type="button"
                  >
                    条件をリセット
                  </button>
                ) : null
              }
              description={
                hasActiveFilter
                  ? "検索語句やカテゴリを変えると、別のキーワードが見つかるかもしれません。"
                  : "キーワードを追加すると、ここに一覧で表示されます。"
              }
              title={
                hasActiveFilter
                  ? "条件に合うキーワードがありません"
                  : "キーワードはまだありません"
              }
            />
          </div>
        )}
      </section>
    </>
  );
}
