"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  blogCategories,
  createSlug,
  lineCtaText,
  splitBlogTags,
} from "@/lib/blog";
import type {
  BlogArticleType,
  BlogConcern,
  BlogGenerateRequest,
  BlogGenerateResponse,
  BlogLength,
  BlogPostInput,
  BlogTargetAge,
} from "@/types/blog";
import type { SnsPost } from "@/types/snsPost";
import type { Trend } from "@/types/trend";

type BlogGeneratorProps = {
  snsPosts: SnsPost[];
  trends: Trend[];
  onGenerated: (draft: BlogPostInput) => void;
};

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const targetAges: BlogTargetAge[] = ["20代", "30代", "40代", "50代", "60代"];
const concerns: BlogConcern[] = [
  "くせ毛",
  "パサつき",
  "広がり",
  "白髪",
  "ダメージ",
  "まとまらない",
];
const articleTypes: BlogArticleType[] = [
  "SEO記事",
  "お悩み解決記事",
  "Before/After紹介記事",
  "メニュー紹介記事",
  "季節提案記事",
  "Instagram投稿からブログ化",
];
const lengths: BlogLength[] = ["800文字", "1200文字", "2000文字", "3000文字"];

export function BlogGenerator({
  snsPosts,
  trends,
  onGenerated,
}: BlogGeneratorProps) {
  const [form, setForm] = useState<BlogGenerateRequest>({
    articleType: "SEO記事",
    concern: "パサつき",
    length: "1200文字",
    mainKeyword: "松江市 髪質改善",
    referenceMemos: [],
    referenceTitles: [],
    targetAge: "40代",
  });
  const [selectedTrendIds, setSelectedTrendIds] = useState<string[]>([]);
  const [selectedSnsPostIds, setSelectedSnsPostIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState(
    "条件を選ぶと、ef.mayke`s向けのブログ下書きを生成できます。",
  );
  const [generated, setGenerated] = useState<BlogGenerateResponse | null>(null);

  const referenceTrends = useMemo(
    () => trends.filter((trend) => selectedTrendIds.includes(trend.id)),
    [selectedTrendIds, trends],
  );
  const referenceSnsPosts = useMemo(
    () => snsPosts.filter((post) => selectedSnsPostIds.includes(post.id)),
    [selectedSnsPostIds, snsPosts],
  );

  function toggleTrendId(id: string) {
    setSelectedTrendIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id].slice(-5),
    );
  }

  function toggleSnsPostId(id: string) {
    setSelectedSnsPostIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id].slice(-5),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.mainKeyword.trim()) {
      setStatusTone("warning");
      setMessage("メインキーワードを入力してください。");
      return;
    }

    setIsGenerating(true);
    setStatusTone("info");
    setMessage("AIでブログ下書きを生成しています。");

    try {
      const response = await fetch("/api/blog/generate", {
        body: JSON.stringify({
          ...form,
          referenceMemos: [
            ...referenceTrends.map((trend) => trend.memo || trend.summary),
            ...referenceSnsPosts.map((post) => post.aiSummary || post.memo),
          ],
          referenceTitles: [
            ...referenceTrends.map((trend) => trend.title),
            ...referenceSnsPosts.map((post) => post.title),
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate blog article.");
      }

      const data = (await response.json()) as BlogGenerateResponse;

      setGenerated(data);
      setStatusTone(data.providerLabel === "モック記事" ? "warning" : "success");
      setMessage(`${data.providerLabel}でブログ下書きを生成しました。`);
    } catch {
      setStatusTone("error");
      setMessage("ブログ生成に失敗しました。AI設定を確認してください。");
    } finally {
      setIsGenerating(false);
    }
  }

  function applyGeneratedToEditor() {
    if (!generated) {
      return;
    }

    onGenerated({
      category: blogCategories.includes(generated.category)
        ? generated.category
        : "髪質改善",
      content: generated.content,
      excerpt: generated.excerpt,
      metaDescription: generated.metaDescription,
      relatedSnsPostIds: selectedSnsPostIds,
      relatedTrendIds: selectedTrendIds,
      relatedYoutubeUrls: referenceTrends
        .filter((trend) => trend.url.includes("youtube"))
        .map((trend) => trend.url),
      slug: createSlug(generated.slug),
      status: "draft",
      tags: generated.tags.length
        ? generated.tags
        : splitBlogTags(generated.targetKeyword),
      targetKeyword: generated.targetKeyword,
      title: generated.title,
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
      <form
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              AIブログ生成
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              SEO記事、メニュー紹介、Instagram投稿のブログ化に使えます。
            </p>
          </div>
          <Badge tone="success">ef.mayke`s向け</Badge>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            メインキーワード
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  mainKeyword: event.target.value,
                }))
              }
              placeholder="例: 松江市 髪質改善"
              required
              value={form.mainKeyword}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="ターゲット"
              options={targetAges}
              value={form.targetAge}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  targetAge: value as BlogTargetAge,
                }))
              }
            />
            <SelectField
              label="悩み"
              options={concerns}
              value={form.concern}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  concern: value as BlogConcern,
                }))
              }
            />
            <SelectField
              label="記事タイプ"
              options={articleTypes}
              value={form.articleType}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  articleType: value as BlogArticleType,
                }))
              }
            />
            <SelectField
              label="文字数目安"
              options={lengths}
              value={form.length}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  length: value as BlogLength,
                }))
              }
            />
          </div>

          <ReferencePicker
            items={trends.slice(0, 8).map((trend) => ({
              id: trend.id,
              label: trend.title,
              note: trend.category,
            }))}
            selectedIds={selectedTrendIds}
            title="参考トレンド"
            onToggle={toggleTrendId}
          />
          <ReferencePicker
            items={snsPosts.slice(0, 6).map((post) => ({
              id: post.id,
              label: post.title,
              note: post.snsType,
            }))}
            selectedIds={selectedSnsPostIds}
            title="参考SNS投稿"
            onToggle={toggleSnsPostId}
          />
        </div>

        <button
          className="mt-5 min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled={isGenerating || !form.mainKeyword.trim()}
          type="submit"
        >
          {isGenerating ? "生成中" : "ブログ下書きを生成"}
        </button>
      </form>

      <div className="grid content-start gap-5">
        <StatusMessage isLoading={isGenerating} tone={statusTone}>
          {message}
        </StatusMessage>

        {generated ? (
          <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">生成結果</Badge>
              <Badge tone="info">{generated.category}</Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-7 text-stone-950">
              {generated.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {generated.excerpt}
            </p>

            <div className="mt-4 grid gap-3">
              <GeneratedBox label="Instagram投稿文" value={generated.instagramCaption} />
              <GeneratedBox
                label="Before/After画像用キャプション"
                value={generated.beforeAfterCaption}
              />
              <GeneratedBox label="LINE予約CTA" value={generated.lineCta || lineCtaText} />
            </div>

            <button
              className="mt-5 min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
              onClick={applyGeneratedToEditor}
              type="button"
            >
              下書きとして編集する
            </button>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      {label}
      <select
        className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ReferencePicker({
  items,
  selectedIds,
  title,
  onToggle,
}: {
  items: Array<{ id: string; label: string; note: string }>;
  selectedIds: string[];
  title: string;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="rounded-md bg-stone-50 p-3">
      <p className="text-xs font-semibold text-stone-500">{title}</p>
      {items.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {items.map((item) => (
            <label
              className="flex gap-2 rounded-md bg-white p-2 text-sm text-stone-700 ring-1 ring-stone-100"
              key={item.id}
            >
              <input
                checked={selectedIds.includes(item.id)}
                className="mt-1"
                onChange={() => onToggle(item.id)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold">{item.label}</span>
                <span className="block text-xs text-stone-500">{item.note}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-500">参考データはまだありません。</p>
      )}
    </section>
  );
}

function GeneratedBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
        {value}
      </p>
    </div>
  );
}
