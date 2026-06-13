"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  trendSourceCategories,
  trendSourcePriorities,
  trendSources,
  trendSourceTypes,
} from "@/config/trendSources";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createTrendSourceInSupabase,
  syncInitialTrendSourcesToSupabase,
  updateTrendSourceFetchResultInSupabase,
  updateTrendSourceInSupabase,
} from "@/lib/supabase/trendSources";
import type {
  ManagedTrendSource,
  TrendSourcePriority,
  TrendSourceRssStatus,
  TrendSourceType,
} from "@/types/trendSource";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type SourceForm = {
  title: string;
  url: string;
  sourceType: TrendSourceType;
  category: string;
  priority: TrendSourcePriority;
  isActive: boolean;
  memo: string;
};

type TestResult = {
  message: string;
  sampleCount: number;
  rssUrl: string | null;
  rssStatus: TrendSourceRssStatus;
  consecutiveFailures: number;
  samples?: Array<{
    title: string;
    url: string;
  }>;
  warnings?: string[];
};

const supabaseEnabled = isSupabaseConfigured();

const priorityLabels: Record<TrendSourcePriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const priorityTones: Record<
  TrendSourcePriority,
  "success" | "info" | "neutral"
> = {
  high: "success",
  medium: "info",
  low: "neutral",
};

const rssStatusLabels: Record<TrendSourceRssStatus, string> = {
  unchecked: "RSS未確認",
  available: "RSSあり",
  unavailable: "RSSなし",
  error: "RSSエラー",
};

const emptyForm: SourceForm = {
  category: "美容業界ニュース",
  isActive: true,
  memo: "",
  priority: "high",
  sourceType: "RSS",
  title: "",
  url: "",
};

function fallbackSources(): ManagedTrendSource[] {
  return trendSources.map((source, index) => ({
    category: source.categoryHint,
    consecutiveFailures: source.failureCount ?? 0,
    id: `config-${index}`,
    isActive: source.enabled,
    lastError: "",
    lastFetchedAt: null,
    memo: source.note,
    priority: source.priority,
    rssStatus: source.rssStatus ?? "unchecked",
    rssUrl: source.rssUrl ?? null,
    sourceType: source.sourceType,
    title: source.name,
    url: source.url,
  }));
}

function formatDate(value: string | null) {
  if (!value) {
    return "未取得";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function rssTone(status: TrendSourceRssStatus) {
  if (status === "available") {
    return "success" as const;
  }

  if (status === "error") {
    return "danger" as const;
  }

  if (status === "unavailable") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Supabase request timed out.")),
        timeoutMs,
      );
    }),
  ]);
}

export function TrendSourceManager() {
  const [sources, setSources] = useState<ManagedTrendSource[]>(() =>
    supabaseEnabled ? [] : fallbackSources(),
  );
  const [form, setForm] = useState<SourceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "初期取得元を確認し、Supabaseから読み込んでいます。"
      : "Supabase未設定のため、固定configの取得元を表示しています。",
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const activeCount = useMemo(
    () => sources.filter((source) => source.isActive).length,
    [sources],
  );
  const warningCount = useMemo(
    () => sources.filter((source) => source.consecutiveFailures >= 2).length,
    [sources],
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadSources() {
      try {
        const data = await withTimeout(
          syncInitialTrendSourcesToSupabase(),
          12_000,
        );

        if (!isMounted) {
          return;
        }

        setSources(data && data.length > 0 ? data : fallbackSources());
        setStatusTone(data && data.length > 0 ? "success" : "warning");
        setMessage(
          data && data.length > 0
            ? `初期取得元を重複なく同期しました。${data.length}件を管理中です。`
            : "Supabaseに取得元がないため、固定configを表示しています。",
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setSources(fallbackSources());
        setStatusTone("warning");
        setMessage(
          "Supabaseの取得元を更新できませんでした。schema.sql適用前でも固定configで確認できます。",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSources();

    return () => {
      isMounted = false;
    };
  }, []);

  function startEdit(source: ManagedTrendSource) {
    setEditingId(source.id.startsWith("config-") ? null : source.id);
    setForm({
      category: source.category,
      isActive: source.isActive,
      memo: source.memo,
      priority: source.priority,
      sourceType: source.sourceType,
      title: source.title,
      url: source.url,
    });
    setTestResult(null);
    setStatusTone(source.id.startsWith("config-") ? "warning" : "info");
    setMessage(
      source.id.startsWith("config-")
        ? "固定configの内容を新規登録フォームへ入れました。"
        : "取得元を編集中です。",
    );
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.url.trim()) {
      setStatusTone("warning");
      setMessage("取得元タイトルとURLを入力してください。");
      return;
    }

    if (!supabaseEnabled) {
      setStatusTone("warning");
      setMessage("Supabase未設定のため、取得元は保存できません。");
      return;
    }

    setIsSaving(true);
    setStatusTone("info");
    setMessage("取得元を保存しています。");

    try {
      const saved = editingId
        ? await updateTrendSourceInSupabase(editingId, form)
        : await createTrendSourceInSupabase(form);

      if (saved) {
        setSources((currentSources) => {
          if (editingId) {
            return currentSources.map((source) =>
              source.id === editingId ? saved : source,
            );
          }

          return [
            saved,
            ...currentSources.filter(
              (source) => !source.id.startsWith("config-"),
            ),
          ];
        });
      }

      setStatusTone("success");
      setMessage(editingId ? "取得元を更新しました。" : "取得元を追加しました。");
      resetForm();
    } catch (error) {
      setStatusTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "取得元の保存に失敗しました。Supabase設定を確認してください。",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest(source: ManagedTrendSource) {
    setTestingId(source.id);
    setStatusTone("info");
    setMessage("公開RSS候補を確認しています。HTML本文は解析しません。");
    setTestResult(null);

    try {
      const response = await fetch("/api/trend-sources/test", {
        body: JSON.stringify({
          category: source.category,
          consecutiveFailures: source.consecutiveFailures,
          rssUrl: source.rssUrl,
          sourceType: source.sourceType,
          title: source.title,
          url: source.url,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("RSS確認に失敗しました。");
      }

      const data = (await response.json()) as TestResult;
      setTestResult(data);
      setStatusTone(data.rssStatus === "available" ? "success" : "warning");
      setMessage(data.message);

      const localUpdated: ManagedTrendSource = {
        ...source,
        consecutiveFailures: data.consecutiveFailures,
        lastError:
          data.rssStatus === "available"
            ? ""
            : data.warnings?.join(" ") || data.message,
        lastFetchedAt: new Date().toISOString(),
        rssStatus: data.rssStatus,
        rssUrl: data.rssUrl,
      };

      if (supabaseEnabled && !source.id.startsWith("config-")) {
        const updated = await updateTrendSourceFetchResultInSupabase(source.id, {
          consecutiveFailures: data.consecutiveFailures,
          error: localUpdated.lastError,
          rssUrl: data.rssUrl,
          status: data.rssStatus,
        });

        if (updated) {
          setSources((currentSources) =>
            currentSources.map((item) =>
              item.id === source.id ? updated : item,
            ),
          );
        }
      } else {
        setSources((currentSources) =>
          currentSources.map((item) =>
            item.id === source.id ? localUpdated : item,
          ),
        );
      }
    } catch {
      setStatusTone("error");
      setMessage("RSS確認に失敗しました。URLや公開状態を確認してください。");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">
          取得元を登録・編集
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          優先度highだけを初期状態で有効にします。RSSがないURLは手動参照用として安全に残します。
        </p>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            取得元タイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例: 美容業界ニュース"
              required
              value={form.title}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            URL
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="https://example.com/"
              required
              type="url"
              value={form.url}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              種別
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceType: event.target.value as TrendSourceType,
                  }))
                }
                value={form.sourceType}
              >
                {trendSourceTypes.map((sourceType) => (
                  <option key={sourceType}>{sourceType}</option>
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
                    category: event.target.value,
                  }))
                }
                value={form.category}
              >
                {trendSourceCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm font-medium text-stone-700">
              優先度
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as TrendSourcePriority,
                  }))
                }
                value={form.priority}
              >
                {trendSourcePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}（{priorityLabels[priority]}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 pt-6 text-sm font-medium text-stone-700">
              <input
                checked={form.isActive}
                className="size-4"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              有効
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            メモ
            <textarea
              className="min-h-24 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, memo: event.target.value }))
              }
              placeholder="この取得元をどう使うかを書きます"
              value={form.memo}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "保存中" : editingId ? "更新する" : "追加する"}
            </button>
            <button
              className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              onClick={resetForm}
              type="button"
            >
              入力をリセット
            </button>
          </div>
        </form>
      </div>

      <div className="grid content-start gap-5">
        <StatusMessage
          isLoading={isLoading || isSaving || Boolean(testingId)}
          tone={statusTone}
        >
          {message}
        </StatusMessage>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-stone-200 bg-white p-3 text-center">
            <p className="text-xs text-stone-500">取得元</p>
            <p className="mt-1 text-lg font-semibold text-stone-950">
              {sources.length}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-white p-3 text-center">
            <p className="text-xs text-stone-500">有効</p>
            <p className="mt-1 text-lg font-semibold text-teal-700">
              {activeCount}
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-white p-3 text-center">
            <p className="text-xs text-stone-500">要確認</p>
            <p className="mt-1 text-lg font-semibold text-amber-700">
              {warningCount}
            </p>
          </div>
        </div>

        {testResult ? (
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-stone-950">
                RSS確認結果
              </h2>
              <Badge tone={rssTone(testResult.rssStatus)}>
                {rssStatusLabels[testResult.rssStatus]}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {testResult.message}
            </p>
            {testResult.rssUrl ? (
              <p className="mt-2 break-all text-xs text-stone-500">
                RSS: {testResult.rssUrl}
              </p>
            ) : null}
            {testResult.samples && testResult.samples.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {testResult.samples.map((sample) => (
                  <a
                    className="break-words rounded-md border border-stone-200 p-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                    href={sample.url}
                    key={sample.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {sample.title}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">取得元一覧</h2>
            <Badge tone={supabaseEnabled ? "success" : "warning"}>
              {supabaseEnabled ? "Supabase管理" : "config表示"}
            </Badge>
          </div>

          {sources.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {sources.map((source) => (
                <article
                  className={`rounded-md border p-4 ${
                    source.consecutiveFailures >= 2
                      ? "border-amber-300 bg-amber-50/40"
                      : "border-stone-200"
                  }`}
                  key={source.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={source.isActive ? "success" : "neutral"}>
                          {source.isActive ? "有効" : "無効"}
                        </Badge>
                        <Badge tone={priorityTones[source.priority]}>
                          優先度 {source.priority}
                        </Badge>
                        <Badge tone="info">{source.category}</Badge>
                        <Badge tone={rssTone(source.rssStatus)}>
                          {rssStatusLabels[source.rssStatus]}
                        </Badge>
                      </div>
                      <h3 className="mt-3 break-words text-sm font-semibold text-stone-950">
                        {source.title}
                      </h3>
                      <p className="mt-1 break-all text-xs text-stone-500">
                        {source.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                        onClick={() => startEdit(source)}
                        type="button"
                      >
                        編集
                      </button>
                      <button
                        className="min-h-9 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                        disabled={testingId === source.id}
                        onClick={() => handleTest(source)}
                        type="button"
                      >
                        {testingId === source.id ? "確認中" : "RSS確認"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {source.memo || "メモはありません。"}
                  </p>
                  {source.rssUrl ? (
                    <p className="mt-2 break-all text-xs text-stone-500">
                      RSS: {source.rssUrl}
                    </p>
                  ) : null}
                  {source.consecutiveFailures >= 2 ? (
                    <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900">
                      RSS確認が{source.consecutiveFailures}
                      回続けて失敗しています。自動で無効にはしていません。URLや公開状況を確認してください。
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-stone-500">
                    種別: {source.sourceType} / 最終確認:{" "}
                    {formatDate(source.lastFetchedAt)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                description="公式RSSまたは手動参照URLを追加すると、トレンド自動生成の取得元として使えます。"
                title="取得元はまだありません"
              />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
