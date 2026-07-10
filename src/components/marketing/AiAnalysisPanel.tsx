"use client";

import { useState } from "react";
import { AiRoleNotice } from "@/components/marketing/AiRoleNotice";
import { StatusMessage } from "@/components/ui/StatusMessage";

type AiAnalysisResponse = {
  analysis?: string;
  isMock?: boolean;
  providerLabel?: string;
};

type AiAnalysisPanelProps = {
  context: unknown;
  fallbackText: string;
  isUsingRealData?: boolean;
  scope: "seo" | "ads" | "integrated";
  title?: string;
};

export function AiAnalysisPanel({
  context,
  fallbackText,
  isUsingRealData = false,
  scope,
  title = "AI改善提案",
}: AiAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState(fallbackText);
  const [providerLabel, setProviderLabel] = useState(
    isUsingRealData ? "Gemini未実行" : "サンプル提案",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(
    isUsingRealData
      ? "AI分析を押すと、取り込み済みの集計データを分析します。"
      : "現在の参考データをもとに表示しています。",
  );
  const [tone, setTone] = useState<"info" | "success" | "warning">("info");

  async function handleAnalyze() {
    setIsLoading(true);
    setTone("info");
    setMessage("AIが改善案を整理しています。");

    try {
      const response = await fetch("/api/marketing/analyze", {
        body: JSON.stringify({ context, scope }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as AiAnalysisResponse;

      if (!response.ok || !data.analysis) {
        throw new Error("AI analysis failed");
      }

      setAnalysis(data.analysis);
      setProviderLabel(data.providerLabel ?? "AI分析");
      setTone(data.isMock ? "warning" : "success");
      setMessage(
        data.isMock
          ? "AI APIを利用できなかったため、モック提案を表示しています。"
          : `${data.providerLabel ?? "AI"}で改善提案を作成しました。`,
      );
    } catch {
      setAnalysis(fallbackText);
      setProviderLabel("モック分析");
      setTone("warning");
      setMessage("通信に失敗したため、モック提案を表示しています。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-700">{providerLabel}</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">{title}</h2>
        </div>
        <button
          className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          onClick={handleAnalyze}
          type="button"
        >
          {isLoading ? "分析中..." : "AIで改善提案"}
        </button>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
        {analysis}
      </p>

      <div className="mt-5">
        <AiRoleNotice scope={scope} />
      </div>

      <div className="mt-4">
        <StatusMessage isLoading={isLoading} tone={tone}>
          {message}
        </StatusMessage>
      </div>
    </section>
  );
}
