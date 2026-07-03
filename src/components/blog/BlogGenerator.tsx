"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  blogCategories,
  createSlug,
  lineCtaText,
  splitBlogTags,
  stringListToText,
  textToStringList,
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
  initialRequest?: Partial<BlogGenerateRequest>;
  initialSeoKeywordId?: string;
  initialTrendId?: string;
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

function createInitialForm(initialRequest?: Partial<BlogGenerateRequest>) {
  return {
    articleSummary: "",
    articleType: "SEO記事",
    concern: "パサつき",
    length: "1200文字",
    mainKeyword: "松江 髪質改善",
    preferredTitle: "",
    readerProblems: [],
    referenceMemos: [],
    referenceTitles: [],
    searchIntent: "",
    secondaryKeywords: ["松江 縮毛矯正", "40代 髪質改善"],
    targetAge: "40代",
    targetAudience: "40代以降の、うねり・広がりに悩む大人女性",
    ...initialRequest,
  } as BlogGenerateRequest;
}

export function BlogGenerator({
  initialRequest,
  initialSeoKeywordId,
  initialTrendId,
  snsPosts,
  trends,
  onGenerated,
}: BlogGeneratorProps) {
  const [form, setForm] = useState<BlogGenerateRequest>(() =>
    createInitialForm({
      ...initialRequest,
      sourceSeoKeywordId:
        initialSeoKeywordId || initialRequest?.sourceSeoKeywordId || "",
      sourceSearchConsoleImportId:
        initialRequest?.sourceSearchConsoleImportId || "",
      sourceTrendId: initialTrendId || initialRequest?.sourceTrendId || "",
    }),
  );
  const [selectedTrendIds, setSelectedTrendIds] = useState<string[]>(() =>
    initialTrendId ? [initialTrendId] : [],
  );
  const [selectedSnsPostIds, setSelectedSnsPostIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState(
    initialRequest?.mainKeyword
      ? "引き継いだSEO情報を確認して、記事全体を生成してください。"
      : "条件を選ぶと、ef.mayke`s向けのSEOブログ下書きを生成できます。",
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
      setMessage("対策キーワードを入力してください。");
      return;
    }

    setIsGenerating(true);
    setStatusTone("info");
    setMessage("GeminiでSEOブログ下書きを生成しています。");

    try {
      const response = await fetch("/api/blog/generate", {
        body: JSON.stringify({
          ...form,
          referenceMemos: [
            ...(form.referenceMemos ?? []),
            ...referenceTrends.map((trend) => trend.memo || trend.summary),
            ...referenceSnsPosts.map((post) => post.aiSummary || post.memo),
          ],
          referenceTitles: [
            ...(form.referenceTitles ?? []),
            ...referenceTrends.map((trend) => trend.title),
            ...referenceSnsPosts.map((post) => post.title),
          ],
          sourceTrendId: selectedTrendIds[0] || form.sourceTrendId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as BlogGenerateResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "ブログ記事を生成できませんでした。");
      }

      setGenerated(data);
      setStatusTone(data.generationMode === "mock" ? "warning" : "success");
      setMessage(data.generationNotice || `${data.providerLabel}で生成しました。`);
    } catch (error) {
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "ブログ生成に失敗しました。時間をおいてもう一度お試しください。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function applyGeneratedToEditor() {
    if (!generated) return;

    onGenerated({
      aiModel: generated.aiModel,
      articleSummary: generated.articleSummary,
      beforeAfterCaptions: generated.beforeAfterCaptions,
      bodyHtml: generated.bodyHtml,
      category: blogCategories.includes(generated.category)
        ? generated.category
        : "髪質改善",
      content: generated.content,
      ctaText: generated.ctaText,
      ctaUrl: generated.ctaUrl,
      excerpt: generated.excerpt,
      faq: generated.faq,
      generatedBy: generated.generatedBy,
      headings: generated.headings,
      internalLinkSuggestions: generated.internalLinkSuggestions,
      metaDescription: generated.metaDescription,
      metaTitle: generated.metaTitle,
      readerProblems: generated.readerProblems,
      relatedSnsPostIds: selectedSnsPostIds,
      relatedTrendIds: selectedTrendIds.length
        ? selectedTrendIds
        : generated.relatedTrendIds,
      relatedYoutubeUrls: referenceTrends
        .filter((trend) => trend.url.includes("youtube"))
        .map((trend) => trend.url),
      searchIntent: generated.searchIntent,
      secondaryKeywords: generated.secondaryKeywords,
      slug: createSlug(generated.slug),
      sourceSeoKeywordId: generated.sourceSeoKeywordId,
      sourceSearchConsoleImportId: generated.sourceSearchConsoleImportId,
      status: "draft",
      tags: generated.tags.length
        ? generated.tags
        : splitBlogTags(generated.targetKeyword),
      targetAudience: generated.targetAudience,
      targetKeyword: generated.targetKeyword,
      title: generated.title,
      wordpressHtml: generated.wordpressHtml,
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1fr]">
      <form
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Gemini SEOブログ生成</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              SEOキーワードやトレンドを、お客様に役立つ記事へ整えます。
            </p>
          </div>
          <Badge tone="success">ef.mayke`s向け</Badge>
        </div>

        <div className="mt-5 grid gap-4">
          <TextInput
            label="対策キーワード"
            placeholder="例: 松江 髪質改善"
            required
            value={form.mainKeyword}
            onChange={(value) => setForm((current) => ({ ...current, mainKeyword: value }))}
          />
          <TextArea
            label="補助キーワード（1行に1つ）"
            value={stringListToText(form.secondaryKeywords)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                secondaryKeywords: textToStringList(value).slice(0, 10),
              }))
            }
          />
          <TextArea
            label="検索意図"
            value={form.searchIntent ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, searchIntent: value }))}
          />
          <TextInput
            label="想定読者"
            value={form.targetAudience ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, targetAudience: value }))}
          />
          <TextArea
            label="読者の悩み（1行に1つ）"
            value={stringListToText(form.readerProblems)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                readerProblems: textToStringList(value).slice(0, 8),
              }))
            }
          />
          <TextInput
            label="記事タイトル（任意）"
            value={form.preferredTitle ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, preferredTitle: value }))}
          />
          <TextArea
            label="記事概要・引き継ぎメモ"
            value={form.articleSummary ?? ""}
            onChange={(value) => setForm((current) => ({ ...current, articleSummary: value }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="ターゲット年代"
              options={targetAges}
              value={form.targetAge}
              onChange={(value) =>
                setForm((current) => ({ ...current, targetAge: value as BlogTargetAge }))
              }
            />
            <SelectField
              label="主な悩み"
              options={concerns}
              value={form.concern}
              onChange={(value) =>
                setForm((current) => ({ ...current, concern: value as BlogConcern }))
              }
            />
            <SelectField
              label="記事タイプ"
              options={articleTypes}
              value={form.articleType}
              onChange={(value) =>
                setForm((current) => ({ ...current, articleType: value as BlogArticleType }))
              }
            />
            <SelectField
              label="文字数目安"
              options={lengths}
              value={form.length}
              onChange={(value) =>
                setForm((current) => ({ ...current, length: value as BlogLength }))
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
          className="mt-5 min-h-11 w-full rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto"
          disabled={isGenerating || !form.mainKeyword.trim()}
          type="submit"
        >
          {isGenerating ? "生成中" : "記事全体を生成"}
        </button>
      </form>

      <div className="grid content-start gap-5">
        <StatusMessage isLoading={isGenerating} tone={statusTone}>
          {message}
        </StatusMessage>

        {generated ? (
          <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={generated.generationMode === "mock" ? "warning" : "success"}>
                {generated.providerLabel}
              </Badge>
              <Badge tone="info">{generated.category}</Badge>
              {generated.aiModel ? <Badge tone="neutral">{generated.aiModel}</Badge> : null}
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-7 text-stone-950">
              {generated.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {generated.articleSummary || generated.excerpt}
            </p>

            <div className="mt-4 grid gap-3">
              <GeneratedBox label="検索意図" value={generated.searchIntent} />
              <GeneratedBox label="想定読者" value={generated.targetAudience} />
              <GeneratedBox label="トレンド要約" value={generated.trendSummary} />
              <GeneratedBox label="ブログ化する価値" value={generated.blogValue} />
              <GeneratedBox label="ef.mayke`sとの関連性" value={generated.salonRelevance} />
              <GeneratedBox label="Before／Afterキャプション" value={generated.beforeAfterCaption} />
              <GeneratedBox label="LINE予約CTA" value={generated.lineCta || lineCtaText} />
            </div>

            <button
              className="mt-5 min-h-11 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 sm:w-auto"
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

function TextInput({
  label,
  onChange,
  placeholder,
  required = false,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      {label}
      <input
        className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
        maxLength={600}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      {label}
      <textarea
        className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
        maxLength={2000}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
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
              <span className="min-w-0">
                <span className="block break-words font-semibold">{item.label}</span>
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
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">
        {value || "未生成"}
      </p>
    </div>
  );
}
