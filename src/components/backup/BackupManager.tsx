"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyGeneratedPosts } from "@/data/dummyGeneratedPosts";
import { dummyKeywords } from "@/data/dummyKeywords";
import { dummyTrends } from "@/data/dummyTrends";
import {
  backupToCsv,
  createAppBackup,
  parseAppBackup,
  type AppBackup,
  type BackupData,
  type BackupSource,
} from "@/lib/backup/format";
import {
  readLocalBackupGeneratedPosts,
  readLocalBackupKeywords,
  readLocalBackupTrends,
  readLocalRecentTrends,
  saveLocalBackupGeneratedPosts,
  saveLocalBackupKeywords,
  saveLocalBackupTrends,
  saveLocalRecentTrends,
  type RecentTrendBackup,
} from "@/lib/backup/localStorage";
import { fetchAiOutputsFromSupabase, restoreAiOutputsToSupabase } from "@/lib/supabase/aiOutputs";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchKeywordsFromSupabase,
  restoreKeywordsToSupabase,
} from "@/lib/supabase/keywords";
import {
  fetchTrendLinksFromSupabase,
  restoreTrendLinksToSupabase,
} from "@/lib/supabase/trends";

type RestoreMode = "merge" | "replace";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const supabaseEnabled = isSupabaseConfigured();

function createBackupFileName(extension: "csv" | "json") {
  const dateLabel = new Date().toISOString().slice(0, 10);

  return `hair-trend-dashboard-backup-${dateLabel}.${extension}`;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function mergeById<T extends { id: string }>(currentItems: T[], importedItems: T[]) {
  const itemMap = new Map<string, T>();

  currentItems.forEach((item) => itemMap.set(item.id, item));
  importedItems.forEach((item) => itemMap.set(item.id, item));

  return Array.from(itemMap.values());
}

function mergeRecentTrends(
  currentItems: RecentTrendBackup[],
  importedItems: RecentTrendBackup[],
) {
  return mergeById(currentItems, importedItems)
    .sort((firstItem, secondItem) =>
      secondItem.viewedAt.localeCompare(firstItem.viewedAt),
    )
    .slice(0, 10);
}

function getBackupCount(backup: AppBackup) {
  return (
    backup.data.trends.length +
    backup.data.keywords.length +
    backup.data.generatedPosts.length +
    backup.data.recentTrends.length
  );
}

function BackupStats({ backup }: { backup: AppBackup }) {
  const stats = [
    { label: "トレンド", value: backup.data.trends.length },
    { label: "キーワード", value: backup.data.keywords.length },
    { label: "AI生成結果", value: backup.data.generatedPosts.length },
    { label: "最近見たトレンド", value: backup.data.recentTrends.length },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          className="rounded-lg border border-stone-200 bg-stone-50 p-4"
          key={stat.label}
        >
          <p className="text-xs font-semibold text-stone-500">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold text-stone-950">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

async function loadCurrentBackupData(): Promise<BackupData> {
  if (supabaseEnabled) {
    const [trends, keywords, generatedPosts] = await Promise.all([
      fetchTrendLinksFromSupabase(),
      fetchKeywordsFromSupabase(),
      fetchAiOutputsFromSupabase(),
    ]);

    return {
      generatedPosts: generatedPosts ?? [],
      keywords: keywords ?? [],
      recentTrends: readLocalRecentTrends(),
      trends: trends ?? [],
    };
  }

  return {
    generatedPosts: readLocalBackupGeneratedPosts() ?? dummyGeneratedPosts,
    keywords: readLocalBackupKeywords() ?? dummyKeywords,
    recentTrends: readLocalRecentTrends(),
    trends: readLocalBackupTrends() ?? dummyTrends,
  };
}

async function createCurrentBackup(source: BackupSource) {
  const data = await loadCurrentBackupData();

  return createAppBackup(data, source);
}

export function BackupManager() {
  const [currentBackup, setCurrentBackup] = useState<AppBackup | null>(null);
  const [importedBackup, setImportedBackup] = useState<AppBackup | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [message, setMessage] = useState("現在の保存データを確認しています。");
  const source: BackupSource = supabaseEnabled ? "supabase" : "local";
  const isBusy = isLoadingSummary || isExporting || isImporting || isRestoring;

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const backup = await createCurrentBackup(source);

        if (!isMounted) {
          return;
        }

        setCurrentBackup(backup);
        setStatusTone("success");
        setMessage("バックアップ対象のデータを確認しました。");
      } catch {
        if (!isMounted) {
          return;
        }

        setStatusTone("warning");
        setMessage(
          "Supabaseからデータを読み込めませんでした。環境変数やテーブル設定を確認してください。",
        );
      } finally {
        if (isMounted) {
          setIsLoadingSummary(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [source]);

  async function handleJsonExport() {
    setIsExporting(true);
    setStatusTone("info");
    setMessage("JSONバックアップを作成しています。");

    try {
      const backup = await createCurrentBackup(source);

      setCurrentBackup(backup);
      downloadTextFile(
        createBackupFileName("json"),
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8",
      );
      setStatusTone("success");
      setMessage("JSONバックアップを書き出しました。復元にはこのJSONを使います。");
    } catch {
      setStatusTone("error");
      setMessage("JSONエクスポートに失敗しました。保存先の接続状況を確認してください。");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCsvExport() {
    setIsExporting(true);
    setStatusTone("info");
    setMessage("CSVバックアップを作成しています。");

    try {
      const backup = await createCurrentBackup(source);

      setCurrentBackup(backup);
      downloadTextFile(
        createBackupFileName("csv"),
        backupToCsv(backup),
        "text/csv;charset=utf-8",
      );
      setStatusTone("success");
      setMessage("CSVを書き出しました。CSVは表計算ソフトで確認するための形式です。");
    } catch {
      setStatusTone("error");
      setMessage("CSVエクスポートに失敗しました。保存先の接続状況を確認してください。");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleJsonImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);
    setStatusTone("info");
    setMessage("JSONバックアップを読み込んでいます。");

    try {
      const rawText = await file.text();
      const parsedBackup = parseAppBackup(JSON.parse(rawText));

      if (!parsedBackup) {
        throw new Error("Invalid backup file.");
      }

      setImportedBackup(parsedBackup);
      setStatusTone("success");
      setMessage(
        `JSONを読み込みました。合計${getBackupCount(parsedBackup)}件を復元できます。`,
      );
    } catch {
      setImportedBackup(null);
      setStatusTone("error");
      setMessage(
        "JSONインポートに失敗しました。このアプリで書き出したJSONバックアップを選んでください。",
      );
    } finally {
      event.target.value = "";
      setIsImporting(false);
    }
  }

  async function handleRestore(mode: RestoreMode) {
    if (!importedBackup) {
      setStatusTone("warning");
      setMessage("先にJSONバックアップをインポートしてください。");
      return;
    }

    setIsRestoring(true);
    setStatusTone("info");
    setMessage(mode === "replace" ? "上書き復元しています。" : "追加復元しています。");

    try {
      if (supabaseEnabled) {
        const replaceExisting = mode === "replace";

        await restoreTrendLinksToSupabase(importedBackup.data.trends, {
          replaceExisting,
        });
        await restoreKeywordsToSupabase(importedBackup.data.keywords, {
          replaceExisting,
        });
        await restoreAiOutputsToSupabase(importedBackup.data.generatedPosts, {
          replaceExisting,
        });
        saveLocalRecentTrends(
          replaceExisting
            ? importedBackup.data.recentTrends
            : mergeRecentTrends(readLocalRecentTrends(), importedBackup.data.recentTrends),
        );
      } else {
        const currentTrends = readLocalBackupTrends() ?? dummyTrends;
        const currentKeywords = readLocalBackupKeywords() ?? dummyKeywords;
        const currentPosts = readLocalBackupGeneratedPosts() ?? dummyGeneratedPosts;

        saveLocalBackupTrends(
          mode === "replace"
            ? importedBackup.data.trends
            : mergeById(currentTrends, importedBackup.data.trends),
        );
        saveLocalBackupKeywords(
          mode === "replace"
            ? importedBackup.data.keywords
            : mergeById(currentKeywords, importedBackup.data.keywords),
        );
        saveLocalBackupGeneratedPosts(
          mode === "replace"
            ? importedBackup.data.generatedPosts
            : mergeById(currentPosts, importedBackup.data.generatedPosts),
        );
        saveLocalRecentTrends(
          mode === "replace"
            ? importedBackup.data.recentTrends
            : mergeRecentTrends(readLocalRecentTrends(), importedBackup.data.recentTrends),
        );
      }

      const refreshedBackup = await createCurrentBackup(source);

      setCurrentBackup(refreshedBackup);
      setStatusTone("success");
      setMessage(
        mode === "replace"
          ? "バックアップを上書き復元しました。トレンド一覧やキーワード管理を開くと反映されます。"
          : "バックアップを追加復元しました。トレンド一覧やキーワード管理を開くと反映されます。",
      );
    } catch {
      setStatusTone("error");
      setMessage(
        "バックアップ復元に失敗しました。Supabaseの接続、RLS、テーブル設定を確認してください。",
      );
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">
                1. バックアップを書き出す
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                JSONは復元用、CSVは表で確認するための形式です。普段はJSONを保存しておくと安心です。
              </p>
            </div>
            <Badge tone={supabaseEnabled ? "success" : "neutral"}>
              {supabaseEnabled ? "Supabase保存" : "端末保存"}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="min-h-12 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={isBusy}
              onClick={handleJsonExport}
              type="button"
            >
              JSONを書き出す
            </button>
            <button
              className="min-h-12 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              disabled={isBusy}
              onClick={handleCsvExport}
              type="button"
            >
              CSVを書き出す
            </button>
          </div>

          <div className="mt-5">
            {isLoadingSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {["trend", "keyword", "post", "recent"].map((item) => (
                  <div
                    className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                    key={item}
                  >
                    <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                    <div className="mt-3 h-8 w-12 animate-pulse rounded bg-stone-200" />
                  </div>
                ))}
              </div>
            ) : currentBackup ? (
              <BackupStats backup={currentBackup} />
            ) : (
              <EmptyState
                description="保存先からデータを読み込めませんでした。設定画面で環境変数を確認してください。"
                title="バックアップ対象を確認できません"
              />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-stone-950">
            2. JSONを読み込んで復元する
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            このアプリで書き出したJSONだけを読み込めます。CSVは確認用なので復元には使いません。
          </p>

          <label className="mt-5 grid gap-2 text-sm font-medium text-stone-700">
            JSONファイルを選ぶ
            <input
              accept="application/json,.json"
              className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              disabled={isBusy}
              onChange={handleJsonImport}
              type="file"
            />
          </label>

          {importedBackup ? (
            <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-teal-900">
                  読み込み済みバックアップ
                </p>
                <Badge tone="success">合計 {getBackupCount(importedBackup)}件</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-teal-800">
                書き出し日時: {new Date(importedBackup.exportedAt).toLocaleString("ja-JP")}
              </p>
              <div className="mt-4">
                <BackupStats backup={importedBackup} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  className="min-h-12 rounded-md border border-teal-300 bg-white px-4 text-sm font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:bg-teal-100 disabled:text-teal-400"
                  disabled={isBusy}
                  onClick={() => handleRestore("merge")}
                  type="button"
                >
                  追加で復元
                </button>
                <button
                  className="min-h-12 rounded-md border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-rose-100 disabled:text-rose-400"
                  disabled={isBusy}
                  onClick={() => handleRestore("replace")}
                  type="button"
                >
                  上書き復元
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-teal-800">
                追加で復元は今あるデータを残します。上書き復元は現在のトレンド、キーワード、AI生成結果を入れ替えます。
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                description="まずJSONを書き出しておくと、パソコン変更時やデータ整理前に戻しやすくなります。"
                title="読み込んだバックアップはまだありません"
              />
            </div>
          )}
        </div>
      </section>

      <div className="mt-6">
        <StatusMessage isLoading={isBusy} tone={statusTone}>
          {message}
        </StatusMessage>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-stone-950">おすすめの使い方</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            大きく編集する前、月末、パソコン変更前にJSONを書き出します。
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-stone-950">CSVの使い方</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            CSVはExcelやスプレッドシートで中身を確認するために使います。
          </p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-rose-950">
            SNSスクレイピングは禁止
          </p>
          <p className="mt-2 text-sm leading-6 text-rose-900">
            バックアップ対象は手動登録、公式API、RSS、公開許可された情報だけです。
          </p>
        </div>
      </section>
    </>
  );
}
