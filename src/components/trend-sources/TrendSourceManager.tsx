"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { trendSources } from "@/config/trendSources";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createTrendSourceInSupabase,
  fetchTrendSourcesFromSupabase,
  updateTrendSourceFetchedAtInSupabase,
  updateTrendSourceInSupabase,
} from "@/lib/supabase/trendSources";
import type { ManagedTrendSource, TrendSourceType } from "@/types/trendSource";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type SourceForm = {
  title: string;
  url: string;
  sourceType: TrendSourceType;
  isActive: boolean;
  memo: string;
};

type TestResult = {
  message: string;
  sampleCount: number;
  samples?: Array<{
    title: string;
    url: string;
  }>;
  warnings?: string[];
};

const sourceTypes: TrendSourceType[] = [
  "RSS",
  "公式サイト",
  "自社サイト",
  "メーカー",
  "美容ディーラー",
  "美容メディア",
];
const supabaseEnabled = isSupabaseConfigured();

const emptyForm: SourceForm = {
  isActive: true,
  memo: "",
  sourceType: "RSS",
  title: "",
  url: "",
};

function fallbackSources(): ManagedTrendSource[] {
  return trendSources.map((source, index) => ({
    id: `config-${index}`,
    isActive: source.enabled,
    lastFetchedAt: null,
    memo: source.note,
    sourceType: source.type === "rss" ? "RSS" : "公式サイト",
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
      ? "Supabaseから取得元を読み込んでいます。"
      : "Supabase未設定のため、固定configの取得元を表示しています。",
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadSources() {
      try {
        const data = await fetchTrendSourcesFromSupabase();

        if (!isMounted) {
          return;
        }

        setSources(data && data.length > 0 ? data : fallbackSources());
        setStatusTone(data && data.length > 0 ? "success" : "warning");
        setMessage(
          data && data.length > 0
            ? "Supabaseの取得元を表示しています。"
            : "Supabaseに取得元がまだないため、固定configの取得元を表示しています。",
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setSources(fallbackSources());
        setStatusTone("warning");
        setMessage("取得元を読み込めなかったため、固定configを表示しています。");
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
      isActive: source.isActive,
      memo: source.memo,
      sourceType: source.sourceType,
      title: source.title,
      url: source.url,
    });
    setTestResult(null);
    setStatusTone(source.id.startsWith("config-") ? "warning" : "info");
    setMessage(
      source.id.startsWith("config-")
        ? "固定configの取得元は直接編集できません。内容を参考に新規登録してください。"
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

          return [saved, ...currentSources.filter((source) => !source.id.startsWith("config-"))];
        });
      }

      setStatusTone("success");
      setMessage(editingId ? "取得元を更新しました。" : "取得元を追加しました。");
      resetForm();
    } catch {
      setStatusTone("error");
      setMessage("取得元の保存に失敗しました。Supabase設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest(source: ManagedTrendSource) {
    setTestingId(source.id);
    setStatusTone("info");
    setMessage("取得テストを実行しています。");
    setTestResult(null);

    try {
      const response = await fetch("/api/trend-sources/test", {
        body: JSON.stringify({
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
        throw new Error("Failed to test source.");
      }

      const data = (await response.json()) as TestResult;
      setTestResult(data);
      setStatusTone(data.sampleCount > 0 ? "success" : "warning");
      setMessage(data.message);

      if (supabaseEnabled && !source.id.startsWith("config-")) {
        const updated = await updateTrendSourceFetchedAtInSupabase(source.id);

        if (updated) {
          setSources((currentSources) =>
            currentSources.map((item) => (item.id === source.id ? updated : item)),
          );
        }
      }
    } catch {
      setStatusTone("error");
      setMessage("取得テストに失敗しました。URLやRSS公開状態を確認してください。");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">
          取得元を登録・編集
        </h2>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            取得元タイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-teal-600"
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="例: 自社ブログ"
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
              placeholder="https://example.com/feed.xml"
              required
              type="url"
              value={form.url}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
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
                {sourceTypes.map((sourceType) => (
                  <option key={sourceType}>{sourceType}</option>
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
        <StatusMessage isLoading={isLoading || isSaving || Boolean(testingId)} tone={statusTone}>
          {message}
        </StatusMessage>

        {testResult ? (
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-stone-950">取得テスト結果</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {testResult.message}
            </p>
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
            <h2 className="text-lg font-semibold text-stone-950">
              取得元一覧
            </h2>
            <Badge tone={supabaseEnabled ? "success" : "warning"}>
              {supabaseEnabled ? "Supabase管理" : "config表示"}
            </Badge>
          </div>

          {sources.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {sources.map((source) => (
                <article
                  className="rounded-md border border-stone-200 p-4"
                  key={source.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={source.isActive ? "success" : "neutral"}>
                          {source.isActive ? "有効" : "無効"}
                        </Badge>
                        <Badge tone="info">{source.sourceType}</Badge>
                      </div>
                      <h3 className="mt-3 break-words text-sm font-semibold text-stone-950">
                        {source.title}
                      </h3>
                      <p className="mt-1 break-words text-xs text-stone-500">
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
                        {testingId === source.id ? "確認中" : "取得テスト"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {source.memo || "メモはありません。"}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    最終取得日時: {formatDate(source.lastFetchedAt)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                description="RSSや公式サイトURLを追加すると、トレンド自動生成の取得元として使えます。"
                title="取得元はまだありません"
              />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
