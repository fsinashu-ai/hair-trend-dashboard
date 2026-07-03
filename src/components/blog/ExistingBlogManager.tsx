"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyExistingBlogArticles } from "@/data/dummyExistingBlogArticles";
import {
  createEmptyExistingBlogInput,
  createLocalExistingBlogArticle,
  existingBlogSourceLabels,
  existingBlogSourceTypes,
  existingBlogStatusLabels,
  existingBlogStatuses,
  getMetricSignal,
  normalizeBlogUrl,
  stringListToLines,
  toStringList,
} from "@/lib/existingBlog";
import type {
  BlogRewriteSuggestion,
  ExistingBlogArticle,
  ExistingBlogArticleInput,
  ExistingBlogSourceType,
  ExistingBlogStatus,
} from "@/types/existingBlog";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const localStorageKey = "hair-trend-existing-blog-articles";

function readLocalArticles() {
  if (typeof window === "undefined") return dummyExistingBlogArticles;

  try {
    const stored = window.localStorage.getItem(localStorageKey);
    return stored
      ? (JSON.parse(stored) as ExistingBlogArticle[])
      : dummyExistingBlogArticles;
  } catch {
    return dummyExistingBlogArticles;
  }
}

function saveLocalArticles(articles: ExistingBlogArticle[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localStorageKey, JSON.stringify(articles));
}

function toInput(article: ExistingBlogArticle): ExistingBlogArticleInput {
  return {
    canonicalUrl: article.canonicalUrl,
    category: article.category,
    lastUpdatedAt: article.lastUpdatedAt,
    memo: article.memo,
    publishedAt: article.publishedAt,
    secondaryKeywords: article.secondaryKeywords,
    sourceType: article.sourceType,
    status: article.status,
    targetKeyword: article.targetKeyword,
    title: article.title,
    url: article.url,
  };
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function createBlogGeneratorHref(article: ExistingBlogArticle) {
  return `/blog?${new URLSearchParams({
    keyword: article.targetKeyword || article.category || "松江 髪質改善",
    memo: article.memo,
    searchIntent: `${article.title}の既存記事リライト`,
    targetPage: article.url,
    title: article.title,
    view: "generator",
  }).toString()}`;
}

function ArticleForm({
  draft,
  editingId,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  draft: ExistingBlogArticleInput;
  editingId: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (draft: ExistingBlogArticleInput) => void;
  onSubmit: () => void;
}) {
  const keywordText = stringListToLines(draft.secondaryKeywords);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            {editingId ? "公開済みブログを編集" : "公開済みブログを登録"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            WordPressで公開済みの記事URLを登録して、Search Console分析やリライト提案に使います。
          </p>
        </div>
        <button
          className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700"
          onClick={onCancel}
          type="button"
        >
          一覧へ戻る
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-stone-700 sm:col-span-2">
          記事タイトル
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({ ...draft, title: event.target.value })
            }
            placeholder="例：松江で髪質改善を考えている方へ"
            value={draft.title}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700 sm:col-span-2">
          記事URL
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({
                ...draft,
                canonicalUrl: draft.canonicalUrl || event.target.value,
                url: event.target.value,
              })
            }
            placeholder="https://ef-mayke-s.com/..."
            value={draft.url}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700">
          対策キーワード
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({ ...draft, targetKeyword: event.target.value })
            }
            placeholder="松江 髪質改善"
            value={draft.targetKeyword}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700">
          カテゴリ
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({ ...draft, category: event.target.value })
            }
            placeholder="髪質改善"
            value={draft.category}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700">
          公開日
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({ ...draft, publishedAt: event.target.value })
            }
            type="date"
            value={draft.publishedAt}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700">
          最終更新日
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({ ...draft, lastUpdatedAt: event.target.value })
            }
            type="date"
            value={draft.lastUpdatedAt}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700">
          ステータス
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({
                ...draft,
                status: event.target.value as ExistingBlogStatus,
              })
            }
            value={draft.status}
          >
            {existingBlogStatuses.map((status) => (
              <option key={status} value={status}>
                {existingBlogStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-stone-700">
          登録方法
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              onChange({
                ...draft,
                sourceType: event.target.value as ExistingBlogSourceType,
              })
            }
            value={draft.sourceType}
          >
            {existingBlogSourceTypes.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {existingBlogSourceLabels[sourceType]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-stone-700 sm:col-span-2">
          補助キーワード
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            onChange={(event) =>
              onChange({
                ...draft,
                secondaryKeywords: toStringList(event.target.value),
              })
            }
            placeholder="1行に1つ、またはカンマ区切りで入力"
            value={keywordText}
          />
        </label>

        <label className="text-sm font-semibold text-stone-700 sm:col-span-2">
          メモ
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            onChange={(event) =>
              onChange({ ...draft, memo: event.target.value })
            }
            placeholder="リライトしたい理由、狙いたいお客様、LINE導線など"
            value={draft.memo}
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          className="min-h-11 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto"
          disabled={isSaving}
          onClick={onSubmit}
          type="button"
        >
          {isSaving ? "保存中..." : editingId ? "更新する" : "登録する"}
        </button>
      </div>
    </section>
  );
}

function RewriteResult({
  suggestion,
}: {
  suggestion: BlogRewriteSuggestion | null;
}) {
  if (!suggestion) return null;

  return (
    <section className="rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-stone-950">
          Geminiリライト提案
        </h2>
        <Badge tone={suggestion.provider === "gemini" ? "success" : "warning"}>
          {suggestion.providerLabel}
        </Badge>
        <Badge tone="info">優先度 {suggestion.priority}</Badge>
      </div>
      <p className="mt-3 text-sm leading-7 text-stone-700">
        {suggestion.summary}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4">
          <p className="text-xs font-semibold text-stone-500">改善タイトル案</p>
          <p className="mt-2 font-semibold text-stone-950">
            {suggestion.suggestedTitle}
          </p>
        </div>
        <div className="rounded-md bg-white p-4">
          <p className="text-xs font-semibold text-stone-500">
            メタディスクリプション案
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {suggestion.suggestedMetaDescription}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md bg-white p-4">
          <p className="text-xs font-semibold text-stone-500">見出し改善案</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
            {suggestion.suggestedHeadings.map((heading) => (
              <li key={heading}>・{heading}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md bg-white p-4">
          <p className="text-xs font-semibold text-stone-500">FAQ追加案</p>
          <div className="mt-2 space-y-3 text-sm leading-6 text-stone-700">
            {suggestion.faqSuggestions.map((faq) => (
              <div key={faq.question}>
                <p className="font-semibold">Q. {faq.question}</p>
                <p>A. {faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-white p-4">
        <p className="text-xs font-semibold text-stone-500">改善理由</p>
        <p className="mt-2 text-sm leading-7 text-stone-700">
          {suggestion.rewriteReason}
        </p>
        <p className="mt-3 text-xs font-semibold text-stone-500">CTA案</p>
        <p className="mt-1 text-sm leading-6 text-stone-700">
          {suggestion.ctaSuggestion}
        </p>
      </div>
    </section>
  );
}

export function ExistingBlogManager() {
  const [articles, setArticles] = useState<ExistingBlogArticle[]>(() =>
    readLocalArticles(),
  );
  const [draft, setDraft] = useState<ExistingBlogArticleInput>(() =>
    createEmptyExistingBlogInput(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ExistingBlogStatus>(
    "all",
  );
  const [mode, setMode] = useState<"list" | "form">("list");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [message, setMessage] = useState("既存ブログを読み込んでいます。");
  const [tone, setTone] = useState<StatusTone>("info");
  const [rewriteSuggestion, setRewriteSuggestion] =
    useState<BlogRewriteSuggestion | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadArticles() {
      try {
        const response = await fetch("/api/blog/articles");
        if (!response.ok) throw new Error("fetch failed");
        const data = (await response.json()) as {
          articles?: ExistingBlogArticle[];
          mode?: "local" | "supabase";
        };

        if (!isMounted) return;

        if (data.articles?.length) {
          setArticles(data.articles);
          setMessage("Supabaseに保存された既存ブログを表示しています。");
          setTone("success");
        } else {
          const localArticles = readLocalArticles();
          setArticles(localArticles);
          setMessage(
            data.mode === "local"
              ? "Supabase未設定のため、この端末内のサンプルデータで動作しています。"
              : "まだ既存ブログがありません。まず1件登録してください。",
          );
          setTone(data.mode === "local" ? "warning" : "info");
        }
      } catch {
        if (!isMounted) return;
        setArticles(readLocalArticles());
        setMessage(
          "既存ブログの読み込みに失敗しました。画面はこの端末内のデータで動作しています。",
        );
        setTone("warning");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadArticles();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveLocalArticles(articles);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesStatus =
        statusFilter === "all" || article.status === statusFilter;
      const matchesQuery =
        !query ||
        [
          article.title,
          article.url,
          article.category,
          article.targetKeyword,
          article.memo,
          ...article.secondaryKeywords,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [articles, searchText, statusFilter]);

  function startCreate() {
    setDraft(createEmptyExistingBlogInput());
    setEditingId(null);
    setMode("form");
  }

  function startEdit(article: ExistingBlogArticle) {
    setDraft(toInput(article));
    setEditingId(article.id);
    setMode("form");
  }

  async function saveArticle() {
    if (!draft.title.trim() || !draft.url.trim()) {
      setTone("warning");
      setMessage("記事タイトルと記事URLを入力してください。");
      return;
    }

    setIsSaving(true);
    setTone("info");
    setMessage("既存ブログを保存しています。");

    try {
      const payload = {
        article: {
          ...draft,
          canonicalUrl: draft.canonicalUrl || draft.url,
        },
        id: editingId,
      };
      const response = await fetch("/api/blog/articles", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: editingId ? "PATCH" : "POST",
      });

      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as {
        article?: ExistingBlogArticle;
      };

      if (data.article) {
        setArticles((current) => {
          const withoutCurrent = current.filter(
            (article) => article.id !== editingId,
          );
          return [data.article as ExistingBlogArticle, ...withoutCurrent];
        });
      }

      setTone("success");
      setMessage("既存ブログを保存しました。");
    } catch {
      const localArticle = editingId
        ? {
            ...createLocalExistingBlogArticle(draft),
            id: editingId,
            normalizedUrl: normalizeBlogUrl(draft.canonicalUrl || draft.url),
          }
        : createLocalExistingBlogArticle(draft);

      setArticles((current) => {
        const withoutCurrent = current.filter(
          (article) => article.id !== editingId,
        );
        return [localArticle, ...withoutCurrent];
      });
      setTone("warning");
      setMessage(
        "Supabase保存に失敗したため、この端末内に保存しました。SQLと環境変数を確認してください。",
      );
    } finally {
      setIsSaving(false);
      setEditingId(null);
      setDraft(createEmptyExistingBlogInput());
      setMode("list");
    }
  }

  async function deleteArticle(articleId: string) {
    const confirmed = window.confirm("この既存ブログを削除しますか？");
    if (!confirmed) return;

    setTone("info");
    setMessage("既存ブログを削除しています。");

    try {
      if (!articleId.startsWith("dummy-") && !articleId.startsWith("existing-blog-")) {
        await fetch("/api/blog/articles", {
          body: JSON.stringify({ id: articleId }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        });
      }
      setArticles((current) =>
        current.filter((article) => article.id !== articleId),
      );
      setTone("success");
      setMessage("既存ブログを削除しました。");
    } catch {
      setTone("error");
      setMessage("削除に失敗しました。時間をおいてもう一度お試しください。");
    }
  }

  async function createRewriteSuggestion(article: ExistingBlogArticle) {
    setRewritingId(article.id);
    setRewriteSuggestion(null);
    setTone("info");
    setMessage("Geminiでリライト提案を作成しています。");

    try {
      const response = await fetch("/api/blog/rewrite", {
        body: JSON.stringify({ article }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("rewrite failed");
      const data = (await response.json()) as {
        suggestion?: BlogRewriteSuggestion;
      };
      if (data.suggestion) {
        setRewriteSuggestion(data.suggestion);
        setTone(data.suggestion.provider === "gemini" ? "success" : "warning");
        setMessage(
          data.suggestion.provider === "gemini"
            ? "Geminiでリライト提案を作成しました。"
            : "モックのリライト提案を表示しています。",
        );
      }
    } catch {
      setTone("error");
      setMessage("リライト提案の作成に失敗しました。AI設定を確認してください。");
    } finally {
      setRewritingId(null);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <StatusMessage
        isLoading={isLoading || isSaving || Boolean(rewritingId)}
        tone={tone}
      >
        {message}
      </StatusMessage>

      {mode === "form" ? (
        <ArticleForm
          draft={draft}
          editingId={editingId}
          isSaving={isSaving}
          onCancel={() => setMode("list")}
          onChange={setDraft}
          onSubmit={saveArticle}
        />
      ) : (
        <>
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  既存ブログ一覧
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  公開済み記事を登録して、Search Console指標からリライト候補を見つけます。
                </p>
              </div>
              <button
                className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                onClick={startCreate}
                type="button"
              >
                既存ブログを登録
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
              <input
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="タイトル、URL、キーワードで検索"
                value={searchText}
              />
              <select
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm"
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | ExistingBlogStatus)
                }
                value={statusFilter}
              >
                <option value="all">すべてのステータス</option>
                {existingBlogStatuses.map((status) => (
                  <option key={status} value={status}>
                    {existingBlogStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <RewriteResult suggestion={rewriteSuggestion} />

          {filteredArticles.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="min-h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
                  onClick={startCreate}
                  type="button"
                >
                  1件目を登録する
                </button>
              }
              description="公開済みブログを登録すると、リライト候補やSearch Console指標を確認できます。"
              title="既存ブログがありません"
            />
          ) : (
            <section className="grid gap-4">
              {filteredArticles.map((article) => {
                const metric = getMetricSignal(article.metrics);
                return (
                  <article
                    className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
                    key={article.id}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="info">{article.category}</Badge>
                          <Badge tone={metric.tone}>{metric.label}</Badge>
                          <Badge tone="neutral">
                            {existingBlogStatusLabels[article.status]}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-stone-950">
                          {article.title}
                        </h3>
                        <a
                          className="mt-1 block break-all text-sm text-teal-700 underline-offset-4 hover:underline"
                          href={article.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {article.url}
                        </a>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {article.memo || "メモはまだありません。"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700"
                          onClick={() => startEdit(article)}
                          type="button"
                        >
                          編集
                        </button>
                        <button
                          className="min-h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"
                          onClick={() => deleteArticle(article.id)}
                          type="button"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md bg-stone-50 p-3">
                        <dt className="font-semibold text-stone-700">
                          対策キーワード
                        </dt>
                        <dd className="mt-1 text-stone-600">
                          {article.targetKeyword || "未設定"}
                        </dd>
                      </div>
                      <div className="rounded-md bg-stone-50 p-3">
                        <dt className="font-semibold text-stone-700">クリック</dt>
                        <dd className="mt-1 text-stone-600">
                          {article.metrics ? article.metrics.clicks : "未取得"}
                        </dd>
                      </div>
                      <div className="rounded-md bg-stone-50 p-3">
                        <dt className="font-semibold text-stone-700">CTR</dt>
                        <dd className="mt-1 text-stone-600">
                          {article.metrics
                            ? formatPercent(article.metrics.ctr)
                            : "未取得"}
                        </dd>
                      </div>
                      <div className="rounded-md bg-stone-50 p-3">
                        <dt className="font-semibold text-stone-700">
                          平均順位
                        </dt>
                        <dd className="mt-1 text-stone-600">
                          {article.metrics
                            ? article.metrics.position.toFixed(1)
                            : "未取得"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                        disabled={rewritingId === article.id}
                        onClick={() => createRewriteSuggestion(article)}
                        type="button"
                      >
                        {rewritingId === article.id
                          ? "提案作成中..."
                          : "リライト提案"}
                      </button>
                      <Link
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                        href={createBlogGeneratorHref(article)}
                      >
                        ブログ下書きへ
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
