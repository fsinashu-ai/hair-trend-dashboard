"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { XSocialCrawler } from "@/components/social/XSocialCrawler";
import { snsProviderConfigs } from "@/config/snsProviders";
import {
  initialInstagramSources,
  recommendedInstagramSourceCount,
  socialSourceCategories,
} from "@/data/initialSocialSources";
import {
  readLocalBackupBlogPosts,
  readLocalBackupTrends,
  saveLocalBackupBlogPosts,
  saveLocalBackupTrends,
} from "@/lib/backup/localStorage";
import { createLocalBlogPost } from "@/lib/blog";
import {
  createLocalSocialPost,
  createLocalSocialSource,
  readLocalSocialPosts,
  readLocalSocialSources,
  saveLocalSocialPosts,
  saveLocalSocialSources,
} from "@/lib/social/localStorage";
import {
  detectSocialType,
  getTitleSimilarity,
  normalizeSocialHandle,
  normalizeSocialUrl,
} from "@/lib/social/url";
import {
  createBlogDraftFromSocialPost,
  createTrendFromSocialPost,
} from "@/lib/social/workflow";
import { snsTrendCategories, splitTags, tagsToInputValue } from "@/lib/sns";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createBlogPostInSupabase } from "@/lib/supabase/blogPosts";
import {
  createSocialPostInSupabase,
  fetchSocialPostsFromSupabase,
} from "@/lib/supabase/socialPosts";
import {
  createSocialSourceInSupabase,
  fetchSocialSourcesFromSupabase,
  updateSocialSourceInSupabase,
} from "@/lib/supabase/socialSources";
import { createTrendLinkInSupabase } from "@/lib/supabase/trends";
import type { SnsType } from "@/types/snsPost";
import type {
  NewSocialPost,
  NewSocialSource,
  SocialClassification,
  SocialMetadata,
  SocialPost,
  SocialPriority,
  SocialSource,
  SocialSourceMode,
} from "@/types/social";
import type { TrendCategory } from "@/types/trend";

type ViewMode = "import" | "xCrawler" | "sources";
type StorageMode = "supabase" | "local";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type ImportForm = {
  sourceId: string;
  url: string;
  snsType: SnsType;
  title: string;
  memo: string;
  category: TrendCategory;
  tagsText: string;
};

type SourceForm = NewSocialSource;

type MetadataApiResult =
  | {
      ok: true;
      url: string;
      metadata: SocialMetadata;
    }
  | {
      ok: false;
      url: string;
      code: string;
      error: string;
    };

const supabaseEnabled = isSupabaseConfigured();

const sourceModeLabels: Record<SocialSourceMode, string> = {
  official_api: "公式API",
  manual_url: "手動URL",
  metadata_only: "メタデータのみ",
};

const priorityLabels: Record<SocialPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function createEmptyImportForm(): ImportForm {
  return {
    category: "SNS投稿",
    memo: "",
    snsType: "Instagram",
    sourceId: "",
    tagsText: "",
    title: "",
    url: "",
  };
}

function createEmptySourceForm(): SourceForm {
  return {
    accountName: "",
    category: "その他",
    handle: "",
    isActive: true,
    memo: "",
    priority: "medium",
    profileUrl: "",
    snsType: "Instagram",
    sourceMode: "manual_url",
  };
}

function formatDateTime(value?: string) {
  if (!value) {
    return "未確認";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function getRelevanceTone(relevance: SocialPost["relevance"]) {
  if (relevance === "高") {
    return "success" as const;
  }

  if (relevance === "低") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function SocialSourceManager() {
  const [view, setView] = useState<ViewMode>("import");
  const [storageMode, setStorageMode] = useState<StorageMode>(
    supabaseEnabled ? "supabase" : "local",
  );
  const [sources, setSources] = useState<SocialSource[]>(() =>
    supabaseEnabled ? [] : readLocalSocialSources(),
  );
  const [posts, setPosts] = useState<SocialPost[]>(() =>
    supabaseEnabled ? [] : readLocalSocialPosts(),
  );
  const [importForm, setImportForm] = useState<ImportForm>(
    createEmptyImportForm,
  );
  const [sourceForm, setSourceForm] = useState<SourceForm>(
    createEmptySourceForm,
  );
  const [metadata, setMetadata] = useState<SocialMetadata | null>(null);
  const [classification, setClassification] =
    useState<SocialClassification | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<SocialPost[]>(
    [],
  );
  const [allowSimilarDuplicate, setAllowSimilarDuplicate] = useState(false);
  const [visibleIdeaId, setVisibleIdeaId] = useState<string | null>(null);
  const [sendingTrendId, setSendingTrendId] = useState<string | null>(null);
  const [sendingBlogId, setSendingBlogId] = useState<string | null>(null);
  const [bloggedPostIds, setBloggedPostIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "SNS取得元と取り込み済みデータを読み込んでいます。"
      : "Supabase未設定のため、この端末だけに保存します。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        const [sourceData, postData] = await Promise.all([
          fetchSocialSourcesFromSupabase(),
          fetchSocialPostsFromSupabase(),
        ]);

        if (!isMounted) {
          return;
        }

        setSources(sourceData ?? []);
        setPosts(postData ?? []);
        setStatusTone("success");
        setMessage("SupabaseのSNS取得情報を表示しています。");
      } catch {
        if (!isMounted) {
          return;
        }

        setStorageMode("local");
        setSources(readLocalSocialSources());
        setPosts(readLocalSocialPosts());
        setStatusTone("warning");
        setMessage(
          "social_sources / social_postsテーブルを確認できないため、この端末の保存へ切り替えました。",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (storageMode === "local") {
      saveLocalSocialSources(sources);
    }
  }, [sources, storageMode]);

  useEffect(() => {
    if (storageMode === "local") {
      saveLocalSocialPosts(posts);
    }
  }, [posts, storageMode]);

  const activeSources = useMemo(
    () => sources.filter((source) => source.isActive),
    [sources],
  );

  function updateImportUrl(url: string) {
    setImportForm((current) => ({
      ...current,
      snsType: detectSocialType(url),
      url,
    }));
    setMetadata(null);
    setClassification(null);
    setDuplicateCandidates([]);
    setAllowSimilarDuplicate(false);
  }

  function selectSource(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);

    setImportForm((current) => ({
      ...current,
      snsType: source?.snsType ?? current.snsType,
      sourceId,
    }));
  }

  async function recordSourceCheck(sourceId: string, errorMessage: string) {
    if (!sourceId) {
      return;
    }

    const lastCheckedAt = new Date().toISOString();

    try {
      const updated =
        storageMode === "supabase"
          ? await updateSocialSourceInSupabase(sourceId, {
              lastCheckedAt,
              lastError: errorMessage,
            })
          : null;

      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? updated ?? {
                ...source,
                lastCheckedAt,
                lastError: errorMessage,
              }
            : source,
        ),
      );
    } catch {
      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? { ...source, lastCheckedAt, lastError: errorMessage }
            : source,
        ),
      );
    }
  }

  async function requestClassification(
    resolvedMetadata: SocialMetadata | null,
  ) {
    const response = await fetch("/api/social/classify", {
      body: JSON.stringify({
        category: importForm.category,
        description:
          resolvedMetadata?.ogDescription ||
          resolvedMetadata?.description ||
          importForm.memo,
        memo: importForm.memo,
        snsType: resolvedMetadata?.snsType ?? importForm.snsType,
        tags: splitTags(importForm.tagsText),
        title:
          importForm.title ||
          resolvedMetadata?.ogTitle ||
          resolvedMetadata?.title,
        url: resolvedMetadata?.canonicalUrl || importForm.url,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("AI分類に失敗しました。");
    }

    return (await response.json()) as SocialClassification;
  }

  function findDuplicates(canonicalUrl: string, title: string) {
    const exact = posts.find(
      (post) =>
        post.canonicalUrl === canonicalUrl ||
        post.url === canonicalUrl ||
        post.url === importForm.url,
    );
    const similar = posts.filter(
      (post) =>
        post.id !== exact?.id && getTitleSimilarity(post.title, title) >= 0.72,
    );

    return { exact, similar };
  }

  async function saveImportedPost(
    resolvedMetadata: SocialMetadata | null,
    resolvedClassification: SocialClassification,
  ) {
    const normalizedUrl = normalizeSocialUrl(importForm.url);
    const canonicalUrl = normalizeSocialUrl(
      resolvedMetadata?.canonicalUrl || normalizedUrl,
    );
    const title =
      importForm.title.trim() ||
      resolvedMetadata?.ogTitle ||
      resolvedMetadata?.title ||
      resolvedClassification.trendName;
    const { exact, similar } = findDuplicates(canonicalUrl, title);

    if (exact) {
      setStatusTone("warning");
      setMessage("同じcanonical URLまたはURLの投稿がすでに保存されています。");
      return false;
    }

    setDuplicateCandidates(similar);

    if (similar.length > 0 && !allowSimilarDuplicate) {
      setStatusTone("warning");
      setMessage(
        "似たタイトルの保存済み投稿があります。内容を確認し、必要な場合だけ「重複候補でも保存」を選んでください。",
      );
      return false;
    }

    const newPost: NewSocialPost = {
      aiSummary: resolvedClassification.summary,
      blogIdea: resolvedClassification.blogIdea,
      canonicalUrl,
      category: resolvedClassification.category,
      counselingIdea: resolvedClassification.counselingIdea,
      description:
        resolvedMetadata?.ogDescription ||
        resolvedMetadata?.description ||
        importForm.memo,
      importedAt: new Date().toISOString(),
      instagramPostIdea: resolvedClassification.instagramPostIdea,
      isFavorite: false,
      ogImageUrl: resolvedMetadata?.ogImageUrl ?? "",
      publishedAt: resolvedMetadata?.publishedAt,
      relevance: resolvedClassification.relevance,
      reviewStatus: "未確認",
      snsType: resolvedMetadata?.snsType ?? importForm.snsType,
      sourceId: importForm.sourceId || undefined,
      tags: resolvedClassification.tags,
      title,
      url: normalizedUrl,
    };
    const savedPost =
      storageMode === "supabase"
        ? await createSocialPostInSupabase(newPost)
        : createLocalSocialPost(newPost);

    if (!savedPost) {
      throw new Error("SNS情報を保存できませんでした。");
    }

    setPosts((current) => [savedPost, ...current]);
    setImportForm(createEmptyImportForm());
    setMetadata(null);
    setClassification(null);
    setDuplicateCandidates([]);
    setAllowSimilarDuplicate(false);
    setStatusTone(storageMode === "supabase" ? "success" : "warning");
    setMessage(
      storageMode === "supabase"
        ? "公開URLの必要最小限の情報をSupabaseに保存しました。"
        : "公開URLの必要最小限の情報をこの端末に保存しました。",
    );

    return true;
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!importForm.url.trim()) {
      setStatusTone("warning");
      setMessage("公開投稿URLを入力してください。");
      return;
    }

    setIsImporting(true);
    setStatusTone("info");
    setMessage(
      "robots.txtと公開範囲を確認し、タイトル・description・OGPだけを取得しています。",
    );

    try {
      const response = await fetch("/api/social/metadata", {
        body: JSON.stringify({ url: importForm.url }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "メタデータを取得できませんでした。");
      }

      const data = (await response.json()) as {
        results: MetadataApiResult[];
      };
      const result = data.results[0];

      if (!result?.ok) {
        const errorMessage =
          result?.error ??
          "取得できませんでした。タイトルとメモを手動入力してください。";
        await recordSourceCheck(importForm.sourceId, errorMessage);
        setStatusTone("warning");
        setMessage(`${errorMessage} 取得は禁止し、手動入力へ戻しました。`);
        return;
      }

      setMetadata(result.metadata);
      setImportForm((current) => ({
        ...current,
        snsType: result.metadata.snsType,
        title:
          current.title ||
          result.metadata.ogTitle ||
          result.metadata.title,
      }));
      const aiResult = await requestClassification(result.metadata);
      setClassification(aiResult);
      setImportForm((current) => ({
        ...current,
        category: aiResult.category,
        tagsText:
          current.tagsText || tagsToInputValue(aiResult.tags),
      }));
      await recordSourceCheck(importForm.sourceId, "");
      await saveImportedPost(result.metadata, aiResult);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "SNS情報の取り込みに失敗しました。";
      await recordSourceCheck(importForm.sourceId, errorMessage);
      setStatusTone("error");
      setMessage(
        `${errorMessage} アプリ全体は停止していません。手動入力を利用できます。`,
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleManualSave() {
    if (!importForm.url.trim() || !importForm.title.trim()) {
      setStatusTone("warning");
      setMessage("手動保存にはURLとタイトルが必要です。");
      return;
    }

    setIsImporting(true);
    setStatusTone("info");
    setMessage("入力内容だけをAIで分類しています。ページ本文は取得しません。");

    try {
      const aiResult = await requestClassification(null);
      setClassification(aiResult);
      await saveImportedPost(null, aiResult);
    } catch (error) {
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "手動入力したSNS情報を保存できませんでした。",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleAddSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourceForm.accountName.trim() || !sourceForm.profileUrl.trim()) {
      setStatusTone("warning");
      setMessage("アカウント名とプロフィールURLを入力してください。");
      return;
    }

    setIsSavingSource(true);
    setStatusTone("info");
    setMessage("SNS取得元を保存しています。");

    try {
      const input: NewSocialSource = {
        ...sourceForm,
        accountName: sourceForm.accountName.trim(),
        handle: normalizeSocialHandle(sourceForm.handle),
        memo: sourceForm.memo.trim(),
        profileUrl: normalizeSocialUrl(sourceForm.profileUrl),
      };
      const duplicateHandle = input.handle
        ? sources.some(
            (source) =>
              source.handle.toLowerCase() === input.handle.toLowerCase(),
          )
        : false;
      const duplicateUrl = sources.some(
        (source) =>
          normalizeSocialUrl(source.profileUrl) === input.profileUrl,
      );

      if (duplicateHandle || duplicateUrl) {
        throw new Error(
          duplicateHandle
            ? "同じハンドルの取得元がすでに登録されています。"
            : "同じプロフィールURLの取得元がすでに登録されています。",
        );
      }
      const savedSource =
        storageMode === "supabase"
          ? await createSocialSourceInSupabase(input)
          : createLocalSocialSource(input);

      if (!savedSource) {
        throw new Error("SNS取得元を保存できませんでした。");
      }

      setSources((current) => [...current, savedSource]);
      setSourceForm(createEmptySourceForm());
      setStatusTone(storageMode === "supabase" ? "success" : "warning");
      setMessage("SNS取得元を追加しました。");
    } catch (error) {
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "SNS取得元を保存できませんでした。",
      );
    } finally {
      setIsSavingSource(false);
    }
  }

  async function toggleSource(source: SocialSource) {
    const isActive = !source.isActive;

    try {
      const updated =
        storageMode === "supabase"
          ? await updateSocialSourceInSupabase(source.id, { isActive })
          : null;

      setSources((current) =>
        current.map((item) =>
          item.id === source.id ? updated ?? { ...item, isActive } : item,
        ),
      );
      setStatusTone("success");
      setMessage(`${source.accountName}を${isActive ? "有効" : "無効"}にしました。`);
    } catch {
      setStatusTone("error");
      setMessage("有効・無効の変更に失敗しました。");
    }
  }

  async function sendToTrend(post: SocialPost) {
    if (post.reviewStatus !== "採用") {
      setStatusTone("warning");
      setMessage(
        "トレンド化する前に、SNS受信箱でこの投稿を「採用」にしてください。",
      );
      return;
    }

    setSendingTrendId(post.id);
    setStatusTone("info");
    setMessage("SNS情報からトレンド候補を作成しています。");

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
      setSendingTrendId(null);
    }
  }

  async function sendToBlog(post: SocialPost) {
    setSendingBlogId(post.id);
    setStatusTone("info");
    setMessage("SNS情報からブログ下書きを作成しています。");

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

      setBloggedPostIds((current) =>
        current.includes(post.id) ? current : [...current, post.id],
      );
      setStatusTone("success");
      setMessage("ブログ管理へ下書き保存しました。");
    } catch {
      setStatusTone("error");
      setMessage(
        "ブログ化できませんでした。Supabase設定とblog_postsテーブルを確認してください。",
      );
    } finally {
      setSendingBlogId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          className={`min-h-10 shrink-0 rounded-md border px-4 text-sm font-semibold ${
            view === "import"
              ? "border-teal-700 bg-teal-50 text-teal-800"
              : "border-stone-300 bg-white text-stone-700"
          }`}
          onClick={() => setView("import")}
          type="button"
        >
          URLから取り込む
        </button>
        <button
          className={`min-h-10 shrink-0 rounded-md border px-4 text-sm font-semibold ${
            view === "xCrawler"
              ? "border-teal-700 bg-teal-50 text-teal-800"
              : "border-stone-300 bg-white text-stone-700"
          }`}
          onClick={() => setView("xCrawler")}
          type="button"
        >
          X公式API巡回
        </button>
        <button
          className={`min-h-10 shrink-0 rounded-md border px-4 text-sm font-semibold ${
            view === "sources"
              ? "border-teal-700 bg-teal-50 text-teal-800"
              : "border-stone-300 bg-white text-stone-700"
          }`}
          onClick={() => setView("sources")}
          type="button"
        >
          SNS取得元管理
        </button>
      </div>

      <StatusMessage
        isLoading={isLoading || isImporting || isSavingSource}
        tone={statusTone}
      >
        {message}
      </StatusMessage>

      {view === "import" ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  公開投稿URLを取り込む
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  本文や画像は保存せず、タイトル・description・OGP・canonical
                  URLだけを確認します。
                </p>
              </div>
              <Badge tone={storageMode === "supabase" ? "success" : "warning"}>
                {storageMode === "supabase" ? "Supabase保存" : "端末保存"}
              </Badge>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleImport}>
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                投稿URL
                <input
                  className="min-h-11 rounded-md border border-stone-300 px-3 outline-none focus:border-teal-600"
                  onChange={(event) => updateImportUrl(event.target.value)}
                  placeholder="https://www.instagram.com/..."
                  required
                  type="url"
                  value={importForm.url}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  SNS種別
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) =>
                      setImportForm((current) => ({
                        ...current,
                        snsType: event.target.value as SnsType,
                      }))
                    }
                    value={importForm.snsType}
                  >
                    {snsProviderConfigs.map((provider) => (
                      <option key={provider.type} value={provider.type}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  取得元
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) => selectSource(event.target.value)}
                    value={importForm.sourceId}
                  >
                    <option value="">指定なし</option>
                    {activeSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.accountName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                タイトル
                <input
                  className="min-h-11 rounded-md border border-stone-300 px-3 outline-none focus:border-teal-600"
                  onChange={(event) =>
                    setImportForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="取得できない場合は手動入力します"
                  value={importForm.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  カテゴリ
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) =>
                      setImportForm((current) => ({
                        ...current,
                        category: event.target.value as TrendCategory,
                      }))
                    }
                    value={importForm.category}
                  >
                    {snsTrendCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  タグ
                  <input
                    className="min-h-11 rounded-md border border-stone-300 px-3 outline-none focus:border-teal-600"
                    onChange={(event) =>
                      setImportForm((current) => ({
                        ...current,
                        tagsText: event.target.value,
                      }))
                    }
                    placeholder="髪質改善、艶髪、白髪"
                    value={importForm.tagsText}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                メモ
                <textarea
                  className="min-h-24 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-600"
                  onChange={(event) =>
                    setImportForm((current) => ({
                      ...current,
                      memo: event.target.value,
                    }))
                  }
                  placeholder="どの提案や投稿に使いたいかを入力します"
                  value={importForm.memo}
                />
              </label>

              {duplicateCandidates.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    似たタイトルの重複候補
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm text-amber-800">
                    {duplicateCandidates.slice(0, 3).map((post) => (
                      <li key={post.id}>・{post.title}</li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
                    <input
                      checked={allowSimilarDuplicate}
                      className="mt-1 size-4"
                      onChange={(event) =>
                        setAllowSimilarDuplicate(event.target.checked)
                      }
                      type="checkbox"
                    />
                    内容を確認したうえで重複候補でも保存する
                  </label>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-stone-300"
                  disabled={isImporting || !importForm.url.trim()}
                  type="submit"
                >
                  {isImporting ? "確認・分類中" : "URLから取り込む"}
                </button>
                <button
                  className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:text-stone-400"
                  disabled={
                    isImporting ||
                    !importForm.url.trim() ||
                    !importForm.title.trim()
                  }
                  onClick={handleManualSave}
                  type="button"
                >
                  手入力内容だけで保存
                </button>
              </div>
            </form>

            {metadata ? (
              <div className="mt-5 border-t border-stone-200 pt-5">
                <h3 className="text-sm font-semibold text-stone-950">
                  取得したメタデータ
                </h3>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div>
                    <dt className="text-stone-500">canonical URL</dt>
                    <dd className="mt-1 break-all text-stone-800">
                      {metadata.canonicalUrl}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">description</dt>
                    <dd className="mt-1 leading-6 text-stone-800">
                      {metadata.ogDescription ||
                        metadata.description ||
                        "取得できませんでした"}
                    </dd>
                  </div>
                  {metadata.ogImageUrl ? (
                    <div>
                      <dt className="text-stone-500">参考画像URL</dt>
                      <dd className="mt-1">
                        <a
                          className="break-all text-teal-700 underline"
                          href={metadata.ogImageUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          元ページのOG画像を確認
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {classification ? (
              <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">{classification.category}</Badge>
                  <Badge tone={getRelevanceTone(classification.relevance)}>
                    関連度 {classification.relevance}
                  </Badge>
                </div>
                <h3 className="mt-3 font-semibold text-stone-950">
                  {classification.trendName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {classification.summary}
                </p>
              </div>
            ) : null}
          </section>

          <section className="grid content-start gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">
                取り込み済みSNS情報
              </h2>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{posts.length}件</Badge>
                <Link
                  className="inline-flex min-h-10 items-center rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                  href="/social-inbox"
                >
                  受信箱で確認
                </Link>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <div className="h-5 w-36 animate-pulse rounded bg-stone-100" />
                <div className="mt-4 h-4 w-full animate-pulse rounded bg-stone-100" />
              </div>
            ) : posts.length === 0 ? (
              <EmptyState
                description="公開投稿URLを1件ずつ確認して取り込みます。取得できない場合は手動入力へ戻ります。"
                title="取り込み済みデータはありません"
              />
            ) : (
              posts.map((post) => (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
                  key={post.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        tone={
                          post.reviewStatus === "採用"
                            ? "success"
                            : post.reviewStatus === "保留"
                              ? "warning"
                              : post.reviewStatus === "不要"
                                ? "danger"
                                : "info"
                        }
                      >
                        {post.reviewStatus}
                      </Badge>
                      <Badge tone="info">{post.snsType}</Badge>
                      <Badge tone="neutral">{post.category}</Badge>
                      <Badge tone={getRelevanceTone(post.relevance)}>
                        関連度 {post.relevance}
                      </Badge>
                    </div>
                    <span className="text-xs text-stone-500">
                      {formatDateTime(post.importedAt)}
                    </span>
                  </div>

                  <h3 className="mt-3 break-words text-lg font-semibold leading-7 text-stone-950">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {post.aiSummary || post.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>

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

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      className="min-h-10 rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:text-stone-400"
                      disabled={
                        sendingTrendId === post.id ||
                        post.reviewStatus !== "採用"
                      }
                      onClick={() => sendToTrend(post)}
                      type="button"
                    >
                      {sendingTrendId === post.id ? "追加中" : "トレンド化"}
                    </button>
                    <button
                      className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:bg-stone-50 disabled:text-stone-400"
                      disabled={
                        sendingBlogId === post.id ||
                        bloggedPostIds.includes(post.id)
                      }
                      onClick={() => sendToBlog(post)}
                      type="button"
                    >
                      {sendingBlogId === post.id
                        ? "保存中"
                        : bloggedPostIds.includes(post.id)
                          ? "保存済み"
                          : "ブログ化"}
                    </button>
                    <button
                      className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                      onClick={() =>
                        setVisibleIdeaId((current) =>
                          current === post.id ? null : post.id,
                        )
                      }
                      type="button"
                    >
                      投稿案作成
                    </button>
                    <a
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                      href={post.canonicalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      元投稿
                    </a>
                  </div>
                  {post.reviewStatus !== "採用" ? (
                    <p className="mt-2 text-xs text-stone-500">
                      トレンド化はSNS受信箱で「採用」にした後で利用できます。
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </div>
      ) : view === "xCrawler" ? (
        <XSocialCrawler
          onPostsSaved={(savedPosts) =>
            setPosts((current) => [
              ...savedPosts.filter(
                (savedPost) =>
                  !current.some((post) => post.id === savedPost.id),
              ),
              ...current,
            ])
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-stone-950">
              SNS取得元を追加
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              公式API、手動URL、メタデータのみのどれで扱うかを記録します。
            </p>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Instagram初期候補は{initialInstagramSources.length}件です。おすすめ
              {recommendedInstagramSourceCount}件だけを最初から有効にしています。
            </p>

            <form className="mt-5 grid gap-4" onSubmit={handleAddSource}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  SNS名
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) =>
                      setSourceForm((current) => ({
                        ...current,
                        snsType: event.target.value as SnsType,
                      }))
                    }
                    value={sourceForm.snsType}
                  >
                    {snsProviderConfigs.map((provider) => (
                      <option key={provider.type} value={provider.type}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  優先度
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) =>
                      setSourceForm((current) => ({
                        ...current,
                        priority: event.target.value as SocialPriority,
                      }))
                    }
                    value={sourceForm.priority}
                  >
                    {(["high", "medium", "low"] as SocialPriority[]).map(
                      (priority) => (
                        <option key={priority} value={priority}>
                          {priorityLabels[priority]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                アカウント名
                <input
                  className="min-h-11 rounded-md border border-stone-300 px-3"
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      accountName: event.target.value,
                    }))
                  }
                  required
                  value={sourceForm.accountName}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  ハンドル
                  <input
                    className="min-h-11 rounded-md border border-stone-300 px-3"
                    onChange={(event) =>
                      setSourceForm((current) => ({
                        ...current,
                        handle: event.target.value,
                      }))
                    }
                    placeholder="@ef_maykes"
                    required={sourceForm.snsType === "Instagram"}
                    value={sourceForm.handle}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  カテゴリ
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                    onChange={(event) =>
                      setSourceForm((current) => ({
                        ...current,
                        category: event.target
                          .value as NewSocialSource["category"],
                      }))
                    }
                    value={sourceForm.category}
                  >
                    {socialSourceCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                プロフィールURL
                <input
                  className="min-h-11 rounded-md border border-stone-300 px-3"
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      profileUrl: event.target.value,
                    }))
                  }
                  required
                  type="url"
                  value={sourceForm.profileUrl}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                取得方式
                <select
                  className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      sourceMode: event.target.value as SocialSourceMode,
                    }))
                  }
                  value={sourceForm.sourceMode}
                >
                  {(
                    [
                      "official_api",
                      "manual_url",
                      "metadata_only",
                    ] as SocialSourceMode[]
                  ).map((mode) => (
                    <option key={mode} value={mode}>
                      {sourceModeLabels[mode]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                メモ
                <textarea
                  className="min-h-24 rounded-md border border-stone-300 px-3 py-2"
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      memo: event.target.value,
                    }))
                  }
                  value={sourceForm.memo}
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  checked={sourceForm.isActive}
                  className="size-4"
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                追加後すぐ有効にする
              </label>

              <button
                className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:bg-stone-300"
                disabled={isSavingSource}
                type="submit"
              >
                {isSavingSource ? "保存中" : "取得元を追加"}
              </button>
            </form>
          </section>

          <section className="grid content-start gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">
                登録済み取得元
              </h2>
              <Badge tone="neutral">{sources.length}件</Badge>
            </div>

            {sources.length === 0 ? (
              <EmptyState
                description="InstagramやPinterestなど、日常的に確認する公開アカウントを登録します。"
                title="SNS取得元はまだありません"
              />
            ) : (
              sources.map((source) => (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
                  key={source.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="info">{source.snsType}</Badge>
                        <Badge tone="neutral">{source.category}</Badge>
                        <Badge tone="neutral">
                          {sourceModeLabels[source.sourceMode]}
                        </Badge>
                        <Badge tone="warning">
                          優先度 {priorityLabels[source.priority]}
                        </Badge>
                        <Badge tone={source.isActive ? "success" : "neutral"}>
                          {source.isActive ? "有効" : "無効"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-stone-950">
                        {source.accountName}
                      </h3>
                      {source.handle ? (
                        <p className="mt-1 text-sm font-medium text-teal-700">
                          {source.handle}
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                      onClick={() => toggleSource(source)}
                      type="button"
                    >
                      {source.isActive ? "無効にする" : "有効にする"}
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {source.memo || "メモはありません。"}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    最終確認: {formatDateTime(source.lastCheckedAt)}
                  </p>

                  {source.lastError ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                      取得警告: {source.lastError}
                    </div>
                  ) : null}

                  <a
                    className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 underline"
                    href={source.profileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    公開プロフィールを確認
                  </a>
                </article>
              ))
            )}
          </section>
        </div>
      )}

      <section className="border-t border-stone-200 pt-5">
        <h2 className="text-base font-semibold text-stone-950">
          安全な取り込み方針
        </h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">
          ログイン回避、CAPTCHA回避、Cookie使い回し、IPローテーション、非公開投稿取得、大量スクレイピングは行いません。
          403・429・robots.txtによる禁止を検出した場合は取得を停止し、URL・タイトル・メモの手動登録へ戻します。
          TikTok投稿URLは公式oEmbedで取得できるタイトルとサムネイルURLだけを確認し、動画や画像ファイルは保存しません。
        </p>
      </section>
    </div>
  );
}
