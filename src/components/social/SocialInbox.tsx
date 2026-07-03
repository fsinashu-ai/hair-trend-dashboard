"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  readLocalBackupBlogPosts,
  readLocalBackupTrends,
  saveLocalBackupBlogPosts,
  saveLocalBackupTrends,
} from "@/lib/backup/localStorage";
import { createLocalBlogPost } from "@/lib/blog";
import {
  readLocalSocialPosts,
  saveLocalSocialPosts,
} from "@/lib/social/localStorage";
import { getTitleSimilarity } from "@/lib/social/url";
import {
  createBlogDraftFromSocialPost,
  createTrendFromSocialPost,
} from "@/lib/social/workflow";
import { createBlogPostInSupabase } from "@/lib/supabase/blogPosts";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchSocialPostsFromSupabase,
  updateSocialPostInSupabase,
  updateSocialPostsInSupabase,
} from "@/lib/supabase/socialPosts";
import { createTrendLinkInSupabase } from "@/lib/supabase/trends";
import type { SnsType } from "@/types/snsPost";
import type {
  SocialPost,
  SocialReviewStatus,
} from "@/types/social";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

type StorageMode = "supabase" | "local";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const supabaseEnabled = isSupabaseConfigured();
const snsTypes: Array<SnsType | "すべて"> = [
  "すべて",
  "Instagram",
  "YouTube",
  "Pinterest",
  "TikTok",
  "X",
  "Other",
];
const relevanceOptions: Array<SalonRelevance | "すべて"> = [
  "すべて",
  "高",
  "中",
  "低",
];
const reviewStatuses: SocialReviewStatus[] = [
  "未確認",
  "採用",
  "保留",
  "不要",
];

const reviewStatusTone: Record<
  SocialReviewStatus,
  "info" | "success" | "warning" | "danger"
> = {
  未確認: "info",
  採用: "success",
  保留: "warning",
  不要: "danger",
};

function formatDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function getRelevanceTone(relevance: SalonRelevance) {
  if (relevance === "高") {
    return "success" as const;
  }

  if (relevance === "低") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function SocialInbox() {
  const [storageMode] = useState<StorageMode>(
    supabaseEnabled ? "supabase" : "local",
  );
  const [posts, setPosts] = useState<SocialPost[]>(() =>
    supabaseEnabled ? [] : readLocalSocialPosts(),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snsFilter, setSnsFilter] = useState<SnsType | "すべて">("すべて");
  const [categoryFilter, setCategoryFilter] = useState<
    TrendCategory | "すべて"
  >("すべて");
  const [relevanceFilter, setRelevanceFilter] = useState<
    SalonRelevance | "すべて"
  >("すべて");
  const [onlyUnchecked, setOnlyUnchecked] = useState(true);
  const [visibleIdeaId, setVisibleIdeaId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "SNS受信箱を読み込んでいます。"
      : "Supabase未設定のため、この端末に保存されたSNS情報を表示します。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadPosts() {
      try {
        const data = await fetchSocialPostsFromSupabase();

        if (isMounted) {
          setPosts(data ?? []);
          setStatusTone("success");
          setMessage("SNS受信箱を読み込みました。");
        }
      } catch {
        if (isMounted) {
          setStatusTone("error");
          setMessage(
            "SNS受信箱を読み込めませんでした。Supabaseで最新のschema.sqlを実行してください。",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(
    () =>
      Array.from(new Set(posts.map((post) => post.category))).sort((a, b) =>
        a.localeCompare(b, "ja"),
      ),
    [posts],
  );

  const duplicateCandidates = useMemo(() => {
    const result = new Map<string, SocialPost[]>();

    for (const post of posts) {
      const matches = posts.filter(
        (candidate) =>
          candidate.id !== post.id &&
          (candidate.canonicalUrl === post.canonicalUrl ||
            getTitleSimilarity(candidate.title, post.title) >= 0.72),
      );

      if (matches.length > 0) {
        result.set(post.id, matches);
      }
    }

    return result;
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        if (onlyUnchecked && post.reviewStatus !== "未確認") {
          return false;
        }

        if (snsFilter !== "すべて" && post.snsType !== snsFilter) {
          return false;
        }

        if (
          categoryFilter !== "すべて" &&
          post.category !== categoryFilter
        ) {
          return false;
        }

        if (
          relevanceFilter !== "すべて" &&
          post.relevance !== relevanceFilter
        ) {
          return false;
        }

        return true;
      }),
    [
      categoryFilter,
      onlyUnchecked,
      posts,
      relevanceFilter,
      snsFilter,
    ],
  );

  const counts = useMemo(
    () =>
      reviewStatuses.reduce<Record<SocialReviewStatus, number>>(
        (result, status) => {
          result[status] = posts.filter(
            (post) => post.reviewStatus === status,
          ).length;
          return result;
        },
        {
          未確認: 0,
          採用: 0,
          保留: 0,
          不要: 0,
        },
      ),
    [posts],
  );

  function replacePosts(nextPosts: SocialPost[]) {
    setPosts(nextPosts);

    if (storageMode === "local") {
      saveLocalSocialPosts(nextPosts);
    }
  }

  async function updatePost(
    post: SocialPost,
    changes: Partial<
      Pick<SocialPost, "reviewStatus" | "isFavorite">
    >,
  ) {
    setWorkingId(post.id);

    try {
      const updated =
        storageMode === "supabase"
          ? await updateSocialPostInSupabase(post.id, changes)
          : { ...post, ...changes, updatedAt: new Date().toISOString() };

      if (!updated) {
        throw new Error("SNS投稿を更新できませんでした。");
      }

      replacePosts(
        posts.map((item) => (item.id === post.id ? updated : item)),
      );
      setStatusTone("success");
      setMessage(
        changes.reviewStatus
          ? `「${post.title}」を${changes.reviewStatus}に変更しました。`
          : "お気に入りを更新しました。",
      );
    } catch {
      setStatusTone("error");
      setMessage(
        "更新できませんでした。Supabaseで最新のschema.sqlを実行してください。",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function bulkUpdate(reviewStatus: SocialReviewStatus) {
    if (selectedIds.length === 0) {
      setStatusTone("warning");
      setMessage("先に投稿を選択してください。");
      return;
    }

    setIsBulkUpdating(true);
    setStatusTone("info");
    setMessage(`${selectedIds.length}件を${reviewStatus}に変更しています。`);

    try {
      if (storageMode === "supabase") {
        await updateSocialPostsInSupabase(selectedIds, { reviewStatus });
      }

      replacePosts(
        posts.map((post) =>
          selectedIds.includes(post.id)
            ? {
                ...post,
                reviewStatus,
                updatedAt: new Date().toISOString(),
              }
            : post,
        ),
      );
      setSelectedIds([]);
      setStatusTone("success");
      setMessage(`${selectedIds.length}件を${reviewStatus}に変更しました。`);
    } catch {
      setStatusTone("error");
      setMessage(
        "一括更新に失敗しました。Supabaseで最新のschema.sqlを実行してください。",
      );
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function toggleSelected(postId: string) {
    setSelectedIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  }

  function toggleAllVisible() {
    const visibleIds = filteredPosts.map((post) => post.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  async function sendToTrend(post: SocialPost) {
    if (post.reviewStatus !== "採用") {
      setStatusTone("warning");
      setMessage("トレンド化する前に、この投稿を「採用」にしてください。");
      return;
    }

    setWorkingId(post.id);
    setStatusTone("info");
    setMessage("採用したSNS投稿をトレンド一覧へ追加しています。");

    try {
      if (storageMode === "supabase") {
        await createTrendLinkInSupabase({
          category: post.category,
          counselingIdea: post.counselingIdea,
          instagramIdea: post.instagramPostIdea,
          memo: post.aiSummary,
          registeredAt: post.importedAt.slice(0, 10),
          salonRelevance: post.relevance,
          tags: post.tags,
          title: post.title,
          url: post.canonicalUrl,
        });
      } else {
        saveLocalBackupTrends([
          createTrendFromSocialPost(post),
          ...(readLocalBackupTrends() ?? []),
        ]);
      }

      setStatusTone("success");
      setMessage("トレンド一覧へ追加しました。");
    } catch {
      setStatusTone("error");
      setMessage(
        "トレンド化できませんでした。同じURLが保存済みか、Supabase設定を確認してください。",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function sendToBlog(post: SocialPost) {
    setWorkingId(post.id);
    setStatusTone("info");
    setMessage("SNS投稿からブログ下書きを作成しています。");

    try {
      const draft = createBlogDraftFromSocialPost(post);

      if (storageMode === "supabase") {
        const saved = await createBlogPostInSupabase(draft);

        if (!saved) {
          throw new Error("Blog draft was not saved.");
        }
      } else {
        saveLocalBackupBlogPosts([
          createLocalBlogPost(draft),
          ...(readLocalBackupBlogPosts() ?? []),
        ]);
      }

      setStatusTone("success");
      setMessage("ブログ管理へ下書き保存しました。");
    } catch {
      setStatusTone("error");
      setMessage(
        "ブログ化できませんでした。Supabase設定とblog_postsテーブルを確認してください。",
      );
    } finally {
      setWorkingId(null);
    }
  }

  const allVisibleSelected =
    filteredPosts.length > 0 &&
    filteredPosts.every((post) => selectedIds.includes(post.id));

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {reviewStatuses.map((status) => (
          <div
            className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
            key={status}
          >
            <p className="text-xs font-semibold text-stone-500">{status}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-950">
              {counts[status]}
            </p>
          </div>
        ))}
      </section>

      <StatusMessage
        isLoading={isLoading || isBulkUpdating || Boolean(workingId)}
        tone={statusTone}
      >
        {message}
      </StatusMessage>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            SNS種類
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm"
              onChange={(event) =>
                setSnsFilter(event.target.value as SnsType | "すべて")
              }
              value={snsFilter}
            >
              {snsTypes.map((snsType) => (
                <option key={snsType} value={snsType}>
                  {snsType}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            カテゴリ
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm"
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as TrendCategory | "すべて",
                )
              }
              value={categoryFilter}
            >
              <option value="すべて">すべて</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-stone-700">
            関連度
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm"
              onChange={(event) =>
                setRelevanceFilter(
                  event.target.value as SalonRelevance | "すべて",
                )
              }
              value={relevanceFilter}
            >
              {relevanceOptions.map((relevance) => (
                <option key={relevance} value={relevance}>
                  {relevance}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700">
            <input
              checked={onlyUnchecked}
              className="size-4"
              onChange={(event) => setOnlyUnchecked(event.target.checked)}
              type="checkbox"
            />
            未確認だけ表示
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-stone-700">
            <input
              checked={allVisibleSelected}
              className="size-4"
              disabled={filteredPosts.length === 0}
              onChange={toggleAllVisible}
              type="checkbox"
            />
            表示中をすべて選択
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-300"
              disabled={selectedIds.length === 0 || isBulkUpdating}
              onClick={() => bulkUpdate("採用")}
              type="button"
            >
              一括で採用
            </button>
            <button
              className="min-h-11 rounded-md border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:text-stone-400"
              disabled={selectedIds.length === 0 || isBulkUpdating}
              onClick={() => bulkUpdate("不要")}
              type="button"
            >
              一括で不要
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {selectedIds.length}件選択中 / 表示 {filteredPosts.length}件
        </p>
      </section>

      {isLoading ? (
        <div className="grid gap-4">
          {[0, 1].map((item) => (
            <div
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              key={item}
            >
              <div className="h-5 w-40 animate-pulse rounded bg-stone-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-stone-100" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          description={
            posts.length === 0
              ? "SNS情報取得画面から公開投稿URLを取り込むと、ここに未確認として届きます。"
              : "現在の絞り込み条件に一致する投稿はありません。"
          }
          title={
            posts.length === 0
              ? "受信箱は空です"
              : "該当するSNS投稿はありません"
          }
        />
      ) : (
        <section className="grid gap-4">
          {filteredPosts.map((post) => {
            const duplicates = duplicateCandidates.get(post.id) ?? [];
            const isWorking = workingId === post.id;

            return (
              <article
                className={`rounded-lg border bg-white p-4 shadow-sm sm:p-5 ${
                  selectedIds.includes(post.id)
                    ? "border-teal-400"
                    : "border-stone-200"
                }`}
                key={post.id}
              >
                <div className="flex items-start gap-3">
                  <input
                    aria-label={`${post.title}を選択`}
                    checked={selectedIds.includes(post.id)}
                    className="mt-1 size-5 shrink-0"
                    onChange={() => toggleSelected(post.id)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={reviewStatusTone[post.reviewStatus]}>
                          {post.reviewStatus}
                        </Badge>
                        <Badge tone="info">{post.snsType}</Badge>
                        <Badge>{post.category}</Badge>
                        <Badge tone={getRelevanceTone(post.relevance)}>
                          関連度 {post.relevance}
                        </Badge>
                        {post.isFavorite ? (
                          <Badge tone="warning">お気に入り</Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-stone-500">
                        {formatDateTime(post.importedAt)}
                      </span>
                    </div>

                    <h2 className="mt-3 break-words text-lg font-semibold leading-7 text-stone-950">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {post.aiSummary || post.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>

                    {duplicates.length > 0 ? (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-800">
                          重複候補 {duplicates.length}件
                        </p>
                        <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-800">
                          {duplicates.slice(0, 3).map((duplicate) => (
                            <li key={duplicate.id}>・{duplicate.title}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {visibleIdeaId === post.id ? (
                      <div className="mt-4 rounded-md bg-teal-50 p-3">
                        <p className="text-xs font-semibold text-teal-800">
                          Instagram投稿案
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                          {post.instagramPostIdea}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        className="min-h-10 rounded-md border border-teal-200 px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:text-stone-400"
                        disabled={isWorking}
                        onClick={() =>
                          updatePost(post, { reviewStatus: "採用" })
                        }
                        type="button"
                      >
                        採用
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-amber-200 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:text-stone-400"
                        disabled={isWorking}
                        onClick={() =>
                          updatePost(post, { reviewStatus: "保留" })
                        }
                        type="button"
                      >
                        保留
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-rose-200 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:text-stone-400"
                        disabled={isWorking}
                        onClick={() =>
                          updatePost(post, { reviewStatus: "不要" })
                        }
                        type="button"
                      >
                        不要
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button
                        className="min-h-11 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-300"
                        disabled={
                          isWorking || post.reviewStatus !== "採用"
                        }
                        onClick={() => sendToTrend(post)}
                        type="button"
                      >
                        トレンド化
                      </button>
                      <button
                        className="min-h-11 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:text-stone-400"
                        disabled={isWorking}
                        onClick={() => sendToBlog(post)}
                        type="button"
                      >
                        ブログ化
                      </button>
                      <button
                        className="min-h-11 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                        onClick={() =>
                          setVisibleIdeaId((current) =>
                            current === post.id ? null : post.id,
                          )
                        }
                        type="button"
                      >
                        Instagram投稿案
                      </button>
                      <button
                        aria-pressed={post.isFavorite}
                        className="min-h-11 rounded-md border border-amber-200 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:text-stone-400"
                        disabled={isWorking}
                        onClick={() =>
                          updatePost(post, {
                            isFavorite: !post.isFavorite,
                          })
                        }
                        type="button"
                      >
                        {post.isFavorite ? "★ お気に入り" : "☆ お気に入り"}
                      </button>
                      <a
                        className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                        href={post.canonicalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        元投稿を確認
                      </a>
                    </div>

                    {post.reviewStatus !== "採用" ? (
                      <p className="mt-2 text-xs text-stone-500">
                        トレンド化は「採用」にした投稿だけ利用できます。
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
