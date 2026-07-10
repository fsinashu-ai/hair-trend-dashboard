"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataScopePanel } from "@/components/marketing/DataScopePanel";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  compareGa4Periods,
  createGa4BasicAnalysis,
  formatDuration,
  summarizeGa4Rows,
} from "@/lib/ga4/metrics";
import { saveLocalGa4Analysis } from "@/lib/ga4/localStorage";
import { useGa4Dataset } from "@/components/seo/ga4/useGa4Dataset";
import type { Ga4Analysis, Ga4Candidate } from "@/types/ga4";

type Ga4DashboardProps = {
  initialImportId?: string;
};

export function Ga4Dashboard({ initialImportId }: Ga4DashboardProps) {
  const { dataset, isLoading, load, message, storageMode } = useGa4Dataset(initialImportId);
  const [selectedImportId, setSelectedImportId] = useState(initialImportId ?? "");
  const [generatedAnalysis, setGeneratedAnalysis] = useState<{
    importId: string;
    value: Ga4Analysis;
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
  const metrics = useMemo(() => summarizeGa4Rows(rows), [rows]);
  const comparison = useMemo(
    () => compareGa4Periods(rows, previousRows, selectedImport?.comparisonLabel || "前回期間"),
    [previousRows, rows, selectedImport?.comparisonLabel],
  );
  const basic = useMemo(() => createGa4BasicAnalysis(rows), [rows]);

  const analysis =
    generatedAnalysis?.importId === selectedImport?.id
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
      setActionMessage("分析できるGA4行データがありません。");
      return;
    }
    setIsAnalyzing(true);
    setActionTone("info");
    setActionMessage("GeminiがGA4集計データを分析しています。");
    try {
      const response = await fetch("/api/seo/ga4/analyze", {
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
        analysis?: Ga4Analysis;
        error?: string;
        reused?: boolean;
      };
      if (!response.ok || !data.analysis) throw new Error(data.error || "分析できませんでした。");
      setGeneratedAnalysis({ importId: selectedImport.id, value: data.analysis });
      if (storageMode !== "supabase") {
        saveLocalGa4Analysis(selectedImport.id, data.analysis);
      }
      setActionTone(data.analysis.provider === "mock" ? "warning" : "success");
      setActionMessage(
        data.reused
          ? "同じデータの保存済み分析を再利用しました。"
          : `${data.analysis.providerLabel}で分析しました。`,
      );
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "GA4分析に失敗しました。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (!selectedImport) {
    return <StatusMessage tone="warning">CSV取り込み画面からGA4データを登録してください。</StatusMessage>;
  }

  const isGa4DataApiImport = selectedImport.fileName.startsWith("ga4-data-api-");
  const sourceKind =
    storageMode === "demo"
      ? "sample"
      : isGa4DataApiImport
        ? "api"
        : storageMode === "local"
          ? "local"
          : "csv";
  const sourceLabel = isGa4DataApiImport
    ? "Google Analytics Data API"
    : `GA4 CSV / ${selectedImport.fileName}`;

  const candidateRows = [
    ...basic.highUsersNoConversion,
    ...basic.lineOpportunityPages,
    ...basic.highViewsLowEngagement,
    ...basic.topLandingPages,
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
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50" href="/seo/ga4/import">
          GA4 CSVを取り込む
        </Link>
      </div>

      <DataScopePanel
        collected={[
          "ランディングページ、流入元・メディア、チャネル、ユーザー、セッション、表示回数",
          "エンゲージメント率・平均エンゲージメント時間・キーイベント（コンバージョン）",
          "LINE・予約と判断できるイベント名がある場合のクリック数",
        ]}
        description="この分析は、選択したGA4データだけを対象にしています。GA4 Data APIで取得したものか、手動CSVかを確認してから判断してください。"
        limitations={[
          "LINE・予約クリックは、GA4で該当イベントが正しく計測されている場合だけ表示できます。",
          "電話・Instagram・Googleマップなど、取り込んでいないイベントはこの画面の数値に含まれません。",
          "Gemini分析を実行しても、GA4の全行は送らず、アプリで集計した値と改善候補だけを送ります。",
        ]}
        period={`${selectedImport.periodStart}〜${selectedImport.periodEnd}`}
        sourceKind={sourceKind}
        sourceLabel={sourceLabel}
        updatedAt={selectedImport.updatedAt}
      />

      <StatusMessage isLoading={isLoading} tone={storageMode === "demo" ? "warning" : "info"}>{message}</StatusMessage>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="ユーザー" value={metrics.users.toLocaleString("ja-JP")} />
        <MetricCard label="セッション" value={metrics.sessions.toLocaleString("ja-JP")} />
        <MetricCard label="表示回数" value={metrics.views.toLocaleString("ja-JP")} />
        <MetricCard label="エンゲージメント率" value={`${(metrics.engagementRate * 100).toFixed(1)}%`} />
        <MetricCard label="平均エンゲージメント時間" value={formatDuration(metrics.averageEngagementSeconds)} />
        <MetricCard label="LINEクリック" value={metrics.lineClicks.toLocaleString("ja-JP")} />
        <MetricCard label="予約クリック" value={metrics.reservationClicks.toLocaleString("ja-JP")} />
        <MetricCard label="キーイベント" value={metrics.conversions.toLocaleString("ja-JP")} />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">{comparison.label}との比較</h2>
        {comparison.hasComparison ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Change label="ユーザー" value={formatPercentChange(comparison.users.percentChange)} />
            <Change label="セッション" value={formatPercentChange(comparison.sessions.percentChange)} />
            <Change label="表示回数" value={formatPercentChange(comparison.views.percentChange)} />
            <Change label="相談・予約行動" value={formatPercentChange(comparison.conversionClicks.percentChange)} />
          </dl>
        ) : <p className="mt-3 text-sm text-stone-500">比較データなし</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">GA4改善候補</h2>
            <p className="mt-1 text-sm text-stone-500">閲覧はあるのにLINE・予約行動につながっていないページを優先表示します。</p>
          </div>
          <Badge tone="info">{candidateRows.length}件</Badge>
        </div>
        <CandidateTable candidates={candidateRows} />
      </section>

      <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5" id="gemini-analysis">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-teal-700">{analysis?.providerLabel ?? "未分析"}</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Gemini GA4分析</h2>
          </div>
          <button className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60" disabled={isAnalyzing} onClick={() => void handleAnalyze()} type="button">
            {isAnalyzing ? "分析中" : analysis ? "再分析する" : "GA4分析する"}
          </button>
        </div>
        <div className="mt-4"><StatusMessage isLoading={isAnalyzing} tone={actionTone}>{actionMessage || "集計値と改善候補だけをGeminiへ送ります。CSV全行は送信しません。"}</StatusMessage></div>
        {analysis ? <AnalysisResult analysis={analysis} /> : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-stone-500 sm:text-sm">{label}</p><p className="mt-2 text-xl font-semibold text-stone-950 sm:text-2xl">{value}</p></article>;
}

function Change({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-teal-500 pl-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold text-stone-950">{value}</dd></div>;
}

function signed(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
function formatPercentChange(value: number | null) { return value === null ? "比較不可" : `${signed(value)}%`; }

function CandidateTable({ candidates }: { candidates: Ga4Candidate[] }) {
  if (candidates.length === 0) return <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">現在のしきい値に該当する候補はありません。</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead><tr className="border-b border-stone-200 text-xs text-stone-500"><th className="px-4 py-3">ページ／流入元</th><th className="px-4 py-3">ユーザー</th><th className="px-4 py-3">表示</th><th className="px-4 py-3">行動</th><th className="px-4 py-3">理由</th></tr></thead>
        <tbody>{candidates.map((item) => <tr className="border-b border-stone-100 last:border-0" key={`${item.category}-${item.key}`}><td className="max-w-80 px-4 py-3"><p className="break-words font-semibold text-stone-900">{item.key}</p><p className="mt-1 text-xs leading-5 text-stone-500">{item.pageTitle || item.sourceMedium || item.channelGroup}</p></td><td className="px-4 py-3">{item.users}</td><td className="px-4 py-3">{item.views}</td><td className="px-4 py-3">{item.lineClicks + item.reservationClicks + item.conversions}</td><td className="min-w-60 px-4 py-3 text-xs leading-5 text-stone-600">{item.reason}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: Ga4Analysis }) {
  return (
    <div className="mt-5 space-y-5">
      <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{analysis.summary}</p>
      <div className="grid gap-5 md:grid-cols-2"><TextList title="良かった点" items={analysis.positivePoints} /><TextList title="改善したい点" items={analysis.negativePoints} /></div>
      <TextList title="コンバージョン改善案" items={analysis.conversionIdeas} />
      <TextList title="LINE CTA案" items={analysis.lineCtaSuggestions} />
      <div>
        <h3 className="text-sm font-semibold text-stone-950">ブログ・コンテンツ案</h3>
        <div className="mt-3 grid gap-3">
          {analysis.contentIdeas.map((idea) => (
            <article className="rounded-md border border-stone-200 p-4" key={`${idea.targetKeyword}-${idea.title}`}>
              <p className="font-semibold text-stone-950">{idea.title}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{idea.reason}</p>
              <Link className="mt-3 inline-flex min-h-10 items-center rounded-md bg-stone-950 px-3 text-sm font-semibold text-white" href={`/blog?${new URLSearchParams({ articleSummary: idea.reason, keyword: idea.targetKeyword, memo: idea.reason, searchIntent: idea.reason, title: idea.title, view: "generator" }).toString()}`}>この内容で記事を作成</Link>
            </article>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-stone-950">今月のGA4改善タスク</h3>
        <div className="mt-3 grid gap-3">
          {analysis.monthlyTasks.map((task) => (
            <div className="rounded-md border border-stone-200 p-4" key={`${task.taskType}-${task.title}`}>
              <div className="flex flex-wrap gap-2"><Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Badge><Badge tone="info">{task.taskType}</Badge></div>
              <p className="mt-2 font-semibold text-stone-950">{task.title}</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">{task.reason}</p>
            </div>
          ))}
        </div>
      </div>
      <TextList title="次の行動" items={analysis.nextActions} />
    </div>
  );
}

function TextList({ items, title }: { items: string[]; title: string }) {
  return <section><h3 className="text-sm font-semibold text-stone-950">{title}</h3>{items.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-600">{items.map((item) => <li key={item}>・{item}</li>)}</ul> : <p className="mt-2 text-sm text-stone-500">該当なし</p>}</section>;
}
