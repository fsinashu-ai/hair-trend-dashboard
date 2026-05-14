"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { snsProviderConfigs } from "@/config/snsProviders";
import {
  readLocalBackupSnsPosts,
  readLocalBackupTrends,
  saveLocalBackupSnsPosts,
  saveLocalBackupTrends,
} from "@/lib/backup/localStorage";
import { detectSnsTypeFromUrl, snsTrendCategories, splitTags, tagsToInputValue } from "@/lib/sns";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createSnsPostInSupabase,
  deleteSnsPostFromSupabase,
  fetchSnsPostsFromSupabase,
} from "@/lib/supabase/snsPosts";
import { createTrendLinkInSupabase } from "@/lib/supabase/trends";
import type { NewSnsPost, SnsAiClassification, SnsPost, SnsType } from "@/types/snsPost";
import type { Trend, TrendCategory } from "@/types/trend";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type SnsPostForm = {
  snsType: SnsType;
  url: string;
  title: string;
  memo: string;
  category: TrendCategory;
  tagsText: string;
  savedAt: string;
};

const supabaseEnabled = isSupabaseConfigured();

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm(): SnsPostForm {
  return {
    category: "SNS投稿",
    memo: "",
    savedAt: getToday(),
    snsType: "Instagram",
    tagsText: "",
    title: "",
    url: "",
  };
}

function createLocalPost(post: NewSnsPost): SnsPost {
  return {
    ...post,
    createdAt: new Date().toISOString(),
    id: `sns-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
}

function createTrendFromSnsPost(post: SnsPost): Trend {
  return {
    category: post.category,
    heat: "中",
    id: `sns-trend-${post.id}-${Date.now()}`,
    keywords: [post.category, post.snsType, ...post.tags.map((tag) => tag.replace(/^#/, ""))].slice(0, 8),
    memo: post.aiSummary || post.memo,
    publishedAt: post.savedAt,
    registeredAt: post.savedAt,
    sourceName: `${post.snsType}投稿`,
    summary: post.aiSummary || post.memo,
    tags: post.tags.length > 0 ? post.tags : [`#${post.category}`],
    title: post.title,
    url: post.url,
  };
}

function SnsPostCard({
  isDeleting,
  isSendingToTrend,
  post,
  onDelete,
  onSendToTrend,
}: {
  isDeleting: boolean;
  isSendingToTrend: boolean;
  post: SnsPost;
  onDelete: (postId: string) => void;
  onSendToTrend: (post: SnsPost) => void;
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{post.snsType}</Badge>
            <Badge tone="info">{post.category}</Badge>
          </div>
          <p className="mt-2 text-xs text-stone-500">保存日 {post.savedAt}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="min-h-9 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            disabled={isSendingToTrend}
            onClick={() => onSendToTrend(post)}
            type="button"
          >
            {isSendingToTrend ? "追加中" : "トレンド化"}
          </button>
          <button
            className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            disabled={isDeleting}
            onClick={() => onDelete(post.id)}
            type="button"
          >
            {isDeleting ? "削除中" : "削除"}
          </button>
        </div>
      </div>

      <h2 className="mt-4 break-words text-lg font-semibold leading-7 text-stone-950">
        {post.title}
      </h2>
      <p className="mt-2 break-words text-sm leading-6 text-stone-600">
        {post.aiSummary || post.memo || "メモはありません。"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>

      {post.postIdea ? (
        <div className="mt-5 rounded-md bg-teal-50 p-3">
          <p className="text-xs font-semibold text-teal-800">Instagram投稿ネタ</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
            {post.postIdea}
          </p>
        </div>
      ) : null}

      {post.counselingIdea ? (
        <div className="mt-4 rounded-md bg-stone-50 p-3">
          <p className="text-xs font-semibold text-stone-500">
            カウンセリング活用例
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
            {post.counselingIdea}
          </p>
        </div>
      ) : null}

      <a
        className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 sm:w-auto"
        href={post.url}
        rel="noreferrer"
        target="_blank"
      >
        SNS投稿URLを開く
      </a>
    </article>
  );
}

export function SnsPostManager() {
  const [posts, setPosts] = useState<SnsPost[]>(() =>
    supabaseEnabled ? [] : readLocalBackupSnsPosts() ?? [],
  );
  const [form, setForm] = useState<SnsPostForm>(() => createEmptyForm());
  const [classification, setClassification] =
    useState<SnsAiClassification | null>(null);
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [sendingTrendId, setSendingTrendId] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "SupabaseからSNS投稿を読み込んでいます。"
      : "Supabase未設定のため、この端末にSNS投稿を保存します。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadPosts() {
      try {
        const data = await fetchSnsPostsFromSupabase();

        if (!isMounted) {
          return;
        }

        setPosts(data ?? []);
        setStatusTone("success");
        setMessage("SNS投稿を読み込みました。");
      } catch {
        if (!isMounted) {
          return;
        }

        setPosts([]);
        setStatusTone("warning");
        setMessage("SNS投稿を読み込めませんでした。Supabaseのsns_postsテーブルを確認してください。");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (supabaseEnabled) {
      return;
    }

    saveLocalBackupSnsPosts(posts);
  }, [posts]);

  const providerNote = useMemo(
    () =>
      snsProviderConfigs.find((provider) => provider.type === form.snsType)?.note ??
      "手動URL登録で扱います。",
    [form.snsType],
  );

  function updateUrl(url: string) {
    setForm((current) => ({
      ...current,
      snsType: detectSnsTypeFromUrl(url),
      url,
    }));
    setClassification(null);
  }

  async function handleAnalyze() {
    if (!form.url.trim()) {
      setStatusTone("warning");
      setMessage("AI分類する前にSNS投稿URLを入力してください。");
      return;
    }

    setIsAnalyzing(true);
    setStatusTone("info");
    setMessage("SNS投稿をAIで分類しています。URL先のスクレイピングは行いません。");

    try {
      const response = await fetch("/api/sns-posts/analyze", {
        body: JSON.stringify({
          category: form.category,
          memo: form.memo,
          snsType: form.snsType,
          tags: splitTags(form.tagsText),
          title: form.title,
          url: form.url,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to analyze SNS post.");
      }

      const data = (await response.json()) as SnsAiClassification & {
        providerLabel?: string;
      };

      setClassification(data);
      setForm((current) => ({
        ...current,
        category: data.category,
        memo: data.memo,
        tagsText: tagsToInputValue(data.tags),
        title: current.title.trim() || data.trendName,
      }));
      setStatusTone(data.providerLabel === "モック分類" ? "warning" : "success");
      setMessage(`${data.providerLabel ?? "AI API"}でSNS投稿を分類しました。`);
    } catch {
      setStatusTone("error");
      setMessage("SNS投稿のAI分類に失敗しました。AI API設定を確認してください。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.url.trim() || !form.title.trim()) {
      setStatusTone("warning");
      setMessage("SNS投稿URLとタイトルを入力してください。");
      return;
    }

    const tags = splitTags(form.tagsText);
    const newPost: NewSnsPost = {
      aiSummary: classification?.memo ?? form.memo,
      category: classification?.category ?? form.category,
      counselingIdea: classification?.counselingIdea ?? "",
      memo: form.memo.trim(),
      postIdea: classification?.instagramPostIdea ?? "",
      savedAt: form.savedAt || getToday(),
      snsType: form.snsType,
      tags: tags.length > 0 ? tags : [`#${form.category}`],
      title: form.title.trim(),
      url: form.url.trim(),
    };

    setIsSaving(true);
    setStatusTone("info");
    setMessage("SNS投稿を保存しています。");

    try {
      if (supabaseEnabled) {
        const savedPost = await createSnsPostInSupabase(newPost);

        if (savedPost) {
          setPosts((currentPosts) => [savedPost, ...currentPosts]);
          setStatusTone("success");
          setMessage("SNS投稿をSupabaseに保存しました。");
        }
      } else {
        setPosts((currentPosts) => [createLocalPost(newPost), ...currentPosts]);
        setStatusTone("warning");
        setMessage("Supabase未設定のため、この端末にSNS投稿を保存しました。");
      }

      setForm(createEmptyForm());
      setClassification(null);
    } catch {
      setStatusTone("error");
      setMessage("SNS投稿の保存に失敗しました。Supabaseのsns_postsテーブルを確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(postId: string) {
    setDeletingPostId(postId);
    setStatusTone("info");
    setMessage("SNS投稿を削除しています。");

    try {
      if (supabaseEnabled) {
        await deleteSnsPostFromSupabase(postId);
        setStatusTone("success");
        setMessage("SNS投稿を削除しました。");
      } else {
        setStatusTone("warning");
        setMessage("この端末に保存したSNS投稿を削除しました。");
      }

      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
    } catch {
      setStatusTone("error");
      setMessage("SNS投稿の削除に失敗しました。");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleSendToTrend(post: SnsPost) {
    setSendingTrendId(post.id);
    setStatusTone("info");
    setMessage("SNS投稿からトレンド候補を作成しています。");

    try {
      if (supabaseEnabled) {
        await createTrendLinkInSupabase({
          category: post.category,
          memo: post.aiSummary || post.memo,
          registeredAt: post.savedAt,
          tags: post.tags,
          title: post.title,
          url: post.url,
        });
        setStatusTone("success");
        setMessage("トレンド一覧にSNS投稿由来の候補を追加しました。");
      } else {
        const savedTrends = readLocalBackupTrends() ?? [];
        saveLocalBackupTrends([createTrendFromSnsPost(post), ...savedTrends]);
        setStatusTone("warning");
        setMessage("この端末のトレンド一覧バックアップにSNS投稿由来の候補を追加しました。");
      }
    } catch {
      setStatusTone("error");
      setMessage("トレンド候補の作成に失敗しました。Supabase設定を確認してください。");
    } finally {
      setSendingTrendId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">SNS投稿を登録</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          SNS本文の自動取得はせず、手動で確認した投稿URLとメモだけを保存します。
        </p>

        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            SNS投稿URL
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) => updateUrl(event.target.value)}
              placeholder="https://www.instagram.com/..."
              required
              type="url"
              value={form.url}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              SNS種別
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    snsType: event.target.value as SnsType,
                  }))
                }
                value={form.snsType}
              >
                {snsProviderConfigs.map((provider) => (
                  <option key={provider.type} value={provider.type}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-stone-700">
              カテゴリ
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as TrendCategory,
                  }))
                }
                value={form.category}
              >
                {snsTrendCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            タイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例: 艶感ストレートのBefore/After投稿"
              required
              value={form.title}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            メモ
            <textarea
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, memo: event.target.value }))
              }
              placeholder="どんな提案や投稿ネタに使えそうかを書きます"
              value={form.memo}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              タグ
              <input
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tagsText: event.target.value,
                  }))
                }
                placeholder="髪質改善、艶髪、くせ毛"
                value={form.tagsText}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              保存日
              <input
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({ ...current, savedAt: event.target.value }))
                }
                type="date"
                value={form.savedAt}
              />
            </label>
          </div>

          <div className="rounded-md bg-stone-50 p-3">
            <p className="text-xs font-semibold text-stone-500">安全メモ</p>
            <p className="mt-1 text-sm leading-6 text-stone-700">{providerNote}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-11 rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              disabled={isAnalyzing || !form.url.trim()}
              onClick={handleAnalyze}
              type="button"
            >
              {isAnalyzing ? "AI分類中" : "AIで分類する"}
            </button>
            <button
              className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={isSaving || !form.url.trim() || !form.title.trim()}
              type="submit"
            >
              {isSaving ? "保存中" : "SNS投稿を保存"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid content-start gap-5">
        <StatusMessage
          isLoading={isLoading || isAnalyzing || isSaving || Boolean(deletingPostId)}
          tone={statusTone}
        >
          {message}
        </StatusMessage>

        {classification ? (
          <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">AI分類結果</Badge>
              <Badge tone="info">{classification.category}</Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-stone-950">
              {classification.trendName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {classification.memo}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {classification.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">SNS投稿一覧</h2>
            <Badge tone={supabaseEnabled ? "success" : "warning"}>
              {supabaseEnabled ? "Supabase保存" : "端末保存"}
            </Badge>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="h-6 w-32 animate-pulse rounded-md bg-stone-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded-md bg-stone-100" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-stone-100" />
            </div>
          ) : posts.length > 0 ? (
            <div className="grid gap-4">
              {posts.map((post) => (
                <SnsPostCard
                  isDeleting={deletingPostId === post.id}
                  isSendingToTrend={sendingTrendId === post.id}
                  key={post.id}
                  post={post}
                  onDelete={handleDelete}
                  onSendToTrend={handleSendToTrend}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              description="Instagram、YouTube、Pinterest、TikTok、Xなどの投稿URLを手動で登録すると、AI分類してトレンド候補にできます。"
              title="SNS投稿はまだありません"
            />
          )}
        </section>
      </div>
    </section>
  );
}
