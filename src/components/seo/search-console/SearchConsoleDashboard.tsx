"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataScopePanel } from "@/components/marketing/DataScopePanel";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  compareSearchConsolePeriods,
  createSearchConsoleBasicAnalysis,
  summarizeSearchConsoleRows,
} from "@/lib/searchConsole/metrics";
import {
  saveLocalSearchConsoleAnalysis,
  saveLocalSearchConsoleTask,
} from "@/lib/searchConsole/localStorage";
import { useSearchConsoleDataset } from "@/components/seo/search-console/useSearchConsoleDataset";
import type {
  SearchConsoleCandidate,
  SearchConsoleSeoAnalysis,
  SearchConsoleTaskSuggestion,
} from "@/types/searchConsole";

type SearchConsoleDashboardProps = {
  initialImportId?: string;
};

export function SearchConsoleDashboard({ initialImportId }: SearchConsoleDashboardProps) {
  const { dataset, isLoading, load, message, storageMode } = useSearchConsoleDataset(initialImportId);
  const [selectedImportId, setSelectedImportId] = useState(initialImportId ?? "");
  const [generatedAnalysis, setGeneratedAnalysis] = useState<{
    importId: string;
    value: SearchConsoleSeoAnalysis;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState<"info" | "success" | "warning" | "error">("info");

  const effectiveImportId = selectedImportId || dataset.imports[0]?.id || "";
  const selectedImport = dataset.imports.find((item) => item.id === effectiveImportId) ?? dataset.imports[0];
  const previousImport = useMemo(
    () =>
      selectedImport
        ? dataset.imports.find(
            (item) =>
              item.id !== selectedImport.id &&
              item.importType === selectedImport.importType &&
              item.periodEnd < selectedImport.periodEnd,
          )
        : undefined,
    [dataset.imports, selectedImport],
  );
  const rows = useMemo(
    () => (selectedImport ? dataset.rowsByImport[selectedImport.id] ?? [] : []),
    [dataset.rowsByImport, selectedImport],
  );
  const previousRows = useMemo(
    () => (previousImport ? dataset.rowsByImport[previousImport.id] ?? [] : []),
    [dataset.rowsByImport, previousImport],
  );
  const metrics = useMemo(() => summarizeSearchConsoleRows(rows), [rows]);
  const comparison = useMemo(
    () => compareSearchConsolePeriods(rows, previousRows, selectedImport?.comparisonLabel || "前回期間"),
    [previousRows, rows, selectedImport?.comparisonLabel],
  );
  const basic = useMemo(
    () => createSearchConsoleBasicAnalysis(rows, previousRows),
    [previousRows, rows],
  );

  const analysis =
    generatedAnalysis && selectedImport && generatedAnalysis.importId === selectedImport.id
      ? generatedAnalysis.value
      : selectedImport
        ? dataset.analysesByImport[selectedImport.id] ?? null
        : null;

  async function handleImportChange(importId: string) {
    setSelectedImportId(importId);
    if (storageMode === "supabase") await load(importId);
  }

  async function handleAnalyze() {
    if (!selectedImport || rows.length === 0) {
      setActionTone("warning");
      setActionMessage("分析できる行データがありません。");
      return;
    }
    setIsAnalyzing(true);
    setActionTone("info");
    setActionMessage("Geminiが集計済みデータを分析しています。");
    try {
      const response = await fetch("/api/seo/search-console/analyze", {
        body: JSON.stringify({
          currentImport: selectedImport,
          importId: selectedImport.id,
          previousRows,
          rows,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        analysis?: SearchConsoleSeoAnalysis;
        error?: string;
        reused?: boolean;
      };
      if (!response.ok || !data.analysis) throw new Error(data.error || "分析できませんでした。");
      setGeneratedAnalysis({ importId: selectedImport.id, value: data.analysis });
      if (storageMode !== "supabase") {
        saveLocalSearchConsoleAnalysis(selectedImport.id, data.analysis);
      }
      setActionTone(data.analysis.provider === "mock" ? "warning" : "success");
      setActionMessage(
        data.reused
          ? "同じデータの保存済み分析を再利用しました。"
          : `${data.analysis.providerLabel}で分析しました。`,
      );
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "SEO分析に失敗しました。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function addTask(suggestion: SearchConsoleTaskSuggestion) {
    if (!selectedImport) return;
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setActionTone("info");
    setActionMessage("SEOタスクへ登録しています。");
    try {
      const response = await fetch("/api/seo/tasks", {
        body: JSON.stringify({ dueDate, importId: selectedImport.id, suggestion }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        duplicate?: boolean;
        error?: string;
        storageMode?: "local" | "supabase";
        task?: SearchConsoleTaskSuggestion;
      };
      if (!response.ok) throw new Error(data.error || "登録できませんでした。");
      const localResult = data.storageMode === "local"
        ? saveLocalSearchConsoleTask(selectedImport.id, data.task ?? suggestion, dueDate)
        : { duplicate: data.duplicate ?? false };
      setActionTone(localResult.duplicate ? "warning" : "success");
      setActionMessage(
        localResult.duplicate
          ? "同じSEOタスクはすでに登録されています。"
          : `SEOタスクへ登録しました。期限は${dueDate}です。`,
      );
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "SEOタスクを登録できませんでした。");
    }
  }

  if (!selectedImport) {
    return <StatusMessage tone="warning">CSV取り込み画面からSearch Consoleデータを登録してください。</StatusMessage>;
  }

  const importTypeLabel = {
    query: "検索クエリ",
    page: "ページ",
    device: "デバイス",
    country: "国",
    date: "日別",
  }[selectedImport.importType];
  const sourceKind =
    storageMode === "supabase"
      ? "csv"
      : storageMode === "local"
        ? "local"
        : "sample";

  const candidateRows = [
    ...basic.zeroClickHighImpressions,
    ...basic.highImpressionsLowCtr,
    ...basic.positionElevenToTwenty,
    ...basic.positionTwentyOneToThirty,
  ].filter((item, index, all) => all.findIndex((other) => other.key === item.key) === index).slice(0, 12);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-stone-700">
          対象データ
          <select
            className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
            onChange={(event) => void handleImportChange(event.target.value)}
            value={selectedImport.id}
          >
            {dataset.imports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.periodStart}〜{item.periodEnd} / {item.fileName}
              </option>
            ))}
          </select>
        </label>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50" href="/seo/search-console/import">
          CSVを取り込む
        </Link>
      </div>

      <DataScopePanel
        collected={[
          `取り込んだ${importTypeLabel}ごとのクリック数・表示回数・CTR・平均掲載順位`,
          "期間比較と、しきい値に基づく改善候補",
          "Gemini分析を実行した場合は、集計値と改善候補のみ",
        ]}
        description="この分析は、選択したSearch Console CSVだけを対象にしています。データの期間と種類を確認してから、数値を判断してください。"
        limitations={[
          "Search Console APIとの直接連携はこの画面では行いません。CSVで取り込んだデータだけを使います。",
          "取り込んでいない検索クエリ・ページ・デバイス・国の情報は、この結果には含まれません。",
          "GeminiへCSVの全行は送信しません。アプリで集計した値と候補だけを送ります。",
        ]}
        period={`${selectedImport.periodStart}〜${selectedImport.periodEnd}`}
        sourceKind={sourceKind}
        sourceLabel={`${importTypeLabel} CSV / ${selectedImport.fileName}`}
        updatedAt={selectedImport.updatedAt}
      />

      <StatusMessage isLoading={isLoading} tone={storageMode === "demo" ? "warning" : "info"}>{message}</StatusMessage>

      <section className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <MetricCard label="合計クリック" value={metrics.clicks.toLocaleString("ja-JP")} />
        <MetricCard label="合計表示回数" value={metrics.impressions.toLocaleString("ja-JP")} />
        <MetricCard label="平均CTR" value={`${(metrics.ctr * 100).toFixed(2)}%`} />
        <MetricCard label="平均掲載順位" value={metrics.averagePosition.toFixed(1)} note="小さいほど上位" />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">{comparison.label}との比較</h2>
        {comparison.hasComparison ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Change label="クリック" value={formatPercentChange(comparison.clicks.percentChange)} />
            <Change label="表示回数" value={formatPercentChange(comparison.impressions.percentChange)} />
            <Change label="CTR" value={`${signed(comparison.ctrPointChange)}ポイント`} />
            <Change label="平均順位" value={`${signed(comparison.positionImprovement)}位${comparison.positionImprovement >= 0 ? "改善" : "低下"}`} />
          </dl>
        ) : <p className="mt-3 text-sm text-stone-500">比較データなし</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">優先改善候補</h2>
            <p className="mt-1 text-sm text-stone-500">しきい値による基本判定です。Geminiを使わなくても確認できます。</p>
          </div>
          <Badge tone="info">{candidateRows.length}件</Badge>
        </div>
        <CandidateTable candidates={candidateRows} importId={selectedImport.id} />
      </section>

      <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5" id="gemini-analysis">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold text-teal-700">{analysis?.providerLabel ?? "未分析"}</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Gemini SEO分析</h2></div>
          <button className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60" disabled={isAnalyzing} onClick={() => void handleAnalyze()} type="button">{isAnalyzing ? "分析中" : analysis ? "再分析する" : "SEO分析する"}</button>
        </div>
        <div className="mt-4"><StatusMessage isLoading={isAnalyzing} tone={actionTone}>{actionMessage || "集計値と改善候補だけをGeminiへ送ります。CSV全行は送信しません。"}</StatusMessage></div>
        {analysis ? <AnalysisResult analysis={analysis} importId={selectedImport.id} onAddTask={addTask} /> : null}
      </section>
    </div>
  );
}

function MetricCard({ label, note, value }: { label: string; note?: string; value: string }) {
  return <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-stone-500 sm:text-sm">{label}</p><p className="mt-2 text-xl font-semibold text-stone-950 sm:text-2xl">{value}</p>{note ? <p className="mt-1 text-xs text-stone-500">{note}</p> : null}</article>;
}

function Change({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-teal-500 pl-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold text-stone-950">{value}</dd></div>;
}

function signed(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
function formatPercentChange(value: number | null) { return value === null ? "比較不可" : `${signed(value)}%`; }

function CandidateTable({ candidates, importId }: { candidates: SearchConsoleCandidate[]; importId: string }) {
  if (candidates.length === 0) return <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">現在のしきい値に該当する候補はありません。</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs text-stone-500"><th className="px-4 py-3">キーワード／ページ</th><th className="px-4 py-3">表示</th><th className="px-4 py-3">CTR</th><th className="px-4 py-3">順位</th><th className="px-4 py-3">対応</th></tr></thead>
        <tbody>{candidates.map((item) => <tr className="border-b border-stone-100 last:border-0" key={`${item.category}-${item.key}`}><td className="max-w-80 px-4 py-3"><p className="break-words font-semibold text-stone-900">{item.key}</p><p className="mt-1 text-xs leading-5 text-stone-500">{item.reason}</p></td><td className="px-4 py-3">{item.impressions}</td><td className="px-4 py-3">{(item.ctr * 100).toFixed(2)}%</td><td className="px-4 py-3">{item.position.toFixed(1)}</td><td className="px-4 py-3"><Link className="inline-flex min-h-9 items-center whitespace-nowrap rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50" href={createBlogHref({ importId, keyword: item.query || item.key, reason: item.reason, targetPage: item.pageUrl })}>記事を作成</Link></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function createBlogHref({ importId, keyword, reason, targetPage, title = "" }: { importId: string; keyword: string; reason: string; targetPage?: string; title?: string }) {
  return `/blog?${new URLSearchParams({ articleSummary: reason, keyword, memo: reason, searchIntent: reason, sourceSearchConsoleImportId: importId, targetPage: targetPage ?? "", title, view: "generator" }).toString()}`;
}

function AnalysisResult({ analysis, importId, onAddTask }: { analysis: SearchConsoleSeoAnalysis; importId: string; onAddTask: (task: SearchConsoleTaskSuggestion) => Promise<void> }) {
  return (
    <div className="mt-5 space-y-5">
      <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{analysis.summary}</p>
      <div className="grid gap-5 md:grid-cols-2"><TextList title="良かった点" items={analysis.positivePoints} /><TextList title="改善したい点" items={analysis.negativePoints} /></div>
      <div><h3 className="text-sm font-semibold text-stone-950">新規記事案</h3><div className="mt-3 grid gap-3">{analysis.newArticleIdeas.map((idea) => <article className="rounded-md border border-stone-200 p-4" key={`${idea.targetKeyword}-${idea.title}`}><p className="font-semibold text-stone-950">{idea.title}</p><p className="mt-2 text-sm leading-6 text-stone-600">{idea.reason}</p><Link className="mt-3 inline-flex min-h-10 items-center rounded-md bg-stone-950 px-3 text-sm font-semibold text-white" href={createBlogHref({ importId, keyword: idea.targetKeyword, reason: idea.reason, title: idea.title })}>このキーワードで記事を作成</Link></article>)}</div></div>
      <div><h3 className="text-sm font-semibold text-stone-950">タイトル修正候補</h3><div className="mt-3 space-y-3">{analysis.titleSuggestions.map((item) => <div className="border-l-2 border-amber-400 pl-3" key={`${item.keyword}-${item.suggestedTitle}`}><p className="text-xs text-stone-500">現在のタイトル: 未取得</p><p className="mt-1 font-semibold text-stone-900">提案: {item.suggestedTitle}</p><p className="mt-1 text-sm text-stone-600">{item.reason}</p></div>)}</div></div>
      <div><h3 className="text-sm font-semibold text-stone-950">今月のSEOタスク</h3><div className="mt-3 grid gap-3">{analysis.monthlyTasks.map((task) => <div className="flex flex-col gap-3 rounded-md border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={`${task.taskType}-${task.title}`}><div><div className="flex gap-2"><Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Badge><Badge tone="info">{task.taskType}</Badge></div><p className="mt-2 font-semibold text-stone-950">{task.title}</p><p className="mt-1 text-sm text-stone-600">{task.reason}</p></div><button className="min-h-10 shrink-0 rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50" onClick={() => void onAddTask(task)} type="button">SEOタスクに追加</button></div>)}</div></div>
      <TextList title="次月の目標" items={analysis.nextMonthGoals} />
    </div>
  );
}

function TextList({ items, title }: { items: string[]; title: string }) {
  return <section><h3 className="text-sm font-semibold text-stone-950">{title}</h3>{items.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-600">{items.map((item) => <li key={item}>・{item}</li>)}</ul> : <p className="mt-2 text-sm text-stone-500">該当なし</p>}</section>;
}
