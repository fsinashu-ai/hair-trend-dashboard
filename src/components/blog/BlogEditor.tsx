"use client";

import { FormEvent } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  blogCategories,
  blogStatusLabels,
  blogStatuses,
  createSlug,
  faqToText,
  headingsToText,
  splitBlogTags,
  stringListToText,
  tagsToText,
  textToFaq,
  textToHeadings,
  textToStringList,
} from "@/lib/blog";
import type { BlogPostInput } from "@/types/blog";
import type { SnsPost } from "@/types/snsPost";
import type { Trend } from "@/types/trend";

type BlogEditorProps = {
  draft: BlogPostInput;
  editingId: string | null;
  isSaving: boolean;
  snsPosts: SnsPost[];
  trends: Trend[];
  onCancel: () => void;
  onChange: (draft: BlogPostInput) => void;
  onPreview: () => void;
  onSubmit: () => void;
};

function updateField<K extends keyof BlogPostInput>(
  draft: BlogPostInput,
  key: K,
  value: BlogPostInput[K],
) {
  return {
    ...draft,
    [key]: value,
  };
}

export function BlogEditor({
  draft,
  editingId,
  isSaving,
  snsPosts,
  trends,
  onCancel,
  onChange,
  onPreview,
  onSubmit,
}: BlogEditorProps) {
  const latestTrends = trends.slice(0, 8);
  const latestSnsPosts = snsPosts.slice(0, 6);
  const youtubeTrends = trends
    .filter((trend) => trend.category === "YouTube" || trend.url.includes("youtube"))
    .slice(0, 6);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function toggleTrendId(id: string) {
    const currentIds = new Set(draft.relatedTrendIds);

    if (currentIds.has(id)) {
      currentIds.delete(id);
    } else {
      currentIds.add(id);
    }

    onChange(updateField(draft, "relatedTrendIds", Array.from(currentIds)));
  }

  function toggleSnsPostId(id: string) {
    const currentIds = new Set(draft.relatedSnsPostIds);

    if (currentIds.has(id)) {
      currentIds.delete(id);
    } else {
      currentIds.add(id);
    }

    onChange(updateField(draft, "relatedSnsPostIds", Array.from(currentIds)));
  }

  function toggleYoutubeUrl(url: string) {
    const currentUrls = new Set(draft.relatedYoutubeUrls);

    if (currentUrls.has(url)) {
      currentUrls.delete(url);
    } else {
      currentUrls.add(url);
    }

    onChange(updateField(draft, "relatedYoutubeUrls", Array.from(currentUrls)));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <form
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              {editingId ? "ブログ編集" : "ブログ新規作成"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              WordPressへ貼り付ける前の下書きを保存します。
            </p>
          </div>
          <Badge tone="info">{editingId ? "編集中" : "新規"}</Badge>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            SEOタイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "title", event.target.value))
              }
              placeholder="例: 松江市で髪質改善を考えている大人女性へ"
              required
              value={draft.title}
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              スラッグ
              <div className="flex gap-2">
                <input
                  className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                  onChange={(event) =>
                    onChange(updateField(draft, "slug", createSlug(event.target.value)))
                  }
                  required
                  value={draft.slug}
                />
                <button
                  className="min-h-11 shrink-0 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() =>
                    onChange(updateField(draft, "slug", createSlug(draft.title)))
                  }
                  type="button"
                >
                  自動
                </button>
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              カテゴリ
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(
                    updateField(
                      draft,
                      "category",
                      event.target.value as BlogPostInput["category"],
                    ),
                  )
                }
                value={draft.category}
              >
                {blogCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              ステータス
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(
                    updateField(
                      draft,
                      "status",
                      event.target.value as BlogPostInput["status"],
                    ),
                  )
                }
                value={draft.status}
              >
                {blogStatuses.map((status) => (
                  <option key={status} value={status}>
                    {blogStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            狙うキーワード
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "targetKeyword", event.target.value))
              }
              placeholder="例: 松江市 髪質改善"
              value={draft.targetKeyword}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            補助キーワード（1行に1つ）
            <textarea
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(
                  updateField(
                    draft,
                    "secondaryKeywords",
                    textToStringList(event.target.value).slice(0, 10),
                  ),
                )
              }
              value={stringListToText(draft.secondaryKeywords)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            検索意図
            <textarea
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "searchIntent", event.target.value))
              }
              value={draft.searchIntent ?? ""}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              想定読者
              <textarea
                className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(updateField(draft, "targetAudience", event.target.value))
                }
                value={draft.targetAudience ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              読者の悩み（1行に1つ）
              <textarea
                className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(
                    updateField(
                      draft,
                      "readerProblems",
                      textToStringList(event.target.value).slice(0, 8),
                    ),
                  )
                }
                value={stringListToText(draft.readerProblems)}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            メタタイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              maxLength={60}
              onChange={(event) =>
                onChange(updateField(draft, "metaTitle", event.target.value))
              }
              value={draft.metaTitle ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            メタディスクリプション
            <textarea
              className="min-h-20 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "metaDescription", event.target.value))
              }
              placeholder="検索結果に表示される説明文です。120〜160文字程度を目安にします。"
              value={draft.metaDescription}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            抜粋
            <textarea
              className="min-h-20 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "excerpt", event.target.value))
              }
              value={draft.excerpt}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            記事概要
            <textarea
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "articleSummary", event.target.value))
              }
              value={draft.articleSummary ?? ""}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            タグ
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "tags", splitBlogTags(event.target.value)))
              }
              placeholder="髪質改善、縮毛矯正、松江市美容室"
              value={tagsToText(draft.tags)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            本文
            <textarea
              className="min-h-[420px] rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "content", event.target.value))
              }
              placeholder="導入文、## 見出し、### 小見出し、本文、まとめを書きます"
              required
              value={draft.content}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            h2／h3構成
            <textarea
              className="min-h-48 rounded-md border border-stone-300 px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(
                  updateField(draft, "headings", textToHeadings(event.target.value)),
                )
              }
              placeholder={'## 大見出し\n### 小見出し'}
              value={headingsToText(draft.headings)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            本文HTML
            <textarea
              className="min-h-72 rounded-md border border-stone-300 px-3 py-2 font-mono text-xs leading-6 outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "bodyHtml", event.target.value))
              }
              value={draft.bodyHtml ?? ""}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              Before／After画像用キャプション
              <textarea
                className="min-h-36 rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(
                    updateField(
                      draft,
                      "beforeAfterCaptions",
                      textToStringList(event.target.value).slice(0, 4),
                    ),
                  )
                }
                value={stringListToText(draft.beforeAfterCaptions)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              内部リンク候補
              <textarea
                className="min-h-36 rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(
                    updateField(
                      draft,
                      "internalLinkSuggestions",
                      textToStringList(event.target.value).slice(0, 8),
                    ),
                  )
                }
                value={stringListToText(draft.internalLinkSuggestions)}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            よくある質問
            <textarea
              className="min-h-56 rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "faq", textToFaq(event.target.value)))
              }
              placeholder={'Q: 質問\nA: 回答'}
              value={faqToText(draft.faq)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              LINE相談・予約CTA
              <input
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(updateField(draft, "ctaText", event.target.value))
                }
                value={draft.ctaText ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              CTA URL
              <input
                className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  onChange(updateField(draft, "ctaUrl", event.target.value))
                }
                value={draft.ctaUrl ?? ""}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-stone-700">
            WordPress貼り付け用HTML
            <textarea
              className="min-h-80 rounded-md border border-stone-300 px-3 py-2 font-mono text-xs leading-6 outline-none focus:border-teal-600"
              onChange={(event) =>
                onChange(updateField(draft, "wordpressHtml", event.target.value))
              }
              value={draft.wordpressHtml ?? ""}
            />
          </label>

          <div className="flex flex-wrap gap-2 rounded-md bg-stone-50 p-3">
            <Badge tone={draft.generatedBy === "gemini" ? "success" : "neutral"}>
              {draft.generatedBy === "gemini"
                ? "Gemini生成"
                : draft.generatedBy === "mock"
                  ? "モック生成"
                  : "手動作成"}
            </Badge>
            {draft.aiModel ? <Badge tone="info">{draft.aiModel}</Badge> : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isSaving || !draft.title.trim() || !draft.content.trim()}
            type="submit"
          >
            {isSaving ? "保存中" : "下書きを保存"}
          </button>
          <button
            className="min-h-11 rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            onClick={onPreview}
            type="button"
          >
            プレビューを見る
          </button>
          <button
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onCancel}
            type="button"
          >
            一覧へ戻る
          </button>
        </div>
      </form>

      <aside className="grid content-start gap-5">
        <ReferenceBox title="関連トレンド" emptyLabel="トレンドがありません。">
          {latestTrends.map((trend) => (
            <label
              className="flex gap-2 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700"
              key={trend.id}
            >
              <input
                checked={draft.relatedTrendIds.includes(trend.id)}
                className="mt-1"
                onChange={() => toggleTrendId(trend.id)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold">{trend.title}</span>
                <span className="mt-1 block text-xs text-stone-500">
                  {trend.category}
                </span>
              </span>
            </label>
          ))}
        </ReferenceBox>

        <ReferenceBox title="関連SNS投稿" emptyLabel="SNS投稿がありません。">
          {latestSnsPosts.map((post) => (
            <label
              className="flex gap-2 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700"
              key={post.id}
            >
              <input
                checked={draft.relatedSnsPostIds.includes(post.id)}
                className="mt-1"
                onChange={() => toggleSnsPostId(post.id)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold">{post.title}</span>
                <span className="mt-1 block text-xs text-stone-500">
                  {post.snsType}
                </span>
              </span>
            </label>
          ))}
        </ReferenceBox>

        <ReferenceBox title="関連YouTube" emptyLabel="YouTube候補がありません。">
          {youtubeTrends.map((trend) => (
            <label
              className="flex gap-2 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700"
              key={trend.url}
            >
              <input
                checked={draft.relatedYoutubeUrls.includes(trend.url)}
                className="mt-1"
                onChange={() => toggleYoutubeUrl(trend.url)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold">{trend.title}</span>
                <span className="mt-1 block text-xs text-stone-500">
                  {trend.sourceName}
                </span>
              </span>
            </label>
          ))}
        </ReferenceBox>
      </aside>
    </section>
  );
}

function ReferenceBox({
  children,
  emptyLabel,
  title,
}: {
  children: ReactNode;
  emptyLabel: string;
  title: string;
}) {
  const hasChildren =
    Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
      <div className="mt-3 grid gap-2">
        {hasChildren ? children : <p className="text-sm text-stone-500">{emptyLabel}</p>}
      </div>
    </section>
  );
}
