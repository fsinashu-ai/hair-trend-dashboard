"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { blogStatusLabels } from "@/lib/blog";
import type { BlogCategory, BlogPost, BlogStatus } from "@/types/blog";

type BlogListProps = {
  categories: BlogCategory[];
  deletingId: string | null;
  filteredPosts: BlogPost[];
  postsCount: number;
  searchText: string;
  selectedCategory: string;
  selectedStatus: string;
  sortOrder: "newest" | "oldest";
  onCategoryChange: (value: string) => void;
  onCreate: () => void;
  onDelete: (postId: string) => void;
  onDuplicate: (post: BlogPost) => void;
  onEdit: (post: BlogPost) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "newest" | "oldest") => void;
  onStatusChange: (value: string) => void;
};

const statusTone: Record<BlogStatus, "neutral" | "success" | "warning" | "info"> = {
  draft: "warning",
  idea: "neutral",
  published: "success",
  ready: "info",
};

export function BlogList({
  categories,
  deletingId,
  filteredPosts,
  postsCount,
  searchText,
  selectedCategory,
  selectedStatus,
  sortOrder,
  onCategoryChange,
  onCreate,
  onDelete,
  onDuplicate,
  onEdit,
  onSearchChange,
  onSortChange,
  onStatusChange,
}: BlogListProps) {
  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">ブログ管理</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              下書き保存、検索、絞り込み、複製、編集ができます。
            </p>
          </div>
          <button
            className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800"
            onClick={onCreate}
            type="button"
          >
            新規作成
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_160px]">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            タイトル検索
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="例: 髪質改善、松江市、白髪ぼかし"
              type="search"
              value={searchText}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            カテゴリ
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) => onCategoryChange(event.target.value)}
              value={selectedCategory}
            >
              <option>すべて</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            ステータス
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) => onStatusChange(event.target.value)}
              value={selectedStatus}
            >
              <option>すべて</option>
              <option value="idea">ネタ</option>
              <option value="draft">下書き</option>
              <option value="ready">確認済み</option>
              <option value="published">公開済み</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            並び替え
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onSortChange(event.target.value as "newest" | "oldest")
              }
              value={sortOrder}
            >
              <option value="newest">作成日 新しい順</option>
              <option value="oldest">作成日 古い順</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-sm text-stone-500">
          表示件数: {filteredPosts.length} / 保存記事: {postsCount}
        </p>
      </div>

      {filteredPosts.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPosts.map((post) => (
            <article
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md sm:p-5"
              key={post.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">{post.category}</Badge>
                  <Badge tone={statusTone[post.status]}>
                    {blogStatusLabels[post.status]}
                  </Badge>
                  <Badge tone={post.generatedBy === "gemini" ? "success" : "neutral"}>
                    {post.generatedBy === "gemini"
                      ? "Gemini"
                      : post.generatedBy === "mock"
                        ? "モック"
                        : "手動"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="min-h-9 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                    onClick={() => onEdit(post)}
                    type="button"
                  >
                    編集
                  </button>
                  <button
                    className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                    onClick={() => onDuplicate(post)}
                    type="button"
                  >
                    複製
                  </button>
                  <button
                    className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                    disabled={deletingId === post.id}
                    onClick={() => onDelete(post.id)}
                    type="button"
                  >
                    {deletingId === post.id ? "削除中" : "削除"}
                  </button>
                </div>
              </div>

              <h3 className="mt-4 break-words text-lg font-semibold leading-7 text-stone-950">
                {post.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {post.excerpt || "概要はまだありません。"}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                生成日時 {new Date(post.createdAt).toLocaleString("ja-JP")} / 最終更新{" "}
                {new Date(post.updatedAt).toLocaleString("ja-JP")}
                {post.aiModel ? ` / ${post.aiModel}` : ""}
              </p>

              <div className="mt-4 rounded-md bg-stone-50 p-3">
                <p className="text-xs font-semibold text-stone-500">
                  狙うキーワード
                </p>
                <p className="mt-1 text-sm text-stone-800">
                  {post.targetKeyword || "未設定"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <button
              className="min-h-10 rounded-md bg-stone-950 px-3 text-sm font-semibold text-white hover:bg-stone-800"
              onClick={onCreate}
              type="button"
            >
              新規作成
            </button>
          }
          description="AI生成または手入力で、WordPressに貼り付ける前のブログ下書きを保存できます。"
          title="ブログ記事はまだありません"
        />
      )}
    </section>
  );
}
