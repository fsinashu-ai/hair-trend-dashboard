"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { conversionDefinitions } from "@/config/conversions";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { useGa4Dataset } from "@/components/seo/ga4/useGa4Dataset";
import {
  createConversionOverview,
  formatConversionRate,
} from "@/lib/conversions/metrics";
import type {
  ConversionAggregateRow,
  ConversionAnalysis,
  ConversionAnalysisTask,
  ConversionOpportunity,
} from "@/types/conversions";

type ConversionDashboardProps = {
  initialImportId?: string;
};

export function ConversionDashboard({ initialImportId }: ConversionDashboardProps) {
  const { dataset, isLoading, load, message, storageMode } = useGa4Dataset(initialImportId);
  const [selectedImportId, setSelectedImportId] = useState(initialImportId ?? "");
  const [analysis, setAnalysis] = useState<ConversionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionTone, setActionTone] = useState<"info" | "success" | "warning" | "error">("info");
  const [actionMessage, setActionMessage] = useState("");
  const [savingTaskKey, setSavingTaskKey] = useState("");

  const effectiveImportId = selectedImportId || dataset.imports[0]?.id || "";
  const selectedImport = dataset.imports.find((item) => item.id === effectiveImportId) ?? dataset.imports[0];
  const rows = useMemo(
    () => (selectedImport ? dataset.rowsByImport[selectedImport.id] ?? [] : []),
    [dataset.rowsByImport, selectedImport],
  );
  const overview = useMemo(() => createConversionOverview(rows), [rows]);

  async function handleImportChange(importId: string) {
    setSelectedImportId(importId);
    setAnalysis(null);
    if (storageMode === "supabase") await load(importId);
  }

  async function handleAnalyze() {
    if (!selectedImport || rows.length === 0) {
      setActionTone("warning");
      setActionMessage("分析できるGA4データがありません。先にGA4 CSVを取り込んでください。");
      return;
    }

    setIsAnalyzing(true);
    setActionTone("info");
    setActionMessage("Geminiがコンバージョン導線を分析しています。");

    try {
      const response = await fetch("/api/seo/conversions/analyze", {
        body: JSON.stringify({
          currentImport: selectedImport,
          importId: selectedImport.id,
          rows,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        analysis?: ConversionAnalysis;
        error?: string;
        reused?: boolean;
      };
      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "コンバージョン分析に失敗しました。");
      }
      setAnalysis(data.analysis);
      setActionTone(data.analysis.provider === "mock" ? "warning" : "success");
      setActionMessage(
        data.reused
          ? "保存済みの分析結果を再利用しました。"
          : `${data.analysis.providerLabel}で分析しました。`,
      );
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "コンバージョン分析に失敗しました。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSaveTask(task: ConversionAnalysisTask) {
    if (!selectedImport) return;
    setSavingTaskKey(task.title);
    setActionTone("info");
    setActionMessage("SEOタスクへ登録しています。");

    try {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const response = await fetch("/api/seo/tasks", {
        body: JSON.stringify({
          dueDate,
          importId: selectedImport.id,
          suggestion: {
            keyword: "コンバージョン改善",
            pageUrl: task.pageUrl ?? "",
            priority: task.priority,
            reason: task.reason,
            taskType: task.taskType,
            title: task.title,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { duplicate?: boolean; error?: string; storageMode?: string };
      if (!response.ok) throw new Error(data.error || "SEOタスクへ登録できませんでした。");
      setActionTone(data.duplicate ? "warning" : "success");
      setActionMessage(
        data.duplicate
          ? "同じSEOタスクがすでに登録されています。"
          : "SEOタスクへ登録しました。",
      );
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "SEOタスクへ登録できませんでした。");
    } finally {
      setSavingTaskKey("");
    }
  }

  if (!selectedImport) {
    return (
      <StatusMessage tone="warning">
        GA4データがありません。先にGA4 CSVを取り込むと、LINE・予約などの成果を確認できます。
      </StatusMessage>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-stone-700">
          対象GA4データ
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50" href="/seo/ga4/import">
            GA4 CSVを取り込む
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50" href="/seo/ga4">
            GA4分析を見る
          </Link>
        </div>
      </section>

      <StatusMessage isLoading={isLoading} tone={storageMode === "demo" ? "warning" : "info"}>
        {message}
      </StatusMessage>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="成果行動" value={`${overview.metrics.totalActions.toLocaleString("ja-JP")}件`} />
        <MetricCard label="CV率" value={formatConversionRate(overview.metrics.conversionRate)} />
        <MetricCard label="LINEクリック" value={`${overview.metrics.lineClicks.toLocaleString("ja-JP")}件`} />
        <MetricCard label="予約クリック" value={`${overview.metrics.reservationClicks.toLocaleString("ja-JP")}件`} />
        <MetricCard label="電話クリック" value={`${overview.metrics.phoneClicks.toLocaleString("ja-JP")}件`} />
        <MetricCard label="Instagram遷移" value={`${overview.metrics.instagramClicks.toLocaleString("ja-JP")}件`} />
        <MetricCard label="地図・マップ" value={`${overview.metrics.mapClicks.toLocaleString("ja-JP")}件`} />
        <MetricCard label="キーイベント" value={`${overview.metrics.keyEvents.toLocaleString("ja-JP")}件`} />
      </section>

      <section className="rounded-lg border border-teal-200 bg-teal-50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-teal-950">成果として見る行動</h2>
            <p className="mt-1 text-sm leading-6 text-teal-900">
              GA4のイベント名が分かるCSVを追加すると、LINE・予約・電話などの分類精度が上がります。
            </p>
          </div>
          <Badge tone="info">{conversionDefinitions.length}種類</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {conversionDefinitions.map((definition) => (
            <article className="rounded-md border border-teal-100 bg-white p-4" key={definition.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-stone-950">{definition.label}</h3>
                <Badge tone={definition.priority === "high" ? "danger" : definition.priority === "medium" ? "warning" : "neutral"}>
                  {definition.priority}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-600">{definition.description}</p>
              <p className="mt-2 text-xs text-stone-500">例: {definition.examples.join(" / ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ConversionList title="成果が多いページ・流入元" items={overview.topConverters} emptyText="成果が記録されたページ・流入元はまだありません。" />
        <OpportunityList items={overview.opportunities} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ConversionList title="ページ別の成果" items={overview.byPage.slice(0, 10)} emptyText="ページ別データがありません。" />
        <ConversionList title="流入元別の成果" items={overview.bySource.slice(0, 10)} emptyText="流入元別データがありません。" />
      </section>

      <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5" id="gemini-analysis">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-teal-700">{analysis?.providerLabel ?? "未分析"}</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Gemini コンバージョン分析</h2>
          </div>
          <button
            className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={isAnalyzing}
            onClick={() => void handleAnalyze()}
            type="button"
          >
            {isAnalyzing ? "分析中" : analysis ? "再分析する" : "コンバージョン分析する"}
          </button>
        </div>
        <div className="mt-4">
          <StatusMessage isLoading={isAnalyzing} tone={actionTone}>
            {actionMessage || "集計済みの成果データだけをGeminiへ送ります。CSV全行は送信しません。"}
          </StatusMessage>
        </div>
        {analysis ? (
          <AnalysisResult
            analysis={analysis}
            onSaveTask={(task) => void handleSaveTask(task)}
            savingTaskKey={savingTaskKey}
          />
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500 sm:text-sm">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-950 sm:text-2xl">{value}</p>
    </article>
  );
}

function ConversionList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: ConversionAggregateRow[];
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-stone-950">{title}</h2>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm" key={`${item.type}-${item.key}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="break-words font-semibold text-stone-950">{item.label}</h3>
                <Badge tone={item.metrics.totalActions > 0 ? "success" : "neutral"}>
                  {item.metrics.totalActions}件
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {item.pageTitle || item.sourceMedium || item.channelGroup || item.eventName || "詳細未取得"}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <SmallMetric label="セッション" value={item.sessions.toLocaleString("ja-JP")} />
                <SmallMetric label="ユーザー" value={item.users.toLocaleString("ja-JP")} />
                <SmallMetric label="CV率" value={formatConversionRate(item.metrics.conversionRate)} />
                <SmallMetric label="LINE" value={item.metrics.lineClicks.toLocaleString("ja-JP")} />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-stone-50 p-5 text-sm text-stone-500">{emptyText}</p>
      )}
    </section>
  );
}

function OpportunityList({ items }: { items: ConversionOpportunity[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-stone-950">改善候補</h2>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm" key={`${item.target}-${item.key}-${item.reason}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "neutral"}>
                  {item.priority}
                </Badge>
                <Badge tone="warning">{item.target}</Badge>
              </div>
              <h3 className="mt-3 break-words font-semibold text-stone-950">{item.label}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.reason}</p>
              <p className="mt-2 text-sm leading-6 text-teal-800">{item.recommendedAction}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-stone-50 p-5 text-sm text-stone-500">
          現在のしきい値では大きな改善候補はありません。イベントCSVを追加すると、より細かく確認できます。
        </p>
      )}
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 font-semibold text-stone-950">{value}</dd>
    </div>
  );
}

function AnalysisResult({
  analysis,
  onSaveTask,
  savingTaskKey,
}: {
  analysis: ConversionAnalysis;
  onSaveTask: (task: ConversionAnalysisTask) => void;
  savingTaskKey: string;
}) {
  return (
    <div className="mt-5 space-y-5">
      <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{analysis.summary}</p>
      <div className="grid gap-5 md:grid-cols-2">
        <TextList items={analysis.goodSignals} title="良い兆し" />
        <TextList items={analysis.bottlenecks} title="詰まりやすい点" />
      </div>
      <TextList items={analysis.ctaSuggestions} title="CTA文案" />
      <TextList items={analysis.trackingSuggestions} title="計測改善メモ" />
      <div>
        <h3 className="text-sm font-semibold text-stone-950">優先改善</h3>
        <div className="mt-3 grid gap-3">
          {analysis.priorityFixes.map((item) => (
            <article className="rounded-md border border-stone-200 p-4" key={`${item.target}-${item.key}-${item.reason}`}>
              <div className="flex flex-wrap gap-2">
                <Badge tone={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "neutral"}>
                  {item.priority}
                </Badge>
                <Badge>{item.target}</Badge>
              </div>
              <p className="mt-2 font-semibold text-stone-950">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.reason}</p>
              <p className="mt-1 text-sm leading-6 text-teal-800">{item.recommendedAction}</p>
            </article>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-stone-950">今月の改善タスク</h3>
        <div className="mt-3 grid gap-3">
          {analysis.monthlyTasks.map((task) => (
            <article className="rounded-md border border-stone-200 p-4" key={`${task.taskType}-${task.title}`}>
              <div className="flex flex-wrap gap-2">
                <Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>
                  {task.priority}
                </Badge>
                <Badge tone="info">{task.taskType}</Badge>
              </div>
              <p className="mt-2 font-semibold text-stone-950">{task.title}</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">{task.reason}</p>
              <button
                className="mt-3 min-h-10 rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
                disabled={savingTaskKey === task.title}
                onClick={() => onSaveTask(task)}
                type="button"
              >
                {savingTaskKey === task.title ? "登録中" : "SEOタスクへ登録"}
              </button>
            </article>
          ))}
        </div>
      </div>
      <TextList items={analysis.nextActions} title="次の行動" />
    </div>
  );
}

function TextList({ items, title }: { items: string[]; title: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-600">
          {items.map((item) => (
            <li key={item}>・{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-stone-500">該当なし</p>
      )}
    </section>
  );
}
